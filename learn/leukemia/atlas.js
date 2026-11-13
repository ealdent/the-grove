'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const cell = (kind, x, y, size, angle=0) => `<use href="#cell-${kind}" x="${x}" y="${y}" width="${size}" height="${size}" transform="rotate(${angle} ${x+size/2} ${y+size/2})"/>`;
const picture = (content, label='') => `<svg viewBox="0 0 150 120" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${content}</svg>`;
function select(group, key, render) {
  $$(group).forEach(button => button.addEventListener('click', () => {
    $$(group).forEach(peer => peer.setAttribute('aria-pressed', String(peer === button)));
    render(button.dataset[key]);
  }));
}
const cellNotes = {
  red: ['O₂', '<strong>Less oxygen delivered → fatigue or breathlessness.</strong> Low red cells or hemoglobin is called anemia. Hemoglobin is the oxygen-carrying protein inside red cells.'],
  white: ['✧', '<strong>Fewer working defenders → more infection risk.</strong> Neutrophils are one important type of white cell. A high total white-cell count can include leukemia cells that do not protect you.'],
  platelet: ['⌁', '<strong>Fewer clot-making fragments → bruising or bleeding.</strong> Platelets gather at damaged blood vessels to help seal a leak. They are much smaller than red or white cells.']
};
function showCell(key){const [icon, copy] = cellNotes[key];$('#cell-note').innerHTML=`<span class="job-icon" aria-hidden="true">${icon}</span><p>${copy}</p>`;}
select('[data-cell]','cell',showCell);showCell('red');

const conditions = {
 healthy:{label:'HEALTHY MARROW',title:'Mature.<br>Leave.<br>Get to work.',copy:'Developing cells mature into useful blood. A small proportion are very early cells, called blasts.',output:'EFFECTIVE BLOOD PRODUCTION',bars:5,key:'stem',keyText:'An immature starting cell',desc:'Healthy marrow: a mixture of developing and mature blood cells, with a small proportion of blasts.'},
 mds:{label:'MYELODYSPLASTIC SYNDROMES / NEOPLASMS',title:'Busy marrow.<br>Too little<br>working blood.',copy:'Cells develop abnormally. Many die before they become useful. One or more blood-cell types can run low.',output:'INEFFECTIVE BLOOD PRODUCTION',bars:2,key:'irregular',keyText:'A cell developing abnormally',desc:'MDS marrow: abnormal developing cells and ineffective maturation. Many cells die before entering the blood; one or more blood counts fall.'},
 aml:{label:'ACUTE MYELOID LEUKEMIA',title:'Immature cells<br>gain ground.',copy:'Abnormal blasts multiply and fail to mature. They disrupt the marrow’s ability to supply healthy blood.',output:'HEALTHY PRODUCTION DISRUPTED',bars:1,key:'blast',keyText:'An abnormal immature cell: a blast',desc:'AML marrow: many abnormal immature blasts with large nuclei interfere with production of functioning blood cells.'}
};
function showCondition(key){
 const data=conditions[key];
 const positions=[];
 for(let i=0;i<43;i++){
   const angle=i*2.3999632297, radius=Math.sqrt(i/42)*192;
   positions.push([240+Math.cos(angle)*radius,220+Math.sin(angle)*radius,i]);
 }
 $('#marrow-cells').innerHTML=`<g opacity=".3" fill="none" stroke="#ac827c" stroke-width="3"><path d="M70 170Q170 110 270 180T475 160M65 300Q170 250 300 315T470 300M170 40Q230 210 160 445M370 45Q320 240 400 440"/></g>`+positions.map(([x,y,i])=>{
   let kind,size;
   if(key==='healthy'){kind=i===0?'stem':['red','white','red','white','platelet','red','white'][(i*13)%7];size=kind==='platelet'?22:48;}
   if(key==='mds'){kind=['irregular','red','irregular','blast','platelet','irregular','stem'][i%7];size=kind==='platelet'?21:53;}
   if(key==='aml'){kind=i%6===0?'red':i%11===0?'white':'blast';size=kind==='blast'?61:44;}
   return cell(kind,x,y,size,(i*37)%65-32);
 }).join('');
 $('#marrow-title').textContent=data.label;
 $('#marrow-desc').textContent=data.desc;
 $('#condition-note').innerHTML=`<p class="plate-label">${data.label}</p><h3>${data.title}</h3><p>${data.copy}</p><div class="output-wrap"><div class="output-indicator" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i class="${i>=data.bars?'dim':''}"></i>`).join('')}</div><p class="output-label">${data.output}</p></div><div class="cell-key">${picture(cell(data.key,20,8,100))}<span>${data.keyText}</span></div>`;
}
select('[data-condition]','condition',showCondition);showCondition('healthy');

const evolutionNotes=[
 ['MDS: development is disrupted','The marrow makes blood inefficiently. Blast numbers may be low or raised.'],
 ['A clone can expand','A clone is a group descended from one changed cell. Further changes may give immature cells a growth advantage.'],
 ['AML: immature cells dominate the problem','Abnormal blasts build up and impair healthy blood production. AML can also begin without a previous MDS diagnosis.']
];
function showEvolution(value){
 const index=Number(value), data=evolutionNotes[index];
 $('#evolution-view').innerHTML=Array.from({length:8},(_,i)=>cell(index===0?(i%3===0?'red':'irregular'):index===1?(i<4?'irregular':'blast'):(i===0?'red':'blast'),i*70+8,20+(i%2)*14,72)).join('');
 $('#evolution-view').setAttribute('aria-label',data[0]+'. '+data[1]);
 $('#evolution-note').innerHTML=`<h3>${data[0]}</h3><p>${data[1]}</p>`;
}
select('[data-evolution]','evolution',showEvolution);showEvolution(0);

const types={
 aml:['ACUTE + MYELOID','AML','An acute cancer of the myeloid cell family. It usually needs prompt assessment and treatment. Genetics divide AML into subtypes with different treatments and outlooks.'],
 all:['ACUTE + LYMPHOID','ALL','An acute cancer of immature lymphoid cells, a branch that normally makes immune cells. It can occur in adults, too. Its treatment is different from AML.'],
 cml:['CHRONIC + MYELOID','CML','Usually driven by a gene change called BCR::ABL1. Medicines that block its growth signal can control the disease for many people. Its usual treatment is different from AML.'],
 cll:['CHRONIC + LYMPHOID','CLL','A cancer involving more mature lymphocytes. Some people are monitored without treatment at first; others need treatment. “Chronic” does not mean harmless.']
};
function showType(key){const data=types[key];$('#type-note').innerHTML=`<p class="plate-label">${data[0]}</p><h3>${data[1]}</h3><p>${data[2]}</p>`;}
select('[data-type]','type',showType);showType('aml');

const shield=`<path d="M75 8L123 27V63Q118 93 75 112Q32 93 27 63V27Z" fill="none" stroke="#ad8853" stroke-width="2" stroke-dasharray="5 4"/>`;
const blocker=`<path d="M99 22L130 53M130 22L99 53" stroke="#ae5864" stroke-width="5" stroke-linecap="round"/>`;
const dna=`<g stroke-width="2.5" fill="none"><path d="M47 16C116 40 36 73 105 104M105 16C36 40 116 73 47 104" stroke="#895b80"/><path d="M56 23H96M65 39H87M64 55H88M58 72H95M56 94H97" stroke="#b18c58"/></g>`;
const protein=`<path d="M20 89H130M20 96H130" stroke="#aa929e" stroke-width="2"/><path d="M75 88V50L48 28M75 50L101 28" stroke="#8e6284" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M45 19L75 44L104 19" fill="none" stroke="#ae5864" stroke-width="5"/><circle cx="75" cy="70" r="4" fill="#f5e8db"/>`;
const medicine=`<g transform="rotate(32 75 60)"><rect x="48" y="16" width="54" height="90" rx="27" fill="#e7c6c1" stroke="#8f5660" stroke-width="2"/><path d="M48 61H102V79A27 27 0 0 1 48 79Z" fill="#9d6171"/><path d="M58 43Q58 28 72 28" fill="none" stroke="#f9f1df" stroke-width="3"/></g>`;
const newBlood=cell('red',5,4,64)+cell('white',73,15,68)+cell('platelet',52,76,30);
const bag=`<path d="M55 11H94M63 6H86V19H63ZM46 25H103L111 85Q109 94 100 94H50Q41 94 40 85Z" stroke="#886879" fill="#f0e4db" stroke-width="2"/><path d="M45 55Q77 48 106 55L107 84Q107 89 99 89H51Q45 89 45 84Z" fill="#b8616d"/><path d="M75 95V112H113" fill="none" stroke="#886879" stroke-width="2"/><path d="M66 42H84M75 33V51" stroke="#b8616d" stroke-width="3"/>`;
const treatments={
 combination:{category:'AML · AN ALTERNATIVE TO INTENSIVE CHEMO',tag:'Includes chemotherapy',title:'Work on two vulnerabilities.',images:[dna,cell('blast',28,12,96)+shield+blocker,cell('blast',25,22,48)+`<g fill="#9a7194"><circle cx="88" cy="63" r="9"/><circle cx="107" cy="43" r="5"/><circle cx="106" cy="88" r="4"/></g>`],captions:['Change how instructions are used','Remove a survival shield','Aim to reduce abnormal cells'],copy:'Azacitidine or decitabine changes how cells use genetic instructions. Venetoclax blocks BCL-2, a protein that helps leukemia cells survive. These are often paired for AML when intensive chemotherapy is unsuitable.',expect:'The first drug is chemotherapy; venetoclax is targeted therapy. Low counts, infection risk, transfusions and frequent monitoring can still be substantial.',source:'5'},
 targeted:{category:'AML · WHEN THE BIOLOGY MATCHES',tag:'May be used with or without chemo',title:'Find a specific weak point.',images:[cell('blast',25,12,96),protein,cell('white',27,12,96)],captions:['Test the leukemia’s genes','Match a target to a medicine','One possible effect: cells mature'],copy:'Some drugs block a changed growth signal, such as FLT3. Others, such as IDH inhibitors, can help cells mature. The right drug depends on the gene change and whether the disease is newly diagnosed or has returned.',expect:'Not everyone has a treatable target. Pills can still cause serious side effects. Some maturation-promoting drugs can cause differentiation syndrome: fever, swelling or breathing trouble that needs urgent care.',source:'6'},
 mds:{category:'SELECTED MDS · OFTEN LOWER-RISK DISEASE',tag:'Some options are not chemotherapy',title:'Help more useful cells emerge.',images:[cell('irregular',25,12,96),`<path d="M35 84Q75 12 115 84" stroke="#4e7b75" stroke-width="3" fill="none"/><path d="M62 39L76 22L90 39" stroke="#4e7b75" stroke-width="3" fill="none"/>`+cell('stem',48,46,55),cell('red',1,8,75)+cell('red',68,43,75)],captions:['Too few working red cells','Support production or maturation','Aim for less anemia / fewer transfusions'],copy:'For some MDS, medicines such as erythropoiesis-stimulating agents (ESAs) or luspatercept help red-cell production. Lenalidomide can help selected patients, often those with a chromosome change called del(5q).',expect:'These are not interchangeable and are not standard substitutes for AML treatment. Higher-risk MDS may need disease-directed drugs such as azacitidine or decitabine, or a donor transplant.',source:'7'},
 intensive:{category:'AML · INTENSIVE CHEMOTHERAPY',tag:'Chemotherapy',title:'Reduce the leukemia burden.',images:[cell('blast',3,3,78)+cell('blast',65,36,78),medicine,newBlood],captions:['Many leukemia cells','Damage dividing cells','Aim for remission and blood recovery'],copy:'Intensive chemotherapy kills leukemia cells but also affects healthy growing cells. An initial phase aims for remission; further treatment aims to keep the disease from returning.',expect:'Often involves a hospital stay of several weeks, very low blood counts and infection risk. The exact plan depends on the AML subtype, health and treatment goals.',source:'1'},
 transplant:{category:'SELECTED MDS OR AML · DONOR TRANSPLANT',tag:'Requires conditioning treatment',title:'Build a new blood-making system.',images:[medicine,cell('stem',25,12,96),newBlood],captions:['Prepare with conditioning','Infuse donor stem cells','New blood + donor immune defense'],copy:'Donor stem cells settle in the marrow and build new blood cells. Donor immune cells can also attack remaining leukemia. This can offer a chance of cure for selected people.',expect:'Conditioning usually includes chemotherapy, sometimes radiation. Recovery is lengthy. Serious infection and graft-versus-host disease—donor cells attacking healthy tissue—are important risks. Fitness and goals matter alongside age.',source:'8'},
 support:{category:'MDS & AML · AT EVERY STAGE',tag:'Can accompany cancer treatment',title:'Care for the person, throughout.',images:[bag,`<path d="M75 10L120 27V63Q111 92 75 108Q39 92 30 63V27Z" fill="#d4dfd5" stroke="#537c73" stroke-width="2"/><path d="M55 57L70 72L99 42" fill="none" stroke="#537c73" stroke-width="4"/>`,`<path d="M75 101C-1 55 32 8 61 28L75 41L89 28C118 8 151 55 75 101Z" fill="#dfb4b5" stroke="#a26470" stroke-width="2"/>`],captions:['Transfusions when needed','Prevent or treat infections','Relieve symptoms and stress'],copy:'Supportive care helps manage the effects of low blood counts. Palliative care adds help with symptoms, decisions and quality of life; it can start alongside leukemia treatment.',expect:'Transfusions and symptom relief do not themselves eliminate leukemia. Some people choose care focused on comfort when the burdens of disease treatment outweigh its likely benefit.',source:'11'}
};
function showTreatment(key){
 const data=treatments[key];
 $('#treatment-category').textContent=data.category;$('#chemo-label').textContent=data.tag;$('#treatment-title').textContent=data.title;
 $('#treatment-visual').innerHTML=`<div class="mechanism">${data.images.map((img,i)=>`${i?`<span class="mechanism-arrow" aria-hidden="true">${key==='combination'&&i===1?'+':'→'}</span>`:''}<figure>${picture(img)}<figcaption>${data.captions[i]}</figcaption></figure>`).join('')}</div>`;
 $('#treatment-copy').innerHTML=`<p class="treatment-description">${data.copy} <a class="ref" href="#source-${data.source}" aria-label="Source ${data.source}">[${data.source}]</a>${key==='combination'?' <a class="ref" href="#source-6" aria-label="Source 6">[6]</a>':''}</p><p class="expect-line"><strong>What to expect</strong> · ${data.expect}</p>`;
}
select('[data-treatment]','treatment',showTreatment);showTreatment('combination');

const care={
 tests:['The tests answer different questions.','Blood counts show which cells are low. A marrow sample, usually from the back of the hip with local numbing, shows how cells develop. Chromosome and gene tests help identify the disease and possible drug targets. Some results take longer than others.'],
 plan:['Choose the goal together.','Discuss likely benefit, side effects, time in hospital and daily independence. AML usually needs prompt planning; some lower-risk MDS can be monitored. Ask how urgently a decision is needed and whether a specialist opinion or trial would help.'],
 treat:['Care is more than the treatment day.','Expect blood tests, possible transfusions, infection precautions and medication reviews. Treatment often comes in repeated cycles. Counts may fall before recovery. Even treatment given at home can mean frequent visits or unexpected admissions.'],
 review:['A response is a milestone, not the finish line.','Repeat blood and marrow tests show whether treatment is helping. Remission means the disease has fallen below defined thresholds; it does not always mean cure. Sensitive tests may still find residual cells. Plans may continue, change, or shift toward comfort according to response and goals.']
};
function showCare(key){const data=care[key];$('#care-note').innerHTML=`<h3>${data[0]}</h3><p>${data[1]} <a class="ref" href="#source-1" aria-label="Source 1">[1]</a> <a class="ref" href="#source-5" aria-label="Source 5">[5]</a></p>`;}
select('[data-care]','care',showCare);showCare('tests');
$('#print-questions').addEventListener('click',()=>window.print());
// Open the source list before following a citation, including dynamically rendered citations.
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href^="#source-"]');
 if(link){$('.source-list').open=true;}
});
if(location.hash.startsWith('#source-')){$('.source-list').open=true;requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());}
const navLinks=$$('.chapter-nav a');
const chapterObserver=new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){navLinks.forEach(link=>{
 const active=link.hash==='#'+entry.target.id;
 link.classList.toggle('active',active);
 if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
 });}
},{rootMargin:'-15% 0px -60% 0px',threshold:0});
$$('.chapter').forEach(section=>chapterObserver.observe(section));
