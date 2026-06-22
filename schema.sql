-- Naming Server metadata schema
-- Models: file -> ordered chunks -> replicas -> storage servers

-- Registered storage servers and their liveness.
CREATE TABLE IF NOT EXISTS storage_servers (
    address   TEXT PRIMARY KEY,   -- "host:port" reachable on the docker network
    alive     INTEGER NOT NULL DEFAULT 1,
    last_seen TEXT    NOT NULL     -- ISO-8601 UTC timestamp of last register/heartbeat
);

-- One row per logical file.
CREATE TABLE IF NOT EXISTS files (
    name       TEXT PRIMARY KEY,  -- client-visible file name, globally unique
    size       INTEGER NOT NULL,  -- total size in bytes
    num_chunks INTEGER NOT NULL,
    created_at TEXT    NOT NULL
);

-- Ordered chunks that make up a file.
CREATE TABLE IF NOT EXISTS chunks (
    file_name   TEXT    NOT NULL,
    chunk_index INTEGER NOT NULL,  -- 0-based order within the file
    chunk_id    TEXT    NOT NULL,  -- globally unique id used by storage servers
    PRIMARY KEY (file_name, chunk_index),
    FOREIGN KEY (file_name) REFERENCES files(name) ON DELETE CASCADE
);

-- Which storage servers hold a copy of each chunk (replication, >= 2 expected).
CREATE TABLE IF NOT EXISTS chunk_replicas (
    file_name       TEXT NOT NULL,
    chunk_id        TEXT NOT NULL,
    storage_address TEXT NOT NULL,
    PRIMARY KEY (chunk_id, storage_address),
    FOREIGN KEY (file_name) REFERENCES files(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_file    ON chunks(file_name);
CREATE INDEX IF NOT EXISTS idx_replicas_file  ON chunk_replicas(file_name);
CREATE INDEX IF NOT EXISTS idx_replicas_chunk ON chunk_replicas(chunk_id);
