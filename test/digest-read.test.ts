import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function night(name: string, lines: string[]): string {
  writeFileSync(join(tmp, `${name}.jsonl`), lines.join('\n'));
  return name;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs sorted by job, 1 bad line', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      kind: 'rows',
      badLines: 1,
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
      ],
    });
  });

  it('no file is missing', () => {
    expect(readNight(tmp, '2026-01-01')).toEqual({ kind: 'missing' });
  });

  it('a night that is not YYYY-MM-DD is missing, never a path', () => {
    expect(readNight(tmp, '../runs/2026-10-28')).toEqual({ kind: 'missing' });
  });

  it('an empty file is empty', () => {
    expect(readNight(tmp, night('2026-01-02', []))).toEqual({ kind: 'empty' });
    expect(readNight(tmp, night('2026-01-03', ['', '  ', '']))).toEqual({ kind: 'empty' });
  });

  it('counts every line that does not parse into an entry, and keeps the rest', () => {
    const ok = '{"at":"2026-01-04T23:00:00+01:00","job":"a","status":"ok","owner":"x"}';
    const result = readNight(tmp, night('2026-01-04', [
      ok,
      '{"at":"2026-01-04T23:00:00+01:00","job":"a","status":"done","owner":"x"}', // unknown status
      '{"at":"2026-01-04T23:00:00","job":"a","status":"ok","owner":"x"}', // no offset
      '{"job":"a","status":"ok","owner":"x"}', // no at
      '["not", "an", "object"]',
      '{"at":"2026-01-04T23:00:00+01:00","job":"a","st',
      '',
    ]));
    expect(result).toMatchObject({ kind: 'rows', badLines: 5, rows: [{ job: 'a', runs: 1 }] });
  });

  it('a file of only bad lines has rows, not "nothing ran"', () => {
    expect(readNight(tmp, night('2026-01-05', ['{', 'nope']))).toEqual({ kind: 'rows', rows: [], badLines: 2 });
  });

  // 22:50Z is 20 minutes after 23:30+01:00, though it comes first in the file and sorts first as text.
  it('orders by instant, not by file position or text, and keeps each offset as logged', () => {
    const result = readNight(tmp, night('2026-01-06', [
      '{"at":"2026-01-06T22:50:00Z","job":"a","status":"fail","owner":"y","error":"late"}',
      '{"at":"2026-01-06T23:30:00+01:00","job":"a","status":"retry","owner":null,"error":"early"}',
    ]));
    expect(result).toEqual({
      kind: 'rows',
      badLines: 0,
      rows: [{ job: 'a', owner: 'y', runs: 2, retries: 1, lastStatus: 'fail', lastError: 'late',
        firstAt: '2026-01-06T23:30:00+01:00', lastAt: '2026-01-06T22:50:00Z' }],
    });
  });
});
