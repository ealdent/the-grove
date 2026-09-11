import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PlantBatches } from '../plant-batches.js';

// Real Three math/geometry, synthetic plants, no browser or WebGL renderer.
// Run: node --test greenhouse-todo/tests/plant-batches.test.mjs
function fixture(t) {
    const scene = new THREE.Scene();
    const batches = new PlantBatches(scene);
    t.after(() => batches.dispose());
    return { scene, batches };
}

function rootAt(scene, slot, geometry = new THREE.BoxGeometry(.1, .2, .1),
    material = new THREE.MeshStandardMaterial({ color: 0x42a85a })) {
    const root = new THREE.Group();
    root.userData.positionIndex = slot;
    root.position.set(slot % 12, 1, -Math.floor(slot / 12) * 4);
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    scene.add(root);
    return { root, mesh };
}

function renderMeshes(batches) {
    return batches.group.children.filter(mesh => mesh.isInstancedMesh);
}

function nearArray(actual, expected, epsilon = 2e-6) {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= epsilon,
        `component ${i}: ${value} != ${expected[i]}`));
}

function matrixAt(mesh, index = 0) {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    return matrix;
}

function colorAt(mesh, index = 0) {
    const color = new THREE.Color();
    mesh.getColorAt(index, color);
    return color;
}

function assertBoundsContainVertices(batches) {
    const vertex = new THREE.Vector3();
    for (const mesh of renderMeshes(batches)) {
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < mesh.count; i++) {
            const matrix = matrixAt(mesh, i);
            if (matrix.determinant() === 0) continue;
            for (let j = 0; j < positions.count; j++) {
                vertex.fromBufferAttribute(positions, j).applyMatrix4(matrix);
                assert.ok(vertex.distanceTo(mesh.boundingSphere.center) <= mesh.boundingSphere.radius + 1e-5,
                    `${mesh.name} clipped instance ${i}, vertex ${j}`);
            }
        }
    }
}

test('renderer passes skip retained-source matrix work; sync still updates growth and picking transforms', t => {
    const { scene, batches } = fixture(t);
    // The greenhouse scene itself never moves. A constantly recomposed scene
    // matrix would force every child subtree dirty in Three r160.
    scene.updateMatrix();
    scene.matrixAutoUpdate = false;
    const { root, mesh } = rootAt(scene, 0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.03, .09, .01), mesh.material);
    leaf.position.y = .2;
    mesh.add(leaf);
    batches.rebuild([root]);
    scene.updateMatrixWorld();
    let compositions = 0;
    for (const object of [root, mesh, leaf]) {
        const update = object.updateMatrix;
        object.updateMatrix = function () { compositions++; return update.call(this); };
    }
    scene.updateMatrixWorld();
    scene.updateMatrixWorld();
    assert.equal(compositions, 0, 'render-only passes must not recompose hidden sources');
    root.position.x += .7;
    mesh.rotation.z = .4;
    leaf.scale.setScalar(.8);
    batches.sync(root);
    assert.equal(compositions, 3, 'explicit sync refreshes every retained source exactly once');
    const expected = new THREE.Matrix4().multiplyMatrices(scene.matrixWorld, root.matrix)
        .multiply(mesh.matrix).multiply(leaf.matrix);
    nearArray(leaf.matrixWorld.elements, expected.elements);
    const leafBatch = renderMeshes(batches).find(batch => batch.geometry === leaf.geometry);
    nearArray(matrixAt(leafBatch).elements, expected.elements);
    scene.updateMatrixWorld();
    assert.equal(compositions, 3);
});

test('rebuild removal and dispose restore caller matrix-update flags', t => {
    const { scene, batches } = fixture(t);
    const a = rootAt(scene, 0), b = rootAt(scene, 24);
    b.mesh.matrixAutoUpdate = false;
    b.mesh.matrixWorldAutoUpdate = false;
    batches.rebuild([a.root, b.root]);
    assert.equal(a.mesh.matrixAutoUpdate, false);
    assert.equal(a.root.matrixWorldAutoUpdate, false);
    batches.rebuild([b.root]);
    assert.equal(a.mesh.matrixAutoUpdate, true);
    assert.equal(a.root.matrixWorldAutoUpdate, true);
    batches.dispose();
    assert.equal(b.root.matrixAutoUpdate, true);
    assert.equal(b.root.matrixWorldAutoUpdate, true);
    assert.equal(b.mesh.matrixAutoUpdate, false);
    assert.equal(b.mesh.matrixWorldAutoUpdate, false);
});

test('reparenting a retained child preserves its original update flags across roots', t => {
    const { scene, batches } = fixture(t);
    const a = rootAt(scene, 0), b = rootAt(scene, 24);
    const child = new THREE.Mesh(new THREE.BoxGeometry(.03, .05, .02), a.mesh.material);
    a.root.add(child);
    batches.rebuild([a.root, b.root]);
    b.root.add(child);
    batches.rebuild([a.root, b.root]);
    child.position.x = 7;
    batches.sync(b.root);
    assert.equal(child.matrix.elements[12], 7);
    batches.dispose();
    assert.equal(child.matrixAutoUpdate, true);
    assert.equal(child.matrixWorldAutoUpdate, true);
});

test('nested pot, bent stem, leaf and flower world transforms survive batching and sync', t => {
    const { scene, batches } = fixture(t);
    scene.position.set(3, -1, 2);
    scene.rotation.y = .17;
    scene.scale.setScalar(1.3);
    const { root, mesh: pot } = rootAt(scene, 29);
    root.rotation.set(.12, .32, -.06);
    const potGroup = new THREE.Group();
    root.add(potGroup);
    potGroup.add(pot);
    potGroup.scale.setScalar(.87);
    potGroup.rotation.y = 1.4;
    pot.position.y = .1;
    const stemGeometry = new THREE.CylinderGeometry(.011, .018, .22, 10).translate(0, .11, 0);
    const stem = new THREE.Mesh(stemGeometry, pot.material.clone());
    stem.position.y = .21;
    stem.scale.set(.8, .43, .8);
    stem.rotation.set(.76, 0, -.08);
    root.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 5), pot.material.clone());
    leaf.position.set(.05, .14, -.02);
    leaf.rotation.set(.1, .9, .83);
    leaf.scale.set(.6, .9, .05);
    stem.add(leaf);
    const flower = new THREE.Group();
    flower.position.y = .25;
    flower.scale.setScalar(1.7);
    stem.add(flower);
    const petal = new THREE.Mesh(new THREE.ConeGeometry(.05, .09, 8), pot.material.clone());
    petal.rotation.z = .6;
    flower.add(petal);
    const sources = [pot, stem, leaf, petal];
    const originalGeometry = sources.map(mesh => mesh.geometry);
    batches.rebuild([root]);
    assert.equal(root.visible, false);
    assert.equal(root.parent, scene);
    assert.deepEqual(sources.map(mesh => mesh.geometry), originalGeometry);

    function verifyWorldMatrices() {
        scene.updateMatrixWorld(true);
        for (const source of sources) {
            const instance = renderMeshes(batches).find(mesh => mesh.geometry === source.geometry);
            const world = instance.matrixWorld.clone().multiply(matrixAt(instance));
            nearArray(world.elements, source.matrixWorld.elements, 3e-6);
        }
        assertBoundsContainVertices(batches);
    }
    verifyWorldMatrices();
    root.position.x += .28;
    stem.rotation.z = .34; // attention rattle
    stem.scale.y = .61; // growth/wilt beneath a rotated leaf
    leaf.rotation.z += .6;
    leaf.scale.x *= .6;
    batches.sync(root);
    verifyWorldMatrices();
});

test('root hiding keeps manual child raycasts usable without duplicate instance hits', t => {
    const { scene, batches } = fixture(t);
    const { root, mesh } = rootAt(scene, 0, new THREE.BoxGeometry(1, 1, 1));
    root.position.set(0, 0, -4);
    batches.rebuild([root]);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
    assert.equal(root.visible, false);
    assert.ok(ray.intersectObject(mesh).length > 0);
    scene.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(batches.group, true).length, 0);
});

test('hidden groups and dropped/fallen leaves toggle in place; root visibility is ignored', t => {
    const { scene, batches } = fixture(t);
    const { root, mesh: stem } = rootAt(scene, 73);
    const leafGeometry = new THREE.SphereGeometry(.1, 6, 4);
    const live = new THREE.Mesh(leafGeometry, stem.material.clone());
    stem.add(live);
    const nested = new THREE.Group();
    stem.add(nested);
    const upper = live.clone();
    nested.add(upper);
    const fallen = live.clone();
    fallen.visible = false;
    root.add(fallen);
    batches.rebuild([root]);
    const meshes = renderMeshes(batches);
    const leafBatch = meshes.find(mesh => mesh.geometry === leafGeometry);
    assert.equal(batches.stats().visibleInstances, 3);
    assert.equal(matrixAt(leafBatch, 2).determinant(), 0);
    assert.ok(leafBatch.boundingSphere.center.z < -15, 'hidden leaves must not pull the bound toward world zero');

    nested.visible = false;
    live.visible = false;
    fallen.visible = true;
    batches.sync(root);
    assert.equal(batches.stats().visibleInstances, 2);
    assert.equal(matrixAt(leafBatch, 0).determinant(), 0);
    assert.equal(matrixAt(leafBatch, 1).determinant(), 0);
    assert.notEqual(matrixAt(leafBatch, 2).determinant(), 0);
    assert.deepEqual(renderMeshes(batches), meshes);

    stem.visible = false;
    fallen.visible = false;
    batches.sync(root);
    assert.equal(batches.stats().drawCalls, 0);
    assert.ok(meshes.every(mesh => !mesh.visible));
    stem.visible = true;
    live.visible = true;
    nested.visible = true;
    root.visible = true; // the renderer reclaims this flag on sync
    batches.sync(root);
    assert.equal(root.visible, false);
    assert.equal(batches.stats().visibleInstances, 3);
    assertBoundsContainVertices(batches);
});

test('an initially all-hidden batch renders nothing, then can become visible without rebuilding', t => {
    const { scene, batches } = fixture(t);
    const { root, mesh } = rootAt(scene, 0);
    mesh.visible = false;
    batches.rebuild([root]);
    assert.equal(renderMeshes(batches)[0].visible, false);
    mesh.visible = true;
    batches.sync(root);
    assert.equal(renderMeshes(batches)[0].visible, true);
    assert.equal(batches.stats().visibleInstances, 1);
});

test('cloned tints share a white material and retain linear instance colors and source maps', t => {
    const { scene, batches } = fixture(t);
    const map = new THREE.Texture();
    const material = new THREE.MeshPhysicalMaterial({ color: 0x804020, roughness: .7, map, vertexColors: true });
    const a = rootAt(scene, 0, undefined, material);
    const b = rootAt(scene, 1, a.mesh.geometry, material.clone());
    b.mesh.material.color.setHex(0x2ecc71);
    batches.rebuild([a.root, b.root]);
    const [batch] = renderMeshes(batches);
    assert.equal(batches.stats().batches, 1);
    assert.notEqual(batch.material, material);
    assert.equal(batch.material.map, map);
    assert.equal(batch.material.vertexColors, true);
    assert.equal(batch.material.color.getHex(), 0xffffff);
    assert.equal(material.color.getHex(), 0x804020);
    nearArray(colorAt(batch, 0).toArray(), material.color.toArray());
    nearArray(colorAt(batch, 1).toArray(), b.mesh.material.color.toArray());
    assert.ok(colorAt(batch).r < .3, 'must retain linear red, not hex red/255');
    const clone = batch.material;
    const version = clone.version;
    b.mesh.material.color.setHex(0xb89020);
    batches.sync(b.root);
    assert.equal(batch.material, clone);
    assert.equal(clone.version, version);
    assert.equal(batches.stats().materials, 1);
    nearArray(colorAt(batch, 1).toArray(), b.mesh.material.color.toArray());
    b.mesh.material.visible = false;
    batches.sync(b.root);
    assert.equal(batch.count, 2);
    assert.equal(batches.stats().visibleInstances, 1);
    assert.equal(batch.material.visible, true);
});

test('map identity, physical settings and mesh render flags do not get merged', t => {
    const { scene, batches } = fixture(t);
    const base = new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), roughness: .7 });
    const geometry = new THREE.BoxGeometry();
    const plants = Array.from({ length: 8 }, (_, i) => rootAt(scene, i, geometry, base.clone()));
    plants[1].mesh.material.map = new THREE.Texture();
    plants[2].mesh.material.roughness = .3;
    plants[3].mesh.material.emissive.setHex(0x223344);
    plants[4].mesh.castShadow = true;
    plants[5].mesh.receiveShadow = true;
    plants[6].mesh.renderOrder = 2;
    plants[7].mesh.layers.set(2);
    batches.rebuild(plants.map(plant => plant.root));
    assert.equal(batches.stats().batches, 8);
    assert.equal(batches.stats().materials, 4);
});

test('primitive equality includes baked translation, scale, rotation, UVs and vertex colors', t => {
    const { scene, batches } = fixture(t);
    const geometries = [
        new THREE.CylinderGeometry(.1, .08, .2, 8),
        new THREE.CylinderGeometry(.1, .08, .2, 8),
        new THREE.CylinderGeometry(.1, .08, .2, 8).translate(0, .1, 0),
        new THREE.CylinderGeometry(.1, .08, .2, 8).translate(0, .1, 0),
        new THREE.CylinderGeometry(.1, .08, .2, 8).translate(0, .2, 0),
        new THREE.CylinderGeometry(.1, .08, .2, 8).scale(1, .5, 1),
        new THREE.CylinderGeometry(.1, .08, .2, 8).rotateZ(.7)
    ];
    const uvChanged = geometries[0].clone();
    uvChanged.attributes.uv.setX(0, .25);
    geometries.push(uvChanged);
    for (const value of [.3, .7]) {
        const colored = geometries[0].clone();
        colored.setAttribute('color', new THREE.Float32BufferAttribute(
            new Float32Array(colored.attributes.position.count * 3).fill(value), 3));
        geometries.push(colored);
    }
    const plants = geometries.map((geometry, i) => rootAt(scene, i, geometry));
    batches.rebuild(plants.map(plant => plant.root));
    assert.equal(batches.stats().batches, geometries.length - 2);
    assert.deepEqual(renderMeshes(batches).map(mesh => mesh.count).sort((a, b) => b - a), [2, 2, 1, 1, 1, 1, 1, 1]);
});

test('custom geometry shares by actual object or explicit batchKey, never guessed parameters', t => {
    const { scene, batches } = fixture(t);
    const a = new THREE.BufferGeometry().copy(new THREE.BoxGeometry());
    const b = a.clone();
    const c = a.clone();
    const d = a.clone();
    c.userData = { batchKey: 'flower:rose:outer:v1' };
    d.userData = { batchKey: c.userData.batchKey };
    const roots = [a, a, b, c, d].map((geometry, i) => rootAt(scene, i, geometry).root);
    batches.rebuild(roots);
    assert.equal(batches.stats().batches, 3);
    assert.deepEqual(renderMeshes(batches).map(mesh => mesh.count), [2, 1, 2]);
});

test('sync only updates its root and affected buffers; unchanged sync does not upload again', t => {
    const { scene, batches } = fixture(t);
    const a = rootAt(scene, 0);
    const b = rootAt(scene, 1, a.mesh.geometry, a.mesh.material.clone());
    const far = rootAt(scene, 119, a.mesh.geometry, a.mesh.material.clone());
    batches.rebuild([a.root, b.root, far.root]);
    const [nearBatch, farBatch] = renderMeshes(batches);
    const farMatrices = farBatch.instanceMatrix.array.slice();
    const farVersion = farBatch.instanceMatrix.version;
    const bMatrix = matrixAt(nearBatch, 1).elements.slice();
    nearBatch.instanceMatrix.clearUpdateRanges();
    nearBatch.instanceColor.clearUpdateRanges();
    far.root.updateWorldMatrix = () => { throw new Error('unrelated root was visited'); };
    a.mesh.rotation.x = .8;
    a.mesh.material.color.setHex(0x654321);
    batches.sync(a.root);
    assert.deepEqual(matrixAt(nearBatch, 1).elements, bMatrix);
    assert.deepEqual(farBatch.instanceMatrix.array, farMatrices);
    assert.equal(farBatch.instanceMatrix.version, farVersion);
    assert.deepEqual(nearBatch.instanceMatrix.updateRanges, [{ start: 0, count: 16 }]);
    assert.deepEqual(nearBatch.instanceColor.updateRanges, [{ start: 0, count: 3 }]);
    const matrixVersion = nearBatch.instanceMatrix.version;
    const colorVersion = nearBatch.instanceColor.version;
    batches.sync(a.root);
    assert.equal(nearBatch.instanceMatrix.version, matrixVersion);
    assert.equal(nearBatch.instanceColor.version, colorVersion);
    // A second root's update must preserve the first root's pending upload.
    b.mesh.position.x = .3;
    batches.sync(b.root);
    assert.deepEqual(nearBatch.instanceMatrix.updateRanges, [{ start: 0, count: 32 }]);
    for (let i = 0; i < 100; i++) {
        a.mesh.rotation.z = i * .01;
        batches.sync(a.root);
    }
    assert.equal(nearBatch.instanceMatrix.updateRanges.length, 1);
});

test('bounds expand for growth and newly visible leaves, including near-camera frustum edges', t => {
    const { scene, batches } = fixture(t);
    const { root, mesh } = rootAt(scene, 96, new THREE.BoxGeometry(.2, .2, .2));
    root.position.set(0, 1, -32);
    const fallen = mesh.clone();
    fallen.visible = false;
    root.add(fallen);
    batches.rebuild([root]);
    const [batch] = renderMeshes(batches);
    const camera = new THREE.PerspectiveCamera(35, 1, .01, 4);
    camera.position.set(7, 1, -31);
    camera.lookAt(7, 1, -32);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
        camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse));
    scene.updateMatrixWorld(true);
    assert.equal(frustum.intersectsObject(batch), false);
    mesh.position.x = 7;
    mesh.scale.set(4, 1, .2);
    mesh.rotation.z = .9;
    fallen.visible = true;
    fallen.position.set(-1.1, -.2, -.4);
    batches.sync(root);
    assert.equal(frustum.intersectsObject(batch), true);
    assertBoundsContainVertices(batches);
});

test('rebuilding removal/completion restores roots, frees instance buffers and reuses material cache', t => {
    const { scene, batches } = fixture(t);
    const map = new THREE.Texture();
    const base = new THREE.MeshStandardMaterial({ map });
    const geometry = new THREE.BoxGeometry();
    geometry.userData.shared = true;
    const a = rootAt(scene, 0, geometry, base);
    const b = rootAt(scene, 25, geometry, base.clone());
    b.root.visible = false; // preexisting state must survive rebuild and dispose
    let sourceDisposals = 0, textureDisposals = 0, instanceDisposals = 0, cloneDisposals = 0;
    geometry.addEventListener('dispose', () => sourceDisposals++);
    base.addEventListener('dispose', () => sourceDisposals++);
    b.mesh.material.addEventListener('dispose', () => sourceDisposals++);
    map.addEventListener('dispose', () => textureDisposals++);
    batches.rebuild([a.root, b.root]);
    const cached = renderMeshes(batches)[0].material;
    cached.addEventListener('dispose', () => cloneDisposals++);
    for (const mesh of renderMeshes(batches)) mesh.addEventListener('dispose', () => instanceDisposals++);
    scene.remove(a.root);
    const completed = rootAt(scene, 0, new THREE.SphereGeometry(.12, 8, 6), base.clone());
    completed.mesh.geometry.addEventListener('dispose', () => sourceDisposals++);
    completed.mesh.material.color.setHex(0xf28abb);
    batches.rebuild([completed.root, b.root]);
    assert.equal(instanceDisposals, 2);
    assert.equal(a.root.visible, true);
    assert.equal(b.root.visible, false);
    assert.equal(batches.sync(a.root), false);
    assert.equal(batches.stats().instances, 2);
    assert.ok(renderMeshes(batches).every(mesh => mesh.material === cached));
    for (let i = 0; i < 8; i++) {
        completed.mesh.material = base.clone();
        completed.mesh.material.color.setHSL(i / 8, .5, .5);
        batches.rebuild([b.root, completed.root]);
        assert.equal(batches.stats().materials, 1);
        assert.ok(renderMeshes(batches).every(mesh => mesh.material === cached));
    }
    batches.rebuild([]);
    assert.equal(completed.root.visible, true);
    assert.equal(b.root.visible, false);
    assert.equal(batches.stats().batches, 0);
    assert.equal(batches.stats().materials, 1, 'keep warm materials through an empty rebuild');
    assert.equal(cloneDisposals, 0);
    batches.dispose();
    batches.dispose();
    assert.equal(cloneDisposals, 1);
    assert.equal(sourceDisposals, 0);
    assert.equal(textureDisposals, 0);
    assert.equal(batches.group.parent, null);
    assert.equal(batches.stats().materials, 0);
    assert.equal(batches.sync(b.root), false);
    assert.throws(() => batches.rebuild([]), /disposed/);
});

test('invalid topology leaves the previous valid batches and root visibility intact', t => {
    const { scene, batches } = fixture(t);
    const a = rootAt(scene, 0);
    batches.rebuild([a.root]);
    const old = renderMeshes(batches);
    const invalid = rootAt(scene, 1, a.mesh.geometry, [a.mesh.material]);
    assert.throws(() => batches.rebuild([a.root, invalid.root]), /single stock color material/);
    assert.deepEqual(renderMeshes(batches), old);
    assert.equal(invalid.root.visible, true);
    assert.equal(a.root.visible, false);
    invalid.mesh.material = a.mesh.material;
    invalid.root.userData.positionIndex = -1;
    assert.throws(() => batches.rebuild([invalid.root]), /positionIndex/);
    assert.deepEqual(renderMeshes(batches), old);
});

function plantFactory() {
    const stemGeometry = new THREE.CylinderGeometry(.011, .018, .22, 10).translate(0, .11, 0);
    const completeStem = new THREE.CylinderGeometry(.011, .017, .18, 10).translate(0, .09, 0);
    const leafGeometry = new THREE.SphereGeometry(.1, 8, 5).scale(1, 1.3, .025);
    const materials = {
        pot: new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), roughness: .8 }),
        soil: new THREE.MeshStandardMaterial({ map: new THREE.Texture(), roughness: 1 }),
        stem: new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), roughness: .7 }),
        leaf: new THREE.MeshPhysicalMaterial({ map: new THREE.Texture(), roughness: .6 }),
        flower: new THREE.MeshPhysicalMaterial({ roughness: .55, vertexColors: true })
    };
    const prototypes = Array.from({ length: 5 }, (_, variant) => {
        const flower = new THREE.Group();
        for (let part = 0; part < 4; part++) {
            // Merged flower buffers deliberately have no primitive parameters.
            const geometry = new THREE.BufferGeometry().copy(new THREE.SphereGeometry(.01 + part * .002, 6, 4));
            geometry.translate(variant * .001, .01 + part * .02, 0);
            geometry.userData.shared = true;
            const mesh = new THREE.Mesh(geometry, materials.flower.clone());
            mesh.material.color.setHSL(variant / 5, .7, .6);
            flower.add(mesh);
        }
        return flower;
    });
    return (scene, slot, completed = false) => {
        const root = new THREE.Group();
        root.userData.positionIndex = slot;
        // app.js: twelve slots per bench pair, two bench pairs per batch chunk.
        root.position.set(slot % 12 < 6 ? -4 : 4, 1.05, -Math.floor(slot / 12) * 4 + (slot % 3) - 1);
        const pot = new THREE.Group();
        pot.scale.setScalar(.9 + (slot % 5) * .04);
        root.add(pot);
        for (const [geometry, material] of [
            [new THREE.CylinderGeometry(.155, .105, .2, 28, 1), materials.pot],
            [new THREE.TorusGeometry(.155, .012, 8, 28), materials.pot],
            [new THREE.SphereGeometry(.142, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.5), materials.soil]
        ]) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.material.color.setHSL(.07 + slot % 5 * .01, .3, .5);
            mesh.castShadow = mesh.receiveShadow = true;
            pot.add(mesh);
        }
        const stem = new THREE.Mesh(completed ? completeStem : stemGeometry, materials.stem.clone());
        stem.castShadow = true;
        stem.position.y = .2;
        stem.name = 'stem';
        root.add(stem);
        if (completed) {
            const flower = prototypes[slot % 5].clone(true);
            flower.position.y = .195;
            flower.scale.setScalar(1.7);
            stem.add(flower);
        } else {
            const material = materials.leaf.clone();
            material.color.setHSL(.22 + slot * .001, .6, .35);
            for (let i = 0; i < 9; i++) {
                const leaf = new THREE.Mesh(leafGeometry, material);
                leaf.position.y = .055 + i * .025;
                leaf.rotation.set(0, i * 2.4, .6);
                leaf.visible = i < 7;
                (i < 7 ? stem : root).add(leaf);
            }
        }
        scene.add(root);
        return root;
    };
}

test('120 mock growing plants need 25 chunk batches for 1,560 retained source meshes', t => {
    const { scene, batches } = fixture(t);
    const createPlant = plantFactory();
    const roots = Array.from({ length: 120 }, (_, slot) => createPlant(scene, slot));
    batches.rebuild(roots);
    const stats = batches.stats();
    assert.equal(stats.chunks, 5);
    assert.equal(stats.instances, 1560);
    assert.equal(stats.visibleInstances, 1320);
    assert.equal(stats.batches, 25);
    assert.equal(stats.drawCalls, 25);
    assert.equal(stats.materials, 4);
    assert.equal(stats.slotsPerChunk, 24);
    assert.ok(renderMeshes(batches).every(mesh => mesh.boundingSphere.radius < 12));
    assertBoundsContainVertices(batches);
    t.diagnostic(`120 growing mock plants: ${JSON.stringify(stats)}`);
});

test('120 mixed plants with all five cached flower prototypes stay within 130 chunk batches', t => {
    const { scene, batches } = fixture(t);
    const createPlant = plantFactory();
    const roots = Array.from({ length: 120 }, (_, slot) => createPlant(scene, slot, slot % 2 === 0));
    batches.rebuild(roots);
    const stats = batches.stats();
    assert.equal(stats.chunks, 5);
    assert.equal(stats.instances, 1260);
    assert.equal(stats.batches, 130);
    assert.equal(stats.drawCalls, 130);
    assert.equal(stats.materials, 5);
    // Position slots, not input ordering or the filtered root count, define chunks.
    batches.rebuild(roots.slice().reverse());
    assert.deepEqual(batches.stats(), stats);
    batches.rebuild(roots.filter(root => [0, 23, 24, 119].includes(root.userData.positionIndex)));
    assert.equal(batches.stats().chunks, 3);
    assertBoundsContainVertices(batches);
    t.diagnostic(`120 mixed mock plants: ${JSON.stringify(stats)}`);
});
