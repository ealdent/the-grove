import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { createFlowerPrototype, disposeFlowerPrototypes } from '../realism-flowers.js';
import { PlantBatches } from '../plant-batches.js';

// CPU-only, including the real batching path. No renderer, browser, or network.
// node --test greenhouse-todo/tests/realism-flowers.test.mjs
const names = ['daisy', 'sunflower', 'rose', 'tulip', 'hydrangea'];

function digest(root) {
    const hash = crypto.createHash('sha256');
    root.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const key of ['position', 'normal', 'color', 'uv']) {
            const a = mesh.geometry.attributes[key].array;
            hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
        }
        hash.update(Buffer.from(mesh.geometry.index.array.buffer));
    });
    return hash.digest('hex');
}

function assertClosedComponent(geometry, part) {
    const p = geometry.attributes.position, indices = geometry.index.array;
    const canonical = new Map(), vertexIds = new Map(), edges = new Map();
    const center = new THREE.Vector3();
    for (let i = part.vertexStart; i < part.vertexStart + part.vertexCount; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(p, i);
        center.add(point);
        const key = point.toArray().join(':');
        if (!canonical.has(key)) canonical.set(key, canonical.size);
        vertexIds.set(i, canonical.get(key));
    }
    center.divideScalar(part.vertexCount);
    let volume = 0;
    for (let i = part.indexStart; i < part.indexStart + part.indexCount; i += 3) {
        const ids = [indices[i], indices[i + 1], indices[i + 2]];
        const [a, b, c] = ids.map(id => new THREE.Vector3().fromBufferAttribute(p, id).sub(center));
        const faceNormal = b.clone().sub(a).cross(c.clone().sub(a));
        const area = faceNormal.length();
        assert(area > 1e-17, `${part.name}: degenerate triangle`);
        const shadingNormal = ids.reduce((sum, id) => sum.add(
            new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, id)), new THREE.Vector3());
        assert(faceNormal.dot(shadingNormal) > 0, `${part.name}: shading normals oppose the physical surface`);
        volume += a.dot(b.clone().cross(c)) / 6;
        const points = ids.map(id => vertexIds.get(id));
        for (let j = 0; j < 3; j++) {
            const a = points[j], b = points[(j + 1) % 3];
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            const pair = edges.get(key) || [0, 0];
            pair[0]++;
            pair[1] += a < b ? 1 : -1;
            edges.set(key, pair);
        }
    }
    assert(volume > 0, `${part.name}: inverted or zero-volume component ${volume}`);
    assert([...edges.values()].every(([count, balance]) => count === 2 && balance === 0),
        `${part.name}: open/nonmanifold boundary or inconsistent winding`);
}

test('all five flower heads fit the attachment envelope, triangle and draw budgets', () => {
    for (let i = 0; i < 5; i++) {
        const root = createFlowerPrototype(i), stats = root.userData.flower;
        assert.equal(stats.species, names[i]);
        assert.equal(stats.drawCalls, 3);
        assert(stats.triangles <= 10000);
        const bounds = new THREE.Box3().setFromObject(root);
        assert(bounds.min.y >= -.02 && bounds.min.y < -.01, 'pedicel must overlap the parent stem');
        assert(bounds.max.y <= .11);
        assert(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x),
            Math.abs(bounds.min.z), Math.abs(bounds.max.z)) <= .16);
        const actual = root.children.reduce((sum, m) => sum + m.geometry.index.count / 3, 0);
        assert.equal(stats.triangles, actual);
        assert.equal(stats.drawCalls, root.children.length);
    }
});

test('every petal and organ is a finite outward-wound closed solid', () => {
    for (let i = 0; i < 5; i++) createFlowerPrototype(i).traverse(mesh => {
        if (!mesh.isMesh) return;
        const g = mesh.geometry;
        for (const a of Object.values(g.attributes)) assert(a.array.every(Number.isFinite));
        assert(g.attributes.uv.array.every(v => v >= 0 && v <= 1));
        assert(g.attributes.color.array.every(v => v >= 0 && v <= 1));
        const normal = new THREE.Vector3();
        for (let i = 0; i < g.attributes.normal.count; i++) {
            normal.fromBufferAttribute(g.attributes.normal, i);
            assert(Math.abs(normal.length() - 1) < 1e-5);
        }
        for (const part of g.userData.parts) assertClosedComponent(g, part);
    });
});

test('species have structural organs, with no spherical filler or open surface primitives', () => {
    const componentNames = index => createFlowerPrototype(index).children
        .flatMap(mesh => mesh.geometry.userData.parts.map(part => part.name));
    const tulip = componentNames(3);
    assert.equal(tulip.filter(n => n === 'tulip tepal').length, 6);
    assert.equal(tulip.filter(n => n === 'tulip filament').length, 6);
    assert.equal(tulip.filter(n => n === 'tulip anther').length, 6);
    assert.equal(tulip.filter(n => n === 'tulip stigma lobe').length, 3);
    assert(componentNames(0).includes('disc floret'));
    assert(componentNames(1).includes('ray floret'));
    assert(componentNames(2).includes('rose petal'));
    const hydrangea = componentNames(4);
    assert.equal(hydrangea.filter(n => n === 'hydrangea showy sepal').length,
        4 * hydrangea.filter(n => n === 'hydrangea flower center').length);
    assert.equal(hydrangea.filter(n => n === 'hydrangea pedicel').length,
        hydrangea.filter(n => n === 'hydrangea flower center').length);
});

test('fresh hierarchies share immutable geometry, material and texture resources', () => {
    const a = createFlowerPrototype(0), b = createFlowerPrototype(5), c = createFlowerPrototype(-5);
    assert.notEqual(a, b);
    for (let i = 0; i < a.children.length; i++) {
        assert.notEqual(a.children[i], b.children[i]);
        assert.equal(a.children[i].geometry, b.children[i].geometry);
        assert.equal(a.children[i].geometry, c.children[i].geometry);
        assert.equal(a.children[i].material, b.children[i].material);
        assert(a.children[i].geometry.userData.shared);
        assert(a.children[i].material.userData.shared);
    }
    const hash = digest(a);
    b.position.set(3, 5, 2);
    b.scale.setScalar(1.7);
    b.updateMatrixWorld(true);
    assert.equal(digest(a), hash);
    assert.equal(createFlowerPrototype(-1).userData.flower.species, 'hydrangea');
    const palette = new Set();
    for (let i = 0; i < 5; i++) createFlowerPrototype(i).traverse(mesh => {
        if (!mesh.isMesh) return;
        const m = mesh.material;
        palette.add(m);
        assert(m.isMeshStandardMaterial);
        assert.equal(m.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
        assert.equal(m.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey);
        assert.equal(m.transparent, false);
        assert.equal(m.alphaMap, null);
        assert.equal(m.alphaTest, 0);
        assert.equal(m.side, THREE.FrontSide);
        assert.equal(m.emissive.getHex(), 0);
        assert.equal(m.metalness, 0);
        assert(mesh.castShadow && mesh.receiveShadow);
        assert.equal(mesh.matrixAutoUpdate, false);
    });
    assert.equal(palette.size, 3);
});

test('surface atlas is neutral, opaque, bounded, aligned and shared across clones', () => {
    const flower = createFlowerPrototype(3), petals = flower.children[0];
    const material = petals.material, clone = material.clone();
    const checks = [
        ['map', THREE.SRGBColorSpace, 210, 255],
        ['bumpMap', THREE.NoColorSpace, 95, 200],
        ['roughnessMap', THREE.NoColorSpace, 125, 190]
    ];
    for (const [key, space, low, high] of checks) {
        const texture = material[key], data = texture.image.data;
        assert.equal(clone[key], texture);
        assert.equal(texture.colorSpace, space);
        assert.equal(texture.image.width, 512);
        assert.equal(texture.image.height, 512);
        assert(texture.userData.shared);
        assert(texture.generateMipmaps);
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
            assert.equal(data[i], data[i + 1], 'no pigment or illumination color in the neutral atlas');
            assert.equal(data[i], data[i + 2]);
            assert.equal(data[i + 3], 255, 'surface texture must not define an alpha silhouette');
            min = Math.min(min, data[i]); max = Math.max(max, data[i]);
        }
        assert(min >= low && max <= high, `${key}: unexpectedly strong surface contrast ${min}/${max}`);
        assert(max - min >= 10, `${key}: missing surface detail`);
    }
    for (let i = 0; i < 5; i++) {
        const mesh = createFlowerPrototype(i).children[0], uv = mesh.geometry.attributes.uv;
        for (const part of mesh.geometry.userData.parts) {
            const tileX = Math.floor(uv.getX(part.vertexStart) * 2);
            const tileY = Math.floor(uv.getY(part.vertexStart) * 2);
            for (let v = part.vertexStart; v < part.vertexStart + part.vertexCount; v++) {
                const x = uv.getX(v) * 512 - tileX * 256;
                const y = uv.getY(v) * 512 - tileY * 256;
                assert(x >= 4.49 && x <= 251.51 && y >= 4.49 && y <= 251.51,
                    'UV escaped its replicated atlas gutter');
            }
        }
    }
    clone.dispose();
});

test('120 mixed heads use stock PlantBatches with shared materials and unchanged world transforms', () => {
    const scene = new THREE.Scene(), batches = new PlantBatches(scene), roots = [];
    for (let i = 0; i < 120; i++) {
        const root = createFlowerPrototype(i % 5);
        root.userData.positionIndex = i;
        root.position.set((i % 12) * .35, 1.015, -Math.floor(i / 12) * .5);
        root.scale.setScalar(1.7);
        root.rotation.y = i * .31;
        scene.add(root);
        roots.push(root);
    }
    batches.rebuild(roots);
    const stats = batches.stats();
    assert.equal(stats.drawCalls, 75); // 5 spatial chunks × 5 species × 3 meshes.
    assert.equal(stats.instances, 360);
    assert.equal(stats.materials, 3);
    const source = roots[0].children[0];
    const instanced = batches.group.children.find(m => m.geometry === source.geometry
        && m.userData.plantBatchChunk === 0);
    const matrix = new THREE.Matrix4();
    instanced.getMatrixAt(0, matrix);
    matrix.premultiply(instanced.matrixWorld);
    source.matrixWorld.elements.forEach((v, i) => assert(Math.abs(v - matrix.elements[i]) < 1e-6));
    batches.dispose();
});

test('owner disposal frees resources once and rebuilding is deterministic', () => {
    const before = names.map((_, i) => digest(createFlowerPrototype(i)));
    const resources = new Set();
    for (let i = 0; i < 5; i++) createFlowerPrototype(i).traverse(mesh => {
        if (!mesh.isMesh) return;
        resources.add(mesh.geometry);
        resources.add(mesh.material);
        for (const key of ['map', 'bumpMap', 'roughnessMap']) {
            if (mesh.material[key]) resources.add(mesh.material[key]);
        }
    });
    let disposed = 0;
    for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
    disposeFlowerPrototypes();
    disposeFlowerPrototypes();
    assert.equal(disposed, resources.size);
    assert.deepEqual(names.map((_, i) => digest(createFlowerPrototype(i))), before);
    disposeFlowerPrototypes();
});
