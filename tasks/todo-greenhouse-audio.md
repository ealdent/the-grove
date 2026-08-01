# Greenhouse To-Do: ambient audio + violin soundtrack

Goal: calm time-of-day ambient sound + sparse solo-violin soundtrack with independent volume controls.

## Plan
- [x] Generate assets via local ElevenLabs MCP (`~/dev/local-api-mcp`) — 13 clips, ~1,140 credits
- [x] Copy assets into `utils/greenhouse-todo/audio/`
- [x] New `audio.js` module (beds crossfade on `currentDayness`, creature scheduler,
      owl at variable distance via gain+lowpass+pan, sparse violin player,
      localStorage settings, gesture init, suspend on hidden tab)
- [x] UI: pause-card sound section (toggle + Soundtrack/Ambience sliders), `M` hotkey
- [x] Debug hook: `greenhouseDebug.audio.state()`
- [x] Verify headless, commit + push

Note: kept out of tasks/todo.md — another session is actively using it.

## Review
- Headless proof (`.verify-audio.sh`, gitignored like the other probes): all 12
  buffers decode over http; noon → day bed 0.32 / night 0, songbird+woodpecker
  gates open; midnight → night bed 0.42 / day 0, owl/nightbird/cicada/animal
  gates open; violin phrase playing with next queued +39.5s; volume changes
  persist to localStorage; mute works.
- Pre-existing unrelated failure: `arcade/mother-os-defense` jest suite
  (require() in ESM config) — untouched by this change.
- Not verified by ear: actual sound aesthetics (bed loop seams, violin tone,
  how far "far" owls feel). Regenerating any single clip is one MCP call —
  operation IDs are in this session's log (`greenhouse-audio.<name>.v1`).
