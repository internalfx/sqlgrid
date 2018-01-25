const Sequelize = require('sequelize')

module.exports = function (sequelizeOpts, conf) {
  let isInstance = typeof sequelizeOpts.define === 'function'
  let sql

  if (isInstance) {
    sql = sequelizeOpts
  } else {
    sql = new Sequelize(sequelizeOpts)
  }

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
    }
  }, {
    tableName: `${conf.bucketName}_files`,
    timestamps: false,
    indexes: [
      {
        fields: ['status', 'filename', 'finishedAt']
      }
    ]
  })

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
  }, {
    tableName: `${conf.bucketName}_chunks`,
    timestamps: false,
    indexes: [
      {
        fields: ['file_id', 'num']
      }
    ]
  })

  return {
    sql,
    files,
    chunks
  }
}
