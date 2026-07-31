# Task: Rename Blightspore and Add Model Tag in Arcade Index

## Task Overview
Rename `arcade/blightspore.html` to `arcade/gemini-3.6-flash-high-blightspore.html` and add model metadata / tag (`Gemini 3.6 Flash`, effort `High`, provider `google`) to the Blightspore tile in `arcade/index.html` in the same manner as `tower-def/index.html`.

## Todo List
- [x] Write implementation plan in `implementation_plan.md`
- [x] Rename `arcade/blightspore.html` to `arcade/gemini-3.6-flash-high-blightspore.html` via `git mv`
- [x] Update tile link and add `data-provider`, `data-model`, `data-effort`, and model tag badge to `arcade/index.html`
- [x] Verify link and layout in `arcade/index.html`
- [x] Commit and push changes to origin main

## Review & Results
- Renamed `arcade/blightspore.html` to `arcade/gemini-3.6-flash-high-blightspore.html`.
- Updated `arcade/index.html` tile to reference `gemini-3.6-flash-high-blightspore.html` and added `data-provider="google"`, `data-model="Gemini 3.6 Flash"`, `data-effort="High"`, along with styled `.model-tag` badge matching `tower-def/index.html`.
- Verified link and layout.
- Committed and pushed to `origin main`.
