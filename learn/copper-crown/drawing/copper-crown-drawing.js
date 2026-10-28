const { seg, lerp, eo, eio, clamp01 } = kit;
const DW_NS = 'http://www.w3.org/2000/svg';
const DW_CAM = [
  {t:0,cx:700,cy:400,z:3.8}, {t:2.3,cx:700,cy:397,z:3.55},
  {t:4.2,cx:925,cy:470,z:1.32}, {t:5.3,cx:925,cy:470,z:1.3},
  {t:7.2,cx:270,cy:470,z:1.85}, {t:7.8,cx:270,cy:470,z:1.8},
  {t:9.2,cx:950,cy:530,z:.985}, {t:13,cx:950,cy:530,z:.985}
];
kit.scene('drawing', {
  init(kit) {
    kit.css('.dw-svg .dt{font-size:15px;fill:var(--main);paint-order:stroke;stroke:var(--ground);stroke-width:4px;stroke-linejoin:round}' +
      '.dw-svg .dts{font-size:12px;fill:color-mix(in srgb,var(--second) 75%,var(--ground));letter-spacing:.06em;paint-order:stroke;stroke:var(--ground);stroke-width:3px}' +
      '.dw-svg .sl{font-size:9px;fill:color-mix(in srgb,var(--second) 75%,var(--ground));letter-spacing:.08em}' +
      '.dw-svg .nt{font-size:11.5px;fill:var(--main);letter-spacing:.06em}.dw-svg .nth{font-size:13px;font-weight:700;fill:var(--main);letter-spacing:.06em}' +
      '.dw-svg .vt{font-size:16px;fill:var(--main);letter-spacing:.1em}.dw-svg .nbt{font-size:12px;fill:var(--main)}' +
      '.dw-svg .th{font-size:10.5px;fill:var(--main);letter-spacing:.05em}.dw-svg .tc{font-size:10.5px;fill:var(--main);text-transform:none}');
    const root = kit.h('<div class="ground"><div class="dw-cam"></div></div>');
    kit.stage.append(root);
    const camEl = root.querySelector('.dw-cam');
    this.cam = camEl.style;
    const svg = document.createElementNS(DW_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1900 1060'); svg.setAttribute('width', '1900'); svg.setAttribute('height', '1060'); svg.setAttribute('class', 'dw-svg');
    camEl.appendChild(svg);
    const REG = this.reg = []; let sv = svg, CUR = { a: 0, s: 0, d: .6, i: 0 }, noreg = 0;
    const at = (a, s, d) => { CUR = { a: a, s: s || 0, d: d || .6, i: 0 }; };
    const kind = (e, t) => { if (t === 'text') return 'f'; const c = ' ' + (e.getAttribute('class') || '') + ' ';
      if (/ (slot|ph|cl|env|hs) /.test(c) || (e.getAttribute('fill') || '').indexOf('url') === 0) return 'f'; return 'd'; };
    function mk(t, a, p) { const e = document.createElementNS(DW_NS, t); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); (p || sv).appendChild(e);
      if (!noreg && t !== 'g') { const s = CUR.a + CUR.i * CUR.s; CUR.i++; const k = kind(e, t); if (k === 'd') e.setAttribute('pathLength', '1'); e.style.opacity = 0; REG.push({ e: e, a: s, b: s + CUR.d, k: k, last: -1 }); }
      return e; }
    function tx(x, y, s, c, a, p) { const t = mk('text', Object.assign({ x: x, y: y, class: c || 'dt' }, a || {}), p); t.textContent = s; return t; }
    noreg = 1; const d = mk('defs', {}); const m = mk('marker', { id: 'dwar', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, d);
    mk('path', { d: 'M0,1.7 L10,5 L0,8.3 z', class: 'arrow' }, m);
    const pt = mk('pattern', { id: 'dwhat', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d); mk('line', { x1: 0, y1: 0, x2: 0, y2: 5, class: 'hl' }, pt); noreg = 0;
    const A = 'url(#dwar)', HAT = 'url(#dwhat)';
    function dimH(x1, x2, y, e1, e2, l, o) { o = o || {}; [[x1, e1], [x2, e2]].forEach(([x, e]) => { if (e == null) return; const s = Math.sign(y - e) || 1; mk('line', { x1: x, y1: e + s * 3, x2: x, y2: y + s * 5, class: 'ext' }); });
      if (x2 - x1 >= 28) mk('line', { x1: x1, y1: y, x2: x2, y2: y, class: 'dl', 'marker-start': A, 'marker-end': A }); else { mk('line', { x1: x1 - 13, y1: y, x2: x1, y2: y, class: 'dl', 'marker-end': A }); mk('line', { x1: x2 + 13, y1: y, x2: x2, y2: y, class: 'dl', 'marker-end': A }); }
      tx((x1 + x2) / 2 + (o.dx || 0), (o.below ? y + 13 : y - 4) + (o.dy || 0), l, o.c || 'dt', { 'text-anchor': 'middle' }); }
    function dimV(y1, y2, x, e1, e2, l, o) { o = o || {}; [[y1, e1], [y2, e2]].forEach(([y, e]) => { if (e == null) return; const s = Math.sign(x - e) || 1; mk('line', { x1: e + s * 3, y1: y, x2: x + s * 5, y2: y, class: 'ext' }); });
      if (y2 - y1 >= 28) mk('line', { x1: x, y1: y1, x2: x, y2: y2, class: 'dl', 'marker-start': A, 'marker-end': A }); else { mk('line', { x1: x, y1: y1 - 13, x2: x, y2: y1, class: 'dl', 'marker-end': A }); mk('line', { x1: x, y1: y2 + 13, x2: x, y2: y2, class: 'dl', 'marker-end': A }); }
      const c = (y1 + y2) / 2; if (o.side) { const r = o.side === 'r'; tx(r ? x + 6 : x - 6, c + 4, l, o.c || 'dt', { 'text-anchor': r ? 'start' : 'end' }); } else tx(x - 5, c, l, o.c || 'dt', { 'text-anchor': 'middle', transform: 'rotate(-90 ' + (x - 5) + ' ' + c + ')' }); }
    function callout(px, py, ex, ey, l, dir, c) { const s = dir || (ex >= px ? 1 : -1); mk('circle', { cx: px, cy: py, r: 1.8, class: 'dot' }); mk('polyline', { points: px + ',' + py + ' ' + ex + ',' + ey + ' ' + (ex + s * 10) + ',' + ey, class: 'lead' }); tx(ex + s * 14, ey + 4, l, c || 'dt', { 'text-anchor': s > 0 ? 'start' : 'end' }); }
    function rad(cx, cy, r, c, l, L) { const sx = c.indexOf('l') > -1 ? -1 : 1, sy = c.indexOf('t') > -1 ? -1 : 1; const ox = cx - sx * r, oy = cy - sy * r; callout(ox + sx * r * Math.SQRT1_2, oy + sy * r * Math.SQRT1_2, ox + sx * r * Math.SQRT1_2 + sx * L, oy + sy * r * Math.SQRT1_2 + sy * L, l, sx); }
    function nb(x, y, n) { mk('rect', { x: x - 6, y: y - 6, width: 12, height: 12, class: 'nb' }); tx(x, y + 3.5, String(n), 'nbt', { 'text-anchor': 'middle' }); }
    function rr(x, y, w, h, r, c, p) { return mk('rect', { x: x, y: y, width: w, height: h, rx: r, class: c }, p); }
    function slotLabel(x, y, w, h, l, al, p) { tx(al === 'l' ? x + 6 : x + w / 2, y + h / 2 + 3.2, l, 'sl', { 'text-anchor': al === 'l' ? 'start' : 'middle' }, p); }
    function title(x, y, t, s) { tx(x, y, t, 'vt', { 'text-anchor': 'middle' }); if (s) tx(x, y + 14, s, 'dts', { 'text-anchor': 'middle' }); }
    function xbox(x, y, w, h, p) { mk('rect', { x: x, y: y, width: w, height: h, class: 'thin' }, p); mk('path', { d: 'M' + x + ',' + y + ' l' + w + ',' + h + ' M' + (x + w) + ',' + y + ' l' + (-w) + ',' + h, class: 'thin' }, p); }
    function detailRef(cx, cy, r, lbl, lx, ly) { mk('circle', { cx: cx, cy: cy, r: r, class: 'ph' }); const a = Math.atan2(ly - cy, lx - cx); mk('line', { x1: cx + r * Math.cos(a), y1: cy + r * Math.sin(a), x2: lx, y2: ly, class: 'lead' }); tx(lx + (lx < cx ? -4 : 4), ly + 4, lbl, 'dts', { 'text-anchor': lx < cx ? 'end' : 'start' }); }
    function table(x, y, ttl, rows) { const ws = [40, 88, 96], rh = 17; tx(x, y - 8, ttl, 'vt'); [['Code', 'Variable', 'Value']].concat(rows).forEach((r, i) => { let c2 = x; r.forEach((c, j) => { mk('rect', { x: c2, y: y + i * rh, width: ws[j], height: rh, class: 'thin' }); tx(c2 + (j ? ws[j] / 2 : 6), y + i * rh + 12, c, i ? 'tc' : 'th', { 'text-anchor': j ? 'middle' : 'start' }); c2 += ws[j]; }); }); return y + (rows.length + 1) * rh + 36; }
    function notes(list) { tx(50, 58, 'Notes:', 'nth'); tx(112, 58, '(unless otherwise specified)', 'nt'); list.forEach(([n, t], i) => { const y = 88 + i * 24; nb(56, y - 4, n); tx(72, y, t, 'nt'); }); }
    // COPPER CROWN GEOMETRY. All physical dimensions are illustrative; the
    // sectional view shows only values documented by the learning page.
    const line = (x1,y1,x2,y2,c,p) => mk('line',{x1,y1,x2,y2,class:c||'thin'},p);
    const pth = (d,c,p) => mk('path',{d,class:c||'thin'},p);
    const circ = (cx,cy,r,c,p) => mk('circle',{cx,cy,r,class:c||'thin'},p);
    const txt = (x,y,t,c,a,p) => tx(x,y,t,c||'dt',a||{},p);
    const flat = () => mk('g',{});
    const bore = (p) => {
      rr(589,430,222,230,6,'copper',p);
      rr(597,436,206,218,4,'obj',p);
      rr(590,432,220,222,4,'copperShell',p);
      [450,463,625,639].forEach(y=>line(591,y,809,y,'brass',p));
      line(595,437,805,437,'rim',p);
      [467,618].forEach(y=>{for(let x=607;x<=793;x+=24)circ(x,y,2.1,'rivet',p);});
    };
    const heater = (p) => {
      rr(580,660,240,50,10,'blackmetal',p);
      line(588,672,812,672,'brass',p); line(588,698,812,698,'brass',p);
      rr(665,677,46,14,2,'thin',p); circ(672,684,2.2,'dot',p);
    };
    const lid = (p) => {
      pth('M589 434 C610 415 646 402 700 400 C754 402 790 415 811 434 Z','lid',p);
      line(592,431,808,431,'rim',p);
      for(let x=608;x<=792;x+=23)circ(x,427,2,'rivet',p);
    };
    const head = (p) => {
      pth('M700 400 V366 M700 314 V290 Q700 282 710 282 H1050 Q1057 282 1057 290 V419','pipe',p);
      circ(700,340,25,'obj',p); line(678,340,722,340,'brass',p);
      pth('M642 415 V253 Q642 246 635 246 H622','pipe',p);
      [787,884,982].forEach(x=>line(x,278,x,286,'brass',p));
    };
    const tank = (p) => {
      pth('M969 409 V658 Q969 668 980 668 H1135 Q1145 668 1145 658 V409','waterShell',p);
      line(969,409,1145,409,'rim',p); line(972,421,1142,421,'thin',p);
      [429,532,655].forEach(y=>line(969,y,1145,y,'brass',p));
      for(let x=980;x<=1135;x+=26){circ(x,429,1.8,'rivet',p);circ(x,655,1.8,'rivet',p);}
      line(979,447,1135,447,'waterline',p);
    };
    const coilPath = (() => {
      let d=''; const n=180;
      for(let i=0;i<=n;i++){
        const u=i/n, x=1057+61*Math.sin(10*Math.PI*u), y=420+186*u;
        d+=(i?' L':'M')+x.toFixed(2)+' '+y.toFixed(2);
      }
      return d;
    })();
    const coil = (p) => {
      pth(coilPath,'coil',p);
      pth('M1057 606 H1229 Q1241 606 1241 618 V624','pipe',p);
    };
    const receiver = (p) => {
      pth('M1226 651 V664 Q1207 672 1207 685 V704 H1275 V685 Q1275 672 1256 664 V651','glassjar',p);
      line(1226,651,1256,651,'rim',p); line(1210,692,1272,692,'waterline',p);
    };
    const pad = (p) => { rr(544,710,780,20,6,'blackmetal',p);line(551,716,1317,716,'brass',p); };

    // Front elevation: begin at the still's crown, then grow the entire device.
    at(.05,.06,.75); lid();
    at(.4,.07,.65); head();
    at(2.25,.025,.72); bore();
    at(2.8,.03,.7); heater(); pad();
    at(3.2,.035,.72); tank();
    at(3.5,.08,.8); coil(); receiver();
    at(4.05,.12,.6);
    line(700,382,700,713,'cl'); line(1057,395,1057,682,'cl');
    tx(930,746,'FRONT ELEVATION','vt',{'text-anchor':'middle'});
    tx(930,766,'SCHEMATIC · NOT TO SCALE','dts',{'text-anchor':'middle'});
    at(4.3,.12,.5);
    dimH(996,1118,385,420,420,'D2');
    callout(642,254,574,240,'OPEN VENT',-1,'dt');
    callout(700,341,751,325,'SPLASH HEAD',1,'dt');
    callout(1106,490,1160,472,'N1 / 5 TURNS',1,'dt');
    callout(1241,634,1285,615,'AIR GAP',1,'dt');

    // Actual template morph groups: copies lift from the flat elevation into
    // a reduced, separated assembly. Geometry is the same as the main view.
    noreg=1; const MG=this.morph=[];
    const mg=(z,a0)=>{ const g=mk('g',{});g.style.opacity=0;MG.push({g,z,a:a0});return g; };
    bore(mg(0,5.35));
    heater(mg(-25,5.45));
    lid(mg(64,5.55));
    head(mg(120,5.65));
    tank(mg(0,5.55));
    coil(mg(75,5.75));
    receiver(mg(-15,5.85));
    noreg=0;
    this.flat=[1,0,0,1,0,0];
    this.iso=[.48,0,0,.48,-180,280];
    at(6.7,.07,.45);
    line(156,407,156,617,'ph');line(328,392,328,620,'ph');
    callout(150,290,170,240,'CROWN / VENT',-1,'dts');
    callout(157,530,109,520,'KETTLE',-1,'dts');
    callout(153,625,109,642,'HEATER',-1,'dts');
    callout(328,451,373,426,'COIL',1,'dts');
    callout(327,580,372,591,'BATH',1,'dts');
    tx(94,711,'EXPLODED ASSEMBLY','vt');
    tx(94,731,'PARTS SEPARATED FOR CLARITY','dts');

    // Sheet frame and typography come in on the final pullback.
    at(7.65,0,1.1); rr(28,28,1844,1004,8,'border');
    at(7.9,.05,.5);
    line(54,145,1846,145,'rule'); line(54,777,1405,777,'rule');
    line(1420,165,1420,986,'rule'); line(54,989,1846,989,'rule');
    at(8.0,.07,.5);
    tx(68,66,'THE COPPER CROWN','eyebrow');
    tx(68,118,'Water, made visible.','mast');
    tx(777,73,'ATMOSPHERIC WATER DISTILLATION','header');
    tx(777,103,'A study in heat, vapor & separation','subhead');
    tx(1535,70,'WORKSHOP / 01','header');
    tx(1535,104,'SCHEMATIC · NOT TO SCALE','header');
    tx(68,1013,'THE GROVE   /   COPPER CROWN','footer');
    tx(1833,1013,'CONCEPT PLATE     01 / 01','footer',{'text-anchor':'end'});

    // Physical-product support views: plan, section, right, and tube detail.
    at(8.45,.035,.6);
    // Plan of kettle, with section line.
    circ(605,863,75,'obj');circ(605,863,70,'thin');circ(605,863,63,'fine');
    line(520,863,690,863,'cl');line(605,779,605,947,'cl');
    line(522,842,689,842,'cut');
    tx(520,836,'A','dt');tx(685,836,'A','dt');
    tx(548,962,'TOP · KETTLE','vt');

    // Section A–A. Inner width 180 / height 160; wall 1 is symbolic at this scale.
    pth('M796 805 V945 H960 V805 M800 805 V941 H956 V805','obj');
    const wallL=mk('rect',{x:796,y:805,width:4,height:140,class:'hs',fill:HAT});
    const wallR=mk('rect',{x:956,y:805,width:4,height:140,class:'hs',fill:HAT});
    const bottom=mk('rect',{x:800,y:941,width:156,height:4,class:'hs',fill:HAT});
    line(800,902,956,902,'waterline');
    dimH(800,956,791,805,805,'D1');
    dimV(805,941,778,796,796,'H1');
    callout(958,869,989,861,'T1',1,'dt');
    tx(812,962,'SECTION A–A','vt');

    // Right elevation of open bath and illustrative coil.
    pth('M1066 805 V939 H1180 V805','obj');
    line(1066,805,1180,805,'rim');
    let sd='';for(let i=0;i<=100;i++){let u=i/100;sd+=(i?' L':'M')+(1123+40*Math.sin(u*Math.PI*10)).toFixed(1)+' '+(813+116*u).toFixed(1);}pth(sd,'coil');
    tx(1066,962,'RIGHT · BATH','vt');

    // Tube detail, drawn in the 12:10 OD:ID proportion.
    circ(1288,867,58,'obj');circ(1288,867,48.33,'fine');
    line(1220,867,1356,867,'cl');line(1288,798,1288,936,'cl');
    dimH(1230,1346,786,809,809,'OD');
    dimH(1239.67,1336.33,945,915,915,'ID',{below:true});
    tx(1222,975,'TUBE SECTION','vt');

    // Source-backed values table; other dimensions remain TBD.
    at(8.65,.025,.5);
    tx(1460,197,'DIMENSION KEY','header');
    line(1460,215,1828,215,'rule');
    const rows=[
      ['D1','KETTLE INSIDE DIA.','~180 mm'],
      ['H1','KETTLE INNER HEIGHT','~160 mm'],
      ['T1','KETTLE WALL','~1 mm'],
      ['D2','COIL DIAMETER','~140 mm'],
      ['OD','COIL TUBE OUTSIDE','~12 mm'],
      ['ID','COIL TUBE INSIDE','~10 mm'],
      ['L1','COILED LENGTH','~2.2 m'],
      ['N1','DESCENDING TURNS','5'],
      ['W1','OVERALL WIDTH','TBD'],
      ['H2','OVERALL HEIGHT','TBD'],
    ];
    rows.forEach((r,i)=>{let y=245+i*35;tx(1460,y,r[0],'keycode');tx(1510,y,r[1],'keyname');tx(1825,y,r[2],'keyvalue',{'text-anchor':'end'});line(1460,y+11,1828,y+11,'tablerule');});
    tx(1460,650,'THE MATERIAL PALETTE','header');
    line(1460,666,1828,666,'rule');
    tx(1460,696,'316L STAINLESS  /  WETTED PATH','small');
    tx(1460,728,'BOROSILICATE  /  RECEIVER + BATH','small');
    tx(1460,760,'COPPER + BRASS  /  OUTER JACKET','small');
    tx(1460,818,'2 L EXAMPLE CHARGE','small');
    tx(1460,848,'300 W HEATER EXAMPLE','small');
    tx(1460,906,'OPEN TO ATMOSPHERE','small');
    tx(1460,936,'SEPARATE COOLING WATER','small');
  },
  render(t) {
    t = t / 0.85;
    let i = 0; while (i < DW_CAM.length - 2 && t > DW_CAM[i + 1].t) i++;
    const c0 = DW_CAM[i], c1 = DW_CAM[i + 1], p = eio(seg(t, c0.t, c1.t));
    const z = Math.exp(lerp(Math.log(c0.z), Math.log(c1.z), p)), cx = lerp(c0.cx, c1.cx, p), cy = lerp(c0.cy, c1.cy, p);
    this.cam.transform = 'translate(' + (960 - cx * z) + 'px,' + (540 - cy * z) + 'px) scale(' + z + ')';
    for (const it of this.reg) {
      let v = clamp01((t - it.a) / (it.b - it.a)); v = Math.round(v * 400) / 400;
      if (v === it.last) continue; it.last = v; const s = it.e.style;
      if (it.k === 'f') { s.opacity = eo(v); continue; }
      const e = eio(v); s.opacity = Math.min(1, v * 6);
      if (v >= 1) { s.strokeDasharray = ''; s.strokeDashoffset = ''; } else { s.strokeDasharray = '1 2'; s.strokeDashoffset = 1 - e; }
      s.fillOpacity = eo(seg(v, .55, 1));
    }
    const F = this.flat, I = this.iso;
    this.morph.forEach((m, j) => {
      const v = eio(seg(t, m.a, m.a + 1.5)), M = F.map((f, n) => lerp(f, I[n], v));
      M[5] -= m.z * v;
      m.g.style.opacity = eo(seg(t, m.a + 0.05, m.a + 0.5));
      const fo = eo(seg(t, m.a + 0.55, m.a + 1.25)); if (fo !== m.fo) { m.fo = fo; m.fills = m.fills || m.g.querySelectorAll('.obj,.well,.hug,.copper,.copperShell,.lid,.blackmetal,.waterShell,.glassjar'); m.fills.forEach(e => { e.style.fillOpacity = fo; }); }
      m.g.setAttribute('transform', 'matrix(' + M.join(',') + ')');
      m.g.style.setProperty('--u', 1 / Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])));
    });
  },
});
