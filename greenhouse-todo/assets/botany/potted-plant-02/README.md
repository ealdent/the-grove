# Photographed botanical surface

Source: [Potted Plant 02](https://polyhaven.com/a/potted_plant_02), by **Rico Cilliers**, published by Poly Haven under [CC0](https://polyhaven.com/license). Retrieved September 11, 2026 through the public Poly Haven API with the identifying User-Agent `TheGroveBotanyAssetPreparation/1.0`.

`originals/` retains the unmodified 2K diffuse, OpenGL normal, roughness and alpha-guide atlases, plus the files/info API responses. `provenance.json` records their source URLs, API MD5 checksums, independently computed SHA-256 hashes, derived-file SHA-256 hashes, and the full crop/normalization parameters. Only the three derived RGB PNG files are requested at runtime. No API call or external asset request occurs in the application.

## Geometry and texture derivation

This adapts the upper blade of the largest top-left photographed leaf into a pointed, mildly toothed leaf. The source's heart-shaped basal lobes are omitted. It is not a species-faithful basil or mint scan. Silhouette, curvature, thickness and asymmetric margins are actual closed geometry; the source alpha atlas is used **only offline** to locate and validate foliage pixels. It is never used for rendering or transparency.

All maps are 512 × 1024 RGB. For each normalized length `t`, source Y is `808 - 778*t`; source X follows the piecewise-linear midrib in the manifest. Scan outward from the midrib along that source row while guide values exceed 250. Inset each margin by seven source pixels, then taper both spans at the base with `smoothstep(0, .22, t)`. Map the two horizontal half-rows independently from midrib to their inset margin, using bilinear sampling. Every derived texel was validated against the source guide: minimum sampled value **255**. Even the rectangular maps' margins contain living tissue, so interpolation and mipmaps have no black atlas background to pick up.

The manifest's 18-row shape profile uses those source spans, normalized by their largest combined width. Alternate margins contract by 3.8% and 3.2% on staggered rows to produce shallow teeth; endpoints close to points. The task mesh uses 16 interior rings and an eight-vertex thin lens cross-section, with matching upper/lower diagonals and separate margin normals: **256 triangles**. Local Y length and centered basal point `(0, -length/2, 0)` are unchanged. UV `(0.5, 0)` is the base; `(0.5, 1)` is the tip.

- **Diffuse:** decode sRGB to linear, divide each channel by its sampled source mean, multiply by 0.65, clamp to `[0.12, 0.98]`, encode sRGB. The mean is sampled on an eight-pixel grid of the normalized sheet. This removes the captured mean green while retaining photographic vascular contrast, mottling and relative chroma. Keep the application's healthy `0x819456` tint and existing yellow/brown health colors; do not switch to white.
- **Normal:** sample the original OpenGL tangent-space vectors and renormalize them. Runtime `normalScale` is `(0.45, 0.45)`. There is no second bump map, custom shader hook, or synthesized vein overlay.
- **Roughness:** `clamp(0.57 + (source/255 - 0.38)*0.68, 0.42, 0.78)`. The material's roughness scalar is 1. Normal and roughness use linear/no color space; diffuse uses sRGB.

PNG row zero is the tip. Runtime Canvas2D decoding reverses rows into preallocated DataTextures with `flipY=false`. Canvas2D is used only once for loading pixels, never for alpha silhouettes or per-frame work.

## Integration and lifetime

`createBotanicalLeafMaterial()` returns a stock MeshStandardMaterial with all three shared texture objects already bound. Task material clones and PlantBatches clones retain those exact objects while pixels load in place. No map replacement, material-key change, shader hook, or batch rebuild is needed. The maps occupy approximately 8 MiB including mipmaps, shared across every task leaf.

`await texturesReady()` starts/joins loading and resolves `{status, loaded, failed}`. `status` is `ready`, `fallback`, or `disposed`. Use `ready` as the benchmark readiness check. A request failure, decode failure, invalid dimensions, nonopaque pixels or a 15-second timeout preserves all three neutral fallback maps atomically; failures are reported rather than silently called ready. In a non-DOM environment it resolves to fallback immediately.

Material disposal does not dispose shared maps. Call `disposeBotanicalLeafTextures()` only after retiring every task material/cache and PlantBatches instance. It cancels pending publication, disposes the three maps once and permits a later fresh allocation. The static botanical environment owns separate procedural materials and is unaffected by this task-leaf atlas and its disposal.

Validation for this revision is CPU geometry/loading/batching and image inspection of the source/derived textures. No browser or WebGL preview was run during the parent's performance work. Lighting, normal-map appearance on the live plant, final health tint and hardware performance require the parent's final integrated check. Photorealism is not claimed.
