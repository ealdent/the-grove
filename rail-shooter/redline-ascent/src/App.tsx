import { useEffect, useRef, useState } from 'react';
import { Engine } from './game/engine';

type Screen = 'boot' | 'menu' | 'playing' | 'gameover';

export default function App() {
  const shellRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const firePointerIdRef = useRef<number | null>(null);
  const [screen, setScreen] = useState<Screen>('boot');
  const [finalScore, setFinalScore] = useState(0);
  const [hiScore, setHiScore] = useState(0);
  const [finalDist, setFinalDist] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const screenRef = useRef<Screen>('boot');

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, {
      onReady: (storedHiScore) => {
        setHiScore(storedHiScore);
        setScreen('menu');
      },
      onGameOver: (score, hi, dist) => {
        firePointerIdRef.current = null;
        setFinalScore(score);
        setHiScore(hi);
        setFinalDist(dist);
        setPaused(false);
        setScreen('gameover');
      },
      onPauseChange: setPaused,
      onMuteChange: setMuted,
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  const startGame = () => {
    const engine = engineRef.current;
    if (!engine) return;
    firePointerIdRef.current = null;
    engine.start();
    setPaused(false);
    setScreen('playing');
  };

  const togglePause = () => engineRef.current?.togglePause();
  const toggleMute = () => engineRef.current?.toggleMute();
  const setTouchFiring = (active: boolean) => engineRef.current?.setTouchFiring(active);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        // let focused buttons (e.g. the audio toggle) handle their own activation
        if (event.target instanceof HTMLElement && event.target.tagName === 'BUTTON') return;
        if (screenRef.current === 'menu' || screenRef.current === 'gameover') {
          event.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let touchStart: { x: number; y: number } | null = null;
    const preventBrowserAction = (event: Event) => event.preventDefault();
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) event.preventDefault();
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !touchStart) return;
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    };
    const clearTouchStart = () => {
      touchStart = null;
    };

    shell.addEventListener('contextmenu', preventBrowserAction);
    shell.addEventListener('auxclick', preventBrowserAction);
    shell.addEventListener('dragstart', preventBrowserAction);
    shell.addEventListener('gesturestart', preventBrowserAction);
    shell.addEventListener('wheel', onWheel, { passive: false });
    shell.addEventListener('touchstart', onTouchStart, { passive: true });
    shell.addEventListener('touchmove', onTouchMove, { passive: false });
    shell.addEventListener('touchend', clearTouchStart);
    shell.addEventListener('touchcancel', clearTouchStart);

    return () => {
      shell.removeEventListener('contextmenu', preventBrowserAction);
      shell.removeEventListener('auxclick', preventBrowserAction);
      shell.removeEventListener('dragstart', preventBrowserAction);
      shell.removeEventListener('gesturestart', preventBrowserAction);
      shell.removeEventListener('wheel', onWheel);
      shell.removeEventListener('touchstart', onTouchStart);
      shell.removeEventListener('touchmove', onTouchMove);
      shell.removeEventListener('touchend', clearTouchStart);
      shell.removeEventListener('touchcancel', clearTouchStart);
    };
  }, []);

  return (
    <main ref={shellRef} className="game-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Redline Ascent playfield. Fly with keyboard, mouse, or touch and destroy the relay network."
      />

      <div className="crt-scanlines" />
      <div className="crt-vignette" />

      {screen === 'menu' && (
        <div className="title-screen intro-screen">
          <section className="poster-cabinet intro-cabinet" aria-labelledby="game-title">
            <div className="poster-kicker">REDLINE AUTOMATA // AEROSPACE DIVISION</div>
            <div className="poster-title-field">
              <div className="poster-stamp">RA-82</div>
              <h1 id="game-title" className="font-arcade">
                REDLINE
                <br />
                ASCENT
              </h1>
              <div className="poster-subtitle font-machine">RELAY-BREAKER FLIGHT PROGRAM</div>
            </div>
            <div className="poster-pilot font-ui">
              PILOT-01 <strong>JAX REDLINE</strong> // CALLSIGN RED-1
            </div>
            <div className="control-grid font-machine">
              <span>WASD / ARROWS / MOUSE</span>
              <b>FLY</b>
              <span>SPACE / CLICK / FIRE</span>
              <b>SHOOT</b>
              <span>TOUCH: DRAG + FIRE</span>
              <b>MOBILE</b>
              <span>P / M</span>
              <b>PAUSE / AUDIO</b>
            </div>
            <p className="mission-copy font-ui">
              BREAK THE RELAY WARDENS. THREAD THE ARCHES TO TRIGGER REDLINE OVERDRIVE. VENT HEAT OR BURN OUT.
            </p>
            <button type="button" onClick={startGame} className="coin-button font-arcade">
              INSERT COIN // START
            </button>
            <div className="poster-footer font-machine">
              <span className="blink">PRESS ENTER</span>
              <button type="button" className="footer-audio" onClick={toggleMute} aria-pressed={muted}>
                {muted ? 'AUDIO OFF' : 'AUDIO ON'}
              </button>
              <span>HI {String(hiScore).padStart(8, '0')}</span>
            </div>
          </section>
        </div>
      )}

      {screen === 'gameover' && (
        <div className="title-screen gameover-screen">
          <section className="poster-cabinet debrief-cabinet" aria-labelledby="gameover-title">
            <div className="poster-kicker">REDLINE AUTOMATA // INCIDENT REPORT</div>
            <div className="debrief-title-field">
              <h2 id="gameover-title" className="font-marquee">SHIP DOWN</h2>
              <div className="font-machine">THE WASTES CLAIM ANOTHER PILOT</div>
            </div>
            <dl className="score-report font-machine">
              <div><dt>SCORE</dt><dd>{String(finalScore).padStart(8, '0')}</dd></div>
              <div><dt>DISTANCE</dt><dd>{(finalDist / 10).toFixed(1)} KM</dd></div>
              <div><dt>HI SCORE</dt><dd>{String(hiScore).padStart(8, '0')}</dd></div>
            </dl>
            {finalScore >= hiScore && finalScore > 0 && <div className="record-stamp font-arcade">NEW HI SCORE</div>}
            <button type="button" onClick={startGame} className="coin-button font-arcade">
              INSERT COIN // RETRY
            </button>
            <div className="poster-footer font-machine">
              <span className="blink">PRESS ENTER TO RETRY</span>
              <button type="button" className="footer-audio" onClick={toggleMute} aria-pressed={muted}>
                {muted ? 'AUDIO OFF' : 'AUDIO ON'}
              </button>
            </div>
          </section>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <div className="cabinet-actions font-machine">
            <button type="button" onClick={togglePause} aria-pressed={paused}>{paused ? 'RESUME' : 'PAUSE'}</button>
            <button type="button" onClick={toggleMute} aria-pressed={muted}>{muted ? 'AUDIO OFF' : 'AUDIO ON'}</button>
          </div>
          <button
            type="button"
            className="touch-fire font-arcade"
            aria-label="Hold to fire photon blaster"
            onPointerDown={(event) => {
              if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.button !== 0) return;
              if (firePointerIdRef.current !== null) return;
              event.preventDefault();
              event.stopPropagation();
              firePointerIdRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              setTouchFiring(true);
            }}
            onPointerUp={(event) => {
              if (firePointerIdRef.current !== event.pointerId) return;
              event.preventDefault();
              firePointerIdRef.current = null;
              setTouchFiring(false);
            }}
            onPointerCancel={(event) => {
              if (firePointerIdRef.current !== event.pointerId) return;
              firePointerIdRef.current = null;
              setTouchFiring(false);
            }}
            onLostPointerCapture={(event) => {
              if (firePointerIdRef.current !== event.pointerId) return;
              firePointerIdRef.current = null;
              setTouchFiring(false);
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            FIRE
          </button>
        </>
      )}

      {screen === 'boot' && (
        <div className="boot-screen font-arcade">
          <span className="blink">CALIBRATING RELAY SENSORS…</span>
        </div>
      )}
    </main>
  );
}
