const SQL = require('sequelize')

module.exports = function (sequelizeOpts, conf) {
  let isInstance = typeof sequelizeOpts.define === 'function'
  let sql

  if (isInstance) {
    sql = sequelizeOpts
  } else {
    sql = new SQL(sequelizeOpts)
  }

  let files = sql.define(`${conf.bucketName}_files`, {
    id: {
      type: SQL.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: SQL.TEXT
    },
    sha256: {
      type: SQL.TEXT
    },
    size: {
      type: SQL.BIGINT,
      get: function (key) {
        return parseInt(this.getDataValue(key), 10)
      }
    },
    finished_at: {
      type: SQL.DATE
    },
    status: {
      type: SQL.TEXT
    }
  }, {
    tableName: `${conf.bucketName}_files`,
    timestamps: false,
    indexes: [
      {
        fields: ['status', 'filename', 'finished_at']
      }
    ],
    underscored: true,
    underscoredAll: true
  })

  let pointers = sql.define(`${conf.bucketName}_pointers`, {
    id: {
      type: SQL.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    num: {
      type: SQL.BIGINT
    },
    file_id: {
      type: SQL.BIGINT
    },
    chunk_id: {
      type: SQL.BIGINT
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
    ],
    underscored: true,
    underscoredAll: true
  })

  let chunks = sql.define(`${conf.bucketName}_chunks`, {
    id: {
      type: SQL.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    sha256: {
      type: SQL.TEXT
    },
    data: {
      type: SQL.BLOB
    }
  }, {
    tableName: `${conf.bucketName}_chunks`,
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['sha256']
      }
    ],
    underscored: true,
    underscoredAll: true
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
