'use strict'

/* global describe, it, before */

let path = require('path')
let Promise = require('bluebird')
let fs = Promise.promisifyAll(require('fs'))
let SQLGrid = require('../index')
let ifxUtils = require('../lib/ifx-utils.js')

describe('initBucket()', function () {
  it('complete without error', async function () {
    let sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
    await sqlGrid.initBucket({dropTables: true})
  })
})

describe('writeFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
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
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
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
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
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
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
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

describe('deleteFileById()', function () {
  let sqlGrid
  let file

  before(async function () {
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
    await sqlGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    file = await sqlGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('complete without error', async function () {
    await sqlGrid.deleteFileById({id: file.id})
  })
})

describe(`deleteFileByName({revision: 'all'})`, function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'lipsum.txt'))
    })
  })

  it('complete without error', async function () {
    await sqlGrid.deleteFileByName({filename: 'testfile'})
  })
})

describe('deleteFileByName({revision: -1})', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'lipsum.txt'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'empty.txt'))
    })
  })

  it('complete without error', async function () {
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: -1})
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: -1})
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: -1})
  })
})

describe('deleteFileByName({revision: 0})', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid({dialect: 'sqlite', storage: './database.sqlite', logging: null})
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'lipsum.txt'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'empty.txt'))
    })
  })

  it('complete without error', async function () {
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: 0})
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: 0})
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: 0})
  })
})
