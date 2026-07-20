import { useEffect, useRef, useState } from 'react';
import { Engine } from './game/engine';

type Screen = 'boot' | 'menu' | 'playing' | 'gameover';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>('boot');
  const [finalScore, setFinalScore] = useState(0);
  const [hiScore, setHiScore] = useState(0);
  const [finalDist, setFinalDist] = useState(0);
  const screenRef = useRef<Screen>('boot');

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, {
      onReady: () => setScreen('menu'),
      onGameOver: (score, hi, dist) => {
        setFinalScore(score);
        setHiScore(hi);
        setFinalDist(dist);
        setScreen('gameover');
      },
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  const startGame = () => {
    const e = engineRef.current;
    if (!e) return;
    e.start();
    setScreen('playing');
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (screenRef.current === 'menu' || screenRef.current === 'gameover') {
          ev.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0805]">
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair touch-none" />

      {/* CRT overlays */}
      <div className="crt-scanlines" />
      <div className="crt-vignette" />

      {/* ============ TITLE / ATTRACT ============ */}
      {screen === 'menu' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-[#0c0805cc] via-transparent to-[#0c0805dd]">
          <div className="arcade-panel flex max-w-[92vw] flex-col items-center gap-5 px-8 py-8 text-center sm:px-14">
            <div className="font-term text-lg tracking-[0.35em] text-[#e8c384]">REDLINE AUTOMATA · AEROSPACE DIVISION</div>
            <h1 className="font-arcade text-glow-red text-4xl leading-tight text-[#ff3b26] sm:text-6xl">
              REDLINE
              <br />
              ASCENT
            </h1>
            <div className="font-term text-2xl text-[#f9ecb9]">
              PILOT-01 <span className="text-[#ff3b26]">JAX REDLINE</span> — CALLSIGN RED-1
            </div>
            <div className="font-term grid grid-cols-1 gap-x-10 gap-y-1 text-xl text-[#e8c384] sm:grid-cols-2">
              <span>WASD / ARROWS / MOUSE — FLY</span>
              <span>SPACE / CLICK (HOLD) — FIRE</span>
              <span>P — PAUSE</span>
              <span>M — MUTE</span>
            </div>
            <div className="font-term max-w-md text-lg leading-snug text-[#b58a4c]">
              PUSH THROUGH THE WASTES. CRUSH THE RELAY NETWORK. MIND YOUR HEAT — THREAD THE ARCHES FOR BONUS.
            </div>
            <button
              onClick={startGame}
              className="font-arcade mt-2 cursor-pointer border-2 border-[#e8c384] bg-[#7e2015] px-8 py-4 text-sm text-[#f9ecb9] shadow-[0_0_24px_rgba(255,60,30,0.45)] transition-transform hover:scale-105 hover:bg-[#c1382a] active:scale-95"
            >
              ▶ INSERT COIN — START
            </button>
            <div className="blink font-term text-2xl tracking-widest text-[#f9ecb9]">PRESS ENTER</div>
            <div className="font-term text-lg text-[#b58a4c]">HI SCORE {String(hiScore).padStart(8, '0')}</div>
          </div>
        </div>
      )}

      {/* ============ GAME OVER ============ */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#1a0503b8]">
          <div className="arcade-panel flex max-w-[92vw] flex-col items-center gap-4 px-10 py-8 text-center">
            <div className="font-arcade text-glow-red text-3xl text-[#ff3b26] sm:text-5xl">SHIP DOWN</div>
            <div className="font-term text-2xl tracking-widest text-[#e8c384]">THE WASTES CLAIM ANOTHER PILOT</div>
            <div className="font-term mt-2 text-3xl text-[#f9ecb9]">
              SCORE <span className="text-[#ffd75e]">{String(finalScore).padStart(8, '0')}</span>
            </div>
            <div className="font-term text-2xl text-[#e8c384]">
              DISTANCE {(finalDist / 10).toFixed(1)} KM · HI SCORE {String(hiScore).padStart(8, '0')}
            </div>
            {finalScore >= hiScore && finalScore > 0 && (
              <div className="blink-fast font-arcade text-sm text-[#ffd75e]">★ NEW HI SCORE ★</div>
            )}
            <button
              onClick={startGame}
              className="font-arcade mt-3 cursor-pointer border-2 border-[#e8c384] bg-[#7e2015] px-8 py-4 text-sm text-[#f9ecb9] shadow-[0_0_24px_rgba(255,60,30,0.45)] transition-transform hover:scale-105 hover:bg-[#c1382a] active:scale-95"
            >
              ⟳ INSERT COIN — RETRY
            </button>
            <div className="blink font-term text-2xl tracking-widest text-[#f9ecb9]">PRESS ENTER TO RETRY</div>
          </div>
        </div>
      )}

      {/* ============ BOOT ============ */}
      {screen === 'boot' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0c0805]">
          <div className="font-arcade blink text-sm text-[#e8c384]">LOADING SPRITES…</div>
        </div>
      )}
    </div>
  );
}
