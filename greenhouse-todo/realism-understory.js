import * as THREE from 'three';
import { createBotanicalLeafMaterial } from './realism-botany.js';
import { getWoodlandGroundHeight } from './realism-terrain.js';

// Static, closed woodland silhouettes on the two banks: |X| = 10..40 m,
// Z = -55..15 m. Attach to the same untransformed scene as the terrain.
// Shrubs/ferns stay in the near 10..25 m belt; rooted creepers extend behind
// them to break up the exposed bank, in two independently culled depth bands.
// Photographed surface maps are shared with botany (Potted Plant 02, CC0;
// assets/botany/potted-plant-02/README.md). Their owner remains realism-botany.
// Await that module's texturesReady() before profiling. No animation tick,
// extra image downloads, alpha silhouettes, shader hooks or shadow casters.
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const GREENS = [0x697c43, 0x77864a, 0x819456, 0x5f733e].map(hex => new THREE.Color(hex));
const BROWNS = [0x796043, 0x8b704b, 0x61513b, 0x9a8157].map(hex => new THREE.Color(hex));
const STEM = new THREE.Color(0x656345);
const TWIG = new THREE.Color(0x635441);

function randomSource(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let n = Math.imul(state ^ (state >>> 15), state | 1);
        n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
        return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
}

// One buffer per category/bank. Upper/lower leaf surfaces have separate normals
// at their shared physical margins; even the 16-triangle fern blades are closed.
class Writer {
    positions = [];
    colors = [];
    uvs = [];
    indices = [];

    vertex(point, color, u = 0, v = 0) {
        const id = this.positions.length / 3;
        this.positions.push(point.x, point.y, point.z);
        this.colors.push(color.r, color.g, color.b);
        this.uvs.push(u, v);
        return id;
    }

    leaf(base, direction, normal, width, length, rings, color, curl = .015, onGround = false) {
        const along = direction.clone().normalize();
        const across = new THREE.Vector3().crossVectors(along, normal).normalize();
        const front = new THREE.Vector3().crossVectors(across, along).normalize();
        const thickness = Math.min(.00035, width * .004);
        for (const upper of [true, false]) {
            const shade = upper ? color : color.clone().multiplyScalar(.92);
            const vertex = (t, x) => {
                const span = Math.sin(Math.PI * t);
                const half = width * .5 * Math.pow(Math.max(0, span), .8);
                const point = base.clone().addScaledVector(along, length * t)
                    .addScaledVector(across, x * half * (1 + .08 * Math.sin(t * 9)))
                    .addScaledVector(front, length * (.055 * span + curl * t * t)
                        - half * .12 * x * x + (upper ? 1 : -1) * thickness * (1 - Math.abs(x)) * span);
                // Ground litter conforms at EVERY vertex, including curled tips;
                // a single root height cannot follow this coarse terrain grid.
                if (onGround) point.y += getWoodlandGroundHeight(point.x, point.z);
                return this.vertex(point, shade, (x + 1) / 2, t);
            };
            const triangle = (a, b, c) => upper ? this.indices.push(a, b, c) : this.indices.push(a, c, b);
            const baseId = vertex(0, 0), rows = [];
            for (let row = 1; row <= rings; row++) rows.push([-1, 0, 1].map(x => vertex(row / (rings + 1), x)));
            const tip = vertex(1, 0);
            triangle(baseId, rows[0][1], rows[0][0]);
            triangle(baseId, rows[0][2], rows[0][1]);
            for (let row = 0; row < rings - 1; row++) for (let col = 0; col < 2; col++) {
                const a = rows[row][col], b = rows[row][col + 1];
                const c = rows[row + 1][col], d = rows[row + 1][col + 1];
                triangle(a, b, d);
                triangle(a, d, c);
            }
            const last = rows[rings - 1];
            triangle(tip, last[0], last[1]);
            triangle(tip, last[1], last[2]);
        }
    }

    tube(points, radius, endRadius, color, sides = 5) {
        const rings = [];
        for (let i = 0; i < points.length; i++) {
            const tangent = points[Math.min(i + 1, points.length - 1)].clone()
                .sub(points[Math.max(0, i - 1)]).normalize();
            const u = new THREE.Vector3().crossVectors(tangent, Math.abs(tangent.y) > .9
                ? new THREE.Vector3(1, 0, 0) : UP).normalize();
            const v = new THREE.Vector3().crossVectors(tangent, u);
            const r = THREE.MathUtils.lerp(radius, endRadius, i / (points.length - 1));
            rings.push(Array.from({ length: sides }, (_, side) => {
                const angle = side / sides * TAU;
                return this.vertex(points[i].clone().addScaledVector(u, Math.cos(angle) * r)
                    .addScaledVector(v, Math.sin(angle) * r), color, side / sides, i);
            }));
        }
        for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
            const k = (j + 1) % sides;
            this.indices.push(rings[i][j], rings[i][k], rings[i + 1][j],
                rings[i][k], rings[i + 1][k], rings[i + 1][j]);
        }
        const first = this.vertex(points[0], color), last = this.vertex(points.at(-1), color);
        for (let j = 0; j < sides; j++) {
            const k = (j + 1) % sides;
            this.indices.push(first, rings[0][k], rings[0][j], last, rings.at(-1)[j], rings.at(-1)[k]);
        }
    }

    geometry() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
        geometry.setIndex(this.indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return geometry;
    }
}

function shrub(root, random, leaves, wood) {
    const height = .55 + random() * .42;
    const stem = [root, root.clone().add(new THREE.Vector3(.025, height * .45, .015)),
        root.clone().add(new THREE.Vector3(-.03, height, .03))];
    wood.tube(stem, .014, .003, STEM);
    for (let branch = 0; branch < 4; branch++) {
        const angle = branch * 2.4 + random() * .55;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const tStem = .22 + branch * .12;
        const base = tStem <= .45 ? stem[0].clone().lerp(stem[1], tStem / .45)
            : stem[1].clone().lerp(stem[2], (tStem - .45) / .55);
        const reach = .28 + random() * .21;
        const tip = base.clone().addScaledVector(radial, reach).addScaledVector(UP, height * .27);
        wood.tube([base, base.clone().lerp(tip, .55).addScaledVector(UP, .03), tip], .006, .0018, STEM);
        const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
        for (let leaf = 0; leaf < 5; leaf++) {
            const t = .18 + leaf * .16;
            const attachment = base.clone().lerp(tip, t).addScaledVector(UP, .03 * Math.min(t / .55, (1 - t) / .45));
            const direction = radial.clone().multiplyScalar(.45).addScaledVector(tangent, leaf % 2 ? .8 : -.8)
                .addScaledVector(UP, .23 + random() * .22).normalize();
            const petiole = attachment.clone().addScaledVector(direction, .035);
            wood.tube([attachment, petiole], .002, .001, STEM, 4);
            leaves.leaf(petiole, direction, UP, .11 + random() * .055,
                .20 + random() * .12, 3, GREENS[Math.floor(random() * GREENS.length)]);
        }
    }
}

function fern(root, random, leaves, wood) {
    const spin = random() * TAU;
    for (let frond = 0; frond < 4; frond++) {
        const angle = spin + frond * TAU / 4 + (random() - .5) * .4;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z, 0, radial.x);
        const reach = .65 + random() * .34;
        const arch = .27 + random() * .21;
        const point = t => {
            const p = root.clone().addScaledVector(radial, reach * t);
            p.y = getWoodlandGroundHeight(p.x, p.z) - .006 + .025 * t + arch * Math.sin(t * Math.PI * .8);
            return p;
        };
        // Leaflet attachment points are actual rachis vertices, not points on
        // a different smooth curve between the rendered stem segments.
        const ts = [0, ...Array.from({ length: 7 }, (_, i) => .18 + i * .105), 1];
        wood.tube(ts.map(point), .006, .0012, STEM, 4);
        for (let pair = 0; pair < 7; pair++) {
            const t = ts[pair + 1], length = (.22 + random() * .035) * (1 - .62 * t);
            for (const side of [-1, 1]) {
                const direction = lateral.clone().multiplyScalar(side).addScaledVector(radial, .38)
                    .addScaledVector(UP, .10).normalize();
                leaves.leaf(point(t), direction, UP, length * .24, length, 2, GREENS[(pair + frond) % GREENS.length]);
            }
        }
        leaves.leaf(point(1), radial.clone().addScaledVector(UP, .12), UP, .031, .14, 2, GREENS[1]);
    }
}

function groundCover(x, z, random, leaves, wood, litter) {
    const spin = random() * TAU;
    for (let runner = 0; runner < 3; runner++) {
        const angle = spin + runner * 2.3 + random() * .4;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z, 0, radial.x);
        const reach = .55 + random() * .48;
        const ts = [0, .20, .42, .64, .86, 1];
        const points = ts.map(t => {
            const px = x + radial.x * reach * t, pz = z + radial.z * reach * t;
            return new THREE.Vector3(px, getWoodlandGroundHeight(px, pz)
                - .003 + .021 * Math.sin(Math.PI * t), pz);
        });
        // Rooted at both ends, with connected nodes/petioles. This is a low
        // creeping plant, not a collection of loose green leaf silhouettes.
        wood.tube(points, .004, .002, STEM, 3);
        for (let node = 1; node <= 4; node++) for (const side of [-1, 1]) {
            const direction = lateral.clone().multiplyScalar(side).addScaledVector(radial, .32)
                .addScaledVector(UP, .18 + random() * .12).normalize();
            const base = points[node].clone().addScaledVector(direction, .025).addScaledVector(UP, .033);
            wood.tube([points[node], base], .0018, .001, STEM, 3);
            leaves.leaf(base, direction, UP, .14 + random() * .07, .25 + random() * .13,
                2, GREENS[(runner + node) % GREENS.length], .035);
        }
        // Shed leaves collect alongside each rooted runner and sample the soil
        // at every vertex just like the near-bank litter.
        for (let leaf = 0; leaf < 2; leaf++) {
            const point = points[leaf + 2].clone().addScaledVector(lateral, (random() - .5) * .55);
            point.y = .0015;
            litter.leaf(point, radial, UP, .09 + random() * .04, .16 + random() * .08,
                2, BROWNS[(runner + leaf) % BROWNS.length], .05 + random() * .12, true);
        }
    }
}

/** Adds twelve opaque, static beauty batches; all counts include both banks.
 * dispose() retires only this group, its geometry and its material instances.
 * It never disposes or alters botany's shared photo texture objects. */
export function createWoodlandUnderstory(scene) {
    if (!scene?.isObject3D) throw new TypeError('Woodland understory needs a Three.js scene/group.');
    const group = new THREE.Group();
    group.name = 'Terrain-attached woodland understory';
    const live = createBotanicalLeafMaterial(), dead = createBotanicalLeafMaterial();
    // Vertex colors supply the calibrated tint; shared photo texture objects
    // are never modified. Brown litter is a tinted leaf-scan reuse.
    live.color.setHex(0xffffff);
    dead.color.setHex(0xffffff);
    dead.normalScale.set(.25, .25);
    dead.roughnessMap = null;
    dead.roughness = .96;
    const woody = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        roughness: .98, metalness: 0, envMapIntensity: .4 });
    const materials = [live, dead, woody], meshes = [];
    const roots = [];
    const stats = { drawCalls: 0, triangles: 0, shadowDrawCalls: 0,
        shrubs: 0, ferns: 0, litterLeaves: 0, twigs: 0, groundCoverPatches: 0, groundCoverLeaves: 0,
        budget: { drawCalls: 12, triangles: 150000 }, bounds: null };
    for (const bank of [-1, 1]) {
        const random = randomSource(bank === -1 ? 0x4f372 : 0x9a117);
        const shrubLeaves = new Writer(), fernLeaves = new Writer(), litter = new Writer(), wood = new Writer();
        for (let patch = 0; patch < 18; patch++) {
            const z = -51 + patch * 62 / 17 + (random() - .5) * 2;
            const x = bank * (11.8 + random() * 1.8 + 1.5 * Math.sin(z * .12 + bank) ** 2
                + (patch % 5 === 3 ? 6 : 0));
            const root = new THREE.Vector3(x, getWoodlandGroundHeight(x, z) - .012, z);
            roots.push(root.toArray());
            shrub(root, random, shrubLeaves, wood);
            stats.shrubs++;
            const fernRoot = root.clone().add(new THREE.Vector3(bank * (.45 + random() * .3), 0, (random() - .5) * .8));
            fernRoot.y = getWoodlandGroundHeight(fernRoot.x, fernRoot.z);
            fern(fernRoot, random, fernLeaves, wood);
            stats.ferns++;
            // Litter accumulates around the same root/fern pockets. Its long
            // axes loosely follow the bank; no independent airborne scattering.
            for (let leaf = 0; leaf < 14; leaf++) {
                const angle = random() * TAU, radius = Math.sqrt(random()) * 1.45;
                const base = new THREE.Vector3(x + Math.cos(angle) * radius, .0015, z + Math.sin(angle) * radius);
                const yaw = (random() - .5) * 2.3;
                litter.leaf(base, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), UP,
                    .07 + random() * .065, .13 + random() * .14, 3,
                    BROWNS[Math.floor(random() * BROWNS.length)], .04 + random() * .16, true);
                stats.litterLeaves++;
            }
            for (let twig = 0; twig < 3; twig++) {
                const bx = x + (random() - .5) * 1.9, bz = z + (random() - .5) * 1.9;
                const angle = random() * TAU, length = .30 + random() * .45;
                const path = Array.from({ length: 4 }, (_, i) => {
                    const t = i / 3;
                    const px = bx + Math.cos(angle) * length * t;
                    const pz = bz + Math.sin(angle) * length * t + .04 * Math.sin(t * Math.PI);
                    return new THREE.Vector3(px, getWoodlandGroundHeight(px, pz) + .005, pz);
                });
                wood.tube(path, .009, .003, TWIG);
                stats.twigs++;
            }
        }
        const nearCover = new Writer(), farCover = new Writer();
        // Separate seed keeps the original shrub/fern pockets stable. Irregular
        // patches fill their gaps and reach behind the foreground trees; they
        // never form a continuous hedge or a repeating strip at the photo seam.
        const coverRandom = randomSource(bank === -1 ? 0x713b2 : 0x285f9);
        for (const distant of [false, true]) for (let patch = 0; patch < 14; patch++) {
            const z = -51 + patch * 62 / 13 + (coverRandom() - .5) * 1.8;
            const x = bank * (distant ? 23 + coverRandom() * 14
                : 12 + coverRandom() * 6 + 1.3 * Math.sin(z * .17 + bank) ** 2);
            groundCover(x, z, coverRandom, distant ? farCover : nearCover, wood, litter);
            stats.groundCoverPatches++;
            stats.groundCoverLeaves += 24;
            stats.litterLeaves += 6;
        }
        for (const [writer, material, name] of [[shrubLeaves, live, 'Shrub leaves'],
            [fernLeaves, live, 'Fern blades'], [litter, dead, 'Curled leaf litter'],
            [wood, woody, 'Attached stems and fallen twigs'], [nearCover, live, 'Bank ground cover'],
            [farCover, live, 'Distant ground cover']]) {
            const geometry = writer.geometry(), mesh = new THREE.Mesh(geometry, material);
            mesh.name = `${bank < 0 ? 'West' : 'East'} woodland: ${name}`;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            group.add(mesh);
            meshes.push(mesh);
            stats.triangles += geometry.index.count / 3;
            stats.drawCalls++;
        }
    }
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.union(mesh.geometry.boundingBox);
    stats.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    group.userData.understoryStats = stats;
    group.userData.shrubRoots = roots;
    let disposed = false;
    function dispose() {
        if (disposed) return;
        disposed = true;
        group.removeFromParent();
        for (const mesh of meshes) mesh.geometry.dispose();
        for (const material of materials) material.dispose();
        group.clear();
        meshes.length = 0;
    }
    if (stats.triangles > stats.budget.triangles || stats.drawCalls > stats.budget.drawCalls) {
        dispose();
        throw new Error(`Woodland understory exceeds budget: ${stats.triangles} triangles / ${stats.drawCalls} draws.`);
    }
    scene.add(group);
    return { group, stats, dispose };
}
