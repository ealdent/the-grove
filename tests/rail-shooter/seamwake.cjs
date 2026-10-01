// Run: node tests/rail-shooter/seamwake.cjs
// Regression coverage for reproduced collision, boss tell, screen-state and audio-state defects.
// Execute the shipped script, excluding browser boot. Native WebGL, DOM focus, audio output
// and file-URL launch require browser proof; these source-native scenarios do not claim it.
'use strict';
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('node:path');
const file = path.resolve(__dirname, '../../rail-shooter/gpt-6.1-sol-max-rail-shooter.html');
const html = fs.readFileSync(file,'utf8');
let source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.substring(0,source.lastIndexOf('try{A=new SeamAudio()'));
const hash=crypto.createHash('sha256').update(html).digest('hex');
function makeContext(){
  const elements=new Map();
  const handlers=new Map();
  const classList=()=>{const set=new Set();return {add:(...xs)=>xs.forEach(x=>set.add(x)),remove:(...xs)=>xs.forEach(x=>set.delete(x)),toggle:(x,on)=>{if(on===undefined)on=!set.has(x);on?set.add(x):set.delete(x);return on;},contains:x=>set.has(x),values:()=>[...set]};};
  const get=id=>{if(!elements.has(id))elements.set(id,{id,style:{},classList:classList(),textContent:'',innerHTML:'',setAttribute(){},focus(){},addEventListener(type,fn){handlers.set(id+':'+type,fn)},children:Array.from({length:5},()=>({classList:classList()}))});return elements.get(id);};
  const context=vm.createContext({console,document:{getElementById:get,body:{dataset:{}},querySelectorAll:()=>Array.from({length:4},()=>({classList:classList()})),addEventListener(type,fn){handlers.set('document:'+type,fn)}},window:{addEventListener(type,fn){handlers.set('window:'+type,fn)}},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>0},requestAnimationFrame(){},innerWidth:1440,innerHeight:900,devicePixelRatio:1,location:{reload(){}}});
  vm.runInContext(source,context,{filename:file});
  const run=code=>vm.runInContext(code,context);
  run("startGame();");
  return {context,run,elements,handlers,ev:(type,code)=>handlers.get('window:'+type)?.({code,repeat:false,preventDefault(){}})};
}
const result={file,sha256:hash,tests:[]};
function test(name,fn){const h=makeContext();try{result.tests.push({name,...fn(h)});}catch(e){result.tests.push({name,error:e.stack});}}
test('restart and pause preserve game state then reset all simulation pools',h=>{
 h.ev('keydown','KeyD');h.run('step(.016);step(.016);pauseGame();');
 const before=h.run('JSON.stringify({state,time:run.time,player,counts:[entities.length,shots.length,motes.length,rings.length],keys:[...keys]})');h.run('step(.045);step(.045)');
 const paused=h.run('JSON.stringify({state,time:run.time,player,counts:[entities.length,shots.length,motes.length,rings.length],keys:[...keys]})');
 h.run('startGame()');const restarted=h.run('JSON.stringify({state,time:run.time,player,run,counts:[entities.length,shots.length,motes.length,rings.length]})');
 return {passed:before===paused,before:JSON.parse(before),restarted:JSON.parse(restarted)};
});
test('terminal injury with same-plane second actor remains dying with one life decrement',h=>{
 h.run("run.life=1;player.inv=0;addEntity({kind:'bullet',x:0,y:3.1,z:8.1,vx:0,vy:0,vz:-48});addEntity({kind:'bullet',x:0,y:3.1,z:8.1,vx:0,vy:0,vz:-48});step(.016);");
 const terminal=h.run('JSON.stringify({state,life:run.life,deathTime:run.deathTime,entities:entities.length,motes:motes.length})');h.run('for(let i=0;i<120;i++)step(1/60)');
 return {terminal:JSON.parse(terminal),end:JSON.parse(h.run('JSON.stringify({state,life:run.life,deathTime:run.deathTime})'))};
});
test('victory cleanup and replay',h=>{
 h.run("beginBoss();run.boss.hp=0;addEntity({kind:'bullet',x:0,y:3,z:30,vx:0,vy:0,vz:-48});step(.016);for(let i=0;i<270;i++)step(1/60)");
 const end=h.run('JSON.stringify({state,score:run.score,life:run.life,dead:entities.filter(e=>e.dead).length,bossKilled:run.bossKilled})');h.run('startGame()');
 return {end:JSON.parse(end),restart:JSON.parse(h.run('JSON.stringify({state,time:run.time,boss:run.boss,entities:entities.length,shots:shots.length,score:run.score})'))};
});
test('ground hazards remain after backstitch and shots',h=>{
 h.run("run.charge=1;addEntity({kind:'pin',x:0,y:0,z:35,height:5.6,width:.24,phase:0});addEntity({kind:'button',x:0,y:3.1,z:35,baseX:0,baseY:3.1,phase:0,hp:10,fireAt:99});backstitch();shots.push({x:0,y:3,z:30,px:0,py:3,pz:30,vx:0,vy:0,life:1});updateEntities(.016);updateShots(.1);");
 return {actors:JSON.parse(h.run('JSON.stringify(entities.map(e=>({kind:e.kind,dead:e.dead})))')),shots:JSON.parse(h.run('JSON.stringify(shots)'))};
});
test('Unwind targets firing position after player moves through tell',h=>{
 h.run('beginBoss();const b=run.boss;b.pattern=2;player.x=-5;player.y=2;tellBoss(b);player.x=5;player.y=6;fireBoss(b)');
 return JSON.parse(h.run('JSON.stringify({attack:run.boss.attack,aimX:run.boss.aimX,aimY:run.boss.aimY,player,bulletTargets:entities.map(e=>({x:e.x+e.vx*(e.z-8)/(-e.vz),y:e.y+e.vy*(e.z-8)/(-e.vz)}))})'));
});
test('Comb gaps rotate on successive attack cycles',h=>{
 h.run('beginBoss()');const tells=[];for(let i=0;i<12;i++){h.run('tellBoss(run.boss)');tells.push(JSON.parse(h.run('JSON.stringify({attack:run.boss.attack,gap:run.boss.gap})')));}return {tells};
});
test('player projectile sweeps fast relative-moving target',h=>{
 h.run("addEntity({kind:'button',x:0,y:3.1,z:19,baseX:0,baseY:3.1,phase:0,hp:6,fireAt:99});shots.push({x:0,y:3.1,z:10,px:0,py:3.1,pz:10,vx:0,vy:0,life:1});updateEntities(.045);updateShots(.045)");
 return JSON.parse(h.run('JSON.stringify({kills:run.kills,score:run.score,shots:shots.length,enemy:entities[0]})'));
});
test('near miss at collision plane is safe despite dangerous frame endpoint',h=>{
 h.run("player.inv=0;player.x=-.7;player.y=3.1;player.vx=10.8;keys.add('KeyD');addEntity({kind:'pin',x:0,y:0,z:8.03,height:6,width:.24,phase:0});step(1/60)");
 return JSON.parse(h.run('JSON.stringify({state,life:run.life,player,entity:entities[0],actualCrossingPlayerX:-.7+10.8*(.03/run.speed)})'));
});
test('victory-cleared hostile bullet does not remain visibly rendered',h=>{
 h.run("beginBoss();run.boss.hp=0;addEntity({kind:'bullet',x:2,y:3,z:30,vx:0,vy:0,vz:-48});step(.016);var drawn=[];R={put:(...args)=>drawn.push(args),line(){}};drawEntities()");
 return JSON.parse(h.run('JSON.stringify({state,bulletDead:entities.find(e=>e.kind===\"bullet\")?.dead,hostileMeshes:drawn.filter(d=>d[0]===\"hinge\").length})'));
});
test('musical mood state updates when victory or death happen while muted',h=>{
 h.run("A=new SeamAudio();A.context={state:'running',currentTime:1};A.muted=true;A.sfx('victory');var mutedVictory=A._victory;A.reset();A.sfx('death');var mutedDeath=A._fallen");
 return JSON.parse(h.run('JSON.stringify({mutedVictory,mutedDeath})'));
});
test('actual pin impact at crossing is not erased by moving clear later in frame',h=>{
 h.run("player.inv=0;player.x=-.5;player.y=3.1;player.vx=-10.8;keys.add('KeyA');addEntity({kind:'pin',x:0,y:0,z:8.03,height:6,width:.24,phase:0});step(1/60)");
 return JSON.parse(h.run('JSON.stringify({life:run.life,player,entity:entities[0],crossingX:-.5-10.8*(.03/run.speed)})'));
});
test('Unwind visible target follows current player during tell',h=>{
 h.run("beginBoss();run.boss.pattern=2;player.x=-5;player.y=2;tellBoss(run.boss);player.x=5;player.y=6;updateBoss(.1)");
 return JSON.parse(h.run('JSON.stringify({attack:run.boss.attack,aimX:run.boss.aimX,aimY:run.boss.aimY,tell:run.boss.tell})'));
});
test('inactive screen controls are inert across play pause result title flows',h=>{
 const states=[];for(const state of ['play','pause','over','won','title']){h.run('changeState('+JSON.stringify(state)+')');states.push({state,title:h.elements.get('title').inert,pause:h.elements.get('pause').inert,result:h.elements.get('result').inert});}return {states};
});
const t=result.tests;
const checks=[t[0].passed,t[1].terminal.state==='dying'&&t[1].terminal.life===0&&t[1].end.state==='over',t[2].end.state==='won'&&t[2].restart.time===0&&t[2].restart.entities===0&&t[2].restart.boss===null,t[3].actors.length===1&&t[3].actors[0].kind==='pin'&&t[3].actors[0].dead===false,t[4].aimX===5&&t[4].aimY===6,JSON.stringify(t[5].tells.filter(x=>x.attack===1).map(x=>x.gap))==='[-3.4,0,3.4,-3.4]',t[6].kills===1&&t[6].shots===0,t[7].life===5&&t[7].entity.grazed===true,t[8].hostileMeshes===0,t[9].mutedVictory===true&&t[9].mutedDeath===true,t[10].life===4,t[11].aimX===5&&t[11].aimY===6&&t[11].tell>0,t[12].states.every(x=>x.title!==(x.state==='title')&&x.pause!==(x.state==='pause')&&x.result!==['over','won'].includes(x.state))];
result.summary={passed:checks.filter(Boolean).length,total:checks.length,allPassed:checks.every(Boolean)};

if (!result.summary.allPassed) console.error(JSON.stringify(result, null, 2));
if(require.main===module&&!result.summary.allPassed)process.exitCode=1;


function runCampaign(hz){
 const h=makeContext(),snap=h.run('({get state(){return state},get run(){return run},get player(){return player},get entities(){return entities},get motes(){return motes},get shots(){return shots},get rings(){return rings}})'),step=h.run('step'),pointerMove=h.handlers.get('world:pointermove');
 let peak={entities:0,shots:0,motes:0,rings:0},damage=[],stage=[],bossAttacks=[],lastAttack=-1,target={x:0,y:3.5},lastLife=5,lastStage=0,lastPattern=0,frames=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 for(;frames<hz*260 && !['over','won','lost'].includes(snap.state);frames++){
  const {run:r,player:p,entities:e}=snap;
  if(snap.state==='play'){
   const targets=e.filter(q=>!q.dead && ['button','wasp'].includes(q.kind)&&q.z>20&&q.z<130);
   if(r.boss)target={x:r.boss.x,y:r.boss.y};
   else if(targets.length){let best=null,min=1e6;for(const q of targets){const d=(q.x-p.x)**2+(q.y-p.y)**2+q.z*.025;if(d<min){best=q;min=d;}}target={x:best.x,y:best.y};}
   else target={x:p.x,y:4.2};
   const threats=e.filter(q=>!q.dead).map(q=>({...q,t:(q.z-8)/(['bullet','ribbon'].includes(q.kind)?-q.vz:r.speed+(['button','wasp'].includes(q.kind)?2:0))})).filter(q=>q.t>0&&q.t<2.1);
   const candidates=[target,{x:p.x,y:p.y}];
   for(let x=-5.8;x<=5.81;x+=.8)for(let y=1;y<=6.61;y+=.7)candidates.push({x,y});
   let chosen=null,bestCost=1e9;
   for(const c of candidates){
    let cost=.32*((c.x-target.x)**2+(c.y-target.y)**2)+.045*((c.x-p.x)**2+(c.y-p.y)**2);
    for(const q of threats){
     const x=q.x+(q.vx||0)*q.t,y=q.y+(q.vy||0)*q.t;
     let d;
     if(['pin','thimble'].includes(q.kind))d=Math.max(Math.abs(x-c.x)-(q.width+.48),c.y-(q.height+.48));
     else if(q.kind==='ribbon')d=Math.max(Math.abs(x-c.x)-(q.hw+.43),Math.abs(y-c.y)-(q.hh+.43));
     else d=Math.hypot(x-c.x,y-c.y)-(['button','wasp'].includes(q.kind)?1.04:.65);
     cost+=d<0?70*Math.exp(-q.t):3*Math.exp(-q.t)*Math.exp(-d*5);
    }
    if(cost<bestCost){bestCost=cost;chosen=c;}
   }
   pointerMove({clientX:(.5+chosen.x/18)*1440,clientY:(7.9-chosen.y)/9*900});
   if(r.charge>=.999 && (threats.some(q=>q.t<.55)||r.boss||r.time>15))h.ev('keydown','Space');
  }
  step(1/hz);
  if(snap.run.life<lastLife)damage.push({time:snap.run.time,life:snap.run.life,player:{x:snap.player.x,y:snap.player.y}});
  if(snap.run.stage!==lastStage)stage.push({time:snap.run.time,stage:snap.run.stage,life:snap.run.life});
  lastLife=snap.run.life;lastStage=snap.run.stage;
  if(snap.run.boss&&snap.run.boss.pattern!==lastPattern){lastPattern=snap.run.boss.pattern;bossAttacks.push({time:snap.run.time,attack:snap.run.boss.attack,gap:snap.run.boss.gap});}
  peak.entities=Math.max(peak.entities,snap.entities.length);peak.shots=Math.max(peak.shots,snap.shots.length);peak.motes=Math.max(peak.motes,snap.motes.length);peak.rings=Math.max(peak.rings,snap.rings.length);
 }
 const r=snap.run;
 return {hz,frames,end:{state:snap.state,time:r.time,life:r.life,score:r.score,kills:r.kills,grazes:r.grazes,bossHp:r.boss?.hp},peak,damage,stage,bossAttacks};
}

const campaigns = [runCampaign(60), runCampaign(30)];
for (const campaign of campaigns) {
  const attacks = new Set(campaign.bossAttacks.map(a => a.attack));
  if (campaign.end.state !== 'won' || campaign.end.life < 1 || attacks.size !== 3 || campaign.peak.entities > 100 || campaign.peak.shots > 70 || campaign.peak.motes > 360) {
    console.error('Campaign acceptance failed', JSON.stringify(campaign, null, 2));
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log(`${result.summary.passed} regression checks passed; ordinary-input campaigns won at 60/30 Hz in ${campaigns.map(c => c.end.time.toFixed(2)).join('/')} seconds. Source SHA256: ${hash}`);
