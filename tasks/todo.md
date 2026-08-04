# Task: Add Qwen 3.8 Max tower-defense entry

- [x] Inspect repository status, project instructions, and the tower-defense index structure
- [x] Add a Qwen 3.8 Max tile in the correct model order
- [x] Stage the new game file and index update for version control
- [x] Verify link integrity, metadata ordering, HTML structure, and staged diff

## Task Packet

Goal: Track the new Qwen 3.8 Max game and expose it from the tower-defense index.
Project: The Grove (personal).
Repo/path: `/Users/jason/dev/personal/the-grove`.
Constraints: Preserve the existing card markup; keep providers and models alphabetized; avoid unrelated changes.
Non-goals: Modify the game implementation or commit/push the changes.
Files likely involved: `tower-def/qwen3.8-max-tower-def.html`, `tower-def/index.html`, `tasks/todo.md`.
Commands to run: HTML/card metadata checks, relative-link validation, `git diff --check`, and staged-status inspection.
Proof required: The tile targets an existing file, identifies Alibaba / Qwen 3.8 Max, appears before Qwen 3.8 Max Preview, and all requested files are staged.
Risks: Incorrect metadata could break filtering or make the new entry appear out of order.
Expected output: A staged new game file plus staged index and task-log updates.

## Review

- Added a `Glowgrot` card for Alibaba's Qwen 3.8 Max immediately before Qwen 3.8 Max Preview.
- Verified all 32 tower-defense card links resolve to files on disk.
- Verified the unique model list remains alphabetized and the Alibaba Qwen models are ordered `Qwen 3.8 Max`, then `Qwen 3.8 Max Preview`.
- Verified the extracted index script parses with `node --check`.
- Verified the staged patch with `git diff --cached --check`.
