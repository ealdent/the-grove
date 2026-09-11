import * as THREE from 'three';

// Original CC0 photographs/scans, vendored unchanged. See assets/MATERIALS.md
// and assets/materials/planter_pot_clay/README.md for the pot/soil additions.
const DEFINITIONS = {
    wood: { asset: 'weathered_planks', resolution: '2k', fallback: 0x827467, normalScale: 0.5, tileMeters: 2 },
    ground: { asset: 'brown_mud_02', fallback: 0x4d4437, tint: 0xb7a889, normalScale: 0.65, tileMeters: 1.3 },
    pot: {
        asset: 'planter_pot_clay', fallback: 0xa56d51, normalScale: 0.35,
        // A model atlas, not a square tile. Use only the red exterior-wall strip.
        tileMeters: null, offset: [0, 0.015], clampV: true, uniformRoughness: 0.9,
    },
    soil: {
        asset: 'brown_mud_02', fallback: 0x30251c, tint: 0x59442e, normalScale: 0.8,
        tileMeters: 1.3, detailTileMeters: 0.25, offset: [-0.3, -0.3],
    },
    metal: {
        asset: 'rusty_metal_05', fallback: 0x57574d, normalScale: .22, tileMeters: 1.3,
        metalness: 1,
        channels: { map: 'diff', normalMap: 'nor_gl', roughnessMap: 'arm', metalnessMap: 'arm' },
    },
};
const CHANNELS = { map: 'diff', normalMap: 'nor_gl', roughnessMap: 'rough' };
const loader = new THREE.TextureLoader();
const sources = new Map();
const pendingMaterials = new Set();
// Allow the 2K maps to finish alongside the 29.8 MB environment on slower links.
const LOAD_TIMEOUT_MS = 90000;

function loadSource(asset, channel, resolution = '1k') {
    const url = new URL(`./assets/materials/${asset}/${asset}_${channel}_${resolution}.jpg`, import.meta.url).href;
    if (sources.has(url)) return sources.get(url).promise;

    const record = { url, status: 'loading', error: null, promise: null };
    sources.set(url, record);
    record.promise = new Promise(resolve => {
        let settled = false;
        let texture;
        const finish = (loaded, error = null) => {
            if (settled) {
                // ImageLoader cannot abort an in-flight request after our timeout.
                if (loaded) loaded.dispose();
                return;
            }
            settled = true;
            clearTimeout(timer);
            record.status = loaded ? 'loaded' : 'failed';
            record.error = error;
            if (!loaded) texture?.dispose();
            resolve(loaded);
        };
        const timer = setTimeout(() => finish(null, 'Texture load exceeded 90 seconds'), LOAD_TIMEOUT_MS);
        try {
            texture = loader.load(url, loaded => finish(loaded), undefined,
                () => finish(null, 'Texture could not be loaded or decoded'));
        } catch (error) {
            finish(null, error.message);
        }
    });
    return record.promise;
}

function createMaterial(kind, renderer, repeat) {
    if (!Array.isArray(repeat) || repeat.length !== 2 ||
        !repeat.every(value => Number.isFinite(value) && value > 0)) {
        throw new TypeError('Texture repeat must be two finite positive numbers');
    }
    // Copy now: callers may reuse or mutate their input array while loading.
    const uvRepeat = [...repeat];
    const definition = DEFINITIONS[kind];
    const maximum = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
    const anisotropy = Number.isFinite(maximum) ? Math.max(1, Math.min(8, maximum)) : 1;
    const material = new THREE.MeshStandardMaterial({
        color: definition.fallback,
        roughness: definition.uniformRoughness ?? 0.95,
        metalness: definition.metalness ?? 0,
        normalScale: new THREE.Vector2(definition.normalScale, definition.normalScale),
    });
    material.name = `Scanned ${definition.asset}`;
    const state = material.userData.scannedMaterial = {
        asset: definition.asset, status: 'loading', sourceTileMeters: definition.tileMeters,
    };
    if (definition.detailTileMeters) state.detailTileMeters = definition.detailTileMeters;
    let disposed = false;
    const ownedTextures = [];
    material.addEventListener('dispose', () => {
        disposed = true;
        state.status = 'disposed';
        for (const texture of ownedTextures) texture.dispose();
        ownedTextures.length = 0;
    });

    // Uniform matte clay keeps the stock shader compatible with PlantBatches.
    const channels = Object.entries(definition.channels ?? CHANNELS).filter(([slot]) =>
        slot !== 'roughnessMap' || definition.uniformRoughness === undefined);
    const ready = Promise.all(channels.map(([, channel]) => loadSource(definition.asset, channel, definition.resolution)))
        .then(loaded => {
            if (disposed) return;
            // Keep the complete neutral fallback if any map fails. Never bind an
            // undecoded texture or leave a half-loaded normal/roughness set.
            if (loaded.some(texture => texture === null)) {
                state.status = 'fallback';
                return;
            }
            channels.forEach(([slot], index) => {
                // Texture.clone shares THREE.Source (decoded image/GPU storage)
                // but owns UV transforms, so repeats cannot leak between meshes.
                const texture = loaded[index].clone();
                texture.name = `${definition.asset}:${slot}`;
                texture.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                if (definition.clampV) texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.repeat.set(...uvRepeat);
                if (definition.offset) texture.offset.set(...definition.offset);
                texture.anisotropy = anisotropy;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                texture.needsUpdate = true;
                material[slot] = texture;
                ownedTextures.push(texture);
            });
            // Clay/wood preserve captured albedo. Earth is adapted toward damp,
            // organic potting mix; the unmodified scan is dry pale mud.
            material.color.setHex(definition.tint ?? 0xffffff);
            material.roughness = definition.uniformRoughness ?? 1;
            material.needsUpdate = true;
            state.status = 'ready';
        });
    pendingMaterials.add(ready);
    void ready.finally(() => pendingMaterials.delete(ready));
    return material;
}

/** Immediate MeshStandardMaterial; repeat describes tiling across the mesh UVs.
 * A tile spans 2 m: use [1, 1.5] for a 2 x 3 m potting-bench top. */
export function createScannedWoodMaterial(renderer, repeat = [1, 1]) {
    return createMaterial('wood', renderer, repeat);
}

/** Weathered steel: ARM green is roughness, blue is metallic coverage.
 * Geometry UVs use physical metres divided by the scan's 1.3 m width. */
export function createScannedMetalMaterial(renderer) {
    return createMaterial('metal', renderer, [1, 1]);
}

/** Immediate soil material for the existing 200 x 200 m floor (1.3 m tiles).
 * For other dimensions, scale geometry UVs or adjust all three map repeats
 * after texturesReady(). See assets/MATERIALS.md. */
export function createScannedGroundMaterial(renderer) {
    const repeat = 200 / DEFINITIONS.ground.tileMeters;
    return createMaterial('ground', renderer, [repeat, repeat]);
}

/** Photographed terracotta for normalized tapered-cylinder side UVs.
 * One full U wrap, inset V to the atlas's red exterior wall (no cap UV islands).
 * Stock material with uniform roughness 0.9; only albedo and normal are loaded.
 * Reuse across pots/rims; do not multiply the V repeat as if this were a tile. */
export function createScannedPotMaterial(renderer) {
    return createMaterial('pot', renderer, [1, 0.30]);
}

/** Brown Mud scan scaled to a 0.25 m detail patch on a 0.4 m diameter disc.
 * CircleGeometry's planar 0..1 UVs use 1.6 repeats, centered on the scan.
 * Shares the floor's decoded source images but owns all texture transforms. */
export function createScannedSoilMaterial(renderer) {
    const repeat = 0.4 / DEFINITIONS.soil.detailTileMeters;
    return createMaterial('soil', renderer, [repeat, repeat]);
}

/** Wait for factories already called (including work added while waiting).
 * Does not start loading unused assets. Expected image failures resolve in
 * `failed`; their materials keep a matte fallback. Call again after creating
 * additional materials. This waits for loading/binding, not GPU compilation. */
export async function texturesReady() {
    while (pendingMaterials.size) await Promise.all([...pendingMaterials]);
    return {
        loaded: [...sources.values()].filter(record => record.status === 'loaded').map(record => record.url),
        failed: [...sources.values()].filter(record => record.status === 'failed')
            .map(record => ({ url: record.url, reason: record.error })),
    };
}
