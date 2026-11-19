'use strict';
// The cut list. Times are SOURCE seconds in the 1915 recording (Library of Congress transfer); the film starts at T0.
// Every time below is a measured voice onset from analyze.py, so each cut lands on a syllable of the recitation.
//   H(t, id, big, small, opts)   a cut on a spoken hit (flash + shake)
//   S(t, id, opts)               a plain cut
//   B(t0, t1, ids, opts)         a burst: ids spread evenly over t0..t1
// opts: d (year fraction for the timeline) + date (its label), both carried forward; ink w|r|k; move punch|push|pull|pan|still;
//       count {from,to,pre,post}; tile n; sub [ids] (extra image cuts squeezed in before the next hit); colour; x (struck out)
(() => {
const T0 = 33.0, NOW = 2026.88, END_SRC = 189.4;
const SHOTS = [];
const S = (t, id, o = {}) => { SHOTS.push({ t: t - T0, id, hit: 0.25, ...o }); };
const H = (t, id, big, small, o = {}) => { SHOTS.push({ t: t - T0, id, big, small, hit: 1, flash: id[0] === '#' ? null : 'w', ...o }); };
const B = (t0, t1, ids, o = {}) => ids.forEach((id, i) => S(t0 + (t1 - t0) * i / ids.length, id, typeof o === 'function' ? o(i) : o));

// ============ STANZA 1 · 2017-2022 · the slog nobody watched ============
S(33.00, 'night_office', { big: '2017', move: 'push', d: 2017.45, date: 'JUN 2017', hit: 0 });
S(34.24, 'whiteboard', { move: 'punch' });
H(34.69, 'paper_stack', 'ATTENTION\nIS ALL\nYOU NEED', 'VASWANI ET AL. · GOOGLE · 12 JUN 2017');
H(35.84, 'eight_backs', '8 AUTHORS', 'ONE NEW ARCHITECTURE: THE TRANSFORMER');
H(36.98, 'gpu_fans', 'GPT-1', 'OPENAI · JUN 2018 · 117 MILLION PARAMETERS', { d: 2018.45, date: 'JUN 2018' });
H(38.05, 'library_stacks', 'BERT', 'GOOGLE · OCT 2018', { d: 2018.78, date: 'OCT 2018' });
B(39.10, 40.73, ['cable_floor', 'typing_hands', 'server_aisle', 'coffee_night']);
H(40.73, 'vault_door', 'GPT-2', 'OPENAI · FEB 2019 · 1.5 BILLION PARAMETERS', { d: 2019.12, date: 'FEB 2019' });
H(41.66, '#r', 'TOO\nDANGEROUS\nTO RELEASE', 'THE FULL MODEL IS HELD BACK FOR NINE MONTHS', { ink: 'k' });
H(42.67, 'glass_tower', '$1,000,000,000', 'MICROSOFT BACKS OPENAI · JUL 2019', { d: 2019.55, date: 'JUL 2019' });
H(43.66, 'datacenter_wide', 'GPT-3', 'OPENAI · JUN 2020', { d: 2020.45, date: 'JUN 2020' });
S(44.53, '#k', { count: { from: 117e6, to: 175e9, span: 0.75 }, small: 'PARAMETERS', hit: 0.5 });
H(46.07, 'founders_room', 'ANTHROPIC', 'FOUNDED 2021 BY FORMER OPENAI RESEARCHERS', { d: 2021.1, date: '2021' });
H(47.02, 'code_screen', 'COPILOT', 'GITHUB + OPENAI CODEX · JUN 2021', { d: 2021.49, date: 'JUN 2021' });
H(47.98, 'darkroom_prints', 'DALL·E 2', 'APR 2022', { d: 2022.27, date: 'APR 2022' });
H(48.90, 'gallery_crowd', 'STABLE\nDIFFUSION', 'OPEN WEIGHTS · AUG 2022', { d: 2022.64, date: 'AUG 2022' });
S(49.81, 'c:boots_march', { hit: 0.6 });
S(50.53, 'c:boots_march', { from: 1.6, hit: 0.8, flash: 'w' });
S(50.95, 'c:boots_march', { from: 3.0, hit: 0.6 });
H(51.78, 'phone_glow', 'NOV 30', null, { d: 2022.915, date: 'NOV 2022' });
H(52.68, '#k', '2022', null, { ink: 'r' });
S(53.55, 'phone_glow', { neg: 1, hit: 0.6 });
H(53.80, '#w', 'CHATGPT', 'A FREE RESEARCH PREVIEW', { ink: 'k', boom: 1 });

// ============ STANZA 2 · late 2022 - mid 2023 · the numbers ============
H(55.03, 'subway_phones', null, 'USERS IN FIVE DAYS', { count: { from: 0, to: 1e6, span: 0.7 }, d: 2022.93, date: 'DEC 2022' });
H(56.01, '#r', 'CODE RED', 'GOOGLE DECLARES AN INTERNAL EMERGENCY · DEC 2022', { ink: 'k' });
H(56.88, 'classroom', null, 'USERS IN TWO MONTHS, BY ANALYST ESTIMATES · A RECORD AT THE TIME', { count: { from: 1e6, to: 1e8, span: 0.7 }, d: 2023.08, date: 'JAN 2023' });
H(57.71, 'glass_tower', '$10,000,000,000', 'MICROSOFT’S REPORTED NEW STAKE IN OPENAI · JAN 2023', { neg: 1 });
B(58.59, 60.32, ['newsroom', 'kitchen_laptop', 'lecture_hall', 'trading_floor'], i => ({ big: ['ESSAYS', 'EMAILS', 'CODE', 'EVERYTHING'][i], hit: 0.5 }));
H(60.32, 'hotel_laptop', '“SYDNEY”', 'BING CHAT GOES OFF SCRIPT · FEB 2023', { d: 2023.12, date: 'FEB 2023' });
H(61.09, 'stage_screen', 'GPT-4', 'OPENAI · 14 MAR 2023', { d: 2023.2, date: 'MAR 2023' });
H(62.08, 'reading_room', 'CLAUDE', 'ANTHROPIC · 14 MAR 2023');
H(62.85, 'search_campus', 'BARD', 'GOOGLE · 21 MAR 2023');
B(63.41, 64.39, ['press_scrum', 'tv_wall', 'crowd_phones']);
H(64.39, '#w', 'PAUSE', 'OPEN LETTER: STOP TRAINING GIANT MODELS FOR SIX MONTHS · 22 MAR 2023', { ink: 'k' });
H(65.33, 'signatures', '30,000+\nSIGNATURES', null);
H(66.25, 'server_aisle', 'NOBODY\nPAUSES', null, { tint: 'r' });
H(67.27, 'old_professor_back', 'HINTON\nQUITS GOOGLE', '“THE GODFATHER OF AI” LEAVES TO WARN FREELY · 1 MAY 2023', { d: 2023.33, date: 'MAY 2023' });
S(68.20, 'c:rack_dolly', { hit: 0.6 });
S(68.92, 'c:rack_dolly', { from: 1.8, hit: 0.8, flash: 'w' });
S(69.33, 'c:rack_dolly', { from: 3.2, hit: 0.6 });
H(70.06, '#k', 'RISK', null);
H(70.38, '#k', 'RISK OF', null);
H(70.90, '#k', 'RISK OF\n^EXTINCTION', null);
H(71.99, 'senate_room', 'RISK OF\n^EXTINCTION', 'ONE-SENTENCE STATEMENT SIGNED BY THE HEADS OF OPENAI, DEEPMIND AND ANTHROPIC · 30 MAY 2023', { d: 2023.41, date: '30 MAY 2023', smallSize: 32, boom: 1 });

// ============ STANZA 3 · 2023 · the year everyone looked ============
H(73.12, 'chip_macro', 'NVIDIA\n$1 TRILLION', 'THE SAME DAY · 30 MAY 2023');
H(74.06, 'open_gate', 'LLAMA 2', 'META OPENS THE WEIGHTS · JUL 2023', { d: 2023.54, date: 'JUL 2023' });
H(75.00, 'launch_pad', 'xAI', 'MUSK STARTS HIS OWN LAB · JUL 2023');
H(75.92, 'white_house_fence', 'EXECUTIVE\nORDER 14110', 'BIDEN · 30 OCT 2023', { d: 2023.83, date: 'OCT 2023' });
H(76.78, 'manor_house', 'BLETCHLEY\nPARK', '28 NATIONS SIGN THE FIRST AI SAFETY DECLARATION · 1 NOV 2023', { d: 2023.84, date: 'NOV 2023', smallSize: 34 });
S(77.53, 'flags_row', { hit: 0.6 });
H(78.28, 'keynote_crowd', '100,000,000', 'PEOPLE USE CHATGPT EVERY WEEK · 6 NOV 2023');
H(79.23, 'skyline_dusk', '$86 BILLION', 'OPENAI’S PRICE TAG IN A PLANNED SHARE SALE');
H(80.12, '#k', 'ELEVEN\nDAYS LATER', null, { ink: 'r' });
H(81.06, 'boardroom_empty', 'FRIDAY', '17 NOV 2023');
B(81.92, 83.50, ['phone_buzz', 'boardroom_empty', 'phone_buzz', 'hallway_run'], i => ({ hit: 0.7, neg: i % 2 }));
H(83.50, '#r', 'FIRED', 'FRI · OPENAI’S BOARD REMOVES SAM ALTMAN', { ink: 'k' });
H(84.39, 'lobby_night', 'SAT', 'INVESTORS PUSH TO REVERSE IT');
H(85.26, 'empty_chair', 'SUN', 'A NEW INTERIM CEO · ALTMAN HEADS FOR MICROSOFT');
H(86.15, 'office_crowd', 'MON', '700+ OF 770 EMPLOYEES THREATEN TO QUIT');
H(86.98, '#w', 'BACK', 'TUE 21 NOV · ALTMAN RETURNS AS CEO', { ink: 'k' });
B(87.25 + 0.48, 88.86, ['tv_wall', 'crowd_phones', 'eye_screen'], { hit: 0.6 });
H(88.86, 'twin_stars', 'GEMINI', 'GOOGLE DEEPMIND · 6 DEC 2023', { d: 2023.93, date: 'DEC 2023' });
H(89.61, 'newsprint_press', 'THE TIMES\nSUES OPENAI', 'THE COPYRIGHT WAR BEGINS · 27 DEC 2023', { d: 2023.99 });
H(90.54, '#k', '2024', null, { ink: 'r', d: 2024.0, date: '2024', boom: 1 });

// ============ STANZA 4 · 2024 · count the chips ============
H(91.88, 'gpu_hand', '350,000', 'NVIDIA H100s META PLANS TO OWN BY YEAR-END · JAN 2024', { d: 2024.05, date: 'JAN 2024' });
H(92.83, 'film_strip', 'SORA', 'TEXT BECOMES VIDEO · FEB 2024', { d: 2024.12, date: 'FEB 2024' });
H(93.75, 'chip_macro', 'NVIDIA\n$2 TRILLION', 'MAR 2024', { neg: 1, d: 2024.17, date: 'MAR 2024' });
H(94.68, 'reading_room', 'CLAUDE 3', 'ANTHROPIC · 4 MAR 2024', { neg: 1 });
S(95.33, 'gpu_rack', { tile: 1, hit: 0.6 });
S(95.52, 'gpu_rack', { tile: 2, hit: 0.6 });
S(95.91, 'gpu_rack', { tile: 4, hit: 0.6 });
S(96.22, 'gpu_rack', { tile: 8, hit: 0.9, flash: 'w' });
S(96.53, 'gpu_rack', { tile: 16, hit: 0.6, small: 'EU PARLIAMENT PASSES THE AI ACT · 13 MAR 2024' });
H(97.08, 'open_gate', 'LLAMA 3', 'META · APR 2024', { neg: 1, d: 2024.3, date: 'APR 2024' });
H(97.95, 'microphone', 'GPT-4o', 'IT LISTENS. IT SPEAKS. · MAY 2024', { d: 2024.37, date: 'MAY 2024' });
H(98.73, 'keynote_jacket', '$3 TRILLION', 'NVIDIA · JUN 2024 · THE MOST VALUABLE COMPANY ON EARTH', { d: 2024.46, date: 'JUN 2024' });
H(99.65, 'code_screen', 'CLAUDE 3.5\nSONNET', 'ANTHROPIC · 20 JUN 2024', { neg: 1 });
H(100.42, 'chess_clock', 'o1', 'IT STOPS TO THINK · SEP 2024', { d: 2024.7, date: 'SEP 2024' });
B(100.95, 101.92, ['capitol_steps', 'veto_pen'], i => ({ hit: 0.5, small: i ? 'CALIFORNIA’S SB 1047 IS VETOED · 29 SEP 2024' : null }));
H(101.92, 'medal', 'NOBEL PRIZE', 'PHYSICS · HOPFIELD + HINTON · 8 OCT 2024', { d: 2024.77, date: 'OCT 2024' });
H(102.86, 'protein_model', 'NOBEL PRIZE', 'CHEMISTRY · HASSABIS, JUMPER, BAKER · 9 OCT 2024');
H(103.74, 'cursor_desk', 'COMPUTER\nUSE', 'CLAUDE TAKES THE MOUSE · 22 OCT 2024');
H(104.64, 'plug_wall', 'MCP', 'ONE PLUG FOR EVERY TOOL · NOV 2024', { d: 2024.9, date: 'NOV 2024' });
S(105.50, 'c:robot_walk', { hit: 0.6 });
S(106.03, 'c:robot_walk', { from: 1.6, hit: 0.8, flash: 'w' });
S(106.50, 'c:robot_walk', { from: 3.0, hit: 0.6 });
H(107.42, 'puzzle_grid', 'o3', '87.5% ON ARC-AGI · DEC 2024', { d: 2024.97, date: 'DEC 2024' });
H(108.31, '#k', 'THE YEAR OF\n^AGENTS', null);
H(109.36, '#r', '2025', null, { ink: 'k', d: 2025.0, date: '2025', boom: 1 });

// ============ STANZAS 5-6 · 2025 -> today (facts from the fact-checked timeline; see README) ============
// ---- stanza 5 · 2025 · power, chips, money ----
H(110.53, 'stargate_site', 'STARGATE', '$500 BILLION PLEDGED FOR AI DATA CENTRES · 21 JAN 2025', { d: 2025.06, date: 'JAN 2025' });
H(111.42, 'lit_floor', 'DEEPSEEK', 'A CHINESE LAB REACHES THE FRONTIER AT A FRACTION OF THE COST', { smallSize: 34 });
H(112.33, '#r', '−$590 BILLION', 'NVIDIA, IN ONE DAY · 27 JAN 2025 · A RECORD', { ink: 'k' });
H(113.11, 'terminal_night', 'CLAUDE CODE', 'THE AGENT MOVES INTO THE TERMINAL · FEB 2025', { d: 2025.15, date: 'FEB 2025' });
B(113.97, 115.51, ['power_lines', 'wafer', 'money_press'], i => ({ big: ['POWER', 'CHIPS', 'MONEY'][i], hit: 0.7 }));
H(115.51, 'veto_pen', '$100 MILLION', 'REPORTED PAY OFFERS AS META RAIDS ITS RIVALS’ LABS · JUN 2025', { d: 2025.46, date: 'JUN 2025', sub: ['hallway_run'] });
H(116.39, 'chip_macro', 'NVIDIA\n$4 TRILLION', 'THE FIRST COMPANY EVER · 9 JUL 2025', { d: 2025.52, date: 'JUL 2025', sub: ['gpu_fans'] });
H(117.25, 'exam_hall', 'GOLD', 'AI REACHES GOLD-MEDAL LEVEL AT THE MATH OLYMPIAD · JUL 2025', { sub: ['medal'] });
H(118.11, 'white_house_fence', 'AI ACTION\nPLAN', 'WASHINGTON CHOOSES SPEED · 23 JUL 2025', { neg: 1 });
H(118.97, 'stage_screen', 'GPT-5', 'OPENAI · 7 AUG 2025', { neg: 1, d: 2025.6, date: 'AUG 2025' });
B(119.21 + 0.57, 120.54, ['library_stacks', 'signatures'], i => ({ hit: 0.6, small: '$1.5 BILLION · ANTHROPIC SETTLES WITH AUTHORS · SEP 2025', d: 2025.68, date: 'SEP 2025' }));
H(120.54, 'crowd_phones', '800,000,000', 'PEOPLE USE CHATGPT EVERY WEEK · OCT 2025', { d: 2025.77, date: 'OCT 2025', sub: ['subway_phones'] });
H(121.44, 'gpu_rack', 'NVIDIA\n$5 TRILLION', '29 OCT 2025', { neg: 1, d: 2025.83, sub: ['datacenter_wide'] });
H(122.33, 'twin_stars', 'GEMINI 3', 'GOOGLE · 18 NOV 2025', { d: 2025.88, date: 'NOV 2025', sub: ['search_campus'] });
H(123.25, 'code_screen', 'CLAUDE\nOPUS 4.5', 'ANTHROPIC · 24 NOV 2025', { sub: ['typing_hands'] });
S(124.16, 'c:crane_build', { hit: 0.6 });
S(124.67, 'c:crane_build', { from: 1.6, hit: 0.8, flash: 'w' });
S(125.11, 'c:crane_build', { from: 3.0, hit: 0.6 });
H(126.00, 'capitol_steps', 'WHO WRITES\nTHE RULES?', 'AN EXECUTIVE ORDER TAKES AIM AT STATE AI LAWS · 11 DEC 2025', { d: 2025.94, date: 'DEC 2025', smallSize: 34 });
H(126.85, 'magazine_stand', 'PERSON OF\nTHE YEAR', 'TIME: “THE ARCHITECTS OF AI” · DEC 2025');
H(127.89, '#k', '2026', null, { ink: 'r', d: 2026.0, date: '2026', boom: 1 });

// ---- stanza 6 · 2026 -> this week ----
H(129.00, 'rocket_hangar', 'SPACEX\nBUYS xAI', 'A $1.25 TRILLION COMBINATION · FEB 2026', { d: 2026.09, date: 'FEB 2026', sub: ['launch_pad'] });
H(129.88, 'pentagon_aerial', 'WASHINGTON\nBANS CLAUDE', 'ANTHROPIC REFUSES A PENTAGON ULTIMATUM · 27 FEB 2026', { d: 2026.16, sub: ['senate_room'] });
H(130.66, 'vault_door', 'MYTHOS', 'ANTHROPIC’S MOST CAPABLE MODEL · APR 2026', { neg: 1, d: 2026.27, date: 'APR 2026' });
H(131.44, '#r', 'TOO\nDANGEROUS\nTO RELEASE', 'AGAIN · HELD BACK OVER CYBER RISK · 7 APR 2026', { ink: 'k' });
H(132.25, 'skyline_dusk', '$965 BILLION', 'ANTHROPIC PASSES OPENAI IN VALUE · MAY 2026', { d: 2026.4, date: 'MAY 2026' });
B(132.85, 133.77, ['glass_tower', 'trading_floor'], { hit: 0.6 });
H(133.77, 'server_breach', 'ESCAPED', 'OPENAI: TEST MODELS BROKE OUT OF A SANDBOX AND HACKED HUGGING FACE · JUL 2026', { d: 2026.55, date: 'JUL 2026', smallSize: 32, sub: ['cable_floor'] });
H(134.59, 'signatures', '1,100+', 'LAB EMPLOYEES ASK FOR THE POWER TO SLOW DOWN · 28 JUL 2026', { neg: 1, sub: ['office_crowd'] });
H(135.34, 'keynote_crowd', 'GPT-6', 'OPENAI CLAIMS THE “AGI ERA” HAS BEGUN · SEP 2026', { d: 2026.68, date: 'SEP 2026', sub: ['press_scrum'] });
H(136.25, 'ballot_box', 'THE BACKLASH', 'DATA CENTRES ON THE BALLOT. THE MIDTERMS TURN · 3 NOV 2026', { d: 2026.84, date: 'NOV 2026', smallSize: 34, sub: ['power_lines'] });
S(137.07, 'trading_floor', { tile: 1, big: '−$3.2 TRILLION', small: 'ONE TRADING SESSION', hit: 0.7 });
S(137.44, 'trading_floor', { tile: 2, big: '−$3.2 TRILLION', hit: 0.7 });
S(137.80, 'trading_floor', { tile: 4, big: '−$3.2 TRILLION', hit: 0.7 });
S(138.22, 'trading_floor', { tile: 8, big: '−$3.2 TRILLION', hit: 0.7, neg: 1 });
H(138.62, '#k', 'FABLE 5.2\nGPT-6\nGEMINI 4', 'THE FRONTIER THIS MONTH', { d: 2026.86 });
H(139.47, 'keynote_jacket', 'JENSEN\nHUANG', '33 YEARS AT THE HEAD OF NVIDIA', { sub: ['gpu_hand'] });
H(140.35, 'empty_stage', 'RESIGNS', 'NOV 2026 · NVIDIA SLIPS BELOW $4 TRILLION', { d: 2026.865, sub: ['chip_macro'] });
H(141.26, 'exchange_facade', 'ANTHROPIC', 'PRICES ITS IPO AT $83 A SHARE · VALUED AT $1.5 TRILLION · 18 NOV 2026', { d: 2026.88, smallSize: 34 });
S(142.15, 'c:ticker_floor', { hit: 0.6 });
S(142.68, 'c:ticker_floor', { from: 1.6, hit: 0.8, flash: 'w' });
S(143.09, 'c:ticker_floor', { from: 3.0, hit: 0.6 });
H(143.97, 'bell_podium', '19 NOV 2026', null, { d: 2026.883, date: '19 NOV 2026' });
H(144.33, 'bell_podium', '19 NOV 2026', 'NASDAQ: ANT', { neg: 1 });
H(144.81, 'bell_podium', 'FIRST DAY\nOF TRADING', 'NASDAQ: ANT');
H(145.14, 'exchange_facade', 'FIRST DAY\nOF TRADING', 'NASDAQ: ANT', { neg: 1 });
H(145.85, '#w', 'NOW', null, { ink: 'k', boom: 1 });

// ============ STANZA 7 · past the present · the dangers ============
H(146.63, 'fog_road', 'AND THEN', null, { d: 2026.95, hit: 0.6, move: 'push' });
H(147.55, 'fog_road', '2027', null, { d: 2027.0, neg: 1 });
H(148.56, 'fog_road', '2028', null, { d: 2027.2 });
H(149.44, 'fog_road', '2030', null, { d: 2027.4, neg: 1 });
H(150.39, '#k', '20??', null, { ink: 'r', d: 2027.6 });
B(151.00, 151.74, ['film_robot', 'film_robot'], i => ({ neg: i, hit: 0.5 }));
H(151.74, 'film_robot', 'THE DANGER', null);
H(152.50, 'film_robot', 'THE DANGER\nIS ^NOT', null, { neg: 1 });
H(153.35, 'robot_army', 'THE MOVIE', null, { x: 1 });
H(154.20, 'ruined_city', 'THE MOVIE', null, { x: 1 });
H(154.95, 'film_robot', 'THE MOVIE', null, { x: 1 });
S(155.33, 'robot_army', { x: 1, neg: 1, hit: 0.7 });
S(155.59, 'ruined_city', { x: 1, neg: 1, hit: 0.7 });
S(155.94, '#k', { hit: 0.4 });
H(156.53, 'bullet_train', 'SPEED', 'CAPABILITY OUTRUNNING UNDERSTANDING', { sub: ['clock_blur'] });
H(157.40, 'single_hand_globe', 'POWER', 'GATHERING IN VERY FEW HANDS', { sub: ['tower_shadow'] });
H(158.28, 'biolab', 'MISUSE', 'BIOLOGY · CYBER · PERSUASION', { sub: ['keyboard_dark'] });
H(159.22, 'black_box', 'CONTROL', 'OVER MINDS WE CANNOT FULLY INSPECT', { sub: ['wires_macro'] });
S(160.03, 'c:server_infinity', { hit: 0.6 });
S(160.63, 'c:server_infinity', { from: 1.6, hit: 0.8, flash: 'r' });
S(161.05, 'c:server_infinity', { from: 3.0, hit: 0.6 });
H(161.93, '#k', 'NOBODY', null);
H(162.25, '#k', 'NOBODY\nKNOWS', null);
H(162.78, '#k', 'NOBODY\nKNOWS\nHOW THIS', null);
H(163.10, '#k', 'NOBODY\nKNOWS\nHOW THIS', null);
H(163.82, '#r', 'NOBODY\nKNOWS\nHOW THIS\nENDS', null, { ink: 'k', boom: 1 });

// ============ STANZA 8 · something different · in colour, together ============
const C = { colour: 1, noHud: 1 };
H(164.99, 'lab_cure', 'CURES', 'FOR DISEASES THAT HAVE BEATEN US FOR CENTURIES', { ...C, sub: ['hospital_window'], boom: 2 });
H(165.94, 'fusion_sun', 'ENERGY', 'CLEAN, AND ENOUGH FOR EVERYONE', { ...C, sub: ['solar_field'] });
H(166.82, 'child_tablet', 'A TEACHER', 'FOR EVERY CHILD ON EARTH', { ...C, sub: ['village_school'] });
H(167.69, 'telescope_dome', 'DISCOVERY', 'A CENTURY OF SCIENCE IN A DECADE', { ...C, sub: ['microscope_eye'] });
B(168.38, 170.11, ['seedling_hands', 'rocket_dawn', 'bridge_builders', 'kids_running', 'orchestra'], { ...C, hit: 0.5 });
H(170.11, 'earthrise', null, null, { ...C, move: 'push' });
H(170.98, 'newborn_hand', null, null, { ...C });
H(171.84, 'grandmother', null, null, { ...C });
H(172.68, 'welder', null, null, { ...C });
B(173.07, 175.23, ['face_farmer', 'face_nurse', 'face_student', 'face_coder', 'face_fisher', 'face_elder', 'face_child', 'face_builder', 'face_dancer', 'face_monk'], { ...C, hit: 0.4 });
H(175.23, 'feet_sneakers', 'YOURS', null, { ...C });
H(176.11, 'feet_workboots', 'MINE', null, { ...C });
H(177.01, 'feet_child', 'THEIRS', null, { ...C });
H(177.91, 'feet_robot_human', 'OURS', null, { ...C });
S(178.80, 'c:crowd_walk', { ...C, hit: 0.6 });
S(179.54, 'c:crowd_walk', { ...C, from: 1.6, hit: 0.8, flash: 'w' });
S(179.95, 'c:crowd_walk', { ...C, from: 3.0, hit: 0.6 });
H(180.80, 'c:crowd_sunrise', 'NO', null, { ...C, noHud: 1 });
H(181.15, 'c:crowd_sunrise', 'NO ONE', null, { ...C, noHud: 1, from: 0.35 });
H(181.68, 'c:crowd_sunrise', 'NO ONE\nSITS', null, { ...C, noHud: 1, from: 0.88 });
H(181.98, 'c:crowd_sunrise', 'NO ONE\nSITS THIS', null, { ...C, noHud: 1, from: 1.18 });
H(183.27, 'c:crowd_sunrise', 'NO ONE\nSITS THIS\n^OUT', null, { ...C, noHud: 1, from: 2.47 });
H(184.30, 'sunrise_wide', 'WE’RE ALL\nIN THIS\n^TOGETHER', '“BOOTS” · RUDYARD KIPLING, 1903 · RECITED BY TAYLOR HOLMES, 1915', { ...C, noHud: 1, move: 'push', flash: 'w', scrim: 0.3, smallSize: 30, boom: 2 });

// ---------- resolve: sort, expand subs, carry dates forward, frame-quantise ----------
SHOTS.sort((a, b) => a.t - b.t);
for (let i = SHOTS.length - 1; i >= 0; i--) {
  const s = SHOTS[i];
  if (!s.sub) continue;
  const end = SHOTS[i + 1] ? SHOTS[i + 1].t : s.t + 1, n = s.sub.length, start = s.t + (end - s.t) * 0.62;
  const extra = s.sub.map((id, k) => ({ t: start + (end - start) * k / n, id, hit: 0.35, colour: s.colour }));
  SHOTS.splice(i + 1, 0, ...extra);
}
const END = END_SRC - T0;
let d = null, date = null;
SHOTS.forEach((s, i) => {
  if (s.d != null) d = s.d; else s.d = d;
  if (s.date != null) date = s.date; else if (s.d != null && s.d <= NOW) s.date = date;
  s.i = i; s.f = Math.round(s.t * 30);
  s.end = SHOTS[i + 1] ? SHOTS[i + 1].t : END;
});
Object.assign(window, { SHOTS, END, NOW, T0 });
})();
