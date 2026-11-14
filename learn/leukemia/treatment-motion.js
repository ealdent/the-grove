/* Deterministic, seekable teaching scenes. Cell numbers, durations and responses are
 * schematic, not clinical predictions. The caller owns playback and captions. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const C = { ink: '#63545f', plum: '#865c89', rose: '#ad6270', teal: '#48766e', gold: '#b18a4e' };
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const phase = (p, start, end) => ease((p - start) / (end - start));
  const lerp = (a, b, t) => a + (b - a) * t;

  function element(parent, name, attrs = {}, text) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }
  function opacity(node, n) { node.setAttribute('opacity', clamp(n).toFixed(3)); }
  function move(node, x, y, scale = 1) {
    node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
  }
  function label(parent, x, y, text, extra = {}) {
    return element(parent, 'text', { x, y, fill: C.ink, 'font-size': 20,
      'font-family': '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', ...extra }, text);
  }
  function sprite(parent, kind, x, y, size = 65) {
    const node = element(parent, 'use', { href: `#cell-${kind}`, x: -size / 2, y: -size / 2, width: size, height: size });
    move(node, x, y);
    return node;
  }
  function arrow(parent, x1, y1, x2, y2, color = '#a39494') {
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    return element(parent, 'path', { d: `M${x1} ${y1}L${x2} ${y2}M${x2 - ux * 9 - uy * 5} ${y2 - uy * 9 + ux * 5}L${x2} ${y2}L${x2 - ux * 9 + uy * 5} ${y2 - uy * 9 - ux * 5}`,
      fill: 'none', stroke: color, 'stroke-width': 1.8 });
  }
  function scaffold(svg, description) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 600 310');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', description);
    element(svg, 'rect', { x: 8, y: 44, width: 382, height: 254, rx: 34, fill: '#ede2dd', stroke: '#cdbbb9' });
    element(svg, 'path', { d: 'M30 125Q130 72 220 130T370 112M30 232Q130 185 240 239T370 221', fill: 'none', stroke: '#d8c5c0', 'stroke-width': 2 });
    element(svg, 'rect', { x: 428, y: 44, width: 164, height: 254, rx: 34, fill: '#f0e5df', stroke: '#c7a8aa' });
    element(svg, 'path', { d: 'M447 69V275M573 69V275', stroke: '#dfc4c3', 'stroke-width': 2 });
    label(svg, 24, 27, 'MARROW', { 'font-size': 20, 'letter-spacing': 2 });
    label(svg, 442, 27, 'BLOOD', { 'font-size': 20, 'letter-spacing': 2 });
    arrow(svg, 397, 176, 420, 176);
    return svg;
  }
  function damage(parent, node, x, y, color = C.plum) {
    const fragments = Array.from({ length: 5 }, (_, i) => element(parent, 'ellipse', { cx: 0, cy: 0, rx: 5 + i % 2 * 2, ry: 4 + i % 3, fill: color, opacity: 0 }));
    return amount => {
      const t = clamp(amount);
      opacity(node, 1 - t);
      move(node, x, y, 1 - .5 * t);
      fragments.forEach((f, i) => {
        const a = i * Math.PI * 2 / 5 + .2;
        move(f, x + Math.cos(a) * (10 + t * 32), y + Math.sin(a) * (10 + t * 29), 1 - .45 * t);
        opacity(f, Math.sin(Math.PI * t) * .85);
      });
    };
  }
  function medicine(parent, x, y) {
    const g = element(parent, 'g');
    element(g, 'rect', { x: -15, y: -7, width: 30, height: 14, rx: 7, fill: '#f1e7d7', stroke: C.teal, 'stroke-width': 2 });
    element(g, 'path', { d: 'M0 -7H8A7 7 0 0 1 8 7H0Z', fill: C.teal });
    move(g, x, y);
    return g;
  }
  function initialBlood(svg) {
    sprite(svg, 'red', 481, 119, 51);
    sprite(svg, 'platelet', 546, 256, 24);
  }

  function combination(svg) {
    scaffold(svg, 'Illustrative combination treatment: survival protection is blocked, some abnormal cells die, and some abnormal cells remain. Blood production may still be low.');
    initialBlood(svg);
    const positions = [[99, 118], [216, 125], [151, 225]];
    const cells = positions.map(([x, y]) => sprite(svg, 'blast', x, y, 74));
    const shields = positions.map(([x, y]) => {
      const s = element(svg, 'path', { d: 'M0 -47L43 -30V4Q40 33 0 49Q-40 33 -43 4V-30Z', fill: 'none', stroke: C.gold, 'stroke-width': 2.2, 'stroke-dasharray': '5 4' });
      move(s, x, y); return s;
    });
    const dying = cells.map((node, i) => damage(svg, node, ...positions[i]));
    sprite(svg, 'blast', 313, 230, 63);
    sprite(svg, 'stem', 306, 110, 49);
    const drugs = positions.map(([x]) => medicine(svg, x, 63));
    const action = label(svg, 26, 282, 'Survival protection blocked', { fill: C.teal, 'font-size': 20 });
    return {
      beats: [
        { at: 0, label: 'Survival', title: 'Leukemia cells resist dying.', text: 'The gold outlines represent a survival protein that helps these cells persist.' },
        { at: .24, label: 'Block protection', title: 'The combination acts in two ways.', text: 'Azacitidine or decitabine changes cell regulation. Venetoclax blocks BCL-2 survival protection.' },
        { at: .53, label: 'Cell death', title: 'Some abnormal cells die.', text: 'With survival protection blocked, vulnerable cells break down. This is one possible treatment effect.' },
        { at: .86, label: 'Reassess', title: 'Fewer abnormal cells does not mean normal blood yet.', text: 'Some leukemia can remain. Blood counts may stay low and need close monitoring and support.' }
      ],
      render(p) {
        positions.forEach(([x, y], i) => {
          const arrival = phase(p, .16 + i * .025, .4 + i * .025);
          move(drugs[i], x, lerp(63, y - 32, arrival));
          opacity(drugs[i], phase(p, .12, .2) * (1 - phase(p, .43, .55)));
          opacity(shields[i], 1 - phase(p, .34 + i * .025, .55 + i * .025));
          dying[i](phase(p, .49 + i * .06, .81 + i * .06));
        });
        opacity(action, phase(p, .36, .49));
      }
    };
  }

  function targeted(svg) {
    scaffold(svg, 'IDH-targeted treatment example: an abnormal immature cell matures and moves toward the blood. Other abnormal cells remain. The drug does not repair the gene mutation.');
    initialBlood(svg);
    sprite(svg, 'blast', 88, 232, 57);
    sprite(svg, 'blast', 310, 239, 59);
    const immature = sprite(svg, 'blast', 171, 157, 109);
    const mature = sprite(svg, 'white', 171, 157, 91);
    const ring = element(svg, 'circle', { cx: 171, cy: 157, r: 61, stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '5 5', fill: 'none' });
    const drug = medicine(svg, 171, 66);
    label(svg, 25, 282, 'IDH example: a cell can mature', { 'font-size': 20, fill: C.teal });
    arrow(svg, 265, 157, 380, 157);
    return {
      beats: [
        { at: 0, label: 'Immature', title: 'A maturation block keeps the cell immature.', text: 'This example shows an AML cell with an IDH mutation. Other targets work differently.' },
        { at: .22, label: 'Match target', title: 'A matching medicine blocks the altered protein.', text: 'An IDH inhibitor can help release the maturation block. It does not edit the DNA back to normal.' },
        { at: .48, label: 'Mature', title: 'The cell develops a more mature form.', text: 'Watch its large, simple nucleus change shape as it matures. Maturation is different from killing the cell.' },
        { at: .84, label: 'Reassess', title: 'Maturation is one possible response.', text: 'Other abnormal cells can remain. Treatment response and side effects still need monitoring.' }
      ],
      render(p) {
        const arrival = phase(p, .14, .35), change = phase(p, .36, .65), travel = phase(p, .66, .96);
        const x = lerp(171, 518, travel), y = lerp(157, 191, travel);
        move(immature, x, y, lerp(1, .85, change)); opacity(immature, 1 - change);
        move(mature, x, y); opacity(mature, change);
        move(drug, 171, lerp(66, 106, arrival)); opacity(drug, phase(p, .1, .2) * (1 - phase(p, .37, .48)));
        opacity(ring, 1 - phase(p, .28, .46));
      }
    };
  }

  function mds(svg) {
    scaffold(svg, 'Selected MDS blood-building treatment example: developing red cells mature and enter the bloodstream, while abnormal marrow cells remain.');
    initialBlood(svg);
    sprite(svg, 'irregular', 76, 234, 61);
    sprite(svg, 'irregular', 150, 245, 47);
    label(svg, 24, 282, 'Abnormal marrow cells remain', { 'font-size': 20 });
    const positions = [[103, 119], [219, 142], [310, 101]];
    const precursors = positions.map(([x, y]) => sprite(svg, 'stem', x, y, 63));
    const reds = positions.map(([x, y]) => sprite(svg, 'red', x, y, 61));
    const drugs = positions.map(([x]) => medicine(svg, x, 65));
    return {
      beats: [
        { at: 0, label: 'Low output', title: 'Too few useful red cells reach the blood.', text: 'In MDS, developing cells can struggle to mature. The abnormal marrow population is still present.' },
        { at: .22, label: 'Help production', title: 'Help the red-cell pathway.', text: 'In selected MDS, ESAs stimulate red-cell production; luspatercept supports red-cell maturation.' },
        { at: .46, label: 'Mature', title: 'More red cells can finish developing.', text: 'This schematic shows a possible benefit: more oxygen-carrying cells enter the blood.' },
        { at: .87, label: 'More red cells', title: 'Improve anemia without erasing the disease.', text: 'Some people need fewer transfusions. These medicines do not necessarily remove the abnormal marrow cells.' }
      ],
      render(p) {
        positions.forEach(([x, y], i) => {
          const change = phase(p, .32 + i * .065, .58 + i * .065);
          const travel = phase(p, .59 + i * .025, .92 + i * .025);
          move(precursors[i], x, y, 1 - .2 * change); opacity(precursors[i], 1 - change);
          move(reds[i], lerp(x, 474 + i * 36, travel), lerp(y, 168 + i * 35, travel)); opacity(reds[i], change);
          move(drugs[i], x, lerp(65, y - 30, phase(p, .13, .32)));
          opacity(drugs[i], phase(p, .1, .2) * (1 - phase(p, .33, .45)));
        });
      }
    };
  }

  function intensive(svg) {
    scaffold(svg, 'Intensive chemotherapy example: both leukemia cells and healthy developing cells decline. Some blood production can recover later; abnormal cells can remain.');
    initialBlood(svg);
    const positions = [[78, 112], [172, 119], [270, 110], [109, 218], [229, 229]];
    const cells = positions.map(([x, y]) => sprite(svg, 'blast', x, y, 66));
    const dying = cells.map((node, i) => damage(svg, node, ...positions[i]));
    const stem = sprite(svg, 'stem', 330, 213, 55);
    const killStem = damage(svg, stem, 330, 213, '#638d85');
    sprite(svg, 'blast', 323, 91, 36);
    const surviving = sprite(svg, 'stem', 178, 214, 51);
    const newRed = sprite(svg, 'red', 178, 214, 58);
    const drug = medicine(svg, 194, 64);
    const note = label(svg, 25, 282, 'Healthy cells are affected too', { fill: C.rose, 'font-size': 20 });
    return {
      beats: [
        { at: 0, label: 'Leukemia', title: 'Abnormal cells fill much of the marrow.', text: 'Intensive chemotherapy aims to sharply reduce the leukemia population.' },
        { at: .2, label: 'Treat', title: 'Treatment damages dividing cells.', text: 'Leukemia cells die—but healthy blood-forming cells can be damaged too.' },
        { at: .5, label: 'Low counts', title: 'Blood production can fall further at first.', text: 'This is why infection precautions, transfusions and close monitoring are often needed.' },
        { at: .78, label: 'Recovery', title: 'Healthy production may recover later.', text: 'Recovery takes time and varies. Residual leukemia can remain, so marrow tests guide what happens next.' }
      ],
      render(p) {
        dying.forEach((render, i) => render(phase(p, .22 + i * .035, .51 + i * .035)));
        killStem(phase(p, .28, .59));
        opacity(surviving, 1 - .75 * phase(p, .25, .55) + .75 * phase(p, .65, .84));
        opacity(newRed, phase(p, .72, .85));
        move(newRed, lerp(178, 514, phase(p, .8, 1)), lerp(214, 214, p));
        move(drug, 194, lerp(64, 160, phase(p, .1, .36)));
        opacity(drug, phase(p, .06, .14) * (1 - phase(p, .36, .5)));
        opacity(note, phase(p, .23, .37));
      }
    };
  }

  function transplant(svg) {
    scaffold(svg, 'Donor transplant sequence: conditioning reduces marrow cells; donor stem cells arrive through the blood and settle in marrow; new blood cells develop. A donor immune cell also attacks an abnormal cell.');
    initialBlood(svg);
    const positions = [[90, 118], [212, 119], [110, 225]];
    const cells = positions.map(([x, y]) => sprite(svg, 'blast', x, y, 67));
    const dying = cells.map((node, i) => damage(svg, node, ...positions[i]));
    const oldStem = sprite(svg, 'stem', 300, 115, 53);
    const oldStemDies = damage(svg, oldStem, 300, 115, '#638d85');
    sprite(svg, 'blast', 59, 239, 36); // A small residual population can persist.
    const residual = sprite(svg, 'blast', 302, 234, 59);
    const residualDies = damage(svg, residual, 302, 234);
    const donor = sprite(svg, 'stem', 518, 80, 65);
    const donorRing = element(svg, 'circle', { cx: 0, cy: 0, r: 37, fill: 'none', stroke: C.teal, 'stroke-width': 2.5 });
    const red = sprite(svg, 'red', 211, 166, 59);
    const immune = sprite(svg, 'white', 211, 166, 62);
    const platelets = sprite(svg, 'platelet', 211, 166, 29);
    const donorLabel = label(svg, 455, 278, 'Donor cells', { fill: C.teal, 'font-size': 20 });
    return {
      beats: [
        { at: 0, label: 'Prepare', title: 'First, prepare the marrow.', text: 'Conditioning treatment reduces diseased and healthy blood-forming cells before donor cells are infused.' },
        { at: .3, label: 'Donor cells', title: 'Donor stem cells arrive through the blood.', text: 'Watch a donor cell travel into the marrow and settle there. The teal outline identifies it.' },
        { at: .56, label: 'Rebuild', title: 'The donor cells start a new blood supply.', text: 'Over time, donor stem cells can produce red cells, platelets and immune cells.' },
        { at: .82, label: 'Immune defense', title: 'Donor immunity can attack leukemia too.', text: 'This may help control some remaining disease. Engraftment and immune recovery take time; infection and graft-versus-host disease remain important risks.' }
      ],
      render(p) {
        dying.forEach((render, i) => render(phase(p, .05 + i * .02, .28 + i * .02)));
        oldStemDies(phase(p, .08, .31));
        const arrival = phase(p, .3, .56), x = lerp(518, 211, arrival), y = lerp(80, 166, arrival);
        move(donor, x, y); opacity(donor, phase(p, .26, .32));
        move(donorRing, x, y); opacity(donorRing, phase(p, .26, .32));
        opacity(donorLabel, phase(p, .26, .32) * (1 - phase(p, .5, .6)));
        const develop = phase(p, .56, .7), travel = phase(p, .68, .96);
        opacity(red, develop); move(red, lerp(211, 490, travel), lerp(166, 203, travel));
        opacity(platelets, develop); move(platelets, lerp(211, 552, travel), lerp(166, 162, travel));
        opacity(immune, develop); move(immune, lerp(211, 273, phase(p, .69, .88)), lerp(166, 231, phase(p, .69, .88)));
        residualDies(phase(p, .86, 1));
      }
    };
  }

  function support(svg) {
    scaffold(svg, 'Transfusion example: donated red cells enter the bloodstream while abnormal marrow cells remain unchanged. Supportive care treats the effects of the disease rather than eliminating it.');
    [[89, 125], [202, 112], [298, 159], [146, 227], [302, 238]].forEach(([x, y], i) => sprite(svg, i === 4 ? 'irregular' : 'blast', x, y, 64));
    sprite(svg, 'red', 478, 244, 48);
    label(svg, 24, 282, 'Marrow disease remains', { 'font-size': 20 });
    const bag = element(svg, 'g');
    element(bag, 'path', { d: 'M478 58H544L552 112Q552 120 543 120H478Q470 120 470 112Z', fill: '#f7f0e6', stroke: '#a36b77', 'stroke-width': 2 });
    element(bag, 'path', { d: 'M475 84H548V110Q549 116 542 116H479Q474 116 475 110Z', fill: '#ba6b78' });
    element(bag, 'path', { d: 'M492 58V50H530V58M511 120V155', fill: 'none', stroke: '#a36b77', 'stroke-width': 2 });
    const infusionArrow = arrow(svg, 511, 145, 511, 169, C.rose);
    const reds = Array.from({ length: 3 }, () => sprite(svg, 'red', 511, 150, 51));
    const heading = label(svg, 449, 286, 'Transfusion', { 'font-size': 20, fill: C.rose });
    return {
      beats: [
        { at: 0, label: 'Low counts', title: 'Low blood counts can cause symptoms.', text: 'The abnormal marrow is still present. Supportive care helps manage its effects.' },
        { at: .23, label: 'Transfuse', title: 'A transfusion supplies ready-made cells.', text: 'In this example, donated red cells enter the bloodstream. They do not have to be made by this marrow.' },
        { at: .57, label: 'More oxygen', title: 'More red cells can carry oxygen.', text: 'Transfusions can help anemia symptoms. Other support includes infection treatment and symptom relief.' },
        { at: .85, label: 'Support', title: 'Support helps without removing the leukemia.', text: 'The marrow cells remain unchanged here. Supportive care can accompany any disease-directed treatment.' }
      ],
      render(p) {
        opacity(bag, phase(p, .12, .24)); opacity(heading, phase(p, .12, .24)); opacity(infusionArrow, phase(p, .12, .24));
        reds.forEach((node, i) => {
          const t = phase(p, .28 + i * .12, .61 + i * .12);
          opacity(node, phase(p, .28 + i * .12, .34 + i * .12));
          move(node, lerp(511, 474 + i * 36, t), lerp(145, 181 + i * 29, t));
        });
      }
    };
  }

  const builders = { combination, targeted, mds, intensive, transplant, support };
  window.buildLeukemiaTreatmentScene = (svg, key) => {
    const scene = (builders[key] || combination)(svg);
    const render = scene.render;
    scene.render = progress => render(clamp(Number.isFinite(progress) ? progress : 0));
    scene.render(0);
    return scene;
  };
})();
