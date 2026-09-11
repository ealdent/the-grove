import * as THREE from 'three';
import { createBotanicalLeafMaterial } from './realism-botany.js';
import { getWoodlandGroundHeight } from './realism-terrain.js';

// Dense, closed woodland understory in eight spatial sections surrounding the
// entire greenhouse. Attach to the same untransformed scene as the terrain.
// Three opaque buffers per section keep culling local and beauty draws at 24.
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
// at their shared physical margins; even distant 8-triangle blades are closed.
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

    leaf(base, direction, normal, width, length, rings, color, curl = .015, onGround = false, followsBank = false, sword = false) {
        const along = direction.clone().normalize();
        const across = new THREE.Vector3().crossVectors(along, normal).normalize();
        const front = new THREE.Vector3().crossVectors(across, along).normalize();
        const thickness = Math.min(.00035, width * .004);
        const baseHeight = followsBank ? getWoodlandGroundHeight(base.x, base.z) : 0;
        for (const upper of [true, false]) {
            const shade = upper ? color : color.clone().multiplyScalar(.92);
            const vertex = (t, x) => {
                const span = Math.sin(Math.PI * t);
                const profile = sword ? Math.pow(Math.max(0, span), .65) * (1.18 - .48 * t)
                    : Math.pow(Math.max(0, span), .8);
                const half = width * .5 * profile;
                const point = base.clone().addScaledVector(along, length * t)
                    .addScaledVector(across, x * half * (1 + .08 * Math.sin(t * 9)))
                    .addScaledVector(front, length * (.055 * span + curl * t * t)
                        - half * .12 * x * x + (upper ? 1 : -1) * thickness * (1 - Math.abs(x)) * span);
                // Ground litter conforms at EVERY vertex, including curled tips;
                // a single root height cannot follow this coarse terrain grid.
                if (onGround) point.y += getWoodlandGroundHeight(point.x, point.z);
                else if (followsBank) point.y += getWoodlandGroundHeight(point.x, point.z) - baseHeight;
                // Narrow fern pinnae use the photographed central vein region;
                // broad bramble/creeper leaves retain the full original surface.
                return this.vertex(point, shade, sword ? .5 + x * .20 : (x + 1) / 2, t);
            };
            const triangle = (a, b, c) => upper ? this.indices.push(a, b, c) : this.indices.push(a, c, b);
            if (sword && rings > 1) {
                // Six-point lanceolate margin and one raised midrib vertex per
                // side. Twelve triangles retain the slender curved silhouette
                // without spending broad-leaf topology on each small pinna.
                const margin = [[0, 0], [.28, -1], [.67, -1], [1, 0], [.67, 1], [.28, 1]]
                    .map(([t, x]) => vertex(t, x));
                const ridge = vertex(.44, 0);
                for (let i = 0; i < margin.length; i++) triangle(ridge, margin[(i + 1) % margin.length], margin[i]);
                continue;
            }
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

// Arching bramble canes carry compound groups of three leaves at real nodes.
function bramble(root, random, leaves, wood) {
    for (let cane = 0; cane < 3; cane++) {
        const angle = cane * 2.4 + random() * .55;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z, 0, radial.x);
        const reach = .9 + random() * .55, height = .70 + random() * .5;
        const ts = [0, .18, .38, .61, .82, 1];
        const points = ts.map(t => {
            const p = root.clone().addScaledVector(radial, reach * t)
                .addScaledVector(lateral, .13 * Math.sin(t * Math.PI));
            p.y = getWoodlandGroundHeight(p.x, p.z) - .012 + height * Math.sin(t * Math.PI * .95);
            return p;
        });
        wood.tube(points, .012, .002, STEM, 4);
        for (let node = 1; node <= 4; node++) {
            const hub = points[node].clone().addScaledVector(radial, .045).addScaledVector(UP, .055);
            wood.tube([points[node], hub], .003, .0012, STEM, 3);
            for (const side of [-1, 0, 1]) {
                const direction = radial.clone().multiplyScalar(side ? .36 : 1)
                    .addScaledVector(lateral, side * .9).addScaledVector(UP, .23 + random() * .22).normalize();
                leaves.leaf(hub, direction, UP, .18 + random() * .085,
                    .30 + random() * .16, 2, GREENS[(node + cane) % GREENS.length], .03, false, true);
            }
        }
    }
}

function fern(root, random, leaves, wood, distant = false) {
    const spin = random() * TAU;
    const pairs = distant ? 12 : 20;
    const rings = distant ? 1 : 2;
    // Keep the original random-stream consumption so changes to this fern's
    // botanical detail never move any neighboring plant, litter or deadwood.
    const shapes = Array.from({ length: 6 }, () => ({ jitter: (random() - .5) * .35,
        reach: 1.15 + random() * .42, arch: .72 + random() * .40,
        variation: Array.from({ length: distant ? 8 : 12 }, () => random()) }));
    const fronds = 8;
    for (let frond = 0; frond < fronds; frond++) {
        const { jitter, reach, arch, variation } = shapes[frond % shapes.length];
        const angle = spin + frond * TAU / fronds + jitter;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z, 0, radial.x);
        const pinnaLength = .25 + variation[0] * .03;
        const pinnaWidth = .048 + variation[1] * .007;
        const point = t => {
            const p = root.clone().addScaledVector(radial, reach * t);
            p.y = getWoodlandGroundHeight(p.x, p.z) - .006 + .035 * t + arch * Math.sin(t * Math.PI * .93);
            return p;
        };
        const ts = [0, ...Array.from({ length: pairs }, (_, i) => .10 + i * .87 / (pairs - 1)), 1];
        wood.tube(ts.map(point), .008, .0013, STEM, 3);
        for (let pair = 0; pair < pairs; pair++) {
            const t = ts[pair + 1];
            // Slender sword pinnae: mature blades are about 18–28 cm by
            // 3.5–5.5 cm. Progressively smaller distal pairs finish the frond's
            // feathered outline; no oversized oval foliage at the tip.
            const taper = 1 - .84 * THREE.MathUtils.smoothstep(t, .55, .99);
            const basal = .80 + .20 * THREE.MathUtils.smoothstep(t, .10, .27);
            const length = pinnaLength * basal * taper;
            const width = pinnaWidth * basal * Math.pow(taper, .7);
            const tangent = radial.clone().multiplyScalar(reach)
                .addScaledVector(UP, .035 + arch * Math.PI * .93 * Math.cos(t * Math.PI * .93)).normalize();
            const normal = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
            for (const side of [-1, 1]) {
                const direction = lateral.clone().multiplyScalar(side).addScaledVector(tangent, .48).normalize();
                leaves.leaf(point(t), direction, normal, width, length, rings,
                    GREENS[frond % GREENS.length], .016, false, true, true);
            }
        }
        leaves.leaf(point(1), radial.clone().addScaledVector(UP, -.2), UP, .015, .09,
            rings, GREENS[frond % GREENS.length], .016, false, true, true);
    }
    return fronds * (pairs * 2 + 1);
}

function groundCover(x, z, random, leaves, wood, litter) {
    const spin = random() * TAU;
    for (let runner = 0; runner < 3; runner++) {
        const angle = spin + runner * 2.3 + random() * .4;
        const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const lateral = new THREE.Vector3(-radial.z, 0, radial.x);
        const reach = .8 + random() * .55;
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
                2, GREENS[(runner + node) % GREENS.length], .035, false, true);
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

// Fallen limbs have grounded lower surfaces and irregular offshoots. Exposed
// roots connect to the fallen root end and re-enter the soil; no canopy blobs.
function fallenWood(root, tangent, random, wood) {
    const angle = (random() - .5) * .55;
    const direction = tangent.clone().applyAxisAngle(UP, angle);
    const length = 2.1 + random() * 1.5, radius = .11 + random() * .055;
    const start = root.clone().addScaledVector(direction, -length * .5);
    const points = Array.from({ length: 8 }, (_, i) => {
        const t = i / 7, p = start.clone().addScaledVector(direction, length * t);
        p.y = getWoodlandGroundHeight(p.x, p.z) + radius * .62 + .055 * Math.sin(t * Math.PI);
        return p;
    });
    wood.tube(points, radius, radius * .54, TWIG, 7);
    for (let branch = 0; branch < 2; branch++) {
        const origin = points[branch * 3 + 2];
        const outward = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(branch ? -1 : 1);
        const path = Array.from({ length: 4 }, (_, i) => {
            if (!i) return origin;
            const t = i / 3, p = origin.clone().addScaledVector(outward, t * (.45 + branch * .2));
            p.y = getWoodlandGroundHeight(p.x, p.z) + .025 + .12 * (1 - t);
            return p;
        });
        wood.tube(path, .045, .008, TWIG, 5);
    }
    for (let rootIndex = 0; rootIndex < 5; rootIndex++) {
        const angle = rootIndex * 1.9 + random() * .55;
        const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const reach = 1.0 + random() * 1.1;
        const path = Array.from({ length: 7 }, (_, i) => {
            if (!i) return points[0];
            const t = i / 6, p = points[0].clone().addScaledVector(outward, reach * t);
            p.x += .11 * Math.sin(t * 6 + rootIndex) * Math.sin(t * Math.PI);
            p.y = getWoodlandGroundHeight(p.x, p.z) + .027 * Math.sin(t * Math.PI) - .004;
            return p;
        });
        wood.tube(path, .07, .006, TWIG, 5);
    }
}

const CHUNKS = [
    ...[-1, 1].flatMap(side => [[-48, -29], [-29, -10], [-10, 8]].map(([start, end], i) =>
        ({ name: `${side < 0 ? 'West' : 'East'} ${i + 1}`, side, start, end, endCap: false }))),
    { name: 'South end', side: -1, start: -9, end: 9, endCap: true },
    { name: 'North end', side: 1, start: -9, end: 9, endCap: true },
];

/** Dense, opaque geometry on all four sides: eight spatial sections / 24 draws.
 * Rebuild with the terrain when changing its height function. All data is static.
 * dispose() owns only this group's buffers/materials, never shared photo maps. */
export function createWoodlandUnderstory(scene) {
    if (!scene?.isObject3D) throw new TypeError('Woodland understory needs a Three.js scene/group.');
    const group = new THREE.Group();
    group.name = 'Dense terrain-attached woodland understory';
    const live = createBotanicalLeafMaterial(), dead = createBotanicalLeafMaterial();
    live.color.setHex(0xffffff);
    dead.color.setHex(0xffffff);
    dead.normalScale.set(.25, .25);
    dead.roughnessMap = null;
    dead.roughness = .96;
    const woody = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
        roughness: .98, metalness: 0, envMapIntensity: .4 });
    const materials = [live, dead, woody], meshes = [], roots = [], sections = {};
    const stats = { drawCalls: 0, triangles: 0, shadowDrawCalls: 0, chunks: CHUNKS.length,
        shrubs: 0, brambles: 0, ferns: 0, fernFronds: 0, litterLeaves: 0, twigs: 0,
        groundCoverPatches: 0, groundCoverLeaves: 0, fallenLogs: 0, exposedRoots: 0,
        liveLeaves: 0, budget: { drawCalls: 29, triangles: 1800000 }, bounds: null, sections: {} };
    for (let chunk = 0; chunk < CHUNKS.length; chunk++) {
        const spec = CHUNKS[chunk], random = randomSource(0x783a1 + chunk * 173);
        const leaves = new Writer(), litter = new Writer(), wood = new Writer();
        const section = new THREE.Group();
        section.name = `Understory: ${spec.name}`;
        sections[spec.name] = section;
        group.add(section);
        const tangent = spec.endCap ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        const site = (i, count, depth) => {
            const along = THREE.MathUtils.lerp(spec.start, spec.end, (i + .25 + random() * .5) / count);
            const x = spec.endCap ? along : spec.side * (8.5 + depth);
            const z = spec.endCap ? (spec.side > 0 ? 5.5 + depth : -45.5 - depth) : along;
            return new THREE.Vector3(x, getWoodlandGroundHeight(x, z), z);
        };
        const totals = { triangles: 0, drawCalls: 3, ferns: 0, brambles: 8, groundCoverPatches: 12 };
        // Overlapping crowns form continuous growth from the foundation into
        // the tree belt. Density follows physical spacing; outer bands use
        // fewer pinnae/rings, while each whole section remains independently culled.
        for (const [band, depth] of [2.3, 3.95, 5.9, 8.4].entries()) {
            const count = Math.ceil((spec.end - spec.start) / (band < 2 ? 1.3 : 1.7));
            for (let i = 0; i < count; i++) {
                const root = site(i, count, depth + (random() - .5) * .28);
                stats.liveLeaves += fern(root, random, leaves, wood, band >= 2);
                roots.push({ kind: 'fern', point: root.toArray(), section: spec.name, band });
                stats.ferns++; totals.ferns++; stats.fernFronds += 8;
            }
        }
        for (let i = 0; i < 8; i++) {
            const root = site(i, 8, 3.8 + (i % 2) * 2.3 + random() * .85);
            bramble(root, random, leaves, wood);
            roots.push({ kind: 'bramble', point: root.toArray(), section: spec.name });
            stats.brambles++; stats.shrubs++; stats.liveLeaves += 36;
        }
        for (let i = 0; i < 12; i++) {
            const root = site(i, 12, (i % 3 ? 2.05 : 6.6) + random() * .25);
            groundCover(root.x, root.z, random, leaves, wood, litter);
            roots.push({ kind: 'creeper', point: root.toArray(), section: spec.name });
            stats.groundCoverPatches++; stats.groundCoverLeaves += 24; stats.liveLeaves += 24; stats.litterLeaves += 6;
        }
        for (let i = 0; i < 400; i++) {
            // Stratified pockets cluster under the same vegetation belt, with
            // small gaps and overlaps instead of uniformly airborne scattering.
            const root = site(i, 400, .65 + (random() ** .7) * 9.2);
            root.y = .0015;
            const angle = random() * TAU;
            litter.leaf(root, new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), UP,
                .085 + random() * .065, .15 + random() * .17, 2,
                BROWNS[Math.floor(random() * BROWNS.length)], .04 + random() * .18, true);
            stats.litterLeaves++;
        }
        for (let i = 0; i < 4; i++) {
            const root = site(i, 4, 6.6 + random() * 1.8);
            fallenWood(root, tangent, random, wood);
            stats.fallenLogs++; stats.exposedRoots += 5;
        }
        for (let i = 0; i < 24; i++) {
            const root = site(i, 24, 1.8 + random() * 6.5);
            const angle = random() * TAU, length = .3 + random() * .7;
            const path = Array.from({ length: 4 }, (_, j) => {
                const t = j / 3, x = root.x + Math.cos(angle) * length * t;
                const z = root.z + Math.sin(angle) * length * t;
                return new THREE.Vector3(x, getWoodlandGroundHeight(x, z) + .005, z);
            });
            wood.tube(path, .012, .003, TWIG, 5);
            stats.twigs++;
        }
        for (const [writer, material, name] of [[leaves, live, 'Layered fern and bramble foliage'],
            [litter, dead, 'Curled leaf litter'], [wood, woody, 'Stems, deadwood and exposed roots']]) {
            const geometry = writer.geometry(), mesh = new THREE.Mesh(geometry, material);
            mesh.name = `${spec.name}: ${name}`;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            section.add(mesh); meshes.push(mesh);
            totals.triangles += geometry.index.count / 3;
            stats.drawCalls++;
        }
        stats.sections[spec.name] = totals;
        stats.triangles += totals.triangles;
    }
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.union(mesh.geometry.boundingBox);
    stats.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    group.userData.understoryStats = stats;
    group.userData.plantRoots = roots;
    let disposed = false;
    function dispose() {
        if (disposed) return;
        disposed = true;
        group.removeFromParent();
        for (const mesh of meshes) mesh.geometry.dispose();
        for (const material of materials) material.dispose();
        for (const section of Object.values(sections)) section.clear();
        group.clear(); meshes.length = 0;
    }
    if (stats.triangles >= stats.budget.triangles || stats.drawCalls > stats.budget.drawCalls) {
        dispose();
        throw new Error(`Woodland understory exceeds budget: ${stats.triangles} triangles / ${stats.drawCalls} draws.`);
    }
    scene.add(group);
    return { group, sections, stats, dispose };
}
