import { transfer, orbitPoint, PARKING_RADIUS, EARTH_RADIUS, MOON_DISTANCE, MOON_PERIOD, LUNAR_REACH_BURN } from './apollo-physics.js';

const $ = (id) => document.getElementById(id);
const burn = $('burn');
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

function plot(orbit) {
  const geometry = $('orbit-geometry');
  const labels = $('orbit-labels');
  geometry.replaceChildren(); labels.replaceChildren();
  // Fit both the complete transfer ellipse and complete lunar-distance ring.
  // Equal axis scales preserve the geometry even when a short transfer is tiny.
  const extent = Math.max(MOON_DISTANCE, orbit.apogee);
  const scale = Math.min(662 / (extent + MOON_DISTANCE), 288 / (2 * MOON_DISTANCE));
  const centerX = 373 + (extent - MOON_DISTANCE) * scale / 2, centerY = 208;
  const sx = (x) => centerX + x * scale;
  const sy = (y) => centerY - y * scale;
  const points = Array.from({ length: 401 }, (_, i) => orbitPoint(orbit, i / 400 * 2 * Math.PI));
  const maxY = Math.max(...points.map(p => Math.abs(p.y))) * scale;
  // Keep the same scale on both axes; all slider states fit this viewBox.
  geometry.append(svg('path', {d:`M30 ${centerY}H704`,stroke:'#b6b1c544','stroke-dasharray':'3 5'}));
  geometry.append(svg('circle', {cx:centerX,cy:centerY,r:MOON_DISTANCE*scale,fill:'none',stroke:'#b6b1c566','stroke-dasharray':'4 6','stroke-width':1}));
  geometry.append(svg('path',{d:points.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(3)} ${sy(p.y).toFixed(3)}`).join(' ')+'Z',fill:'#ff633308',stroke:'#ff6333','stroke-width':1.7}));
  geometry.append(svg('circle',{cx:centerX,cy:centerY,r:Math.max(7,EARTH_RADIUS*scale),fill:'#dfdde7',stroke:'#f4f4ee','stroke-width':1}));
  geometry.append(svg('circle',{cx:sx(PARKING_RADIUS),cy:centerY,r:3,fill:'#ff6333'}));
  geometry.append(svg('path',{d:`M${sx(PARKING_RADIUS)} ${centerY-12}v-25`,stroke:'#ff8965','stroke-width':1.3}));
  geometry.append(svg('path',{d:`M${sx(PARKING_RADIUS)-4} ${centerY-30}l4 -7 4 7`,fill:'none',stroke:'#ff8965','stroke-width':1.3}));
  const labelStyle = { class:'orbit-label',fill:'#e5e1ed','font-family':'monospace','font-size':10 };
  const desktopLabel = { ...labelStyle,class:'orbit-label orbit-desktop-only' };
  const mobileLabel = { ...labelStyle,class:'orbit-label orbit-mobile-only' };
  labels.append(svg('text',{...labelStyle,x:centerX+14,y:centerY+25},'EARTH'));
  labels.append(svg('text',{...labelStyle,x:42,y:25},'MEAN LUNAR DISTANCE'));
  labels.append(svg('text',{...desktopLabel,x:42,y:41,'font-size':9,fill:'#a6a0b5'},'384,400 km · complete reference ring'));
  labels.append(svg('text',{...mobileLabel,x:42,y:51,fill:'#a6a0b5'},'384,400 km · full ring'));
  labels.append(svg('text',{...labelStyle,x:centerX+20,y:centerY-45,fill:'#ff8965'},'BURN'));
  const apoX=sx(-orbit.apogee);
  geometry.append(svg('circle',{cx:apoX,cy:centerY,r:3,fill:'#ff6333'}));
  labels.append(svg('text',{...desktopLabel,x:Math.max(apoX,43),y:centerY+maxY+31,fill:'#ff6333'},'APOGEE / '+format.format(orbit.apogee)+' km'));
  labels.append(svg('text',{...mobileLabel,x:Math.max(apoX,43),y:centerY+maxY+46,fill:'#ff6333'},'APOGEE '+format.format(orbit.apogee)+' km'));
  if(orbit.reachesMoon) {
    // Mark the first outward crossing, not an invented Moon/intercept.
    const p={x:MOON_DISTANCE*Math.cos(orbit.arrival.theta),y:MOON_DISTANCE*Math.sin(orbit.arrival.theta)};
    geometry.append(svg('circle',{cx:sx(p.x),cy:sy(p.y),r:5,fill:'#09090d',stroke:'#f4f4ee','stroke-width':2}));
    labels.append(svg('text',{...desktopLabel,x:sx(p.x)+10,y:sy(p.y)-15,fill:'#ff8965','font-size':9},'FIRST DISTANCE CROSSING'));
    labels.append(svg('text',{...mobileLabel,x:sx(p.x)-12,y:sy(p.y)-18,'text-anchor':'end',fill:'#ff8965'},'REACH'));
  }
  const barKm=extent>650000?200000:100000;
  geometry.append(svg('path',{d:`M42 382v6h${barKm*scale}v-6`,fill:'none',stroke:'#a6a0b5','stroke-width':1}));
  labels.append(svg('text',{...desktopLabel,x:42,y:408,'font-size':8,fill:'#a6a0b5'},format.format(barKm)+' km'));
  labels.append(svg('text',{...mobileLabel,x:42,y:418,fill:'#a6a0b5'},format.format(barKm)+' km'));
  labels.append(svg('text',{...desktopLabel,x:704,y:408,'text-anchor':'end','font-size':8,fill:'#a6a0b5'},'FULL LUNAR-DISTANCE CONTEXT · EQUAL AXIS SCALES'));
}

function updateBurn(deltaV) {
  const orbit=transfer(deltaV);
  $('burn-value').replaceChildren(document.createTextNode(deltaV.toFixed(3)+' '));
  const unit=document.createElement('small'); unit.textContent='km/s'; $('burn-value').append(unit);
  burn.setAttribute('aria-valuetext',`${(deltaV*1000).toFixed(2)} meters per second added`);
  $('apogee').textContent=format.format(orbit.apogee)+' km';
  $('time-label').textContent=orbit.reachesMoon?'TIME TO LUNAR DISTANCE':'TIME TO APOGEE';
  $('flight-time').textContent=((orbit.arrival?.t??orbit.halfPeriod)/3600).toFixed(1)+' hours';
  $('reach-status').textContent=orbit.reachesMoon
    ? 'Lunar distance reached. An encounter still needs the right direction, time, and lunar gravity.'
    : 'Short of lunar distance. Add velocity to raise the far end of the ellipse. In this full lunar-distance view, short transfers appear small.';
  plot(orbit);
}
burn.addEventListener('input',()=>updateBurn(Number(burn.value)/1000));
$('lunar-preset').addEventListener('click',()=>{
  // Preserve the exact mathematical threshold in the slider value too.
  burn.step='any'; burn.value=String(LUNAR_REACH_BURN*1000);
  updateBurn(LUNAR_REACH_BURN);
});
burn.addEventListener('keydown', e=>{
  // A precise preset remains keyboard-adjustable in one m/s increments.
  if(burn.step==='any' && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();
    const sign=['ArrowRight','ArrowUp'].includes(e.key)?1:-1;
    burn.step='1'; burn.value=String(Math.max(2800,Math.min(3190,Math.round(Number(burn.value))+sign)));
    updateBurn(Number(burn.value)/1000);
  }
});
$('reset-lab').addEventListener('click',()=>{burn.step='1';burn.value='3150';updateBurn(3.15);});

function updateClock(){
 const hours=Number($('coast').value),angle=hours*3600/MOON_PERIOD*2*Math.PI;
 const x=195+82*Math.cos(angle),y=112-82*Math.sin(angle);
 const arc=`M277 112 A82 82 0 0 0 ${x} ${y}`;
 $('moon-arc').setAttribute('d',arc); $('moon-sector').setAttribute('d',`M195 112 L277 112 A82 82 0 0 0 ${x} ${y}Z`);
 $('moon-dot').setAttribute('cx',x);$('moon-dot').setAttribute('cy',y);
 $('moon-radius').setAttribute('x2',x);$('moon-radius').setAttribute('y2',y);
 $('moon-degrees').textContent=(angle*180/Math.PI).toFixed(1)+'°';
 $('coast-value').textContent=hours+' hours';
 $('coast').setAttribute('aria-valuetext',`${hours} hours; Moon moves ${(angle*180/Math.PI).toFixed(1)} degrees`);
 $('moon-clock').setAttribute('aria-label',`In ${hours} hours, the Moon moves ${(angle*180/Math.PI).toFixed(1)} degrees in this uniform circular model.`);
}
$('coast').addEventListener('input',updateClock);
document.querySelectorAll('[data-answer]').forEach(button=>{
 button.setAttribute('aria-pressed','false');
 button.addEventListener('click',()=>{
   document.querySelectorAll('[data-answer]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
   $('answer-feedback').textContent=button.dataset.answer==='no'
     ? 'Exactly. Distance is only one constraint. The spacecraft and Moon must arrive at the same place at the same time, with an approach that supports the mission—and a workable plan for returning to Earth.'
     : 'Not yet. The Moon moves while you coast. A path can cross the right distance and still miss by hundreds of thousands of kilometres. You must target the encounter time and geometry, then plan the return.';
 });
});
updateBurn(Number(burn.value)/1000);updateClock();
