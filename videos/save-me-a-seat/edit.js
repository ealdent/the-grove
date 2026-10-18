// edit.js: the whole song, shot by shot. The pilot's scenes (scenes.js) run to 0:30; the rest follow.
'use strict';
SCENES.splice(SCENES.length - 1, 1, ...(window.MORE || []));
SCENES.sort((a, b) => a.t - b.t);
window.END = DATA.dur;
