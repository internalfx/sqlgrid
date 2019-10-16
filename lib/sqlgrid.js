'use strict'

const Promise = require('bluebird')
Promise.config({
  warnings: {
    wForgottenReturn: false
  }
})

const ifxUtils = require('./ifx-utils')
const initDatabase = require('./initDatabase.js')

const Readable = require('stream').Readable
const Writable = require('stream').Writable
const crypto = require('crypto')
const toArray = require('stream-to-array')
const lruCache = require('lru-cache')
const chunkSize = 1024 * 1024

const defaultBucketOptions = {
  bucketName: 'sqlgrid',
  concurrency: 10,
  cacheSize: 100
}

let SQLGrid = function (sequelizeOpts, bucketOptions) {
  let isInstance = typeof sequelizeOpts.define === 'function'
  let dialect = isInstance ? sequelizeOpts.options.dialect : sequelizeOpts.dialect
  if (dialect === 'sqlite') { defaultBucketOptions.concurrency = 1 } // Disable concurrency for sqlite
  let conf = Object.assign({}, defaultBucketOptions, bucketOptions)
  let { sql, files, pointers, chunks } = initDatabase(sequelizeOpts, conf)

  // Configure caches
  let cache
  let isCaching = conf.cacheSize > 0
  if (isCaching) {
    cache = lruCache({
      max: conf.cacheSize * 1024 * 1024,
      length: function (val, key) { return val.length }
    })
  }

  let destroyFileById = async function (id) {
    let file = await files.findByPk(id)
    await file.update({
      status: 'Deleted'
    })
    let filePointers = await pointers.findAll({
      where: {
        file_id: id
      }
    })

    for (let pointer of filePointers) {
      let chunkId = pointer.chunk_id
      await pointer.destroy()
      let pointerCount = await pointers.count({
        where: {
          chunk_id: chunkId
        }
      })
      if (pointerCount === 0) {
        await chunks.destroy({
          where: {
            id: chunkId
          }
        })
      }
    }
    await files.destroy({
      where: {
        id: id
      }
    })
  }

  let writeChunk = async function (file, num, data) {
    let hash = crypto.createHash('sha256').update(data).digest('hex')

    let [chunk] = await chunks.findOrCreate({
      where: {
        sha256: hash
      },
      defaults: {
        data: data
      }
    })

    await pointers.create({
      num: num,
      file_id: file.id,
      chunk_id: chunk.id
    })
  }

  let fetchFileById = async function (id) {
    let file = await files.findByPk(id)
    return file.get({ plain: true })
  }

  let fetchFileByName = async function (filename, revision = -1) {
    let result

    let revSteps
    let query
    if (revision === 'all') {
      query = files.findAll({
        where: {
          status: 'Complete',
          filename: filename
        },
        order: [['finished_at', 'DESC']]
      })
    } else if (revision >= 0) {
      revSteps = revision
      query = files.findAll({
        where: {
          status: 'Complete',
          filename: filename
        },
        order: [['finished_at', 'ASC']]
      })
    } else {
      revSteps = (revision * -1) - 1
      query = files.findAll({
        where: {
          status: 'Complete',
          filename: filename
        },
        order: [['finished_at', 'DESC']]
      })
    }

    let fileList = await query

    if (fileList.length === 0) { throw new Error('File not found!') }

    if (revision === 'all') {
      result = fileList.map(f => f.get({ plain: true }))
    } else {
      if (fileList.length < (revSteps + 1)) { throw new Error('File revision does not exist!') }

      result = fileList[revSteps]
      result = result.get({ plain: true })
    }

    return result
  }

  let createChunkLoader = function (file, startNum, endNum) {
    let num = startNum
    let queueNum = startNum
    let queue = []

    let next = async function () {
      if (num > endNum) { return }

      while (queue.length < conf.concurrency && queueNum <= endNum) {
        let chunkKey = `chunk-${file.id}-${queueNum}`
        let chunk

        if (isCaching) {
          chunk = cache.get(chunkKey)
        }

        if (chunk != null) {
          queue.push({ key: chunkKey, data: Promise.resolve(chunk), cached: true })
        } else {
          let query = Promise.resolve(async function (fileId, num) {
            let fileChunk = await pointers.findOne({
              where: {
                file_id: fileId,
                num: num
              }
            })
            return chunks.findByPk(fileChunk.chunk_id)
          }(file.id, queueNum))
          queue.push({ key: chunkKey, query: query, cached: false })
        }
        queueNum += 1
      }

      let chunkData = queue.shift()
      let buffer
      if (chunkData.query) {
        let result = await chunkData.query
        buffer = result.data
      } else {
        buffer = chunkData.data
      }
      if (chunkData.cached === false && isCaching) {
        cache.set(chunkData.key, buffer)
      }

      num += 1
      return buffer
    }

    return {
      next
    }
  }

  let initBucket = async function ({ dropTables = false } = {}) {
    await sql.sync({ force: dropTables })
  }

  let writeFile = async function (spec = {}) {
    spec = Object.assign({
      filename: null,
      buffer: null
    }, spec)

    if (spec.buffer == null) { throw new Error('buffer must not be null') }

    let wstream = createWriteStream(spec)
    let uploadPromise = ifxUtils.writeStreamPromise(wstream)
    wstream.write(spec.buffer)
    wstream.end()
    await uploadPromise

    let file = await fetchFileByName(spec.filename)
    return file
  }

  let createWriteStream = function (spec = {}) {
    spec = Object.assign({
      filename: null
    }, spec)

    if (spec.filename == null) { throw new Error('filename must not be null') }

    let stream = new Writable()
    let num = 0
    let currentChunk = Buffer.from([])
    let queue = []
    let fileHash = crypto.createHash('sha256')
    let size = 0
    let file

    stream._write = async function (chunk, encoding, cb) {
      size += chunk.length
      fileHash.update(chunk)

      if (file == null) {
        file = await files.create({
          filename: spec.filename,
          status: 'Incomplete'
        })
      }

      currentChunk = Buffer.concat([currentChunk, chunk])

      if (currentChunk.length >= chunkSize) {
        queue.push(Promise.resolve(writeChunk(file, num, currentChunk.slice(0, chunkSize))))
        currentChunk = currentChunk.slice(chunkSize)
        num += 1

        if (queue.length >= conf.concurrency) {
          await Promise.any(queue)
          queue = queue.filter((promise) => promise.isPending())
        }
      }

      cb()
    }

    stream._final = async function (cb) {
      if (file) {
        while (currentChunk.length > chunkSize) {
          queue.push(Promise.resolve(
            writeChunk(file, num, currentChunk.slice(0, chunkSize))
          ))
          currentChunk = currentChunk.slice(chunkSize)
          num += 1

          if (queue.length >= conf.concurrency) {
            await Promise.any(queue)
            queue = queue.filter((promise) => promise.isPending())
          }
        }

        queue.push(Promise.resolve(
          writeChunk(file, num, currentChunk)
        ))

        await Promise.all(queue)

        file = await file.update({
          finished_at: new Date(),
          size: size,
          status: 'Complete',
          sha256: fileHash.digest('hex')
        })
      } else {
        // If we are here the file must be empty!
        await files.create({
          filename: spec.filename,
          finished_at: new Date(),
          size: size,
          status: 'Complete',
          sha256: fileHash.digest('hex')
        })
      }

      cb()
    }

    return stream
  }

  let getFile = async function (spec = {}) {
    spec = Object.assign({
      filename: null,
      revision: -1,
      id: null
    }, spec)

    if (spec.id == null && spec.filename == null) { throw new Error('filename or id required') }

    let result

    if (spec.id != null) {
      result = await fetchFileById(spec.id)
    } else {
      result = await fetchFileByName(spec.filename, spec.revision)
    }

    return result
  }

  let readFile = async function (spec = {}) {
    spec = Object.assign({
      seekStart: null,
      seekEnd: null
    }, spec)

    let result = await getFile(spec)

    if (result != null) {
      if (Array.isArray(result)) {
        for (let file of result) {
          let stream = createReadStream({ id: file.id, seekStart: spec.seekStart, seekEnd: spec.seekEnd })
          file.buffer = await ifxUtils.readStreamPromise(stream)
        }
      } else {
        let stream = createReadStream({ id: result.id, seekStart: spec.seekStart, seekEnd: spec.seekEnd })
        result.buffer = await ifxUtils.readStreamPromise(stream)
      }
    }

    return result
  }

  let createReadStream = function (spec = {}) {
    spec = Object.assign({
      id: null,
      seekStart: null,
      seekEnd: null
    }, spec)

    if (spec.id == null) { throw new Error('id must not be null') }

    let stream = new Readable()
    stream.toArray = toArray
    let hash = crypto.createHash('sha256')
    let num = 0
    let startNum = 0
    let startOffset = 0
    let endNum = null
    let endOffset = null
    let chunkLoader
    let file
    let verifyHash = (spec.seekStart == null && spec.seekEnd == null)
    let isDestroyed = false

    stream._destroy = function () {
      isDestroyed = true
    }

    stream._read = async function () {
      let chunk

      if (file == null) {
        file = await fetchFileById(spec.id)
        if (spec.seekStart != null) {
          startNum = Math.floor(spec.seekStart / chunkSize)
          startOffset = spec.seekStart % chunkSize
        }

        spec.seekEnd = spec.seekEnd || parseInt(file.size, 10) + 1
        endNum = Math.floor((spec.seekEnd) / chunkSize)
        endOffset = (spec.seekEnd % chunkSize) + 1

        num = startNum
        chunkLoader = createChunkLoader(file, startNum, endNum)
      }

      chunk = await chunkLoader.next()

      if (isDestroyed) { return }

      if (chunk) {
        if (verifyHash) { hash.update(chunk) }
        if (num === startNum && num === endNum) {
          stream.push(chunk.slice(startOffset, endOffset))
        } else if (num === startNum) {
          stream.push(chunk.slice(startOffset))
        } else if (num === endNum) {
          stream.push(chunk.slice(0, endOffset))
        } else {
          stream.push(chunk)
        }
        num += 1
      } else {
        if (verifyHash) {
          var sha256 = hash.digest('hex')
          if (sha256 !== file.sha256) {
            process.nextTick(function () {
              stream.emit('error', new Error('sha256 hash mismatch: File is likely corrupted!'))
            })
            return
          }
        }
        stream.push(null)
      }
    }

    return stream
  }

  let deleteFileById = async function (spec = {}) {
    spec = Object.assign({
      id: null
    }, spec)

    if (spec.id == null) { throw new Error('id must not be null') }

    let file = await getFile(spec)

    if (file != null) {
      await destroyFileById(file.id)
      return true
    }

    return false
  }

  let deleteFileByName = async function (spec = {}) {
    spec = Object.assign({
      filename: null,
      revision: 'all'
    }, spec)

    if (spec.filename == null) { throw new Error('filename must not be null') }

    if (spec.revision === 'all') {
      let fileList = await files.findAll({
        where: {
          status: 'Complete',
          filename: spec.filename
        }
      })

      if (fileList.length > 0) {
        await Promise.map(fileList, async function (file) {
          await destroyFileById(file.id)
        })
        return true
      }

      return false
    } else {
      let file = await getFile(spec)

      if (file != null) {
        await destroyFileById(file.id)
        return true
      }

      return false
    }
  }

  return Object.freeze({
    initBucket,
    writeFile,
    createWriteStream,
    getFile,
    readFile,
    createReadStream,
    deleteFileById,
    deleteFileByName
  })
}

module.exports = SQLGrid
