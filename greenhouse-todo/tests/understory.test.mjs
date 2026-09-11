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
    assert.equal(geometry.attributes.position.count, 131 * 131);
    assert.equal(geometry.index.count / 3, 33800);
    assert.equal(geometry.boundingBox.min.x, -100);
    assert.equal(geometry.boundingBox.max.x, 100);
    assert.equal(geometry.boundingBox.min.z, -100);
    assert.equal(geometry.boundingBox.max.z, 100);
    assert.equal(geometry.boundingBox.min.y, 0, 'full floor retained');
    assert.ok(geometry.boundingBox.max.y > 2 && geometry.boundingBox.max.y < 4.5, 'rolling forest banks');
    const position = geometry.attributes.position;
    assert.deepEqual(Array.from(geometry.groups, ({ start, count, materialIndex }) => [start, count, materialIndex]),
        [[0, 2448, 0], [2448, 98952, 1]], 'two contiguous groups cover every original triangle');
    for (const group of geometry.groups) {
        for (let i = group.start; i < group.start + group.count; i += 3) {
            const ids = [0, 1, 2].map(offset => geometry.index.getX(i + offset));
            const x = ids.reduce((sum, id) => sum + position.getX(id), 0) / 3;
            const z = ids.reduce((sum, id) => sum + position.getZ(id), 0) / 3;
            const inside = Math.abs(x) < 8.5 && z > -45.5 && z < 5.5;
            assert.equal(group.materialIndex, inside ? 0 : 1, 'only foundation triangles use interior mud');
        }
    }
    for (let i = 0; i < position.count; i++) assert.equal(
        getWoodlandGroundHeight(position.getX(i), position.getZ(i)), position.getY(i));
    for (const x of [-8.5, -8.499, -8, 0, 8, 8.499, 8.5]) {
        for (const z of [-45.5, -45.499, -45, -20, 5, 5.499, 5.5]) {
            assert.equal(getWoodlandGroundHeight(x, z), 0, 'entire foundation stays level, including cell edges');
        }
    }
    const bankHeights = Array.from({ length: 30 }, (_, i) => getWoodlandGroundHeight(11.5, -45 + i * 1.6));
    assert.ok(Math.min(...bankHeights) > .35, 'banks rise close to the foundation');
    assert.ok(Math.max(...bankHeights) - Math.min(...bankHeights) > .3, 'irregular bank profile');
    for (const [x, z] of [[0, 9], [0, -49], [-12, -20], [12, -20]]) {
        assert.ok(getWoodlandGroundHeight(x, z) > .4, 'banks enclose every side');
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

function renderMeshes(group) {
    const meshes = [];
    group.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    return meshes;
}

function fingerprint(group) {
    const hash = createHash('sha256');
    for (const mesh of renderMeshes(group)) {
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

// Rasterize only projected physical triangles, not crown radii: many widely
// separated leaflets must not pass as a dense canopy just because roots overlap.
function foliageCoverage(group) {
    const step = .25, x0 = -17.5, z0 = -43, nx = 140, nz = 184;
    const covered = new Uint8Array(nx * nz);
    for (const mesh of renderMeshes(group)) {
        if (!mesh.name.includes('foliage')) continue;
        const p = mesh.geometry.attributes.position.array, indices = mesh.geometry.index.array;
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
            const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
            const denom = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
            if (Math.abs(denom) < 1e-10) continue;
            const minX = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / step - .5));
            const maxX = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / step - .5));
            const minZ = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / step - .5));
            const maxZ = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / step - .5));
            for (let iz = minZ; iz <= maxZ; iz++) for (let ix = minX; ix <= maxX; ix++) {
                if (covered[iz * nx + ix]) continue;
                const x = x0 + (ix + .5) * step, z = z0 + (iz + .5) * step;
                const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denom;
                const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denom;
                if (u >= 0 && v >= 0 && u + v <= 1) covered[iz * nx + ix] = 1;
            }
        }
    }
    const result = {};
    for (const [name, lo, hi] of [['near', 2, 4], ['belt', 1, 8]]) {
        let samples = 0, occupied = 0;
        for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
            const depth = Math.abs(x0 + (ix + .5) * step) - 8.5;
            if (depth >= lo && depth <= hi) { samples++; occupied += covered[iz * nx + ix]; }
        }
        result[name] = occupied / samples;
    }
    return result;
}

test('understory is deterministic, closed, static and inside the bank/budget constraints', t => {
    const scene = new THREE.Scene();
    const a = createWoodlandUnderstory(scene), b = createWoodlandUnderstory(scene);
    t.after(() => { a.dispose(); b.dispose(); });
    assert.deepEqual(a.stats, b.stats);
    assert.equal(fingerprint(a.group), fingerprint(b.group));
    assert.equal(a.stats.drawCalls, 24);
    assert.ok(a.stats.drawCalls < 30);
    assert.equal(a.stats.chunks, 8);
    assert.equal(a.stats.triangles, 1791808);
    assert.ok(a.stats.triangles < 1800000);
    assert.equal(a.stats.shadowDrawCalls, 0);
    assert.equal(a.stats.shrubs, 64);
    assert.equal(a.stats.brambles, 64);
    assert.equal(a.stats.ferns, 416);
    assert.equal(a.stats.fernFronds, 3328);
    assert.equal(a.stats.litterLeaves, 3776);
    assert.equal(a.stats.twigs, 192);
    assert.equal(a.stats.fallenLogs, 32);
    assert.equal(a.stats.exposedRoots, 160);
    assert.equal(a.stats.liveLeaves, 117504);
    assert.equal(a.stats.groundCoverPatches, 96);
    assert.equal(a.stats.groundCoverLeaves, 2304);
    let triangles = 0;
    for (const mesh of renderMeshes(a.group)) {
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
            const outside = Math.hypot(Math.max(0, Math.abs(x) - 8.5), Math.max(0, Math.abs(z + 20) - 25.5));
            assert.ok(outside > .4, 'whole silhouettes leave a narrow clear foundation strip');
            assert.ok(Math.abs(x) < 24 && z > -60 && z < 20, 'dense belt stays near the greenhouse');
            const gap = y - getWoodlandGroundHeight(x, z);
            if (mesh.name.includes('Curled leaf litter')) {
                assert.ok(gap >= .0013 && gap < .085, 'litter follows soil with a small curl');
            } else if (mesh.name.includes('Stems, deadwood')) {
                assert.ok(gap >= -.12 && gap < 1.6, 'roots/logs contact or enter the soil');
            } else assert.ok(gap > .015 && gap < 1.6, 'living foliage follows its bank above the soil');
        }
        const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
        assert.ok(Math.max(size.x, size.z) < 28, 'spatial batches do not span the whole forest');
        verifyClosedGeometry(mesh.geometry);
    }
    assert.equal(triangles, a.stats.triangles);
    for (const { point: [x, y, z] } of a.group.userData.plantRoots) {
        assert.equal(y, getWoodlandGroundHeight(x, z), 'all plant origins use the exact surface');
    }
    assert.equal(Object.keys(a.sections).length, 8);
    for (const [name, section] of Object.entries(a.sections)) {
        assert.equal(section.children.length, 3);
        assert.ok(a.stats.sections[name].ferns >= 50);
        assert.equal(a.stats.sections[name].brambles, 8);
        assert.ok(a.stats.sections[name].triangles < 240000);
    }
    const roots = a.group.userData.plantRoots.map(root => root.point);
    assert.ok(roots.some(([x, , z]) => Math.abs(x) < 8 && z > 8), 'vegetation closes the north end');
    assert.ok(roots.some(([x, , z]) => Math.abs(x) < 8 && z < -48), 'vegetation closes the south end');
    const coverage = foliageCoverage(a.group);
    assert.ok(coverage.near > .55, 'narrow pinnae still overlap across the near bank');
    assert.ok(coverage.belt > .4, 'feathered foliage retains layered coverage above scanned litter');
    assert.equal(createHash('sha256').update(JSON.stringify(a.group.userData.plantRoots)).digest('hex'),
        '63324a5c1f0e29f07323ed539eba8cbdc5c46c6422ecd84def34f388d310b088',
        'fern shape refinement preserves every previous plant origin');
    t.diagnostic(`Projected physical foliage coverage: ${JSON.stringify(coverage)}`);
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
    for (const mesh of renderMeshes(built.group)) {
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
    assert.equal(geometryDisposals, 24);
    assert.equal(materialDisposals, 3);
    assert.equal(textureDisposals, 0);
    assert.deepEqual(external.color, colors);
    assert.equal(scene.children.length, 1);
    assert.equal(scene.children[0], unrelated);
    const rebuilt = createWoodlandUnderstory(scene);
    assert.equal(renderMeshes(rebuilt.group)[0].material.map, external.map);
    rebuilt.dispose();
    assert.equal(textureDisposals, 0);
    maps.forEach(map => map.removeEventListener('dispose', onTextureDispose));
    external.dispose();
    assert.throws(() => createWoodlandUnderstory(null), TypeError);
});

test('near fern fronds have slender sword pinnae with a gradual distal taper', t => {
    const built = createWoodlandUnderstory(new THREE.Scene());
    t.after(() => built.dispose());
    const geometry = renderMeshes(built.group).find(mesh => mesh.name.includes('foliage')).geometry;
    const p = geometry.attributes.position;
    const unwarped = index => {
        const point = new THREE.Vector3().fromBufferAttribute(p, index);
        point.y -= getWoodlandGroundHeight(point.x, point.z);
        return point;
    };
    // The first frond has 20 pairs, each closed pinna has two 7-vertex sides.
    // Measure the emitted surface, undoing only its terrain-following warp.
    const lengths = [];
    for (let pair = 0; pair < 20; pair++) {
        const start = pair * 2 * 14;
        const length = unwarped(start).distanceTo(unwarped(start + 3));
        const width = unwarped(start + 1).distanceTo(unwarped(start + 5));
        assert.ok(length < .285 && width < .056, 'no oversized broad pinnae');
        if (pair < 10) {
            assert.ok(length > .18 && width > .033, 'mature pinnae retain their physical scale');
            assert.ok(length / width > 4.5, 'long slender blades rather than broad oval leaves');
        }
        if (pair > 11) assert.ok(length < lengths[pair - 1], 'progressive tip taper');
        lengths.push(length);
    }
    assert.ok(lengths[19] < lengths[9] * .2, 'small distal pair finishes the feathered outline');
    const terminal = 40 * 14;
    assert.ok(unwarped(terminal).distanceTo(unwarped(terminal + 3)) < .1, 'small terminal blade');
});
