import { LESSONS, generateQuestion, variantCount, parseCalculation, gradeAnswer } from './apollo-course-data.js';
import { freshProgress, lessonProgress, isMastered, beginQuestion, recordAnswer, readProgress, saveProgress } from './apollo-progress.js';
import { drawInstrument } from './apollo-instruments.js';
import { mountMission } from './apollo-mission.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage; try { storage = window.localStorage; } catch { /* A private browser can still practice in memory. */ }
let progress = readProgress(storage);
if (!LESSONS.some(l => l.id === progress.selected)) progress.selected = LESSONS[0].id;
let lesson, question, active, values, phase = .35, animating = false, lastFrame = 0, visible = true;
const shortTitles = ['Vectors','Integrate','Orbits','Engines','Transfer','Intercept','Correct','Navigate'];
const save = () => { $('save-status').textContent = saveProgress(storage, progress) ? 'Learning record saved on this browser.' : 'Storage unavailable — this session still works.'; };
function renderNavigation() {
  const count = LESSONS.filter(l => isMastered(progress.lessons[l.id])).length;
  $('school-progress').textContent = `${count} / 8 QUALIFIED`;
  $('qualification-track').innerHTML = LESSONS.map(l => `<i class="${isMastered(progress.lessons[l.id]) ? 'qualified' : ''}"></i>`).join('');
  $('school-nav').innerHTML = LESSONS.map((l, i) => {
    const record = progress.lessons[l.id], qualified = isMastered(record);
    return `<button type="button" data-lesson="${l.id}" aria-current="${l.id === progress.selected}" aria-label="Lesson ${i+1}: ${esc(l.title)}${qualified ? ', qualified' : ''}"><span class="nav-number">${qualified ? '✓' : String(i+1).padStart(2,'0')}</span><span>${shortTitles[i]}</span><small>${qualified ? 'QUALIFIED' : `${Math.min(record?.independent || 0,4)}/4`}</small></button>`;
  }).join('');
  $('school-nav').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {selectLesson(button.dataset.lesson);$('school-nav').querySelector(`[data-lesson="${button.dataset.lesson}"]`)?.focus({preventScroll:true});}));
}
function selectLesson(id, mode = progress.mode) {
  progress.selected = id; progress.mode = mode; lesson = LESSONS.find(l => l.id === id);
  animating = false; phase = .35;
  $('animate-instrument').textContent = '▷ Animate geometry'; $('animate-instrument').setAttribute('aria-pressed','false');
  values = Object.fromEntries(lesson.visual.controls.map(c => [c.key,c.value]));
  prepareQuestion(); renderNavigation(); renderPanel(); renderControls(); renderInstrument(); save();

}
function prepareQuestion() {
  active = beginQuestion(progress, lesson.id, variantCount(lesson.id));
  question = generateQuestion(lesson.id, active.seed, active.variant);
}
function setMode(mode) { progress.mode = mode; renderPanel(); renderInstrument(); save(); }
function renderPanel() {
  const practice = progress.mode === 'practice';
  $('show-briefing').setAttribute('aria-pressed', String(!practice));
  $('show-practice').setAttribute('aria-pressed', String(practice));
  const panel = $('lesson-panel');
  if (!practice) {
    panel.innerHTML = `<p class="lesson-kicker">${esc(lesson.kicker)}</p><h3>${esc(lesson.title)}</h3><p class="lesson-goal">${esc(lesson.goal)}</p><div class="lesson-copy">${lesson.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div><div>${lesson.equations.map(e=>`<div class="formula-card"><code>${esc(e.formula)}</code><p>${esc(e.meaning)}</p></div>`).join('')}</div><details class="worked-example"><summary>EXPAND A WORKED EXAMPLE ↗</summary><p>${esc(lesson.worked.prompt)}</p><ol>${lesson.worked.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="worked-answer">${esc(lesson.worked.answer)}</p></details><p class="lesson-kicker">Watch the assumptions</p><ul class="watch-for">${lesson.pitfalls.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><div class="lesson-sources">READ THE UNDERLYING MATH${lesson.references.map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a>`).join('')}</div><div class="lesson-bottom-actions"><button class="action" id="start-practice">Try the calculations →</button>${lesson.id==='mission' ? '<a class="academy-button" href="#flight-deck">Take command ↗</a>' : ''}</div>`;
    $('start-practice').addEventListener('click',()=>{setMode('practice');$('lesson-panel').scrollIntoView({block:'start'});});
    return;
  }
  const record = lessonProgress(progress,lesson.id);
  panel.innerHTML = `<div class="practice-topline"><span>${esc(lesson.kicker)}<br>PROBLEM ${String(active.index+1).padStart(3,'0')} / ${variantCount(lesson.id)} TYPES</span><strong>${isMastered(record) ? '✓ QUALIFIED' : `${record.independent}/4 INDEPENDENT`}<br>${Math.min(record.variants.length,3)}/3 TYPES PASSED</strong></div><h3>${esc(question.title)}</h3><p class="question-prompt">${esc(question.prompt)}</p><div class="question-givens">${question.givens.map(g=>`<div class="given"><span>${esc(g.label)}</span><strong>${esc(g.value)} ${esc(g.unit||'')}</strong></div>`).join('')}</div><form id="answer-form" novalidate>${question.answers.map((a,i)=>`<div class="answer-field"><label for="answer-${i}">${esc(a.label)}</label><div class="answer-input-wrap">${a.options ? `<select id="answer-${i}" data-key="${esc(a.key)}" ${active.solved?'disabled':''}><option value="">Choose an answer…</option>${a.options.map(o=>`<option value="${esc(o.value)}" ${String(active.inputs[a.key])===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>` : `<input id="answer-${i}" data-key="${esc(a.key)}" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="240" value="${esc(active.inputs[a.key]||'')}" ${active.solved?'disabled':''} aria-describedby="answer-help-${i}">`}<span>${esc(a.unit||'')}</span></div>${!a.options ? `<small id="answer-help-${i}">Expressions accepted. ${a.angle?'Equivalent bearings wrap by 360°. ':''}Tolerance: ±${esc(Number(a.tolerance.toPrecision(3)))} ${esc(a.unit||'')}.</small>`:''}</div>`).join('')}<div class="answer-actions"><button class="action" type="submit" ${active.solved?'disabled':''}>${active.solved?'✓ Answer checked':'Check my calculation →'}</button><button type="button" id="next-question">${active.solved?'Next fresh challenge →':'Skip / new scenario'}</button></div></form><div class="feedback ${active.solved?'success':''}" id="practice-answer-feedback" role="status" aria-live="polite">${active.solved?'<strong>This problem is complete.</strong>Try a fresh challenge to continue your practice.':''}</div><div class="question-help"><button type="button" id="question-hint" ${active.hints>=question.hints.length||active.solved?'disabled':''}>${active.hints?'Another hint':'Give me a hint'}</button><button type="button" id="question-solution" ${active.revealed?'disabled':''}>Show worked solution</button></div><ol id="question-hints" class="hint-list">${question.hints.slice(0,active.hints).map(h=>`<li>${esc(h)}</li>`).join('')}</ol><div id="question-worked"></div><p class="practice-footer">${record.correct} problems solved · ${record.independent} independent first attempts.<br>${active.solved?'Completed problem. Generate a fresh challenge to keep practicing.':active.hints||active.revealed?'This problem is assisted; it counts as practice.':'Your first unassisted answer can count toward qualification.'} Formula sheets and the calculator are always available.</p>`;
  panel.querySelectorAll('[data-key]').forEach(input=>input.addEventListener('input',()=>{active.inputs[input.dataset.key]=input.value;save();}));
  $('answer-form').addEventListener('submit', checkAnswers);
  $('next-question').addEventListener('click',nextQuestion);
  $('question-hint').addEventListener('click',()=>{active.hints++;save();renderPanel();renderInstrument();$('answer-0')?.focus({preventScroll:true});});
  $('question-solution').addEventListener('click',()=>{active.revealed=true;save();renderPanel();renderInstrument();$('next-question').focus({preventScroll:true});});
  if(active.revealed||active.solved) renderSolution();
  if(isMastered(record)){
    const next=LESSONS[LESSONS.indexOf(lesson)+1];
    const follow=document.createElement(next?'button':'a');follow.className='academy-button';follow.textContent=next?'Next lesson: '+next.title+' →':'Take command of the spacecraft ↗';
    if(next){follow.type='button';follow.addEventListener('click',()=>{selectLesson(next.id,'briefing');$('lesson-panel').scrollIntoView({block:'start'});});}else follow.href='#flight-deck';
    panel.append(follow);
  }
}
function renderSolution() {
  $('question-worked').innerHTML = `<div class="worked-example"><p class="lesson-kicker" style="padding-top:18px">THE CALCULATION</p><ol class="solution-steps">${question.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="worked-answer">${esc(question.takeaway)}</p></div>`;
}
function checkAnswers(event) {
  event.preventDefault(); if(active.solved)return;
  const grades = question.answers.map(a => gradeAnswer(a,active.inputs[a.key]||''));
  const invalid = grades.some(g=>g.parsed===null);
  if(invalid){$('practice-answer-feedback').className='feedback error';$('practice-answer-feedback').textContent='Enter a valid answer in each field first. '+grades.filter(g=>g.parsed===null).map(g=>g.message).join(' ')+' This does not count as an attempt.';return;}
  const correct = grades.every(g=>g.correct), result = recordAnswer(progress,lesson.id,correct);
  save();renderNavigation();renderPanel();renderInstrument();
  const feedback=$('practice-answer-feedback');
  if(correct)$('next-question').focus({preventScroll:true});else{const index=grades.findIndex(g=>!g.correct);$('answer-'+index)?.setAttribute('aria-invalid','true');$('answer-'+index)?.focus({preventScroll:true});}
  feedback.className=`feedback ${correct?'success':'error'}`;
  if(correct){feedback.innerHTML=`<strong>${result.mastered?'✓ Lesson qualified.':result.credited?'✓ Independent solution recorded.':'✓ Correct. Practice makes the method familiar.'}</strong>${result.mastered?'Keep practicing, explore the next lesson, or take command below.':result.credited?'A fresh setup is ready when you are.':'Try a fresh problem without help for qualification credit.'}`;}
  else{feedback.innerHTML=`<strong>There’s a calculation to revisit.</strong><ul>${question.answers.map((a,i)=>`<li>${esc(a.label)}: ${grades[i].correct?'correct.':esc(grades[i].message)}</li>`).join('')}</ul>Check units and signs. You can revise this answer or open a hint.`;}
}
function nextQuestion() {
  lessonProgress(progress,lesson.id).active=null;
  if($('mixed-practice').checked){const pool=LESSONS.filter(l=>l.id!==lesson.id);const random=crypto.getRandomValues(new Uint32Array(1))[0];const next=pool[random%pool.length].id;const target=lessonProgress(progress,next);if(target.active?.solved)target.active=null;selectLesson(next,'practice');}
  else{prepareQuestion();renderPanel();renderInstrument();save();}
  $('lesson-panel').scrollIntoView({block:'start'});$('answer-0')?.focus({preventScroll:true});
}
function renderControls() {
  $('instrument-controls').innerHTML=lesson.visual.controls.map(c=>`<label class="instrument-control" for="instrument-${c.key}"><span>${esc(c.label)}<output id="value-${c.key}">${esc(c.value)} ${esc(c.unit)}</output></span><input id="instrument-${c.key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" aria-label="${esc(c.label)}"></label>`).join('');
  lesson.visual.controls.forEach(c=>$(`instrument-${c.key}`).addEventListener('input',event=>{values[c.key]=Number(event.target.value);$(`value-${c.key}`).textContent=`${event.target.value} ${c.unit}`;renderInstrument();}));
}
function renderInstrument() {
  const model=drawInstrument($('school-diagram'),lesson.visual.kind,values,phase);
  $('instrument-title').textContent=model.title;
  $('instrument-mode-note').hidden=progress.mode!=='practice';
  $('instrument-mode-note').textContent='EXPLORATION MODEL / SEPARATE FROM THIS QUESTION’S GIVENS';
  $('instrument-readouts').dataset.count=String(model.readouts.length);
  $('instrument-caption').textContent=(progress.mode==='practice'?'Exploration model — these controls are separate from the question’s givens. ':'')+model.caption;
  const hidden=progress.mode==='practice'&&!active.solved&&!active.revealed&&!active.hints;
  if(hidden){
    if(!$('reveal-instrument')){
      $('instrument-readouts').innerHTML='<div class="instrument-lock"><span>Predict first.<br>Reveal instrument values as a hint.</span><button type="button" id="reveal-instrument">Reveal values</button></div>';
      $('reveal-instrument').addEventListener('click',()=>{active.hints=Math.max(1,active.hints);save();renderPanel();renderInstrument();$('answer-0')?.focus({preventScroll:true});});
    }
  }else $('instrument-readouts').innerHTML=model.readouts.map(r=>`<div class="instrument-readout"><small>${esc(r.label)}</small><strong>${esc(r.value)}</strong><span>${esc(r.unit||'')}</span></div>`).join('');
}
$('show-briefing').addEventListener('click',()=>setMode('briefing'));
$('show-practice').addEventListener('click',()=>setMode('practice'));
$('animate-instrument').addEventListener('click',()=>{animating=!animating;$('animate-instrument').textContent=animating?'Ⅱ Pause geometry':'▷ Animate geometry';$('animate-instrument').setAttribute('aria-pressed',String(animating));if(animating)requestAnimationFrame(tick);});
function tick(time){if(!animating)return;if(visible&&!document.hidden&&time-lastFrame>66){phase=(phase+.006)%1;lastFrame=time;renderInstrument();}requestAnimationFrame(tick);}
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:.05}).observe($('school-diagram'));
$('reset-instrument').addEventListener('click',()=>{values=Object.fromEntries(lesson.visual.controls.map(c=>[c.key,c.value]));phase=.35;renderControls();renderInstrument();});
$('calculator-form').addEventListener('submit',event=>{event.preventDefault();try{$('calculator-result').textContent=Number(parseCalculation($('flight-calculation').value).toPrecision(12)).toString();}catch(error){$('calculator-result').textContent=error.message;}});
let resetArmed=false;
$('reset-record').addEventListener('click',()=>{if(!resetArmed){resetArmed=true;$('reset-record').textContent='Confirm reset of all lesson progress';return;}progress=freshProgress();resetArmed=false;$('reset-record').textContent='Reset my learning record';selectLesson('vectors','briefing');});
const smallScreen=matchMedia('(max-width:780px)');
function fitInstrument(){ $('instrument-settings').open=!smallScreen.matches; }
smallScreen.addEventListener('change',fitInstrument);fitInstrument();
selectLesson(progress.selected);
mountMission($('mission-console'),{storage,onQualified:()=>{progress.flights++;save();}});
