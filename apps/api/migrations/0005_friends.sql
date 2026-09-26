-- Friend codes: shareable, so stored as-is (they only let someone add you as a friend).
-- Created the first time a signed-in player opens their friends list.
ALTER TABLE profiles ADD COLUMN friend_code TEXT;
CREATE UNIQUE INDEX profiles_friend_code ON profiles (friend_code) WHERE friend_code IS NOT NULL;

-- Friendships are mutual and stored in both directions, so "my friends" is one lookup.
CREATE TABLE friendships (
  profile_id TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id  TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, friend_id)
);
CREATE INDEX friendships_friend ON friendships (friend_id);
