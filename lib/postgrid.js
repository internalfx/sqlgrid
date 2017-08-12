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
  let sequel = new Sequelize(connOpts.db, connOpts.username, connOpts.password, {
    host: connOpts.host,
    dialect: 'postgres'
  })
  let conf = Object.assign({}, defaultBucketOptions, bucketOptions)
  let fileTable = `${conf.bucketName}_files`
  let chunkTable = `${conf.bucketName}_chunks`
  let isCaching = conf.cacheSize > 0
  let cache

  if (isCaching) {
    cache = lruCache({
      max: conf.cacheSize
    })
  }

  let initBucket = async function () {
    // Create tables if they don't exist.
  }

  return Object.freeze({
    initBucket
  })
}

module.exports = PostGrid
