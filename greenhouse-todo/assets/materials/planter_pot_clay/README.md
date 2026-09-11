# Scanned pot and potting-soil additions

This supplements `assets/MATERIALS.md` with the two new exports in
`realism-materials.js`. Existing wood/ground exports and their texture settings
are unchanged. No application file or existing asset was edited for this addition.

## Actual terracotta source

The pot uses **Planter Pot Clay**, a photographed weathered terracotta planter by
**Amal Kumar**, from [Poly Haven](https://polyhaven.com/a/planter_pot_clay).
Downloaded 2026-09-11. **CC0-1.0** permits redistribution:
[Poly Haven license](https://polyhaven.com/license),
[CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/).

Three original 1024 × 1024 JPEG maps are vendored byte-for-byte, totaling
**1,628,629 bytes (1.55 MiB)**. `manifest.json` records their SHA-256 digests,
download URLs, byte counts, and the sampled UV region.

| Map | Bytes | Original file |
| --- | ---: | --- |
| Albedo | 596,319 | [planter_pot_clay_diff_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/planter_pot_clay/planter_pot_clay_diff_1k.jpg) |
| OpenGL normal | 506,446 | [planter_pot_clay_nor_gl_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/planter_pot_clay/planter_pot_clay_nor_gl_1k.jpg) |
| Roughness (retained original; unused at runtime) | 525,864 | [planter_pot_clay_rough_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/planter_pot_clay/planter_pot_clay_rough_1k.jpg) |

The factory requests only albedo and normal: **1,102,765 bytes**. The original
roughness image and its manifest entry remain intact for provenance.

This is a **model atlas**, not an arbitrarily tileable square clay texture. Its
lower rectangular strip captures the red exterior wall and wraps horizontally
around a cylinder. Both runtime maps use repeat **[1, 0.30]** and offset **[0, 0.015]**
with RepeatWrapping on U and ClampToEdgeWrapping on V. This maps standard cylinder
side UVs into image rows approximately 701–1009, excluding the circular cap and
interior-wall islands. It contains actual clay, wear, and mineral/paint residue;
there are no brick, floor-tile, or grout lines. Do not tile this atlas vertically.

The full albedo and normal atlas were visually inspected as local images. In the
used strip, mean sRGB albedo is approximately [147, 99, 80]. Average horizontal
edge differences are 1.50/255 for albedo and 1.22/255 for normal channels, supporting
the intended single circumferential wrap. The strip has roughly 307 pixels of
vertical detail at 1K, a tradeoff for retaining the original compact asset.

## Integration parameters

```js
import {
    createScannedPotMaterial,
    createScannedSoilMaterial,
    texturesReady,
} from './realism-materials.js';

// Cache/reuse these material instances across compatible meshes and batches.
const potMaterial = createScannedPotMaterial(renderer);
const soilMaterial = createScannedSoilMaterial(renderer);

// Share these instances; do not clone their still-loading fallbacks.
const report = await texturesReady();
// Inspect report.failed. Successful loading has already attached the maps.
// Now apply source/instance color variation and build/rebuild PlantBatches.
```

`createScannedPotMaterial(renderer)` returns a fresh `MeshStandardMaterial` with
metalness 0, no emission/clearcoat/transmission, and normal scale **[0.35, 0.35]**.
Successful loading uses a white multiplier to retain the photographed color.
Do not multiply it by the old dark terracotta base color. Its warm fallback is
`0xa56d51` at roughness **0.9**, also retained after successful loading.

The material preserves the photographed albedo and normal detail, with a uniform
**0.9 roughness** as an artistic approximation of matte, unglazed clay. It does
not sample the source's smoother worn/painted roughness patches: `roughnessMap`
stays **null**, and the roughness JPEG is never requested by the factory.
`onBeforeCompile` and `customProgramCacheKey` remain the inherited Three.js
defaults, satisfying PlantBatches' stock-material requirement. Wood, ground, and
soil retain their existing three-map settings. No custom shader hook is needed.

Use normalized cylinder side UVs: U once around the circumference and V from
bottom to top. This adapts the exterior strip to tapered cylinder proportions.
The same material can shade curved rims, but their geometry/UVs determine how
the wear appears. For a large change in aspect ratio, assess stretched detail.
Do not overwrite the pot map repeat/offset with generic world tiling settings.

**Share one ready material and apply variation through source/instance colors.**
Cloning before readiness copies fallback maps; later attachment updates only the
original material. Wait for `texturesReady()` before cloning or building batches;
if batches already captured fallback clones, rebuild them once after readiness.
Apply small tint variations after readiness, keeping the multiplier close to
white; setting the shared material's color changes every mesh using it.
Post-readiness clones share maps: keep the factory material alive while those
clones use its textures. Returned-material disposal owns its texture clones.

## Soil scale and source reuse

`createScannedSoilMaterial(renderer)` reuses the existing **Brown Mud 02** albedo,
OpenGL normal, and roughness maps by **Rob Tuytel**:
[official asset and CC0 license](https://polyhaven.com/a/brown_mud_02).
Their original URLs and hashes remain in `../manifest.json`. No duplicate soil
images are added or downloaded when the greenhouse ground has already loaded.

The original scan covers 1.3 m. This factory intentionally compresses the detail
to an apparent **0.25 m patch** for potting-soil granularity (5.2× smaller features).
For a **0.4 m diameter** CircleGeometry top with normal planar 0..1 UVs:

- All three map repeats: **[1.6, 1.6]**, from 0.4 / 0.25.
- All three offsets: **[-0.3, -0.3]**, centering the scan on the disc.
- Both wrap axes: RepeatWrapping.
- Normal scale: **[0.8, 0.8]**; roughness 1; metalness 0; no emission.
- Fallback: `0x4d4437`; loaded albedo multiplier: white.
- `userData.scannedMaterial.sourceTileMeters` remains 1.3;
  `detailTileMeters` is 0.25, distinguishing captured from displayed scale.

For a different final world-space top diameter D (including mesh/group scaling),
set all three repeats to `[D / 0.25, D / 0.25]` and offsets to
`[(1 - D / 0.25) / 2, (1 - D / 0.25) / 2]` after readiness. Keep all maps aligned.
Ground and potting-soil materials share the decoded images but have independent
texture transforms, so changing the soil cannot change the 200 m floor.

Albedo alone uses SRGBColorSpace. All normal/roughness maps use NoColorSpace;
anisotropy is hardware-limited and capped at 8. All existing timeout, fallback,
readiness, and disposal behavior applies to both additions. `texturesReady()`
includes the new factories without changing its signature or report format.

## Verification and limits

CPU-only checks with actual Three.js r160 pass for both additions: normalized
tapered-cylinder UVs remain in the exterior strip; disc centering/repeats and
shared Brown Mud sources are correct; color spaces, wrapping, anisotropy, material
disposal, and exact stock-hook prototype identity before/after loading are checked.
Pot roughness stays 0.9 with no roughness map or roughness image request. Creating
120 pots and 120 soil materials alongside wood/ground requests only **eight**
source images. A
missing or timed-out pot normal retains the pot fallback while wood/ground/soil
still become ready. Existing wood/ground regression checks pass.

Syntax and original-file hashes pass. The HDR and existing material maps are
unchanged. The final image payload including these new maps is **13,038,308 bytes**.
The runtime image payload is **12,512,444 bytes**, excluding the retained unused
pot roughness map. The two active pot maps add roughly 10.67 MiB of mipmapped
RGBA8 GPU storage; soil reuses
ground storage with the same sampler settings. These are estimates, not new
hardware benchmark results.

**No browser or GL previews were run**, per the parent's benchmark isolation
request. Actual shader compilation, the integrated daylight appearance, rim UVs,
and frame rate require the parent's authoritative UI tests. Texture shading does
not add geometric displacement: a flat soil disc still has a flat silhouette,
and pot darkness also depends on the scene lighting and any instance tint.
