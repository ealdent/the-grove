# Current runtime use: lighting only

The forest correction removes the visible panorama and its ground transition. The app uses **2048 × 1024** `forest_slope_2k.hdr` (7,562,873 bytes) solely to build indirect lighting. It scales linear RGB radiance by 0.48 before PMREM to match the enclosed canopy. The source file is unchanged. Real modeled trees, terrain and an atmospheric sky supply the visible surroundings and translation parallax.

The **4096 × 2048** `forest_slope_4k.hdr` remains archived with the previous evidence, but is no longer requested by the runtime. Its original provenance is in [detail-upgrade-provenance.json](../detail-upgrade-provenance.json).

# Woodland environment

`forest_slope_2k.hdr` is an unchanged, photographed 360° outdoor woodland HDRI by
**Andreas Mischok**, downloaded from Poly Haven on 2026-09-11.

- [Official asset page](https://polyhaven.com/a/forest_slope)
- [Original HDR download](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/forest_slope_2k.hdr)
- License: **CC0-1.0**; [Poly Haven redistribution terms](https://polyhaven.com/license)
  and [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/).
- File size: **7,562,873 bytes (7.21 MiB)**.
- SHA-256: `aa76871c301a2ea5977043e48036b53bb3f26eff0d96fa833789a7738569c279`.
- Format: Radiance RGBE, `FORMAT=32-bit_rle_rgbe`, **2048 × 1024**, equirectangular.
- `manifest.json` contains the same provenance in machine-readable form.

The actual HDR was inspected in four horizontal directions using Three.js r160
RGBELoader in Chrome at `http://127.0.0.1:8773/environment.html`. It shows green
coniferous woodland, successive layers of trunks, moss, rocks, and soft summer
morning light. There is some dappled direct sunlight: this is not a uniformly
overcast capture. There are no studio panels, painted scenery, or tree cutouts.
The original capture includes nearby rock outcrops and trunks as well as distant
trees. It is a wooded slope, not a large flat clearing.

## Parent integration

`loadWoodlandEnvironment()` decodes the 2K source as linear half-float RGB, attenuates it once, and passes it to `pmremGen.fromEquirectangular`. The app assigns only the derived texture to `scene.environment`; `scene.background` remains null. An overcast sky mesh and actual forest geometry render the view. No floor shader samples this panorama.

RGBELoader r160 supplies linear-sRGB half-float data. Do not mark it sRGB; ACES/output conversion remains in the normal render pipeline. A 2K RGBA16F image is approximately 16 MiB before PMREM storage. The source GPU texture is disposed after PMREM conversion; the derived render target remains alive for lighting.

The capture contains dappled sunlight and cannot provide dynamic local occlusion. Modeled canopy shadows, muted direct light and restrained fill supply that approximation. It is not a baked or path-traced greenhouse lighting solution.
