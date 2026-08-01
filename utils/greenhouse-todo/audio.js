// The greenhouse's ears. Two looping ambient beds (day birdsong, night
// crickets) crossfade with the same dayness value that drives the lighting, a
// scheduler drops occasional one-shots on top (owls at varying distance,
// nightbirds, a far-off animal, the odd cicada after dark; songbird phrases
// and a woodpecker while the sun is up), and a solo violin plays a short
// phrase every minute or so with long silences in between.
//
// Everything hangs off two user-facing buses — music and ambience — so the
// soundtrack and the forest can be balanced independently. Layout:
//
//   phrase/one-shot → [lowpass] → gain → pan ─┐
//                                             ├→ ambienceGain ─┐
//   beds (day/night, each with own gain) ─────┘                ├→ masterGain → out
//   violin phrases → envelope gain ───────────→ musicGain ─────┘
//
// The AudioContext is created on the first "enter the greenhouse" gesture
// (autoplay policy forbids earlier), and suspends while the tab is hidden —
// a to-do list has no business hooting at you from a background tab.

const SETTINGS_KEY = 'greenhouse-audio-settings';

const BED_FILES = { day: 'audio/bed-day.mp3', night: 'audio/bed-night.mp3' };
const VIOLIN_FILES = ['audio/violin-1.mp3', 'audio/violin-2.mp3', 'audio/violin-3.mp3'];
const ONESHOT_FILES = {
    owl: 'audio/owl-hoot.mp3',
    nightbird: 'audio/nightbird.mp3',
    animalCall: 'audio/animal-call.mp3',
    cicada: 'audio/cicada.mp3',
    songbird1: 'audio/songbird-1.mp3',
    songbird2: 'audio/songbird-2.mp3',
    woodpecker: 'audio/woodpecker.mp3'
};

// Bed levels are deliberately unequal: crickets sit closer to the ear than
// daytime birdsong, which is how a still night actually feels.
const BED_LEVEL = { day: 0.32, night: 0.42 };

// Where along dayness the beds trade places. Matches the lighting's own idea
// of dusk (isNight flips at 0.4 elsewhere), with enough width that the swap
// is a slow tide rather than a switch.
const XFADE_LO = 0.3;
const XFADE_HI = 0.65;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const smoothstep = (lo, hi, x) => {
    const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
};

function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (s && typeof s === 'object') {
            return {
                enabled: s.enabled !== false,
                music: Number.isFinite(s.music) ? Math.min(1, Math.max(0, s.music)) : 0.45,
                ambience: Number.isFinite(s.ambience) ? Math.min(1, Math.max(0, s.ambience)) : 0.7
            };
        }
    } catch (e) { /* corrupted settings are not worth surfacing; fall through */ }
    return { enabled: true, music: 0.45, ambience: 0.7 };
}

class GreenhouseAudio {
    constructor() {
        this.settings = loadSettings();
        this.ctx = null;
        this.ready = false;       // buffers decoded, beds running
        this.buffers = {};        // name → AudioBuffer (missing on decode failure)
        this.beds = null;         // { day: {src,gain}, night: {...} }
        this.events = [];         // one-shot scheduler entries
        this.music = { nextAt: 0, playingUntil: 0, lastIndex: -1 };
        this.lastDayness = 1;
        this._bedTargets = { day: -1, night: -1 };

        document.addEventListener('visibilitychange', () => {
            if (!this.ctx) return;
            if (document.hidden) {
                this.ctx.suspend();
            } else if (this.settings.enabled) {
                this.ctx.resume();
            }
        });
    }

    // Idempotent; must be called from a user gesture. Returns immediately —
    // decoding happens in the background and the beds start when it's done.
    init() {
        if (this.ctx) {
            // Later gestures double as resume() opportunities: Safari in
            // particular likes to hand out contexts already suspended.
            if (this.settings.enabled && this.ctx.state === 'suspended' && !document.hidden) {
                this.ctx.resume();
            }
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return; // no WebAudio, no sound — the app works fine silent

        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.settings.enabled ? 1 : 0;
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.settings.music;
        this.musicGain.connect(this.masterGain);

        this.ambienceGain = this.ctx.createGain();
        this.ambienceGain.gain.value = this.settings.ambience;
        this.ambienceGain.connect(this.masterGain);

        this._loadAll();
    }

    async _loadAll() {
        const entries = [
            ['bedDay', BED_FILES.day], ['bedNight', BED_FILES.night],
            ...VIOLIN_FILES.map((f, i) => [`violin${i}`, f]),
            ...Object.entries(ONESHOT_FILES)
        ];
        await Promise.all(entries.map(async ([name, url]) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const raw = await res.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(raw);
            } catch (e) {
                // A missing clip silences that one sound, nothing else.
                console.warn(`greenhouse audio: could not load ${url}`, e);
            }
        }));
        if (!this.buffers.bedDay && !this.buffers.bedNight) return; // nothing to run

        this._startBeds();
        this._scheduleEvents();
        // First violin phrase comes fairly soon after entering, so the player
        // learns the soundtrack exists; after that the long gaps take over.
        this.music.nextAt = this.ctx.currentTime + rand(6, 15);
        this.ready = true;
    }

    _startBeds() {
        this.beds = {};
        for (const key of ['day', 'night']) {
            const buf = this.buffers[key === 'day' ? 'bedDay' : 'bedNight'];
            if (!buf) continue;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const gain = this.ctx.createGain();
            gain.gain.value = 0; // update() fades in the right one for the hour
            src.connect(gain).connect(this.ambienceGain);
            // Staggered start offsets so the two beds don't share loop seams.
            src.start(0, Math.random() * buf.duration);
            this.beds[key] = { src, gain };
        }
    }

    // One entry per creature. `when` gates on the dayness at fire time, so an
    // owl due at 6pm simply waits for dusk: if the gate is closed the entry is
    // pushed back a little and tried again rather than skipped for a full gap.
    _scheduleEvents() {
        const t = this.ctx.currentTime;
        const night = d => d < 0.35;
        const day = d => d > 0.55;
        this.events = [
            // The owl's distance is rolled fresh every call — see _playOwl.
            { name: 'owl', when: night, gapLo: 30, gapHi: 100, nextAt: t + rand(8, 40), play: () => this._playOwl() },
            { name: 'nightbird', when: night, gapLo: 40, gapHi: 130, nextAt: t + rand(20, 70), play: () => this._playOneShot('nightbird', { gainLo: 0.10, gainHi: 0.28 }) },
            { name: 'animalCall', when: night, gapLo: 110, gapHi: 280, nextAt: t + rand(60, 160), play: () => this._playOneShot('animalCall', { gainLo: 0.08, gainHi: 0.2, lowpassHz: 2200 }) },
            { name: 'cicada', when: night, gapLo: 70, gapHi: 200, nextAt: t + rand(30, 90), play: () => this._playOneShot('cicada', { gainLo: 0.07, gainHi: 0.18 }) },
            { name: 'songbird', when: day, gapLo: 14, gapHi: 45, nextAt: t + rand(4, 15), play: () => this._playOneShot(Math.random() < 0.5 ? 'songbird1' : 'songbird2', { gainLo: 0.12, gainHi: 0.3 }) },
            { name: 'woodpecker', when: day, gapLo: 70, gapHi: 200, nextAt: t + rand(25, 90), play: () => this._playOneShot('woodpecker', { gainLo: 0.08, gainHi: 0.2 }) }
        ];
    }

    // Fire-and-forget playback with per-call variation. Every call rolls its
    // own gain, pan and a few cents of playback rate so the same clip never
    // lands twice the same way.
    _playOneShot(name, { gainLo, gainHi, lowpassHz = 0, rate = rand(0.95, 1.05), pan = rand(-0.75, 0.75) } = {}) {
        const buf = this.buffers[name];
        if (!buf || !this.settings.enabled) return;
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;

        let head = src;
        if (lowpassHz) {
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = lowpassHz;
            head.connect(lp);
            head = lp;
        }
        const gain = ctx.createGain();
        gain.gain.value = rand(gainLo, gainHi);
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        head.connect(gain).connect(panner).connect(this.ambienceGain);
        src.start();
        // Let GC take the chain when the clip ends.
        src.onended = () => { try { panner.disconnect(); } catch (e) { /* already gone */ } };
    }

    // The owl wanders. Distance is a single 0–1 roll (biased far — hearing it
    // close should be an event) that drives loudness and muffling together,
    // because a far-off hoot is not just quieter, the forest has eaten its
    // top end. A hair of playback-rate drift keeps one clip sounding like a
    // bird rather than a recording.
    _playOwl() {
        const d = Math.pow(Math.random(), 0.6); // 0 = on the roof, 1 = deep in the trees
        const gain = 0.45 * Math.pow(0.12, d);  // ~0.45 close → ~0.055 far
        this._playOneShot('owl', {
            gainLo: gain * 0.9, gainHi: gain * 1.1,
            lowpassHz: 5200 * Math.pow(0.16, d), // ~5200 Hz close → ~830 Hz far
            rate: rand(0.94, 1.04),
            pan: rand(-0.85, 0.85)
        });
    }

    // Solo violin, played sparsely: one phrase, then 25–70 s of forest before
    // the next. Phrases never repeat back-to-back.
    _updateMusic(now) {
        const m = this.music;
        if (now < m.nextAt || now < m.playingUntil) return;
        const available = VIOLIN_FILES.map((_, i) => i).filter(i => this.buffers[`violin${i}`] && i !== m.lastIndex);
        if (!available.length) return;
        const idx = available[Math.floor(Math.random() * available.length)];
        m.lastIndex = idx;
        const buf = this.buffers[`violin${idx}`];

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const env = this.ctx.createGain();
        // Gentle ease in and out so a phrase surfaces out of the ambience
        // instead of starting like a cue.
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(1, now + 1.8);
        env.gain.setValueAtTime(1, now + buf.duration - 2.0);
        env.gain.linearRampToValueAtTime(0, now + buf.duration);
        src.connect(env).connect(this.musicGain);
        src.start(now);
        src.onended = () => { try { env.disconnect(); } catch (e) { /* already gone */ } };

        m.playingUntil = now + buf.duration;
        m.nextAt = m.playingUntil + rand(25, 70);
    }

    // Called every frame from animate() with the lighting's dayness (1 = noon,
    // 0 = midnight). Cheap: bed gains only get an automation event when their
    // target actually moves, and the schedulers are integer comparisons.
    update(dayness) {
        this.lastDayness = dayness;
        if (!this.ready || !this.settings.enabled || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;

        const dayAmt = smoothstep(XFADE_LO, XFADE_HI, dayness);
        const targets = { day: dayAmt * BED_LEVEL.day, night: (1 - dayAmt) * BED_LEVEL.night };
        for (const key of ['day', 'night']) {
            const bed = this.beds && this.beds[key];
            if (!bed) continue;
            if (Math.abs(this._bedTargets[key] - targets[key]) > 0.004) {
                this._bedTargets[key] = targets[key];
                // ~8 s to settle: dawn arrives in the ears at the same pace as in the sky.
                bed.gain.gain.setTargetAtTime(targets[key], now, 2.5);
            }
        }

        for (const ev of this.events) {
            if (now < ev.nextAt) continue;
            if (ev.when(dayness)) {
                ev.play();
                ev.nextAt = now + rand(ev.gapLo, ev.gapHi);
            } else {
                // Wrong time of day — poll again shortly instead of consuming
                // a whole gap, so the first owl isn't half a night late.
                ev.nextAt = now + rand(10, 25);
            }
        }

        this._updateMusic(now);
    }

    // --- User controls -----------------------------------------------------

    setEnabled(on) {
        this.settings.enabled = !!on;
        this._save();
        if (!this.ctx) return;
        if (on) {
            if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
            this.masterGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.15);
        } else {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
    }

    toggle() { this.setEnabled(!this.settings.enabled); return this.settings.enabled; }

    setMusicVolume(v) {
        this.settings.music = Math.min(1, Math.max(0, v));
        this._save();
        if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.settings.music, this.ctx.currentTime, 0.05);
    }

    setAmbienceVolume(v) {
        this.settings.ambience = Math.min(1, Math.max(0, v));
        this._save();
        if (this.ambienceGain) this.ambienceGain.gain.setTargetAtTime(this.settings.ambience, this.ctx.currentTime, 0.05);
    }

    _save() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); }
        catch (e) { /* private mode etc. — settings just won't persist */ }
    }

    // For the diagnostics panel and headless verification.
    state() {
        return {
            context: this.ctx ? this.ctx.state : 'uninitialised',
            ready: this.ready,
            enabled: this.settings.enabled,
            musicVolume: +this.settings.music.toFixed(2),
            ambienceVolume: +this.settings.ambience.toFixed(2),
            bedTargets: {
                day: +Math.max(0, this._bedTargets.day).toFixed(3),
                night: +Math.max(0, this._bedTargets.night).toFixed(3)
            },
            loaded: Object.keys(this.buffers),
            nextEvents: this.ctx ? this.events.map(e => ({
                name: e.name,
                dueIn: +(e.nextAt - this.ctx.currentTime).toFixed(1),
                gateOpen: e.when(this.lastDayness)
            })) : [],
            musicPlaying: this.ctx ? this.ctx.currentTime < this.music.playingUntil : false,
            nextPhraseIn: this.ctx && this.ready ? +(this.music.nextAt - this.ctx.currentTime).toFixed(1) : null
        };
    }
}

export const greenhouseAudio = new GreenhouseAudio();
