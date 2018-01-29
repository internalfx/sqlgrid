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
    length: {
      type: Sequelize.BIGINT
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

  let pointers = sql.define(`pointers`, {
    id: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    num: {
      type: Sequelize.BIGINT
    },
    file_id: {
      type: Sequelize.BIGINT
    },
    chunk_id: {
      type: Sequelize.BIGINT
    }
  }, {
    tableName: `${conf.bucketName}_pointers`,
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['file_id', 'num']
      },
      {
        fields: ['chunk_id']
      }
    ]
  })

  let chunks = sql.define(`chunks`, {
    id: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    sha256: {
      type: Sequelize.TEXT
    },
    data: {
      type: Sequelize.BLOB
    }
  }, {
    tableName: `${conf.bucketName}_chunks`,
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['sha256']
      }
    ]
  })

  files.belongsToMany(chunks, { as: 'Chunks', through: pointers, foreignKey: 'file_id' })
  chunks.belongsToMany(files, { as: 'Workers', through: pointers, foreignKey: 'chunk_id' })

  return {
    sql,
    files,
    pointers,
    chunks
  }
}
