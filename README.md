# SQLGrid

[![npm version](https://img.shields.io/npm/v/sqlgrid.svg)](https://www.npmjs.com/package/sqlgrid) [![license](https://img.shields.io/npm/l/sqlgrid.svg)](https://github.com/internalfx/sqlgrid/blob/master/LICENSE)

SQLGrid is a method of storing large files inside a SQL database.

### Features

- **Easy** - Read and write files as if they were on disk with developer friendly APIs.
- **Byte-range Capable** - Supports byte ranges to allow for streaming media.
- **Consistent** - Sha256 hashes are calculated when the file is written, and verified when read back out.
- **Fast** - Supports in-memory caching so your database server doesn't fall over when something goes viral.

View the [Changelog](https://github.com/internalfx/sqlgrid/blob/master/CHANGELOG.md)

#### Need help?

---

Special thanks to [Arthur Andrew Medical](http://www.arthurandrew.com/) for sponsoring this project.

Arthur Andrew Medical manufactures products with ingredients that have extensive clinical research for safety and efficacy. We specialize in Enzymes, Probiotics and Antioxidants.

---

## Installation

Supports node v7.6+

```
npm install --save sqlgrid
```

## TL;DR

```javascript
var SQLGrid = require('sqlgrid')

var bucket = SQLGrid({database, username, password})

// initBucket creates tables and indexes if they don't exist, returns a promise.
bucket.initBucket().then(function () {
  // We are now ready to read and write files
})
```

## API Documentation

### `SQLGrid([connectionOptions, bucketOptions])`

##### Parameters

| key | default | type | description |
| --- | --- | --- | --- |
| connectionOptions | {}| Object | `connectionOptions` is passed directly to a [sequleize constructor](http://docs.sequelizejs.com/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor). If `connectionOptions` is an instance of sequleize it will be used directly. |
| bucketOptions | {} | Object |  Optional parameters listed below |

###### Options

| key | default | type | description |
|---|---|---|---|
| bucketName | `fs` | String | The name of the bucket. Table names are prefixed by this. |
| chunkSizeBytes | `1024 * 1024` | Number | The default chunk size, in bytes. |
| concurrency | `10` | Number | When writing/reading a file, the number of concurrent queries in flight for a given stream. |
| cacheSize | `1000` | Number | The maximum number of objects to keep in memory. Setting to `0` will disable caching. |

##### returns

`Bucket instance`

##### Description

Creates a new SQLGrid bucket instance.

##### Example

```javascript
var SQLGrid = require('sqlgrid')

var bucket = SQLGrid({database: 'mydatabase'}, {bucketName: 'mybucket'})
```

---

### `initBucket()`

##### Parameters

none

##### returns

Promise

##### Description

Verifies required tables and indexes exist and will create them if missing.

##### Example

```javascript
bucket.initBucket().then(function () {
  // bucket is ready for use.....
})
```

---

### `writeFile(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| filename | *required* | String | The name of the file. |
| buffer | *required* | Buffer | A buffer of file contents. |
| chunkSizeBytes | The `chunkSizeBytes` setting for the bucket. | Number | Size of each chunk in bytes. |

##### returns

Promise

##### Description

Returns a promise that resolves to the newly written file.

##### Example

```javascript
let fileBuffer = fs.readFileSync('./myVid.mp4')

let newFile = await bucket.writeFile({filename: '/videos/myVid.mp4', buffer: fileBuffer})
```

---

### `createWriteStream(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| filename | *required* | String | The name of the file. |
| chunkSizeBytes | The `chunkSizeBytes` setting for the bucket. | Number | Size of each chunk in bytes. |

##### returns

WriteStream

##### Description

Returns a write stream for storing a file in SQLGrid.

##### Example

```javascript
var writeStream = bucket.createWriteStream({
  filename: '/videos/myVid.mp4',
  chunkSizeBytes: 1024 * 255
})

writeStream.on('finish', function () {
  // File is now stored in SQLGrid
})

fs.createReadStream('./myVid.mp4').pipe(writeStream)
```

---

### `getFile(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | Null | String | The `id` of the file to retrieve. |
| filename | Null | String | Ignored if `id != null`. The `filename` of the file to retrieve |
| revision | `-1` | Number | Ignored if `id != null`. The revision of the file to retrieve. If multiple files are uploaded under the same `filename` they are considered revisions. This may be a positive or negative number. (see chart below) |

###### How revision numbers work

If there are five versions of a file, the below chart would be the revision numbers

| Number | Description |
| --- | --- |
| `0` or `-5` | The original file |
| `1` or `-4` | The first revision |
| `2` or `-3` | The second revision |
| `3` or `-2` | The second most recent revision |
| `4` or `-1` | The most recent revision |

##### Description

Returns a promise that resolves to the files information.

##### Example

```javascript
let file1 = bucket.getFile({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})
let file2 = bucket.getFile({filename: 'catVideo.mp4', revision: 2})
```

---

### `readFile(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | Null | String | The `id` of the file to retrieve. |
| filename | Null | String | Ignored if `id != null`. The `filename` of the file to retrieve |
| revision | `-1` | Number | Ignored if `id != null`. The revision of the file to retrieve. If multiple files are uploaded under the same `filename` they are considered revisions. This may be a positive or negative number. (see chart below) |
| seekStart | Null | Number | The start of the byte range. |
| seekEnd | Null | Number | The end of the byte range. If omitted the stream will continue to the end of file. |

###### How revision numbers work

If there are five versions of a file, the below chart would be the revision numbers

| Number | Description |
| --- | --- |
| `0` or `-5` | The original file |
| `1` or `-4` | The first revision |
| `2` or `-3` | The second revision |
| `3` or `-2` | The second most recent revision |
| `4` or `-1` | The most recent revision |

##### Description

Returns a promise that resolves to the files information and contents.

##### Example

```javascript
let file1 = bucket.readFile({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})
let file2 = bucket.readFile({filename: 'catVideo.mp4', revision: 2})
```

---

### `createReadStream(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | *required* | String | The `id` of the file to retrieve |
| seekStart | Null | Number | The start of the byte range. |
| seekEnd | Null | Number | The end of the byte range. If omitted the stream will continue to the end of file. |

##### returns

ReadStream

##### Description

Returns a read stream for reading a file from SQLGrid.

##### Example

```javascript
var readStream = bucket.createReadStream({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})

readStream.pipe(fs.createWriteStream('./mySavedVideo.mp4'))
```

---

# Thanks

Videos used in tests acquired from [Pexels](https://videos.pexels.com/)
