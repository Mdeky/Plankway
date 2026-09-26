-- Furthest endless level for the leaderboard: the unbroken run of levels from level 1,
-- and when that run was reached (tie-break: whoever got there first). Kept up to date by
-- the API whenever endless results are added.
ALTER TABLE profiles ADD COLUMN endless_run INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN endless_run_at INTEGER;

-- Only verified times without hints count for the time leaderboards.
CREATE INDEX results_board ON results (puzzle_number, time_ms, solved_at) WHERE verified = 1 AND hints = 0;
CREATE INDEX endless_board ON endless_results (level, time_ms, solved_at) WHERE verified = 1 AND hints = 0;
CREATE INDEX profiles_run ON profiles (endless_run DESC, endless_run_at) WHERE display_name IS NOT NULL AND endless_run > 0;

-- Backfill the runs from the results that already exist.
WITH RECURSIVE run(profile_id, level, solved_at) AS (
  SELECT profile_id, level, solved_at FROM endless_results WHERE level = 1
  UNION ALL
  SELECT e.profile_id, e.level, e.solved_at
  FROM endless_results e JOIN run ON e.profile_id = run.profile_id AND e.level = run.level + 1
)
UPDATE profiles SET
  endless_run = COALESCE((SELECT MAX(level) FROM run WHERE run.profile_id = profiles.id), 0),
  endless_run_at = (SELECT MAX(solved_at) FROM run WHERE run.profile_id = profiles.id);
