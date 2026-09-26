-- Time leaderboards now include results with hints: each hint adds 30 seconds.
-- The board indexes sort on that score (must match the expression in leaderboard.ts).
DROP INDEX IF EXISTS results_board;
DROP INDEX IF EXISTS endless_board;
CREATE INDEX results_board ON results (puzzle_number, (time_ms + hints * 30000), solved_at) WHERE verified = 1;
CREATE INDEX endless_board ON endless_results (level, (time_ms + hints * 30000), solved_at) WHERE verified = 1;
