// Plan morning-digest § 1. Implemented by `readNight` in ./read.ts; views and routes need only
// these types.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One job in a night's run log.
export type DigestRow = {
  job: string;
  owner: string | null; // from the job's last line; null renders as —
  runs: number; // lines logged for the job, retries included
  retries: number; // lines with status 'retry'
  lastStatus: JobStatus;
  lastError: string | null; // most recent `error` for the job, even if a later run was ok
  firstAt: string; // `at` as logged, offset kept
  lastAt: string;
};

export type Night =
  | { kind: 'missing' } // no runs/<night>.jsonl, or night is not YYYY-MM-DD: 404
  | { kind: 'empty' } // file has no lines: "nothing ran"
  | { kind: 'rows'; rows: DigestRow[]; badLines: number }; // sorted by job; [] only if every line was bad

export type ReadNight = (runsDir: string, night: string) => Night;
