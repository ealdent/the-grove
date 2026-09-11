# Greenhouse photographic assets

All source assets are CC0, downloaded from Poly Haven on September 11, 2026.
They are served locally; no API request is needed by the application.
[Poly Haven license](https://polyhaven.com/license).

| Surface | Source and author | Runtime maps |
| --- | --- | --- |
| Timber benches, wall boards and rafters | [Weathered Planks](https://polyhaven.com/a/weathered_planks), Dimitrios Savva / Dario Barresi | 2K albedo, OpenGL normal, roughness |
| Exterior earth and potting soil | [Brown Mud 02](https://polyhaven.com/a/brown_mud_02), Rob Tuytel | 1K albedo, OpenGL normal, roughness |
| Terracotta | [Planter Pot Clay](https://polyhaven.com/a/planter_pot_clay), Amal Kumar | 1K albedo and OpenGL normal |
| Task leaves | [Potted Plant 02](https://polyhaven.com/a/potted_plant_02), Rico Cilliers | Three 512 × 1024 maps derived from the photographed leaf atlas |
| Woodland background and lighting | [Forest Slope](https://polyhaven.com/a/forest_slope), Andreas Mischok | Original 4K HDR plus runtime PMREM |
| Glazing bars | [Rusty Metal 05](https://polyhaven.com/a/rusty_metal_05), Amal Kumar | 1K albedo, OpenGL normal, packed roughness/metallic |

## Provenance

- [Detail upgrade manifest](detail-upgrade-provenance.json): 2K timber and 4K woodland files, original source URLs and SHA-256.
- [Weathered steel manifest](materials/rusty_metal_05/provenance.json): original maps; the packed ARM green channel drives roughness and blue drives metallic coverage.
- [Wood and earth manifest](materials/manifest.json): original source URLs, sizes and SHA-256 hashes.
- [Terracotta notes](materials/planter_pot_clay/README.md) and [manifest](materials/planter_pot_clay/manifest.json): sampled exterior-wall atlas strip and original maps.
- [Leaf derivation](botany/potted-plant-02/README.md) and [provenance](botany/potted-plant-02/provenance.json): original atlas files, crop/normalization parameters and derived-file hashes.
- [HDR notes](environment/README.md) and [manifest](environment/manifest.json).

Original files are unchanged. The leaf maps are explicitly derived, normalized surface maps, applied to closed modeled blades. The source alpha guide is retained offline for provenance and is never requested or used for runtime cutout rendering. The archived clay roughness map is also not requested at runtime.

## Materials and physical scale

One world unit is one metre. Albedo uses sRGB; normal and roughness use linear data. Trilinear mip filtering and anisotropy up to eight reduce shimmer. Materials are opaque MeshStandardMaterial instances; the far ground adds a single panorama lookup to join the photographed horizon. No emissive foliage or extra transmission pass is used.

Wood UVs select the interior of a single photographed plank and follow each timber member's long axis. The two-metre source tile is not stretched across entire walls or wrapped indiscriminately around legs.

The 200 m earth plane uses 1.3 m tiles. The soil disc has planar UVs and 1.6 repeats for smaller surface detail. Because the source captures pale, dry mud, ground and potting soil use explicit color multipliers (0xb7a889 and 0x59442e). This is an art-directed adaptation to damp earth, not a calibrated scan of potting compost. Long clear sightlines can still expose tiling.

Clay samples only the exterior-wall band: repeat [1, 0.30], offset [0, 0.015]. Its photographed color is preserved. Uniform roughness 0.9 approximates unglazed clay while retaining stock-material batching.

Leaf color is normalized in linear sRGB so the existing green/yellow/brown task-health tint remains effective. Veins, mottling and normal detail come from the source photograph. The 256-triangle closed leaf is deliberately adapted; it is not a species-faithful botanical scan.

## Loading and lifetime

The surface factories return immediately with complete matte fallbacks. Their texturesReady() waits for all requested loads and reports failures, including a 90-second timeout for the larger surface set. Do not clone a still-loading surface material: share it, wait for readiness, then rebuild source batches. The app refreshes batches once surface loading finishes, including tasks loaded from a save.

Botanical textures use stable, preallocated texture identities, so cloned task/batch materials see the photographs when their pixels load. The separate botanical texturesReady() reports atomic success or fallback, with a 15-second timeout.

The 4K HDR has a 120-second deadline, accommodating roughly 48 seconds of transfer at 5 Mbps before overhead. The app's greenhouseDebug.prepare() combines surfaces, leaves and HDR readiness and compiles scene materials. The performance harness refuses a run with failed required assets. Rendering still needs warmup for actual GPU work.

Dispose returned surface materials only after their final owner is removed; their listeners own their texture clones. Task caches and batch materials share source resources for the page lifetime. See individual module/asset notes for ownership details and CPU checks.

Final integrated screenshots, performance results and remaining limits are in [REALISM.md](../REALISM.md).
