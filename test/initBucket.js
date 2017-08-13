'use strict'

/* global describe */
/* global it */

let PostGrid = require('../index')

describe('initBucket()', function () {
  it('complete without error', async function () {
    let postGrid = PostGrid({db: 'test', username: 'test', password: 'test'})
    await postGrid.initBucket({dropTables: true})
    return true
  })
})
