# Neverstill art pipeline

Scripts that produced the generated art embedded in `../neverstill.html` (Higgsfield CLI, 2026-09-22).
Raw generations, GLBs and intermediate files are not committed. Rebuild in a scratch copy of this folder.

1. `python3 manifest.py` writes `jobs.json`. It holds 43 prompts, all built on one fixed style formula:
   terrain and material tiles, horizon panoramas, the explosion flipbook, and 3D concept art.
2. `seq 0 42 | xargs -P 6 -I{} ./gen_one.sh {}` saves the images to `raw/`. The Higgsfield CLI needs the sandbox off.
3. Tiles: run the Higgsfield `pipeline.py` seam fix, then take them to 128 px and 48 colours in `out/`.
   Panoramas: chroma-key them, crop, and take them to 1024 px wide and 64 colours in `out/`.
   See `tasks/todo-neverstill.md` for the exact steps.
4. `./gen3d.sh <name> <polycount>` submits image_to_3d for each `raw/c_<name>.png` concept; `poll3d.sh` downloads the GLBs.
5. `./convert_all.sh` runs `glb2nvm.py` with `models_cfg.json`: it reorients, normalizes and quantizes each model
   into an NVM1 record, and writes QC renders to `qc/`.
6. `python3 build_blob.py` injects everything into the page's JSON asset blob.

## Trailer

`trailer/` rebuilds the 52 s in-engine demo trailer. It covers frame-stepped capture over CDP, audio replayed offline through the game's own synth, and a beat-grid edit. See `trailer/README.md`.
