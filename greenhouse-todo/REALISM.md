# Greenhouse rendering: design and evidence

## Acceptance target

A greenhouse with photographed surface detail, physical scale, modeled botanical silhouettes, readable daylight and lamp lighting, and smooth rapid movement with all 120 task slots filled. Preserve to-do creation, health, growth, completion, persistence, keyboard/touch input, and audio. Synthetic performance scenarios must not touch saved tasks.

Performance is measured on a named GPU at a stated drawing-buffer resolution. The target is a 16.67 ms frame budget, at least 60 frames in the worst full rolling second, and p99 below 16.67 ms after asset/shader warmup. Also report the worst individual interval; never conceal a hitch behind average FPS. A browser/OS can miss a presentation deadline even when scene rendering is under budget, so measured results are not a guarantee for every device or every future frame.

## Research and implementation plan

1. **Photographed materials.** Use vendored CC0 albedo, OpenGL normals, and roughness maps. Apply sRGB only to albedo, with linear lighting and exactly one display conversion. Physical tile size and separate UVs for long/narrow members matter more than increasing texture resolution. Sources: [Three.js color management](https://threejs.org/manual/en/color-management.html), [Poly Haven license](https://polyhaven.com/license). Exact assets and hashes: [assets/MATERIALS.md](assets/MATERIALS.md).
2. **Real silhouettes.** Replace alpha-cut tree/fern/ivy cards with closed leaf meshes, tapered branches, leaflets and attached vines. Keep modeled flower petals. Build benches from individual rounded planks, apron rails, stretchers, legs and fasteners. Select a single photographed board for narrow timber to avoid painting false joints onto it.
3. **Light and contact.** Use daylight/environment light, true shadow maps, restrained contact occlusion and non-glowing organic surfaces. Thin glazing uses angle-dependent reflection; at this scale a second full-scene refraction render is poor value. This is an explicit raster approximation, not ray tracing. [MeshPhysicalMaterial cost and features](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).
4. **Bound rendering work.** Share task geometry and completed-flower prototypes. Instance task parts in spatial chunks, retain original task objects for interaction, and synchronize only changed plants. Merge static structural members. Eight local hooded spotlights with two cached shadow maps replace twenty point lights with four six-face maps. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
5. **Spend pixels where they matter.** Render at one physical pixel per CSS pixel on desktop (up to 1920×1080 in the benchmark). Contact AO runs at half resolution; remove redundant transparency renders and bloom. SMAA stabilizes edges because the AO beauty target does not inherit the canvas's antialiasing. [N8AO documentation](https://github.com/N8python/n8ao).
6. **Measure and iterate.** Test 120 growing plants, 120 completed flowers, and a mixed scene during an 8 m/s route with fast turns and close inspections. Repeat daylight, dusk and night. Keep GPU timing queries asynchronous, include all rendering passes in draw counters, and exclude hidden-tab intervals explicitly.

## Second implementation pass

After pushing `1479c99` to `origin/main`, implementation continued:

- **Matrix work:** retain hidden task hierarchies with matrix updates frozen. Explicit `sync` temporarily restores their original update flags, updates transforms, then freezes them again. Rebuild/removal/disposal restores caller ownership, including children moved between roots. The scene's identity transform no longer forces all retained descendants dirty every render pass.
- **Botanical form:** replace the old open petal builders with closed curved surfaces for five permanent saved species. A shared neutral tissue atlas adds fine venation, roughness and subtle relief. Each head uses three stock PBR meshes, 5,140–9,888 triangles; completed stems now keep species-proportioned foliage. No emissive flowers, alpha silhouettes or camera-facing plant cards.
- **Materials:** original 2K timber maps, a 4K HDR panorama, and photographed corroded steel with roughness/metallic coverage. Steel UVs retain the scan's 1.3 m physical scale on long narrow bars. Provenance and unmodified file hashes are in `assets/`.
- **Woodland ground:** 36 shrubs, 36 ferns, curled leaves, twigs and 56 connected ground-cover patches add 144,600 triangles in 12 static beauty draws, with no shadow draws. Exact triangle-height sampling keeps their roots on the floor. A fully opaque far-ground shader gradually joins the same HDR panorama at 20–54 m beyond the foundation; nearby ground remains lit scanned geometry. This is a distant-environment projection, not additional physical parallax.
- **Loading:** surface deadlines are 90 seconds and the 29.8 MB HDR deadline is 120 seconds. A clock-controlled regression reproduces the former 30-second rejection of a valid 48-second download and verifies late-error cleanup. The larger assets improve detail at the cost of download size and GPU memory; the 4K half-float panorama alone is approximately 64 MiB before PMREM storage.

The flower morphology follows the botanical references listed in `realism-flowers.js`. Thin-tissue light transport remains approximate: [Blender's subsurface documentation](https://docs.blender.org/manual/en/4.1/render/shader_nodes/shader/sss.html) describes scattering effects not implemented by these opaque stock materials. Actual scanned glazing-bar assets: [Poly Haven Rusty Metal 05](https://polyhaven.com/a/rusty_metal_05).

### Profile comparison and unresolved stalls

The anchor-aligned 60-second dusk windows in `proof/dusk-cpu-profile.json` and `proof/dusk-cpu-profile-optimized.json` show mean app elapsed CPU time falling from **3.91 to 2.64 ms (33%)**. Matrix-world stack sample weight drops from **11.31 to 1.04 seconds**. The complete profiles have different durations; only their report-aligned windows support this comparison. The rejected stale-import comparison is retained as `dusk-cpu-profile-stale-cache.json` with an explicit exclusion reason.

The optimized profile still captured a 292.5 ms interval. Sampling gaps inside small rendering helpers do not prove those functions consumed CPU for the whole gap. A subsequent native Chromium trace did not reproduce that large hitch. Its six renderer tasks over 20 ms peaked at **28.38 ms wall / 6.77 ms thread CPU**, consistent with time spent outside CPU execution but insufficient to distinguish waiting from descheduling. The sanitized local analysis is `proof/v2-native-trace-analysis.json`; the raw multi-process trace remains temporary and is not included in the repository. The installed xctrace lists no instruments and lacks System Trace, so a macOS scheduler trace was unavailable.

### Current source and verification

`proof/v2-loaded-source-validation.json` compares actual `Debugger.getScriptSource` bytes with all thirteen local JS modules after an explicit cache-bypassing reload. Every module matches. Debugger/Profiler/Tracing instrumentation is stopped before the final scenario runs. Temporary browser cache and debugging overrides are restored after verification. Thirty-eight repository Node tests pass against both runtime Three.js r160 and local r184; the existing Jest storage regression passes. Current screenshots are rendered-canvas captures, not generated targets.

All four second-pass runs use 120 tasks, Chrome 152 / ANGLE Metal / Apple M5 Pro, 1920 × 1080, DPR 1, 60-second samples and the same fast route. All report 15 loaded assets, zero visibility interruptions and zero observed run errors. The earlier day run preceded only the loading-deadline correction; the repeat, dusk and night runs use the byte-verified current modules.

| Scenario | Average FPS | p99 ms | Worst ms | Worst rolling 1 s | Sustained target |
| --- | ---: | ---: | ---: | ---: | --- |
| [Day / earlier run](proof/v2-day-120-growing.json) | 117.26 | 9.4 | 284.0 | 75 FPS | Pass |
| [Day / repeat](proof/v2-day-120-growing-repeat.json) | 119.57 | 9.3 | 58.6 | 113 FPS | Pass |
| [Dusk / mixed](proof/v2-dusk-120-mixed.json) | 119.72 | 9.3 | 33.5 | 114 FPS | Pass |
| [Night / flowers](proof/v2-night-120-flowers.json) | 119.94 | 9.3 | 25.0 | 117 FPS | Pass |

**The earlier 284 ms day interval remains visible in the table.** The repeat does not invalidate it. These results establish the bounded sustained target for the recorded runs, not an absolute 60 fps minimum. Earlier checkpoint failures remain below. No unrelated game/QA processes were stopped.

Current visual captures: [growing plants](proof/v2-day-growing-bench.png), [flowering bench](proof/v2-day-bench-final.png), [dusk](proof/v2-dusk-aisle.png), [night](proof/v2-night-aisle.png). These show the remaining visible differences from a real video; no photorealism acceptance is inferred from test passes.

The isolated real-form [UI recheck](proof/v2-ui-checks.json) creates a task, reloads it, changes status, completes it, reloads again, and observes the same sunflower with five foliage leaves. Only the temporary test save is removed afterward. The automated close/resume flow still emits Pointer Lock / WrongDocumentError diagnostics; desktop physical entry and aiming remain unverified. There were no rendering errors in the final benchmark runs.

## Initial baseline

Live Chrome on Apple M5 Pro / ANGLE Metal, 1920×929 CSS pixels, native device ratio 2, original render ratio 1.5. Empty task save, forced daylight, 15-second native rAF sample:

| Metric | Original empty greenhouse |
| --- | ---: |
| Average FPS | 63.44 |
| p99 interval | 25.3 ms |
| Worst interval | 49.9 ms |
| Draw calls per frame | 809 |
| Triangles across passes | 1,169,583 |

The original diagnostics reported only the final fullscreen pass because `renderer.info.autoReset` reset the counters between passes. The baseline above accumulated across the entire frame.

## Verification

Open [benchmark.html](benchmark.html) from the same HTTP server. It loads `index.html?benchmark=1`, which bypasses task storage and rejects synthetic seeding on the normal app route. The preview can be scaled in the browser while the actual iframe/drawing buffer remains 1920×1080. The report includes viewport, GPU, render ratio, all frame percentiles, worst rolling-second FPS, optional GPU timings and errors. Download JSON to retain the evidence.

## Implemented scene

The active scene has solid, closed leaves throughout the task plants, ivy, ferns and exterior trees. Task plants use three cached photographed leaf shapes, fine petioles, irregular node heights, small natural lean and health-driven wilt. Twenty benches have individual rounded boards, aprons, stretchers, legs and 560 modeled fasteners. Pots have open rims and photographed clay; soil uses planar surface UVs. The woodland floor rises beyond the level greenhouse foundation, with static vertex color and subtle UV variation to reduce obvious repetition.

The illustrated dialog vines, foliage cards, attention halos, visible lamp-cone shells and decorative particle clouds are no longer built. Stars and the oversized procedural moon are hidden when the photographed canopy is present: that panorama has no tree depth mask, so drawing them would put stars on tree trunks. The analytic sky remains a loading fallback.

Task rendering uses spatial instance batches while keeping the original objects for interaction. Static architecture is merged. Eight nearby spots share two stable shadow-casting slots, replacing the old point-light cube-map workload. Shadows refresh for visible growth/wilt/watering changes; minute background decay does not trigger repeated shadow renders. The static woodland PMREM is reused during the day instead of regenerating an unused analytic environment.

Normal entry waits for required assets, shader compilation and one unculled GPU warm frame. A WebGL2 fence is polled asynchronously with zero wait timeout; only a signaled fence counts as completed preparation. Timeout/context-loss/error paths restore culling flags and dispose the fence. This reduces first-use work but cannot guarantee that every future driver pipeline is warm. [WebGL 2 synchronization specification](https://registry.khronos.org/webgl/specs/latest/2.0/).

## First checkpoint performance evidence (1479c99)

First-checkpoint scenario measurements are recorded in `proof/day-120-growing.json`, `proof/dusk-120-mixed.json`, and `proof/night-120-flowers.json`. Each uses Chrome 152 / ANGLE Metal / Apple M5 Pro, a 1920 × 1080 drawing buffer, render DPR 1 and native DPR 2. The route moves at 8 m/s with 0.55-second turns and close bench inspections. Twelve required image assets must load successfully before sampling.

| First-checkpoint scenario | Sample | Average | p99 interval | Worst interval | Worst rolling second | Sustained target |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| [Day / 120 growing](proof/day-120-growing.json) | 60.00 s | 119.73 | 9.3 ms | 25.9 ms | 116 FPS | Pass |
| [Dusk / 120 mixed](proof/dusk-120-mixed.json) | 60.00 s | 110.43 | 15.8 ms | 717.5 ms | 22 FPS | **Fail** |
| [Night / 120 flowers](proof/night-120-flowers.json) | 60.00 s | 119.68 | 9.3 ms | 58.4 ms | 112 FPS | Pass |

The final daylight and night runs pass the bounded sustained target; dusk fails it. All three loaded twelve required assets, completed GPU preparation, had no hidden intervals and observed no console/resource errors. A separate night attempt lost visibility and was stopped; its [interruption report](proof/night-visibility-interrupted.json) is retained and excluded from the table.

The original baseline used a higher render ratio and an empty task save, so it is not an equal-resolution speedup comparison. CPU timing covers app work including render submission. GPU timings are asynchronous, sampled every sixth frame and held between query results; their percentile distributions are approximate, not synchronized per-frame presentation timings.

### Retained failed runs

The final dusk run also retained a large stall; earlier runs show the issue is intermittent despite low GPU execution times:

| Report | Average FPS | p99 interval | Worst interval | Worst rolling second |
| --- | ---: | ---: | ---: | ---: |
| [Day, growing](proof/day-120-growing-stall.json) | 100.99 | 24.5 ms | 649.9 ms | 3 FPS |
| [Dusk, mixed](proof/dusk-120-mixed-stall.json) | 113.03 | 16.1 ms | 632.9 ms | 20 FPS |
| [Dusk repeat](proof/dusk-120-mixed-repeat-stall.json) | 116.24 | 9.4 ms | 625.8 ms | 12 FPS |

The day failure occurred even after GPU preparation. These failures are not erased by a later passing run. Read-only process inspection found four unrelated Unity QA players each consuming roughly a CPU core, another game player, and substantial WindowServer activity during testing. Resource contention is plausible, but causation has not been established; those processes were left untouched.

An initial [instrumented WebGL trace](proof/webgl-call-trace.json) did not reproduce the large stall and found no persistent buffer-upload bottleneck. Its wrappers were removed before the final measurements. That diagnostic run is not authoritative performance proof. A later [fresh dusk trace covering 226 WebGL methods](proof/dusk-webgl-call-trace.json) also did not reproduce the large stall: its longest native call was 21.7 ms. Instrumentation raised mean CPU time to 7.9 ms and reduced average callback rate to 104.6 FPS, so that result is not substituted for the uninstrumented failure. All wrappers were restored afterward. The final dusk [CPU frame breakdown](proof/dusk-slow-frames.json) records a 714.5 ms render-submission pause with the program count stable at 101. Some smaller pauses also occurred during ordinary updates; the evidence does not isolate one shader or buffer operation.

**A hard minimum of 60 FPS has not been established.** The benchmark requires both p99 ≤16.67 ms and ≥60 callbacks in the worst full rolling second for its sustained-target verdict; it also reports every long interval. Passing that bounded test does not prove every frame meets 16.67 ms, nor performance on other hardware. The next performance gate is a controlled run with the unrelated graphics workloads idle, followed by a physical rapid-movement playtest.

## Visual and functional proof

- [Daylight bench closeup](proof/day-bench.png), [dusk aisle](proof/dusk-aisle.png), and [night aisle](proof/night-aisle.png) are actual rendered-canvas captures, not generated target images.
- [UI evidence](proof/ui-checks.json) records task creation, status changes, completion and reload persistence on a fresh local origin. Synthetic records were removed afterward. The normal app save was never seeded by the benchmark.
- At an emulated 390 × 844 touch viewport, actual touch entry, joystick movement, drag look and Menu pause worked. The task form had no horizontal overflow or illustrated vine overlay. [Task form](proof/mobile-task-form.jpg), [pause interface](proof/mobile-pause.jpg).
- Twenty-four Node tests pass for batching, interaction raycasts, material identity, buffer updates, bounds, disposal, disjoint GPU queries, light assignment, shadow invalidation and GPU preparation cleanup. The existing storage-quota Jest regression test also passes. These mock/CPU tests do not replace real rendering or physical input proof.
- Independent code review fixed light-slot assignment, disjoint-query cleanup, empty-scene shadow invalidation and debug-cue instance synchronization. Final visual review corrected apron/end-face UV projection and added botanical variation. A static terrain check confirmed 352 sampled floor vertices remain at height zero.
- Final live traversal found zero visible sprites, point systems or materials with alpha testing. All temporary WebGL wrappers and browser cache overrides were removed.
- [Source SHA-256](proof/source-sha256.json) identifies the runtime and harness used for final verification.

Commands from the repository root:

```sh
node --test greenhouse-todo/tests/plant-batches.test.mjs greenhouse-todo/tests/render-integration.test.mjs greenhouse-todo/tests/warm-renderer.test.mjs
NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js greenhouse-todo/tests/app.test.js --runInBand
git diff --check
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/greenhouse-todo/benchmark.html` for isolated synthetic QA; `index.html` is the normal application.

## Remaining acceptance limits

The photographs and modeled silhouettes substantially improve the materials, but the scene is still visibly rendered. Procedural flower forms and branch distribution, repeated scan detail, a fixed 4K woodland panorama and approximate glazing/bounce light remain visible limitations. It has not been proven indistinguishable from video of a real greenhouse. Remaining realism work is calibrated thin-tissue/bounce lighting and specimen-level variation against a real reference capture. Increased texture resolution and solid geometry alone do not establish video-level realism.

Desktop physical mouse/keyboard traversal and aiming, fresh listening, mobile-device FPS and cross-GPU behavior remain unverified. Automated desktop pointer lock was unreliable; dialog opening used the existing debug entry point before exercising the real forms. Touch proof used desktop GPU emulation. The existing Three.js/N8AO CDN dependency remains. The first pass was committed and pushed to origin/main as 1479c99 at Jason's request. Deployment behavior has not been verified.
