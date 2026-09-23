// Minimal Chrome DevTools Protocol driver: launch headless Chrome, open a page, evaluate expressions.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ port = 9341, profile, width = 1920, height = 1080, extra = [] } = {}) {
  mkdirSync(profile, { recursive: true });
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--force-device-scale-factor=1', '--no-first-run',
    '--disable-extensions', '--disable-crash-reporter', '--disable-breakpad', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...extra, 'about:blank'
  ];
  const proc = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let targets = null;
  for (let i = 0; i < 100 && !targets; i++) {
    await sleep(150);
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { }
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const waiting = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const { res, rej } = waiting.get(m.id); waiting.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const logs = [];
  proc.stderr.on('data', d => logs.push(String(d)));
  return {
    send, evaluate, logs,
    async goto(url, readyExpr, timeout = 30000) {
      await send('Page.navigate', { url });
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        await sleep(200);
        try { if (await evaluate(readyExpr)) return; } catch { }
      }
      throw new Error('page not ready: ' + url);
    },
    close() { try { ws.close(); } catch { } proc.kill('SIGKILL'); }
  };
}
export { sleep };
