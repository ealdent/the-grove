import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProgress, beginQuestion, recordAnswer, lessonProgress, isMastered, readProgress, saveProgress } from '../learn/apollo-progress.js';
test('mastery requires independent solves across different setups and cannot be farmed by resubmitting', () => {
  const p=freshProgress(10), r=lessonProgress(p,'vectors');
  for(let i=0;i<4;i++){beginQuestion(p,'vectors',4);recordAnswer(p,'vectors',true);recordAnswer(p,'vectors',true);r.active=null;}
  assert.equal(r.independent,4);assert.equal(r.correct,4);assert.equal(isMastered(r),true);
  assert.equal(isMastered({...r,variants:[0,1]}),false);
});
test('hints, worked solutions, and corrected mistakes stay out of independent mastery',()=>{
  const p=freshProgress(4),r=lessonProgress(p,'orbits');
  beginQuestion(p,'orbits',4).hints=1;recordAnswer(p,'orbits',true);r.active=null;
  beginQuestion(p,'orbits',4).revealed=true;recordAnswer(p,'orbits',true);r.active=null;
  beginQuestion(p,'orbits',4);recordAnswer(p,'orbits',false);recordAnswer(p,'orbits',true);
  assert.equal(r.correct,3);assert.equal(r.independent,0);
});
test('reload preserves the exact problem, answers, and attempts; next advances setup and seed',()=>{
  let stored;const storage={getItem:()=>stored,setItem:(_,v)=>stored=v};
  const p=freshProgress(50),a=beginQuestion(p,'vectors',4);a.inputs={x:'sqrt(4)'};a.hints=1;recordAnswer(p,'vectors',false);
  assert.ok(saveProgress(storage,p));const restored=readProgress(storage),same=beginQuestion(restored,'vectors',4);
  assert.deepEqual(same,a);lessonProgress(restored,'vectors').active=null;
  const next=beginQuestion(restored,'vectors',4);assert.notEqual(next.seed,a.seed);assert.notEqual(next.variant,a.variant);
});
test('blocked storage and malformed state leave a usable fresh course',()=>{
  const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('quota');}};
  assert.equal(readProgress(blocked,9).seed,9);assert.equal(saveProgress(blocked,freshProgress()),false);
  assert.equal(readProgress({getItem:()=>'{bad'},7).seed,7);
});
