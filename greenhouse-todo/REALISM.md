# Greenhouse rendering: design and evidence

## Acceptance target

A single greenhouse secluded in a dense haunted forest, with continuous modeled depth, an enclosing canopy, photographed surface detail, physical scale, modeled botanical silhouettes, readable daylight and lamp lighting, and smooth rapid movement with all 120 task slots filled. Preserve to-do creation, health, growth, completion, persistence, keyboard/touch input, and audio. Synthetic performance scenarios must not touch saved tasks.

Performance is measured on a named GPU at a stated drawing-buffer resolution. The target is a 16.67 ms frame budget, at least 60 frames in the worst full rolling second, and p99 below 16.67 ms after asset/shader warmup. Also report the worst individual interval; never conceal a hitch behind average FPS. A browser/OS can miss a presentation deadline even when scene rendering is under budget, so measured results are not a guarantee for every device or every future frame.

## Research and implementation plan

1. **Photographed materials.** Use vendored CC0 albedo, OpenGL normals, and roughness maps. Apply sRGB only to albedo, with linear lighting and exactly one display conversion. Physical tile size and separate UVs for long/narrow members matter more than increasing texture resolution. Sources: [Three.js color management](https://threejs.org/manual/en/color-management.html), [Poly Haven license](https://polyhaven.com/license). Exact assets and hashes: [assets/MATERIALS.md](assets/MATERIALS.md).
2. **Real silhouettes.** Replace alpha-cut tree/fern/ivy cards with closed leaf meshes, tapered branches, leaflets and attached vines. Keep modeled flower petals. Build benches from individual rounded planks, apron rails, stretchers, legs and fasteners. Select a single photographed board for narrow timber to avoid painting false joints onto it.
3. **Light and contact.** Use daylight/environment light, true shadow maps, restrained contact occlusion and non-glowing organic surfaces. Thin glazing uses angle-dependent reflection; at this scale a second full-scene refraction render is poor value. This is an explicit raster approximation, not ray tracing. [MeshPhysicalMaterial cost and features](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).
4. **Bound rendering work.** Share task geometry and completed-flower prototypes. Instance task parts in spatial chunks, retain original task objects for interaction, and synchronize only changed plants. Merge static structural members. Eight local hooded spotlights with two cached shadow maps replace twenty point lights with four six-face maps. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
5. **Spend pixels where they matter.** Render at one physical pixel per CSS pixel on desktop (up to 1920×1080 in the benchmark). Contact AO runs at half resolution; remove redundant transparency renders and bloom. SMAA stabilizes edges because the AO beauty target does not inherit the canvas's antialiasing. [N8AO documentation](https://github.com/N8python/n8ao).
6. **Measure and iterate.** Test 120 growing plants, 120 completed flowers, and a mixed scene during an 8 m/s route with fast turns and close inspections. Repeat daylight, dusk and night. Keep GPU timing queries asynchronous, include all rendering passes in draw counters, and exclude hidden-tab intervals explicitly.

## Forest correction after user inspection

The user rejected the second pass's exposed flat dirt, sparse trees and obvious panoramic background. Higher resolution did not preserve the intended secluded, haunted setting. The new acceptance gate is the actual view through every wall and the roof while translating the camera; prior captures are historical evidence, not visual approval.

Implementation plan:

- Replace visible landscape photography with overlapping 3D tree layers and a restrained overcast sky. Keep photographed forest radiance solely for indirect material lighting; use the existing 2K source (7.56 MB) instead of the 4K background (29.76 MB). Scale linear source radiance before PMREM because the deployed r160 lacks the newer scene-wide environment-intensity control. [Three.js scene environment/background separation](https://threejs.org/docs/pages/Scene.html).
- Fill the perimeter with mature, irregular trees, canopy above the 11 m roof ridge, dense understory and uneven banks. Near and middle geometry must create translation parallax; mist should separate distant trees without drawing a horizon seam. All foliage remains opaque solid geometry.
- Share geometry and materials within bounded spatial groups so enclosure does not require thousands of object updates or draws. Compute instance bounds after placement. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- Add west/east/entrance/rear/canopy inspection poses to the isolated benchmark, then repeat 120-plant day/dusk/night movement samples at 1080p. Preserve failures and distinguish visible improvement from the user's ultimate real-video acceptance standard.

The rebuilt woodland contains 280 trees (258 living trees and 22 snags), 519,480 attached, closed leaves, buttressed roots, irregular limbs, and crowns that overlap above the greenhouse. Photographed bark uses its one-metre physical scale. The exterior terrain rises in irregular banks beyond an exactly level foundation. Its three-metre leaf-litter scan is covered with 416 fern crowns, brambles, roots, twigs and fallen logs. No visible forest photograph, alpha-cut vegetation or camera-facing foliage is used.

The forest has 8,920,464 stored triangles; the understory adds 1,791,808. These are scene totals, not the per-frame draw cost. Closed leaf detail decreases with distance while placement remains fixed. Spatial instance bounds allow the renderer to omit crowns outside each camera frustum. Only nearby forest casts/receives mapped shadows; all understory receives shadows, with no additional understory shadow draws. Directional shadow bounds are fitted in light space so the rear of the greenhouse stays covered as the sun changes azimuth. Lamp bounce now follows the actual filament ramp immediately, including a snapped inspection clock.

The forest benchmark follows all four walls and looks through the canopy in a continuous 20-second loop. It refuses a sample shorter than the route. The harness also records display dimensions, window position and DPR, and marks display movement as noncomparable.

The final culling change groups near/middle/far leaves into 12×10×12 m, 20×12×20 m and 32×16×32 m cells respectively. A regression hashes every instance matrix/color and the complete leaf geometries against the preceding build. Across 150 sampled aisle poses, CPU frustum evaluation reports 9.8% fewer submitted forest triangles on average, with more draw calls; only the browser measurements below establish the resulting frame-time tradeoff.

### Final forest verification

All four final runs use the byte-verified release modules, Chrome 152 / ANGLE Metal / Apple M5 Pro, a 1920×1080 drawing buffer, render DPR 1, 120 synthetic tasks, 8 m/s movement and 60-second samples after warmup. They load all 21 required image assets, report no visibility/display changes, and observe zero rendering/resource errors. The browser window remains on the built-in display; no other application or GPU workload was stopped.

| Scenario | Average FPS | p99 ms | Worst interval ms | Worst rolling 1 s | Sustained target |
| --- | ---: | ---: | ---: | ---: | --- |
| [Day / mixed aisle](proof/v3-final-day-120-mixed-aisle.json) | 118.47 | 16.5 | 25.2 | 105 FPS | Pass |
| [Dusk / mixed aisle](proof/v3-final-dusk-120-mixed-aisle.json) | 118.35 | 16.6 | 25.6 | 105 FPS | Pass |
| [Night / flowering aisle](proof/v3-final-night-120-flowers-aisle.json) | 118.22 | 16.6 | 17.5 | 101 FPS | Pass |
| [Day / growing forest perimeter](proof/v3-final-day-120-growing-forest.json) | 119.53 | 9.3 | 116.7 | 104 FPS | Pass |

**The perimeter run contains a 116.7 ms interval.** Its p99 and worst rolling second pass the bounded sustained criterion, but this hitch prevents claiming an absolute 60 FPS floor. Earlier failures remain below. The lower mean triangle count after culling comes with extra draw calls; recorded aisle performance, rather than the triangle count alone, supports retaining the change.

[Actual loaded source](proof/v3-loaded-source-release.json) matches all fourteen local JS modules. Debugger instrumentation is disabled before sampling. [All 58 Node tests pass on runtime Three.js r160](proof/v3-runtime-tests.txt), including exact leaf preservation, spatial bounds, foundation/root placement, roof clearance, radiance conversion, shadow coverage, asset lifetimes, route continuity and display-change rejection. The preceding full suite and the final forest-specific cases also passed on local r184. The existing Jest storage-quota regression passed earlier in this revision; no storage code changed in the forest correction.

Final rendered views: [day aisle](proof/v3-final-day-entry.png), [dusk aisle](proof/v3-final-dusk-entry.png), [night aisle](proof/v3-final-night-entry.png), [west](proof/v3-final-day-forest-left.png), [east](proof/v3-final-day-forest-right.png), [entrance](proof/v3-final-day-forest-front.png), [rear](proof/v3-final-day-forest-back.png), and [canopy](proof/v3-final-day-canopy.png). All were inspected after the last culling change. These are unedited canvas captures of the running application. The new enclosure fixes the sparse clearing/panorama mismatch; procedural branch patterns and approximate light transport remain visibly different from video of a real place.

### Display cadence and retained failures

An external-display run sampled at about 60 Hz while another window used the built-in display's approximately 120 Hz cadence. Both had DPR 2, so the previous metadata did not distinguish them. The [display comparison](proof/v3-display-comparison.json) records their separate screen dimensions and window locations. A five-second [empty external page](proof/v3-external-empty-page-cadence.json) measured 60.00 FPS, 17.6 ms p99 and 17.7 ms worst; the [empty built-in-display page](proof/v3-empty-page-cadence.json) measured 119.04 FPS and 10.0 ms p99. The small [baseline page](proof/cadence.html) can reproduce the check without rendering the greenhouse.

The external-display [day](proof/v3-day-120-mixed-aisle.json), [dusk](proof/v3-dusk-120-mixed-aisle.json), and [night](proof/v3-night-120-flowers-aisle.json) results remain available. They fail the unchanged strict 16.67 ms/60-callback criterion, just as normal scheduling jitter can cross that boundary on a 60 Hz display. An [interrupted night run](proof/v3-night-interrupted-120-flowers-aisle.json) is excluded from comparisons. No system refresh-rate, power or graphics setting was changed.

The [initial dense-forest trial](proof/v3-dense-initial-15s.json) and the [matched-display aisle run before final culling](proof/v3-internal-day-120-mixed-aisle.json) also remain failures: both recorded 16.7 ms p99. The latter averaged 116.47 FPS and 5.01 million submitted triangles, with 97 FPS in its slowest rolling second. These failures are not replaced by subsequent passes.

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

The illustrated dialog vines, foliage cards, attention halos, visible lamp-cone shells and decorative particle clouds are no longer built. The forest correction replaces the visible panorama with real tree depth and an overcast sky. Restrained stars and a moon at approximately 0.52 degrees apparent diameter are occluded by the modeled crowns; the moon also occludes stars. The forest HDR supplies indirect lighting only.

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

The photographs and modeled silhouettes substantially improve the materials, but the scene is still visibly rendered. Procedural flower forms and branch distribution, repeated scan detail, and approximate glazing/bounce light remain visible limitations. The conspicuous woodland panorama has been removed from the view. It has not been proven indistinguishable from video of a real greenhouse. Remaining realism work is calibrated thin-tissue/bounce lighting and specimen-level variation against a real reference capture. Increased texture resolution and solid geometry alone do not establish video-level realism.

Desktop physical mouse/keyboard traversal and aiming, fresh listening, mobile-device FPS and cross-GPU behavior remain unverified. Automated desktop pointer lock was unreliable; dialog opening used the existing debug entry point before exercising the real forms. Touch proof used desktop GPU emulation. The existing Three.js/N8AO CDN dependency remains. The first pass was committed and pushed to origin/main as 1479c99 at Jason's request. Deployment behavior has not been verified.
