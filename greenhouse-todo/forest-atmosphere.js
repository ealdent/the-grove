import * as THREE from 'three';

/** Sky radiance above the modeled canopy. No photographed landscape or tree
 * silhouettes: distant forest depth comes exclusively from opaque geometry. */
export function createForestAtmosphere() {
    const uniforms = {
        horizon: { value: new THREE.Color(0x667568) },
        zenith: { value: new THREE.Color(0x9ca9a7) },
        sunlight: { value: new THREE.Vector3(0, 1, 0) },
        daylight: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
        uniforms, side: THREE.BackSide, depthWrite: false,
        vertexShader: `varying vec3 skyDirection;
            void main() {
                skyDirection = position;
                vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
                gl_Position = p.xyww;
            }`,
        fragmentShader: `
            uniform vec3 horizon, zenith, sunlight;
            uniform float daylight;
            varying vec3 skyDirection;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
                return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                           mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
            }
            void main() {
                vec3 d = normalize(skyDirection);
                float altitude = smoothstep(0.0, 0.68, d.y);
                // Broad stationary cloud layers viewed from below, not a moving
                // screen-space overlay. The horizon matches the forest's fog.
                vec2 p = d.xz / max(0.18, d.y + 0.28);
                float cloud = 0.57*noise(p*2.1+4.7) + 0.28*noise(p*5.3-8.1)
                            + 0.15*noise(p*12.7+2.9);
                vec3 light = mix(horizon, zenith, altitude);
                light *= 1.0 + (cloud-0.5)*0.24*altitude*daylight;
                float halo = pow(max(0.0,dot(d,sunlight)),24.0);
                light += vec3(0.12,0.11,0.085)*halo*daylight*altitude;
                gl_FragColor = vec4(light,1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    mesh.name = 'Overcast sky above the forest canopy';
    mesh.renderOrder = -3;
    mesh.frustumCulled = false;
    return {
        mesh,
        update(fogColor, dayness, nightness, sunDirection) {
            uniforms.horizon.value.copy(fogColor);
            uniforms.zenith.value.setHex(0x9ca9a7).lerp(new THREE.Color(0x101c29), nightness);
            uniforms.daylight.value = dayness;
            uniforms.sunlight.value.copy(sunDirection);
        },
        dispose() { mesh.geometry.dispose(); material.dispose(); mesh.removeFromParent(); },
    };
}

/** r160 has no Scene.environmentIntensity. Scale the linear radiance once
 * before PMREM, retaining the forest's indirect color without open-sky fill. */
export function attenuateWoodlandRadiance(texture, gain = 0.48) {
    const data = texture.image?.data;
    if (!data || !Number.isFinite(gain) || gain < 0) return;
    const half = texture.type === THREE.HalfFloatType;
    if (!half && texture.type !== THREE.FloatType) return;
    for (let i = 0; i < data.length; i += 4) for (let channel = 0; channel < 3; channel++) {
        const value = half ? THREE.DataUtils.fromHalfFloat(data[i + channel]) : data[i + channel];
        data[i + channel] = half ? THREE.DataUtils.toHalfFloat(value * gain) : value * gain;
    }
    texture.needsUpdate = true;
}

// Only the greenhouse and its nearby canopy need directional shadow coverage.
// Fit in LIGHT space: a fixed world-Z-like orthographic offset clips the rear
// of the house when the sun moves east/west. Far forest batches do not cast.
export function fitForestShadow(light, direction) {
    light.target.position.set(0, 12, -20);
    light.position.copy(light.target.position).addScaledVector(direction, 100);
    light.target.updateMatrixWorld(true);
    light.updateMatrixWorld(true);
    light.shadow.updateMatrices(light);
    const camera = light.shadow.camera;
    const bounds = new THREE.Box3();
    const point = new THREE.Vector3();
    for (const x of [-30, 30]) for (const y of [-1, 36]) for (const z of [-65, 25]) {
        bounds.expandByPoint(point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    }
    camera.left = bounds.min.x - 1;
    camera.right = bounds.max.x + 1;
    camera.bottom = bounds.min.y - 1;
    camera.top = bounds.max.y + 1;
    camera.near = Math.max(.1, -bounds.max.z - 1);
    camera.far = -bounds.min.z + 1;
    camera.updateProjectionMatrix();
    light.shadow.updateMatrices(light);
}
