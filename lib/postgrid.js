'use strict'

const Promise = require('bluebird')
Promise.config({
  warnings: {
    wForgottenReturn: false
  }
})

const Sequelize = require('sequelize')
const Readable = require('stream').Readable
const FlushWritable = require('flushwritable')
const crypto = require('crypto')
const toArray = require('stream-to-array')
const lruCache = require('lru-cache')

const defaultBucketOptions = {
  bucketName: 'fs',
  chunkSizeBytes: 1024 * 1024,
  concurrency: 10,
  cacheSize: 400
}

let PostGrid = function (connOpts, bucketOptions) {
  let sql = new Sequelize(connOpts.db, connOpts.username, connOpts.password, {
    host: connOpts.host,
    dialect: 'postgres',
    logging: false
  })
  let conf = Object.assign({}, defaultBucketOptions, bucketOptions)

  let files = sql.define(`files`, {
    id: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: Sequelize.TEXT
    },
    sha256: {
      type: Sequelize.TEXT
    },
    chunkSizeBytes: {
      type: Sequelize.BIGINT
    },
    length: {
      type: Sequelize.BIGINT
    },
    startedAt: {
      type: Sequelize.DATE
    },
    finishedAt: {
      type: Sequelize.DATE
    },
    status: {
      type: Sequelize.TEXT
    },
    metadata: {
      type: Sequelize.JSON
    },
    tags: {
      type: Sequelize.ARRAY(Sequelize.TEXT)
    }
  }, {timestamps: false})

  let chunks = sql.define(`chunks`, {
    id: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    num: {
      type: Sequelize.INTEGER
    },
    data: {
      type: Sequelize.BLOB
    },
    file_id: {
      type: Sequelize.BIGINT,
      references: {
        model: files,
        key: 'id'
      }
    }
  }, {timestamps: false})

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
    await sql.authenticate()
    await sql.sync({force: dropTables})
  }

  let upload = function (filename, options = {}) {
    let stream = new FlushWritable()
    let chunkSizeBytes = options.chunkSizeBytes || conf.chunkSizeBytes
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
          filename: filename,
          chunkSizeBytes: chunkSizeBytes,
          startedAt: new Date(),
          status: 'Incomplete',
          metadata: options.metadata
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

    stream._flush = async function (cb) {
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
          filename: filename,
          finishedAt: new Date(),
          startedAt: new Date(),
          length: size,
          status: 'Complete',
          sha256: hash.digest('hex'),
          chunkSizeBytes: chunkSizeBytes,
          metadata: options.metadata
        })
      }

      cb()
    }

    return stream
  }

  let downloadId = function (fileId, options = {}) {
    options = Object.assign({
      seekStart: null,
      seekEnd: null
    }, options)

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
    let verifyHash = (options.seekStart == null && options.seekEnd == null)

    stream._read = async function () {
      let chunk

      if (file == null) {
        file = await fetchFileById(fileId)
        chunkSize = file.chunkSizeBytes
        if (options.seekStart != null) {
          startNum = Math.floor(options.seekStart / chunkSize)
          startOffset = options.seekStart % chunkSize
        }

        options.seekEnd = options.seekEnd || file.length + 1
        endNum = Math.floor((options.seekEnd) / chunkSize)
        endOffset = (options.seekEnd % chunkSize) + 1

        num = startNum
        chunkLoader = createChunkLoader(file, startNum, endNum)
      }

      chunk = await chunkLoader.next()

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
            throw new Error('sha256 hash mismatch: File is likely corrupted!')
          }
        }
        stream.push(null)
      }
    }

    return stream
  }

  let downloadFilename = function (filename, options = {}) {
    options = Object.assign({
      revision: -1,
      seekStart: null,
      seekEnd: null
    }, options)

    let stream = new Readable({objectMode: true})
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
    let verifyHash = (options.seekStart == null && options.seekEnd == null)

    stream._read = async function () {
      let chunk

      if (file == null) {
        file = await fetchFileByName(filename, options.revision)

        chunkSize = file.chunkSizeBytes
        if (options.seekStart != null) {
          startNum = Math.floor(options.seekStart / chunkSize)
          startOffset = options.seekStart % chunkSize
        }

        options.seekEnd = options.seekEnd || file.length + 1
        endNum = Math.floor((options.seekEnd) / chunkSize)
        endOffset = (options.seekEnd % chunkSize) + 1

        num = startNum
        chunkLoader = createChunkLoader(file, startNum, endNum)
      }

      chunk = await chunkLoader.next()

      if (chunk) {
        if (chunk.num !== num) {
          throw new Error('Chunk number mismatch: File is likely corrupted!')
        }
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
            throw new Error('sha256 hash mismatch: File is likely corrupted!')
          }
        }
        stream.push(null)
      }
    }

    return stream
  }

  let getFilename = function (filename, options = {}) {
    options = Object.assign({
      revision: -1
    }, options)

    return fetchFileByName(filename, options.revision)
  }

  return Object.freeze({
    initBucket,
    upload,
    downloadId,
    downloadFilename,
    getFilename
  })
}

module.exports = PostGrid
