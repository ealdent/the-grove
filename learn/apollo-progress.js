/** Practice bookkeeping only. Versioned, bounded, and independent of the DOM. */
export const PROGRESS_KEY = 'grove.apollo.flight-school.v1';
export const freshProgress = (seed = Date.now() >>> 0) => ({ version: 1, seed, selected: 'vectors', mode: 'briefing', lessons: {}, flights: 0 });
export function lessonProgress(progress, id) {
  return progress.lessons[id] ??= { next: 0, correct: 0, independent: 0, variants: [], recent: [], active: null };
}
export function isMastered(record) { return !!record && record.independent >= 4 && record.variants.length >= 3; }
export function beginQuestion(progress, id, variantCount) {
  const record = lessonProgress(progress, id);
  if (record.active?.variant >= variantCount) record.active = null;
  if (!record.active) {
    const index = record.next++;
    const bag = Array.from({length:variantCount}, (_,i)=>i);
    let random = (progress.seed + Math.floor(index / variantCount) * 1664525 + [...id].reduce((n,c)=>n+c.charCodeAt(0),0)) >>> 0;
    for(let i=bag.length-1;i>0;i--){random=(Math.imul(random,1664525)+1013904223)>>>0;const j=random%(i+1);[bag[i],bag[j]]=[bag[j],bag[i]];}
    record.active = { index, seed: (progress.seed + index * 2654435761) >>> 0, variant: bag[index % variantCount],
      attempts: 0, hints: 0, revealed: false, solved: false, inputs: {} };
  }
  return record.active;
}
export function recordAnswer(progress, id, correct) {
  const record = lessonProgress(progress, id), active = record.active;
  if (!active || active.solved) return { credited: false, mastered: isMastered(record) };
  active.attempts++;
  if (correct) {
    active.solved = true;
    record.correct++;
    const independent = active.attempts === 1 && active.hints === 0 && !active.revealed;
    if (independent) {
      record.independent++;
      if (!record.variants.includes(active.variant)) record.variants.push(active.variant);
    }
    record.recent = [...record.recent.slice(-9), { correct: true, independent }];
    return { credited: independent, mastered: isMastered(record) };
  }
  record.recent = [...record.recent.slice(-9), { correct: false, independent: false }];
  return { credited: false, mastered: isMastered(record) };
}
export function readProgress(storage, seed) {
  try {
    const p = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (p?.version !== 1 || !Number.isInteger(p.seed) || !p.lessons || typeof p.lessons !== 'object' || Array.isArray(p.lessons)) return freshProgress(seed);
    const clean = freshProgress(p.seed);
    clean.selected = typeof p.selected === 'string' ? p.selected : 'vectors';
    clean.mode = p.mode === 'practice' ? 'practice' : 'briefing';
    clean.flights = Math.max(0, Math.min(1e6, Number(p.flights) || 0));
    for (const [id, r] of Object.entries(p.lessons)) {
      if (!/^[a-z]+$/.test(id) || !r || !Array.isArray(r.variants) || !Array.isArray(r.recent)) continue;
      const count = x => Number.isSafeInteger(x) && x >= 0 && x < 1e9 ? x : 0;
      const item = { next: count(r.next), correct: count(r.correct), independent: count(r.independent),
        variants: [...new Set(r.variants.filter(v => Number.isInteger(v) && v >= 0 && v < 32))], recent: r.recent.slice(-10), active: null };
      const a = r.active;
      if (a && Number.isInteger(a.index) && a.index >= 0 && a.index < item.next && Number.isInteger(a.seed) && Number.isInteger(a.variant) && a.variant >= 0 && a.variant < 32) {
        item.active = { index: a.index, seed: a.seed >>> 0, variant: a.variant,
          attempts: count(a.attempts), hints: count(a.hints), revealed: !!a.revealed, solved: !!a.solved,
          inputs: a.inputs && typeof a.inputs === 'object' && !Array.isArray(a.inputs)
            ? Object.fromEntries(Object.entries(a.inputs).filter(([k,v]) => /^[a-zA-Z0-9_]+$/.test(k) && typeof v === 'string').map(([k,v]) => [k,v.slice(0,240)])) : {} };
      }
      clean.lessons[id] = item;
    }
    return clean;
  } catch { return freshProgress(seed); }
}
export function saveProgress(storage, progress) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
