'use strict'

/* global describe, it, before */

let path = require('path')
let fs = require('fs')
let Promise = require('bluebird')
let PostGrid = require('../index')

let streamPromise = function (stream) {
  return new Promise(function (resolve, reject) {
    stream.on('end', resolve)
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

describe('initBucket()', function () {
  it('complete without error', async function () {
    let pGrid = PostGrid({db: 'test', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
  })
})

describe('upload()', function () {
  let pGrid

  before(async function () {
    pGrid = PostGrid({db: 'test', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
  })

  it('should write a file correctly', async function () {
    let writeStream = pGrid.upload('/videos/shore.mp4')

    fs.createReadStream(path.join(__dirname, 'videos', 'shore.mp4')).pipe(writeStream)

    await Promise.fromCallback(function (cb) { writeStream.on('finish', cb) })

    var gridStream = pGrid.downloadFilename('/videos/shore.mp4')
    var fileStream = fs.createWriteStream('./shore2.mp4')

    gridStream.pipe(fileStream)

    await Promise.all([
      streamPromise(gridStream),
      streamPromise(fileStream)
    ])

    // let file = await r.table('fs_files').filter({filename: '/docs/lipsum.txt'}).nth(0).without('finishedAt', 'startedAt', 'id').default(null).run()
    // file = JSON.stringify(file)
    // assert.equal(file, `{"chunkSizeBytes":261120,"filename":"/docs/lipsum.txt","length":1417,"sha256":"1748f5745c3ef44ba4e1f212069f6e90e29d61bdd320a48c0b06e1255864ed4f","status":"Complete"}`)
    // done()
  })
})
