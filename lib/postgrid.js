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
  chunkSizeBytes: 1024 * 255,
  concurrency: 10,
  cacheSize: 400
}

let PostGrid = function (connOpts, bucketOptions) {
  let sql = new Sequelize(connOpts.db, connOpts.username, connOpts.password, {
    host: connOpts.host,
    dialect: 'postgres',
    // logging: false
  })
  let conf = Object.assign({}, defaultBucketOptions, bucketOptions)

  let files = sql.define(`${conf.bucketName}_files`, {
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
  })

  let chunks = sql.define(`${conf.bucketName}_chunks`, {
    id: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    num: {
      type: Sequelize.BIGINT
    },
    data: {
      type: Sequelize.BLOB
    },
    file_id: {
      type: Sequelize.BIGINT,
      references: {
        model: files
      }
    }
  })

  // Configure caches
  let cache
  let isCaching = conf.cacheSize > 0
  if (isCaching) {
    cache = lruCache({
      max: conf.cacheSize
    })
  }

  let initBucket = async function ({dropTables = false} = {}) {
    await sql.authenticate()
    await sql.sync({force: dropTables})

    chunks.belongsTo(files)
    files.hasMany(chunks)
  }

  return Object.freeze({
    initBucket
  })
}

module.exports = PostGrid
