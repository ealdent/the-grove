# The Evening Peal — tower defense plan

Deliverable: `tower-def/haiku-5.5-max-tower-def.html` (single file, no deps) + card in `tower-def/index.html`.

## Theme and lore
- Valley of bell-ringers. Every dusk the Evening Peal holds the Hush asleep under the Blackmere.
- Guildmother Hesper recast the Great Bell, never came back, bell cracked, Hush came up.
- Twenty nights until the dark moon. The player is the new Ringer; towers are hung bells.
- Enemies are things the Hush has wrapped in felt: dogs, cork, oxen, moths, echoes, a silencer, the Great Bell itself.
- Valley name is random per run (Tollmere, Wennick, Ysmere, ...); season palette random too.

## Mechanics
- Random track: DFS self-avoiding path on a 16x10 grid (no touching), margins hold the Hush-gate and the belfry. Portrait phones get a 10x16 grid.
- 5 bells, each with 4 tiers: Handbell (fast single), Tenor (area + knockback/stun), Tuning Fork (slow + vulnerability + DoT), Pipe Organ (beam, ramp, choir), Chime Engine (chain, stun, hour strike).
- Harmony: each bell has a pitch class; consonant neighbours within 2.4 cells add damage (perfect +12%, imperfect +6%, capped +40%).
- 20 nights, explicit compositions, a mid-boss (Gatebreaker, night 10) and the Unstruck Bell (night 20, silence pulse, escorts at 66%/33%).
- Bells are lives (12). Brass is gold. Upgrades and building work any time; sell refunds 70%.

## Steps
- [ ] Write the HTML/CSS shell (responsive layout, panels, codex dialog, overlays)
- [ ] Map generation (path, woods, rocks, decor, portrait orientation)
- [ ] Tower logic and 20 nights, boss logic
- [ ] Rendering (background prerender, towers, enemies, effects)
- [ ] Input, HUD and panels, audio
- [ ] Balance pass with an in-browser auto-player (test copy only)
- [ ] Visual check at desktop and phone viewports; console clean
- [ ] Index card in `tower-def/index.html` (read format only after design settled)
- [ ] Commit (signed) and push to main

## Review
- Built as one file (`tower-def/haiku-5.5-max-tower-def.html`, about 2,900 lines with CSS and markup). Card added to `tower-def/index.html` between Grok 4.7 and Kimi K3.
- Balance was tuned with an in-browser auto-player on test copies in the ignored `tmp/` folder. Final rule: the Unstruck Bell reaching the belfry ends the vigil. Its base HP is 3,500 (+3% per night), and a Strong-focused bell line wins about nine of twelve seeds.
- Skeptical review (subagent, read-only) found one high and ten smaller issues. All were confirmed in code and fixed:
  - High: a leaked final boss counted as a cleared night, so the run could be won without killing it. Now the final boss leaking ends the vigil in defeat.
  - Simulation kept running after defeat or victory, and tuning shortcuts still acted on a selection. Now the sim stops and selection clears, and buy/sell/place are blocked.
  - Tuning Fork ignored Silencers. Its slow and damage now scale with the silence.
  - Twin Clappers text promised any nearby enemy but only struck within 1.2 cells. Text now says so.
  - Pause carried into a new night. Starting a night now clears pause.
  - Chip tooltip now lists the Gatebreaker and the Unstruck Bell.
  - Overture resets when its target changes.
  - Full Stops now draws wider beams.
  - Voice-limit trimming now drops all finished voices, not just the front.
  - Echo splits hatch behind their parent, and the progress bar counts splits and escorts up front, so it only moves forward.
  - A tap on touch screens now sets the hover cell, so the placement preview shows.
- Verified: nightly simulation over 12 seeds with no NaN; every render path executed across 20 nights with all five bells fully tuned (no exceptions); boss-only defeat path; progress bar monotonic on echo and boss nights; real page loads with no console errors; desktop 800x600 and phone 390x844 layouts checked by screenshot.
- Not verified: a human playtest (balance is from a scripted planner); audio on real speakers; Safari and Firefox specifically.
