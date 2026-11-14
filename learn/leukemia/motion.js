'use strict';
/* Finite, seekable teaching sequences. Time and cell numbers are illustrative. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = x => Math.max(0, Math.min(1, x));
  const phase = (p, a, b) => { const t = clamp((p-a)/(b-a)); return t*t*(3-2*t); };
  const mix = (a,b,t) => a+(b-a)*t;
  function node(parent, tag, attrs) {
    const el = document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value));
    parent.append(el); return el;
  }
  function sprite(parent,kind) {return node(parent,'use',{href:'#cell-'+kind,width:100,height:100});}
  function place(el,x,y,size,opacity=1){
    el.setAttribute('transform',`translate(${(x-size/2).toFixed(2)} ${(y-size/2).toFixed(2)}) scale(${(size/100).toFixed(3)})`);
    el.setAttribute('opacity',clamp(opacity).toFixed(3));
  }
  window.buildLeukemiaMarrowScene = (svg,key) => {
    const root=svg.querySelector('#marrow-cells');root.replaceChildren();
    node(root,'path',{d:'M68 354Q265 336 462 354V428Q265 446 68 428Z',fill:'#e7bbb8',stroke:'#b98084','stroke-width':1});
    node(root,'path',{d:'M88 390H443M429 384L443 390L429 396',fill:'none',stroke:'#ad6a76','stroke-width':1.5});
    const label=node(root,'text',{x:265,y:107,'text-anchor':'middle',fill:'#735c6d','font-size':13,'letter-spacing':1});label.textContent=key==='aml'?'ABNORMAL BLASTS':'DEVELOPING BLOOD CELLS';
    const bloodLabel=node(root,'text',{x:265,y:433,'text-anchor':'middle',fill:'#784653','font-size':12,'letter-spacing':1});bloodLabel.textContent='INTO THE BLOOD →';
    const guides=[165,265,365].map(x=>node(root,'path',{d:`M${x} 230V338m-5-8 5 8 5-8`,fill:'none',stroke:'#b49a9f','stroke-width':1.5,'stroke-dasharray':'3 5'}));
    const starting=[sprite(root,'stem'),sprite(root,'stem'),sprite(root,'stem')];
    const working=[sprite(root,'red'),sprite(root,'white'),sprite(root,'red')];
    const irregular=[sprite(root,'irregular'),sprite(root,'irregular')];
    const fragments=Array.from({length:7},()=>node(root,'circle',{r:3,fill:'#9b7696'}));
    const blasts=Array.from({length:15},()=>sprite(root,'blast'));
    const annotation=node(root,'text',{x:265,y:326,'text-anchor':'middle',fill:'#75465c','font-size':14});
    const descriptions = {
      healthy:[{at:0,title:'Develop',text:'Blood-forming cells begin a series of maturation steps.'},{at:.35,title:'Mature',text:'Developing cells acquire the features needed to do their jobs.'},{at:.72,title:'Enter blood',text:'Mature cells enter the bloodstream and supply the body.'}],
      mds:[{at:0,title:'Develop',text:'The marrow keeps making cells, but their development is abnormal.'},{at:.35,title:'Stall or die',text:'Some cells fail to mature; many die before becoming useful.'},{at:.72,title:'Less useful blood',text:'Some mature cells get through. Blood production is still ineffective.'}],
      aml:[{at:0,title:'Abnormal blast',text:'An abnormal immature cell does not mature into a working blood cell.'},{at:.28,title:'Divide again',text:'Its descendants keep dividing while staying immature.'},{at:.72,title:'Disrupt production',text:'Blasts accumulate and interfere with normal blood production.'}]
    };
    return {beats:descriptions[key],render(p){
      [...starting,...working,...irregular,...blasts,...fragments].forEach(el=>el.setAttribute('opacity',0));
      guides.forEach(el=>el.setAttribute('opacity',key==='aml'?1-phase(p,.35,.8):.7));
      annotation.textContent='';
      if(key!=='aml'){
        const mature=phase(p,.2,.5), leave=phase(p,.62,.95);
        starting.forEach((el,i)=>place(el,[165,265,365][i],mix(175,225,mature),70,1-mature));
        if(key==='healthy'){
          working.forEach((el,i)=>place(el,mix([165,265,365][i],[205,305,402][i],leave),mix(225,388,leave),i===1?60:66,mature));
        } else {
          place(working[0],mix(165,215,leave),mix(225,388,leave),66,mature);
          const death=phase(p,.45,.78);
          place(irregular[0],265,225,70*(1-.7*death),mature*(1-death));
          place(irregular[1],365,225,69,mature);
          fragments.forEach((el,i)=>{const a=i*2.4;el.setAttribute('cx',265+Math.cos(a)*35*death);el.setAttribute('cy',225+Math.sin(a)*35*death);el.setAttribute('opacity',(Math.sin(Math.PI*death)*.7).toFixed(3));});
          if(p>.74)annotation.textContent='Some cells never finish developing';
        }
      } else {
        // A binary lineage: daughters move apart before the next division.
        const levels=[[[265,175]],[[213,175],[317,175]],[[164,175],[230,221],[300,175],[365,221]],[[135,171],[175,216],[215,164],[248,245],[290,164],[322,222],[361,164],[389,248]]];
        let offset=0;
        levels.forEach((positions,level)=>{
          const born=level===0?1:phase(p,[0,.17,.38,.59][level],[0,.31,.52,.74][level]);
          const gone=level===3?0:phase(p,[.22,.43,.64][level],[.31,.52,.74][level]);
          positions.forEach(([x,y],i)=>{
            const parent=level?levels[level-1][Math.floor(i/2)]:[x,y];
            place(blasts[offset++],mix(parent[0],x,born),mix(parent[1],y,born),mix(54,65,born),born*(1-gone));
          });
        });
        const blocked=phase(p,.35,.8);
        place(starting[0],155,285,52,1-.65*blocked);
        place(starting[1],365,300,48,1-.65*blocked);
        place(working[0],mix(160,390,p),388,51,.9);
        if(p>.74)annotation.textContent='Fewer healthy cells are supplied';
      }
    }};
  };

  // All players share focus/visibility rules; each owns just one animation frame.
  const players=[];
  class AtlasMotion {
    constructor(host,svg,label,scene){
      this.host=host;this.svg=svg;this.label=label;this.progress=0;this.frame=0;this.last=0;this.inView=false;
      this.reduce=matchMedia('(prefers-reduced-motion: reduce)');this.playing=!this.reduce.matches;
      const controls=document.createElement('div');controls.className='motion-controls';
      controls.innerHTML=`<div class="motion-caption" aria-live="polite"><strong></strong><span></span></div><div class="motion-steps" role="group" aria-label="${label} stages"></div><div class="motion-transport"><button type="button" class="motion-play" aria-label="Play ${label.toLowerCase()}">Play</button><button type="button" class="motion-reset" aria-label="Reset ${label.toLowerCase()}">↺ Reset</button><input type="range" min="0" max="1000" step="1" value="0" aria-label="${label} animation progress"></div>`;
      host.append(controls);this.controls=controls;this.play=controls.querySelector('.motion-play');this.range=controls.querySelector('input');this.steps=controls.querySelector('.motion-steps');
      this.play.addEventListener('click',()=>{if(this.progress===1)this.progress=0;this.playing=!this.playing;this.draw();this.schedule();});
      controls.querySelector('.motion-reset').addEventListener('click',()=>{this.progress=0;this.playing=false;this.draw();this.schedule();});
      this.range.addEventListener('input',()=>{this.playing=false;this.progress=Number(this.range.value)/1000;this.draw();this.schedule();});
      this.reduce.addEventListener('change',()=>{if(this.reduce.matches){this.playing=false;this.draw();this.schedule();}});
      this.observer=new IntersectionObserver(entries=>{this.inView=entries[0].isIntersecting;this.schedule();},{threshold:.2});this.observer.observe(host);
      players.push(this);this.setScene(scene);
    }
    setScene(scene){
      this.scene=scene;this.progress=0;this.beat=-1;this.playing=!this.reduce.matches;
      this.steps.replaceChildren();scene.beats.forEach((beat,i)=>{const button=document.createElement('button');button.type='button';button.textContent=beat.label||beat.title;button.addEventListener('click',()=>{this.progress=beat.at;this.playing=false;this.draw();this.schedule();});this.steps.append(button);});
      this.draw();this.schedule();
    }
    draw(){
      this.scene.render(this.progress);this.range.value=String(Math.round(this.progress*1000));
      const beat=Math.max(0,this.scene.beats.findLastIndex(b=>this.progress>=b.at));
      if(beat!==this.beat){this.beat=beat;const data=this.scene.beats[beat];this.controls.querySelector('strong').textContent=data.title;this.controls.querySelector('.motion-caption span').textContent=data.text;[...this.steps.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===beat)));}
      this.range.setAttribute('aria-valuetext',`${this.scene.beats[beat].title}, ${Math.round(this.progress*100)} percent of illustration`);
      this.svg.setAttribute('aria-label',this.scene.beats[beat].text);
      this.play.textContent=this.progress===1?'Replay':this.playing?'Pause':'Play';
      this.play.setAttribute('aria-label',`${this.play.textContent} ${this.label.toLowerCase()}`);
      this.host.dataset.progress=this.progress.toFixed(4);
    }
    schedule(){
      cancelAnimationFrame(this.frame);this.frame=0;this.last=0;
      if(this.playing&&this.inView&&!document.hidden&&document.hasFocus()&&this.progress<1)this.frame=requestAnimationFrame(t=>this.tick(t));
    }
    tick(now){
      this.progress=Math.min(1,this.progress+(this.last?Math.min(100,now-this.last):0)/14000);this.last=now;
      if(this.progress===1)this.playing=false;
      this.draw();
      if(this.playing)this.frame=requestAnimationFrame(t=>this.tick(t));else this.frame=0;
    }
  }
  window.AtlasMotion=AtlasMotion;
  ['focus','blur','visibilitychange'].forEach(event=> (event==='visibilitychange'?document:window).addEventListener(event,()=>players.forEach(player=>player.schedule())));
})();
