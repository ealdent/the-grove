import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from 'three';
import { FrameProfiler } from '../frame-profiler.js';
import { PlantBatches } from '../plant-batches.js';
import { attenuateWoodlandRadiance } from '../forest-atmosphere.js';

// Run the actual app helpers without starting its DOM, audio or WebGL renderer.
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function appFunction(name) {
    const match = app.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `Missing app helper: ${name}`);
    return match[0];
}

test('forest lighting HDR accepts a 48-second download and retains bounded failure cleanup', async () => {
    function fixture() {
        let callback, timeout, deadline, now = 0, sunUpdates = 0;
        const context = vm.createContext({
            URL, THREE, attenuateWoodlandRadiance,
            setTimeout(fn, ms) { timeout = fn; deadline = now + ms; return 1; },
            clearTimeout() { timeout = null; },
            RGBELoader: class { load(url, loaded) { callback = loaded; } },
            pmremGen: { fromEquirectangular: () => ({ texture: {} }) },
            scene: { getObjectByName: () => null },
            updateSunAndLighting() { sunUpdates++; },
        });
        vm.runInContext('let woodlandEnvRT;\n'
            + appFunction('loadWoodlandEnvironment').replace('import.meta.url', '"https://example.test/app.js"'), context);
        return {
            load: () => context.loadWoodlandEnvironment(),
            advance(ms) { now += ms; if (timeout && now >= deadline) timeout(); },
            deliver(texture) { callback(texture); },
            updates: () => sunUpdates,
        };
    }
    const slow = fixture(), successful = slow.load();
    slow.advance(48000);
    const texture = { disposed: false, dispose() { this.disposed = true; } };
    slow.deliver(texture);
    assert.equal((await successful).failed.length, 0, '5 Mbps downloads must not be discarded at 30 seconds');
    assert.equal(texture.disposed, true, 'lighting-only source is released after PMREM');
    assert.equal(slow.updates(), 1);

    const stalled = fixture(), failed = stalled.load();
    stalled.advance(120001);
    assert.equal((await failed).failed.length, 1);
    const late = { disposed: false, dispose() { this.disposed = true; } };
    stalled.deliver(late);
    assert.equal(late.disposed, true);
    assert.equal(stalled.updates(), 0);
});

for (const ready of [false, true]) {
    test(`disjoint discards all ${ready ? 'ready' : 'unavailable'} queries and recovers with a fresh sample`, () => {
        const ext = { GPU_DISJOINT_EXT: 1, TIME_ELAPSED_EXT: 2 };
        let disjoint = false, active = null, nextId = 0;
        const deleted = [], polled = [], results = [];
        const gl = {
            QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
            getExtension: () => ext,
            getParameter() { const value = disjoint; disjoint = false; return value; },
            createQuery: () => ({ id: nextId++, ready: false, ns: 987e6 }),
            beginQuery(target, query) { assert.equal(active, null); active = query; },
            endQuery() { assert.ok(active); active = null; },
            deleteQuery(query) { deleted.push(query); },
            getQueryParameter(query, parameter) {
                polled.push(query);
                if (parameter === this.QUERY_RESULT_AVAILABLE) return query.ready;
                results.push(query);
                return query.ns;
            }
        };
        const profiler = new FrameProfiler({ getContext: () => gl });
        for (let i = 0; i < 7; i++) { profiler.begin(); profiler.end(); }
        const invalid = profiler.pending.slice();
        assert.equal(invalid.length, 2);
        invalid.forEach(query => { query.ready = ready; });
        profiler.gpuMs = 5;
        disjoint = true;
        polled.length = 0;
        profiler.begin();
        profiler.end();
        assert.deepEqual(deleted, invalid);
        assert.deepEqual(polled, [], 'disjoint must be checked before availability');
        assert.equal(profiler.pending.length, 0);
        assert.equal(profiler.gpuMs, null);
        assert.equal(nextId, 2, 'do not start a new query during the disjoint frame');

        for (let i = 0; i < 6; i++) { profiler.begin(); profiler.end(); }
        assert.equal(profiler.gpuMs, null);
        assert.equal(profiler.pending.length, 1);
        const fresh = profiler.pending[0];
        fresh.ready = true;
        fresh.ns = 3e6;
        profiler.begin();
        profiler.end();
        assert.equal(profiler.gpuMs, 3);
        assert.deepEqual(results, [fresh], 'never publish the second invalid query');
    });
}

function lightingFixture() {
    const lampSlots = Array.from({ length: 20 }, (_, i) => ({
        pos: new THREE.Vector3(i % 2 ? 3 : -3, 2.53, -Math.floor(i / 2) * 4), flicker: i === 4
    }));
    const bulbLights = Array.from({ length: 8 }, (_, i) => {
        const light = new THREE.SpotLight();
        light.userData.slot = i;
        light.castShadow = i < 2;
        light.position.copy(lampSlots[i].pos);
        light.shadow.needsUpdate = false;
        return light;
    });
    const context = vm.createContext({
        bulbLights, lampSlots, camera: { position: new THREE.Vector3(0, 1.6, 2) }, lampState: {}
    });
    vm.runInContext('const _lampOrder = []; let lastLampAssign = 0;\n' + appFunction('assignLampLights'), context);
    return context;
}

test('interior lamp bounce follows warmup and snapped night clocks immediately', () => {
    const context = vm.createContext({
        THREE, lampState: { on: false, level: 0 }, currentDayness: 0,
        warmFill: new THREE.PointLight(), LAMP_WARMUP: 4, LAMP_COOLDOWN: 2,
        _lampColor: new THREE.Color(), _lampWarm: new THREE.Color(0xffd9a0),
        bulbLights: [], sharedAssets: {}, shaftMeshes: [], lampMotes: null, lampMoths: null,
    });
    vm.runInContext(appFunction('updateLamps'), context);
    context.updateLamps(0, 0);
    assert.equal(context.warmFill.intensity, 0);
    context.lampState.on = true;
    context.updateLamps(2000, 2);
    assert.equal(context.warmFill.intensity, 1.2);
    context.lampState.level = 1;
    context.updateLamps(2000, 0);
    assert.equal(context.warmFill.intensity, 2.4);
    context.currentDayness = 1;
    context.updateLamps(2000, 0);
    assert.equal(context.warmFill.intensity, .6);
});

test('walking assigns the nearest pair to shadow casters without duplicate slots or flag changes', () => {
    const context = lightingFixture();
    let now = 1000;
    for (const [z, expected] of [[2, [0, 1]], [-8, [4, 5]], [-20, [10, 11]], [-36, [18, 19]], [2, [0, 1]]]) {
        const previous = context.bulbLights.map(light => light.position.clone());
        context.bulbLights.forEach(light => { light.shadow.needsUpdate = false; });
        context.camera.position.z = z;
        context.assignLampLights(now);
        now += 400;
        assert.deepEqual(context.bulbLights.filter(light => light.castShadow)
            .map(light => light.userData.slot).sort((a, b) => a - b), expected);
        assert.equal(new Set(context.bulbLights.map(light => light.userData.slot)).size, 8);
        context.bulbLights.forEach((light, i) => {
            assert.equal(light.castShadow, i < 2);
            assert.equal(light.shadow.needsUpdate, light.castShadow && !light.position.equals(previous[i]));
            assert.ok(light.target.position.distanceTo(light.position.clone().add(new THREE.Vector3(0, -3, 0))) < 1e-12);
        });
        const flicker = context.bulbLights.findIndex(light => light.userData.slot === 4);
        assert.equal(context.lampState.flickerLight, flicker);
    }
});

test('swapping nearest-pair distance order retains assignments and leaves shadow maps clean', () => {
    const context = lightingFixture();
    context.camera.position.set(-.2, 1.6, -8);
    context.assignLampLights(1000);
    const slots = context.bulbLights.filter(light => light.castShadow).map(light => light.userData.slot);
    context.bulbLights.forEach(light => { light.shadow.needsUpdate = false; });
    context.camera.position.x = .2;
    context.assignLampLights(1400);
    assert.deepEqual(context.bulbLights.filter(light => light.castShadow).map(light => light.userData.slot), slots);
    assert.ok(context.bulbLights.every(light => !light.shadow.needsUpdate));
});

test('resetting the benchmark to zero invalidates the cached spotlight shadows', () => {
    const context = lightingFixture();
    Object.assign(context, {
        window: {}, benchmarkMode: true, scene: new THREE.Scene(), objects: [], todos: [], tablePositions: [],
        attentionRanked: [], attentionSweep: 0, plantBatchesDirty: true, sunLight: null, moonLight: null,
        getCurrentSimulatedTime: () => 0,
        plantBatches: { rebuild(roots) { assert.equal(roots.length, 0); }, stats: () => ({ roots: 0 }) }
    });
    const root = new THREE.Group();
    context.scene.add(root);
    context.objects.push(root);
    vm.runInContext(['disposeHierarchy', 'invalidateShadows', 'setupDebugHooks'].map(appFunction).join('\n')
        + '\nsetupDebugHooks();', context);
    context.window.greenhouseDebug.seedBenchmark(0);
    assert.equal(root.parent, null);
    assert.equal(context.plantBatchesDirty, false);
    assert.ok(context.bulbLights.filter(light => light.castShadow).every(light => light.shadow.needsUpdate));
});

test('debug cue stepping updates the instance buffer as well as the reported source rotation', t => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, .1, 100);
    const root = new THREE.Group();
    root.position.set(1, 1, -4);
    root.userData = { id: 1, positionIndex: 0 };
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.01, .02, .3, 8), new THREE.MeshStandardMaterial());
    stem.name = 'stem';
    root.add(stem);
    scene.add(root);
    const batches = new PlantBatches(scene);
    t.after(() => batches.dispose());
    batches.rebuild([root]);
    const todo = { id: 1, health: 30, mesh: root, completed: false };
    const context = vm.createContext({
        window: {}, scene, camera, attentionPool: [], attentionRanked: [{ todo }], rattleState: { id: 1 },
        performance: { now: () => 2000 }, updatePlantHint() {}, plantHint: null, plantBatches: batches,
        // Isolate the debug API's source-to-instance sync from cue generation.
        updateAttention(clock) { stem.rotation.z = clock * .0001; }, edgeProminence: () => .5
    });
    vm.runInContext(appFunction('setupDebugHooks') + '\nsetupDebugHooks();', context);
    const batch = batches.group.children[0], before = batch.instanceMatrix.array.slice();
    const rows = context.window.greenhouseDebug.advanceCues(.1, 2);
    assert.equal(context.attentionPool.length, 0);
    assert.notEqual(rows.at(-1).stemZ, 0);
    assert.notDeepEqual(batch.instanceMatrix.array, before);
    const matrix = new THREE.Matrix4();
    batch.getMatrixAt(0, matrix);
    stem.matrixWorld.elements.forEach((value, i) => assert.ok(Math.abs(value - matrix.elements[i]) < 1e-6));
});

test('material plant changes refresh cached shadows while tiny decay does not', () => {
    const root = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.005, .008, .35), new THREE.MeshStandardMaterial());
    stem.name = 'stem';
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(.16, .24), new THREE.MeshStandardMaterial());
    leaf.name = 'leaf1';
    stem.add(leaf);
    root.add(stem);
    let invalidations = 0, synced = 0;
    const context = vm.createContext({
        THREE, growth: 1,
        growthScaleFor() { return context.growth; },
        plantBatches: { sync(mesh) { assert.equal(mesh, root); synced++; } },
        invalidateShadows() { invalidations++; }
    });
    vm.runInContext(appFunction('updatePlantVisual'), context);
    const todo = { mesh: root, health: 100 };
    context.updatePlantVisual(todo);
    assert.equal(invalidations, 1);
    todo.health = 99.9;
    context.updatePlantVisual(todo);
    assert.equal(invalidations, 1, 'sub-percent decay should not rerender every shadow each second');
    todo.health = 75;
    context.updatePlantVisual(todo);
    assert.equal(invalidations, 2, 'visible wilt must invalidate shadows');
    todo.health = 100;
    context.updatePlantVisual(todo);
    assert.equal(invalidations, 3, 'watering must restore the current silhouette shadow');
    context.growth = .8;
    context.updatePlantVisual(todo);
    assert.equal(invalidations, 4, 'visible growth changes must refresh shadows');
    assert.equal(synced, 5);
});
