import * as THREE from 'three';

const FLOOR_SIZE = 200;
const FLOOR_SEGMENTS = 128;
const CELL_SIZE = FLOOR_SIZE / FLOOR_SEGMENTS;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

function terrainSample(x, z) {
    const dx = Math.max(0, Math.abs(x) - 8.5);
    const dz = Math.max(0, Math.abs(z + 20) - 25.5);
    const distance = Math.hypot(dx, dz);
    const outside = smooth(0, 5, distance);
    const broad = .5 + .25 * Math.sin(x * .31 + Math.sin(z * .19))
        + .25 * Math.cos(z * .27 - Math.sin(x * .23));
    const fine = .5 + .5 * Math.sin(x * 1.17 + Math.cos(z * .91));
    // A low bank, not a distant 1–3 m ridge silhouetted against the photograph.
    // Beyond the planting belt, ease back to shallow relief. The entire opaque
    // 200 m floor stays present; there is no alpha fade, hole or sunken skirt.
    const rise = smooth(4, 18, distance) * (.12 + broad * .24);
    const bank = outside * (.025 + broad * .14 + fine * .04) + rise;
    const taper = smooth(18, 60, distance);
    const height = THREE.MathUtils.lerp(bank, outside * (.035 + broad * .012), taper);
    return { outside, broad, fine, height };
}

// Match the Float32 vertex heights and diagonal used by PlaneGeometry exactly.
// This immutable lookup also avoids resampling noise for every litter vertex.
const heights = new Float32Array((FLOOR_SEGMENTS + 1) ** 2);
for (let z = 0; z <= FLOOR_SEGMENTS; z++) for (let x = 0; x <= FLOOR_SEGMENTS; x++) {
    heights[z * (FLOOR_SEGMENTS + 1) + x] = terrainSample(
        x * CELL_SIZE - FLOOR_SIZE / 2, z * CELL_SIZE - FLOOR_SIZE / 2).height;
}

/** Pure world-space Y on the existing, untransformed 200 m floor mesh.
 * Interpolates its triangles, not the smooth formula between vertices.
 * Valid domain: finite X/Z in [-100, 100]. The floor remains at world origin. */
export function getWoodlandGroundHeight(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 100 || Math.abs(z) > 100) {
        throw new RangeError('Woodland ground coordinates must be finite and within the 200 m floor.');
    }
    const gx = (x + FLOOR_SIZE / 2) / CELL_SIZE, gz = (z + FLOOR_SIZE / 2) / CELL_SIZE;
    const ix = Math.min(FLOOR_SEGMENTS - 1, Math.floor(gx));
    const iz = Math.min(FLOOR_SEGMENTS - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz, a = iz * (FLOOR_SEGMENTS + 1) + ix;
    const h00 = heights[a], h10 = heights[a + 1];
    const h01 = heights[a + FLOOR_SEGMENTS + 1], h11 = heights[a + FLOOR_SEGMENTS + 2];
    return u + v <= 1
        ? h00 + (h10 - h00) * u + (h01 - h00) * v
        : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

// One static, opaque mesh. The walking floor stays exactly level; the woodland
// has a shallow bank beyond the foundation and settles toward the forest photo.
// Warm litter/olive vertex tints retain the photographed mud's surface detail.
export function createWoodlandGroundGeometry() {
    const geometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE, FLOOR_SEGMENTS, FLOOR_SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const { outside, broad, fine, height } = terrainSample(x, z);
        position.setY(i, height);
        const shade = .94 + .06 * fine;
        const forest = .54 + .10 * broad;
        const moss = smooth(.42, .83, broad * .65 + fine * .35) * .4;
        colors[i * 3] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(1.08, .77, moss), outside);
        colors[i * 3 + 1] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(.91, .95, moss), outside);
        colors[i * 3 + 2] = THREE.MathUtils.lerp(shade, forest * THREE.MathUtils.lerp(.61, .56, moss), outside);
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

const TRANSITION_START = 20;
// The nearest edge of the 200 m floor is 54.5 m outside the foundation.
// Finish just before it so EVERY perimeter fragment reaches the panorama.
const TRANSITION_END = 54;
const groundTransitions = new WeakMap();

/** Pure counterpart of the shader's blend weight, measured outside the same
 * foundation rectangle as the height function. Interior/near-bank weight is 0. */
export function getWoodlandGroundTransitionWeight(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const dx = Math.max(0, Math.abs(x) - 8.5);
    const dz = Math.max(0, Math.abs(z + 20) - 25.5);
    return smooth(TRANSITION_START, TRANSITION_END, Math.hypot(dx, dz));
}

function isLinearPanorama(texture) {
    return !!(texture?.isTexture && !texture.isCubeTexture && !texture.isRenderTargetTexture
        && !texture.isDataArrayTexture && !texture.isData3DTexture
        && (texture.type === THREE.HalfFloatType || texture.type === THREE.FloatType)
        && (texture.colorSpace === THREE.LinearSRGBColorSpace || texture.colorSpace === THREE.NoColorSpace)
        && texture.image?.height > 0 && texture.image.width === texture.image.height * 2);
}

/** Opt-in opaque transition for the NON-INSTANCED stock standard/physical floor.
 * Pass the decoded linear RGBELoader panorama also assigned to scene.background,
 * not its PMREM. Assumes the current unrotated, unblurred perspective background
 * and the floor's default toneMapped=true. The HDR is sampled before the normal
 * tone-mapping/output-color steps, with no albedo, exposure or gamma baked in.
 *
 * const transition = applyWoodlandGroundTransition(floorMaterial, hdr, scene.backgroundIntensity);
 * transition.setIntensity(scene.backgroundIntensity); // uniform-only day/night update
 *
 * Returns { setIntensity, enabled, reason }; enabled/reason are live getters.
 * A missing/invalid panorama keeps the lit ground. Reapply later to bind a valid
 * HDR or replace/disable it; this never stacks hooks or adds texture lookups.
 * Each material owns its uniform objects. No texture is cloned, changed or
 * disposed; keep the parent's panorama alive while the floor uses it.
 */
export function applyWoodlandGroundTransition(material, panorama, intensity = 1) {
    if (!material?.isMeshStandardMaterial) {
        throw new TypeError('Woodland ground transition needs a stock MeshStandardMaterial or MeshPhysicalMaterial.');
    }
    let record = groundTransitions.get(material);
    if (!record) {
        const uniforms = {
            woodlandPanorama: { value: null },
            woodlandPanoramaEnabled: { value: 0 },
            woodlandBackgroundIntensity: { value: 1 },
        };
        record = { uniforms, installed: false, reason: null, control: null };
        record.control = {
            setIntensity(value) {
                uniforms.woodlandBackgroundIntensity.value = Number.isFinite(value) ? Math.max(0, value) : 1;
            },
            get enabled() { return uniforms.woodlandPanoramaEnabled.value === 1; },
            get reason() { return record.reason; },
        };
        groundTransitions.set(material, record);
    }
    const valid = isLinearPanorama(panorama);
    record.uniforms.woodlandPanorama.value = valid ? panorama : null;
    record.uniforms.woodlandPanoramaEnabled.value = valid ? 1 : 0;
    record.reason = valid ? null : 'A decoded linear 2:1 HDR panorama is required; keeping lit ground.';
    record.control.setIntensity(intensity);
    if (!valid || record.installed) return record.control;

    const previousCompile = material.onBeforeCompile;
    // Capture BEFORE replacing the hook: Three's default key reads that hook.
    const previousCacheKey = material.customProgramCacheKey();
    const common = '#include <common>', world = '#include <worldpos_vertex>';
    const opaque = '#include <opaque_fragment>', fog = '#include <fog_fragment>';
    material.onBeforeCompile = function (shader, renderer) {
        previousCompile.call(this, shader, renderer);
        // Fail atomically to the existing lit shader if a future/custom shader
        // removes an anchor. Never leave a partially patched shader to compile.
        const anchors = [[shader.vertexShader, common], [shader.vertexShader, world],
            [shader.fragmentShader, common], [shader.fragmentShader, opaque], [shader.fragmentShader, fog]];
        if (anchors.some(([source, marker]) => source.split(marker).length !== 2)) {
            record.uniforms.woodlandPanoramaEnabled.value = 0;
            record.reason = 'Unsupported floor shader anchors; keeping lit ground.';
            return;
        }
        shader.vertexShader = shader.vertexShader.replace(common,
            `${common}\nvarying vec3 vWoodlandGroundPosition;`).replace(world, `${world}
            // worldPosition is conditional in r160/r184; compute independently.
            vWoodlandGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        shader.fragmentShader = shader.fragmentShader.replace(common, `${common}
            varying vec3 vWoodlandGroundPosition;
            uniform sampler2D woodlandPanorama;
            uniform float woodlandPanoramaEnabled;
            uniform float woodlandBackgroundIntensity;`).replace(opaque, `
            float woodlandBlend = 0.0;
            if (woodlandPanoramaEnabled > 0.5) {
                vec2 woodlandOutside = max(abs(vWoodlandGroundPosition.xz - vec2(0.0, -20.0))
                    - vec2(8.5, 25.5), vec2(0.0));
                woodlandBlend = smoothstep(${TRANSITION_START.toFixed(1)}, ${TRANSITION_END.toFixed(1)}, length(woodlandOutside));
                if (woodlandBlend > 0.0) {
                    vec3 woodlandDirection = normalize(vWoodlandGroundPosition - cameraPosition);
                    vec3 woodlandRadiance = texture2D(woodlandPanorama, equirectUv(woodlandDirection)).rgb;
                    outgoingLight = mix(outgoingLight, woodlandRadiance * woodlandBackgroundIntensity, woodlandBlend);
                }
            }
            ${opaque}`).replace(fog, `
            // The HDR background is not fogged. Preserve near-ground fog, but
            // do not tint the matched panorama again at the far perimeter.
            vec3 woodlandBeforeFog = gl_FragColor.rgb;
            ${fog}
            gl_FragColor.rgb = mix(gl_FragColor.rgb, woodlandBeforeFog, woodlandBlend);`);
        Object.assign(shader.uniforms, record.uniforms);
    };
    material.customProgramCacheKey = () => `${previousCacheKey}|woodland-ground-panorama-v1`;
    material.needsUpdate = true;
    record.installed = true;
    return record.control;
}
