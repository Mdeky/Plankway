-- One row per signed-in device. Replaces profiles.token_hash as the source of truth, so a
-- profile can be used on several devices at once (recovery and sign-in add a session
-- instead of replacing the only one). profiles.token_hash stays, but is no longer read.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  profile_id TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_profile ON sessions (profile_id);
INSERT INTO sessions (token_hash, profile_id, created_at) SELECT token_hash, id, created_at FROM profiles;

-- Sign-in accounts linked to a profile. Only a keyed hash of the provider's user id is
-- kept: no e-mail address, no name.
CREATE TABLE identities (
  provider     TEXT    NOT NULL,
  subject_hash TEXT    NOT NULL,
  profile_id   TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (provider, subject_hash)
);
CREATE INDEX identities_profile ON identities (profile_id);

-- Chosen by the player once signed in; shown on leaderboards.
ALTER TABLE profiles ADD COLUMN display_name TEXT;
ALTER TABLE profiles ADD COLUMN country TEXT;
