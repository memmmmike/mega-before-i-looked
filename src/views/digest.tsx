import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night, data }: { night: string; data: Night }) {
  if (data.kind === 'missing') {
    return (
      <>
        <h1>digest {night}</h1>
        <p class="warn">no run log for this night</p>
      </>
    );
  }
  if (data.kind === 'empty') {
    return (
      <>
        <h1>digest {night}</h1>
        <p class="mute">nothing ran</p>
      </>
    );
  }
  return (
    <>
      <h1>digest {night}</h1>
      {data.badLines > 0 ? (
        <p class="warn">
          {data.badLines} {data.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>job</th>
            <th>owner</th>
            <th>runs</th>
            <th>retries</th>
            <th>last status</th>
            <th>last error</th>
            <th>first at</th>
            <th>last at</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr class={r.retries >= 3 || r.lastStatus === 'fail' ? 'warn' : undefined}>
              <td>{r.job || dash}</td>
              <td>{r.owner || dash}</td>
              <td>{r.runs}</td>
              <td>{r.retries}</td>
              <td>{r.lastStatus || dash}</td>
              <td>{r.lastError || dash}</td>
              <td>{r.firstAt || dash}</td>
              <td>{r.lastAt || dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
