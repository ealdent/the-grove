import * as THREE from 'three';

/**
 * Static closed flower heads, in metres; +Y grows from the stem attachment.
 * createFlowerPrototype(index) returns a NEW Group sharing cached geometry and
 * materials. Use directly at stemHeight + .015, scale 1.7, or clone again.
 * Indices match app.js: daisy, sunflower, rose, tulip, hydrangea (0..4, wrapped).
 * All children are stock opaque Mesh objects, ready for PlantBatches. Geometry
 * and materials have userData.shared=true and must not be mutated per plant.
 * No external assets, shader hooks, alpha cutouts, animation or per-frame work.
 * Heads stay below 10k triangles with three beauty draws. The neutral tissue
 * atlas is generated synchronously once and shared by all species and clones.
 *
 * Original procedural interpretation, informed by NC State Extension morphology:
 * https://plants.ces.ncsu.edu/plants/leucanthemum-x-superbum/
 * https://plants.ces.ncsu.edu/plants/helianthus-annuus/
 * https://plants.ces.ncsu.edu/plants/rosa/
 * https://plants.ces.ncsu.edu/plants/tulipa/
 * https://plants.ces.ncsu.edu/plants/hydrangea-macrophylla/
 * References are not embedded textures. These are restrained cultivated forms,
 * not exact cultivar scans or a claim of physically complete petal scattering.
 */

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Matrix4();
const SPECIES = ['daisy', 'sunflower', 'rose', 'tulip', 'hydrangea'];
const cache = new Map();
let materials = null;

function randomSource(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let n = Math.imul(state ^ (state >>> 15), state | 1);
        n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
        return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
}

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const color = hex => new THREE.Color(hex);

function tissueNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const hash = (a, b) => {
        let n = Math.imul(a, 374761393) + Math.imul(b, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), sx),
        lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}

function tissueMaps() {
    const width = 512, height = 512, tileSize = 256;
    const channels = { map: new Uint8Array(width * height * 4),
        bumpMap: new Uint8Array(width * height * 4), roughnessMap: new Uint8Array(width * height * 4) };
    const byte = value => Math.round(clamp(value, 0, 1) * 255);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const tile = Math.floor(x / tileSize) + 2 * Math.floor(y / tileSize);
        // Four opaque surface samples with replicated gutters. UVs stay inside
        // each gutter, keeping all three maps aligned through mip filtering.
        const u = clamp((x % tileSize - 4) / 247, 0, 1);
        const v = clamp((y % tileSize - 4) / 247, 0, 1);
        const phase = tile * 2.71;
        let veins = 0, branches = 0;
        for (let vein = -4; vein <= 4; vein++) {
            const spread = .25 + .75 * (1 - Math.exp(-v * 4));
            const center = .5 + vein * .104 * spread
                + .008 * Math.sin(v * 8 + phase + vein * .7) * Math.sin(Math.PI * v);
            const veinWidth = .0026 + .0013 * (1 - v);
            veins = Math.max(veins, Math.exp(-Math.pow((u - center) / veinWidth, 2)));
            // Rose/hydrangea tiles have an asymmetric secondary vascular net;
            // tulip/ray tiles retain finer longitudinal branching.
            for (let j = 0; j < (tile > 1 ? 3 : 1); j++) {
                const start = .17 + j * .24 + .05 * Math.sin(vein * 2 + phase);
                const along = v - start;
                if (along < 0 || along > .21) continue;
                const split = center + (vein % 2 ? 1 : -1) * along * .27;
                branches = Math.max(branches, Math.exp(-Math.pow((u - split) / .0021, 2))
                    * Math.sin(Math.PI * along / .21));
            }
        }
        const broad = tissueNoise(u * 5 + phase, v * 8 + 17) - .5;
        const mottling = tissueNoise(u * 23 + 7, v * 31 + phase) - .5;
        const grain = tissueNoise(u * 131 + phase, v * 193 + 31) - .5;
        // Neutral reflectance only: no highlights, occlusion, shadows or color
        // baked into the atlas. Species pigmentation remains in vertex colors.
        const samples = {
            map: .935 + broad * .085 + mottling * .055 + grain * .016 - veins * .021,
            bumpMap: .48 + veins * .14 + branches * .06 + mottling * .025 + grain * .055,
            roughnessMap: .61 + broad * .07 + mottling * .065 + grain * .023 - veins * .033
        };
        const i = (y * width + x) * 4;
        for (const [key, data] of Object.entries(channels)) {
            data[i] = data[i + 1] = data[i + 2] = byte(samples[key]);
            data[i + 3] = 255;
        }
    }
    return Object.fromEntries(Object.entries(channels).map(([key, data]) => {
        const texture = new THREE.DataTexture(data, width, height);
        texture.name = `Flower tissue atlas / ${key}`;
        texture.colorSpace = key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        texture.userData.shared = true;
        return [key, texture];
    }));
}

function sharedMaterials() {
    if (materials) return materials;
    const make = (name, roughness) => {
        const material = new THREE.MeshStandardMaterial({
            name, color: 0xffffff, vertexColors: true, roughness,
            metalness: 0, emissive: 0x000000, envMapIntensity: .65,
            side: THREE.FrontSide, transparent: false, alphaTest: 0
        });
        material.userData.shared = true;
        return material;
    };
    materials = {
        petals: make('Living petal tissue', .63),
        reproductive: make('Florets, filaments and pollen', .81),
        support: make('Calyx and branching pedicels', .83)
    };
    Object.assign(materials.petals, tissueMaps());
    materials.petals.roughness = 1; // Atlas carries the .53-.70 cuticle variation.
    materials.petals.bumpScale = .00022; // Vein map range gives ~30 micrometres of relief.
    return materials;
}

// Merge completed components while preserving their independent surface normals.
// Part ranges make CPU closure/winding tests possible even where petals overlap.
class Batch {
    positions = [];
    normals = [];
    colors = [];
    uvs = [];
    indices = [];
    parts = [];

    add(name, positions, indices, colors, uvs, matrix = IDENTITY, surfaceNormals = null) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        if (surfaceNormals) geometry.attributes.normal.array.set(surfaceNormals);
        geometry.applyMatrix4(matrix);
        // A sharply turning rim can put a smooth tangent behind one of its
        // triangles. Split only those shading corners, retaining the same
        // physical positions/triangles and smooth normals everywhere else.
        const data = Object.fromEntries(Object.entries(geometry.attributes)
            .map(([key, attribute]) => [key, Array.from(attribute.array)]));
        const faceIndices = Array.from(geometry.index.array);
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        let normalSplits = 0;
        for (let face = 0; face < faceIndices.length; face += 3) {
            a.fromArray(data.position, faceIndices[face] * 3);
            b.fromArray(data.position, faceIndices[face + 1] * 3).sub(a);
            c.fromArray(data.position, faceIndices[face + 2] * 3).sub(a);
            b.cross(c).normalize();
            for (let corner = 0; corner < 3; corner++) {
                const id = faceIndices[face + corner];
                n.fromArray(data.normal, id * 3);
                if (n.dot(b) >= .05) continue;
                const split = data.position.length / 3;
                for (const key of ['position', 'color', 'uv']) {
                    const size = key === 'uv' ? 2 : 3;
                    data[key].push(...data[key].slice(id * size, (id + 1) * size));
                }
                data.normal.push(b.x, b.y, b.z);
                faceIndices[face + corner] = split;
                normalSplits++;
            }
        }
        if (normalSplits) {
            for (const [key, values] of Object.entries(data)) {
                geometry.setAttribute(key, new THREE.Float32BufferAttribute(values, key === 'uv' ? 2 : 3));
            }
            geometry.setIndex(faceIndices);
        }
        const first = this.positions.length / 3;
        this.parts.push({ name, vertexStart: first, vertexCount: geometry.attributes.position.count,
            indexStart: this.indices.length, indexCount: indices.length, normalSplits });
        for (const v of geometry.attributes.position.array) this.positions.push(v);
        for (const v of geometry.attributes.normal.array) this.normals.push(v);
        for (const v of geometry.attributes.color.array) this.colors.push(v);
        for (const v of geometry.attributes.uv.array) this.uvs.push(v);
        for (const v of geometry.index.array) this.indices.push(first + v);
        geometry.dispose();
    }

    mesh(name, material, tilt) {
        if (!this.indices.length) return null;
        const geometry = new THREE.BufferGeometry();
        geometry.name = name;
        for (const [key, values, size] of [
            ['position', this.positions, 3], ['normal', this.normals, 3],
            ['color', this.colors, 3], ['uv', this.uvs, 2]
        ]) geometry.setAttribute(key, new THREE.Float32BufferAttribute(values, size));
        geometry.setIndex(this.indices);
        geometry.applyMatrix4(tilt);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        geometry.userData.shared = true;
        geometry.userData.parts = this.parts;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        return mesh;
    }
}

/**
 * A physical shell around a curved parametric sheet. Front/back use the SAME
 * diagonals and independent normals; the entire perimeter has closed sidewalls.
 * Rounded ends have real width and area, unlike collapsed pointed leaf fans.
 * Triangle count is 4*rows*columns + 4*(rows+columns).
 */
function petal(batch, name, surface, shade, rows, columns, thickness, matrix = IDENTITY) {
    const positions = [], indices = [], colors = [], uvs = [], surfaceNormals = [];
    const count = (rows + 1) * (columns + 1);
    const epsilon = .0001;
    const tile = (name === 'tulip tepal' || name === 'ray floret' ? 0 : 2) + batch.parts.length % 2;
    for (const side of [1, -1]) {
        for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
            // Cosine spacing spends samples near rims and attachment curvature.
            const t = .5 - .5 * Math.cos(Math.PI * y / rows);
            const u = .5 - .5 * Math.cos(Math.PI * x / columns);
            const across = surface(t, Math.min(1, u + epsilon)).sub(surface(t, Math.max(0, u - epsilon)));
            const along = surface(Math.min(1, t + epsilon), u).sub(surface(Math.max(0, t - epsilon), u));
            const normal = across.cross(along).normalize();
            const tissueThickness = thickness * (.25 + .75 * Math.sqrt(Math.sin(Math.PI * t)))
                * (.45 + .55 * Math.sin(Math.PI * u));
            const point = surface(t, u).addScaledVector(normal, side * tissueThickness * .5);
            positions.push(point.x, point.y, point.z);
            surfaceNormals.push(normal.x * side, normal.y * side, normal.z * side);
            const tint = shade(t, u).multiplyScalar(side > 0 ? 1 : .94);
            colors.push(tint.r, tint.g, tint.b);
            uvs.push(((tile % 2) * 256 + 4.5 + u * 247) / 512,
                (Math.floor(tile / 2) * 256 + 4.5 + t * 247) / 512);
        }
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, b, d, a, d, c,
            a + count, d + count, b + count, a + count, c + count, d + count);
    }
    const boundary = [];
    for (let x = 0; x <= columns; x++) boundary.push(x);
    for (let y = 1; y <= rows; y++) boundary.push(y * (columns + 1) + columns);
    for (let x = columns - 1; x >= 0; x--) boundary.push(rows * (columns + 1) + x);
    for (let y = rows - 1; y > 0; y--) boundary.push(y * (columns + 1));
    for (let i = 0; i < boundary.length; i++) {
        const a = boundary[i], b = boundary[(i + 1) % boundary.length];
        const first = positions.length / 3;
        // Separate wall normals prevent the edge from shading like a rolled tube.
        for (const id of [a, a + count, b + count, b]) {
            positions.push(...positions.slice(id * 3, id * 3 + 3));
            colors.push(...colors.slice(id * 3, id * 3 + 3));
            uvs.push(...uvs.slice(id * 2, id * 2 + 2));
        }
        indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
    // Tiny low-resolution sepals cannot represent the exact continuous tangent
    // near their pointed ends; shade those from their actual triangles instead.
    batch.add(name, positions, indices, colors, uvs, matrix,
        rows >= 4 && columns >= 4 ? surfaceNormals : null);
}

function petalTint(baseHex, tipHex, seed) {
    const base = color(baseHex), tip = color(tipHex);
    const pale = tip.clone().lerp(color(0xe8d9c7), .24);
    return (t, u) => {
        const pigment = tissueNoise(u * 3.7 + seed * .73, t * 6.1 + 11) - .5;
        const streak = tissueNoise(u * 14 + Math.sin(t * 4 + seed) * .7, t * 2 + seed) - .5;
        const fade = Math.pow(t, 4) * (.08 + .05 * Math.sin(u * 5 + seed));
        return base.clone().lerp(tip, 1 - Math.exp(-t * 5.2)).lerp(pale, fade)
            .multiplyScalar(.96 + pigment * .12 + streak * .06 + .025 * Math.sin(seed * 1.31));
    };
}

function blade(length, width, { cup = .25, arch = .09, curl = .12, round = .12,
    pointed = false, seed = 1 } = {}) {
    return (t, u) => {
        const a = u * 2 - 1;
        const profile = pointed ? .018 + .982 * Math.pow(Math.sin(Math.PI * t), .7)
            : .15 + .85 * Math.pow(Math.sin(t * Math.PI * .78), .48);
        const half = width * .5 * profile;
        const y = length * t * (1 - round * (1 - Math.sqrt(Math.max(0, 1 - a * a))));
        return new THREE.Vector3(
            a * half * (1 + .035 * Math.sin(seed) * a) + width * .025 * Math.sin(t * Math.PI) * Math.sin(seed),
            y,
            length * (arch * Math.sin(Math.PI * t) - curl * Math.pow(t, 4))
                + half * cup * a * a + width * .009 * a * a * t * t * Math.sin(t * 11 + seed + a)
        );
    };
}

function frame(angle, tilt, y = 0, radial = 0, roll = 0) {
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const along = UP.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(out, Math.sin(tilt));
    const front = UP.clone().multiplyScalar(Math.sin(tilt)).addScaledVector(out, -Math.cos(tilt));
    const across = new THREE.Vector3().crossVectors(along, front);
    const matrix = new THREE.Matrix4().makeBasis(across, along, front);
    matrix.multiply(new THREE.Matrix4().makeRotationY(roll));
    matrix.setPosition(out.multiplyScalar(radial).add(new THREE.Vector3(0, y, 0)));
    return matrix;
}

// Closed tapered organs: rings of [height, radius], followed by flat end caps.
// Used for filaments, anthers, tiny tubular florets, receptacles and pedicels.
function organ(batch, name, profile, sides, tint, matrix = IDENTITY) {
    const positions = [], indices = [], colors = [], uvs = [];
    profile.forEach(([y, radius], ring) => {
        for (let i = 0; i < sides; i++) {
            const angle = i / sides * TAU;
            positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            const c = tint.clone().multiplyScalar(.95 + .05 * Math.cos(angle * 2 + ring));
            colors.push(c.r, c.g, c.b);
            uvs.push(i / sides, ring / (profile.length - 1));
            if (ring) {
                const a = (ring - 1) * sides + i, b = (ring - 1) * sides + (i + 1) % sides;
                indices.push(a, a + sides, b + sides, a, b + sides, b);
            }
        }
    });
    for (const ring of [0, profile.length - 1]) {
        const center = positions.length / 3;
        positions.push(0, profile[ring][0], 0);
        colors.push(tint.r, tint.g, tint.b);
        uvs.push(.5, ring === 0 ? 0 : 1);
        for (let i = 0; i < sides; i++) {
            const a = ring * sides + i, b = ring * sides + (i + 1) % sides;
            if (ring === 0) indices.push(center, a, b);
            else indices.push(center, b, a);
        }
    }
    batch.add(name, positions, indices, colors, uvs, matrix);
}

function stalk(batch, name, start, end, bottom, top, tint, sides = 4) {
    const delta = end.clone().sub(start);
    const matrix = new THREE.Matrix4().compose(start,
        new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize()), new THREE.Vector3(1, 1, 1));
    organ(batch, name, [[0, bottom], [delta.length(), top]], sides, tint, matrix);
}

function support(parts, radius, sepalCount, seed) {
    const random = randomSource(seed);
    organ(parts.support, 'pedicel', [[-.014, .0039], [.005, .0052]], 6, color(0x56663a));
    organ(parts.support, 'receptacle', [[0, radius * .35], [.006, radius], [.012, radius * .87]],
        10, color(0x647446));
    for (let i = 0; i < sepalCount; i++) {
        petal(parts.support, 'sepal', blade(radius * 1.45, radius * .44,
            { pointed: true, curl: .20, cup: .4, seed: i + seed }),
        petalTint(0x425133, 0x728052, i), 4, 4, .00016,
        frame(i * TAU / sepalCount + random() * .18, 1.32 + random() * .24, .003, radius * .36));
    }
}

function composite(parts, sunflower) {
    const random = randomSource(sunflower ? 719 : 241);
    const radius = sunflower ? .039 : .0185;
    support(parts, radius * .88, sunflower ? 9 : 7, sunflower ? 25 : 13);
    organ(parts.reproductive, 'disc receptacle', [[.008, radius * .78], [.014, radius],
        [.020, radius * .82], [.022, radius * .13]], 12, color(sunflower ? 0x544324 : 0x9d8238));
    const rays = sunflower ? 20 : 21;
    for (let i = 0; i < rays; i++) {
        // One relaxed, irregular whorl. Rays overlap at their bases, not in
        // stacked pinwheels; individual tips cup, droop and turn independently.
        const length = (sunflower ? .071 : .051) * (.90 + random() * .19);
        const width = (sunflower ? .019 : .0125) * (.88 + random() * .23);
        const surface = blade(length, width, { cup: .18 + random() * .24,
            arch: .035 + random() * .055, curl: .045 + random() * .15,
            round: sunflower ? .08 : .14, pointed: sunflower, seed: i + 7 });
        petal(parts.petals, 'ray floret', surface,
            petalTint(sunflower ? 0xa57a26 : 0xc2b987, sunflower ? 0xdfb448 : 0xeee9d9, i * .71),
            sunflower ? 8 : 10, sunflower ? 4 : 6, sunflower ? .00012 : .00009,
            frame(i * TAU / rays + (random() - .5) * .085,
                1.37 + (random() - .5) * .23, .012 + random() * .002, radius * .83, (random() - .5) * .37));
    }
    const count = sunflower ? 72 : 46;
    for (let i = 0; i < count; i++) {
        const r = radius * .95 * Math.sqrt((i + .5) / count), angle = i * GOLDEN;
        // Match the actual piecewise receptacle surface, embedding each base
        // slightly so the tiny corollas cannot float above the central disc.
        const fraction = r / radius;
        const y = (fraction < .13 ? .022 : fraction < .82
            ? lerp(.022, .020, (fraction - .13) / .69)
            : lerp(.020, .014, (fraction - .82) / .18)) - .0003;
        const tint = sunflower
            ? color(i > count * .68 ? 0xae873d : 0x514027).multiplyScalar(.86 + random() * .22)
            : color(0xb99a3c).lerp(color(0xd6b958), random() * .65);
        const size = (sunflower ? .0035 : .0020) * (.86 + random() * .19);
        const matrix = new THREE.Matrix4().makeTranslation(Math.cos(angle) * r, y, Math.sin(angle) * r);
        organ(parts.reproductive, 'disc floret', [[0, size], [size * .78, size * .80]],
            sunflower ? 4 : 3, tint, matrix);
    }
}

function rose(parts) {
    const random = randomSource(809);
    support(parts, .012, 5, 67);
    const whorls = [
        { count: 7, radius: .049, height: .039, base: .001, span: .76 },
        { count: 6, radius: .039, height: .038, base: .007, span: .86 },
        { count: 5, radius: .022, height: .036, base: .014, span: .98 },
        { count: 4, radius: .0045, height: .031, base: .020, span: 1.14 }
    ];
    let serial = 0;
    for (let ring = 0; ring < whorls.length; ring++) for (let i = 0; i < whorls[ring].count; i++) {
        const whorl = whorls[ring], inward = ring / 3;
        const angle = i * TAU / whorl.count + ring * GOLDEN + (random() - .5) * .14;
        const height = whorl.height * (.91 + random() * .18);
        const basalRadius = lerp(.0045, .0013, inward);
        const rimRadius = whorl.radius * (.92 + random() * .15);
        const emergence = whorl.base + (random() - .5) * .0016;
        const turn = lerp(.13, .56, inward) + (random() - .5) * .15;
        const span = whorl.span, basalSpan = Math.PI / whorl.count * 1.05, phase = random() * TAU;
        // Petals wrap around the bloom axis; these are curved overlapping walls,
        // not radial paddle planes. Spend more samples along the rounded rim.
        const surface = (t, u) => {
            const a = u * 2 - 1, opening = Math.pow(Math.sin(t * Math.PI / 2), .8);
            const theta = angle + a * lerp(basalSpan, span, opening) + t * turn
                + .025 * a * Math.sin(t * 5 + phase);
            // Pull the rim corners inward as well as down: a petal ends in a
            // rounded lobe in TOP view, rather than tracing a circular collar.
            const radius = lerp(basalRadius, rimRadius, opening)
                * (1 - .08 * a * a * Math.sin(Math.PI * t) - .23 * a * a * t * t)
                + lerp(.002, 0, inward) * Math.pow(t, 5)
                + .00025 * Math.sin(a * 11 + phase * 2) * Math.pow(t, 7);
            const y = emergence + height * t
                * (1 - .17 * (1 - Math.sqrt(Math.max(0, 1 - a * a))))
                - height * lerp(.19, 0, inward) * Math.pow(t, 5)
                + .0009 * t * t * Math.sin(a * 4 + phase)
                + .00035 * Math.pow(t, 7) * Math.sin(a * 10 + phase);
            return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
        };
        const tip = color(ring > 1 ? 0xaf697d : 0xc78c98).lerp(color(0xc694a0), random() * .24);
        petal(parts.petals, 'rose petal', surface,
            petalTint(0x874b5b, tip.getHex(), serial++),
            ring === 0 ? 10 : ring === 1 ? 9 : 7, ring === 0 ? 12 : ring === 1 ? 10 : 8, .00010);
    }
    for (let i = 0; i < 6; i++) {
        const a = i * GOLDEN;
        organ(parts.reproductive, 'rose stamen and anther', [[.010, .00045], [.021, .0008], [.025, .0005]], 3,
            color(0x96754a), new THREE.Matrix4().makeTranslation(Math.cos(a) * .003, 0, Math.sin(a) * .003));
    }
}

function tulip(parts) {
    const random = randomSource(1207);
    // Tulips have six tepals, not a second invented green sepal whorl.
    organ(parts.support, 'tulip pedicel and ovary', [[-.014, .0037], [.002, .006], [.014, .0045]],
        8, color(0x718054));
    for (let whorl = 0; whorl < 2; whorl++) for (let i = 0; i < 3; i++) {
        const angle = i * TAU / 3 + whorl * Math.PI / 3 + (random() - .5) * .05;
        const height = .079 * (.96 + random() * .08);
        const phase = random() * TAU;
        const fullness = .95 + random() * .10;
        const surface = (t, u) => {
            const a = u * 2 - 1;
            const span = .19 + .54 * Math.pow(Math.sin(t * Math.PI * .64), .55);
            const theta = angle + a * span + .025 * Math.sin(t * 5 + phase) * t;
            const radius = (.0055 + .030 * Math.pow(Math.sin(t * Math.PI * .69), .85)
                + .004 * Math.pow(t, 6)) * (whorl ? .94 : 1) * fullness
                + .00018 * Math.sin(a * 12 + .7 * Math.sin(t * 5 + phase)) * Math.sin(Math.PI * t)
                + .00022 * Math.sin(a * 11 + phase) * Math.pow(t, 7);
            const y = height * t * (1 - .21 * (1 - Math.sqrt(Math.max(0, 1 - a * a)))) + whorl * .001
                + .0013 * t * t * Math.sin(a * 3 + phase)
                + .0003 * Math.pow(t, 7) * Math.sin(a * 13 + phase * 2);
            return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
        };
        const tip = color(0xb96984).lerp(color(0xc98c9c), random() * .38);
        petal(parts.petals, 'tulip tepal', surface, petalTint(0xd0bd91, tip.getHex(), phase),
            18, 18, .00014);
    }
    for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .2;
        const start = new THREE.Vector3(Math.cos(a) * .0045, .009, Math.sin(a) * .0045);
        const end = new THREE.Vector3(Math.cos(a) * .009, .040 + random() * .005, Math.sin(a) * .009);
        stalk(parts.reproductive, 'tulip filament', start, end, .0011, .00065, color(0xaca072), 5);
        organ(parts.reproductive, 'tulip anther', [[0, .0012], [.003, .0020], [.009, .0014], [.010, .00045]],
            5, color(0x514630), new THREE.Matrix4().makeTranslation(end.x, end.y, end.z));
    }
    organ(parts.support, 'tulip style', [[.012, .0024], [.047, .0018]], 6, color(0x99a06b));
    for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3;
        stalk(parts.reproductive, 'tulip stigma lobe', new THREE.Vector3(0, .047, 0),
            new THREE.Vector3(Math.cos(a) * .0035, .049, Math.sin(a) * .0035), .0019, .0012, color(0xc3bd8e));
    }
}

function hydrangea(parts) {
    const random = randomSource(1901);
    const branches = [];
    stalk(parts.support, 'hydrangea peduncle', new THREE.Vector3(0, -.014, 0),
        new THREE.Vector3(.001, .017, -.001), .004, .0032, color(0x68734b), 6);
    for (let i = 0; i < 6; i++) {
        const a = i * GOLDEN;
        const end = new THREE.Vector3(Math.cos(a) * .026, .025 + random() * .012, Math.sin(a) * .026);
        stalk(parts.support, 'hydrangea branch', new THREE.Vector3(.001, .010, -.001), end,
            .0018, .0009, color(0x7a815a));
        branches.push(end);
    }
    for (let i = 0; i < 33; i++) {
        const q = (i + .5) / 33, angle = i * GOLDEN;
        const radius = .056 * Math.sqrt(q) * (1 + .07 * Math.sin(angle * 3));
        const center = new THREE.Vector3(Math.cos(angle) * radius,
            .029 + .041 * Math.sqrt(1 - q) + (random() - .5) * .005, Math.sin(angle) * radius);
        const normal = new THREE.Vector3(center.x * 11, .95 - q * .36, center.z * 11).normalize();
        const rotation = new THREE.Quaternion().setFromUnitVectors(UP, normal);
        const transform = new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(1, 1, 1));
        const nearest = branches.reduce((a, b) => a.distanceToSquared(center) < b.distanceToSquared(center) ? a : b);
        stalk(parts.support, 'hydrangea pedicel', nearest, center, .00085, .0005, color(0x89916b), 3);
        const phase = random() * TAU, size = .83 + random() * .27;
        // Four showy sepals around a small fertile/vestigial flower. Neighboring
        // florets overlap organically; there is no hidden spherical flower mass.
        const tip = color(0x8f9faf).lerp(color(0xb1a1b6), .3 + Math.sin(angle * .7) * .25);
        for (let j = 0; j < 4; j++) {
            const local = frame(j * TAU / 4 + phase + (random() - .5) * .12,
                1.29 + (random() - .5) * .2, 0, .0015);
            local.premultiply(transform);
            petal(parts.petals, 'hydrangea showy sepal', blade(.020 * size, .023 * size,
                { cup: .26, arch: .07, curl: .05, round: .40, seed: i * 4 + j }),
            petalTint(0x8f9b77, tip.getHex(), i * 4 + j), 2, 5, .00008, local);
        }
        organ(parts.reproductive, 'hydrangea flower center', [[0, .0017], [.003, .0010]],
            3, color(0xc4c5a6), transform);
    }
}

function build(index) {
    const parts = { petals: new Batch(), reproductive: new Batch(), support: new Batch() };
    if (index < 2) composite(parts, index === 1);
    else [rose, tulip, hydrangea][index - 2](parts);
    const group = new THREE.Group();
    group.name = `Botanical flower: ${SPECIES[index]}`;
    const palette = sharedMaterials();
    // Subtle head inclination is baked, so all mesh transforms remain static.
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.07, .13, -.045));
    let triangles = 0, components = 0;
    for (const [key, batch] of Object.entries(parts)) {
        const mesh = batch.mesh(`${SPECIES[index]} / ${key}`, palette[key], tilt);
        if (mesh) {
            triangles += mesh.geometry.index.count / 3;
            components += batch.parts.length;
            group.add(mesh);
        }
    }
    const bounds = new THREE.Box3().setFromObject(group);
    group.userData.flower = {
        species: SPECIES[index], variantIndex: index, triangles, drawCalls: group.children.length,
        components, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }
    };
    return group;
}

/** Fresh hierarchy, cached immutable resources. No additional clone is required. */
export function createFlowerPrototype(variantIndex = 0) {
    const index = (((variantIndex | 0) % SPECIES.length) + SPECIES.length) % SPECIES.length;
    if (!cache.has(index)) cache.set(index, build(index));
    return cache.get(index).clone(true);
}

/** Call only after retiring ALL flower clones and their PlantBatches instances. */
export function disposeFlowerPrototypes() {
    for (const root of cache.values()) root.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    cache.clear();
    if (materials) {
        for (const key of ['map', 'bumpMap', 'roughnessMap']) materials.petals[key].dispose();
        for (const material of Object.values(materials)) material.dispose();
        materials = null;
    }
}
