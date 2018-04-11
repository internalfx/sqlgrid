# 0.4.0

Use more efficient check for pointer count.

#### New Features

- None

#### Breaking Changes

- Rename "finishedAt" column to "finished_at" to be more inline with SQL convention.

# 0.3.2

Return file size as an integer.

#### New Features

- None

#### Breaking Changes

- None

# 0.3.1

Fix read error, and potential race condition.

#### New Features

- None

#### Breaking Changes

- None

# 0.3.0

#### New Features

- None

#### Breaking Changes

- Renamed `file.length` property to `file.size`

# 0.2.1

#### New Features

- None

#### Breaking Changes

- None

# 0.2.0

#### New Features

- None

#### Breaking Changes

- Changed default bucket name to `sqlgrid`

# 0.1.0

#### New Features

- Files are deduplicated inline.
- getFile can now return all revisions.
- readFile can now return all revisions.

#### Breaking Changes

- The database format has changed to support deduplication. No further changes to the database format are planned.

# 0.0.5

#### New Features

- Add `deleteFileById` method
- Add `deleteFileByName` method

#### Breaking Changes

- None

# 0.0.4

#### New Features

- Add dependencies for supported databases.

#### Breaking Changes

- None

# 0.0.3

#### New Features

- Add proper indexes

#### Breaking Changes

- None

# 0.0.2

#### New Features

- Successful port of rethinkdb-regrid

#### Breaking Changes

- None
