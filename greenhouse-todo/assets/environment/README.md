# Current runtime detail

The app now loads the original **4096 × 2048** `forest_slope_4k.hdr` (29,764,886 bytes).
Its source URL and SHA-256 are in [detail-upgrade-provenance.json](../detail-upgrade-provenance.json).
RGBA16F storage is approximately 64 MiB before the derived PMREM. The earlier 2K
asset below remains archived with the first-pass evidence. Both are unchanged CC0
versions of Andreas Mischok's same photographed panorama.

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

The parent has integrated this HDR as the visible background with a PMREM-derived
image-based lighting environment. Source inspection confirms RGBELoader and
`pmremGen.fromEquirectangular(texture)` in `loadWoodlandEnvironment()`. The pattern
below summarizes that setup; this asset slice changes no application/module API:

```js
const hdr = await new RGBELoader().loadAsync(
    new URL('./assets/environment/forest_slope_4k.hdr', import.meta.url).href
);
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.background = hdr;
const environmentTarget = pmremGen.fromEquirectangular(hdr);
scene.environment = environmentTarget.texture;
```

RGBELoader r160 provides linear-sRGB half-float data. **Do not set the HDR to
SRGBColorSpace.** Retain ACES/output color management in the integrating app.
Use the PMREM for environment lighting and keep the original equirectangular
texture for the visible background. Keep both resources alive while in use;
dispose the render target and HDR texture when replacing/removing them. A 2K
RGBA16F image is about 16 MiB on the GPU before derived cube/PMREM storage.

This panorama records one location and one lighting condition. It supplies
rotation-correct surroundings but no translation parallax or changing weather.
Nearby photographed trunks/rocks will not move physically as the camera walks;
keep real foreground geometry and check the transition in the greenhouse.
Review existing sky meshes, distant tree planes, fog, direct sunlight, and night
behavior during integration so they do not obscure or contradict the panorama.
The four-direction preview loaded at 2048 × 1024 with linear color space and no
console warnings/errors. Full-app compositing, exposure, night behavior, and
120-plant performance remain unverified in this asset task.
