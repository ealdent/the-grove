// Run: node tests/datacenter/permitting.cjs
// Exercise the exact inline model without a browser; live UI proof covers its controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../learn/us-datacenter-grid-map.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const modelSource = script.split('// BEGIN PERMITTING MODEL')[1].split('// END PERMITTING MODEL')[0].replace(/^[^\n]*\n/, '');
const calculate = vm.runInNewContext(modelSource + '; calculateBuildout');
const close = (a,b) => assert(Math.abs(a-b)<1e-9, `${a} != ${b}`);
const example = {pipeline:10, exposure:50, delay:12, cancel:20};
const result = calculate(example);
close(result.online,8); close(result.deferred,1); close(result.cancelled,1);
close(calculate(example,12).online,1.25);
close(calculate(example,60).online,9);
const totalCancellation = calculate({pipeline:10,exposure:100,delay:48,cancel:100});
close(totalCancellation.online,0); close(totalCancellation.deferred,0); close(totalCancellation.cancelled,10);
const maximumDelay = {pipeline:10,exposure:100,delay:48,cancel:0};
close(calculate(maximumDelay).online,0); close(calculate(maximumDelay).deferred,10);
close(calculate(maximumDelay,96).online,10);
close(calculate({pipeline:10,exposure:0,delay:48,cancel:100}).online,10);
close(calculate({pipeline:10,exposure:100,delay:0,cancel:0}).online,10);
// Cancel first, delay survivors: all exposed, 50% canceled and 24 months late.
const noDoubleCount=calculate({pipeline:10,exposure:100,delay:24,cancel:50});
close(noDoubleCount.online,2.5); close(noDoubleCount.deferred,2.5); close(noDoubleCount.cancelled,5);
let checked=0;
for(const pipeline of [1,10,50]) for(const exposure of [0,25,60,100]) for(const cancel of [0,10,50,100]) {
  let previous=Infinity;
  for(const delay of [0,3,12,24,36,48]) {
    const inputs={pipeline,exposure,delay,cancel}, r=calculate(inputs);
    close(r.online+r.deferred+r.cancelled,pipeline);
    for(const v of Object.values(r)) assert(v>=-1e-9&&v<=pipeline+1e-9);
    assert(r.online<=previous+1e-9); previous=r.online;
    let last=0;
    for(let month=0;month<=96;month+=3) {const online=calculate(inputs,month).online;assert(online>=last-1e-9);last=online;}
    close(last,pipeline-r.cancelled);
    checked++;
  }
}
// Named labels and fragments must resolve, including the chart descriptions.
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
const references=[...html.matchAll(/(?:href="#|for=")([^"]+)"/g)].map(m=>m[1]);
for(const match of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) references.push(...match[1].split(/\s+/));
references.forEach(id=>assert(ids.includes(id),'Missing reference: '+id));
console.log(`PASS: independent example, cancellation/delay boundaries, no double count, ${checked} conservation/monotonicity cases, syntax and accessible references.`);
