import * as THREE from 'three';

/**
 * Static, opaque botany for the greenhouse (Three.js r160+).
 *
 * Integration:
 *   const botany = createBotanicalEnvironment(scene);
 *   // No animation tick required. Call botany.dispose() when rebuilding.
 *   // Individual sections can be hidden with botany.sections.ivy.visible = false.
 *
 * Task leaves: cache ONE geometry/material, then clone the material when a task
 * needs its own health tint. The public geometry preserves app.js's centered XY
 * convention: base (0, -length/2, 0), tip toward +Y, upper surface toward +Z.
 * Use (.18, .22) for the old leaf dimensions; default length is deliberately .35.
 * The internal attachment helper moves that basal point onto a stem exactly.
 *
 * All foliage silhouettes are closed meshes, including the distant leaves.
 * Color/normal/bump textures are opaque surface detail, never silhouettes.
 * Task material clones share stable photo texture objects from creation onward.
 * Await texturesReady() before a benchmark; loading never needs a batch rebuild.
 * No sprites, billboards, alpha tests, transparent leaves, canopy blobs, dynamic
 * instance uploads or shader patching. Side groves cast opaque static shadows;
 * the parent should keep its existing on-demand sun shadow updates. Draw counts
 * in stats are conservative totals for ALL sections in one beauty pass; glass,
 * AO, task plants and the parent's other rendering passes are additional work.
 */

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Asymmetric blade widths sampled from the photographed leaf, base to tip.
// Fractions of FULL width, coupled to assets/botany/potted-plant-02's UV unwrap.
// The basal heart lobes are omitted and the margins have shallow staggered teeth.
const PHOTO_LEAF_PROFILE = [
    [0, 0], [.086918, .084424], [.265960, .268974], [.466309, .416763],
    [.508143, .471785], [.522511, .440297], [.492045, .428599], [.490542, .387462],
    [.452508, .376488], [.448124, .338296], [.404749, .320941], [.363300, .269599],
    [.291465, .229645], [.238122, .158760], [.129688, .099543], [.044145, .047494],
    [.010986, .027195], [0, 0]
];

function randomSource(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let n = Math.imul(state ^ (state >>> 15), state | 1);
        n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
        return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
}

function finishGeometry(positions, indices, colors, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

// Four/eight vertices around a thin lens section; the margins are shared by
// upper/lower surfaces, and the two pointed ends are capped without zero-area
// triangles. Every welded edge belongs to two faces, even on the 16-tri LOD.
// The front/back shading seam duplicates margin normals, not physical surfaces.
function leafGeometry(width, length, seed, rings, detailed, lobed = false, photoProfile = null) {
    const random = randomSource(seed);
    const bend = .065 + random() * .055;
    const twist = (random() - .5) * .30;
    const asymmetry = (random() - .5) * .12;
    const perimeter = detailed ? [-1, -.5, 0, .5, 1, .5, 0, -.5] : [-1, 0, 1, 0];
    const sides = perimeter.length;
    const positions = [], indices = [], colors = [], uvs = [];
    const thickness = Math.min(width * .0015, .0003);
    const center = t => new THREE.Vector3(
        width * asymmetry * Math.sin(Math.PI * t) * t,
        (t - .5) * length,
        length * (bend * Math.sin(Math.PI * t) - .075 * t * t)
    );
    function vertex(point, u, t, shade) {
        positions.push(point.x, point.y, point.z);
        // Midrib, blade, margin and underside have distinct but restrained tones.
        if (photoProfile) colors.push(shade, shade, shade);
        else colors.push(shade * .96, shade, shade * .92);
        uvs.push(u, t);
    }
    vertex(center(0), .5, 0, photoProfile ? .98 : .72);
    for (let row = 1; row <= rings; row++) {
        const t = row / (rings + 1);
        let profile = Math.pow(Math.sin(Math.PI * t), .76) * (1.08 - .22 * t);
        if (lobed) profile *= 1 + .22 * Math.sin(t * Math.PI * 5) * Math.sin(t * Math.PI);
        for (let j = 0; j < sides; j++) {
            const across = perimeter[j];
            const upper = j <= sides / 2;
            let halfWidth = photoProfile
                ? width * photoProfile[row][across < 0 ? 0 : 1]
                : width * .5 * profile;
            if (photoProfile) {
                // Preserve the photograph's basal/tip UVs while varying the
                // shoulder and blade width between the three cached shapes.
                halfWidth *= 1 + .11 * Math.sin(seed * .73 + t * 4.1) * Math.sin(Math.PI * t);
            }
            const point = center(t);
            point.x += across * halfWidth * (photoProfile ? 1 : 1 + asymmetry * across);
            const cup = -halfWidth * .13 * across * across;
            const ridge = thickness * (1 - Math.abs(across));
            point.z += cup + across * halfWidth * twist * t + (upper ? ridge : -ridge);
            point.z += Math.abs(across) * width * .015 * Math.sin(t * 19 + seed);
            const shade = photoProfile ? (upper ? 1 : .94)
                : (.84 + .10 * Math.sin(Math.PI * t) - .07 * Math.abs(across)) * (upper ? 1 : .83);
            vertex(point, (across + 1) * .5, t, shade);
        }
    }
    const tip = positions.length / 3;
    vertex(center(1), .5, 1, photoProfile ? .98 : .80);
    for (let j = 0; j < sides; j++) {
        const next = (j + 1) % sides;
        indices.push(0, 1 + next, 1 + j);
        for (let row = 0; row < rings - 1; row++) {
            const a = 1 + row * sides + j, b = 1 + row * sides + next;
            if (j < sides / 2) indices.push(a, b, b + sides, a, b + sides, a + sides);
            // Match the upper surface's physical diagonal. Opposite diagonals
            // on a twisted quad can cross through a sub-millimetre leaf shell.
            else indices.push(a, b, a + sides, b, b + sides, a + sides);
        }
        const last = 1 + (rings - 1) * sides;
        indices.push(tip, last + j, last + next);
    }
    // Averaging the top and underside normals across a paper-thin margin makes
    // a leaf shade like a thick rolled lip. Smooth each surface independently.
    const surfaceNormals = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let face = 0; face < indices.length / 3; face++) {
        const surface = Math.floor(face / (2 * rings)) < sides / 2 ? 0 : 1;
        const ids = indices.slice(face * 3, face * 3 + 3);
        a.fromArray(positions, ids[0] * 3);
        b.fromArray(positions, ids[1] * 3).sub(a);
        c.fromArray(positions, ids[2] * 3).sub(a);
        b.cross(c);
        for (const id of ids) {
            const key = id * 2 + surface;
            if (!surfaceNormals.has(key)) surfaceNormals.set(key, new THREE.Vector3());
            surfaceNormals.get(key).add(b);
        }
    }
    const splitPositions = [], splitColors = [], splitUvs = [], splitNormals = [], splitIndices = [];
    const vertexMap = new Map();
    for (let face = 0; face < indices.length / 3; face++) {
        const surface = Math.floor(face / (2 * rings)) < sides / 2 ? 0 : 1;
        for (const id of indices.slice(face * 3, face * 3 + 3)) {
            const key = id * 2 + surface;
            if (!vertexMap.has(key)) {
                vertexMap.set(key, splitPositions.length / 3);
                splitPositions.push(...positions.slice(id * 3, id * 3 + 3));
                splitColors.push(...colors.slice(id * 3, id * 3 + 3));
                splitUvs.push(...uvs.slice(id * 2, id * 2 + 2));
                surfaceNormals.get(key).normalize().toArray(splitNormals, splitNormals.length);
            }
            splitIndices.push(vertexMap.get(key));
        }
    }
    const geometry = finishGeometry(splitPositions, splitIndices, splitColors, splitUvs);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(splitNormals, 3));
    geometry.name = photoProfile ? 'Closed pointed photographed blade'
        : lobed ? 'Solid lobed ivy leaf' : 'Solid curved botanical leaf';
    geometry.userData.botanical = {
        width, length, seed, base: [0, -length / 2, 0], triangles: indices.length / 3
    };
    return geometry;
}

/** Fresh caller-owned geometry, 256 triangles, centered like the existing leaf. */
export function createBotanicalLeafGeometry(width = .18, length = .35, seed = 1) {
    if (!Number.isFinite(width) || !Number.isFinite(length) || width <= 0 || length <= 0) {
        throw new RangeError('Botanical leaf width and length must be positive finite numbers.');
    }
    if (!Number.isFinite(seed)) throw new RangeError('Botanical leaf seed must be finite.');
    return leafGeometry(width, length, seed, PHOTO_LEAF_PROFILE.length - 2, true, false, PHOTO_LEAF_PROFILE);
}

function dataTexture(data, width, height, colorSpace = THREE.NoColorSpace) {
    const texture = new THREE.DataTexture(data, width, height);
    texture.colorSpace = colorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}

function surfaceTexture(width, height, sample, colorSpace = THREE.NoColorSpace) {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = sample(x / (width - 1), y / (height - 1));
            const i = (y * width + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
            data[i + 3] = 255;
        }
    }
    return dataTexture(data, width, height, colorSpace);
}

function tissueNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = x - ix, ty = y - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const hash = (a, b) => {
        let value = Math.imul(a, 374761393) + Math.imul(b, 668265263);
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
    };
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), sx),
        THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}

function leafTextures() {
    const width = 256, height = 512;
    const color = new Uint8Array(width * height * 4);
    const bump = new Uint8Array(width * height * 4);
    const roughness = new Uint8Array(width * height * 4);
    const random = randomSource(49271);
    const veins = [-1, 1].map(side => Array.from({ length: side < 0 ? 8 : 9 }, (_, i) => ({
        root: .075 + i * (side < 0 ? .106 : .093) + random() * .025,
        slope: .20 + random() * .21,
        curve: .18 + random() * .25,
        width: .0022 + random() * .0016,
        offset: .08 + random() * .08
    })));
    function leafSurface(u, v) {
        // The midrib wanders subtly, and the two sides have different vein
        // counts, emergence points, angles and branch lengths. No mirrored comb.
        const center = .5 + .012 * Math.sin(v * 7.3) * Math.sin(v * Math.PI);
        const across = u - center, x = Math.abs(across);
        const midribWidth = .0055 * (1 - v * .70) + .0015;
        const midrib = Math.exp(-Math.pow(across / midribWidth, 2));
        let primary = 0, tertiary = 0;
        for (const vein of veins[across < 0 ? 0 : 1]) {
            const curveY = vein.root + vein.slope * x + vein.curve * x * x;
            const taper = Math.max(.12, 1 - x * 1.6);
            primary = Math.max(primary, Math.exp(-Math.pow((v - curveY) / (vein.width * taper), 2)) * taper);
            for (let branch = 0; branch < 2; branch++) {
                const start = vein.offset + branch * .19;
                const along = x - start;
                if (along < 0 || along > .15) continue;
                const splitY = curveY + along * (.22 + branch * .12);
                tertiary = Math.max(tertiary, Math.exp(-Math.pow((v - splitY) / .0017, 2))
                    * Math.sin(Math.PI * along / .15));
            }
        }
        const broad = tissueNoise(u * 4.3 + 11, v * 7.1 + 19) - .5;
        const mottling = tissueNoise(u * 17.3 + 31, v * 26.1 + 5) - .5;
        const cuticle = tissueNoise(u * 103.7, v * 169.3) - .5;
        const veinTone = .035 * midrib + .040 * primary + .016 * tertiary;
        const tissue = .865 + broad * .11 + mottling * .052 + cuticle * .012;
        return {
            // Fine warm veins in living tissue, not a dark painted center stripe.
            rgb: [tissue + veinTone, tissue + .016 + veinTone * .73, tissue - .018 + veinTone * .32],
            height: .48 + midrib * .085 + primary * .050 + tertiary * .019 + cuticle * .035,
            roughness: .946 + broad * .045 + mottling * .060 + cuticle * .016 - veinTone * .3
        };
    }
    const byte = value => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const sample = leafSurface(x / (width - 1), y / (height - 1));
            const i = (y * width + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
                color[i + channel] = byte(sample.rgb[channel]);
                bump[i + channel] = byte(sample.height);
                roughness[i + channel] = byte(sample.roughness);
            }
            color[i + 3] = bump[i + 3] = roughness[i + 3] = 255;
        }
    }
    return {
        map: dataTexture(color, width, height, THREE.SRGBColorSpace),
        bumpMap: dataTexture(bump, width, height),
        roughnessMap: dataTexture(roughness, width, height)
    };
}

// The static environment retains its own procedural maps and original UVs.
function createProceduralFoliageMaterial() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x739560,
        vertexColors: true,
        ...leafTextures(),
        bumpScale: .00025,
        roughness: .58, // Multiplied by the cuticle map: approximately .55.
        metalness: 0,
        envMapIntensity: .65,
        side: THREE.FrontSide,
        transparent: false,
        alphaTest: 0
    });
    material.name = 'Opaque botanical cuticle';
    return material;
}

const PHOTO_SIZE = [512, 1024];
const PHOTO_CHANNELS = [
    ['map', 'leaf-diff.png', [211, 211, 211], THREE.SRGBColorSpace],
    ['normalMap', 'leaf-nor_gl.png', [128, 128, 255], THREE.NoColorSpace],
    ['roughnessMap', 'leaf-rough.png', [145, 145, 145], THREE.NoColorSpace]
];
let sharedPhotoTextures = null;

function photoTextures() {
    if (sharedPhotoTextures) return sharedPhotoTextures;
    const [width, height] = PHOTO_SIZE;
    const record = { maps: {}, cancelled: false, cancelLoads: new Set(), ready: null };
    sharedPhotoTextures = record;
    for (const [key, file, rgb, colorSpace] of PHOTO_CHANNELS) {
        const data = new Uint8Array(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
        const texture = dataTexture(data, width, height, colorSpace);
        texture.name = `Botanical photograph / ${file}`;
        texture.flipY = false;
        texture.userData.shared = true;
        record.maps[key] = texture;
    }
    // Objects, dimensions, formats and map slots exist BEFORE any clone or load.
    // Publish pixels in place: app clones and PlantBatches clones keep their UUIDs,
    // shader variants, material keys and GPU allocations through asynchronous load.
    record.ready = loadPhotoTextures(record);
    return record;
}

async function loadPhotoTextures(record) {
    if (typeof document === 'undefined') {
        return { status: 'fallback', loaded: [], failed: [{ reason: 'Image decoding requires a DOM.' }] };
    }
    const [width, height] = PHOTO_SIZE;
    const results = await Promise.all(PHOTO_CHANNELS.map(([key, file]) => {
        const url = new URL(`./assets/botany/potted-plant-02/${file}`, import.meta.url).href;
        return new Promise(resolve => {
            let settled = false;
            const finish = result => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                record.cancelLoads.delete(cancel);
                resolve({ key, url, ...result });
            };
            const cancel = () => finish({ error: 'Texture owner disposed.' });
            const timer = setTimeout(() => finish({ error: 'Texture load exceeded 15 seconds.' }), 15000);
            record.cancelLoads.add(cancel);
            try {
                new THREE.ImageLoader().load(url, image => {
                    if (settled || record.cancelled) return;
                    try {
                        if (image.width !== width || image.height !== height) throw new Error('Unexpected texture dimensions.');
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const context = canvas.getContext('2d', { willReadFrequently: true });
                        if (!context) throw new Error('Canvas image decoding unavailable.');
                        context.drawImage(image, 0, 0);
                        const pixels = context.getImageData(0, 0, width, height).data;
                        // RGB assets must stay opaque even if an asset is replaced.
                        for (let i = 3; i < pixels.length; i += 4) {
                            if (pixels[i] !== 255) throw new Error('Botanical surface maps must be fully opaque.');
                        }
                        finish({ pixels });
                    } catch (error) { finish({ error: error.message }); }
                }, undefined, () => finish({ error: 'Texture request failed.' }));
            } catch (error) { finish({ error: error.message }); }
        });
    }));
    const failed = results.filter(result => result.error).map(({ url, error }) => ({ url, reason: error }));
    // Atomic set: a failed channel leaves all three neutral fallback maps intact.
    if (record.cancelled || failed.length) {
        return { status: record.cancelled ? 'disposed' : 'fallback', loaded: [], failed };
    }
    for (const { key, pixels } of results) {
        const texture = record.maps[key];
        const stride = width * 4;
        for (let y = 0; y < height; y++) {
            // Typed-array row zero is v=0; PNG row zero is the leaf TIP at v=1.
            texture.image.data.set(pixels.subarray(y * stride, (y + 1) * stride), (height - 1 - y) * stride);
        }
        texture.needsUpdate = true;
    }
    return { status: 'ready', loaded: results.map(result => result.url), failed: [] };
}

/**
 * Fresh caller-owned stock material; clones share module-owned photo textures.
 * Diffuse is normalized in linear sRGB: KEEP the parent's healthy 0x819456 tint.
 * Do not replace map slots on clones or dispose their textures individually.
 * No shader hooks, alpha silhouettes, transmission or per-frame texture work.
 */
export function createBotanicalLeafMaterial() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x819456,
        vertexColors: true,
        ...photoTextures().maps,
        normalScale: new THREE.Vector2(.45, .45),
        roughness: 1, // Photograph-derived roughness spans .42-.78 (baseline .57).
        metalness: 0,
        envMapIntensity: .65,
        side: THREE.FrontSide,
        transparent: false,
        alphaTest: 0
    });
    material.name = 'Opaque photographed botanical cuticle';
    return material;
}

/** Resolves once local photo maps are published, or reports the neutral fallback. */
export function texturesReady() {
    return photoTextures().ready;
}

/** Call only after ALL task leaves, their cached material and batches are retired. */
export function disposeBotanicalLeafTextures() {
    if (!sharedPhotoTextures) return;
    const record = sharedPhotoTextures;
    record.cancelled = true;
    for (const cancel of record.cancelLoads) cancel();
    for (const texture of Object.values(record.maps)) texture.dispose();
    sharedPhotoTextures = null;
}

// One writer per spatial batch, avoiding hundreds of temporary TubeGeometries
// and per-branch Mesh objects. All tubes have tapered, closed ends.
class GeometryWriter {
    constructor() {
        this.positions = [];
        this.indices = [];
        this.colors = [];
        this.uvs = [];
    }

    tube(points, radiusStart, radiusEnd, sides = 5, tint = [1, 1, 1]) {
        const first = this.positions.length / 3;
        let distance = 0;
        let axis = null;
        const tangent = new THREE.Vector3();
        for (let i = 0; i < points.length; i++) {
            const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
            tangent.subVectors(next, previous).normalize();
            if (!axis) axis = Math.abs(tangent.y) < .9 ? UP.clone() : FRONT.clone();
            // Transport the frame; abrupt axis switching would twist a tube.
            axis.addScaledVector(tangent, -axis.dot(tangent)).normalize();
            const other = new THREE.Vector3().crossVectors(tangent, axis).normalize();
            if (i) distance += points[i].distanceTo(points[i - 1]);
            const t = i / (points.length - 1);
            const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
            for (let j = 0; j < sides; j++) {
                const angle = j / sides * TAU;
                const point = points[i].clone()
                    .addScaledVector(axis, Math.cos(angle) * radius)
                    .addScaledVector(other, Math.sin(angle) * radius);
                this.positions.push(point.x, point.y, point.z);
                const shade = .86 + .09 * Math.cos(angle * 3 + t * 2);
                this.colors.push(tint[0] * shade, tint[1] * shade, tint[2] * shade);
                this.uvs.push(j / sides, distance);
                if (i) {
                    const a = first + (i - 1) * sides + j;
                    const b = first + (i - 1) * sides + (j + 1) % sides;
                    // Winding follows the transported radial frame.
                    this.indices.push(a, b, b + sides, a, b + sides, a + sides);
                }
            }
        }
        for (const end of [0, points.length - 1]) {
            const centerIndex = this.positions.length / 3;
            const point = points[end];
            this.positions.push(point.x, point.y, point.z);
            this.colors.push(...tint);
            this.uvs.push(.5, end ? distance : 0);
            for (let j = 0; j < sides; j++) {
                const a = first + end * sides + j, b = first + end * sides + (j + 1) % sides;
                if (end === 0) this.indices.push(centerIndex, b, a);
                else this.indices.push(centerIndex, a, b);
            }
        }
    }

    append(geometry, matrix, tint = [1, 1, 1]) {
        const start = this.positions.length / 3;
        const p = geometry.attributes.position, color = geometry.attributes.color, uv = geometry.attributes.uv;
        const point = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i).applyMatrix4(matrix);
            this.positions.push(point.x, point.y, point.z);
            this.colors.push((color ? color.getX(i) : 1) * tint[0],
                (color ? color.getY(i) : 1) * tint[1], (color ? color.getZ(i) : 1) * tint[2]);
            this.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        for (const index of geometry.index.array) this.indices.push(start + index);
    }

    geometry(name) {
        const geometry = finishGeometry(this.positions, this.indices, this.colors, this.uvs);
        geometry.name = name;
        return geometry;
    }
}

function curvePoints(curve, segments) {
    return Array.from({ length: segments + 1 }, (_, i) => curve.getPoint(i / segments));
}

// Attach to the sampled tube's actual centreline, not an ideal spline that can
// bow a few millimetres away from its rendered low-resolution segments.
function pathFrame(points, t) {
    const segment = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
    const fraction = t * (points.length - 1) - segment;
    return {
        point: points[segment].clone().lerp(points[segment + 1], fraction),
        tangent: new THREE.Vector3().subVectors(points[segment + 1], points[segment]).normalize()
    };
}

function leafMatrix(geometry, base, direction, scale = 1, roll = 0, surfaceNormal = UP) {
    const along = direction.clone().normalize();
    let normal = surfaceNormal.clone().addScaledVector(along, -surfaceNormal.dot(along));
    if (normal.lengthSq() < .001) {
        const fallback = Math.abs(along.z) < .9 ? FRONT : new THREE.Vector3(1, 0, 0);
        normal = fallback.clone().addScaledVector(along, -fallback.dot(along));
    }
    normal.normalize();
    const across = new THREE.Vector3().crossVectors(along, normal).normalize();
    const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, normal));
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, roll));
    // The leaf's negative-Y endpoint lands exactly on the supplied petiole end.
    const position = base.clone().add(new THREE.Vector3(0, geometry.userData.botanical.length * scale / 2, 0)
        .applyQuaternion(rotation));
    return new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(scale, scale, scale));
}

function foliageTint(random, shade = 1) {
    const value = (.82 + random() * .18) * shade;
    return new THREE.Color().setRGB(value * (.96 + random() * .04), value, value * (.87 + random() * .09));
}

function makeFernFrond(seed) {
    const random = randomSource(seed);
    const writer = new GeometryWriter();
    const rachis = new THREE.CubicBezierCurve3(
        new THREE.Vector3(), new THREE.Vector3(0, .65, .05),
        new THREE.Vector3(.02, .84, .57), new THREE.Vector3(.06, .46, 1.03)
    );
    const rachisPath = curvePoints(rachis, 10);
    writer.tube(rachisPath, .008, .0014, 4, [.53, .62, .32]);
    const leaflet = leafGeometry(.047, .23, seed, 2, false);
    // Pinnae diminish toward the apex and leave a short bare petiole at the base.
    for (let pair = 0; pair < 12; pair++) {
        const t = .18 + pair / 12 * .77;
        const point = pathFrame(rachisPath, t).point;
        const scale = Math.pow(Math.sin(Math.PI * t), .72) * (.86 + random() * .18);
        for (const side of [-1, 1]) {
            const direction = new THREE.Vector3(side, .10 + random() * .16, .45 + t * .4);
            writer.append(leaflet, leafMatrix(leaflet, point, direction, scale, side * .17),
                [.89 + random() * .08, .95, .82]);
        }
    }
    const tip = pathFrame(rachisPath, 1);
    writer.append(leaflet, leafMatrix(leaflet, tip.point, tip.tangent, .40));
    leaflet.dispose();
    return writer.geometry('Fern frond: tapered rachis and 25 solid pinnae');
}

function makeBarkMaterial() {
    const bark = surfaceTexture(64, 128, (u, v) => {
        const grain = Math.sin(u * TAU * 17 + Math.sin(v * 17) * .8);
        return .60 + .14 * grain + .06 * Math.sin(u * TAU * 31 + v * 2);
    });
    bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
    const albedo = surfaceTexture(64, 128, (u, v) => {
        const grooves = Math.sin(u * TAU * 17 + Math.sin(v * 17) * .8);
        const weathering = Math.sin(u * 31 + Math.sin(v * 21)) * Math.sin(v * 13);
        return .73 + .09 * grooves + .05 * weathering;
    }, THREE.SRGBColorSpace);
    albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({
        name: 'Weathered bark and woody stems', color: 0x756d5f, vertexColors: true,
        map: albedo, bumpMap: bark, bumpScale: .017, roughness: .96, metalness: 0, envMapIntensity: .4
    });
}

/**
 * Adds a self-contained environment. scene should have identity world transform,
 * existing greenhouse lighting/fog, walls x=±8, ends z=-45/5, eaves y=6, ridge y=11.
 * Owns only its added group/resources. No mutation of parent fog/lights/renderer.
 * sections: forest, undergrowth, ivy, ferns, baskets, ground (visibility toggles).
 */
export function createBotanicalEnvironment(scene) {
    if (!scene || !scene.isObject3D) throw new TypeError('Botanical environment needs a Three.js scene/group.');
    const group = new THREE.Group();
    group.name = 'Solid botanical environment';
    const sections = {};
    for (const name of ['forest', 'undergrowth', 'ivy', 'ferns', 'baskets', 'ground']) {
        sections[name] = new THREE.Group();
        sections[name].name = `Botany: ${name}`;
        group.add(sections[name]);
    }
    const geometries = new Set(), materials = new Set(), meshes = [];
    const ownGeometry = geometry => (geometries.add(geometry), geometry);
    const ownMaterial = material => (materials.add(material), material);
    const leafMaterial = ownMaterial(createProceduralFoliageMaterial());
    const barkMaterial = ownMaterial(makeBarkMaterial());
    const stemMaterial = ownMaterial(new THREE.MeshStandardMaterial({
        name: 'Matte living vine stems', color: 0x626147, vertexColors: true,
        roughness: .91, metalness: 0, envMapIntensity: .4
    }));
    const earthMaterial = ownMaterial(new THREE.MeshStandardMaterial({
        name: 'Humus and basket soil', color: 0x675b43, vertexColors: true,
        roughness: 1, metalness: 0, envMapIntensity: .25
    }));
    const potMaterial = ownMaterial(new THREE.MeshStandardMaterial({
        name: 'Unglazed weathered basket clay', color: 0x806554, vertexColors: true,
        roughness: .94, metalness: 0, envMapIntensity: .45
    }));
    const crownLeaf = ownGeometry(leafGeometry(.16, .31, 41, 2, false)); // 16 tris
    const ivyLeaf = ownGeometry(leafGeometry(.14, .18, 13, 7, false, true)); // 56 tris
    const frond = ownGeometry(makeFernFrond(97));

    function register(mesh, section, name) {
        mesh.name = name;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        sections[section].add(mesh);
        meshes.push(mesh);
        return mesh;
    }

    function instances(geometry, material, entries, section, name) {
        if (!entries.length) return;
        const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
        for (let i = 0; i < entries.length; i++) {
            mesh.setMatrixAt(i, entries[i].matrix);
            mesh.setColorAt(i, entries[i].color);
        }
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        // Instance bounds, not the tiny source geometry bounds. Essential for
        // r160 frustum culling; avoid one giant never-culled forest instance set.
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        return register(mesh, section, name);
    }

    function solid(writer, material, section, name) {
        if (!writer.indices.length) return;
        return register(new THREE.Mesh(ownGeometry(writer.geometry(name)), material), section, name);
    }

    function addTree(base, height, variant, random, wood, leaves) {
        const lean = new THREE.Vector3((random() - .5) * 1.7, 0, (random() - .5) * 1.7);
        const crownWidth = [2.65, 2.95, 3.15][variant] * (.94 + random() * .12);
        const leafSize = [.93, 1.07, 1.13][variant];
        const trunk = new THREE.CubicBezierCurve3(base,
            base.clone().add(new THREE.Vector3(lean.z * .4, height * .31, -lean.x * .4)),
            base.clone().addScaledVector(lean, .6).add(new THREE.Vector3(0, height * .70, 0)),
            base.clone().add(lean).add(new THREE.Vector3(0, height, 0)));
        const radius = height * (.023 + random() * .007);
        const trunkPath = curvePoints(trunk, 8);
        wood.tube(trunkPath, radius, .023, 10);
        for (let root = 0; root < 4; root++) {
            const angle = root * TAU / 4 + random() * .7;
            const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            wood.tube([base.clone().add(new THREE.Vector3(0, .50, 0)),
                base.clone().addScaledVector(outward, radius * 1.5).add(new THREE.Vector3(0, .07, 0)),
                base.clone().addScaledVector(outward, radius * 2.8).add(new THREE.Vector3(0, -.01, 0))],
            radius * .58, .026, 5);
        }
        const phase = random() * TAU;
        // Eleven irregular scaffold limbs, three secondary forks per limb,
        // three terminal shoots per fork, twelve leaves per shoot: 1,188 actual
        // leaves per tree. Broad, overlapping crowns replace the sparse poles.
        for (let limb = 0; limb < 11; limb++) {
            const t = .24 + limb * .056 + random() * .022;
            const angle = phase + limb * 2.39996 + (random() - .5) * .70;
            const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const side = new THREE.Vector3(-outward.z, 0, outward.x);
            const reach = crownWidth * (1 - limb * .050) * (.88 + random() * .16);
            const rise = (limb < 4 ? .85 : 1.35) + random() * .65;
            const sweep = (random() - .5) * .8;
            const start = pathFrame(trunkPath, t).point;
            const branch = new THREE.CubicBezierCurve3(start,
                start.clone().addScaledVector(outward, reach * .35).addScaledVector(side, sweep * .35)
                    .add(new THREE.Vector3(0, -.25 + random() * .30, 0)),
                start.clone().addScaledVector(outward, reach * .72).addScaledVector(side, sweep)
                    .add(new THREE.Vector3(0, rise * .45, 0)),
                start.clone().addScaledVector(outward, reach).addScaledVector(side, sweep * .60)
                    .add(new THREE.Vector3(0, rise, 0)));
            const branchPath = curvePoints(branch, 5);
            wood.tube(branchPath, radius * (1 - t) * .76, .013, 5);
            for (let fork = 0; fork < 3; fork++) {
                const attach = pathFrame(branchPath, .25 + fork * .34).point;
                const sign = fork % 2 ? 1 : -1;
                const extension = outward.clone().multiplyScalar(.35 + random() * .25)
                    .addScaledVector(side, sign * (.45 + random() * .40));
                extension.y = .12 + random() * .48;
                const secondary = new THREE.CubicBezierCurve3(attach,
                    attach.clone().addScaledVector(extension, .30).add(new THREE.Vector3(0, -.08, 0)),
                    attach.clone().addScaledVector(extension, .72).add(new THREE.Vector3(0, .11, 0)),
                    attach.clone().add(extension));
                const secondaryPath = curvePoints(secondary, 3);
                wood.tube(secondaryPath, .030 - fork * .006, .004, 4);
                for (let shoot = 0; shoot < 3; shoot++) {
                    const root = pathFrame(secondaryPath, .20 + shoot * .37).point;
                    const shootAngle = angle + sign * .55 + (shoot - 1) * 1.10 + random() * .36;
                    const axis = new THREE.Vector3(Math.cos(shootAngle), 0, Math.sin(shootAngle));
                    const lateral = new THREE.Vector3(-axis.z, 0, axis.x);
                    const tip = root.clone().addScaledVector(axis, .50 + random() * .28);
                    tip.y += -.24 + random() * .67;
                    const twig = new THREE.QuadraticBezierCurve3(root,
                        root.clone().lerp(tip, .56).add(new THREE.Vector3(0, .13, 0)), tip);
                    const twigPath = curvePoints(twig, 2);
                    wood.tube(twigPath, .007, .0012, 3);
                    for (let node = 0; node < 12; node++) {
                        const point = pathFrame(twigPath, .09 + node * .079).point;
                        const turn = node % 2 ? -1 : 1;
                        const direction = lateral.clone().multiplyScalar(turn * (.7 + random() * .3))
                            .addScaledVector(axis, .28 + random() * .38);
                        direction.y = -.32 + random() * .88;
                        const matrix = leafMatrix(crownLeaf, point, direction,
                            leafSize * (.95 + random() * .47), (random() - .5) * 2.0);
                        matrix.scale(new THREE.Vector3(.78 + random() * .40, 1, .85 + random() * .3));
                        const color = foliageTint(random, .92 + variant * .035);
                        // New terminal growth is fractionally warmer than mature
                        // shaded leaves, without neon tips or toy-green crowns.
                        if (node > 8) color.r *= 1.05;
                        leaves.push({ matrix, color });
                    }
                }
            }
        }
    }

    function fernClump(base, scale, random, entries) {
        for (let i = 0; i < 5; i++) {
            const angle = i * 2.39996 + random() * .34;
            const size = scale * (.64 + random() * .28);
            const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler((random() - .5) * .16, angle, 0, 'YXZ'));
            entries.push({ matrix: new THREE.Matrix4().compose(base, rotation,
                new THREE.Vector3(size, size * (.88 + random() * .17), size)), color: foliageTint(random) });
        }
    }

    // Eight small exterior sectors: three bays on each long wall and two end
    // groves. All trunks AND crowns remain outside the greenhouse footprint.
    const groves = [];
    for (const side of [-1, 1]) {
        for (let bay = 0; bay < 3; bay++) groves.push({ x: side * 14.4, z: -38 + bay * 18, side });
    }
    groves.push({ x: 0, z: -53, side: 0 }, { x: 0, z: 13, side: 0 });
    groves.forEach((grove, sector) => {
        const random = randomSource(1200 + sector * 89);
        const wood = new GeometryWriter(), leaves = [], ferns = [];
        for (let tree = 0; tree < 2; tree++) {
            const x = grove.side ? grove.x + grove.side * tree * 5.1 + (random() - .5) * .85
                : (tree - .5) * 10 + (random() - .5) * 1.5;
            const z = grove.side ? grove.z + (tree ? -5.4 : 2.7) + (random() - .5) * 2.5
                : grove.z + (tree ? -1 : 1) * .8;
            addTree(new THREE.Vector3(x, -.02, z), 8.3 + random() * 3.8, (sector + tree) % 3, random, wood, leaves);
        }
        // Irregular multi-stem shrubs put green at the window sill/eye line.
        // Each leaf is still attached to a woody shoot, including the understory.
        for (let shrub = 0; shrub < 3; shrub++) {
            const base = new THREE.Vector3(grove.side ? grove.side * (10.3 + random() * 1.8) : -7 + shrub * 7,
                0, grove.side ? grove.z - 5 + shrub * 4.3 + random() * 1.4 : grove.z + (random() - .5) * 3);
            for (let stem = 0; stem < 3; stem++) {
                const angle = stem * 2.39996 + random();
                const axis = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                const top = base.clone().addScaledVector(axis, .26 + random() * .35);
                top.y += 1.0 + random() * .85;
                const path = [base, base.clone().lerp(top, .52).add(new THREE.Vector3(0, .12, 0)), top];
                wood.tube(path, .024, .004, 4);
                for (let fork = 0; fork < 3; fork++) {
                    const root = pathFrame(path, .34 + fork * .26).point;
                    const direction = new THREE.Vector3(Math.cos(angle + fork * 1.8), .35, Math.sin(angle + fork * 1.8));
                    const end = root.clone().addScaledVector(direction, .45 + random() * .23);
                    wood.tube([root, end], .006, .0015, 3);
                    for (let node = 0; node < 6; node++) {
                        const leafDirection = new THREE.Vector3(-direction.z, .18, direction.x)
                            .multiplyScalar(node % 2 ? 1 : -1).addScaledVector(direction, .40);
                        leaves.push({ matrix: leafMatrix(crownLeaf, root.clone().lerp(end, .12 + node * .17),
                            leafDirection, 1.05 + random() * .35, (random() - .5) * .8), color: foliageTint(random) });
                    }
                }
            }
        }
        const fernBase = new THREE.Vector3(grove.side ? grove.side * 10.2 : 6, .015,
            grove.side ? grove.z : grove.z + 3);
        fernClump(fernBase, .75, random, ferns);
        const bark = solid(wood, barkMaterial, 'forest', `Grove ${sector}: mature trunks, forked branches and shrubs`);
        const foliage = instances(crownLeaf, leafMaterial, leaves, 'forest', `Grove ${sector}: dense individual crown and shrub leaves`);
        // The six side groves provide real leaf-shaped sun shadows through the
        // glazing. No cutout shadow material and no per-frame shadow invalidation.
        bark.castShadow = foliage.castShadow = sector < 6;
        instances(frond, leafMaterial, ferns, 'undergrowth', `Grove ${sector}: understory fern`);
    });

    function vine(curve, random, stems, leaves, spacing = .21, scale = 1, surfaceNormal = FRONT) {
        const length = curve.getLength();
        const stemPath = curvePoints(curve, Math.max(4, Math.ceil(length * 3)));
        stems.tube(stemPath, .011, .002, 4);
        const count = Math.max(2, Math.floor(length / spacing));
        for (let node = 0; node < count; node++) {
            const t = (node + .35) / count;
            const { point, tangent } = pathFrame(stemPath, t);
            const outward = new THREE.Vector3().crossVectors(tangent, surfaceNormal);
            if (outward.lengthSq() < .01) outward.set(1, 0, 0);
            outward.normalize().multiplyScalar(node % 2 ? -1 : 1);
            const direction = outward.addScaledVector(tangent, .24);
            direction.addScaledVector(surfaceNormal, (random() - .5) * .45);
            direction.normalize();
            const end = point.clone().addScaledVector(direction, .035 * scale);
            stems.tube([point, end], .003, .0013, 3);
            leaves.push({ matrix: leafMatrix(ivyLeaf, end, direction,
                scale * (.72 + random() * .40) * (1 - t * .14), (random() - .5) * .75, surfaceNormal),
            color: foliageTint(random) });
        }
    }

    // Four longitudinal batches; the aisle |x|<1.8 remains clear at eye height
    // and above. Side-wall growth is confined to |x|>6, away from task benches.
    for (let bay = 0; bay < 4; bay++) {
        const random = randomSource(5600 + bay * 17);
        const z0 = -43 + bay * 12;
        const stems = new GeometryWriter(), ivy = [], ferns = [];
        for (const side of [-1, 1]) {
            const x = side * 7.52;
            const wallNormal = new THREE.Vector3(-side, 0, 0);
            const climbing = new THREE.CatmullRomCurve3([
                new THREE.Vector3(x, .04, z0 + 2), new THREE.Vector3(x - side * .12, 1.6, z0 + 2.3),
                new THREE.Vector3(x, 3.5, z0 + 1.8), new THREE.Vector3(x - side * .08, 5.70, z0 + 2.5)
            ]);
            vine(climbing, random, stems, ivy, .23, 1, wallNormal);
            const runner = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, i) =>
                new THREE.Vector3(side * (7.35 + Math.sin(i * 1.9) * .09),
                    5.77 + Math.sin(i * 2.1) * .065, z0 + i * 2.0)));
            vine(runner, random, stems, ivy, .27, 1.04, wallNormal);
            for (let drop = 0; drop < 2; drop++) {
                const anchor = runner.getPoint(.25 + drop * .47);
                vine(new THREE.CubicBezierCurve3(anchor,
                    anchor.clone().add(new THREE.Vector3(-side * .08, -.38, .16)),
                    anchor.clone().add(new THREE.Vector3(-side * .12, -1.2, -.15)),
                    anchor.clone().add(new THREE.Vector3(-side * .25, -1.7 - random() * .35, .12))),
                random, stems, ivy, .27, .85, wallNormal);
            }
            fernClump(new THREE.Vector3(side * 6.9, .02, z0 + 3.2), .85, random, ferns);
        }
        solid(stems, stemMaterial, 'ivy', `Interior bay ${bay}: ivy stems and attached petioles`);
        instances(ivyLeaf, leafMaterial, ivy, 'ivy', `Interior bay ${bay}: solid lobed ivy`);
        instances(frond, leafMaterial, ferns, 'ferns', `Interior bay ${bay}: five-frond edge ferns`);
    }

    // Bowl, cords and soil are two merged draws for all five baskets; foliage
    // and vines are two more. The small footprint above benches culls as a unit.
    const basketClay = new GeometryWriter(), basketSoil = new GeometryWriter();
    const basketStems = new GeometryWriter(), basketLeaves = [];
    const bowlProfile = [[0, -.23], [.10, -.23], [.19, -.15], [.26, -.02], [.265, .025],
        [.235, .025], [.225, -.025], [.16, -.14], [0, -.16]].map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = new THREE.LatheGeometry(bowlProfile, 14);
    const soil = new THREE.CylinderGeometry(.222, .20, .028, 14);
    const spots = [[-3, -6], [3, -10], [-3, -18], [3, -26], [-3, -34]];
    spots.forEach(([x, z], index) => {
        const random = randomSource(7800 + index * 33);
        const base = new THREE.Vector3(x, 2.55, z);
        basketClay.append(bowl, new THREE.Matrix4().makeTranslation(x, base.y, z));
        basketSoil.append(soil, new THREE.Matrix4().makeTranslation(x, base.y - .045, z));
        for (let cord = 0; cord < 3; cord++) {
            const angle = cord / 3 * TAU;
            basketStems.tube([base.clone().add(new THREE.Vector3(Math.cos(angle) * .25, .02, Math.sin(angle) * .25)),
                new THREE.Vector3(x, 3, z)], .004, .004, 3, [.66, .61, .51]);
        }
        for (let strand = 0; strand < 8; strand++) {
            const angle = strand * 2.39996;
            const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const start = base.clone().addScaledVector(radial, .05);
            start.y -= .028;
            const trail = strand < 5;
            const reach = trail ? .33 : .25;
            const end = base.clone().addScaledVector(radial, reach);
            end.y += trail ? -.55 - random() * .35 : .22 + random() * .12;
            vine(new THREE.CubicBezierCurve3(start,
                base.clone().addScaledVector(radial, .20).add(new THREE.Vector3(0, .25, 0)),
                base.clone().addScaledVector(radial, reach * 1.2).add(new THREE.Vector3(0, trail ? -.25 : .27, 0)), end),
            random, basketStems, basketLeaves, .12, .90, radial);
        }
    });
    bowl.dispose();
    soil.dispose();
    solid(basketClay, potMaterial, 'baskets', 'Five hollow terracotta hanging bowls');
    solid(basketSoil, earthMaterial, 'baskets', 'Hanging basket soil');
    solid(basketStems, stemMaterial, 'baskets', 'Basket suspension cords and rooted trailing vines');
    instances(ivyLeaf, leafMaterial, basketLeaves, 'baskets', 'Attached basket foliage');

    // Replaces the old buildHauntedForest() floor side effect. Opaque earth is
    // actual ground, with a precise rectangular opening for the parent's floor.
    const ground = new GeometryWriter();
    for (const [x0, x1, z0, z1] of [[-64, -8, -96, 56], [8, 64, -96, 56], [-8, 8, -96, -45], [-8, 8, 5, 56]]) {
        const nx = 8, nz = 12, first = ground.positions.length / 3;
        for (let j = 0; j <= nz; j++) {
            for (let i = 0; i <= nx; i++) {
                const x = THREE.MathUtils.lerp(x0, x1, i / nx), z = THREE.MathUtils.lerp(z0, z1, j / nz);
                const shade = .63 + .13 * Math.sin(x * .29 + Math.sin(z * .32)) * Math.sin(z * .41);
                ground.positions.push(x, -.045, z);
                ground.colors.push(shade * .91, shade, shade * .77);
                ground.uvs.push(x, z);
                if (i < nx && j < nz) {
                    const a = first + j * (nx + 1) + i;
                    ground.indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
                }
            }
        }
    }
    solid(ground, earthMaterial, 'ground', 'Opaque woodland soil outside greenhouse rectangle');

    const stats = { triangles: 0, drawCalls: meshes.length, leafInstances: 0, fernFronds: 0, trees: 16,
        crownLeavesPerTree: 1188, shadowDrawCalls: meshes.filter(mesh => mesh.castShadow).length,
        sections: {}, budget: { triangles: 500000, drawCalls: 49 } };
    for (const [name, section] of Object.entries(sections)) {
        const totals = { triangles: 0, drawCalls: 0 };
        section.traverse(mesh => {
            if (!mesh.isMesh) return;
            const count = mesh.isInstancedMesh ? mesh.count : 1;
            totals.triangles += mesh.geometry.index.count / 3 * count;
            totals.drawCalls++;
            if (mesh.geometry === frond) stats.fernFronds += count;
            if (mesh.geometry === crownLeaf || mesh.geometry === ivyLeaf) stats.leafInstances += count;
        });
        stats.sections[name] = totals;
        stats.triangles += totals.triangles;
    }
    stats.leafInstances += stats.fernFronds * 25;
    group.userData.botanicalStats = stats;
    let disposed = false;
    function dispose() {
        if (disposed) return;
        disposed = true;
        group.removeFromParent();
        // InstancedMesh owns renderer-side instance buffers in addition to the
        // shared geometry; disposing only geometry leaks those on each rebuild.
        for (const mesh of meshes) if (mesh.isInstancedMesh) mesh.dispose();
        const textures = new Set();
        for (const material of materials) {
            for (const value of Object.values(material)) if (value && value.isTexture) textures.add(value);
            material.dispose();
        }
        for (const texture of textures) texture.dispose();
        for (const geometry of geometries) geometry.dispose();
        for (const section of Object.values(sections)) section.clear();
        group.clear();
        meshes.length = 0;
        geometries.clear();
        materials.clear();
    }
    if (stats.triangles >= stats.budget.triangles || stats.drawCalls > stats.budget.drawCalls) {
        dispose();
        throw new Error(`Botanical budget exceeded: ${stats.triangles} triangles, ${stats.drawCalls} draws.`);
    }
    scene.add(group);
    return { group, sections, stats, dispose };
}
