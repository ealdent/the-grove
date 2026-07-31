// Procedural WebAudio sound effects — no audio assets needed.

interface EngineNodes {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  windSource: AudioBufferSourceNode;
  lowpass: BiquadFilterNode;
  windFilter: BiquadFilterNode;
  engineGain: GainNode;
  windGain: GainNode;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineNodes: EngineNodes | null = null;
  muted = false;

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  private tone(freq0: number, freq1: number, dur: number, type: OscillatorType, vol: number, when = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff0: number, cutoff1: number, when = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, cutoff1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  laser() {
    this.tone(920, 240, 0.09, 'square', 0.09);
  }

  enemyShot() {
    this.tone(320, 130, 0.14, 'sawtooth', 0.06);
  }

  boom(big = false) {
    this.noise(big ? 0.6 : 0.35, big ? 0.5 : 0.3, big ? 2200 : 3000, 120);
    this.tone(big ? 140 : 180, 40, big ? 0.5 : 0.3, 'triangle', 0.35);
  }

  playerHit() {
    this.noise(0.3, 0.4, 4000, 200);
    this.tone(220, 50, 0.35, 'sawtooth', 0.3);
  }

  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone(660, 660, 0.12, 'square', 0.07, i * 0.28);
      this.tone(440, 440, 0.12, 'square', 0.07, i * 0.28 + 0.14);
    }
  }

  needle() {
    this.tone(660, 660, 0.07, 'square', 0.1);
    this.tone(880, 880, 0.07, 'square', 0.1, 0.08);
    this.tone(1320, 1320, 0.12, 'square', 0.1, 0.16);
  }

  overheat() {
    this.tone(520, 90, 0.5, 'sawtooth', 0.14);
  }

  pickup() {
    this.tone(520, 1040, 0.12, 'square', 0.1);
  }

  lock() {
    this.tone(1180, 1180, 0.045, 'square', 0.05);
    this.tone(1560, 1560, 0.05, 'square', 0.04, 0.05);
  }

  gameOver() {
    this.tone(330, 55, 1.4, 'sawtooth', 0.25);
    this.noise(1.2, 0.35, 1600, 60);
  }

  startEngine() {
    if (!this.ctx || !this.master || this.engineNodes) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 52;
    o2.frequency.value = 55.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(this.master);
    // wind noise
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const nsrc = this.ctx.createBufferSource();
    nsrc.buffer = buf;
    nsrc.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.02;
    nsrc.connect(bp).connect(ng).connect(this.master);
    o1.start();
    o2.start();
    nsrc.start();
    this.engineNodes = {
      osc1: o1,
      osc2: o2,
      windSource: nsrc,
      lowpass: lp,
      windFilter: bp,
      engineGain: g,
      windGain: ng,
    };
  }

  setEngineSpeed(norm: number) {
    if (!this.engineNodes) return;
    this.engineNodes.osc1.frequency.value = 52 + norm * 42;
    this.engineNodes.osc2.frequency.value = 55.5 + norm * 45;
    this.engineNodes.windGain.gain.value = 0.015 + norm * 0.05;
  }

  stopEngine() {
    const nodes = this.engineNodes;
    if (!nodes) return;
    this.engineNodes = null;

    for (const source of [nodes.osc1, nodes.osc2, nodes.windSource]) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }

    for (const node of Object.values(nodes)) node.disconnect();
  }
}
