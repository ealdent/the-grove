import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createWoodlandGroundGeometry, getWoodlandGroundHeight } from '../realism-terrain.js';
import { createWoodlandUnderstory } from '../realism-understory.js';
import { createBotanicalLeafMaterial } from '../realism-botany.js';

// CPU only: node --test greenhouse-todo/tests/understory.test.mjs
test('height sampler agrees with the actual floor triangles and retains its dimensions', () => {
    const geometry = createWoodlandGroundGeometry();
    assert.equal(geometry.attributes.position.count, 129 * 129);
    assert.equal(geometry.index.count / 3, 32768);
    assert.equal(geometry.boundingBox.min.x, -100);
    assert.equal(geometry.boundingBox.max.x, 100);
    assert.equal(geometry.boundingBox.min.z, -100);
    assert.equal(geometry.boundingBox.max.z, 100);
    assert.equal(geometry.boundingBox.min.y, 0, 'full floor retained without a sunken skirt');
    assert.ok(geometry.boundingBox.max.y < .6, 'no distant metre-high bare ridge');
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) assert.equal(
        getWoodlandGroundHeight(position.getX(i), position.getZ(i)), position.getY(i));
    for (const x of [-7, 0, 7]) for (const z of [-43, -20, 3]) assert.equal(getWoodlandGroundHeight(x, z), 0);
    assert.ok(getWoodlandGroundHeight(24, -20) > 0);
    for (const x of [-90, 90]) for (const z of [-70, -20, 50]) {
        const height = getWoodlandGroundHeight(x, z);
        assert.ok(height >= .035 && height <= .047, 'far floor settles gently but remains present');
    }
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    for (let i = 0; i < 160; i++) {
        // Covers both banks, both cell triangles, and exact grid diagonals.
        const x = (i % 2 ? 1 : -1) * (10.03 + (i * .719) % 29.8);
        const z = -54.9 + (i * 7.313) % 69.7;
        ray.ray.origin.set(x, 10, z);
        const [hit] = ray.intersectObject(mesh);
        assert.ok(hit);
        assert.ok(Math.abs(hit.point.y - getWoodlandGroundHeight(x, z)) < 1e-10);
    }
    for (const args of [[NaN, 0], [0, Infinity], [101, 0], [0, -101]]) {
        assert.throws(() => getWoodlandGroundHeight(...args), RangeError);
    }
    geometry.dispose();
    material.dispose();
});

function fingerprint(group) {
    const hash = createHash('sha256');
    for (const mesh of group.children) {
        for (const attribute of Object.values(mesh.geometry.attributes)) hash.update(Buffer.from(
            attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
        hash.update(Buffer.from(mesh.geometry.index.array.buffer));
    }
    return hash.digest('hex');
}

function verifyClosedGeometry(geometry) {
    const p = geometry.attributes.position, index = geometry.index;
    // Weld only coincident surface seams. Thin upper/lower leaf ridges remain
    // separate; disconnected cards would have one incident face per edge.
    const keys = Array.from({ length: p.count }, (_, i) =>
        [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 1e7)).join(','));
    const edges = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ids[0]);
        b.fromBufferAttribute(p, ids[1]).sub(a);
        c.fromBufferAttribute(p, ids[2]).sub(a);
        assert.ok(b.cross(c).lengthSq() > 1e-19, 'no zero-area triangles');
        for (let j = 0; j < 3; j++) {
            const from = keys[ids[j]], to = keys[ids[(j + 1) % 3]];
            const key = from < to ? `${from}/${to}` : `${to}/${from}`;
            const edge = edges.get(key) ?? { count: 0, winding: 0 };
            edge.count++;
            edge.winding += from < to ? 1 : -1;
            edges.set(key, edge);
        }
    }
    for (const edge of edges.values()) {
        assert.equal(edge.count, 2, 'every welded edge is closed');
        assert.equal(edge.winding, 0, 'adjacent faces have consistent winding');
    }
}

test('understory is deterministic, closed, static and inside the bank/budget constraints', t => {
    const scene = new THREE.Scene();
    const a = createWoodlandUnderstory(scene), b = createWoodlandUnderstory(scene);
    t.after(() => { a.dispose(); b.dispose(); });
    assert.deepEqual(a.stats, b.stats);
    assert.equal(fingerprint(a.group), fingerprint(b.group));
    assert.equal(a.stats.drawCalls, 12);
    assert.equal(a.stats.triangles, 144600);
    assert.ok(a.stats.triangles <= 150000);
    assert.equal(a.stats.shadowDrawCalls, 0);
    assert.equal(a.stats.shrubs, 36);
    assert.equal(a.stats.ferns, 36);
    assert.equal(a.stats.litterLeaves, 840);
    assert.equal(a.stats.twigs, 108);
    assert.equal(a.stats.groundCoverPatches, 56);
    assert.equal(a.stats.groundCoverLeaves, 1344);
    let triangles = 0;
    for (const mesh of a.group.children) {
        assert.equal(mesh.isMesh, true);
        assert.equal(mesh.isPoints, undefined);
        assert.equal(mesh.isSprite, undefined);
        assert.equal(mesh.castShadow, false);
        assert.equal(mesh.matrixAutoUpdate, false);
        assert.equal(mesh.frustumCulled, true);
        assert.equal(mesh.material.transparent, false);
        assert.equal(mesh.material.alphaTest, 0);
        assert.equal(mesh.material.side, THREE.FrontSide);
        assert.equal(mesh.material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
        assert.equal(mesh.material.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey);
        assert.ok(mesh.geometry.boundingSphere.radius > 0);
        assert.equal(mesh.geometry.groups.length, 0);
        triangles += mesh.geometry.index.count / 3;
        for (const attribute of Object.values(mesh.geometry.attributes)) {
            assert.ok([...attribute.array].every(Number.isFinite), 'finite geometry attributes');
            assert.equal(attribute.usage, THREE.StaticDrawUsage);
        }
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            assert.ok(Math.abs(x) >= 10 && Math.abs(x) <= 40, 'complete silhouette clears the walls');
            if (mesh.name.includes('Shrub leaves') || mesh.name.includes('Fern blades')) {
                assert.ok(Math.abs(x) <= 25, 'original shrubs/ferns stay in the near planting belt');
            }
            assert.ok(z >= -55 && z <= 15);
            assert.ok(mesh.name.startsWith('West') ? x < 0 : x > 0);
            const gap = y - getWoodlandGroundHeight(x, z);
            if (mesh.name.includes('Curled leaf litter')) {
                assert.ok(gap >= .0014 && gap < .075, 'litter follows soil with a small curl');
            } else if (mesh.name.includes('Attached stems')) {
                assert.ok(gap >= -.025 && gap < 1.1, 'only root/twig contact can enter the soil');
            } else if (mesh.name.includes('ground cover')) {
                assert.ok(gap > .025 && gap < .22, 'connected creeping leaves stay low over their runners');
            } else assert.ok(gap > .05 && gap < 1.1, 'living foliage remains above the soil');
        }
        verifyClosedGeometry(mesh.geometry);
    }
    assert.equal(triangles, a.stats.triangles);
    for (const [x, y, z] of a.group.userData.shrubRoots) {
        assert.ok(Math.abs(y - getWoodlandGroundHeight(x, z) + .012) < 1e-10);
    }
    t.diagnostic(JSON.stringify(a.stats));
});

test('disposing/rebuilding understory preserves every shared photo texture and other material', () => {
    const external = createBotanicalLeafMaterial();
    const scene = new THREE.Scene(), unrelated = new THREE.Group();
    scene.add(unrelated);
    const built = createWoodlandUnderstory(scene);
    const maps = [external.map, external.normalMap, external.roughnessMap];
    const colors = external.color.clone();
    let textureDisposals = 0, geometryDisposals = 0, materialDisposals = 0;
    const onTextureDispose = () => textureDisposals++;
    maps.forEach(map => map.addEventListener('dispose', onTextureDispose));
    const materials = new Set();
    for (const mesh of built.group.children) {
        mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
        materials.add(mesh.material);
        if (mesh.material.map) {
            assert.equal(mesh.material.map, external.map);
            assert.equal(mesh.material.normalMap, external.normalMap);
        }
    }
    materials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));
    built.dispose();
    built.dispose();
    assert.equal(geometryDisposals, 12);
    assert.equal(materialDisposals, 3);
    assert.equal(textureDisposals, 0);
    assert.deepEqual(external.color, colors);
    assert.equal(scene.children.length, 1);
    assert.equal(scene.children[0], unrelated);
    const rebuilt = createWoodlandUnderstory(scene);
    assert.equal(rebuilt.group.children[0].material.map, external.map);
    rebuilt.dispose();
    assert.equal(textureDisposals, 0);
    maps.forEach(map => map.removeEventListener('dispose', onTextureDispose));
    external.dispose();
    assert.throws(() => createWoodlandUnderstory(null), TypeError);
});
