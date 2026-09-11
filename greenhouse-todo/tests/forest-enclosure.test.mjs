import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createBotanicalEnvironment, createBotanicalLeafGeometry,
    createBotanicalLeafMaterial, texturesReady } from '../realism-botany.js';
import { getWoodlandGroundHeight } from '../realism-terrain.js';

// CPU geometry/submission proof only; the parent owns real-browser appearance,
// lighting, shadow-map scheduling and hardware frame-time validation.
const scene = new THREE.Scene();
const environment = createBotanicalEnvironment(scene);
const forest = environment.sections.forest;
const inventory = forest.userData.forest;
const leaves = forest.children.filter(mesh => mesh.isInstancedMesh);
const wood = forest.children.filter(mesh => !mesh.isInstancedMesh);
const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
test.after(() => environment.dispose());

function fingerprint(group) {
    const hash = createHash('sha256');
    const add = array => hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    for (const mesh of group.children) {
        for (const attribute of Object.values(mesh.geometry.attributes)) add(attribute.array);
        add(mesh.geometry.index.array);
        if (mesh.isInstancedMesh) { add(mesh.instanceMatrix.array); add(mesh.instanceColor.array); }
    }
    return hash.digest('hex');
}

function assertClosed(geometry, { weld = false, start = 0, count = geometry.index.count } = {}) {
    const p = geometry.attributes.position, ids = geometry.index;
    const remap = new Map(), vertices = new Map();
    if (weld) for (let j = start; j < start + count; j++) {
        const i = ids.getX(j);
        if (vertices.has(i)) continue;
        // Coincident upper/lower shading seams weld; actual thin tissue does not.
        const key = [p.getX(i), p.getY(i), p.getZ(i)].join(',');
        if (!remap.has(key)) remap.set(key, remap.size);
        vertices.set(i, remap.get(key));
    }
    const edges = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const reference = new THREE.Vector3().fromBufferAttribute(p, ids.getX(start));
    let volume = 0;
    for (let i = start; i < start + count; i += 3) {
        const triangle = [ids.getX(i), ids.getX(i + 1), ids.getX(i + 2)];
        a.fromBufferAttribute(p, triangle[0]).sub(reference);
        b.fromBufferAttribute(p, triangle[1]).sub(reference);
        c.fromBufferAttribute(p, triangle[2]).sub(reference);
        volume += a.dot(b.clone().cross(c)) / 6;
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-19, 'no degenerate triangles');
        for (let j = 0; j < 3; j++) {
            const from = weld ? vertices.get(triangle[j]) : triangle[j];
            const to = weld ? vertices.get(triangle[(j + 1) % 3]) : triangle[(j + 1) % 3];
            const key = from < to ? `${from}/${to}` : `${to}/${from}`;
            const edge = edges.get(key) ?? { count: 0, direction: 0 };
            edge.count++; edge.direction += from < to ? 1 : -1; edges.set(key, edge);
        }
    }
    for (const edge of edges.values()) {
        assert.equal(edge.count, 2, 'closed solid rather than an open card');
        assert.equal(edge.direction, 0, 'consistent winding');
    }
    assert.ok(volume > 0, 'outward-wound volume');
}

test('three populated depth bands enclose the greenhouse from every viewing direction', () => {
    const { trees, stats } = inventory;
    assert.equal(trees.length, 280);
    assert.equal(stats.snags, 22);
    assert.equal(stats.livingTrees, 258);
    assert.equal(new Set(trees.map(tree => tree.architecture)).size, 4);
    for (const layer of ['near', 'middle', 'far']) {
        const subset = trees.filter(tree => tree.layer === layer);
        assert.ok(new Set(subset.map(tree => tree.height.toFixed(2))).size > subset.length * .85);
        assert.ok(new Set(subset.map(tree => tree.lean.map(n => n.toFixed(2)).join(','))).size > subset.length * .95);
    }
    assert.ok(trees.filter(tree => tree.layer === 'near' && !tree.snag).every(tree => tree.height >= 21));
    // Use three aisle viewpoints, including the original default camera. Every
    // 15-degree azimuth sees both middle and far depth, not just side scenery.
    for (const cameraZ of [0, -20, -40]) {
        const bins = Array.from({ length: 24 }, () => ({ middle: 0, far: 0, near: 0 }));
        for (const tree of trees) {
            const [x, , z] = tree.root;
            const angle = (Math.atan2(z - cameraZ, x) + Math.PI * 2) % (Math.PI * 2);
            bins[Math.floor(angle / (Math.PI * 2) * bins.length)][tree.layer]++;
        }
        for (const bin of bins) { assert.ok(bin.middle >= 1); assert.ok(bin.far >= 1); }
        for (let quadrant = 0; quadrant < 4; quadrant++) assert.ok(
            bins.slice(quadrant * 6, quadrant * 6 + 6).reduce((sum, bin) => sum + bin.near, 0) >= 3);
    }
});

test('actual trunk and buttress contact vertices follow the shared terrain, with no floating roots', () => {
    const meshes = new Map(wood.map(mesh => [mesh.userData.forestChunk, mesh]));
    assert.ok(inventory.rootContacts.length > 650);
    for (const contact of inventory.rootContacts) {
        const [x, y, z] = contact.point;
        assert.ok(Math.abs(y - getWoodlandGroundHeight(x, z) + contact.embed) < 1e-9);
        const p = meshes.get(contact.chunk).geometry.attributes.position;
        point.fromBufferAttribute(p, contact.vertex);
        assert.ok(point.distanceTo(new THREE.Vector3(x, y, z)) < 5e-6, 'test rendered contact, not metadata alone');
        assert.ok(Math.abs(x) > 8.3 || z < -45.3 || z > 5.3);
    }
    for (const mesh of wood) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            if (Math.abs(x) < 8.3 && z > -45.3 && z < 5.3) assert.ok(y >= 11.6, 'wood clears the highest ridge');
        }
    }
});

test('modeled canopy spans the entire roof above 11m, using small attached solid leaves', () => {
    const cells = Array.from({ length: 13 }, () => Array(4).fill(0));
    let overRoof = 0, minHeight = Infinity;
    const normal = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    for (const mesh of leaves) {
        const p = mesh.geometry.attributes.position;
        const length = mesh.geometry.userData.botanical.length;
        assert.ok(length <= .24, 'normal tree-leaf scale, not an oversized canopy paddle');
        assert.equal(mesh.geometry.index.count / 3, mesh.userData.forestLayer === 'far' ? 8 : 16);
        for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix);
            matrix.decompose(point, rotation, scale);
            assert.ok(length * scale.y < .29);
            assert.ok(scale.x > 0 && scale.y > 0 && scale.z > 0, 'no reflected negative-scale instances');
            if (Math.abs(point.x) < 8 && point.z > -45 && point.z < 5) {
                cells[Math.floor((point.z + 45) / 4)][Math.floor((point.x + 8) / 4)]++;
                overRoof++;
            }
            // Test the whole actual blade near the structure, not just its centre.
            if (Math.abs(point.x) < 9 && point.z > -46 && point.z < 6) {
                for (let vertex = 0; vertex < p.count; vertex++) {
                    normal.fromBufferAttribute(p, vertex).applyMatrix4(matrix);
                    minHeight = Math.min(minHeight, normal.y);
                    assert.ok(normal.y > 12.8, 'closed leaf vertices clear the ridge with margin');
                }
            }
        }
    }
    assert.ok(overRoof > 15000, 'real overhead leaf mass');
    for (const cell of cells.flat()) assert.ok(cell >= 30, 'no long empty slot over the centre aisle');
    assert.ok(minHeight > 12.8);
    assert.ok(inventory.trees.filter(tree => tree.layer === 'near' && !tree.snag).every(tree => tree.leafCount >= 1900));
    assert.ok(inventory.trees.filter(tree => tree.snag).every(tree => tree.leafCount === 0));
});

test('all forest axes and blade LODs are closed, finite geometry with stock opaque shading', () => {
    const checked = new Set();
    for (const mesh of forest.children) {
        assert.ok(mesh.isMesh && !mesh.isPoints && !mesh.isSprite);
        assert.equal(mesh.material.transparent, false);
        assert.equal(mesh.material.alphaTest, 0);
        assert.equal(mesh.material.side, THREE.FrontSide);
        assert.equal(mesh.material.emissive.getHex(), 0);
        assert.equal(mesh.material.metalness, 0);
        assert.equal(mesh.material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
        assert.equal(mesh.material.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey);
        assert.equal(mesh.geometry.groups.length, 0);
        for (const attribute of Object.values(mesh.geometry.attributes)) {
            assert.ok(attribute.array.every(Number.isFinite));
            assert.equal(attribute.usage, THREE.StaticDrawUsage);
        }
        if (mesh.isInstancedMesh && !checked.has(mesh.geometry)) {
            assertClosed(mesh.geometry, { weld: true }); checked.add(mesh.geometry);
        }
    }
    // Verify every structural tube independently: touching fork caps are separate
    // closed organs, not a single Boolean-unioned trunk mesh.
    const meshes = new Map(wood.map(mesh => [mesh.userData.forestChunk, mesh]));
    for (const tree of inventory.trees) for (const part of tree.parts) assertClosed(
        meshes.get(tree.chunk).geometry, { weld: true, start: part.indexStart, count: part.indexCount });
});

test('spatial batches have valid culling bounds, immutable uploads and auditable triangle/draw totals', t => {
    let triangles = 0, instances = 0;
    scene.updateMatrixWorld(true);
    for (const mesh of forest.children) {
        assert.equal(mesh.matrixAutoUpdate, false);
        assert.equal(mesh.frustumCulled, true);
        assert.equal(mesh.visible, true, 'main-camera visibility must not suppress shadow casters');
        assert.equal(mesh.castShadow, mesh.userData.forestLayer === 'near');
        assert.equal(mesh.receiveShadow, mesh.userData.forestLayer === 'near');
        if (mesh.isInstancedMesh) {
            instances += mesh.count;
            assert.equal(mesh.instanceMatrix.usage, THREE.StaticDrawUsage);
            assert.equal(mesh.instanceColor.usage, THREE.StaticDrawUsage);
            const sphere = mesh.boundingSphere, box = mesh.boundingBox;
            assert.ok(Number.isFinite(sphere.radius) && sphere.radius > 0 && !box.isEmpty());
            if (mesh.userData.forestLayer === 'far') {
                assert.equal(mesh.material.normalMap, null);
                assert.equal(mesh.material.roughnessMap, null);
                assert.equal(mesh.material.roughness, .62);
                assert.ok(mesh.material.map, 'far leaves retain the photographed diffuse map');
            } else {
                assert.ok(mesh.material.normalMap && mesh.material.roughnessMap,
                    'near and middle foliage keep their original PBR surface maps');
            }
            const cellSize = { near: [12, 10, 12], middle: [20, 12, 20], far: [32, 16, 32] }[mesh.userData.forestLayer];
            assert.deepEqual(mesh.userData.forestCell.size, cellSize);
            const size = box.getSize(new THREE.Vector3()).toArray();
            assert.ok(size.every((value, axis) => value <= cellSize[axis] + .4),
                'leaf bounds are genuinely three-dimensional cells, including blade extent');
            // Instance bounds must contain each transformed source bound. These
            // prevent whole crowns vanishing when the source blade leaves view.
            const leafSphere = mesh.geometry.boundingSphere.clone();
            for (let i = 0; i < mesh.count; i++) {
                mesh.getMatrixAt(i, matrix);
                leafSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(matrix);
                assert.ok(sphere.center.distanceTo(leafSphere.center) + leafSphere.radius <= sphere.radius + 2e-4);
            }
        }
        triangles += mesh.geometry.index.count / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    }
    assert.equal(instances, inventory.stats.leaves);
    assert.equal(triangles, inventory.stats.triangles);
    assert.ok(forest.children.length > 64 && forest.children.length <= 256);
    assert.ok(triangles <= 9000000, 'lower leaf LODs preserve density within the reduced triangle budget');
    assert.equal(environment.stats.sections.forest.drawCalls, forest.children.length);
    assert.equal(environment.stats.sections.forest.triangles, triangles);
    const camera = new THREE.PerspectiveCamera(60, 1920 / 1080, .1, 160);
    const frustum = new THREE.Frustum(), submissions = {};
    for (const [name, at, target] of [
        ['west', [0, 1.6, -20], [-20, 8, -20]], ['east', [0, 1.6, -20], [20, 8, -20]],
        ['front', [0, 1.6, 0], [0, 6, 30]], ['back', [0, 1.6, -40], [0, 8, -75]],
        ['canopy', [0, 1.6, -20], [0, 30, -20]]
    ]) {
        camera.position.fromArray(at); camera.lookAt(...target); camera.updateMatrixWorld(true);
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const submitted = forest.children.filter(mesh => frustum.intersectsObject(mesh));
        assert.ok(submitted.length > 0 && submitted.length < forest.children.length, 'each view culls complete spatial chunks');
        submissions[name] = { draws: submitted.length, triangles: submitted.reduce((sum, mesh) => sum
            + mesh.geometry.index.count / 3 * (mesh.isInstancedMesh ? mesh.count : 1), 0) };
    }
    t.diagnostic(JSON.stringify({ inventory: inventory.stats, cpuFrustumSubmissions: submissions }));
});

test('rebuild is deterministic and environment disposal preserves task-leaf material and texture identity', () => {
    const task = createBotanicalLeafMaterial(), clone = task.clone();
    const shape = createBotanicalLeafGeometry();
    assert.equal(shape.index.count / 3, 256);
    assert.deepEqual(shape.userData.botanical.base, [0, -.175, 0]);
    const before = { color: task.color.getHex(), roughness: task.roughness, normalScale: task.normalScale.clone() };
    const maps = [task.map, task.normalMap, task.roughnessMap];
    let disposals = 0;
    const onDispose = () => disposals++;
    maps.forEach(map => map.addEventListener('dispose', onDispose));
    const unrelated = new THREE.Group(), alternate = new THREE.Scene(); alternate.add(unrelated);
    const rebuilt = createBotanicalEnvironment(alternate);
    assert.equal(fingerprint(rebuilt.sections.forest), fingerprint(forest));
    assert.deepEqual(rebuilt.stats, environment.stats);
    rebuilt.dispose(); rebuilt.dispose();
    assert.deepEqual(alternate.children, [unrelated]);
    assert.equal(disposals, 0);
    assert.equal(task.color.getHex(), before.color); assert.equal(task.roughness, before.roughness);
    assert.deepEqual(task.normalScale, before.normalScale);
    assert.equal(clone.map, task.map); assert.equal(clone.normalMap, task.normalMap); assert.equal(clone.roughnessMap, task.roughnessMap);
    maps.forEach(map => map.removeEventListener('dispose', onDispose));
    task.dispose(); clone.dispose(); shape.dispose();
});

test('projected solid foliage covers most of the canopy view rather than sparse terminal clusters', t => {
    // CPU silhouette raster, no WebGL, lighting, bark or greenhouse beams. The
    // earlier sparse generator covered 20.3% of this view despite passing a
    // leaf-centres-per-cell test. Actual triangle coverage is the useful guard.
    const width = 320, height = 180, mask = new Uint8Array(width * height);
    const camera = new THREE.PerspectiveCamera(65, width / height, .1, 160);
    camera.position.set(0, 1.6, -20); camera.lookAt(0, 30, -20); camera.updateMatrixWorld(true);
    const clip = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const combined = new THREE.Matrix4();
    for (const mesh of leaves) {
        const p = mesh.geometry.attributes.position, ids = mesh.geometry.index.array;
        const xy = new Float64Array(p.count * 3);
        for (let instance = 0; instance < mesh.count; instance++) {
            mesh.getMatrixAt(instance, matrix); combined.multiplyMatrices(clip, matrix);
            for (let vertex = 0; vertex < p.count; vertex++) {
                point.fromBufferAttribute(p, vertex).applyMatrix4(combined);
                xy[vertex * 3] = (point.x * .5 + .5) * width;
                xy[vertex * 3 + 1] = (-point.y * .5 + .5) * height;
                xy[vertex * 3 + 2] = point.z;
            }
            for (let i = 0; i < ids.length; i += 3) {
                const a = ids[i] * 3, b = ids[i + 1] * 3, c = ids[i + 2] * 3;
                if ([a, b, c].some(v => xy[v + 2] < -1 || xy[v + 2] > 1)) continue;
                const ax = xy[a], ay = xy[a + 1], bx = xy[b], by = xy[b + 1], cx = xy[c], cy = xy[c + 1];
                const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - .5));
                const x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - .5));
                const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - .5));
                const y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - .5));
                for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                    const ab = (bx - ax) * (y + .5 - ay) - (by - ay) * (x + .5 - ax);
                    const bc = (cx - bx) * (y + .5 - by) - (cy - by) * (x + .5 - bx);
                    const ca = (ax - cx) * (y + .5 - cy) - (ay - cy) * (x + .5 - cx);
                    if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0)) mask[y * width + x] = 1;
                }
            }
        }
    }
    const coverage = mask.reduce((sum, n) => sum + n, 0) / mask.length;
    assert.ok(coverage >= .55, `living canopy coverage ${coverage}; winterlike sparse crowns regressed`);
    t.diagnostic(`CPU leaf-only canopy coverage: ${(100 * coverage).toFixed(2)}%; no hardware/lighting claim.`);
});

test('forest bark publishes all maps atomically into clone-stable textures and has a 90s fallback', async t => {
    // Browser decoding is mocked only to verify lifecycle. The parent verifies
    // the actual files, network decode, photographed appearance and GPU upload.
    const originalDocument = globalThis.document;
    const pending = [];
    t.mock.method(THREE.ImageLoader.prototype, 'load', function (url, onLoad, progress, onError) {
        pending.push({ url, onLoad, onError }); return {};
    });
    globalThis.document = { createElement: () => {
        let image;
        return { getContext: () => ({ drawImage: value => { image = value; }, getImageData: () => {
            const pixels = new Uint8ClampedArray(1024 * 1024 * 4);
            const rgb = image.url.includes('nor_gl') ? [128, 128, 255] : image.url.includes('rough') ? [180, 180, 180] : [160, 140, 120];
            for (let i = 0; i < pixels.length; i += 4) { pixels.set(rgb, i); pixels[i + 3] = 255; }
            // Distinct top/bottom texels assert DataTexture's Y orientation.
            pixels[0] = 99; return { data: pixels };
        } }) };
    } };
    const built = [];
    t.after(() => { built.forEach(item => item.dispose());
        if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; });
    const construct = () => { const item = createBotanicalEnvironment(new THREE.Scene()); built.push(item); return item; };
    const findBark = item => item.sections.forest.children.find(mesh => !mesh.isInstancedMesh).material;
    const ready = construct(), material = findBark(ready), clone = material.clone();
    const maps = [material.map, material.normalMap, material.roughnessMap];
    const arrays = maps.map(map => map.image.data);
    assert.equal(material.color.getHex(), 0xffffff, 'photographed albedo does not get a second brown tint');
    assert.equal(material.roughness, 1); assert.deepEqual(material.normalScale.toArray(), [.72, .72]);
    for (const map of maps) { assert.equal(map.image.width, 1024); assert.equal(map.image.height, 1024);
        assert.equal(map.wrapS, THREE.RepeatWrapping); assert.equal(map.wrapT, THREE.RepeatWrapping); assert.equal(map.flipY, false); }
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(material.roughnessMap.colorSpace, THREE.NoColorSpace);
    const published = texturesReady();
    assert.equal(pending.length, 3);
    for (const request of pending.splice(0)) request.onLoad({ width: 1024, height: 1024, url: request.url });
    const result = await published;
    assert.equal(result.loaded.filter(url => url.includes('tree_bark_03')).length, 3);
    for (let i = 0; i < maps.length; i++) {
        assert.equal(maps[i].image.data, arrays[i]);
        assert.equal(arrays[i][1023 * 1024 * 4], 99, 'photograph row zero becomes texture v=1');
    }
    assert.equal(clone.map, material.map); assert.equal(clone.normalMap, material.normalMap); assert.equal(clone.roughnessMap, material.roughnessMap);
    ready.dispose(); clone.dispose();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const stalled = construct(), stalledMaterial = findBark(stalled);
    const fallback = [stalledMaterial.map, stalledMaterial.normalMap, stalledMaterial.roughnessMap].map(map => map.image.data[0]);
    const timeout = texturesReady();
    t.mock.timers.tick(90000);
    const timedOut = await timeout;
    assert.ok(timedOut.failed.some(item => item.reason.includes('90 seconds')));
    assert.equal(timedOut.loaded.filter(url => url.includes('tree_bark_03')).length, 0);
    for (const request of pending.splice(0)) request.onLoad({ width: 1024, height: 1024, url: request.url });
    assert.deepEqual([stalledMaterial.map, stalledMaterial.normalMap, stalledMaterial.roughnessMap].map(map => map.image.data[0]), fallback,
        'late image loads cannot mutate the bounded fallback after readiness');
    stalled.dispose();
    const disposed = construct(), cancellation = texturesReady(); disposed.dispose();
    const cancelled = await cancellation;
    assert.ok(cancelled.failed.some(item => item.reason.includes('owner disposed')));
    pending.length = 0;
});

test('3D rebatching preserves the frozen leaf geometry and every instance transform/color', () => {
    // Captured from source e0bdaf5e3eca5bcd before middle/far spatial rebatching.
    // Sum each word of per-instance SHA-256 digests: insensitive to batch order,
    // sensitive to matrix/color changes, removals and duplicates. Sums stay below
    // Number.MAX_SAFE_INTEGER. Geometry includes positions, normals, UVs/indices.
    const baseline = {
        near: { count: 285120, shape: '5f549a131e67aadfe6d42ec94057d0ec6b4bbe8d173aaa48bf505214b1708649',
            sums: [612024390231150, 612171333466267, 612020234259248, 611638870185094,
                612960894935586, 610826438119489, 611693715404718, 611257327517497] },
        middle: { count: 181440, shape: '4a9b886d0af63fef425d797ba0384edb1bb7b4f5df53ae99f5e119022a8f2ee0',
            sums: [389749743537580, 389375069743673, 389592830505833, 390787221722732,
                389707708294971, 389302646091185, 389350690464888, 389046822162408] },
        far: { count: 52920, shape: '35ae2064af6e2c694047f5c88662ad60e98be95271e180e925d753d15a25f7f4',
            sums: [113870730584735, 113965921408924, 113756556284850, 113914959933437,
                114148192932455, 113530582773042, 113768716990549, 113467072681484] }
    };
    for (const [layer, expected] of Object.entries(baseline)) {
        const meshes = leaves.filter(mesh => mesh.userData.forestLayer === layer), sums = Array(8).fill(0);
        assert.equal(meshes.reduce((sum, mesh) => sum + mesh.count, 0), expected.count);
        const geometry = meshes[0].geometry, hash = createHash('sha256');
        for (const attribute of Object.values(geometry.attributes)) hash.update(Buffer.from(attribute.array.buffer));
        hash.update(Buffer.from(geometry.index.array.buffer));
        assert.equal(hash.digest('hex'), expected.shape, `${layer} leaf shape is frozen`);
        for (const mesh of meshes) {
            assert.equal(mesh.geometry, geometry);
            const matrices = Buffer.from(mesh.instanceMatrix.array.buffer), colors = Buffer.from(mesh.instanceColor.array.buffer);
            for (let i = 0; i < mesh.count; i++) {
                const digest = createHash('sha256').update(matrices.subarray(i * 64, i * 64 + 64))
                    .update(colors.subarray(i * 12, i * 12 + 12)).digest();
                for (let word = 0; word < 8; word++) sums[word] += digest.readUInt32LE(word * 4);
            }
        }
        assert.deepEqual(sums, expected.sums, `${layer} placements and colors are frozen`);
    }
});

test('middle/far cells reduce exact benchmark-pose and sampled aisle triangle submissions', t => {
    // Frozen pre-change CPU baseline at the app's 55-degree FOV, 1920x1080,
    // near/far .05/2000 and benchmark aisle-inspection-v1 poses. Includes forest
    // only, one beauty pass; this is not a frame-time or fragment-cost estimate.
    const poses = {
        entry: { x: 0, z: 2, yaw: 0, pitch: 0, before: { triangles: 6035152, draws: 72 } },
        left: { x: -1.75, z: -12, yaw: Math.PI / 2, pitch: -.12, before: { triangles: 1934932, draws: 23 } },
        right: { x: 1.75, z: -24, yaw: -Math.PI / 2, pitch: -.12, before: { triangles: 1972140, draws: 24 } },
        canopy: { x: 0, z: -20, yaw: .45, pitch: 1.18, before: { triangles: 5897964, draws: 65 } }
    };
    const camera = new THREE.PerspectiveCamera(55, 1920 / 1080, .05, 2000), frustum = new THREE.Frustum();
    const count = pose => {
        camera.position.set(pose.x, 1.6, pose.z); camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
        camera.updateMatrixWorld(true);
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const visible = forest.children.filter(mesh => frustum.intersectsObject(mesh));
        return { triangles: visible.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3
            * (mesh.isInstancedMesh ? mesh.count : 1), 0), draws: visible.length };
    };
    const comparisons = {};
    for (const [name, pose] of Object.entries(poses)) {
        const after = count(pose);
        assert.ok(after.triangles < pose.before.triangles, `${name} must submit fewer triangles`);
        comparisons[name] = { before: pose.before, after };
    }
    const smooth = value => value * value * (3 - 2 * value);
    // Match the 15-second benchmark route: both traversals, inspection holds,
    // inspection easing and turns; sample every 100 ms without a GPU/browser.
    function route(seconds) {
        let time = seconds % 15;
        const returning = time >= 7.5;
        if (returning) time -= 7.5;
        const heading = returning ? Math.PI : 0, firstTravel = returning ? 2 : 1.75;
        const atZ = returning ? -24 : -12;
        if (time < firstTravel) return { x: 0, z: returning ? -40 + 8 * time : 2 - 8 * time, yaw: heading, pitch: 0 };
        if (time < firstTravel + 1.7) {
            const local = time - firstTravel;
            const blend = local < .6 ? smooth(local / .6) : local < 1.1 ? 1 : 1 - smooth((local - 1.1) / .6);
            return { x: (returning ? 1.75 : -1.75) * blend, z: atZ, yaw: heading + Math.PI / 2 * blend, pitch: -.12 * blend };
        }
        if (time < 6.95) return { x: 0, z: atZ + (returning ? 8 : -8) * (time - firstTravel - 1.7), yaw: heading, pitch: 0 };
        return { x: 0, z: returning ? 2 : -40, yaw: heading + Math.PI * smooth((time - 6.95) / .55), pitch: 0 };
    }
    const samples = Array.from({ length: 150 }, (_, i) => count(route(i / 10)));
    const triangles = samples.map(sample => sample.triangles).sort((a, b) => a - b);
    const draws = samples.map(sample => sample.draws).sort((a, b) => a - b);
    const meanTriangles = Math.round(triangles.reduce((sum, value) => sum + value, 0) / samples.length);
    const p99Triangles = triangles[Math.ceil(samples.length * .99) - 1];
    const before = { meanTriangles: 3504768, p99Triangles: 6143612, maxTriangles: 6549368, meanDraws: 41.39, maxDraws: 73 };
    assert.ok(meanTriangles < before.meanTriangles * .93, 'at least 7% fewer mean aisle triangles');
    assert.ok(p99Triangles < before.p99Triangles * .96, 'at least 4% fewer p99 aisle triangles');
    assert.ok(triangles.at(-1) < before.maxTriangles * .92, 'at least 8% fewer worst-sample aisle triangles');
    assert.ok(draws.at(-1) <= 128, 'bound the added draw submission cost');
    assert.equal(inventory.stats.triangles, 8920464);
    assert.equal(inventory.stats.shadowDrawCalls, 81);
    t.diagnostic(JSON.stringify({ poses: comparisons, aisle150Samples: { before, after: {
        meanTriangles, p99Triangles, maxTriangles: triangles.at(-1),
        meanDraws: +(draws.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2), maxDraws: draws.at(-1)
    } } }));
});
