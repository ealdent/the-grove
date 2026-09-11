import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../benchmark.js', import.meta.url), 'utf8');

function harness() {
    let environmentReads = 0, report;
    const host = { screen: { width: 1728, height: 1117, availWidth: 1728, availHeight: 1079 }, screenX: 0, screenY: 38 };
    const context = vm.createContext({
        window: host, frame: { src: 'http://localhost/index.html?benchmark=1', contentWindow: { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 2 } },
        innerWidth: 1728, innerHeight: 1000, navigator: { userAgent: 'test' },
        debug: { renderer: { domElement: { width: 1920, height: 1080, getBoundingClientRect: () => ({ width: 1920, height: 1080 }) },
            getContext: () => { environmentReads++; return null; }, getPixelRatio: () => 1 } },
        finite: value => Number.isFinite(value) && value >= 0 ? value : null, round: value => value,
        performance: { now: () => 2000 }, operation: null, WARMUP_MS: 5000, ROUTE_VERSION: 'aisle-inspection-v1',
        restoreControls() {}, diagnostic() {}, diagnosticReport: () => ({}), paintResult() {}, setButtons() {},
        writeReport: value => { report = value; }
    });
    for (const name of ['displayEnvironment', 'recordDisplayChange', 'environment', 'distribution', 'worstRollingFPS', 'finish']) {
        const fn = source.match(new RegExp(`^  function ${name}\\([^]*?^  }`, 'm'))?.[0];
        assert.ok(fn, `${name} exists`);
        vm.runInContext(fn, context);
    }
    context.run = { environmentStart: context.environment(), viewportChanges: [], elapsedMs: 1000, phase: 'sampling',
        controller: { abort() {} }, hiddenAt: null, interruptions: [], config: { restore: false, thresholdMs: 16.67, durationMs: 1000 },
        samples: [{ frameMs: 16, segment: 0, segmentMs: 1000, cpuMs: 3, gpuMs: 4, calls: 20, triangles: 100, pixelRatio: 1 }], wallStart: 0 };
    return { context, host, reads: () => environmentReads, report: () => report };
}

test('display polling ignores unchanged state and records movement even when resolution/DPR stay equal', () => {
    const h = harness(), r = h.context.run;
    assert.deepEqual(JSON.parse(JSON.stringify(r.environmentStart.screenCSS)), h.host.screen);
    for (let i = 0; i < 4; i++) h.context.recordDisplayChange(r);
    assert.equal(r.viewportChanges.length, 0);
    assert.equal(h.reads(), 1, 'unchanged polls do not query the renderer');
    h.host.screenX = -1728;
    h.context.recordDisplayChange(r);
    assert.equal(r.viewportChanges.length, 1);
    assert.equal(r.viewportChanges[0].environment.hostWindowCSS.x, -1728, 'negative monitor coordinates survive');
    h.context.recordDisplayChange(r);
    assert.equal(r.viewportChanges.length, 1, 'stationary polls do not duplicate events');
    h.host.screenX = 0;
    h.context.recordDisplayChange(r);
    assert.equal(r.viewportChanges.length, 2, 'moving back does not erase the interruption');
    h.host.screen.availHeight -= 30;
    h.context.recordDisplayChange(r);
    assert.equal(r.viewportChanges.length, 3, 'available screen dimensions are monitored');
});

test('the final environment check invalidates display changes after the last poll, but preserves unchanged runs', () => {
    for (const changed of [false, true]) {
        const h = harness();
        h.context.recordDisplayChange(h.context.run);
        if (changed) {
            Object.assign(h.host.screen, { width: 1920, height: 1080, availWidth: 1920, availHeight: 1042 });
            h.host.screenX = 1728;
        }
        h.context.finish('completed');
        const report = h.report();
        assert.equal(report.threshold.comparableRun, !changed);
        assert.equal(report.environment.changes.length, changed ? 1 : 0);
        assert.equal(report.environment.end.screenCSS.width, changed ? 1920 : 1728);
        assert.equal(report.environment.end.hostWindowCSS.x, changed ? 1728 : 0);
    }
});
