'use strict'

/* global describe, it, before */

let path = require('path')
let Promise = require('bluebird')
let fs = Promise.promisifyAll(require('fs'))
let PostGrid = require('../index')
let ifxUtils = require('../lib/ifx-utils.js')

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
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await pGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })
})

describe('createWriteStream()', function () {
  let pGrid

  before(async function () {
    pGrid = PostGrid({db: 'postgrid', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
  })

  it('complete without error', async function () {
    let rStream = await fs.createReadStream(path.join(__dirname, 'files', 'enterprise.jpg'))
    let wStream = pGrid.createWriteStream({
      filename: '/pictures/enterprise.jpg'
    })

    rStream.pipe(wStream)

    await ifxUtils.writeStreamPromise(wStream)
  })
})

describe('getFile()', function () {
  let pGrid

  before(async function () {
    pGrid = PostGrid({db: 'postgrid', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await pGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('complete without error', async function () {
    await pGrid.getFile({filename: '/pictures/enterprise.jpg'})
  })
})

describe('readFile()', function () {
  let pGrid

  before(async function () {
    pGrid = PostGrid({db: 'postgrid', username: 'test', password: 'test'})
    await pGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await pGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('complete without error', async function () {
    await pGrid.readFile({filename: '/pictures/enterprise.jpg'})
  })
})
