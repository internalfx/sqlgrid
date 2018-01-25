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

const defaultBucketOptions = {
  bucketName: 'fs',
  chunkSizeBytes: 1024 * 1024,
  concurrency: 10,
  cacheSize: 400
}

let PostGrid = function (sequelizeOpts, bucketOptions) {
  let conf = Object.assign({}, defaultBucketOptions, bucketOptions)
  let {sql, files, chunks} = initDatabase(sequelizeOpts, conf)

  // Configure caches
  let cache
  let isCaching = conf.cacheSize > 0
  if (isCaching) {
    cache = lruCache({
      max: conf.cacheSize
    })
  }

  let fetchFileById = async function (id) {
    let fileKey = `file-${id}`
    let file

    if (isCaching) {
      file = cache.get(fileKey)
    }

    if (file == null) {
      file = await files.findById(id)
      file = file.get({plain: true})
      if (file != null && isCaching) {
        cache.set(fileKey, file)
      }
    }

    return file
  }

  let fetchFileByName = async function (filename, revision = -1) {
    let fileKey = `file-${filename}`
    let file

    if (revision === -1 && isCaching) {
      file = cache.get(fileKey)
    }

    if (file == null) {
      let revSteps
      let query
      if (revision >= 0) {
        revSteps = revision
        query = files.findAll({
          where: {
            status: 'Complete',
            filename: filename
          },
          order: ['finishedAt', 'ASC']
        })
      } else {
        revSteps = (revision * -1) - 1
        query = files.findAll({
          where: {
            status: 'Complete',
            filename: filename
          },
          order: [['finishedAt', 'DESC']]
        })
      }

      let fileList = await query

      if (fileList.length === 0) { throw new Error('File not found!') }
      if (fileList.length < (revSteps + 1)) { throw new Error('File revision does not exist!') }

      file = fileList[revSteps]
      file = file.get({plain: true})

      if (file != null && revision === -1 && isCaching) {
        cache.set(fileKey, file)
      }
    }

    return file
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
          queue.push({key: chunkKey, chunk: Promise.resolve(chunk), cached: true})
        } else {
          let query = chunks.findOne({
            where: {
              file_id: file.id,
              num: queueNum
            }
          })
          queue.push({key: chunkKey, chunk: query, cached: false})
        }
        queueNum += 1
      }

      let chunkData = queue.shift()
      let chunk = await chunkData.chunk
      if (chunkData.cached === false && isCaching) {
        cache.set(chunkData.key, chunk)
      }

      num += 1
      return chunk
    }

    return {
      next
    }
  }

  let initBucket = async function ({dropTables = false} = {}) {
    await sql.sync({force: dropTables})
  }

  let writeFile = async function (spec = {}) {
    spec = Object.assign({
      filename: null,
      buffer: null,
      chunkSizeBytes: conf.chunkSizeBytes,
      metadata: {},
      tags: []
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
      filename: null,
      chunkSizeBytes: conf.chunkSizeBytes,
      metadata: {},
      tags: []
    }, spec)

    if (spec.filename == null) { throw new Error('filename must not be null') }

    let stream = new Writable()
    let chunkSizeBytes = spec.chunkSizeBytes
    let num = 0
    let currentChunk = Buffer.from([])
    let queue = []
    let hash = crypto.createHash('sha256')
    let size = 0
    let file

    stream._write = async function (chunk, encoding, cb) {
      size += chunk.length
      hash.update(chunk)

      if (file == null) {
        file = await files.create({
          filename: spec.filename,
          chunkSizeBytes: chunkSizeBytes,
          startedAt: new Date(),
          status: 'Incomplete',
          metadata: spec.metadata,
          tags: spec.tags
        })
      }

      currentChunk = Buffer.concat([currentChunk, chunk])

      if (currentChunk.length >= chunkSizeBytes) {
        queue.push(chunks.create({
          file_id: file.id,
          num: num,
          data: currentChunk.slice(0, chunkSizeBytes)
        }))
        currentChunk = currentChunk.slice(chunkSizeBytes)
        num += 1

        if (queue.length >= 10) {
          await Promise.any(queue)
          queue = queue.filter((promise) => promise.isPending())
        }
      }

      cb()
    }

    stream._final = async function (cb) {
      if (file) {
        let lastChunks = []
        while (currentChunk.length > chunkSizeBytes) {
          lastChunks.push(currentChunk.slice(0, chunkSizeBytes))
          currentChunk = currentChunk.slice(chunkSizeBytes)
        }
        lastChunks.push(currentChunk)

        for (let chunk of lastChunks) {
          queue.push(chunks.create({
            file_id: file.id,
            num: num,
            data: chunk
          }))
          num += 1
        }

        await Promise.all(queue)

        file = await file.update({
          finishedAt: new Date(),
          length: size,
          status: 'Complete',
          sha256: hash.digest('hex')
        })
      } else {
        // If we are here the file must be empty!
        await files.create({
          filename: spec.filename,
          finishedAt: new Date(),
          startedAt: new Date(),
          length: size,
          status: 'Complete',
          sha256: hash.digest('hex'),
          chunkSizeBytes: chunkSizeBytes,
          metadata: spec.metadata
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

    let file

    if (spec.id != null) {
      file = await fetchFileById(spec.id)
    } else {
      file = await fetchFileByName(spec.filename, spec.revision)
    }

    return file
  }

  let readFile = async function (spec = {}) {
    spec = Object.assign({
      seekStart: null,
      seekEnd: null
    }, spec)

    let file = await getFile(spec)

    if (file != null) {
      let stream = createReadStream({id: file.id, seekStart: spec.seekStart, seekEnd: spec.seekEnd})
      file.buffer = await ifxUtils.readStreamPromise(stream)
    }

    return file
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
    let chunkSize
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
        chunkSize = file.chunkSizeBytes
        if (spec.seekStart != null) {
          startNum = Math.floor(spec.seekStart / chunkSize)
          startOffset = spec.seekStart % chunkSize
        }

        spec.seekEnd = spec.seekEnd || file.length + 1
        endNum = Math.floor((spec.seekEnd) / chunkSize)
        endOffset = (spec.seekEnd % chunkSize) + 1

        num = startNum
        chunkLoader = createChunkLoader(file, startNum, endNum)
      }

      chunk = await chunkLoader.next()

      if (isDestroyed) { return }

      if (chunk) {
        if (verifyHash) { hash.update(chunk.data) }
        if (num === startNum && num === endNum) {
          stream.push(chunk.data.slice(startOffset, endOffset))
        } else if (num === startNum) {
          stream.push(chunk.data.slice(startOffset))
        } else if (num === endNum) {
          stream.push(chunk.data.slice(0, endOffset))
        } else {
          stream.push(chunk.data)
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

  return Object.freeze({
    initBucket,
    writeFile,
    createWriteStream,
    getFile,
    readFile,
    createReadStream
  })
}

module.exports = PostGrid
