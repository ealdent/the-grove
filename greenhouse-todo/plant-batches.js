import * as THREE from 'three';

const SLOTS_PER_CHUNK = 24;
const WHITE = new THREE.Color(0xffffff);
const PRIMITIVES = new Set([
    'BoxGeometry', 'CapsuleGeometry', 'CircleGeometry', 'ConeGeometry',
    'CylinderGeometry', 'DodecahedronGeometry', 'IcosahedronGeometry',
    'OctahedronGeometry', 'PlaneGeometry', 'RingGeometry', 'SphereGeometry',
    'TetrahedronGeometry', 'TorusGeometry', 'TorusKnotGeometry'
]);
const MATERIAL_METADATA = new Set(['id', 'uuid', 'name', 'color', 'visible', 'version', 'userData', '_listeners']);

// Stock material settings, including map identity and every non-diffuse color.
// Never serialize texture images (or key a health-tinted clone by its UUID).
function settings(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value.isTexture) return { texture: value.uuid };
    if (typeof value.toArray === 'function') return value.toArray();
    if (Array.isArray(value)) return value.map(settings);
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, settings(value[key])]));
}

function materialKey(material) {
    if (!material?.color?.isColor || material.isShaderMaterial
        || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
        || material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) {
        throw new TypeError('PlantBatches requires a single stock color material per source Mesh.');
    }
    return JSON.stringify(Object.fromEntries(Object.keys(material).sort()
        .filter(key => !MATERIAL_METADATA.has(key))
        .map(key => [key, settings(material[key])])));
}

function sameAttribute(a, b) {
    if (a === b) return true;
    if (!a || !b || !a.array || !b.array || a.isInterleavedBufferAttribute || b.isInterleavedBufferAttribute
        || a.itemSize !== b.itemSize || a.normalized !== b.normalized || a.gpuType !== b.gpuType
        || a.array.constructor !== b.array.constructor || a.array.length !== b.array.length) return false;
    for (let i = 0; i < a.array.length; i++) if (a.array[i] !== b.array[i]) return false;
    return true;
}

function samePrimitive(a, b) {
    const names = Object.keys(a.attributes).sort();
    if (JSON.stringify(names) !== JSON.stringify(Object.keys(b.attributes).sort())
        || !sameAttribute(a.index, b.index)
        || a.drawRange.start !== b.drawRange.start || a.drawRange.count !== b.drawRange.count
        || JSON.stringify(a.groups) !== JSON.stringify(b.groups)) return false;
    return names.every(name => sameAttribute(a.attributes[name], b.attributes[name]));
}

function geometryResolver() {
    const known = new WeakMap();
    const primitives = new Map();
    return geometry => {
        if (known.has(geometry)) return known.get(geometry);
        let key = `uuid:${geometry.uuid}`;
        const explicit = geometry.userData.batchKey;
        if (typeof explicit === 'string' || typeof explicit === 'number') {
            // An explicit key is the caller's promise of identical buffers,
            // including all baked transforms, vertex colors and draw ranges.
            key = `explicit:${typeof explicit}:${explicit}`;
        } else if (PRIMITIVES.has(geometry.type) && geometry.parameters) {
            const parameterKey = `${geometry.type}:${JSON.stringify(settings(geometry.parameters))}`;
            const candidates = primitives.get(parameterKey) || [];
            const matching = candidates.find(candidate => samePrimitive(candidate, geometry));
            if (matching) key = `uuid:${matching.uuid}`;
            else candidates.push(geometry);
            primitives.set(parameterKey, candidates);
        }
        known.set(geometry, key);
        return key;
    };
}

function isVisible(source, root) {
    if (!source.material.visible) return false;
    // root.visible belongs to this renderer; child and intermediate visibility
    // still belong to app.js (dropped leaves, hidden flower groups, etc.).
    for (let node = source; node && node !== root; node = node.parent) {
        if (!node.visible) return false;
    }
    return true;
}

function markRange(attribute, offset, count) {
    // Keep one bounded pending span, even when an offscreen chunk is synced
    // repeatedly before the renderer uploads it. Never clear another root's work.
    const range = attribute.updateRanges[0];
    if (range) {
        const end = Math.max(range.start + range.count, offset + count);
        range.start = Math.min(range.start, offset);
        range.count = end - range.start;
    } else attribute.addUpdateRange(offset, count);
    attribute.needsUpdate = true;
}

/**
 * Render createPlant's retained task roots as spatially grouped instances.
 *
 *   const plants = new PlantBatches(scene);
 *   plants.rebuild(objects);    // after add/remove/completion/prototype changes
 *   plants.sync(todo.mesh);    // after that root's wilt/growth/rattle/color change
 *   plants.stats();            // CPU inventory, not measured renderer timings
 *   plants.dispose();
 *
 * Roots stay in their original hierarchy and become invisible to the renderer.
 * Raycast the retained child meshes explicitly; filter hidden leaves in the UI.
 * The source owner must keep cached geometries/textures alive (and skip geometry
 * disposal for userData.shared). Only instance buffers and cloned materials are
 * owned here. Mark identical custom geometry with geometry.userData.batchKey,
 * or reuse the actual geometry object; geometry buffers are immutable between
 * rebuilds. Unkeyed primitives are merged only after checking their full buffers.
 *
 * sync changes transforms, effective visibility and diffuse instance colors.
 * Rebuild for hierarchy/slot/geometry/non-color material or render-flag changes.
 * Call sync for every affected root if a shared ancestor/material changes.
 * Stock single-material static Mesh geometry is supported; no skinned, morph,
 * nested InstancedMesh, custom shader, or per-mesh shader/shadow callbacks.
 * Positive scales are expected. Three's stock instanced normal approximation
 * can differ under sheared transforms; vertex positions remain exact.
 *
 * Draw estimates exclude frustum culling, shadows, AO and other render passes.
 * Instancing does not reduce triangle/fragment work. Bounds grow on sync and
 * tighten on rebuild; moving roots between chunks requires a rebuild. Material
 * variants are retained until dispose, so use a finite shared texture palette.
 */
export class PlantBatches {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'Task plant batches';
        this.group.matrixAutoUpdate = false;
        scene.add(this.group);
        this._roots = new Map();
        this._batches = [];
        this._materials = new Map();
        this._sceneInverse = new THREE.Matrix4();
        this._matrix = new THREE.Matrix4();
        this._sphere = new THREE.Sphere();
        this._disposed = false;
    }

    rebuild(roots) {
        if (this._disposed) throw new Error('PlantBatches has been disposed.');
        const nextRoots = new Map();
        const batches = new Map();
        const resolveGeometry = geometryResolver();
        const materialKeys = new WeakMap();

        // Gather and validate before removing the current render representation.
        for (const root of roots) {
            if (nextRoots.has(root)) continue;
            const slot = root.userData.positionIndex;
            if (!Number.isInteger(slot) || slot < 0) {
                throw new TypeError('PlantBatches roots need a nonnegative integer userData.positionIndex.');
            }
            const chunk = Math.floor(slot / SLOTS_PER_CHUNK);
            const record = { root, visible: this._roots.get(root)?.visible ?? root.visible, entries: [] };
            nextRoots.set(root, record);
            root.traverse(source => {
                if (!source.isMesh) return;
                if (source.isInstancedMesh || source.isSkinnedMesh
                    || Object.keys(source.geometry.morphAttributes).length
                    || source.customDepthMaterial || source.customDistanceMaterial
                    || source.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) {
                    throw new TypeError('PlantBatches requires static Mesh geometry without custom render callbacks.');
                }
                let matKey = materialKeys.get(source.material);
                if (!matKey) {
                    matKey = materialKey(source.material);
                    materialKeys.set(source.material, matKey);
                }
                const key = JSON.stringify([chunk, resolveGeometry(source.geometry), matKey,
                    source.castShadow, source.receiveShadow, source.renderOrder, source.layers.mask]);
                let batch = batches.get(key);
                if (!batch) {
                    batch = { chunk, source, matKey, entries: [], visibleCount: 0, mesh: null };
                    batches.set(key, batch);
                }
                const entry = { source, batch, index: batch.entries.length, visible: false };
                batch.entries.push(entry);
                record.entries.push(entry);
            });
        }

        this._clearBatches();
        for (const [root, record] of this._roots) {
            if (!nextRoots.has(root)) root.visible = record.visible;
        }
        this._roots = nextRoots;
        this._batches = [...batches.values()];
        for (const batch of this._batches) {
            const { source, matKey, entries } = batch;
            let material = this._materials.get(matKey);
            if (!material) {
                material = source.material.clone();
                material.color.copy(WHITE);
                material.visible = true;
                if (source.material.defines) material.defines = { ...source.material.defines };
                this._materials.set(matKey, material);
            }
            const mesh = new THREE.InstancedMesh(source.geometry, material, entries.length);
            mesh.name = `Task plants / slots ${batch.chunk * SLOTS_PER_CHUNK}-${(batch.chunk + 1) * SLOTS_PER_CHUNK - 1}`;
            mesh.userData.plantBatchChunk = batch.chunk;
            mesh.castShadow = source.castShadow;
            mesh.receiveShadow = source.receiveShadow;
            mesh.renderOrder = source.renderOrder;
            mesh.layers.mask = source.layers.mask;
            mesh.visible = false;
            mesh.matrixAutoUpdate = false;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(entries.length * 3), 3);
            mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
            mesh.boundingSphere = new THREE.Sphere().makeEmpty();
            // Picking stays on the original task meshes, never duplicate instances.
            mesh.raycast = () => {};
            batch.mesh = mesh;
            this.group.add(mesh);
        }
        for (const [root] of this._roots) {
            root.visible = false;
            this.sync(root);
        }
        for (const batch of this._batches) {
            batch.mesh.computeBoundingSphere();
            // Three's max-axis bound can underestimate nested nonuniform-scale
            // shear. Enclose each instance with a conservative matrix-norm bound.
            for (const entry of batch.entries) {
                if (!entry.visible) continue;
                batch.mesh.getMatrixAt(entry.index, this._matrix);
                this._expandBounds(batch.mesh);
            }
        }
        return this;
    }

    /** Returns false for an unknown/removed root (including after dispose). */
    sync(root) {
        const record = this._roots.get(root);
        if (!record) return false;
        root.visible = false;
        root.updateWorldMatrix(true, true);
        this.scene.updateWorldMatrix(true, false);
        this._sceneInverse.copy(this.scene.matrixWorld).invert();
        for (const entry of record.entries) {
            const { source, batch, index } = entry;
            const mesh = batch.mesh;
            const visible = isVisible(source, root);
            if (visible !== entry.visible) {
                batch.visibleCount += visible ? 1 : -1;
                entry.visible = visible;
                mesh.visible = batch.visibleCount > 0;
            }
            this._matrix.multiplyMatrices(this._sceneInverse, source.matrixWorld);
            if (!visible) {
                // Collapse in place, not at world zero (which ruins chunk bounds).
                const e = this._matrix.elements;
                for (let i = 0; i < 12; i++) e[i] = 0;
            }
            const matrixOffset = index * 16;
            const changed = this._matrix.elements.some((value, i) =>
                Math.fround(value) !== mesh.instanceMatrix.array[matrixOffset + i]);
            if (changed) {
                mesh.setMatrixAt(index, this._matrix);
                markRange(mesh.instanceMatrix, matrixOffset, 16);
                if (visible) {
                    // Bound the uploaded Float32 values, not just their doubles.
                    mesh.getMatrixAt(index, this._matrix);
                    this._expandBounds(mesh);
                }
            }
            const color = source.material.color;
            const colorOffset = index * 3;
            const colors = mesh.instanceColor.array;
            if (colors[colorOffset] !== Math.fround(color.r)
                || colors[colorOffset + 1] !== Math.fround(color.g)
                || colors[colorOffset + 2] !== Math.fround(color.b)) {
                // THREE.Color components are already in the linear working space.
                mesh.setColorAt(index, color);
                markRange(mesh.instanceColor, colorOffset, 3);
            }
        }
        return true;
    }

    _expandBounds(mesh) {
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        this._sphere.copy(mesh.geometry.boundingSphere);
        this._sphere.center.applyMatrix4(this._matrix);
        const e = this._matrix.elements;
        // Frobenius norm bounds the largest singular value, including shear.
        const norm = Math.hypot(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]);
        const material = mesh.material;
        const displacement = material.displacementMap
            ? Math.abs(material.displacementScale) + Math.abs(material.displacementBias) : 0;
        this._sphere.radius = (this._sphere.radius + displacement) * norm;
        mesh.boundingSphere.union(this._sphere);
    }

    _clearBatches() {
        for (const { mesh } of this._batches) {
            mesh.removeFromParent();
            mesh.dispose(); // Instance buffers only; geometry/material are shared.
        }
        this._batches = [];
    }

    stats() {
        let instances = 0, visibleInstances = 0, drawCalls = 0;
        for (const { mesh, entries, visibleCount } of this._batches) {
            instances += entries.length;
            visibleInstances += visibleCount;
            if (visibleCount) {
                drawCalls += mesh.material.transparent && mesh.material.side === THREE.DoubleSide
                    && !mesh.material.forceSinglePass ? 2 : 1;
            }
        }
        return {
            roots: this._roots.size,
            chunks: new Set(this._batches.map(batch => batch.chunk)).size,
            slotsPerChunk: SLOTS_PER_CHUNK,
            batches: this._batches.length,
            instances, visibleInstances, drawCalls,
            materials: this._materials.size,
            activeMaterials: new Set(this._batches.map(batch => batch.mesh.material)).size
        };
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        this._clearBatches();
        for (const [root, record] of this._roots) root.visible = record.visible;
        this._roots.clear();
        for (const material of this._materials.values()) material.dispose();
        this._materials.clear();
        this.group.removeFromParent();
    }
}
