'use strict'

/* global describe, it, before */

let path = require('path')
let Promise = require('bluebird')
let fs = Promise.promisifyAll(require('fs'))
let SQLGrid = require('../index')
let ifxUtils = require('../lib/ifx-utils.js')

let sequelizeConf = {
  database: 'sqlgrid',
  username: 'test',
  password: 'test',
  dialect: 'postgres',
  logging: null
}

describe('initBucket()', function () {
  it('Basic usage', async function () {
    let sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
  })
})

describe('writeFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
  })

  it('Basic usage', async function () {
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
  })

  it('Handles duplicates', async function () {
    await Promise.all([
      sqlGrid.writeFile({
        filename: 'saturnV.jpg',
        buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
      }),
      sqlGrid.writeFile({
        filename: 'saturnV.jpg',
        buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
      }),
      sqlGrid.writeFile({
        filename: 'saturnV.jpg',
        buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
      })
    ])
  })
})

describe('createWriteStream()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
  })

  it('Basic usage', async function () {
    let rStream = await fs.createReadStream(path.join(__dirname, 'files', 'saturnV.jpg'))
    let wStream = sqlGrid.createWriteStream({
      filename: 'saturnV.jpg'
    })

    rStream.pipe(wStream)

    await ifxUtils.writeStreamPromise(wStream)
  })

  it('Handles large files', async function () {
    let rStream = await fs.createReadStream(path.join(__dirname, 'files', 'video.mp4'))
    let wStream = sqlGrid.createWriteStream({
      filename: 'video.mp4'
    })

    rStream.pipe(wStream)
    await ifxUtils.writeStreamPromise(wStream)
  })

  it('Handles duplicate files', async function () {
    let rStream2 = await fs.createReadStream(path.join(__dirname, 'files', 'video.mp4'))
    let rStream3 = await fs.createReadStream(path.join(__dirname, 'files', 'video.mp4'))
    let wStream2 = sqlGrid.createWriteStream({
      filename: 'video2.mp4'
    })
    let wStream3 = sqlGrid.createWriteStream({
      filename: 'video3.mp4'
    })

    rStream2.pipe(wStream2)
    rStream3.pipe(wStream3)

    await Promise.all([
      ifxUtils.writeStreamPromise(wStream2),
      ifxUtils.writeStreamPromise(wStream3)
    ])
  })
})

describe('getFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
  })

  it('Basic usage', async function () {
    await sqlGrid.getFile({filename: 'enterprise.jpg'})
  })

  it(`All revisions`, async function () {
    await sqlGrid.getFile({filename: 'enterprise.jpg', revision: 'all'})
  })
})

describe('readFile()', function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'enterprise.jpg',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
  })

  it('Basic usage', async function () {
    await sqlGrid.readFile({filename: 'enterprise.jpg'})
  })

  it(`All revisions`, async function () {
    await sqlGrid.readFile({filename: 'enterprise.jpg', revision: 'all'})
  })
})

describe('deleteFileById()', function () {
  let sqlGrid
  let file

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
    let buffer = await fs.readFileAsync(path.join(__dirname, 'files', 'enterprise.jpg'))
    file = await sqlGrid.writeFile({
      filename: '/pictures/enterprise.jpg',
      buffer: buffer
    })
  })

  it('Basic usage', async function () {
    await sqlGrid.deleteFileById({id: file.id})
  })
})

describe(`deleteFileByName()`, function () {
  let sqlGrid

  before(async function () {
    sqlGrid = SQLGrid(sequelizeConf)
    await sqlGrid.initBucket({dropTables: true})
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'saturnV.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
    await sqlGrid.writeFile({
      filename: 'testfile',
      buffer: fs.readFileSync(path.join(__dirname, 'files', 'enterprise.jpg'))
    })
  })

  it('Basic usage', async function () {
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: -1})
  })

  it('All revisions', async function () {
    await sqlGrid.deleteFileByName({filename: 'testfile', revision: 'all'})
  })
})
