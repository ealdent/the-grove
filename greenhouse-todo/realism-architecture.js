import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createScannedWoodMaterial } from './realism-materials.js';

// Planar metre-scale projection for the thin rectangular glazing bars. A UV
// square stretched over a 50 m rail would turn small corrosion into long stripes.
export function metalUV(geometry) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const axis = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
        const face = axis.indexOf(Math.max(...axis));
        const coords = [p.getX(i), p.getY(i), p.getZ(i)];
        const [u, v] = [0, 1, 2].filter(a => a !== face);
        uv.setXY(i, coords[u] / 1.3 + .37, coords[v] / 1.3 + .63);
    }
    uv.needsUpdate = true;
    return geometry;
}

// Select the interior of a single photographed board. Mapping a full sheet of
// planks onto a chair leg paints false joints across the leg every few cm.
export function timberUV(geometry, board = 0, grain) {
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const center = geometry.boundingBox.getCenter(new THREE.Vector3()).toArray();
    const extents = size.toArray();
    const along = { x: 0, y: 1, z: 2 }[grain] ??
        (size.y > size.x && size.y > size.z ? 1 : size.x > size.z ? 0 : 2);
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    const starts = [0.183, 0.302, 0.414, 0.528, 0.64, 0.75, 0.865];
    // Box faces have separate vertices and groups (+X, -X, +Y, -Y, +Z, -Z).
    // Keep one projection across each face's bevels: vertex-normal ties at the
    // rounded corners otherwise switch axes inside a triangle and smear grain.
    const faces = new Int8Array(p.count).fill(-1);
    if (geometry.type === 'BoxGeometry' || geometry.type === 'RoundedBoxGeometry') {
        for (const group of geometry.groups) {
            for (let i = group.start; i < group.start + group.count; i++) {
                faces[geometry.index ? geometry.index.getX(i) : i] = Math.floor(group.materialIndex / 2);
            }
        }
    }
    for (let i = 0; i < p.count; i++) {
        const coords = [p.getX(i) - center[0], p.getY(i) - center[1], p.getZ(i) - center[2]];
        const norms = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))];
        const face = faces[i] >= 0 ? faces[i] : norms.indexOf(Math.max(...norms));
        const across = [0, 1, 2].filter(axis => axis !== face);
        // V follows the photographed grain. On an end face, the length axis is
        // constant; use its wider in-plane axis instead of collapsing V to a row.
        // This is a small patch of the real scan, not a fabricated endgrain map.
        const vAxis = face === along ? (extents[across[0]] > extents[across[1]] ? across[0] : across[1]) : along;
        const uAxis = across.find(axis => axis !== vAxis);
        // Preserve two-metre scan scale on narrow rails/edges; only wider faces
        // compress U enough to remain within the same photographed board.
        const uScale = Math.min(0.5, 0.085 / Math.max(extents[uAxis], 0.001));
        uv.setXY(i, starts[board % starts.length] + 0.0425 + coords[uAxis] * uScale,
            coords[vAxis] / 2 + 0.5);
    }
    uv.needsUpdate = true;
    return geometry;
}

// Small edge radii catch highlights; actual gaps and apron joinery carry depth
// at oblique views. Texture UVs are metres / a two-metre scanned tile.
export function buildPottingBenches(scene, renderer) {
    const timber = createScannedWoodMaterial(renderer);
    const pieces = [];
    function piece(w, h, d, x, y, z, grain = 'z') {
        const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.009, h / 5));
        timberUV(g, pieces.length, grain);
        g.translate(x, y, z);
        pieces.push(g);
    }
    // Seven individual 28 cm boards, 5 mm expansion gaps.
    for (let k = 0; k < 7; k++) piece(0.281, 0.10, 3, -0.857 + k * 0.286, 1, 0);
    for (const x of [-0.89, 0.89]) {
        for (const z of [-1.36, 1.36]) piece(0.11, 0.95, 0.11, x, 0.475, z, 'y');
        piece(0.08, 0.16, 2.83, x, 0.84, 0);
        piece(0.075, 0.09, 2.83, x, 0.27, 0);
    }
    for (const z of [-1.36, 1.36]) piece(1.78, 0.16, 0.07, 0, 0.84, z, 'x');
    const geometry = mergeGeometries(pieces);
    pieces.forEach(g => g.dispose());
    const mesh = new THREE.InstancedMesh(geometry, timber, 20);
    mesh.name = 'Solid timber potting benches';
    mesh.castShadow = mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), tint = new THREE.Color();
    for (let i = 0; i < 20; i++) {
        mesh.setMatrixAt(i, m.makeTranslation(i % 2 ? 3 : -3, 0, -Math.floor(i / 2) * 4));
        const shade = 0.90 + ((i * 17) % 11) / 100;
        mesh.setColorAt(i, tint.setRGB(shade, shade * 0.986, shade * 0.96));
    }
    scene.add(mesh);

    // Dark countersunk screws are actual small metal heads, 4 per board.
    const metal = new THREE.MeshStandardMaterial({ color: 0x6c6960, metalness: 0.78, roughness: 0.55 });
    const screws = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.0015, 7), metal, 560);
    screws.name = 'Bench fasteners';
    let j = 0;
    for (let t = 0; t < 20; t++) for (let k = 0; k < 7; k++) {
        for (const dx of [-0.07, 0.07]) for (const z of [-1.33, 1.33]) {
            screws.setMatrixAt(j++, m.makeTranslation((t % 2 ? 3 : -3) - 0.857 + k * 0.286 + dx,
                1.0508, -Math.floor(t / 2) * 4 + z));
        }
    }
    scene.add(screws);
}

// Thin glazing has negligible image displacement at this room scale. Schlick
// reflectance composites the reflection over the view without another full
// scene transmission render. This is a raster approximation, not ray tracing.
export function createThinGlazing(roof = false) {
    const mat = new THREE.MeshStandardMaterial({
        color: roof ? 0xd2dfd4 : 0xe2e9df, metalness: 1,
        roughness: roof ? 0.19 : 0.11, envMapIntensity: 0.75,
        transparent: true, depthWrite: false, side: THREE.FrontSide,
    });
    mat.name = roof ? 'Weathered roof glazing' : 'Thin horticultural glazing';
    mat.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
            #include <normal_fragment_maps>
            float cosView = abs(dot(normal, normalize(vViewPosition)));
            float fresnel = 0.04 + 0.96 * pow(1.0 - cosView, 5.0);
            diffuseColor.a = clamp(fresnel + ${roof ? '0.025' : '0.012'}, 0.0, 0.72);
        `);
    };
    mat.customProgramCacheKey = () => `thin-glazing-${roof}`;
    mat.userData.dayTint = mat.color.clone();
    mat.userData.dayRoughness = mat.roughness;
    mat.userData.nightRoughness = mat.roughness;
    return mat;
}

// Merge static structural members once, retaining lights and animated details.
// Material, shadow flags and attribute layouts remain separate batches.
export function mergeStaticArchitecture(group) {
    group.updateMatrixWorld(true);
    const buckets = new Map();
    group.traverse(mesh => {
        if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.detail || mesh.material.transparent
            || Array.isArray(mesh.material) || mesh.material.isShaderMaterial) return;
        const key = [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
            Object.keys(mesh.geometry.attributes).sort().join(',')].join('/');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(mesh);
    });
    const inverse = group.matrixWorld.clone().invert();
    for (const meshes of buckets.values()) {
        if (meshes.length < 2) continue;
        const copies = meshes.map(mesh => {
            const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            return g.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        });
        const geometry = mergeGeometries(copies);
        copies.forEach(g => g.dispose());
        if (!geometry) continue;
        const merged = new THREE.Mesh(geometry, meshes[0].material);
        merged.name = 'Batched greenhouse joinery';
        merged.castShadow = meshes[0].castShadow;
        merged.receiveShadow = meshes[0].receiveShadow;
        meshes.forEach(mesh => mesh.removeFromParent());
        group.add(merged);
    }
}
