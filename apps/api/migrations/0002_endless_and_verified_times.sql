-- Endless levels, the same puzzle for everyone. Pre-generated like the dailies;
-- `data` is the serialized puzzle without its solution.
CREATE TABLE endless_puzzles (
  level      INTEGER PRIMARY KEY,
  data       TEXT    NOT NULL,
  difficulty INTEGER NOT NULL
);

-- One result per profile per level; the first accepted result stands.
-- `verified` = 1 when the time is backed by a server-signed start token.
CREATE TABLE endless_results (
  profile_id TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level      INTEGER NOT NULL,
  time_ms    INTEGER NOT NULL,
  hints      INTEGER NOT NULL,
  verified   INTEGER NOT NULL DEFAULT 0,
  solved_at  INTEGER NOT NULL,
  PRIMARY KEY (profile_id, level)
);

ALTER TABLE results ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
