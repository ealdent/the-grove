import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('forest benchmark visits all walls and canopy with continuous bounded movement', () => {
    const source = readFileSync(new URL('../benchmark.js', import.meta.url), 'utf8');
    const fn = source.match(/^  function forestRoute\(seconds\) \{[^]*?^  }/m)?.[0];
    assert.ok(fn);
    const context = vm.createContext({ smooth: t => t*t*(3-2*t), lerp: (a,b,t) => a+(b-a)*t });
    vm.runInContext(fn, context);
    const samples = Array.from({ length: 4001 }, (_, i) => context.forestRoute(i / 100));
    let peakPitch = 0;
    const walls = new Set();
    samples.forEach((p, i) => {
        assert.ok(Math.abs(p.x) <= 6.700001 && p.z >= -43.000001 && p.z <= 3.000001);
        assert.ok(Object.values(p).every(Number.isFinite));
        peakPitch = Math.max(peakPitch, p.pitch);
        if (p.x === -6.7) walls.add('west');
        if (p.x === 6.7) walls.add('east');
        if (p.z === 3) walls.add('front');
        if (p.z === -43) walls.add('back');
        if (!i) return;
        const previous = samples[i - 1];
        assert.ok(Math.hypot(p.x-previous.x, p.z-previous.z) <= .080001, 'no teleport or excess speed');
        const yawDelta = Math.atan2(Math.sin(p.yaw-previous.yaw), Math.cos(p.yaw-previous.yaw));
        assert.ok(Math.abs(yawDelta) < .045, 'turn/cycle is continuous');
        assert.ok(Math.abs(p.pitch-previous.pitch) < .012, 'canopy inspection is continuous');
    });
    assert.equal(walls.size, 4);
    assert.ok(peakPitch > 1.17);
    assert.deepEqual(samples[0], samples[2000]);
    assert.deepEqual(samples[2000], samples[4000]);
});

test('a forest benchmark cannot report success without sampling its canopy segment', () => {
    const source = readFileSync(new URL('../benchmark.js', import.meta.url), 'utf8');
    const fn = source.match(/^  function configuration\(\) \{[^]*?^  }/m)?.[0];
    const fields = { count: { value: '120', reportValidity: () => true }, route: { value: 'forest' },
        duration: { value: '15' }, mix: { value: 'mixed' }, light: { value: 'day' },
        resolution: { value: '1920x1080' }, threshold: { value: '16.67' }, restore: { checked: true } };
    const context = vm.createContext({ $: id => fields[id], SUN: { day: 'day' } });
    vm.runInContext(fn, context);
    assert.throws(() => context.configuration(), /complete forest route and canopy/);
    fields.duration.value = '30';
    assert.equal(context.configuration().durationMs, 30000);
    fields.route.value = 'aisle'; fields.duration.value = '15';
    assert.equal(context.configuration().durationMs, 15000);
});
