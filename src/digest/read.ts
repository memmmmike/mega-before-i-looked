import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, ReadNight } from './types.js';

export type Entry = { at: string; t: number; job: string; status: JobStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// An explicit offset is required: it is what the digest shows (styleguide).
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const isStatus = (s: unknown): s is JobStatus => s === 'ok' || s === 'retry' || s === 'fail';

// The edge: one log line in, an Entry or null out. A missing owner or error is null.
export function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { at, job, status, owner = null, error = null } = v as Record<string, unknown>;
  if (typeof at !== 'string' || !AT.test(at)) return null;
  const t = Date.parse(at);
  if (Number.isNaN(t) || typeof job !== 'string' || job === '' || !isStatus(status)) return null;
  if ((owner !== null && typeof owner !== 'string') || (error !== null && typeof error !== 'string')) return null;
  return { at, t, job, status, owner, error };
}

function fold(entries: Entry[]): DigestRow[] {
  const byJob = new Map<string, DigestRow>();
  // Stable sort: lines logged at the same instant keep their file order.
  for (const e of entries.sort((a, b) => a.t - b.t)) {
    const row = byJob.get(e.job) ?? {
      job: e.job, owner: null, runs: 0, retries: 0, lastStatus: e.status, lastError: null, firstAt: e.at, lastAt: e.at,
    };
    row.owner = e.owner;
    row.runs += 1;
    if (e.status === 'retry') row.retries += 1;
    row.lastStatus = e.status;
    row.lastError = e.error ?? row.lastError;
    row.lastAt = e.at;
    byJob.set(e.job, row);
  }
  return [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : 1));
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return { kind: 'missing' };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
    throw err;
  }
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { kind: 'empty' };
  const entries = lines.map(parseLine).filter((e) => e !== null);
  return { kind: 'rows', rows: fold(entries), badLines: lines.length - entries.length };
};
