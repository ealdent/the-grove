import * as THREE from 'three';

const FLOOR_SIZE = 200;
const FLOOR_SEGMENTS = 128;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// Explicit grid lines at the foundation keep whole rendered triangles level,
// not just vertices. Uniform grid cells previously straddled the walls.
function gridWithBoundary(boundaries) {
    return [...new Set([...Array.from({ length: FLOOR_SEGMENTS + 1 }, (_, i) =>
        i * FLOOR_SIZE / FLOOR_SEGMENTS - FLOOR_SIZE / 2), ...boundaries])].sort((a, b) => a - b);
}
const X_GRID = gridWithBoundary([-8.5, 8.5]);
const Z_GRID = gridWithBoundary([-45.5, 5.5]);
const GRID_WIDTH = X_GRID.length;

function noise(x, z, seed) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const hash = (a, b) => {
        let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const u = fade(x - ix), v = fade(z - iz);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u),
        THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}

function terrainSample(x, z) {
    const dx = Math.max(0, Math.abs(x) - 8.5);
    const dz = Math.max(0, Math.abs(z + 20) - 25.5);
    const distance = Math.hypot(dx, dz);
    const outside = smooth(0, 3.8, distance);
    const warpX = x + 5 * (noise(x * .037, z * .037, 17) - .5);
    const warpZ = z + 5 * (noise(x * .042, z * .042, 73) - .5);
    const broad = noise(warpX * .063, warpZ * .063, 131);
    const folds = noise(warpX * .17, warpZ * .17, 419);
    const micro = noise(x * .43, z * .43, 823);
    // Preserve the established indoor color modulation and physical UV scale.
    const fine = .5 + .5 * Math.sin(x * 1.17 + Math.cos(z * .91));
    // Irregular, connected banks rise close to the walls and continue under
    // actual trees. No distant photographic projection, taper or horizon skirt.
    const bank = outside * (.42 + broad * .95 + folds * .28 + micro * .055);
    const rise = smooth(4, 23, distance) * (.32 + broad * 1.25 + folds * .40);
    return { outside, broad, fine, folds, height: bank + rise };
}

// Match the Float32 vertex heights and diagonal used by PlaneGeometry exactly.
// This immutable lookup also avoids resampling noise for every litter vertex.
const heights = new Float32Array(GRID_WIDTH * Z_GRID.length);
for (let z = 0; z < Z_GRID.length; z++) for (let x = 0; x < GRID_WIDTH; x++) {
    heights[z * GRID_WIDTH + x] = terrainSample(X_GRID[x], Z_GRID[z]).height;
}

function gridCell(grid, value) {
    let lo = 0, hi = grid.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >>> 1;
        if (grid[mid] <= value) lo = mid;
        else hi = mid;
    }
    return Math.min(lo, grid.length - 2);
}

/** Pure world-space Y on the untransformed 200 m floor mesh. Interpolates its
 * actual triangles (including foundation-aligned cells), not smooth noise.
 * Finite X/Z in [-100, 100]; floor and tree/understory roots share world origin. */
export function getWoodlandGroundHeight(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 100 || Math.abs(z) > 100) {
        throw new RangeError('Woodland ground coordinates must be finite and within the 200 m floor.');
    }
    const ix = gridCell(X_GRID, x), iz = gridCell(Z_GRID, z);
    const u = (x - X_GRID[ix]) / (X_GRID[ix + 1] - X_GRID[ix]);
    const v = (z - Z_GRID[iz]) / (Z_GRID[iz + 1] - Z_GRID[iz]);
    const a = iz * GRID_WIDTH + ix;
    const h00 = heights[a], h10 = heights[a + 1];
    const h01 = heights[a + GRID_WIDTH], h11 = heights[a + GRID_WIDTH + 1];
    return u + v <= 1
        ? h00 + (h10 - h00) * u + (h01 - h00) * v
        : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

// One static, opaque mesh with two contiguous index groups: material 0 is the
// foundation mud; material 1 is the exterior forest litter (two beauty draws).
// The walking floor stays exactly level; the woodland
// is surrounded by irregular wooded banks with genuine modeled depth.
// Near-neutral exterior vertex colors preserve the scanned forest litter/moss.
export function createWoodlandGroundGeometry() {
    const geometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, X_GRID.length - 1, Z_GRID.length - 1);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const x = X_GRID[i % GRID_WIDTH], z = Z_GRID[Math.floor(i / GRID_WIDTH)];
        const { outside, broad, fine, folds, height } = terrainSample(x, z);
        position.setXYZ(i, x, height, z);
        uv.setXY(i, (x + 100) / 200, 1 - (z + 100) / 200);
        const shade = .94 + .06 * fine;
        const forest = .80 + .14 * broad;
        const moss = smooth(.42, .83, broad * .45 + folds * .55) * .4;
        colors[i * 3] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(1.02, .92, moss), outside);
        colors[i * 3 + 1] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(.98, 1, moss), outside);
        colors[i * 3 + 2] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(.93, .90, moss), outside);
        // Small continuous UV variation avoids straight repetition bands without
        // changing the source's average 1.3 m physical tile scale.
        uv.setXY(i, uv.getX(i) + .00065 * Math.sin(z * .63 + x * .17),
            uv.getY(i) + .00065 * Math.cos(x * .54 - z * .21));
    }
    // Boundary-aligned cells never cross the foundation. Reorder indices only:
    // both material groups retain every original triangle and its diagonal,
    // so the pure height sampler and existing tree/plant placement stay exact.
    const foundation = [], exterior = [];
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
        const triangle = [indices[i], indices[i + 1], indices[i + 2]];
        const inside = triangle.every(index => position.getX(index) >= -8.5 && position.getX(index) <= 8.5
            && position.getZ(index) >= -45.5 && position.getZ(index) <= 5.5);
        (inside ? foundation : exterior).push(...triangle);
    }
    geometry.setIndex(new THREE.BufferAttribute(new indices.constructor([...foundation, ...exterior]), 1));
    geometry.clearGroups();
    geometry.addGroup(0, foundation.length, 0);
    geometry.addGroup(foundation.length, exterior.length, 1);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'Level greenhouse floor with rolling woodland soil';
    return geometry;
}
