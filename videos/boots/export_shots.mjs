// Evaluate edit.js outside the browser and write the resolved cut list (MEDIA/shots.json) for mix.py and reports.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.resolve(process.env.MEDIA || path.join(HERE, '..', '..', 'tmp', 'boots-march'));
const ctx = { window: {} }; ctx.Object = Object; ctx.Math = Math;
vm.runInNewContext(readFileSync(path.join(HERE, 'edit.js'), 'utf8'), ctx);
const { SHOTS, END, T0 } = ctx.window;
writeFileSync(path.join(MEDIA, 'shots.json'), JSON.stringify({ T0, END, shots: SHOTS.map(s => ({ t: +s.t.toFixed(3), id: s.id, hit: s.hit, flash: s.flash || null, boom: s.boom || 0, big: s.big || null, small: s.small || null, colour: !!s.colour, date: s.date || null })) }));
const ids = new Set(SHOTS.map(s => s.id).filter(i => i[0] !== '#'));
console.log(SHOTS.length, 'shots,', [...ids].filter(i => !i.startsWith('c:')).length, 'images,', [...ids].filter(i => i.startsWith('c:')).length, 'clips, END', END.toFixed(2));
if (process.argv.includes('--ids')) console.log([...ids].join(' '));
