import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { warmRenderer } from '../warm-renderer.js';

function fixture() {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(), unculled = new THREE.Mesh();
    unculled.frustumCulled = false;
    const hidden = new THREE.Group(), source = new THREE.Mesh();
    hidden.visible = false;
    hidden.add(source);
    const hiddenLeaf = new THREE.Mesh(), points = new THREE.Points();
    hiddenLeaf.visible = false;
    scene.add(mesh, unculled, hidden, hiddenLeaf, points);
    const calls = [], frames = [], fence = {};
    const gl = {
        SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3,
        TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5, lost: false, next: 4,
        isContextLost() { return this.lost; },
        fenceSync(condition, flags) {
            assert.equal(condition, this.SYNC_GPU_COMMANDS_COMPLETE);
            assert.equal(flags, 0);
            assert.equal(mesh.frustumCulled, true, 'restore before fence/await');
            calls.push('fence'); return fence;
        },
        flush() { calls.push('flush'); },
        clientWaitSync(sync, flags, timeout) {
            assert.equal(sync, fence); assert.equal(flags, 0); assert.equal(timeout, 0);
            calls.push('poll'); return this.next;
        },
        deleteSync(sync) { assert.equal(sync, fence); calls.push('delete'); }
    };
    const render = () => {
        calls.push('render');
        assert.equal(mesh.frustumCulled, false);
        assert.equal(unculled.frustumCulled, false);
        assert.equal(source.frustumCulled, true, 'hidden source ancestry respected');
        assert.equal(hiddenLeaf.frustumCulled, true);
        assert.equal(points.frustumCulled, true);
    };
    return { scene, mesh, unculled, gl, calls, frames, render,
        renderer: { getContext: () => gl }, requestFrame: callback => frames.push(callback) };
}

test('one visible-mesh warm render restores flags, polls without blocking, and deletes its fence', async () => {
    for (const signal of [2, 3]) {
        const f = fixture();
        const pending = warmRenderer(f.renderer, f.scene, f.render, f.requestFrame);
        assert.deepEqual(f.calls, ['render', 'fence', 'flush']);
        assert.equal(f.mesh.frustumCulled, true);
        assert.equal(f.unculled.frustumCulled, false);
        f.frames.shift()(); // timeout is pending, not success
        assert.equal(f.frames.length, 1);
        assert.ok(!f.calls.includes('delete'));
        f.gl.next = signal;
        f.frames.shift()();
        const result = await pending;
        assert.equal(result.status, 'complete');
        assert.equal(result.rendered, true);
        assert.deepEqual(f.calls, ['render', 'fence', 'flush', 'poll', 'poll', 'delete']);
    }
});

test('unsupported/lost/failed contexts never report completion; render and API exceptions clean up', async () => {
    for (const mode of ['unsupported', 'lost-before', 'lost-after', 'lost-poll', 'no-fence', 'wait-failed', 'render-throws', 'poll-throws', 'schedule-throws', 'flush-throws']) {
        const f = fixture();
        let render = f.render, requestFrame = f.requestFrame;
        const error = new Error(mode);
        if (mode === 'unsupported') delete f.gl.fenceSync;
        if (mode === 'lost-before') f.gl.lost = true;
        if (mode === 'lost-after') render = () => { f.render(); f.gl.lost = true; };
        if (mode === 'no-fence') f.gl.fenceSync = () => null;
        if (mode === 'wait-failed') f.gl.next = f.gl.WAIT_FAILED;
        if (mode === 'render-throws') render = () => { f.render(); throw error; };
        if (mode === 'poll-throws') f.gl.clientWaitSync = () => { throw error; };
        if (mode === 'schedule-throws') requestFrame = () => { throw error; };
        if (mode === 'flush-throws') f.gl.flush = () => { throw error; };
        const pending = warmRenderer(f.renderer, f.scene, render, requestFrame);
        if (mode === 'lost-poll') f.gl.lost = true;
        f.frames.shift()?.();
        if (mode.endsWith('throws')) await assert.rejects(pending, error);
        else {
            const result = await pending;
            assert.equal(result.status, mode.startsWith('lost-') ? 'context-lost' : mode === 'no-fence' ? 'fence-unavailable' : mode);
            assert.equal(result.rendered, mode !== 'lost-before');
        }
        assert.equal(f.mesh.frustumCulled, true);
        assert.equal(f.unculled.frustumCulled, false);
        assert.equal(f.calls.filter(c => c === 'delete').length, f.calls.includes('fence') ? 1 : 0);
    }
});

test('deadline settles even without animation frames; late callbacks cannot use the deleted fence', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture();
    const pending = warmRenderer(f.renderer, f.scene, f.render, f.requestFrame);
    t.mock.timers.tick(30001);
    assert.equal((await pending).status, 'timeout');
    assert.deepEqual(f.calls, ['render', 'fence', 'flush', 'delete']);
    f.frames.shift()();
    assert.deepEqual(f.calls, ['render', 'fence', 'flush', 'delete']);
    assert.equal(f.mesh.frustumCulled, true);
});
