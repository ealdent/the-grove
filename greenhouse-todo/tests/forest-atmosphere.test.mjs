import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { attenuateWoodlandRadiance, createForestAtmosphere, fitForestShadow } from '../forest-atmosphere.js';

for (const type of [THREE.HalfFloatType, THREE.FloatType]) {
    test(`forest indirect-light attenuation preserves alpha and scales linear radiance (${type})`, () => {
        const half = type === THREE.HalfFloatType;
        const values = [2, .25, 12, 1, 0, 1, .125, .5];
        const data = half ? new Uint16Array(values.map(THREE.DataUtils.toHalfFloat)) : new Float32Array(values);
        const texture = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat, type);
        attenuateWoodlandRadiance(texture, .5);
        for (let i = 0; i < data.length; i++) {
            const actual = half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i];
            assert.equal(actual, values[i] * (i % 4 === 3 ? 1 : .5));
        }
        assert.ok(texture.version > 0);
        texture.dispose();
    });
}

test('sky follows fog/day clock without landscape imagery or depth occlusion', () => {
    const sky = createForestAtmosphere();
    const horizon = new THREE.Color(0x070d12), sun = new THREE.Vector3(1, 0, 0);
    sky.update(horizon, 0, 1, sun);
    assert.deepEqual(sky.mesh.material.uniforms.horizon.value, horizon);
    assert.deepEqual(sky.mesh.material.uniforms.sunlight.value, sun);
    assert.equal(sky.mesh.material.uniforms.daylight.value, 0);
    assert.equal(sky.mesh.material.depthWrite, false);
    assert.equal(sky.mesh.frustumCulled, false);
    assert.equal(sky.mesh.material.map, undefined);
    let disposed = 0;
    sky.mesh.geometry.addEventListener('dispose', () => disposed++);
    sky.mesh.material.addEventListener('dispose', () => disposed++);
    const scene = new THREE.Scene();
    scene.add(sky.mesh);
    sky.dispose();
    assert.equal(disposed, 2);
    assert.equal(scene.children.length, 0);
});


test('directional shadows cover the greenhouse and near canopy at every sun azimuth', () => {
    const light = new THREE.DirectionalLight();
    for (let azimuth = 0; azimuth < Math.PI * 2; azimuth += Math.PI / 4) {
        for (const elevation of [.025, .35, 1.56]) {
            const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation),
                Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
            fitForestShadow(light, direction);
            const camera = light.shadow.camera;
            for (const x of [-30, 30]) for (const y of [-1, 36]) for (const z of [-65, 25]) {
                const clip = new THREE.Vector3(x, y, z).project(camera);
                assert.ok([clip.x, clip.y, clip.z].every(v => Math.abs(v) <= 1),
                    `clipped receiver/canopy ${x},${y},${z} at ${azimuth}/${elevation}`);
            }
        }
    }
});
