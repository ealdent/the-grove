import {Simulation,makeSeed,createModel,predictDelta,teacherDelta,makeDataset,mse,createOptimizer,trainEpoch} from './delayed-nca-engine.js';

const $ = id => document.getElementById(id);
const size = 48;
let baseline, delayed, running = false, training = false, trained = false, model = createModel(7);
const randomModel = createModel(7);
let lossPoints = [];
const contexts = ['baseline','delayed'].map(id => $(id).getContext('2d'));
const pixelCanvas = document.createElement('canvas');
pixelCanvas.width = pixelCanvas.height = size;
const pixelContext = pixelCanvas.getContext('2d');
const pixels = pixelContext.createImageData(size,size);

function rule(self,neighbor) {
  if ($('rule').value === 'teacher') return teacherDelta(self,neighbor);
  return predictDelta($('rule').value === 'random' ? randomModel : model,self,neighbor);
}
function seedValue() {
  const value = Number($('seed').value);
  const seed = Number.isFinite(value) ? Math.max(0,Math.min(4294967295,Math.trunc(value))) : 42;
  $('seed').value = String(seed);
  return seed;
}
function pause() { running = false; $('play').textContent = 'Run experiment'; }
function reset() {
  pause();
  const pulseRadius = Number($('pulse-radius').value);
  const options = {size,radius:Number($('radius').value),expand:$('expand').checked,initial:makeSeed(size,seedValue(),$('pattern').value,pulseRadius),rule};
  $('pulse-radius').disabled = $('pattern').value !== 'pulse';
  $('pulse-radius-value').textContent = pulseRadius === 0 ? '0 · single cell' : `${pulseRadius} cell${pulseRadius === 1 ? '' : 's'}`;
  $('pulse-note').textContent = pulseRadius === 0
    ? 'Single-cell probe: diffusion makes this fade almost to zero before any recovery, especially with the learned rule.'
    : 'A filled disk at +1; radius 5 starts with 81 cells. Compare the growing front over ticks 10–40. The random seed affects islands only.';
  baseline = new Simulation({...options,delay:0});
  delayed = new Simulation({...options,delay:Number($('delay').value)});
  $('radius-value').textContent = `${options.radius} cells`;
  $('delay-value').textContent = `${delayed.delay} tick${delayed.delay === 1 ? '' : 's'}`;
  $('delay-label').textContent = delayed.delay ? `READ S(t − ${delayed.delay === 1 ? '' : `${delayed.delay}×`}d)` : 'READ S(t)';
  $('rule-badge').textContent = {teacher:'Reference rule (handwritten)',learned:'Learned · 300 epochs',random:'Untrained random weights'}[$('rule').value];
  render();
}
function drawField(context,state) {
  for(let i=0;i<state.length;i++) {
    const value=state[i], strength=Math.abs(value), target=value<0?[250,156,121]:[148,223,193];
    for(let c=0;c<3;c++) pixels.data[i*4+c]=[20,44,44][c]+(target[c]-[20,44,44][c])*strength;
    pixels.data[i*4+3]=255;
  }
  pixelContext.putImageData(pixels,0,0);
  context.imageSmoothingEnabled=false;
  context.drawImage(pixelCanvas,0,0,context.canvas.width,context.canvas.height);
}
function render() {
  const referenceModel = $('rule').value === 'random' || !trained ? randomModel : model;
  $('student-heading').textContent = referenceModel === randomModel ? 'Student (untrained)' : 'Student (trained)';
  $('rule-reference').replaceChildren();
  for (const [self,neighbor] of [[0,0],[0,.5],[.5,0],[.5,.5],[.1,.1]]) {
    const row = document.createElement('tr');
    const next = delta => Math.max(-1,Math.min(1,self+delta));
    for (const value of [self,neighbor,next(teacherDelta(self,neighbor)),next(predictDelta(referenceModel,self,neighbor))]) {
      const cell = document.createElement('td');cell.textContent=value.toFixed(4);row.append(cell);
    }
    $('rule-reference').append(row);
  }
  drawField(contexts[0],baseline.state); drawField(contexts[1],delayed.state);
  const mean = state => state.reduce((sum,v)=>sum+v,0)/state.length;
  const fieldStat = state => {
    if ($('pattern').value !== 'pulse') return `Mean ${mean(state).toFixed(3)}`;
    const count = state.filter(v=>v>=.1).length;
    return `${count} cell${count === 1 ? '' : 's'} ≥ 0.1`;
  };
  $('base-stat').textContent=fieldStat(baseline.state);
  $('delay-stat').textContent=fieldStat(delayed.state);
  const difference=baseline.state.reduce((sum,v,i)=>sum+Math.abs(v-delayed.state[i]),0)/baseline.state.length;
  $('difference').textContent=`Mean absolute difference: ${difference.toFixed(4)}`;
  $('clock').textContent=`TICK ${String(baseline.tick).padStart(3,'0')} · ${running?'RUNNING':'PAUSED'}`;
  $('active').textContent=`Next active radius: ${delayed.activeRadius()} / ${delayed.radius}`;
  $('arrival').textContent=`At t = ${delayed.tick}, calculate S(${delayed.tick+1}). Source times for the next delayed update:`;
  $('rings').replaceChildren();
  for(let d=1;d<=delayed.radius;d++) {
    const chip=document.createElement('span'), time=delayed.tick-d*delayed.delay, active=d<=delayed.activeRadius();
    chip.className=`ring${active?(time<0?' past':''):' inactive'}`;
    chip.textContent=`d=${d} → ${active?(time<0?`S(${time}) = 0`:`S(${time})`):'inactive'}`;
    $('rings').append(chip);
  }
  $('arrival-note').textContent=delayed.delay===0?'Zero delay: both panels read the present and match exactly.':`Ring 1 waits ${delayed.delay} tick${delayed.delay===1?'':'s'}; ring ${delayed.radius} waits ${delayed.radius*delayed.delay}. Tan chips refer to the zero history before the seed.`;
}
function step() {baseline.step();delayed.step();render();}
$('play').addEventListener('click',()=>{running=!running;$('play').textContent=running?'Pause':'Run experiment';render();});
$('step').addEventListener('click',()=>{pause();step();});
$('reset').addEventListener('click',reset);
$('new-seed').addEventListener('click',()=>{$('seed').value=String((seedValue()+1)>>>0);reset();});
for(const id of ['radius','delay','pulse-radius']) $(id).addEventListener('input',reset);
for(const id of ['expand','pattern','seed','rule']) $(id).addEventListener('change',reset);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();render();}});
let last=0;
function frame(now){if(running&&now-last>=100){last=now;step();}requestAnimationFrame(frame);}
function drawLoss() {
  const canvas=$('loss'), context=canvas.getContext('2d');
  context.clearRect(0,0,canvas.width,canvas.height);
  context.strokeStyle='#c9cabb';context.beginPath();context.moveTo(0,63);context.lineTo(500,63);context.stroke();
  if(lossPoints.length<2)return;
  const logs=lossPoints.map(p=>Math.log10(Math.max(p,1e-12))), max=Math.max(...logs), min=Math.min(...logs)-.1;
  context.strokeStyle='#305e4c';context.lineWidth=2;context.beginPath();
  logs.forEach((v,i)=>{const x=i/(logs.length-1)*498+1,y=3+(max-v)/(max-min)*55;i?context.lineTo(x,y):context.moveTo(x,y);});context.stroke();
}
$('train').addEventListener('click',async()=>{
  if(training)return;
  training=true;pause();render();
  const controls=[...document.querySelectorAll('button,input,select')];
  controls.forEach(el=>el.disabled=true);
  model=createModel(7);
  const dataset=makeDataset(1024,123), validation=makeDataset(256,456), optimizer=createOptimizer(.01);
  const before=mse(model,validation);lossPoints=[before];drawLoss();
  try {
    for(let epoch=0;epoch<300;epoch+=5){
      for(let j=0;j<5;j++)trainEpoch(model,dataset,optimizer);
      const error=mse(model,validation);lossPoints.push(error);drawLoss();
      $('training-status').textContent=`Epoch ${epoch+5}/300 · held-out MSE ${error.toExponential(3)}`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const after=mse(model,validation);trained=true;
    $('training-status').textContent=`Held-out MSE: ${before.toExponential(3)} → ${after.toExponential(3)} (${(before/after).toFixed(1)}× lower). Log-scale loss above.`;
    $('rule').value='learned';
  } catch(error) {
    $('training-status').textContent=`Training failed: ${error.message}`;
    $('rule').value='teacher';trained=false;
  } finally {
    training=false;controls.forEach(el=>el.disabled=false);
    const learnedOption=$('rule').querySelector('[value="learned"]');
    learnedOption.disabled=!trained;
    learnedOption.textContent=trained?'Learned network · 300 epochs':'Learned network (train first)';
    reset();
  }
});
reset();drawLoss();requestAnimationFrame(frame);
