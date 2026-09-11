import * as THREE from 'three';

// One static, opaque mesh. The walking floor stays exactly level; the woodland
// rises beyond the foundation, so a ruler-straight plane does not cut across
// the photographed forest. Metre-scale vertex color breaks up repeated mud.
export function createWoodlandGroundGeometry() {
    const geometry = new THREE.PlaneGeometry(200, 200, 128, 128);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const colors = new Float32Array(position.count * 3);
    const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const dx = Math.max(0, Math.abs(x) - 8.5);
        const dz = Math.max(0, Math.abs(z + 20) - 25.5);
        const distance = Math.hypot(dx, dz);
        const outside = smooth(0, 5, distance);
        const broad = .5 + .25 * Math.sin(x * .31 + Math.sin(z * .19))
            + .25 * Math.cos(z * .27 - Math.sin(x * .23));
        const fine = .5 + .5 * Math.sin(x * 1.17 + Math.cos(z * .91));
        const rise = smooth(4, 35, distance) * (1.3 + broad * 1.8);
        position.setY(i, outside * (.025 + broad * .20 + fine * .06) + rise);
        const shade = .94 + .06 * fine;
        const forest = .50 + .30 * broad;
        colors[i * 3] = THREE.MathUtils.lerp(shade, forest * .83, outside);
        colors[i * 3 + 1] = THREE.MathUtils.lerp(shade, forest, outside);
        colors[i * 3 + 2] = THREE.MathUtils.lerp(shade, forest * .67, outside);
        // Small continuous UV variation avoids straight repetition bands without
        // changing the source's average 1.3 m physical tile scale.
        uv.setXY(i, uv.getX(i) + .00065 * Math.sin(z * .63 + x * .17),
            uv.getY(i) + .00065 * Math.cos(x * .54 - z * .21));
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'Level greenhouse floor with rolling woodland soil';
    return geometry;
}
