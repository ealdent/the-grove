/*
 * Usage: serve the repo over HTTP, open greenhouse-todo/benchmark.html, then
 * Load scenario only / choose a screenshot pose, or Run benchmark. Automation
 * can read JSON.parse(document.querySelector('#report').textContent) without
 * reaching into app internals. Download JSON exports that same report.
 *
 * Contract with index.html?benchmark=1 (same origin): greenhouseDebug provides
 * seedBenchmark(count=120, mix='mixed'|'growing'|'flowers'), setSunTime(iso|null),
 * camera, renderer, controls, prepare(): Promise (textures + shader compilation),
 * texturesReady(): Promise, setExploring(boolean) (debug flag only), and optionally
 * frameMetrics(): {cpuMs,calls,triangles,gpuMs,pixelRatio}. The APP must bypass
 * persistence in benchmark mode. Never seed via user-facing forms or saved data.
 * No storage access, audio initialization, synthetic rAF, forced rendering,
 * server interception, or app.js changes belong in this harness.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const frame = $('greenhouse');
  const WARMUP_MS = 5000;
  const ROUTE_VERSION = 'aisle-inspection-v1';
  // Fixed instants at the app's NYC sun location; independent of host timezone.
  const SUN = Object.freeze({
    day: '2026-09-11T13:00:00-04:00',
    dusk: '2026-09-11T19:20:00-04:00',
    night: '2026-09-11T23:00:00-04:00'
  });
  const POSES = Object.freeze({
    entry: { x: 0, z: 2, yaw: 0, pitch: 0 },
    left: { x: -1.75, z: -12, yaw: Math.PI / 2, pitch: -0.12 },
    right: { x: 1.75, z: -24, yaw: -Math.PI / 2, pitch: -0.12 },
    reverse: { x: 0, z: -40, yaw: Math.PI, pitch: 0 },
    'forest-left': { x: -6.7, z: -16, yaw: Math.PI / 2, pitch: 0.08 },
    'forest-right': { x: 6.7, z: -26, yaw: -Math.PI / 2, pitch: 0.08 },
    'forest-front': { x: 0, z: 3.6, yaw: Math.PI, pitch: 0.08 },
    'forest-back': { x: 0, z: -43.6, yaw: 0, pitch: 0.08 },
    canopy: { x: 0, z: -20, yaw: 0.45, pitch: 1.18 }
  });
  let debug = null, hookedDocument = null, unhook = () => {}, initialView = null;
  let loaded = null, sunTime = null, pinnedPose = null, operation = null, run = null;
  let raf = 0, lastPaint = 0, intersecting = true, frameStyledVisible = true;
  let lastReport = null, diagnosticId = 0, droppedDiagnostics = 0;
  let diagnosticsDirty = false, captureStartedAt = null;
  const diagnostics = [];
  const finite = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  const fmt = (v, digits = 1) => v === null || v === undefined ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const round = v => typeof v === 'number' ? +v.toFixed(4) : v;
  const smooth = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function status(message, state = 'ready') {
    $('status').textContent = message;
    $('status').dataset.state = state;
  }

  function writeReport(value) {
    lastReport = value;
    $('report').textContent = JSON.stringify(value, null, 2);
    $('download').disabled = false;
  }

  function diagnostic(kind, message, extra = {}) {
    diagnostics.push({ id: ++diagnosticId, at: new Date().toISOString(), kind, message: String(message).slice(0, 1800), ...extra });
    if (diagnostics.length > 500) { diagnostics.shift(); droppedDiagnostics++; }
    diagnosticsDirty = true;
  }

  function safeURL(value) {
    try { const u = new URL(value, frame.src); return u.origin + u.pathname; }
    catch { return String(value || '').slice(0, 300); }
  }

  function describe(value) {
    try {
      if (value?.message) return String(value.message);
      if (typeof value === 'string') return value;
      return JSON.stringify(value) ?? String(value);
    } catch { return Object.prototype.toString.call(value); }
  }

  // Attach to each real Document, not just the iframe WindowProxy: navigation
  // replaces its listeners and console. Poll before load; load is a fallback.
  function attachDiagnostics(doc, win) {
    const cleanup = [];
    const on = (target, name, handler, capture = false) => {
      target.addEventListener(name, handler, capture);
      cleanup.push(() => target.removeEventListener(name, handler, capture));
    };
    captureStartedAt = new Date().toISOString();
    on(win, 'error', event => {
      const el = event.target;
      if (el && el !== win && el !== doc) {
        diagnostic('resource-error', 'Resource failed to load', { tag: el.tagName || null, url: safeURL(el.currentSrc || el.src || el.href) });
      } else {
        diagnostic('error', event.message || 'Unspecified iframe error', { url: safeURL(event.filename), line: event.lineno || null, column: event.colno || null });
      }
    }, true);
    on(win, 'unhandledrejection', event => diagnostic('unhandled-rejection', describe(event.reason)));
    on(doc, 'webglcontextlost', () => {
      diagnostic('webgl-context-lost', 'The WebGL context was lost.');
      if (run) finish('failed', 'WebGL context lost');
    }, true);
    on(doc, 'visibilitychange', checkVisibility);
    on(win, 'resize', () => recordViewportChange('iframe resize'));
    for (const method of ['warn', 'error']) {
      const original = win.console[method];
      const wrapper = function (...args) {
        diagnostic(`console-${method}`, args.map(describe).join(' '));
        Reflect.apply(original, win.console, args);
      };
      win.console[method] = wrapper;
      cleanup.push(() => { if (win.console[method] === wrapper) win.console[method] = original; });
    }
    try {
      const observer = new win.PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.responseStatus >= 400) diagnostic('http-error', `HTTP ${entry.responseStatus}`, {
            url: safeURL(entry.name), status: entry.responseStatus, initiatorType: entry.initiatorType
          });
        }
      });
      observer.observe({ type: 'resource', buffered: true });
      cleanup.push(() => observer.disconnect());
    } catch { /* Resource error events still work without Resource Timing L3. */ }
    return () => cleanup.forEach(fn => { try { fn(); } catch { /* navigated */ } });
  }

  function setButtons() {
    const busy = !!operation || !!run;
    for (const el of document.querySelectorAll('#load, #run, #reset-view, [data-pose], [data-light]')) el.disabled = !debug || busy;
    for (const id of ['count', 'mix', 'duration', 'route', 'light', 'resolution', 'threshold', 'restore']) $(id).disabled = busy;
    $('stop').disabled = !busy;
  }

  function inspectConnection() {
    try {
      const win = frame.contentWindow, doc = win.document;
      if (!doc || doc.URL === 'about:blank') return;
      if (doc !== hookedDocument) {
        if (run) finish('failed', 'Iframe navigated during run');
        operation?.abort();
        unhook();
        if (raf) win.cancelAnimationFrame(raf);
        raf = 0;
        hookedDocument = doc;
        debug = null; loaded = null; pinnedPose = null; initialView = null; sunTime = null;
        unhook = attachDiagnostics(doc, win);
        setButtons();
      }
      if (debug) return;
      const d = win.greenhouseDebug;
      const missing = ['seedBenchmark', 'setSunTime', 'prepare', 'setExploring'].filter(key => typeof d?.[key] !== 'function');
      for (const key of ['camera', 'renderer', 'controls']) if (!d?.[key]) missing.push(key);
      if (missing.length) {
        status(`Waiting for greenhouseDebug: ${missing.join(', ')}.`, 'connecting');
        return;
      }
      debug = d;
      initialView = captureView();
      const style = doc.createElement('style');
      style.textContent = '#blocker, #ui-container, #crosshair, #hover-tooltip, #mobile-controls, .gh-scrim, #gh-toast { display: none !important; }';
      doc.head.append(style);
      $('stage-note').hidden = true;
      status('Connected. Load a scenario for inspection, or run a benchmark.');
      writeReport({ schemaVersion: 1, status: 'ready', iframeURL: frame.src, samples: [], diagnostics: diagnosticReport() });
      paintEnvironment(environment());
      setButtons();
      if (!raf) raf = win.requestAnimationFrame(tick);
    } catch (error) {
      status(`Cannot access the iframe: ${describe(error)}. Serve both files on the same HTTP origin.`, 'failed');
    }
  }

  function captureView() {
    return {
      position: debug.camera.position.clone(), quaternion: debug.camera.quaternion.clone(),
      enabled: debug.controls.enabled, isLocked: debug.controls.isLocked,
      sun: sunTime, pinnedPose
    };
  }

  function restoreView(view) {
    debug.camera.position.copy(view.position);
    debug.camera.quaternion.copy(view.quaternion);
    debug.camera.updateMatrixWorld(true);
    restoreControls(view);
    pinnedPose = view.pinnedPose;
    debug.setSunTime(view.sun);
    sunTime = view.sun;
  }

  function pose(p) {
    debug.camera.position.set(p.x, 1.6, p.z);
    debug.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    debug.camera.updateMatrixWorld(true);
  }

  function ownControls(exploring) {
    // setExploring toggles the app's debug flag only: no pointer lock / enter /
    // audio gesture. True includes real movement and hover-raycasting CPU work.
    if ('enabled' in debug.controls) debug.controls.enabled = false;
    debug.setExploring(exploring);
  }

  function restoreControls(view) {
    if (view.enabled !== undefined) debug.controls.enabled = view.enabled;
    if (view.isLocked !== undefined) debug.setExploring(view.isLocked);
  }

  // Absolute visible-time route. No delta clamping: a slow frame really travels
  // farther. 5.25 s at 8 m/s covers z=2..-40, plus a fast smooth 180 turn.
  // Each inspection eases laterally for 0.6 s, holds 0.5 s, then returns in 0.6 s.
  function route(seconds) {
    const half = 7.5; // 5.25 travel + 0.55 turn + 1.70 inspection
    let t = seconds % (half * 2);
    const returning = t >= half;
    if (returning) t -= half;
    const heading = returning ? Math.PI : 0, firstTravel = returning ? 2 : 1.75;
    const atZ = returning ? -24 : -12;
    if (t < firstTravel) return { x: 0, z: returning ? -40 + 8 * t : 2 - 8 * t, yaw: heading, pitch: 0 };
    if (t < firstTravel + 1.7) {
      const local = t - firstTravel;
      const blend = local < 0.6 ? smooth(local / 0.6) : local < 1.1 ? 1 : 1 - smooth((local - 1.1) / 0.6);
      return { x: (returning ? 1.75 : -1.75) * blend, z: atZ,
        yaw: heading + Math.PI / 2 * blend, pitch: -0.12 * blend };
    }
    if (t < 6.95) return { x: 0, z: atZ + (returning ? 8 : -8) * (t - firstTravel - 1.7), yaw: heading, pitch: 0 };
    return { x: 0, z: returning ? 2 : -40, yaw: heading + Math.PI * smooth((t - 6.95) / 0.55), pitch: 0 };
  }

  // Strafe along all four walls at 8 m/s while looking into the closest forest.
  // Four 0.55 s turns and a roof inspection complete an exact 20 s loop.
  function forestRoute(seconds) {
    const corners = [[-6.7, 3], [-6.7, -43], [6.7, -43], [6.7, 3], [-6.7, 3]];
    let t = seconds % 20;
    for (let side = 0; side < 4; side++) {
      const a = corners[side], b = corners[side + 1];
      const travel = Math.hypot(b[0] - a[0], b[1] - a[1]) / 8;
      const yaw = Math.PI / 2 - side * Math.PI / 2;
      if (t < travel) return { x: lerp(a[0], b[0], t / travel), z: lerp(a[1], b[1], t / travel), yaw, pitch: .08 };
      t -= travel;
      if (t < .55) return { x: b[0], z: b[1], yaw: yaw - Math.PI / 2 * smooth(t / .55), pitch: .08 };
      t -= .55;
    }
    const roof = 2.95;
    return { x: -6.7, z: 3, yaw: -Math.PI * 1.5,
      pitch: .08 + 1.10 * Math.sin(Math.PI * t / roof) ** 2 };
  }

  function sampleRoute(seconds, config) {
    return config.route === 'forest' ? forestRoute(seconds) : route(seconds);
  }

  function configuration() {
    if (!$('count').reportValidity()) throw new Error('Plant count must be a whole number from 0 to 120.');
    if ($('route').value === 'forest' && Number($('duration').value) < 20) {
      throw new Error('Choose at least 30 seconds to measure the complete forest route and canopy.');
    }
    return { count: Number($('count').value), mix: $('mix').value, durationMs: Number($('duration').value) * 1000,
      route: $('route').value, light: $('light').value, sunISO: SUN[$('light').value], viewport: $('resolution').value,
      thresholdMs: Number($('threshold').value), restore: $('restore').checked };
  }

  function waitFor(promise, signal, label) {
    return new Promise((resolve, reject) => {
      const abort = () => done(reject, new DOMException('Stopped', 'AbortError'));
      const timer = setTimeout(() => done(reject, new Error(`${label} timed out after 60 seconds.`)), 60000);
      function done(fn, value) { clearTimeout(timer); signal.removeEventListener('abort', abort); fn(value); }
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) return abort();
      Promise.resolve(promise).then(value => done(resolve, value), error => done(reject, error));
    });
  }

  async function prepare(config, signal) {
    status('Loading in-memory plants; preparing textures and shaders…', 'loading');
    const seed = await waitFor(debug.seedBenchmark(config.count, config.mix), signal, 'Scenario load');
    if (seed?.error) throw new Error(describe(seed.error));
    debug.setSunTime(config.sunISO);
    sunTime = config.sunISO;
    const assets = await waitFor(debug.prepare(), signal, 'Texture and shader preparation');
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    // The app resolves expected texture failures with fallback materials. Such
    // a scene is a different workload, so report it and do not start sampling.
    if (assets?.failed?.length) {
      for (const asset of assets.failed) diagnostic('asset-failure', asset.reason || 'Texture preparation failed', { url: safeURL(asset.url) });
      throw new Error(`${assets.failed.length} texture asset(s) failed; benchmark stopped before warmup.`);
    }
    loaded = { requestedCount: config.count, actualCount: finite(seed?.count), mix: config.mix,
      persistence: seed?.persistence ?? 'Provided by app benchmark contract', batches: seed?.batches ?? null,
      loadedAssetCount: assets?.loaded?.length ?? null, gpuPreparation: assets?.warmup ?? null };
    pinnedPose = POSES.entry;
    ownControls(false);
    pose(pinnedPose);
    return loaded;
  }

  async function loadScenario() {
    if (!debug || operation || run) return;
    let config;
    try { config = configuration(); } catch (error) { status(describe(error), 'failed'); return; }
    const controller = new AbortController(), view = captureView();
    operation = controller; setButtons();
    try {
      await prepare(config, controller.signal);
      status(`Loaded ${config.count} ${config.mix} plants. Camera held for inspection; no sample running.`);
      writeReport({ schemaVersion: 1, status: 'loaded', scenario: config, environment: environment(), samples: [], diagnostics: diagnosticReport() });
      paintEnvironment(environment());
    } catch (error) {
      if (debug) restoreView(view);
      status(error.name === 'AbortError' ? 'Load stopped. No sample collected.' : describe(error), error.name === 'AbortError' ? 'stopped' : 'failed');
      if (error.name !== 'AbortError') diagnostic('load-failure', describe(error));
      writeReport({ schemaVersion: 1, status: $('status').dataset.state, reason: $('status').textContent, samples: [], diagnostics: diagnosticReport() });
    } finally { if (operation === controller) operation = null; setButtons(); }
  }

  async function start() {
    if (!debug || operation || run) return;
    let config;
    try { config = configuration(); } catch (error) { status(describe(error), 'failed'); return; }
    const controller = new AbortController();
    const r = {
      config, restore: captureView(), controller, phase: 'preparing', startedAt: new Date().toISOString(),
      wallStart: performance.now(), warmupMs: 0, totalWarmupMs: 0, elapsedMs: 0, previous: null,
      samples: [], segment: 0, segmentMs: 0, interruptions: [], hiddenAt: null, hiddenMs: 0,
      viewportChanges: [], diagnosticStart: diagnosticId, droppedStart: droppedDiagnostics,
      appMetricsFailed: false, sampleStartedAt: null, environmentStart: null
    };
    run = r; operation = controller; setButtons();
    for (const id of ['fps', 'low', 'p95', 'p99', 'worst', 'rolling', 'over16', 'over20', 'over33', 'sample-size', 'cpu-gpu', 'render-counts']) $(id).textContent = '—';
    $('verdict').textContent = 'Preparing. Results appear after the sample ends.';
    writeReport({ schemaVersion: 1, status: 'preparing', scenario: config, samples: [] });
    try {
      await prepare(config, controller.signal);
      if (run !== r) return;
      r.seed = loaded;
      ownControls(true);
      r.environmentStart = environment();
      r.phase = 'warmup'; r.previous = null;
      r.preparationMs = performance.now() - r.wallStart;
      operation = null;
      checkVisibility(); paintProgress();
    } catch (error) {
      if (run === r) {
        if (error.name !== 'AbortError') diagnostic('run-failure', describe(error));
        finish(error.name === 'AbortError' ? 'stopped' : 'failed', describe(error));
      }
    } finally { if (operation === controller) operation = null; setButtons(); }
  }

  function visible() {
    return !document.hidden && !!hookedDocument && !hookedDocument.hidden && intersecting && frameStyledVisible;
  }

  function checkVisibility() {
    if (!run || run.phase === 'preparing') return;
    const now = performance.now();
    if (!visible() && run.hiddenAt === null) {
      run.hiddenAt = now;
      run.interruptions.push({ afterSampleMs: round(run.elapsedMs), phase: run.phase, startedAt: new Date().toISOString(), hiddenMs: null });
      run.previous = null;
      status('Paused while host or iframe is hidden. Sampling is suppressed.', 'paused');
    } else if (visible() && run.hiddenAt !== null) {
      const elapsed = now - run.hiddenAt;
      run.hiddenMs += elapsed;
      run.interruptions.at(-1).hiddenMs = round(elapsed);
      run.hiddenAt = null;
      run.previous = null;
      run.warmupMs = 0;
      run.phase = 'warmup';
      run.segment++; run.segmentMs = 0;
      status('Visible again. Rewarming for 5 seconds before continuing.', 'warmup');
    }
  }

  function inspectVisibility() {
    let shown = frame.getBoundingClientRect().width > 0 && frame.getBoundingClientRect().height > 0;
    for (let el = frame; el && shown; el = el.parentElement) {
      const css = getComputedStyle(el);
      shown = !el.hidden && css.display !== 'none' && css.visibility !== 'hidden' && css.visibility !== 'collapse' && css.contentVisibility !== 'hidden' && css.opacity !== '0';
    }
    frameStyledVisible = shown;
    checkVisibility();
  }

  function frameSnapshot() {
    if (typeof debug.frameMetrics !== 'function' || run.appMetricsFailed) return {};
    try { return debug.frameMetrics() || {}; }
    catch (error) { run.appMetricsFailed = true; diagnostic('frame-metrics-error', describe(error)); return {}; }
  }

  function tick(timestamp) {
    raf = 0;
    if (!debug) return;
    try {
      checkVisibility();
      const r = run;
      if (r && r.phase !== 'preparing' && visible()) {
        const delta = r.previous === null ? 0 : timestamp - r.previous;
        r.previous = timestamp;
        if (r.phase === 'warmup') {
          r.warmupMs += delta; r.totalWarmupMs += delta;
          pose(sampleRoute(r.warmupMs * (r.config.route === 'forest' ? 4 : 3) / 1000, r.config));
          if (r.warmupMs >= WARMUP_MS) {
            r.phase = 'sampling';
            r.sampleStartedAt ||= new Date().toISOString();
            // This callback is the new sample's anchor, not a measured interval.
            pose(sampleRoute(r.elapsedMs / 1000, r.config));
          }
        } else if (delta > 0) {
          r.elapsedMs += delta; r.segmentMs += delta;
          const m = frameSnapshot();
          r.samples.push({ elapsedMs: r.elapsedMs, segment: r.segment, segmentMs: r.segmentMs, frameMs: delta,
            cpuMs: finite(m.cpuMs), calls: finite(m.calls), triangles: finite(m.triangles), gpuMs: finite(m.gpuMs), pixelRatio: finite(m.pixelRatio) });
          pinnedPose = sampleRoute(r.elapsedMs / 1000, r.config);
          pose(pinnedPose);
          if (r.elapsedMs >= r.config.durationMs) finish('completed');
        }
        if (run && timestamp - lastPaint >= 250) { lastPaint = timestamp; recordDisplayChange(run); paintProgress(); }
      } else if (!r && pinnedPose && visible()) pose(pinnedPose);
    } catch (error) {
      diagnostic('harness-error', describe(error));
      if (run) finish('failed', describe(error));
      else { pinnedPose = null; status(describe(error), 'failed'); }
    }
    if (debug) raf = frame.contentWindow.requestAnimationFrame(tick);
  }

  function paintProgress() {
    const r = run;
    if (!r) return;
    const paused = r.hiddenAt !== null;
    if (!paused) status(r.phase === 'warmup' ? `Warming up · ${fmt(r.warmupMs / 1000)} / 5.0 s` : `Sampling · ${r.samples.length} frame intervals collected`, r.phase);
    $('progress').value = r.elapsedMs / r.config.durationMs;
    $('progress-label').textContent = `${fmt(r.elapsedMs / 1000)} / ${r.config.durationMs / 1000} s`;
    // Keep the DOM-readable live report compact; serializing raw rows during
    // sampling would itself become a benchmark workload.
    writeReport({ schemaVersion: 1, status: paused ? 'paused' : r.phase, scenario: r.config,
      progress: { sampleMs: round(r.elapsedMs), warmupMs: round(r.warmupMs), sampleCount: r.samples.length, segments: r.segment + 1, exploring: debug.controls.isLocked },
      diagnosticCount: diagnosticId - r.diagnosticStart, samples: 'Available after completion or Stop' });
  }

  function distribution(values) {
    const sorted = values.filter(v => v !== null).sort((a, b) => a - b);
    if (!sorted.length) return { samples: 0, mean: null, p95: null, p99: null, worst: null };
    const rank = p => sorted[Math.ceil(sorted.length * p) - 1];
    return { samples: sorted.length, mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, p95: rank(.95), p99: rank(.99), worst: sorted.at(-1) };
  }

  function worstRollingFPS(rows) {
    let worst = Infinity, segment = -1, times = [], leftPre = 0, leftPost = 0;
    for (const row of rows) {
      if (row.segment !== segment) { segment = row.segment; times = [0]; leftPre = 0; leftPost = 0; }
      const t = row.segmentMs;
      times.push(t);
      if (t < 1000) continue;
      // Minima can occur just BEFORE a frame (especially after a long stall),
      // or at a frame. Full windows only; never bridge visibility boundaries.
      while (times[leftPre] < t - 1000) leftPre++;
      while (times[leftPost] <= t - 1000) leftPost++;
      worst = Math.min(worst, times.length - 1 - leftPre, times.length - leftPost);
    }
    return Number.isFinite(worst) ? worst : null;
  }

  function displayEnvironment() {
    const screen = window.screen;
    return { screenCSS: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight },
      hostWindowCSS: { x: window.screenX, y: window.screenY }, nativeDPR: frame.contentWindow.devicePixelRatio };
  }

  // Screen/window movement need not emit resize (including equal-DPR displays).
  // Poll only these cheap properties; query the full environment only on change.
  function recordDisplayChange(r, current = displayEnvironment()) {
    const previous = r.lastDisplay ?? r.environmentStart;
    if (!previous) return;
    const key = env => JSON.stringify([env.screenCSS, env.hostWindowCSS, env.nativeDPR]);
    if (key(previous) !== key(current)) r.viewportChanges.push({ reason: 'display or host window changed',
      afterSampleMs: round(r.elapsedMs), environment: current.viewportCSS ? current : environment() });
    r.lastDisplay = current;
  }

  function environment() {
    const renderer = debug.renderer, canvas = renderer.domElement, win = frame.contentWindow;
    const rect = canvas.getBoundingClientRect();
    let gl = null, gpu = null, vendor = null, webgl = null;
    try {
      gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      vendor = gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
      webgl = gl.getParameter(gl.VERSION);
    } catch { /* Browser may intentionally restrict GPU identification. */ }
    return { userAgent: navigator.userAgent, gpuRenderer: gpu, gpuVendor: vendor, webgl,
      viewportCSS: { width: win.innerWidth, height: win.innerHeight },
      canvasCSS: { width: rect.width, height: rect.height },
      drawingBuffer: { width: gl?.drawingBufferWidth ?? canvas.width, height: gl?.drawingBufferHeight ?? canvas.height },
      ...displayEnvironment(), renderDPR: finite(renderer.getPixelRatio?.()),
      hostViewportCSS: { width: innerWidth, height: innerHeight },
      frameMetricsAvailable: typeof debug.frameMetrics === 'function', audio: 'Not initiated by harness' };
  }

  function recordViewportChange(reason) {
    inspectVisibility();
    if (run && run.phase !== 'preparing') run.viewportChanges.push({ reason, afterSampleMs: round(run.elapsedMs), environment: environment() });
  }

  function sizePreview() {
    const [width, height] = $('resolution').value.split('x').map(Number);
    // The iframe layout viewport stays full size. Only its outer composition is
    // scaled, so a narrow QA panel never silently becomes a low-resolution test.
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${$('stage').clientWidth / width})`;
    $('viewport-label').textContent = `02 / ${width} × ${height} · scaled preview`;
  }

  function diagnosticReport(r) {
    return { captureStartedAt, capture: 'Window error/rejection, console warn/error, resource errors, available Resource Timing HTTP status. Early startup and opaque cross-origin failures may be missed.',
      observedDuringRun: r ? diagnosticId - r.diagnosticStart : null,
      dropped: droppedDiagnostics, droppedDuringRun: r ? droppedDiagnostics - r.droppedStart : null,
      events: diagnostics.slice() };
  }

  function finish(outcome, reason = null) {
    const r = run;
    if (!r) return;
    run = null; // Finish exactly once, including errors raised while restoring.
    r.controller.abort();
    if (operation === r.controller) operation = null;
    const ended = performance.now();
    if (r.hiddenAt !== null) {
      const hidden = ended - r.hiddenAt;
      r.hiddenMs += hidden;
      r.interruptions.at(-1).hiddenMs = round(hidden);
    }
    let environmentEnd = null, restoration = r.config.restore ? 'restored' : 'held last camera and sun';
    try { environmentEnd = environment(); recordDisplayChange(r, environmentEnd); }
    catch (error) { diagnostic('environment-error', describe(error)); }
    try { if (r.config.restore) restoreView(r.restore); else restoreControls(r.restore); }
    catch (error) { restoration = `failed: ${describe(error)}`; diagnostic('restore-error', describe(error)); }
    const intervals = distribution(r.samples.map(s => s.frameMs));
    const stats = { averageFPS: r.elapsedMs ? r.samples.length * 1000 / r.elapsedMs : null,
      onePercentLowFPS: intervals.p99 ? 1000 / intervals.p99 : null, frameMs: intervals,
      worstRolling1sFPS: worstRollingFPS(r.samples),
      countsAboveMs: Object.fromEntries([16.67, 20, 33.34].map(t => [t, r.samples.filter(s => s.frameMs > t).length])),
      app: Object.fromEntries(['cpuMs', 'gpuMs', 'calls', 'triangles', 'pixelRatio'].map(key => [key, distribution(r.samples.map(s => s[key]))])) };
    const comparable = outcome === 'completed' && !r.interruptions.length && !r.viewportChanges.length && !!r.samples.length;
    const threshold = { targetFPS: 60, targetFrameMs: 1000 / 60, reviewThresholdMs: r.config.thresholdMs,
      statistic: 'p99 native rAF interval', withinThreshold: intervals.p99 === null ? null : intervals.p99 <= r.config.thresholdMs,
      worstRollingSecondMeets60: stats.worstRolling1sFPS === null ? null : stats.worstRolling1sFPS >= 60,
      sustained60TargetMet: comparable && intervals.p99 !== null && intervals.p99 <= 16.67 && stats.worstRolling1sFPS >= 60,
      comparableRun: comparable, hard60FPSClaim: false };
    const report = { schemaVersion: 1, status: outcome, reason, startedAt: r.startedAt, sampleStartedAt: r.sampleStartedAt, endedAt: new Date().toISOString(),
      iframeURL: frame.src, scenario: r.config, seed: r.seed ?? null, exploringDuringSample: true,
      route: r.config.route === 'forest' ? { version: 'forest-perimeter-v1', cycleSeconds: 20, speedMetersPerSecond: 8, eyeHeightMeters: 1.6, maxAbsX: 6.7, zRange: [-43, 3], turnSeconds: .55, canopyInspectionSeconds: 2.95 } : { version: ROUTE_VERSION, cycleSeconds: 15, centerSpeedMetersPerSecond: 8, eyeHeightMeters: 1.6, maxAbsX: 1.75, zRange: [-40, 2], turnSeconds: .55, inspectionSeconds: 1.7 },
      timing: { requestedSampleMs: r.config.durationMs, observedSampleMs: r.elapsedMs, sampleCount: r.samples.length,
        requestedWarmupMs: WARMUP_MS, observedWarmupMs: r.totalWarmupMs, warmupRouteSpeedMultiplier: r.config.route === 'forest' ? 4 : 3,
        warmupRouteCoverage: r.config.route === 'forest' ? 'One full 20 s perimeter route in 5 s, including all four turns and canopy inspection' : 'One full 15 s route in 5 s, including both bench inspections and both turns', preparationMs: r.preparationMs ?? null,
        wallDurationMs: ended - r.wallStart, hiddenMs: r.hiddenMs, interruptions: r.interruptions,
        method: 'Unclamped iframe native rAF intervals; nearest-rank percentiles; full rolling 1 s windows including just-before-callback windows. No hidden gaps or unobserved tail to Stop.' },
      threshold, stats, environment: { start: r.environmentStart, end: environmentEnd, changes: r.viewportChanges }, restoration,
      limitations: ['rAF callback pacing is not GPU presentation timing.', 'Optional frameMetrics values are latest app snapshots; GPU samples may lag or be unavailable.',
        'No audio is initiated. Camera and sun are reproducible; scene animation is not frozen.', 'Storage bypass and deterministic plant seeding are provided by the app benchmark hooks.'],
      diagnostics: diagnosticReport(r), samples: r.samples };
    writeReport(report); paintResult(report); setButtons();
  }

  function paintEnvironment(env) {
    const fields = { GPU: env.gpuRenderer || 'Unavailable / browser-masked', WebGL: env.webgl || 'Unavailable',
      Viewport: `${env.viewportCSS.width} × ${env.viewportCSS.height} CSS px`,
      Buffer: `${env.drawingBuffer.width} × ${env.drawingBuffer.height} px`,
      DPR: `${fmt(env.nativeDPR, 2)} native / ${fmt(env.renderDPR, 2)} render`,
      Counters: env.frameMetricsAvailable ? 'App frameMetrics snapshots' : 'Unavailable; reported as null', Audio: env.audio };
    $('hardware').replaceChildren();
    for (const [key, value] of Object.entries(fields)) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = key; dd.textContent = value; $('hardware').append(dt, dd);
    }
  }

  function paintResult(report) {
    const s = report.stats, t = report.timing, threshold = report.threshold;
    for (const [id, value] of Object.entries({ fps: s.averageFPS, low: s.onePercentLowFPS, p95: s.frameMs.p95, p99: s.frameMs.p99, worst: s.frameMs.worst, rolling: s.worstRolling1sFPS })) $(id).textContent = fmt(value);
    for (const [id, key] of [['over16', 16.67], ['over20', 20], ['over33', 33.34]]) $(id).textContent = `${s.countsAboveMs[key]} / ${t.sampleCount}`;
    $('sample-size').textContent = `${fmt(t.observedSampleMs / 1000, 2)} s / ${t.requestedSampleMs / 1000} s / ${t.sampleCount}`;
    $('cpu-gpu').textContent = `${fmt(s.app.cpuMs.mean, 2)} / ${fmt(s.app.gpuMs.mean, 2)}`;
    $('render-counts').textContent = `${fmt(s.app.calls.mean, 0)} / ${fmt(s.app.triangles.mean, 0)}`;
    const measured = threshold.withinThreshold === null ? 'No measured intervals.' : `p99 ${threshold.withinThreshold ? 'within' : 'exceeds'} the ${threshold.reviewThresholdMs} ms review threshold.`;
    const sustained = threshold.comparableRun ? ` Sustained 60 FPS target ${threshold.sustained60TargetMet ? 'met' : 'NOT met'}: both p99 and the worst rolling second must pass.` : '';
    $('verdict').textContent = `${report.status === 'completed' ? 'Completed.' : 'Partial / ' + report.status + '.'} ${measured}${sustained}${threshold.comparableRun ? '' : ' No comparable-run verdict: incomplete, interrupted, or viewport changed.'}`;
    status(`${report.status === 'completed' ? 'Complete' : report.status} · ${t.sampleCount} intervals · ${fmt(t.observedSampleMs / 1000, 2)} s sampled.${report.reason ? ' ' + report.reason : ''}`, report.status);
    $('progress').value = Math.min(1, t.observedSampleMs / t.requestedSampleMs);
    $('progress-label').textContent = `${fmt(t.observedSampleMs / 1000)} / ${t.requestedSampleMs / 1000} s`;
    if (report.environment.end) paintEnvironment(report.environment.end);
  }

  function applyLight(name) {
    $('light').value = name;
    for (const button of document.querySelectorAll('[data-light]')) button.setAttribute('aria-pressed', String(button.dataset.light === name));
    if (!debug || run || operation) return;
    try { debug.setSunTime(SUN[name]); sunTime = SUN[name]; status(`${name === 'day' ? 'Daylight' : name} held at ${sunTime}.`); }
    catch (error) { diagnostic('lighting-error', describe(error)); status(describe(error), 'failed'); }
  }

  $('load').addEventListener('click', loadScenario);
  $('run').addEventListener('click', start);
  $('stop').addEventListener('click', () => { if (run) finish('stopped', 'Stopped by user'); else operation?.abort(); });
  $('light').addEventListener('change', () => applyLight($('light').value));
  $('resolution').addEventListener('change', sizePreview);
  for (const button of document.querySelectorAll('[data-light]')) button.addEventListener('click', () => applyLight(button.dataset.light));
  for (const button of document.querySelectorAll('[data-pose]')) button.addEventListener('click', () => {
    if (!debug || run || operation) return;
    if (sunTime === null) { debug.setSunTime(SUN[$('light').value]); sunTime = SUN[$('light').value]; }
    ownControls(false); pinnedPose = POSES[button.dataset.pose]; pose(pinnedPose);
    status(`${button.textContent} camera held at eye height 1.6 m. Scene animation continues.`);
    writeReport({ schemaVersion: 1, status: 'inspection', scenario: loaded, pose: { name: button.dataset.pose, ...pinnedPose, y: 1.6 }, sunISO: sunTime, environment: environment(), samples: [], diagnostics: diagnosticReport() });
  });
  $('route').addEventListener('change', () => {
    const forest = $('route').value === 'forest';
    $('duration').querySelector('option[value="15"]').disabled = forest;
    if (forest && $('duration').value === '15') $('duration').value = '30';
  });
  $('reset-view').addEventListener('click', () => { if (debug && !run && !operation) { restoreView(initialView); status('Initial camera restored; sun follows the wall clock.'); } });
  $('download').addEventListener('click', () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `greenhouse-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('visibilitychange', checkVisibility);
  window.addEventListener('resize', () => recordViewportChange('host resize'));
  window.addEventListener('error', event => diagnostic('host-error', event.message || 'Host resource failure'));
  window.addEventListener('unhandledrejection', event => diagnostic('host-rejection', describe(event.reason)));
  const intersection = new IntersectionObserver(entries => {
    intersecting = entries[0].isIntersecting && entries[0].intersectionRatio > 0; checkVisibility();
  });
  intersection.observe(frame);
  const previewResize = new ResizeObserver(sizePreview);
  previewResize.observe($('stage'));
  sizePreview();
  const mutation = new MutationObserver(inspectVisibility);
  for (let el = frame; el; el = el.parentElement) mutation.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  frame.addEventListener('load', inspectConnection);
  frame.addEventListener('error', () => diagnostic('iframe-load-error', 'Iframe navigation failed'));
  frame.src = new URL('index.html?benchmark=1', location.href).href;
  const connectionTimer = setInterval(inspectConnection, 50);
  const displayTimer = setInterval(() => {
    inspectVisibility();
    if (!diagnosticsDirty) return;
    diagnosticsDirty = false;
    $('error-summary').textContent = `Diagnostics · ${diagnosticId} observed events${droppedDiagnostics ? ` (${droppedDiagnostics} older events omitted)` : ''}`;
    $('errors').replaceChildren(...diagnostics.slice(-20).map(event => {
      const li = document.createElement('li'); li.textContent = `${event.kind}: ${event.message}${event.url ? ' · ' + event.url : ''}`; return li;
    }));
    if (!run && !operation && lastReport && ['ready', 'loaded', 'inspection'].includes(lastReport.status)) writeReport({ ...lastReport, diagnostics: diagnosticReport() });
  }, 500);
  window.addEventListener('pagehide', () => {
    if (run) finish('stopped', 'Benchmark page closed');
    operation?.abort(); unhook(); clearInterval(connectionTimer); clearInterval(displayTimer);
    intersection.disconnect(); mutation.disconnect(); previewResize.disconnect();
    if (raf) frame.contentWindow.cancelAnimationFrame(raf);
  }, { once: true });
})();
