'use strict'

/* global describe, it, before */

let path = require('path')
let Promise = require('bluebird')
let fs = Promise.promisifyAll(require('fs'))
let SQLGrid = require('../index')
let ifxUtils = require('../lib/ifx-utils.js')

describe('initBucket()', function () {
  it('complete without error', async function () {
    let sqlGrid = SQLGrid({db: 'SQLGrid', username: 'test', password: 'test'})
    await sqlGrid.initBucket({dropTables: true})
  })
})

describe('writeFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({db: 'SQLGrid', username: 'test', password: 'test'})
    await sqlGrid.initBucket({dropTables: true})
  })

  it('complete without error', async function () {
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await sqlGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })
})

describe('createWriteStream()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({db: 'SQLGrid', username: 'test', password: 'test'})
    await sqlGrid.initBucket({dropTables: true})
  })

  it('complete without error', async function () {
    let rStream = await fs.createReadStream(path.join(__dirname, 'files', 'enterprise.jpg'))
    let wStream = sqlGrid.createWriteStream({
      filename: '/pictures/enterprise.jpg'
    })

    rStream.pipe(wStream)

    await ifxUtils.writeStreamPromise(wStream)
  })
})

describe('getFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({db: 'SQLGrid', username: 'test', password: 'test'})
    await sqlGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await sqlGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('complete without error', async function () {
    await sqlGrid.getFile({filename: '/pictures/enterprise.jpg'})
  })
})

describe('readFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({db: 'SQLGrid', username: 'test', password: 'test'})
    await sqlGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    await sqlGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('complete without error', async function () {
    await sqlGrid.readFile({filename: '/pictures/enterprise.jpg'})
  })
})
