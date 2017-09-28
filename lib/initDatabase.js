const Sequelize = require('sequelize')

module.exports = function (connOpts) {
  let sql = new Sequelize(connOpts.db, connOpts.username, connOpts.password, {
    host: connOpts.host,
    dialect: 'postgres',
    logging: false
  })

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

  return {
    sql,
    files,
    chunks
  }
}
