-- Daily puzzles. `data` is the serialized puzzle without its solution.
CREATE TABLE puzzles (
  number     INTEGER PRIMARY KEY,
  date       TEXT    NOT NULL UNIQUE,
  data       TEXT    NOT NULL,
  difficulty INTEGER NOT NULL
);

-- Anonymous profiles. Only hashes of the token and recovery code are stored.
CREATE TABLE profiles (
  id            TEXT    PRIMARY KEY,
  token_hash    TEXT    NOT NULL UNIQUE,
  recovery_hash TEXT    NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL
);

-- One result per profile per puzzle; the first accepted result stands.
CREATE TABLE results (
  profile_id    TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  puzzle_number INTEGER NOT NULL,
  time_ms       INTEGER NOT NULL,
  undos         INTEGER NOT NULL,
  hints         INTEGER NOT NULL,
  solved_at     INTEGER NOT NULL,
  PRIMARY KEY (profile_id, puzzle_number)
);

-- Fixed-window rate limits. `key` holds a hashed IP or a profile id, never a raw IP.
CREATE TABLE rate_limits (
  key   TEXT    PRIMARY KEY,
  win   INTEGER NOT NULL,
  count INTEGER NOT NULL
);
