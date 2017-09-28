'use strict'

/* global describe, it, before */

let path = require('path')
let Promise = require('bluebird')
let fs = Promise.promisifyAll(require('fs'))
let PostGrid = require('../index')

describe('initBucket()', function () {
  it('complete without error', async function () {
    let pGrid = PostGrid({db: 'postgrid', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
  })
})

describe('writeFile()', function () {
  let pGrid

  before(async function () {
    pGrid = PostGrid({db: 'postgrid', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
  })

  it('complete without error', async function () {
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'shore.mp4'))
    await pGrid.writeFile({
      filename: '/videos/shore.mp4',
      buffer: buffer,
      tags: ['drone', 'ocean', 'flying']
    })
  })
})
