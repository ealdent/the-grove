import test from 'node:test';
import assert from 'node:assert/strict';
import {newFlight,referencePlan,executeFlight,flightMetrics,undoFlight,saveFlight,readFlight,planBurn,previewFlight} from '../learn/apollo-mission-state.js';
test('engine-duration commands achieve a two-burn rendezvous across varied missions',()=>{for(let seed=1;seed<=50;seed++){let f=newFlight(seed);const p=referencePlan(f,.7);f=executeFlight(f,{type:'burn',heading:90,throttle:.7,duration:p.departureDuration});f=executeFlight(f,{type:'coast',seconds:p.coastTime});assert.ok(!flightMetrics(f).success,'flyby is not docking');f=executeFlight(f,{type:'burn',heading:270,throttle:.7,duration:p.arrivalDuration});const m=flightMetrics(f);assert.ok(m.success);assert.ok(m.separation<.001);assert.ok(m.relativeSpeed<1e-6);assert.equal(f.state.t,p.coastTime);}});
test('undo and storage retain assistance and reproduce exact flight state',()=>{let f=newFlight(77);f.assisted=true;const p=referencePlan(f);f=executeFlight(f,{type:'burn',heading:90,throttle:1,duration:p.departureDuration});const first=f;f=executeFlight(f,{type:'coast',seconds:100});f=undoFlight(f);assert.deepEqual(f.state,first.state);assert.equal(f.assisted,true);const storage={setItem(k,v){this.value=v;},getItem(){return this.value;}};assert.equal(saveFlight(storage,f),true);const restored=readFlight(storage);assert.deepEqual(restored.state,f.state);assert.equal(restored.assisted,true);assert.deepEqual(restored.commands,f.commands);});
test('invalid commands do not mutate flight and fuel clips safely',()=>{const f=newFlight(1),before=JSON.stringify(f);assert.throws(()=>executeFlight(f,{type:'coast',seconds:-5}));assert.throws(()=>planBurn(f,{heading:90,throttle:2,duration:20}));assert.equal(JSON.stringify(f),before);const clipped=executeFlight(f,{type:'burn',heading:90,throttle:1,duration:600});assert.equal(clipped.state.mass,clipped.state.dryMass);assert.match(clipped.commands[0].detail,/cutoff/);assert.throws(()=>executeFlight(clipped,{type:'burn',heading:90,throttle:1,duration:1}));});

test('command previews match execution while preserving the current flight and log',()=>{
  const flight=newFlight(18),before=structuredClone(flight),plan=referencePlan(flight,.6);
  const burn={heading:90,throttle:.6,duration:plan.departureDuration};
  const preview=previewFlight(flight,{burn,seconds:plan.coastTime});
  const executed=executeFlight(executeFlight(flight,{...burn,type:'burn'}),{type:'coast',seconds:plan.coastTime});
  assert.deepEqual(preview.state,executed.state);
  assert.deepEqual(preview.path,executed.path);
  assert.deepEqual(flight,before,'preview must not consume propellant, advance time, or log commands');
  const burnOnly=previewFlight(flight,{burn});
  assert.equal(burnOnly.state.t,0);
  assert.ok(burnOnly.state.mass<flight.state.mass);
});

test('previews reject the same time, surface-impact and command-budget limits as execution',()=>{
  let flight=newFlight(22);
  for(let i=0;i<8;i++)flight=executeFlight(flight,{type:'coast',seconds:20000});
  flight=executeFlight(flight,{type:'coast',seconds:12799});
  assert.equal(flight.state.t,172799);
  assert.throws(()=>previewFlight(flight,{seconds:2}),/48 hours/);
  assert.throws(()=>previewFlight(flight,{seconds:.001}),/between/);
  assert.throws(()=>previewFlight(flight,{seconds:20001}),/between/);
  assert.throws(()=>previewFlight({...flight,status:'impact'},{seconds:1}),/Earth’s surface/);
  const full={...newFlight(22),commands:Array.from({length:80},()=>({type:'coast',seconds:1}))};
  assert.throws(()=>previewFlight(full,{seconds:1}),/log is full/);
  assert.throws(()=>previewFlight(full,{burn:{heading:90,throttle:1,duration:1}}),/log is full/);
});

test('impact previews stop at the surface, and actual impact can be undone and replayed',()=>{
  let flight=newFlight(41);
  flight=executeFlight(flight,{type:'burn',heading:270,throttle:1,duration:30});
  const before=structuredClone(flight),preview=previewFlight(flight,{seconds:10000});
  assert.equal(preview.status,'impact');
  assert.ok(preview.state.t>0&&preview.state.t<10000);
  flight=executeFlight(flight,{type:'coast',seconds:10000});
  assert.deepEqual(flight.state,preview.state);
  assert.throws(()=>executeFlight(flight,{type:'coast',seconds:1}),/surface/);
  assert.deepEqual(undoFlight(flight),before);
  const storage={setItem(k,v){this.value=v;},getItem(){return this.value;}};
  saveFlight(storage,flight);
  assert.deepEqual(readFlight(storage),flight);
});
