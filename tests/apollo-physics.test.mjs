import test from 'node:test';
import assert from 'node:assert/strict';
import { MU, PARKING_RADIUS, CIRCULAR_SPEED, ESCAPE_SPEED, MOON_DISTANCE, LUNAR_REACH_BURN, transfer, orbitPoint, positionAtTime } from '../learn/apollo-physics.js';
const near=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
test('unburned orbit is circular and conserves the expected orbital energy',()=>{
 const o=transfer(0);near(o.a,PARKING_RADIUS);near(o.apogee,PARKING_RADIUS);near(o.e,0);
 near(o.energy,-MU/(2*PARKING_RADIUS));near(o.speed,CIRCULAR_SPEED);
 for(let i=0;i<=32;i++){const p=orbitPoint(o,i*Math.PI/16);near(Math.hypot(p.x,p.y),PARKING_RADIUS);}
});
test('minimum lunar reach matches independent transfer-ellipse calculation',()=>{
 near(LUNAR_REACH_BURN,3.131345,1e-6);
 const o=transfer(LUNAR_REACH_BURN);assert.ok(o.reachesMoon);near(o.apogee,MOON_DISTANCE,1e-5);
 near(o.arrival.t/3600,119.470891,1e-4);near(o.arrival.t,o.halfPeriod,.01);
});
test('extra departure energy crosses lunar distance earlier, before apogee',()=>{
 const o=transfer(3.15);assert.ok(o.reachesMoon);near(o.arrival.t/3600,75.162166,1e-4);
 assert.ok(o.arrival.t<o.halfPeriod);const p=positionAtTime(o,o.arrival.t);near(Math.hypot(p.x,p.y),MOON_DISTANCE,1e-5);
 near(Math.atan2(p.y,p.x),o.arrival.theta,1e-9);
});
test('a short transfer does not invent an encounter time',()=>{
 const o=transfer(3.13);assert.ok(!o.reachesMoon);assert.equal(o.arrival,null);assert.ok(o.apogee<MOON_DISTANCE);
});
test('all slider states are finite, bound, monotonic and conserve perigee',()=>{
 let previousApogee=0,previousCrossing=Infinity;
 for(let dv=2800;dv<=3190;dv++){
  const o=transfer(dv/1000);assert.ok(o.e>=0&&o.e<1);assert.ok(o.apogee>previousApogee);previousApogee=o.apogee;
  near(o.a*(1-o.e),PARKING_RADIUS,1e-7);near(orbitPoint(o,0).x,PARKING_RADIUS,1e-7);
  near(orbitPoint(o,Math.PI).x,-o.apogee,1e-6);
  const end=positionAtTime(o,o.halfPeriod);near(end.x,-o.apogee,1e-6);near(end.y,0,1e-6);
  if(o.arrival){assert.ok(o.arrival.t<previousCrossing);previousCrossing=o.arrival.t;}
 }
});
test('invalid or unbound burns are rejected instead of drawing false ellipses',()=>{
 for(const dv of [-.1,NaN,Infinity,ESCAPE_SPEED-CIRCULAR_SPEED,10])assert.throws(()=>transfer(dv),RangeError);
});
