import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { JobStatus } from './types.js';

// Lines logged per status for one night, retries included. Lines that do not parse count in `bad` only.
export type NightCounts = Record<JobStatus, number> & { bad: number };

export function countLines(text: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, bad: 0 };
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (e) counts[e.status] += 1;
    else counts.bad += 1;
  }
  return counts;
}

// null when the file cannot be read.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
