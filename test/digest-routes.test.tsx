import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = mkdtempSync(path.join(tmpdir(), 'rig-runs-'));

const good = (at: string, job: string, status: string, extra = {}) =>
  JSON.stringify({ at, job, status, owner: 'ops', ...extra });

beforeAll(() => {
  writeFileSync(
    path.join(runsDir, '2026-10-20.jsonl'),
    [
      good('2026-10-20T02:00:00+01:00', 'backup', 'ok'),
      good('2026-10-20T02:05:00+01:00', 'digest', 'retry', { error: 'timeout' }),
      good('2026-10-20T02:06:00+01:00', 'digest', 'ok'),
    ].join('\n') + '\n',
  );
  writeFileSync(path.join(runsDir, '2026-10-21.jsonl'), '');
  writeFileSync(
    path.join(runsDir, '2026-10-22.jsonl'),
    [
      good('2026-10-22T02:00:00+01:00', 'backup', 'ok'),
      'this is not json',
      good('2026-10-22T02:10:00+01:00', 'sync', 'fail', { error: 'auth' }),
    ].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

describe('GET /digest/:night', () => {
  it('returns 200 and the job rows for a night with rows', async () => {
    const res = await app().request('/digest/2026-10-20');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup');
    expect(html).toContain('digest');
    expect(html).not.toContain('could not be read');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-10-30');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('says nothing ran for an empty night, with status 200', async () => {
    const res = await app().request('/digest/2026-10-21');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('keeps the good rows and reports the bad line', async () => {
    const res = await app().request('/digest/2026-10-22');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('backup');
    expect(html).toContain('sync');
    expect(html).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 and the rows for a night with rows', async () => {
    const res = await app().request('/api/digest/2026-10-20');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-20');
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['backup', 'digest']);
    expect(body.badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-10-30');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for that night', night: '2026-10-30' });
  });

  it('returns an empty rows array for an empty night', async () => {
    const res = await app().request('/api/digest/2026-10-21');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-21', rows: [], badLines: 0 });
  });

  it('returns the good rows and counts the bad line', async () => {
    const res = await app().request('/api/digest/2026-10-22');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['backup', 'sync']);
    expect(body.badLines).toBe(1);
  });
});
