'use strict';
/* A schematic lineage, not cell-count data, a risk model or a diagnostic threshold. */
(() => {
  const NS='http://www.w3.org/2000/svg';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const phase=(p,a,b)=>{const t=clamp((p-a)/(b-a));return t*t*(3-2*t);};
  const mix=(a,b,t)=>a+(b-a)*t;
  function node(parent,tag,attrs,text){
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value));
    if(text)el.textContent=text;
    parent.append(el);return el;
  }
  function sprite(parent,kind,role){return node(parent,'use',{href:'#cell-'+kind,width:100,height:100,'data-role':role});}
  function place(el,x,y,size,opacity=1){
    el.setAttribute('transform',`translate(${(x-size/2).toFixed(2)} ${(y-size/2).toFixed(2)}) scale(${(size/100).toFixed(3)})`);
    el.setAttribute('opacity',clamp(opacity).toFixed(3));
  }
  window.buildLeukemiaProgressionScene=(svg,key)=>{
    const progresses=key==='progresses';svg.replaceChildren();
    node(svg,'rect',{x:10,y:40,width:444,height:284,rx:42,fill:'#e9d9d7',stroke:'#c7b2b9'});
    node(svg,'rect',{x:484,y:40,width:146,height:284,rx:55,fill:'#efd3cd',stroke:'#c79a9e'});
    node(svg,'path',{d:'M500 64V301M614 64V301',stroke:'#c89ca0',fill:'none','stroke-width':1});
    node(svg,'text',{x:26,y:25,fill:'#735167','font-size':17,'letter-spacing':2},'BONE MARROW');
    node(svg,'text',{x:557,y:25,fill:'#735167','font-size':17,'letter-spacing':2,'text-anchor':'middle'},'BLOOD');
    const routes=[118,200,280].map(y=>node(svg,'path',{d:`M355 ${y}H507m-8-5 8 5-8 5`,stroke:'#997b86',fill:'none','stroke-width':1.5,'stroke-dasharray':'3 5'}));
    // Mature cells remain a separate lineage: blasts do not transform or consume them.
    const producers=[118,200,280].map(y=>({y,el:sprite(svg,'stem','healthy-precursor')}));
    const irregularPositions=[[65,112],[100,205],[66,278],[234,94],[245,276]];
    const irregular=irregularPositions.map(()=>sprite(svg,'irregular','mds-cell'));
    const failed=sprite(svg,'irregular','ineffective-development');
    const fragments=Array.from({length:6},()=>node(svg,'circle',{r:3,fill:'#987590'}));
    const signal=node(svg,'circle',{cx:172,cy:170,r:37,fill:'none',stroke:'#ad7d42','stroke-width':2,'stroke-dasharray':'3 5'});
    const levels=[
      [[172,170]],
      [[140,145],[211,194]],
      [[108,113],[180,130],[178,220],[252,218]],
      [[79,104],[140,94],[210,112],[272,97],[106,202],[175,211],[245,207],[298,253]],
      [[65,88],[126,94],[193,85],[256,97],[320,88],[391,105],[84,153],[150,155],[219,152],[288,157],[357,166],[71,235],[140,258],[212,244],[281,264],[355,253]]
    ];
    // Parents for each final daughter are explicit, so an expanding clone is visible.
    const finalParents=[0,0,1,2,3,3,0,1,2,3,7,4,4,5,6,7];
    const generations=levels.map(positions=>positions.map(()=>sprite(svg,'blast','abnormal-blast')));
    const outputs=Array.from({length:12},(_,i)=>({kind:['red','white','platelet'][i%3],lane:i%3,group:Math.floor(i/3),el:sprite(svg,['red','white','platelet'][i%3],'working-output')}));
    const state=node(svg,'text',{x:25,y:352,fill:'#6b405e','font-size':19},'MDS · impaired development');
    const supply=node(svg,'text',{x:25,y:377,fill:'#69595f','font-size':16},'Working blood supply: already limited');
    const beats=progresses?[
      {at:0,label:'MDS',title:'Blood production is already disrupted.',text:'Some developing cells fail to mature. Fewer working cells reach the blood.'},
      {at:.2,label:'A change',title:'One changed group gains an advantage.',text:'Further DNA changes can help descendants of an abnormal cell grow. These related cells are called a clone.'},
      {at:.43,label:'Expansion',title:'More blasts. Less working blood.',text:'The clone expands. Its abnormal immature cells, called blasts, interfere increasingly with healthy blood production.'},
      {at:.8,label:'Possible AML',title:'This path can lead to AML.',text:'Blasts accumulate and useful blood production falls further. Many people with MDS never follow this path; tests determine the diagnosis.'}
    ]:[
      {at:0,label:'MDS',title:'Blood production is already disrupted.',text:'MDS affects how blood cells develop, whether or not AML ever develops.'},
      {at:.2,label:'Continues',title:'MDS does not have to become AML.',text:'In this example, the abnormal blast group does not expand. Some working cells continue to enter the blood.'},
      {at:.43,label:'Ongoing effects',title:'MDS still needs care.',text:'Ineffective blood production continues. MDS can stay stable or worsen without turning into AML.'},
      {at:.8,label:'Remains MDS',title:'Many people never develop AML.',text:'This is one course, not a promise of stability. Monitoring and treatment address the MDS itself.'}
    ];
    return {beats,render(p){
      p=clamp(p);const expansion=progresses?phase(p,.27,.88):0;
      irregular.forEach((el,i)=>place(el,...irregularPositions[i],54,1-.72*expansion));
      const dying=phase(p,.04,.2);place(failed,271,180,53*(1-.7*dying),1-dying);
      fragments.forEach((el,i)=>{const a=i*2.4;el.setAttribute('cx',271+Math.cos(a)*28*dying);el.setAttribute('cy',180+Math.sin(a)*28*dying);el.setAttribute('opacity',(Math.sin(Math.PI*dying)*.65).toFixed(3));});
      signal.setAttribute('opacity',progresses?(phase(p,.17,.23)*(1-phase(p,.31,.38))).toFixed(3):'0');
      let visibleBlasts=0;
      generations.forEach((cells,level)=>cells.forEach((el,i)=>{
        const start=[0,.25,.4,.55,.7][level];
        const born=level===0?1:progresses?phase(p,start,start+.11):0;
        const gone=level===4||!progresses?0:phase(p,[.28,.43,.58,.73][level],[.36,.51,.66,.81][level]);
        const parent=level?levels[level-1][level===4?finalParents[i]:Math.floor(i/2)]:levels[0][0];
        const pos=levels[level][i],opacity=born*(1-gone);
        place(el,mix(parent[0],pos[0],born),mix(parent[1],pos[1],born),mix(48,58,born),opacity);
        if(opacity>.5)visibleBlasts++;
      }));
      producers.forEach(({el,y},i)=>place(el,350+(i===1?18:0),y,46,1-.78*expansion));
      routes.forEach(el=>el.setAttribute('opacity',(1-.8*expansion).toFixed(3)));
      // Four cohorts illustrate flow, not real counts. At least one cohort persists.
      // The stable-MDS example stays impaired; it does not return to healthy marrow.
      outputs.forEach(({el,kind,lane,group})=>{
        const travel=progresses&&group===0&&p>=.76
          ?mix((.76*3+lane*.13)%1,.82,phase(p,.76,1))
          :(p*3+group*.25+lane*.13)%1;
        const availability=group===0?1:1-phase(expansion,(group-1)*.22,.3+(group-1)*.22);
        const fade=phase(travel,0,.1)*(1-phase(travel,.87,1));
        place(el,mix(365,587,travel),[118,200,280][lane]+Math.sin(travel*Math.PI)*8,kind==='platelet'?22:43,fade*availability);
      });
      state.textContent=progresses?(p<.2?'MDS · impaired development':p<.43?'A changed clone grows':p<.8?'Abnormal blasts accumulate':'Possible AML · impaired production'):'MDS · continues without AML in this example';
      supply.textContent=expansion>.72?'Working blood supply: falls further':'Working blood supply: already limited';
      svg.dataset.blasts=String(visibleBlasts);svg.dataset.outputCohorts=(4-[0,.22,.44].reduce((sum,start)=>sum+phase(expansion,start,start+.3),0)).toFixed(3);
    }};
  };
})();
