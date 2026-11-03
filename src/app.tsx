import { Hono } from 'hono';
import { readNight } from './digest/read.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(config.runsDir, night);
    if (result.kind === 'missing') return c.json({ error: 'no run log for that night', night }, 404);
    if (result.kind === 'empty') return c.json({ night, rows: [], badLines: 0 });
    return c.json({ night, rows: result.rows, badLines: result.badLines });
  });

  return app;
}
