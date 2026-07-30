import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import Stats from 'three/addons/libs/stats.module.js';
// N8AO — screen-space ambient occlusion. It renders the beauty pass itself, so it
// stands in for RenderPass rather than following one.
import { N8AOPass } from 'n8ao';
// The vine border on the to-do dialogs. Its own WebGL context on its own canvas,
// created lazily the first time a dialog opens.
import { VineFrame } from './ui-vines.js';

THREE.Cache.enabled = true;

let camera, scene, renderer, controls;
let raycaster, mouse;
let composer; // post-processing composer
let aoPass;   // N8AO — renders the beauty pass and multiplies in ambient occlusion
let sharedLeafMat; // shared leaf material across plants
const textureLoader = new THREE.TextureLoader();
const sharedAssets = {}; // shared textures / materials

// Sun + lighting (updated each tick)
let sky, sunLight, skyFill, warmFill;
let moonLight;   // pale blue directional at the real lunar position
let pmremGen, envScene, envSky, envRT; // sky-driven IBL, refreshed with the sun
let envGroundMat; // lower hemisphere of the IBL scene — dimmed after dark
const bulbLights = []; // PointLights standing in for the lamp bulbs
const bulbMeshes = []; // bulb glass meshes for emissive control
const SUN_LOCATION = { lat: 40.7128, lng: -74.0060 }; // NYC — Eastern Time
let lastSunUpdate = 0;

// Hooded pendant lamps. `lampSlots` is the fixed list of fixture positions;
// `bulbLights` is a pool of point lights that gets *reassigned* to those slots
// every so often by distance to the camera, so the few shadow-casting lights are
// always the ones you are standing under. See assignLampLights().
const lampSlots = [];        // { pos: Vector3, flicker: bool }
let lampShadowCount = 0;     // how many of bulbLights[] cast shadows (3–4)
// Filament state. The lamps do not snap on: `on` flips with hysteresis around
// +2°/+3.5° solar elevation and `level` chases it over a few seconds, which is
// what a cold tungsten filament actually does.
const lampState = { on: false, level: 0, flicker: 1 };
const LAMP_ON_ELEV = 2.0;    // degrees — switch on below this
const LAMP_OFF_ELEV = 3.5;   // degrees — switch off above this (hysteresis gap)
const LAMP_WARMUP = 3.4;     // seconds from cold to full
const LAMP_COOLDOWN = 1.6;   // seconds to fade back out

// Debug clock. updateSunAndLighting reads this instead of the wall clock when it
// is set, which is the only practical way to screenshot noon, dusk and midnight
// in one sitting. Driven from window.greenhouseDebug — see setupDebugHooks().
let sunClockOverride = null;
const sunClockNow = () => (sunClockOverride ? new Date(sunClockOverride) : new Date());

// Last computed sky state, for the diagnostics overlay.
const skyState = { altDeg: 0, twilight: 0, moonAltDeg: 0, moonPhase: 0 };

// Instanced empty pots — one InstancedMesh per pot piece, hidden per-slot when planted
let emptyPotInstances = null;
const emptyPotOccupied = [];

// Forest + atmosphere
const treeMaterials = [];    // tree/foliage materials with onBeforeCompile-injected wind
const shaftMeshes = [];      // additive light-shaft cones below each lamp (night only)
let sunShafts = null;        // volumetric sun beams through the roof glass (day only)
const sunDir = new THREE.Vector3(0, 1, 0); // unit vector from origin toward the sun
let currentDayness = 1;      // 1 = full day, 0 = full night (set by updateSunAndLighting)
const eyePairs = [];         // glowing-red eye pair state machines

// Particles & weather (built in buildParticles / buildForestAtmosphere)
let dripSystem = null;       // falling water drops inside the greenhouse
const ripplePool = [];       // expanding rings where drips land
let dustSystem = null;       // floating dust motes / pollen
let fireflySystem = null;    // night fireflies out in the forest
const mistSprites = [];      // drifting ground-fog sprites outside
const GREENHOUSE_BOUNDS = { xMin: -8, xMax: 8, zMin: -45, zMax: 5 };
const _WHITE = new THREE.Color(0xffffff); // scratch constant for colour lerps
// Roof plane geometry, filled in by buildGreenhouse() from the same locals it
// uses to place the panes. buildSunShafts() needs it to work out where a sunbeam
// enters the glass, and reading it from here keeps the two from drifting apart.
const roofShape = { wallTopY: 0, ridgeY: 0, halfWidth: 0, zMin: 0, zMax: 0 };

// FPS / stats overlay (toggled with F)
let stats = null;
let diagPanel = null;
let diagLastUpdate = 0;
// Getting back into pointer lock after an Escape keypress. Chrome refuses
// requestPointerLock for ~1.25 s after Escape, and — worse — sometimes grants it
// and then immediately releases it again, which fires 'unlock' and used to put the
// pause overlay up. So resuming is a short campaign rather than a single call:
// `resumeUntil` is a deadline, during which the pause overlay stays suppressed and
// the lock is retried; if the deadline passes without success the overlay comes up
// so the player has something to click rather than being stranded unlocked.
let resumeUntil = 0;
let resumeTimer = 0;
// When Escape was last pressed. Chrome refuses requestPointerLock for ~1.25 s
// afterwards, and PointerLockControls logs an error on every refusal — so rather
// than hammering it and filling the console, we simply don't ask until the
// cooldown has passed.
let lastEscapeAt = -Infinity;
const ESCAPE_COOLDOWN = 1350;

// True while either to-do dialog is on screen.
function anyModalOpen() {
    return todoModal.style.display !== 'none' || addTodoModal.style.display !== 'none';
}

// Does this element take typed text? Used to keep world hotkeys out of the way:
// typing "Fix the shed" should not toggle the FPS overlay on the f and walk the
// player forward on the w.
function isTextEntry(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const objects = []; // Interactable objects (plants)
let todos = []; // Data for todos

// Time tracking
let simulatedTimeOffset = 0; // Fast forward offset in ms

// Local Storage keys
const STORAGE_KEY = 'greenhouse-todos-data';

// Touch device detection (coarse pointer = primary input is touch)
const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
// Read once and honoured by every attention cue. Someone who has asked the OS to
// stop animations has not asked for a plant to start shaking at them.
const prefersReducedMotion = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let mobileActive = false; // True when exploring on a touch device

function saveTodosToLocal() {
    // Only save the data, not the THREE.js meshes
    const dataToSave = todos.map(t => {
        const { mesh, ...rest } = t;
        return rest;
    });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            todos: dataToSave,
            simulatedTimeOffset: simulatedTimeOffset
        }));
    } catch (e) {
        console.error('Failed to save todos', e);
    }
}

function loadTodosFromLocal() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            todos = data.todos || [];
            simulatedTimeOffset = data.simulatedTimeOffset || 0;

            // Rebuild plants for each loaded todo
            todos.forEach(todo => {
                createPlant(todo, true);
            });
        } catch (e) {
            console.error("Failed to parse saved data:", e);
        }
    }
}

// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// DOM Elements
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const uiContainer = document.getElementById('ui-container');
const todoModal = document.getElementById('todo-modal');
const addTodoModal = document.getElementById('add-todo-modal');
const hoverTooltip = document.getElementById('hover-tooltip');
const closeAddModal = document.getElementById('close-add-modal');
const closeModal = document.getElementById('close-modal');
const btnCheckin = document.getElementById('btn-checkin');
const btnComplete = document.getElementById('btn-complete');
const mobileControls = document.getElementById('mobile-controls');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const lookZone = document.getElementById('look-zone');
const menuBtn = document.getElementById('mobile-menu-btn');

// Modal Elements
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalHealth = document.getElementById('modal-health');
const modalHealthLabel = document.getElementById('modal-health-label');
const modalUrgency = document.getElementById('modal-urgency');
const modalTended = document.getElementById('modal-tended');
const modalDecay = document.getElementById('modal-decay');
const modalMeter = document.getElementById('modal-meter');
const modalMeterFill = document.getElementById('modal-meter-fill');
const modalMeterGhost = document.getElementById('modal-meter-ghost');
const statusChips = document.getElementById('status-chips');
const checkinPreview = document.getElementById('checkin-preview');
const ghToast = document.getElementById('gh-toast');

// Form Elements
const addTodoForm = document.getElementById('add-todo-form');
const todoTitle = document.getElementById('todo-title');
const todoDesc = document.getElementById('todo-desc');
const titleCount = document.getElementById('title-count');
const descCount = document.getElementById('desc-count');
const titleError = document.getElementById('title-error');
const btnPlant = document.getElementById('btn-plant');

// What each urgency level actually means. This lived only in the decay function
// before, which is why the old urgency dropdown could not explain itself.
const URGENCY = {
    1: { name: 'Patient', halfLifeDays: 4 },
    2: { name: 'Steady', halfLifeDays: 2 },
    3: { name: 'Thirsty', halfLifeDays: 1 }
};

// Health bands. Named, because "62%" tells you a number and "Wilting" tells you
// what to do about it.
const HEALTH_BANDS = [
    { min: 85, label: 'Thriving', cls: '' },
    { min: 60, label: 'Healthy', cls: '' },
    { min: 35, label: 'Wilting', cls: 'is-wilting' },
    { min: 15, label: 'Struggling', cls: 'is-wilting' },
    { min: -1, label: 'Nearly gone', cls: 'is-dying' }
];

function healthBand(health) {
    return HEALTH_BANDS.find(b => health >= b.min) || HEALTH_BANDS[HEALTH_BANDS.length - 1];
}

// Coarse relative time. Deliberately vague at the long end — "6 days ago" is
// actionable, "5 days 14 hours ago" is noise.
function relativeTime(then) {
    const ms = getCurrentSimulatedTime() - then;
    if (!Number.isFinite(ms) || ms < 0) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}

let toastTimer = 0;
function showToast(message) {
    if (!ghToast) return;
    ghToast.textContent = message;
    ghToast.classList.add('is-up');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ghToast.classList.remove('is-up'), 2600);
}

// --- Dialog focus management ---
//
// A modal dialog has to keep the keyboard inside itself, or Tab walks out into
// the page behind and the user is typing into something they cannot see. Focus is
// also restored to nothing in particular on close, because the element that
// opened these dialogs is the 3D canvas.
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';
let trapPanel = null;

function focusablesIn(panel) {
    return Array.from(panel.querySelectorAll(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el.getClientRects().length);
}

function onTrapKeydown(event) {
    if (event.key !== 'Tab' || !trapPanel) return;
    const items = focusablesIn(trapPanel);
    if (!items.length) return;
    // A radio group is one tab stop, not four: Tab should land on whichever
    // option is checked and then leave the group entirely.
    const stops = items.filter(el => el.type !== 'radio' || el.checked
        || !items.some(o => o.type === 'radio' && o.name === el.name && o.checked));
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !trapPanel.contains(active))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

function trapFocus(panel, initial) {
    trapPanel = panel;
    document.addEventListener('keydown', onTrapKeydown, true);
    // Deferred a frame: the panel is display:flex'd in the same tick, and focus()
    // on an element whose ancestor is still display:none is a no-op.
    requestAnimationFrame(() => {
        const target = initial || focusablesIn(panel)[0];
        if (target) target.focus();
    });
}

function releaseFocus() {
    document.removeEventListener('keydown', onTrapKeydown, true);
    trapPanel = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// Vine borders, built on first open so a session that never touches a to-do never
// pays for a second GL context.
const vineFrames = new WeakMap();
function vinesFor(scrim) {
    if (!scrim) return null;
    const panel = scrim.querySelector('.gh-panel');
    if (!panel) return null;
    if (!vineFrames.has(panel)) vineFrames.set(panel, new VineFrame(panel));
    return vineFrames.get(panel);
}

function setupScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc8dfee, 0.005); // soft humid haze
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2000);
    camera.position.y = 1.6;
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setClearColor(0x05070a, 1); // night-friendly background when sky mesh is hidden
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
}

function setupLighting() {
    // 4. Image-based lighting from the actual sky — reflections and ambient
    // color match the outdoors instead of a studio room (whose discrete light
    // panels showed up as fake white blobs in the wet floor and glossy petals).
    pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();
    envScene = new THREE.Scene();
    envSky = new Sky();
    envSky.scale.setScalar(100);
    envSky.material.uniforms.mieCoefficient.value = 0.005;
    envSky.material.uniforms.mieDirectionalG.value = 0.85;
    envScene.add(envSky);
    // Dark mossy ground fills the lower hemisphere so floors/undersides aren't
    // lit sky-blue from below.
    const envGround = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshBasicMaterial({ color: 0x1a2018 })
    );
    envGround.rotation.x = -Math.PI / 2;
    envGround.position.y = -1;
    envScene.add(envGround);
    envGroundMat = envGround.material;

    // 5. Sky shader for outdoor backdrop
    sky = new Sky();
    sky.scale.setScalar(1500);
    sky.material.uniforms.mieCoefficient.value = 0.005;
    sky.material.uniforms.mieDirectionalG.value = 0.85;
    // Everything celestial is ordered explicitly rather than by distance. Three
    // sorts the opaque list by the object's origin, and the Sky box and the star
    // dome are both centred on the viewer, so their sort keys are both ~0 and the
    // order between them would be arbitrary. Drawing them first, with depthWrite
    // off, makes them a true background: the forest and the greenhouse paint over
    // them afterwards, which is also what gives correct occlusion.
    sky.renderOrder = -3;
    scene.add(sky);

    // 6. Lighting — sun (directional) + soft fill from sky
    sunLight = new THREE.DirectionalLight(0xfff0d6, 0); // intensity set by updateSunAndLighting
    sunLight.castShadow = true;
    // 2048 on a pointer device: the thing the sun shadow has to draw is the
    // window frame — mullions 4 cm wide thrown 8 m across the floor — and at
    // 1024 over a 50 m frustum a mullion is under a texel wide and dissolves.
    const sunShadowRes = isTouchDevice ? 1024 : 2048;
    sunLight.shadow.mapSize.set(sunShadowRes, sunShadowRes);
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -55;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.04;
    // Hard-edged. The sun subtends half a degree; a bar of window frame two
    // metres up casts an edge only ~2 cm soft, which at this scale is a crisp
    // line. The old radius of 4 was blurring the frame pattern into a smear.
    sunLight.shadow.radius = 1;
    // Every shadow in this scene is re-rendered on demand rather than every
    // frame. Nothing that casts one ever moves: the house, the benches and the
    // pots are static, and the only animated things — moths, dust, the swaying
    // vine, the drips — all have castShadow off. So a shadow map only has to be
    // rebuilt when the sun or moon moves (the 30 s tick), when a lamp light is
    // reassigned to a different fixture, or when a plant is added or removed.
    // Left on autoUpdate this scene renders 25 shadow passes per frame for
    // results identical to the last one.
    sunLight.shadow.autoUpdate = false;
    scene.add(sunLight);

    // Moonlight. A real directional light at the real lunar position, scaled by
    // the illuminated fraction — a waxing crescent barely registers, a full moon
    // throws a legible pattern of frame shadows across the floor. Deliberately
    // its own light rather than a re-coloured sun: the two are up together for
    // hours, they come from different directions, and this one wants soft edges
    // (the moon is as wide as the sun but a thousand times dimmer, so what you
    // actually see of a moon shadow is its penumbra).
    moonLight = new THREE.DirectionalLight(0xbcd0f2, 0);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = -25;
    moonLight.shadow.camera.right = 25;
    moonLight.shadow.camera.top = 15;
    moonLight.shadow.camera.bottom = -55;
    moonLight.shadow.camera.near = 1;
    moonLight.shadow.camera.far = 120;
    moonLight.shadow.bias = -0.0008;
    moonLight.shadow.normalBias = 0.06;
    moonLight.shadow.radius = 7;
    moonLight.shadow.autoUpdate = false;
    moonLight.visible = false;
    scene.add(moonLight);

    skyFill = new THREE.HemisphereLight(0xb6dbff, 0x4a3a2a, 0);
    scene.add(skyFill);

    // Warm interior fill — mimics light bouncing off the wood and floor
    warmFill = new THREE.PointLight(0xffd9a0, 0, 30, 1.6);
    warmFill.position.set(0, 3.5, -20);
    scene.add(warmFill);
}

function setupControls() {
    // 5. Controls
    controls = new PointerLockControls(camera, document.body);

    instructions.addEventListener('click', startExploring);
    // Click anywhere on the pause overlay → resume.
    uiContainer.addEventListener('click', startExploring);

    controls.addEventListener('lock', function () {
        // Deliberately does NOT cancel the resume window. If it did, a lock that
        // Chrome immediately takes back would fall straight through to the unlock
        // handler below and raise the pause screen — the exact bug this replaced.
        // attemptLock stops itself once the window expires.
        blocker.style.display = 'none';
        uiContainer.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        // Mid-resume, an unlock means "Chrome took it back", not "the player wants
        // to pause". Say nothing and let attemptLock have another go.
        if (performance.now() < resumeUntil) return;
        if (anyModalOpen()) return;
        uiContainer.style.display = 'flex';
        blocker.style.display = 'none';
    });

    scene.add(controls.getObject());

    // 6. Movement Event Listeners
    const onKeyDown = function (event) {
        // World hotkeys are inert while a dialog is up or a field has focus.
        // Without this, naming a to-do "Fix the shed" toggles the FPS overlay on
        // the f and walks the player forward on the w, and the arrow keys move the
        // player instead of the caret. Escape is handled by its own listener below,
        // so it still gets through.
        if (anyModalOpen() || isTextEntry(event.target)) return;
        // A modifier means the key belongs to the browser or the OS, not to us.
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'KeyF': {
                // Toggle the stats.js FPS graph and our diagnostics panel together.
                const currentlyShown = stats && stats.dom.style.display !== 'none';
                const next = currentlyShown ? 'none' : 'block';
                if (stats) stats.dom.style.display = next;
                if (diagPanel) diagPanel.style.display = next;
                break;
            }
        }
    };

    // Deliberately NOT guarded the way onKeyDown is. This only ever clears
    // movement flags, and a "stop moving" event must never be swallowed — hold W,
    // open a dialog, release W, and a guarded keyup would leave the player walking
    // into a wall forever once the dialog closed.
    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Global Escape behaviour:
    //   - If a dialog is open, close it and go straight back to walking. Escape on
    //     a to-do means "I'm done here", not "pause the game" — anything already
    //     changed stays changed.
    //   - If pointer-lock is engaged (walking), let the browser release it; the
    //     'unlock' event shows the pause overlay.
    //   - If pause overlay or home blocker is showing, resume walking.
    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Escape') return;
        // Note it before anything else reacts: everything downstream that wants
        // pointer lock back has to wait out Chrome's cooldown from this moment.
        lastEscapeAt = performance.now();
        if (todoModal.style.display !== 'none') {
            closeTodoModal();
            return;
        }
        if (addTodoModal.style.display !== 'none') {
            closeAddTodoModal();
            return;
        }
        if (controls.isLocked) return; // browser will release lock and unlock fires
        // Otherwise we're on the pause overlay or home blocker — resume.
        startExploring();
    });

    // 7. Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(0, 0); // Always center for crosshair

    // Refusals need no handling of their own — attemptLock is already on a timer
    // and keeps trying until its deadline. (PointerLockControls registers its own
    // 'pointerlockerror' listener in its constructor, before this one, so its
    // console.error cannot be suppressed from here. Not asking during the cooldown
    // is what actually keeps the console quiet; see attemptLock.)
}

function setupDiagnostics() {
    // 7b. FPS / stats overlay (hidden by default; F toggles)
    stats = new Stats();
    stats.dom.style.position = 'fixed';
    stats.dom.style.top = 'auto';
    stats.dom.style.bottom = '0px';
    stats.dom.style.left = '0px';
    stats.dom.style.zIndex = '100';
    stats.dom.style.display = 'none';
    document.body.appendChild(stats.dom);

    // Detailed diagnostics panel — text stats updated ~4×/sec
    diagPanel = document.createElement('div');
    diagPanel.id = 'diag-panel';
    diagPanel.style.cssText = [
        'position: fixed',
        'left: 0',
        'bottom: 52px',
        'padding: 10px 14px',
        "font-family: 'Menlo', 'Consolas', monospace",
        'font-size: 11px',
        'line-height: 1.5',
        'color: #c4dcc8',
        'background: rgba(8, 14, 10, 0.78)',
        'border: 1px solid rgba(120, 180, 130, 0.25)',
        'border-radius: 0 4px 0 0',
        'z-index: 100',
        'pointer-events: none',
        'display: none',
        'white-space: pre',
        'letter-spacing: 0.02em',
        'min-width: 220px'
    ].join('; ');
    document.body.appendChild(diagPanel);
}

// Everything in this scene is driven by the real position of the sun, which makes
// it awkward to look at: you cannot see dusk at eleven in the morning. This
// exposes a settable clock plus a couple of read-backs, which is also how the
// day/twilight/night screenshots in the commit history were taken.
function setupDebugHooks() {
    window.greenhouseDebug = {
        // Pass an ISO string / Date / ms to freeze the astro clock there, or null
        // to hand it back to the wall clock. Snaps the lamps to their steady
        // state so a screenshot isn't caught mid warm-up.
        setSunTime(when) {
            sunClockOverride = when === null || when === undefined ? null : new Date(when).getTime();
            updateSunAndLighting();
            lampState.level = lampState.on ? 1 : 0;
            updateLamps(performance.now(), 0);
            return this.state();
        },
        // Warm the lamps from cold, to watch the filament ramp.
        restartLamps() {
            lampState.level = 0;
            return this.state();
        },
        // Drive the filament ramp by hand, in `dt`-second steps. The ramp is the
        // one thing here that is a function of elapsed real time, and headless
        // Chrome under a virtual-time budget hands requestAnimationFrame a delta
        // of zero — so without this the warm-up cannot be observed at all outside
        // an interactive browser. Returns one row per step.
        advanceLamps(dt = 0.25, steps = 20) {
            const rows = [];
            let clock = performance.now();
            for (let i = 0; i < steps; i++) {
                clock += dt * 1000;
                updateLamps(clock, dt);
                rows.push({
                    t: +(i * dt).toFixed(2),
                    level: +lampState.level.toFixed(3),
                    intensity: +bulbLights[0].intensity.toFixed(3),
                    color: '#' + bulbLights[0].color.getHexString(),
                    flicker: +lampState.flicker.toFixed(3),
                    flickerLamp: lampState.flickerLight,
                    flickerIntensity: lampState.flickerLight >= 0
                        ? +bulbLights[lampState.flickerLight].intensity.toFixed(3) : null
                });
            }
            return rows;
        },
        // Open either dialog without having to aim and click, which is not
        // something a headless browser can do. Also the only way to inspect the
        // tend dialog for a to-do in a specific state.
        openAdd(slot = -1) {
            activePotIndex = slot >= 0 ? slot : nearestFreeSlot();
            openAddTodoModal();
            return { slot: activePotIndex };
        },
        openTend(id) {
            const todo = id === undefined
                ? todos.find(t => !t.completed)
                : todos.find(t => t.id === id);
            if (!todo) return { error: 'no such to-do' };
            openTodoModal(todo);
            return { id: todo.id, health: Math.round(todo.health) };
        },
        // Force a to-do's health so the wilting cues can be inspected without
        // waiting days for the decay to get there.
        setHealth(id, health) {
            const todo = todos.find(t => t.id === id);
            if (!todo) return { error: 'no such to-do' };
            todo.health = health;
            todo.healthAtLastUpdate = health;
            todo.lastUpdated = getCurrentSimulatedTime();
            suppressedAttention.delete(id);
            updatePlantVisual(todo);
            return { id, health };
        },
        // Drive the attention cues by hand. Same reason as advanceLamps: both the
        // idle hint's fade and the rattle envelope are integrated over elapsed
        // time, and headless Chrome under a virtual-time budget hands
        // requestAnimationFrame a delta of zero, so neither one ever advances.
        // Returns one row per step rather than just the end state: the rattle is a
        // burst with a decaying envelope, so sampling only after the fact reliably
        // catches it at zero and reports "no rattle".
        advanceCues(dt = 0.1, steps = 20) {
            const rows = [];
            // Same refresh as edgeOf: the rattle reads screen-space position, and a
            // caller who moves the camera and steps immediately would otherwise be
            // measuring against the previous frame's projection.
            camera.updateMatrixWorld(true);
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
            let clock = performance.now();
            for (let i = 0; i < steps; i++) {
                clock += dt * 1000;
                updatePlantHint(clock, dt);
                updateAttention(clock, dt);
                const shaking = attentionRanked.find(e => e.todo.id === rattleState.id);
                rows.push({
                    t: +(i * dt).toFixed(2),
                    hint: plantHint ? +plantHint.level.toFixed(3) : null,
                    hintSlot: plantHint ? plantHint.slot : null,
                    rattleId: rattleState.id,
                    // The rattling plant's OWN screen position — the amplitude is
                    // scaled by this, so reporting any other plant's is useless.
                    rattleEdge: shaking ? +edgeProminence(shaking.todo.mesh).toFixed(3) : null,
                    stemZ: shaking
                        ? +(shaking.todo.mesh.getObjectByName('stem')?.rotation.z ?? 0).toFixed(4)
                        : 0
                });
            }
            return rows;
        },
        // Pretend the player is walking around. Pointer lock cannot be acquired in
        // a headless browser, and the idle hint deliberately only shows while
        // exploring — so without this it can never be observed.
        setExploring(on = true) {
            controls.isLocked = !!on;
            return { isLocked: controls.isLocked };
        },
        // Movement flags, for checking that a keystroke meant for a text field did
        // not also walk the player forward.
        movement() {
            return { fwd: moveForward, back: moveBackward, left: moveLeft, right: moveRight };
        },
        // Where an object sits in the frame, 0 dead centre and 1 in the periphery.
        // The rattle amplitude is scaled by this, so it is the thing to verify.
        // The camera matrices are refreshed first: normally the renderer does that
        // once a frame, but a caller who moves the camera and measures immediately
        // would otherwise read the previous frame's projection.
        edgeOf(id) {
            camera.updateMatrixWorld(true);
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
            const todo = todos.find(t => t.id === id);
            return todo && todo.mesh ? +edgeProminence(todo.mesh).toFixed(3) : null;
        },
        // Clear the rattle cooldown so a burst starts on the next step. Without it
        // the wait between bursts is up to 5 s, which a short trace just misses.
        armRattle() {
            rattleState.id = null;
            rattleState.next = 0;
            return true;
        },
        // Vine border state, and a way to hold the grow-in animation at a given
        // point. The reveal takes about a second, which a capture at the end of a
        // headless run has always missed — and "the vines didn't appear" is
        // otherwise a hard thing to tell apart from a CSS stacking problem.
        vines(pin) {
            const report = [];
            for (const scrim of [addTodoModal, todoModal]) {
                const panel = scrim.querySelector('.gh-panel');
                const frame = panel && vineFrames.get(panel);
                if (!frame) { report.push({ dialog: scrim.id, built: false }); continue; }
                if (pin !== undefined) frame.pin(pin);
                report.push({
                    dialog: scrim.id, built: true, glOk: frame.ok,
                    reveal: +frame.reveal.toFixed(3),
                    canvas: [frame.canvas.width, frame.canvas.height],
                    overflowPx: frame.overflow,
                    running: !!frame.raf,
                    reducedMotion: frame.reduced
                });
            }
            return report;
        },
        // What the attention system currently thinks, for verifying the cues.
        attention() {
            return {
                idleMs: Math.round(performance.now() - lastTaskActivity),
                hint: plantHint
                    ? { slot: plantHint.slot, level: +plantHint.level.toFixed(3),
                        visible: plantHint.group.visible,
                        at: plantHint.group.position.toArray().map(v => +v.toFixed(2)) }
                    : null,
                ranked: attentionRanked.map(e => ({
                    id: e.todo.id,
                    title: e.todo.title,
                    health: Math.round(e.todo.health),
                    stale: +e.stale.toFixed(3),
                    edge: +edgeProminence(e.todo.mesh).toFixed(3),
                    rattling: e.todo.id === rattleState.id,
                    stemZ: +(e.todo.mesh.getObjectByName('stem')?.rotation.z ?? 0).toFixed(4)
                })),
                halosVisible: attentionPool.filter(h => h.visible).length
            };
        },
        // Live handles. Worth exposing: "which mesh is that pale blob on the
        // floor" is otherwise unanswerable without rebuilding the page, and
        // toggling a candidate's visibility answers it in one render.
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get controls() { return controls; },
        // The AO pass answers "is that mottling occlusion or geometry" in one
        // toggle: aoPass.configuration.intensity = 0 and re-render.
        get aoPass() { return aoPass; },
        // Is a resume campaign in flight? Nothing else can tell you whether an
        // unlock is about to raise the pause screen or be swallowed and retried.
        get resuming() { return performance.now() < resumeUntil; },
        get lights() { return { sunLight, moonLight, skyFill, warmFill, bulbLights }; },
        state() {
            return {
                sunAltDeg: +skyState.altDeg.toFixed(2),
                dayness: +currentDayness.toFixed(3),
                twilight: +skyState.twilight.toFixed(3),
                moonAltDeg: +skyState.moonAltDeg.toFixed(2),
                moonPhase: +skyState.moonPhase.toFixed(3),
                moonIntensity: moonLight ? +moonLight.intensity.toFixed(3) : null,
                moonShadow: moonLight ? moonLight.castShadow && moonLight.visible : null,
                sunIntensity: sunLight ? +sunLight.intensity.toFixed(3) : null,
                lampsOn: lampState.on,
                lampLevel: +lampState.level.toFixed(3),
                lampShadowCasters: lampShadowCount,
                exposure: +renderer.toneMappingExposure.toFixed(3),
                fogDensity: scene.fog ? +scene.fog.density.toFixed(5) : null,
                drawCalls: renderer.info.render.calls,
                programs: renderer.info.programs ? renderer.info.programs.length : null
            };
        }
    };
}

function setupPostProcessing() {
    // 10. Post-processing — ambient occlusion, then bloom for soft highlights
    // through the glass. EffectComposer.addPass() calls setSize() itself, so the
    // passes pick up the pixel ratio set here.
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.setSize(window.innerWidth, window.innerHeight);

    // N8AO renders the scene into its own beauty buffer and multiplies the
    // result by the occlusion it derives from that buffer's depth, so it takes
    // the place of RenderPass instead of following one.
    aoPass = new N8AOPass(scene, camera, window.innerWidth, window.innerHeight);
    // Radius is in world units, and this is an interior: what we want is contact
    // shadow where a pot meets a bench, under table tops, in the corners of the
    // wooden bases — not a metre-scale wash.
    aoPass.configuration.aoRadius = 0.9;
    aoPass.configuration.distanceFalloff = 0.8;
    aoPass.configuration.intensity = 3.0;
    aoPass.configuration.aoSamples = 16;
    aoPass.configuration.denoiseSamples = 8;
    aoPass.configuration.denoiseRadius = 12;
    // Occlusion tinted toward damp green-black rather than neutral grey — it
    // reads as shade under leaves instead of dirt on the lens.
    aoPass.configuration.color = new THREE.Color(0x0b1712);
    // OutputPass at the end of the chain owns tone mapping and the sRGB
    // conversion; N8AO must hand its result on in linear space or the bloom
    // threshold and the tone curve both get applied to already-encoded colour.
    aoPass.configuration.gammaCorrection = false;
    // Transparency-aware mode costs two extra renders per frame, but they draw
    // only the transparent objects, and it earns its keep here: without it the
    // AO is multiplied over the whole composited frame, so the forest's own
    // occlusion — every crevice in the canopy, every trunk against the sky —
    // stamps itself across the lamps' haze cones as a ghostly negative of the
    // trees. (This used to be off on the grounds that the transparent things
    // were all small and dim; the haze cones are neither.) With it on, n8ao
    // renders the transparent surfaces' accumulated alpha to a side buffer and
    // masks the AO by it, so a beam at 60% density suppresses 60% of the tree
    // AO behind it — and the glass panes (alpha 1) mask the outdoors entirely,
    // which is fine: outdoors, the sun and moon shadow maps do the real work.
    // Setting transparencyAware explicitly also clears autoDetectTransparency,
    // but keep the intent legible and pinned:
    aoPass.autoDetectTransparency = false;
    aoPass.configuration.transparencyAware = true;
    composer.addPass(aoPass);

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.10, // strength — gentle bloom so it doesn't fake ambient brightness
        0.55, // radius
        0.97  // threshold (only true highlights bloom)
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
}

function init() {
    // 1. Scene
    setupScene();

    // 2. Camera
    setupCamera();

    // 3. Renderer (PBR pipeline)
    setupRenderer();

    // 4. Lighting
    setupLighting();

    // 5. Controls
    setupControls();

    // 6. Diagnostics
    setupDiagnostics();

    // 8. Build Greenhouse Environment
    buildGreenhouse();

    // 8b. Haunted forest, atmosphere + glowing eyes
    buildHauntedForest();
    buildForestAtmosphere();
    buildHauntedEyes();
    buildFarForestLight();

    // 8c. Wet, messy, overgrown interior
    buildPuddles();
    buildVinesAndIvy();
    buildSwayingVine();
    buildClutter();
    buildGreenhouseParticles();
    buildGroundFog();
    buildPaneCondensation();

    // 8d. Sun shafts through the roof glass (needs roofShape from buildGreenhouse)
    buildSunShafts();

    // 8e. Stars + moon, so the roof isn't a black void after dark
    buildNightSky();

    // 8f. Attention cues — the idle nudge toward an empty pot, and the haloes
    // that wilting plants wear.
    buildPlantHint();
    buildAttentionHalos();
    lastTaskActivity = performance.now();

    // 8f. Debug hooks — a settable astro clock, so any hour of the day can be
    // inspected without waiting for it.
    setupDebugHooks();

    // 9. Initial sun + lighting (uses real Eastern Time)
    updateSunAndLighting();
    // Lamps start already at their steady state rather than warming up on load —
    // walking into a dark greenhouse and waiting four seconds is not the effect.
    lampState.level = lampState.on ? 1 : 0;
    updateLamps(performance.now(), 0);

    // 10. Load Saved Data
    loadTodosFromLocal();

    // 11. Post-processing
    setupPostProcessing();

    // Window resize handler
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    // Mobile touch controls
    if (isTouchDevice) {
        document.body.classList.add('touch');
        setupTouchControls();
    }
}

// --- PBR Texture / Material Helpers ---

// Convert a heightmap canvas (grayscale brightness = height) into a normal map texture.
// Runs once per texture at startup.
function makeNormalMapFromCanvas(srcCanvas, scale = 1.0) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const out = new Uint8ClampedArray(w * h * 4);
    const heightAt = (x, y) => {
        const xi = ((x % w) + w) % w;
        const yi = ((y % h) + h) % h;
        const i = (yi * w + xi) * 4;
        return (src[i] + src[i + 1] + src[i + 2]) / (3 * 255);
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * scale;
            const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * scale;
            const nx = -dx, ny = -dy, nz = 1.0;
            const inv = 1 / Math.hypot(nx, ny, nz);
            const i = (y * w + x) * 4;
            out[i + 0] = (nx * inv * 0.5 + 0.5) * 255;
            out[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
            out[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
            out[i + 3] = 255;
        }
    }
    const normCanvas = document.createElement('canvas');
    normCanvas.width = w;
    normCanvas.height = h;
    normCanvas.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    const tex = new THREE.CanvasTexture(normCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function configureRepeat(tex, repeat, srgb) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = 8;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Tileable fractal value noise — returns a Float32Array of [0,1] values, size×size.
// Used to give organic large-scale variation to procedural textures (wet patches,
// leaf litter, bark, moss) instead of pure uniform speckle.
function makeFbmField(size, octaves = 4, baseFreq = 4) {
    const field = new Float32Array(size * size);
    let amp = 1, freq = baseFreq, totalAmp = 0;
    for (let o = 0; o < octaves; o++) {
        const grid = [];
        for (let i = 0; i < (freq + 1) * (freq + 1); i++) grid.push(Math.random());
        const gAt = (gx, gy) => grid[(gy % freq) * (freq + 1) + (gx % freq)];
        for (let y = 0; y < size; y++) {
            const fy = (y / size) * freq;
            const gy = Math.floor(fy);
            const ty = fy - gy;
            const sy = ty * ty * (3 - 2 * ty);
            for (let x = 0; x < size; x++) {
                const fx = (x / size) * freq;
                const gx = Math.floor(fx);
                const tx = fx - gx;
                const sx = tx * tx * (3 - 2 * tx);
                const v00 = gAt(gx, gy), v10 = gAt(gx + 1, gy);
                const v01 = gAt(gx, gy + 1), v11 = gAt(gx + 1, gy + 1);
                const v = (v00 * (1 - sx) + v10 * sx) * (1 - sy)
                        + (v01 * (1 - sx) + v11 * sx) * sy;
                field[y * size + x] += v * amp;
            }
        }
        totalAmp += amp;
        amp *= 0.5;
        freq *= 2;
    }
    for (let i = 0; i < field.length; i++) field[i] /= totalAmp;
    return field;
}

// Procedural weathered plank wood — replaces the pristine CDN hardwood, which
// read as a showroom floor. Four planks per tile with individual tone/grey
// wash, fBm-warped grain streaks, knots with rings, dark plank gaps, and
// matching bump + roughness maps. Generated once; cloned per material so each
// surface can carry its own UV repeat.
function getWoodTextureSet() {
    if (sharedAssets.woodSet) return sharedAssets.woodSet;
    const SIZE = 512;
    const PLANK = SIZE / 4;
    const warp = makeFbmField(SIZE, 4, 4);
    const fine = makeFbmField(SIZE, 5, 22);

    // Per-plank character: tone variation + how far it has greyed with age. The
    // spreads here are narrower than they were — planks in one bench came off
    // the same stack, and a wide per-plank tone spread read as a deliberate
    // stripe pattern rather than as timber.
    const planks = [];
    for (let p = 0; p < 4; p++) {
        planks.push({
            tone: 0.9 + Math.random() * 0.16,
            grey: 0.2 + Math.random() * 0.25,
            phase: Math.random() * Math.PI * 2,
            freq: 0.26 + Math.random() * 0.18
        });
    }
    // Where hands, pots and sleeves have rubbed the boards. A worn patch is
    // *lighter* (the grey weathered layer is gone) and *smoother* (the raised
    // grain is polished flat), which is what makes it catch a lamp. Thresholded
    // high on purpose: wear is a few patches along the front edge of a bench, and
    // at 50 % coverage the whole top goes smooth enough to mirror the sky.
    // baseFreq must be an INTEGER. makeFbmField indexes its lattice with
    // `gy % freq`, so a fractional frequency produces fractional indices, every
    // lookup is undefined, and the whole field comes back NaN — which then lands
    // in a Uint8ClampedArray as 0. The failure is silent and spectacular: a black
    // albedo and a roughness map of zero, i.e. mirror-finish benches reflecting
    // the sky as flat blue sheets.
    const wearField = makeFbmField(SIZE, 3, 3);

    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    [colorCanvas, bumpCanvas, roughCanvas].forEach(c => { c.width = c.height = SIZE; });
    const cctx = colorCanvas.getContext('2d');
    const bctx = bumpCanvas.getContext('2d');
    const rctx = roughCanvas.getContext('2d');
    const cimg = cctx.createImageData(SIZE, SIZE);
    const bimg = bctx.createImageData(SIZE, SIZE);
    const rimg = rctx.createImageData(SIZE, SIZE);

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const i = y * SIZE + x;
            const plank = planks[Math.floor(x / PLANK) % 4];
            const gx = x % PLANK;
            const isGap = gx < 2 || gx > PLANK - 2;
            // Grain: streaks running along the plank, warped by low-freq noise.
            // Half the contrast it had. Old oak seen across a room is a tone with
            // a texture in it, not a set of stripes; at the previous amplitude the
            // benches read as painted-on woodgrain wallpaper.
            const s = 0.5 + 0.5 * Math.sin((x + warp[i] * 46) * plank.freq + plank.phase);
            // Worn patches: only the upper half of each board wears, since that
            // is the face people and pots actually touch.
            const wear = Math.max(0, wearField[i] - 0.64) * 2.6;
            const lum = (0.62 + 0.11 * fine[i] + 0.1 * s + 0.1 * wear)
                      * plank.tone * (isGap ? 0.4 : 1);
            // Base oak browns desaturated toward weathered grey per plank, and
            // back *toward* the raw brown wherever it has been rubbed.
            const r0 = 128, g0 = 101, b0 = 74;
            const grey = (r0 + g0 + b0) / 3;
            const k = plank.grey * (1 - wear * 0.8);
            const px = i * 4;
            cimg.data[px + 0] = (r0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 1] = (g0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 2] = (b0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 3] = 255;
            const b = isGap ? 40 : 110 + fine[i] * 60 + s * 34 - wear * 45;
            bimg.data[px + 0] = bimg.data[px + 1] = bimg.data[px + 2] = b;
            bimg.data[px + 3] = 255;
            // Rough weathered timber, polished down where it is worn. The dip is
            // small — 0.83 to 0.65 after the material's own multiplier — because a
            // bench top is oiled timber, and anything that reaches 0.45 stops
            // being wood and starts mirroring the sky in a flat blue sheet.
            const rough = 212 + fine[i] * 30 - s * 14 - wear * 34;
            rimg.data[px + 0] = rimg.data[px + 1] = rimg.data[px + 2] = rough;
            rimg.data[px + 3] = 255;
        }
    }
    cctx.putImageData(cimg, 0, 0);
    bctx.putImageData(bimg, 0, 0);
    rctx.putImageData(rimg, 0, 0);

    // Knots: dark core with growth rings, echoed into the bump map
    for (let k = 0; k < 6; k++) {
        const kx = Math.random() * SIZE;
        const ky = Math.random() * SIZE;
        for (let ring = 5; ring >= 0; ring--) {
            const rr = 3 + ring * (2.5 + Math.random() * 2);
            cctx.strokeStyle = `rgba(38, 26, 16, ${0.5 - ring * 0.07})`;
            cctx.lineWidth = 1.6;
            cctx.beginPath();
            cctx.ellipse(kx, ky, rr, rr * 0.75, 0.3, 0, Math.PI * 2);
            cctx.stroke();
            bctx.strokeStyle = `rgba(60, 60, 60, ${0.5 - ring * 0.07})`;
            bctx.lineWidth = 1.6;
            bctx.beginPath();
            bctx.ellipse(kx, ky, rr, rr * 0.75, 0.3, 0, Math.PI * 2);
            bctx.stroke();
        }
        cctx.fillStyle = 'rgba(30, 20, 12, 0.85)';
        cctx.beginPath();
        cctx.ellipse(kx, ky, 2.6, 2, 0.3, 0, Math.PI * 2);
        cctx.fill();
    }
    // Old water marks and grime soaked into the boards
    for (let w = 0; w < 14; w++) {
        cctx.fillStyle = `rgba(28, 20, 12, ${0.05 + Math.random() * 0.1})`;
        cctx.beginPath();
        cctx.ellipse(
            Math.random() * SIZE, Math.random() * SIZE,
            12 + Math.random() * 50, 8 + Math.random() * 28,
            Math.random() * Math.PI, 0, Math.PI * 2
        );
        cctx.fill();
    }
    // Scuffs and gouges — decades of trowels, pot rims and dragged crates. Short
    // strokes across the grain, because that is the direction a tool travels.
    for (let s = 0; s < 34; s++) {
        const sx = Math.random() * SIZE, sy = Math.random() * SIZE;
        const len = 6 + Math.random() * 26;
        const dark = Math.random() < 0.6;
        cctx.strokeStyle = dark
            ? `rgba(48, 34, 21, ${0.18 + Math.random() * 0.24})`
            : `rgba(196, 168, 132, ${0.12 + Math.random() * 0.18})`;
        cctx.lineWidth = 0.6 + Math.random() * 1.6;
        cctx.beginPath();
        cctx.moveTo(sx, sy);
        cctx.lineTo(sx + (Math.random() - 0.5) * 6, sy + len);
        cctx.stroke();
        // Same mark in the bump channel, so it reads as cut into the board.
        bctx.strokeStyle = `rgba(${dark ? 52 : 190}, 128, 128, 0.5)`;
        bctx.lineWidth = 0.8 + Math.random() * 1.6;
        bctx.beginPath();
        bctx.moveTo(sx, sy);
        bctx.lineTo(sx + (Math.random() - 0.5) * 6, sy + len);
        bctx.stroke();
    }

    sharedAssets.woodSet = {
        color: new THREE.CanvasTexture(colorCanvas),
        bump: new THREE.CanvasTexture(bumpCanvas),
        rough: new THREE.CanvasTexture(roughCanvas)
    };
    return sharedAssets.woodSet;
}

function makeWoodMaterial({ repeat = [1, 1], roughness = 0.85, color = 0xffffff } = {}) {
    const set = getWoodTextureSet();
    const colorMap = set.color.clone();
    const bumpMap = set.bump.clone();
    const roughMap = set.rough.clone();
    configureRepeat(colorMap, repeat, true);
    configureRepeat(bumpMap, repeat, false);
    configureRepeat(roughMap, repeat, false);
    colorMap.needsUpdate = bumpMap.needsUpdate = roughMap.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
        color,
        map: colorMap,
        bumpMap: bumpMap,
        bumpScale: 0.002,
        roughnessMap: roughMap,
        roughness,
        metalness: 0,
        // The only IBL here is the sky, so a bench with a strong environment term
        // is a bench that reflects a blue ceiling. Turned down to what the missing
        // interior half of the environment would have justified.
        envMapIntensity: 0.28,
        // Dielectric specular tinted warm. Physically the specular lobe of bare
        // wood is neutral, but these boards are decades of soaked-in linseed and
        // handling — the reflection off them under a tungsten lamp is amber, not
        // white, and it is what makes the worn patches read as polished rather
        // than bleached. Intensity stays at the default; the tint is the point.
        specularColor: new THREE.Color(0xffddb0),
        specularIntensity: 1
    });
}

// Real refracting glass: MeshPhysicalMaterial with transmission, so what you see
// through a pane is the scene behind it sampled from the renderer's transmission
// buffer, blurred by the pane's own roughness and bent by its IOR. That gives the
// three things an unlit tinted plane can never fake — grazing-angle Fresnel
// brightening, a specular sun glint, and slightly soft, displaced silhouettes
// behind the dirty spots.
//
// Three canvases are painted from one pass of procedural grime (condensation
// runs, algae film, mineral spots) so the same marks drive all three channels:
//   • color     — the tint, which also tints the transmitted light
//   • roughness — smeared film scatters, clean glass stays mirror-smooth
//   • height    — a gentle normal map, i.e. the waviness of old rolled glass
//
// depthWrite stays off. The panes are drawn after the opaque scene, and leaving
// depth alone keeps the panes out of the depth buffer the screen-space AO pass
// samples. (With transparency-aware AO on — see setupPostProcessing — the panes'
// alpha also masks AO off everything *behind* them, which is what keeps the
// forest's occlusion from stamping itself onto glass and haze cones alike.)
function makeGlassMaterial({ base, streaks, algae, spots, tint, roughness, transmission, thickness, envMapIntensity }) {
    const SIZE = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    // Roughness channel: black = polished glass, white = fully diffuse film.
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    // Height channel for the normal map: mid grey is flat.
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#000000';
    rctx.fillRect(0, 0, SIZE, SIZE);
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, SIZE, SIZE);

    // Broad, very low-frequency waves — the ripple of hand-drawn glass. Drawn
    // into the height channel only, so it distorts what you see through the pane
    // without dirtying it.
    for (let i = 0; i < 10; i++) {
        const wy = Math.random() * SIZE;
        const grad = hctx.createLinearGradient(0, wy - 26, 0, wy + 26);
        grad.addColorStop(0, 'rgba(128,128,128,0)');
        grad.addColorStop(0.5, `rgba(${Math.random() < 0.5 ? 168 : 88},128,128,0.5)`);
        grad.addColorStop(1, 'rgba(128,128,128,0)');
        hctx.fillStyle = grad;
        hctx.fillRect(0, wy - 26, SIZE, 52);
    }

    // Vertical condensation streaks running down the pane
    for (let i = 0; i < streaks; i++) {
        const x = Math.random() * SIZE;
        const top = Math.random() * SIZE * 0.5;
        const len = 30 + Math.random() * (SIZE - top);
        const light = Math.random() < 0.5;
        const width = 0.6 + Math.random() * 2.2;
        const cx = x + (Math.random() - 0.5) * 5;
        const ex = x + (Math.random() - 0.5) * 7;
        const stroke = (context, style, w) => {
            context.strokeStyle = style;
            context.lineWidth = w;
            context.beginPath();
            context.moveTo(x, top);
            context.quadraticCurveTo(cx, top + len * 0.5, ex, top + len);
            context.stroke();
        };
        stroke(ctx, light
            ? `rgba(230,245,235,${0.10 + Math.random() * 0.20})`
            : `rgba(90,120,95,${0.08 + Math.random() * 0.18})`, width);
        // A wet run is smoother than the film around it; a dried one is rougher.
        stroke(rctx, light
            ? `rgba(0,0,0,${0.25 + Math.random() * 0.3})`
            : `rgba(255,255,255,${0.20 + Math.random() * 0.35})`, width);
        stroke(hctx, `rgba(${light ? 150 : 105},128,128,0.35)`, width * 1.4);
    }

    // Algae film creeping up from the bottom edge — opaque and matte down there
    const algaeGrad = ctx.createLinearGradient(0, SIZE, 0, SIZE * 0.55);
    algaeGrad.addColorStop(0, `rgba(70,110,70,${algae})`);
    algaeGrad.addColorStop(1, 'rgba(70,110,70,0)');
    ctx.fillStyle = algaeGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const algaeRough = rctx.createLinearGradient(0, SIZE, 0, SIZE * 0.55);
    algaeRough.addColorStop(0, `rgba(255,255,255,${Math.min(1, algae * 1.6)})`);
    algaeRough.addColorStop(1, 'rgba(255,255,255,0)');
    rctx.fillStyle = algaeRough;
    rctx.fillRect(0, 0, SIZE, SIZE);

    // Mineral spots / old splashes — hard little rough specks that catch light
    for (let i = 0; i < spots; i++) {
        const sx = Math.random() * SIZE;
        const sy = Math.random() * SIZE;
        const sr = 0.5 + Math.random() * 2.2;
        ctx.fillStyle = `rgba(225,235,220,${0.06 + Math.random() * 0.16})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        rctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
        rctx.beginPath();
        rctx.arc(sx, sy, sr, 0, Math.PI * 2);
        rctx.fill();
        hctx.fillStyle = `rgba(${150 + Math.random() * 40 | 0},128,128,0.5)`;
        hctx.beginPath();
        hctx.arc(sx, sy, sr, 0, Math.PI * 2);
        hctx.fill();
    }

    const grimeTex = new THREE.CanvasTexture(canvas);
    configureRepeat(grimeTex, [3, 1], true);
    const roughTex = new THREE.CanvasTexture(roughCanvas);
    configureRepeat(roughTex, [3, 1], false);
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 2.2);
    configureRepeat(normalTex, [3, 1], false);

    const mat = new THREE.MeshPhysicalMaterial({
        color: tint,
        map: grimeTex,
        roughness,
        roughnessMap: roughTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.35, 0.35),
        metalness: 0,
        transmission,
        thickness,
        ior: 1.52,                 // soda-lime glass
        specularIntensity: 1,
        // Non-zero from the outset on purpose. three compiles USE_CLEARCOAT only
        // when this is > 0, so starting at 0 and raising it after dark would
        // recompile every glass program mid-dusk; starting low and animating the
        // value keeps one program for the whole day. See updateSunAndLighting.
        clearcoat: 0.08,
        clearcoatRoughness: 0.22,
        // The only IBL in this scene is the outdoor sky. Smooth glass viewed at a
        // grazing angle is nearly a mirror, so at full strength the side walls
        // mirrored the sky into a flat milky sheet and the forest behind them
        // vanished. The reflection is kept, just turned down to the level the
        // missing interior half of the environment would have justified.
        envMapIntensity,
        // transparent+opacity here is only about how a pane composites over the
        // pane behind it; transmission is what makes it see-through.
        transparent: true,
        opacity: 1,
        side: THREE.FrontSide,     // every pane is a closed box or extrusion
        depthWrite: false,
        fog: true
    });
    mat.userData.dayTint = new THREE.Color(tint);
    mat.userData.dayTransmission = transmission;
    // Slightly clearer after dark so the tree line survives a dim transmission
    // buffer, and smoother so the lamp row reflects as distinct bulbs rather than
    // a diffuse smear. Roof glass is the rougher of the two by design, so both
    // are derived from its own daytime value rather than pinned to a constant.
    mat.userData.nightTransmission = Math.min(1, transmission + 0.05);
    mat.userData.dayRoughness = roughness;
    mat.userData.nightRoughness = roughness * 0.45;
    return mat;
}

// Vertical wall glazing — the clearer glass. Low-angle light comes in through
// the sides of a greenhouse, and at night you can see out into the woods.
function getWallGlassMaterial() {
    if (sharedAssets.wallGlass) return sharedAssets.wallGlass;
    sharedAssets.wallGlass = makeGlassMaterial({
        base: '#d4e3d8', streaks: 40, algae: 0.3, spots: 110,
        tint: 0xd8e8dc, roughness: 0.05, transmission: 0.97, thickness: 0.16,
        envMapIntensity: 0.18
    });
    return sharedAssets.wallGlass;
}

// Roof glazing — more translucent and greener, like old diffusing
// horticultural glass: it scatters the overhead sun rather than passing a
// clear view, and collects a heavier film of algae and mineral haze. The
// higher roughness is what does the scattering: transmission samples the
// backdrop from a blurrier mip the rougher the surface gets.
function getRoofGlassMaterial() {
    if (sharedAssets.roofGlass) return sharedAssets.roofGlass;
    sharedAssets.roofGlass = makeGlassMaterial({
        base: '#aed2b6', streaks: 90, algae: 0.55, spots: 280,
        tint: 0xb6d6bd, roughness: 0.28, transmission: 0.9, thickness: 0.3,
        envMapIntensity: 0.3
    });
    return sharedAssets.roofGlass;
}

// Verdigris (oxidized) copper — patinated greenish-blue with mottled texture
function getCopperMaterial() {
    if (sharedAssets.copper) return sharedAssets.copper;
    const SIZE = 256;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const ctx = colorCanvas.getContext('2d');
    // Base verdigris green
    ctx.fillStyle = '#5a9b80';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Patina patches — varying greens and blues
    for (let i = 0; i < 350; i++) {
        const r = 60 + Math.random() * 50;
        const g = 130 + Math.random() * 70;
        const b = 100 + Math.random() * 60;
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.25 + Math.random() * 0.45})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 3 + Math.random() * 12, 0, Math.PI * 2);
        ctx.fill();
    }
    // Exposed copper streaks (warmer reddish-brown)
    for (let i = 0; i < 40; i++) {
        const r = 140 + Math.random() * 60;
        const g = 80 + Math.random() * 30;
        const b = 40 + Math.random() * 20;
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.35 + Math.random() * 0.35})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1.5 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
    }
    // Dark crevices
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(20,40,30,${0.15 + Math.random() * 0.25})`;
        ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping;

    // Bumpy patina surface
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 300; i++) {
        const grey = 80 + Math.random() * 130;
        hctx.fillStyle = `rgb(${grey|0},${grey|0},${grey|0})`;
        hctx.beginPath();
        hctx.arc(Math.random() * SIZE, Math.random() * SIZE, 2 + Math.random() * 6, 0, Math.PI * 2);
        hctx.fill();
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 5);
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;

    sharedAssets.copper = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1, 1),
        color: 0xb0d8c0,
        roughness: 0.55,
        metalness: 0.35,
        envMapIntensity: 0.85,
        sheen: 0.25,
        sheenColor: new THREE.Color(0x9adfba),
        sheenRoughness: 0.7
    });
    return sharedAssets.copper;
}

// Edison-style bulb glass with controllable emissive (off during day, glowing at night)
function makeBulbMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xffd29a,
        emissive: 0xffaa55,
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0,
        transparent: true,
        opacity: 0.85
    });
}

function getMetalFrameMaterial() {
    if (sharedAssets.frame) return sharedAssets.frame;
    sharedAssets.frame = new THREE.MeshPhysicalMaterial({
        color: 0x2c3a30,
        metalness: 0.85,
        roughness: 0.45,
        envMapIntensity: 0.9
    });
    return sharedAssets.frame;
}

function getDoorHandleMaterial() {
    if (sharedAssets.handle) return sharedAssets.handle;
    sharedAssets.handle = new THREE.MeshPhysicalMaterial({
        color: 0xc8b870,
        metalness: 0.95,
        roughness: 0.18,
        envMapIntensity: 1.2
    });
    return sharedAssets.handle;
}

function getDirtFloorMaterial() {
    if (sharedAssets.floor) return sharedAssets.floor;
    const SIZE = 512;
    // Large-scale dampness variation + fine grain detail
    const wet = makeFbmField(SIZE, 4, 3);
    const grain = makeFbmField(SIZE, 5, 12);

    // Color — dark waterlogged soil; wet patches read darker and slightly colder
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const cctx = colorCanvas.getContext('2d');
    const img = cctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const w = wet[i];          // 0 dry … 1 soaked
        const g = grain[i];
        const dryness = 1 - w;
        img.data[i * 4 + 0] = 22 + dryness * 38 + g * 26;
        img.data[i * 4 + 1] = 14 + dryness * 24 + g * 18;
        img.data[i * 4 + 2] = 8 + dryness * 12 + g * 12;
        img.data[i * 4 + 3] = 255;
    }
    cctx.putImageData(img, 0, 0);
    // Grit pressed into the mud. Small and numerous, and only a little lighter
    // than the soil around it.
    //
    // This tile covers 16.7 m of floor, so a radius here of 4 px is a 13 cm
    // stone — and at the old lightness (up to 130 against a soil base of 22–86)
    // a field of those read from eye height as pale discs scattered across the
    // aisle, like dropped coins. Grit is what makes earth look like earth, but
    // only at grit scale: many small, low-contrast, and a handful of larger
    // stones for punctuation.
    for (let i = 0; i < 1100; i++) {
        const big = Math.random() < 0.06;
        const shade = 44 + Math.random() * (big ? 34 : 26);
        cctx.fillStyle = `rgba(${shade|0},${(shade-9)|0},${(shade-17)|0},${0.5 + Math.random() * 0.4})`;
        cctx.beginPath();
        cctx.arc(Math.random() * SIZE, Math.random() * SIZE,
                 big ? 1.8 + Math.random() * 1.6 : 0.5 + Math.random() * 1.2, 0, Math.PI * 2);
        cctx.fill();
    }
    // Scattered dead-leaf fragments trodden into the floor
    for (let i = 0; i < 120; i++) {
        const r = 66 + Math.random() * 34;
        const g = 46 + Math.random() * 24;
        cctx.fillStyle = `rgba(${r|0},${g|0},20,${0.3 + Math.random() * 0.35})`;
        cctx.save();
        cctx.translate(Math.random() * SIZE, Math.random() * SIZE);
        cctx.rotate(Math.random() * Math.PI);
        cctx.beginPath();
        cctx.ellipse(0, 0, 2 + Math.random() * 4, 1 + Math.random() * 2, 0, 0, Math.PI * 2);
        cctx.fill();
        cctx.restore();
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    configureRepeat(colorTex, [12, 12], true);

    // Roughness — damp patches take a sheen, but only a sheen. This used to drop
    // to 0.18, and since the moisture field is fBm the result was a field of
    // smooth pale ellipses across the whole floor, each one mirroring the sky:
    // from eye height they read as scattered sheets of paper, not damp earth. The
    // actual standing water in this room is the puddle geometry, which is a
    // separate mesh and still a proper mirror.
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    const rimg = rctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const w = Math.pow(wet[i], 1.6);
        const rough = 240 - w * 70 + grain[i] * 15;
        rimg.data[i * 4 + 0] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = rough;
        rimg.data[i * 4 + 3] = 255;
    }
    rctx.putImageData(rimg, 0, 0);
    const roughTex = new THREE.CanvasTexture(roughCanvas);
    configureRepeat(roughTex, [12, 12], false);

    // Height — mud lumps, footprint-ish depressions following the wet field
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    const himg = hctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const v = 70 + grain[i] * 120 - wet[i] * 40;
        himg.data[i * 4 + 0] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = v;
        himg.data[i * 4 + 3] = 255;
    }
    hctx.putImageData(himg, 0, 0);
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 6);
    configureRepeat(normalTex, [12, 12], false);

    sharedAssets.floor = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: roughTex,
        roughness: 1.0,
        metalness: 0,
        envMapIntensity: 0.35
    });
    return sharedAssets.floor;
}

function getPotMaterial() {
    if (sharedAssets.pot) return sharedAssets.pot;
    const SIZE = 512;
    // Large damp/mineral patches + fine clay grain
    const blotch = makeFbmField(SIZE, 4, 4);
    const grain = makeFbmField(SIZE, 5, 18);

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const ctx = colorCanvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const i = y * SIZE + x;
            const b = blotch[i];
            const g = grain[i];
            // Fired-clay base, slightly lighter toward the rim (top of UV)
            const rimLight = 1 - (y / SIZE) * 0.16;
            let r0 = (158 + g * 36) * rimLight;
            let g0 = (84 + g * 24) * rimLight;
            let b0 = (56 + g * 16) * rimLight;
            // Damp patches: water soaked into the clay reads darker and colder
            if (b < 0.4) {
                const k = (0.4 - b) * 1.6;
                r0 *= 1 - 0.35 * k;
                g0 *= 1 - 0.3 * k;
                b0 *= 1 - 0.2 * k;
            }
            // Mineral efflorescence: chalky white salt bloom on dry areas
            if (b > 0.68) {
                const k = Math.min(1, (b - 0.68) * 4) * 0.55;
                r0 = r0 * (1 - k) + 226 * k;
                g0 = g0 * (1 - k) + 218 * k;
                b0 = b0 * (1 - k) + 202 * k;
            }
            const px = i * 4;
            img.data[px + 0] = r0;
            img.data[px + 1] = g0;
            img.data[px + 2] = b0;
            img.data[px + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    // Throwing rings — slightly wobbly, like a hand-thrown pot
    for (let y = 4; y < SIZE; y += 10 + Math.random() * 9) {
        ctx.strokeStyle = `rgba(50, 24, 12, ${0.07 + Math.random() * 0.09})`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= SIZE; x += 32) {
            ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 1.2);
        }
        ctx.stroke();
    }
    // Moss freckles collecting in damp spots near the base
    for (let i = 0; i < 90; i++) {
        const my = SIZE * (0.55 + Math.random() * 0.45);
        const gr = 70 + Math.random() * 50;
        ctx.fillStyle = `rgba(${gr * 0.5|0},${gr|0},${gr * 0.4|0},${0.15 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, my, 0.8 + Math.random() * 2.6, 0, Math.PI * 2);
        ctx.fill();
    }
    // Chips and scratches in the glaze-less clay
    for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(96, 50, 28, ${0.3 + Math.random() * 0.3})`;
        ctx.lineWidth = 0.7 + Math.random();
        const sx = Math.random() * SIZE, sy = Math.random() * SIZE;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 22, sy + (Math.random() - 0.5) * 10);
        ctx.stroke();
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping;
    colorTex.anisotropy = 8;

    // Roughness. Unglazed terracotta is *slightly* rough — enough of a sheen to
    // pick out the throwing rings and the rim under a lamp, nowhere near enough
    // to mirror anything. The band here is deliberately narrow (0.63–0.92): the
    // old one reached 0.45 where the clay was damp, and a fired-clay pot with a
    // 0.45 patch on it looks glazed, not wet.
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    const rimg = rctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const wet = Math.max(0, 0.4 - blotch[i]) * 2.2;
        const rough = 226 - wet * 40 - grain[i] * 20;
        const px = i * 4;
        rimg.data[px + 0] = rimg.data[px + 1] = rimg.data[px + 2] = rough;
        rimg.data[px + 3] = 255;
    }
    rctx.putImageData(rimg, 0, 0);
    const roughTex = new THREE.CanvasTexture(roughCanvas);

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    const himg = hctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const v = 95 + grain[i] * 80;
        const px = i * 4;
        himg.data[px + 0] = himg.data[px + 1] = himg.data[px + 2] = v;
        himg.data[px + 3] = 255;
    }
    hctx.putImageData(himg, 0, 0);
    for (let y = 4; y < SIZE; y += 10 + Math.random() * 9) {
        hctx.fillStyle = 'rgba(46,46,46,0.65)';
        hctx.fillRect(0, y, SIZE, 2);
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 4);

    sharedAssets.pot = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: roughTex,
        roughness: 1.0,
        metalness: 0,
        envMapIntensity: 0.3
    });
    return sharedAssets.pot;
}

function getSoilMaterial() {
    if (sharedAssets.soil) return sharedAssets.soil;
    const SIZE = 256;
    const moist = makeFbmField(SIZE, 4, 4);

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const ctx = colorCanvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        // Potting mix: dark brown, browner where it is drying out. It used to
        // bottom out near black, which combined with the gloss below to read as
        // wet tarmac; a matte medium-dark brown is what peat actually looks like
        // and it gives the bump detail something to sit on.
        const m = moist[i];
        const px = i * 4;
        img.data[px + 0] = 40 + (1 - m) * 34;
        img.data[px + 1] = 27 + (1 - m) * 22;
        img.data[px + 2] = 17 + (1 - m) * 13;
        img.data[px + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Bark chips — elongated woody flecks at random angles
    for (let i = 0; i < 260; i++) {
        const r = 58 + Math.random() * 55;
        const g = 36 + Math.random() * 30;
        ctx.fillStyle = `rgba(${r|0},${g|0},${12 + Math.random() * 12|0},${0.5 + Math.random() * 0.45})`;
        ctx.save();
        ctx.translate(Math.random() * SIZE, Math.random() * SIZE);
        ctx.rotate(Math.random() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.6 + Math.random() * 4.2, 0.7 + Math.random() * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Perlite — the little white volcanic-glass specks in every potting mix
    for (let i = 0; i < 80; i++) {
        const w = 195 + Math.random() * 45;
        ctx.fillStyle = `rgba(${w|0},${w|0},${(w - 14)|0},${0.6 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 0.6 + Math.random() * 1.4, 0, Math.PI * 2);
        ctx.fill();
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    // No roughness map at all. There used to be one driven by the same moisture
    // field as the colour, dipping to 0.33 where the mix was damp — and because
    // the field is fBm, what that produced was a set of smooth glossy swirls
    // sitting on the surface of every pot, catching the sky and reading as
    // spilled oil. Soil is the one material in this scene that is uniformly,
    // completely matte: it is loose organic crumb, there is no flat facet
    // anywhere on it to form a highlight. All the variation it needs is in the
    // colour and the normal map.
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#585858';
    hctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 900; i++) {
        const grey = 70 + Math.random() * 130;
        hctx.fillStyle = `rgb(${grey|0},${grey|0},${grey|0})`;
        hctx.save();
        hctx.translate(Math.random() * SIZE, Math.random() * SIZE);
        hctx.rotate(Math.random() * Math.PI);
        hctx.beginPath();
        hctx.ellipse(0, 0, 1 + Math.random() * 3.2, 0.6 + Math.random() * 1.6, 0, 0, Math.PI * 2);
        hctx.fill();
        hctx.restore();
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 7);

    sharedAssets.soil = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1.45, 1.45),
        roughness: 1,
        metalness: 0,
        // Barely any environment reflection either. A fully rough surface still
        // picks up the IBL as a broad sheen, and on the pots that sheen was
        // most of what made the soil look wet.
        envMapIntensity: 0.18
    });
    return sharedAssets.soil;
}

function createLeafMaterial() {
    const SIZE = 256;

    // Real leaf silhouette: pointed tip, broad shoulders, slightly ragged margin.
    // The same path drives both the color fill and the alpha cutout.
    const margin = [];
    const lobes = 80;
    for (let i = 0; i <= lobes; i++) margin.push(1 + (Math.random() - 0.5) * 0.07);
    function traceLeaf(ctx) {
        ctx.beginPath();
        for (let side = 0; side < 2; side++) {
            for (let i = 0; i <= lobes; i++) {
                const t = side === 0 ? i / lobes : 1 - i / lobes;
                const y = 10 + t * (SIZE - 20);
                const w = Math.pow(Math.sin(t * Math.PI), 0.8) * (SIZE / 2.5) * margin[i];
                const x = SIZE / 2 + (side === 0 ? w : -w);
                if (side === 0 && i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    }

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const cctx = colorCanvas.getContext('2d');
    cctx.clearRect(0, 0, SIZE, SIZE);
    const grad = cctx.createRadialGradient(SIZE / 2, SIZE * 0.58, 8, SIZE / 2, SIZE / 2, SIZE / 1.7);
    grad.addColorStop(0, '#5fa858');
    grad.addColorStop(0.55, '#3c7e40');
    grad.addColorStop(1, '#1e4a26');
    cctx.fillStyle = grad;
    traceLeaf(cctx);
    cctx.fill();
    // Chlorophyll mottling — irregular lighter/darker patches
    cctx.save();
    traceLeaf(cctx);
    cctx.clip();
    for (let i = 0; i < 120; i++) {
        const light = Math.random() < 0.5;
        cctx.fillStyle = light
            ? `rgba(125, 185, 105, ${0.06 + Math.random() * 0.12})`
            : `rgba(18, 52, 24, ${0.06 + Math.random() * 0.12})`;
        cctx.beginPath();
        cctx.ellipse(
            Math.random() * SIZE, Math.random() * SIZE,
            4 + Math.random() * 16, 3 + Math.random() * 10,
            Math.random() * Math.PI, 0, Math.PI * 2
        );
        cctx.fill();
    }
    // Vein network — pale midrib with curved secondaries and fine veinlets
    cctx.strokeStyle = 'rgba(178, 205, 150, 0.55)';
    cctx.lineWidth = 2.4;
    cctx.beginPath();
    cctx.moveTo(SIZE / 2, 12);
    cctx.lineTo(SIZE / 2, SIZE - 10);
    cctx.stroke();
    cctx.lineWidth = 1.1;
    cctx.strokeStyle = 'rgba(170, 198, 142, 0.4)';
    for (let i = 1; i < 11; i++) {
        const t = i / 11;
        const yPos = 16 + t * (SIZE - 32);
        const len = Math.pow(Math.sin(t * Math.PI), 0.8) * SIZE / 2.7;
        for (const s of [1, -1]) {
            cctx.beginPath();
            cctx.moveTo(SIZE / 2, yPos);
            cctx.quadraticCurveTo(
                SIZE / 2 + s * len * 0.5, yPos - len * 0.28,
                SIZE / 2 + s * len, yPos - len * 0.5
            );
            cctx.stroke();
        }
    }
    cctx.restore();
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = alphaCanvas.height = SIZE;
    const actx = alphaCanvas.getContext('2d');
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, SIZE, SIZE);
    actx.fillStyle = '#fff';
    traceLeaf(actx);
    actx.fill();
    const alphaTex = new THREE.CanvasTexture(alphaCanvas);

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#7a7a7a';
    hctx.fillRect(0, 0, SIZE, SIZE);
    hctx.strokeStyle = '#a8a8a8';
    hctx.lineWidth = 4;
    hctx.beginPath();
    hctx.moveTo(SIZE / 2, 8);
    hctx.lineTo(SIZE / 2, SIZE - 8);
    hctx.stroke();
    hctx.strokeStyle = '#909090';
    hctx.lineWidth = 2;
    hctx.beginPath();
    for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const yPos = 12 + t * (SIZE - 24);
        const len = (1 - Math.abs(t - 0.5) * 1.5) * SIZE / 2.6;
        hctx.moveTo(SIZE / 2, yPos);
        hctx.lineTo(SIZE / 2 + len, yPos - len * 0.4);
        hctx.moveTo(SIZE / 2, yPos);
        hctx.lineTo(SIZE / 2 - len, yPos - len * 0.4);
    }
    hctx.stroke();
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 6);

    // MeshPhysicalMaterial with sheen — gives the soft velvety highlight real
    // leaves have instead of a plasticky specular dot.
    return new THREE.MeshPhysicalMaterial({
        map: colorTex,
        alphaMap: alphaTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.6,
        metalness: 0,
        sheen: 0.4,
        sheenColor: new THREE.Color(0x9ad88a),
        sheenRoughness: 0.5,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.45
    });
}

// --- Haunted forest backdrop ---

function createDeadTreeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 512);
    ctx.strokeStyle = '#0a0604';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Recursive gnarled branch generator
    function drawBranch(x1, y1, x2, y2, w, depth) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const cx = (x1 + x2) / 2 + (Math.random() - 0.5) * w * 4;
        const cy = (y1 + y2) / 2 + (Math.random() - 0.5) * 8;
        ctx.quadraticCurveTo(cx, cy, x2, y2);
        ctx.stroke();
        if (depth <= 0 || w < 1.6) return;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const branches = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < branches; i++) {
            const ba = angle + (Math.random() - 0.5) * 1.4;
            const bl = len * (0.45 + Math.random() * 0.35);
            drawBranch(
                x2, y2,
                x2 + Math.cos(ba) * bl,
                y2 + Math.sin(ba) * bl,
                w * 0.55, depth - 1
            );
        }
    }

    // Trunk (roots near bottom, taper toward top)
    drawBranch(128, 510, 128 + (Math.random() - 0.5) * 20, 80, 18, 4);

    // Side branches off the trunk
    const sideCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sideCount; i++) {
        const yStart = 380 - i * (260 / sideCount);
        const isLeft = Math.random() > 0.5;
        const dx = (isLeft ? -1 : 1) * (40 + Math.random() * 70);
        const dy = -20 - Math.random() * 60;
        drawBranch(128, yStart, 128 + dx, yStart + dy, 5 + Math.random() * 4, 3);
    }

    return new THREE.CanvasTexture(canvas);
}

// Leafy old-growth tree silhouette — thicker trunk, dense canopy with internal texture.
function createOldGrowthTreeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 512);

    // Thick trunk
    ctx.strokeStyle = '#2a1a0e';
    ctx.lineCap = 'round';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(128 + (Math.random() - 0.5) * 8, 510);
    ctx.bezierCurveTo(132, 380, 122, 280, 128, 220);
    ctx.stroke();

    // Major branches into the canopy
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(128, 290); ctx.lineTo(80, 230); ctx.lineTo(50, 180);
    ctx.moveTo(128, 290); ctx.lineTo(180, 230); ctx.lineTo(210, 180);
    ctx.moveTo(128, 230); ctx.lineTo(100, 180); ctx.lineTo(80, 130);
    ctx.moveTo(128, 230); ctx.lineTo(160, 180); ctx.lineTo(180, 130);
    ctx.stroke();

    // Canopy — dense overlapping foliage clumps
    const clumps = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < clumps; i++) {
        const cx = 60 + Math.random() * 140;
        const cy = 40 + Math.random() * 200;
        const r = 32 + Math.random() * 38;
        const shade = 8 + Math.floor(Math.random() * 22);
        ctx.fillStyle = `rgb(${shade}, ${shade + 18}, ${shade + 4})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Texture: small dark/light specks for foliage detail
    for (let i = 0; i < 160; i++) {
        const cx = 50 + Math.random() * 156;
        const cy = 35 + Math.random() * 220;
        const r = 1 + Math.random() * 4;
        const dark = Math.random() < 0.6;
        ctx.fillStyle = dark
            ? `rgba(2, 8, 4, ${0.5 + Math.random() * 0.4})`
            : `rgba(60, 95, 50, ${0.35 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
}

// GPU-only wind sway — uniforms are written from updateTreeWind once per frame.
// Works on any material (basic billboards, standard foliage, undergrowth).
function injectWindSway(mat, heightRange = 7) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uWindStrength = { value: 0 };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `
                #include <common>
                uniform float uTime;
                uniform float uWindStrength;
            `)
            .replace('#include <begin_vertex>', `
                #include <begin_vertex>
                #ifdef USE_INSTANCING
                    vec4 _instOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    float _phase = uTime + _instOrigin.x * 0.3 + _instOrigin.z * 0.21;
                #else
                    float _phase = uTime;
                #endif
                float _swayFactor = smoothstep(0.0, ${heightRange.toFixed(1)}, position.y);
                float _swayX = sin(_phase) * uWindStrength * _swayFactor;
                float _swayZ = sin(_phase * 0.8 + 1.2) * uWindStrength * 0.5 * _swayFactor;
                transformed.x += _swayX;
                transformed.z += _swayZ;
            `);
        mat.userData.shader = shader;
    };
    treeMaterials.push(mat);
    return mat;
}

function makeWindyTreeMaterial(texture, color) {
    // MeshBasicMaterial — flat silhouette, identical from any angle. No per-side
    // lighting variance, no sun shading, no IBL pulling color around as you turn.
    // transparent:false + alphaTest puts trees in the OPAQUE pass so they write
    // proper depth; the transparent glass then composites over them deterministically
    // (otherwise the transparent-sort order flips as you move and the glass tint
    // appears/disappears on the same trees).
    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        color,
        side: THREE.DoubleSide,
        transparent: false,
        alphaTest: 0.5,
        fog: true
    });
    return injectWindSway(mat, 7);
}

// Bark — vertical ridge texture from layered noise + carved fissures.
function makeBarkTexture(baseR, baseG, baseB) {
    const SIZE = 256;
    const ridges = makeFbmField(SIZE, 4, 6);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            // Stretch the noise vertically so it reads as bark ridges
            const n = ridges[((y * 3) % SIZE) * SIZE + x];
            const v = 0.45 + n * 0.85;
            const i = (y * SIZE + x) * 4;
            img.data[i + 0] = baseR * v;
            img.data[i + 1] = baseG * v;
            img.data[i + 2] = baseB * v;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    // Deep vertical fissures
    for (let i = 0; i < 26; i++) {
        let x = Math.random() * SIZE;
        ctx.strokeStyle = `rgba(8,5,3,${0.4 + Math.random() * 0.4})`;
        ctx.lineWidth = 1 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y < SIZE; y += 18) {
            x += (Math.random() - 0.5) * 9;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    // Lichen / moss blotches
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${90 + Math.random() * 50 | 0},50,${0.10 + Math.random() * 0.22})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 3 + Math.random() * 10, 0, Math.PI * 2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Ragged leaf-mass clump with alpha — used for canopy quads on 3D trees.
function makeFoliageClumpTexture() {
    if (sharedAssets.foliageTex) return sharedAssets.foliageTex;
    const SIZE = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    const cx = SIZE / 2, cy = SIZE / 2;
    for (let i = 0; i < 420; i++) {
        const a = Math.random() * Math.PI * 2;
        // Bias leaves toward the center so edges go ragged and sparse
        const d = Math.pow(Math.random(), 0.6) * SIZE * 0.46;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        const g = 50 + Math.random() * 80;
        const r = g * (0.35 + Math.random() * 0.3);
        const b = g * (0.3 + Math.random() * 0.25);
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.75 + Math.random() * 0.25})`;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.5 + Math.random() * 5, 1.4 + Math.random() * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedAssets.foliageTex = tex;
    return tex;
}

// One real 3D tree: recursive tapered-cylinder branches merged into a single bark
// geometry, plus (for living trees) merged canopy quads at the branch tips.
function buildTreeArchetype({ dead = false } = {}) {
    const barkParts = [];
    const tips = [];
    const up = new THREE.Vector3(0, 1, 0);
    const maxDepth = dead ? 4 : 3;

    function branch(p0, dir, len, r0, depth) {
        const r1 = Math.max(0.015, r0 * 0.55);
        const radial = depth === 0 ? 7 : 5;
        const seg = new THREE.CylinderGeometry(r1, r0, len, radial, 1);
        seg.translate(0, len / 2, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
        seg.applyQuaternion(q);
        seg.translate(p0.x, p0.y, p0.z);
        barkParts.push(seg);
        const p1 = p0.clone().addScaledVector(dir, len);
        if (depth >= maxDepth) {
            tips.push(p1.clone());
            return;
        }
        const kids = depth === 0 ? 3 : (Math.random() < 0.5 ? 2 : 3);
        for (let i = 0; i < kids; i++) {
            const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
                .cross(dir);
            if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
            axis.normalize();
            const nd = dir.clone().applyAxisAngle(axis, (dead ? 0.55 : 0.4) + Math.random() * 0.55);
            // Living trees reach upward; dead trees claw sideways
            nd.y += dead ? 0.02 : 0.3;
            nd.normalize();
            branch(p1, nd, len * (0.58 + Math.random() * 0.16), r1, depth + 1);
        }
        if (depth >= 1 && !dead && Math.random() < 0.5) tips.push(p1.clone());
    }

    const trunkDir = new THREE.Vector3((Math.random() - 0.5) * 0.14, 1, (Math.random() - 0.5) * 0.14).normalize();
    const trunkLen = 2.6 + Math.random() * 1.4;
    const trunkR = 0.26 + Math.random() * 0.12;
    branch(new THREE.Vector3(0, 0, 0), trunkDir, trunkLen, trunkR, 0);

    // Root flare at the base
    const root = new THREE.CylinderGeometry(trunkR * 1.02, trunkR * 2.1, 0.5, 7, 1);
    root.translate(0, 0.25, 0);
    barkParts.push(root);

    const barkGeom = mergeGeometries(barkParts);

    let foliageGeom = null;
    if (!dead && tips.length) {
        const quads = [];
        for (const tip of tips) {
            const clumps = 2 + (Math.random() < 0.4 ? 1 : 0);
            for (let c = 0; c < clumps; c++) {
                const s = 1.7 + Math.random() * 1.7;
                const quad = new THREE.PlaneGeometry(s, s);
                quad.rotateY(Math.random() * Math.PI);
                quad.rotateZ((Math.random() - 0.5) * 0.7);
                quad.translate(
                    tip.x + (Math.random() - 0.5) * 0.9,
                    tip.y + (Math.random() - 0.3) * 0.8,
                    tip.z + (Math.random() - 0.5) * 0.9
                );
                quads.push(quad);
            }
        }
        foliageGeom = mergeGeometries(quads);
    }
    return { barkGeom, foliageGeom };
}

// Per-instance colour for instanced foliage. instanceColor multiplies the
// material's own colour, so these are multipliers centred near 1.0 rather than
// absolute colours: one shared canopy texture then reads as hundreds of
// individually-aged trees. `warmth` biases the spread toward autumn (red/yellow
// gain, green loss); `spread` is how far the value can wander.
const _tintScratch = new THREE.Color();
function foliageTint(spread = 0.22, warmth = 0.35) {
    // Value is skewed low — most foliage sits in its own shade — but deliberately
    // centred on 1.0. A distribution with a mean below 1 would quietly dim every
    // instanced plant in the scene, which is a lighting change disguised as
    // variation. pow(r, 1.6) has mean 1/2.6, hence the 0.385 offset.
    const v = 1 + spread * (Math.pow(Math.random(), 1.6) - 0.385);
    // A minority of instances turn — the rest just vary in green. The red gain
    // and the green/blue loss are balanced to be near luminance-neutral, so
    // turning changes hue without changing how bright the forest reads.
    const turn = Math.random() < warmth ? Math.pow(Math.random(), 1.6) : 0;
    return _tintScratch.setRGB(
        v * (1 + turn * 0.55),
        v * (1 - turn * 0.10),
        v * (1 - turn * 0.45) * (0.9 + Math.random() * 0.2)
    );
}

// Write a tint per instance and flag the buffer. Safe to call on any InstancedMesh.
function applyInstanceTints(mesh, count, spread, warmth) {
    for (let i = 0; i < count; i++) {
        mesh.setColorAt(i, foliageTint(spread, warmth));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function buildHauntedForest() {
    // --- Real 3D trees in the near/mid bands ---
    const livingBarkTex = makeBarkTexture(96, 74, 56);
    const deadBarkTex = makeBarkTexture(62, 58, 54);
    const foliageTex = makeFoliageClumpTexture();

    // Dimmed tints keep the woods in self-shadow — direct sun on bare trunks
    // read as glowing tan poles instead of a gloomy understory.
    const livingBarkMat = new THREE.MeshStandardMaterial({
        map: livingBarkTex, color: 0x80705e, roughness: 0.95, metalness: 0, envMapIntensity: 0.25
    });
    const deadBarkMat = new THREE.MeshStandardMaterial({
        map: deadBarkTex, color: 0x57504a, roughness: 1.0, metalness: 0, envMapIntensity: 0.25
    });
    const foliageMat = new THREE.MeshStandardMaterial({
        map: foliageTex,
        color: 0x5d7a54,
        alphaTest: 0.45,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0,
        envMapIntensity: 0.35
    });
    injectWindSway(foliageMat, 9);

    // Five archetypes (3 living, 2 dead) so the forest doesn't look copy-pasted.
    const archetypes = [];
    for (let i = 0; i < 3; i++) archetypes.push({ ...buildTreeArchetype({ dead: false }), dead: false });
    for (let i = 0; i < 2; i++) archetypes.push({ ...buildTreeArchetype({ dead: true }), dead: true });

    // Scatter helper — picks a point on one of the four sides of the greenhouse.
    function scatterPoint(distMin, distMax, i) {
        const side = i % 4;
        const dist = distMin + Math.random() * (distMax - distMin);
        if (side === 0) return { x: -8 - dist, z: -62 + Math.random() * 84 };
        if (side === 1) return { x: 8 + dist, z: -62 + Math.random() * 84 };
        if (side === 2) return { x: -36 + Math.random() * 72, z: -45 - dist };
        return { x: -36 + Math.random() * 72, z: 5 + dist };
    }

    // Place 3D trees and bin them per archetype.
    const placements = archetypes.map(() => []);
    const TREE3D_COUNT = 420;
    for (let i = 0; i < TREE3D_COUNT; i++) {
        const scale = 0.85 + Math.random() * 1.05;
        // Branches + canopy quads reach ~4.5 m sideways at full scale; keep the
        // trunk far enough out that foliage can overhang the roof line but
        // never pass through the glass into the greenhouse.
        const minDist = 5.0 + scale * 2.0;
        const p = scatterPoint(minDist, 32, i);
        // 70% living, 30% dead snags for the haunted look
        const dead = Math.random() < 0.3;
        const pool = archetypes
            .map((a, idx) => ({ a, idx }))
            .filter(e => e.a.dead === dead);
        const pick = pool[Math.floor(Math.random() * pool.length)].idx;
        placements[pick].push({
            x: p.x, z: p.z,
            rotY: Math.random() * Math.PI * 2,
            scale
        });
    }

    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    archetypes.forEach((arch, idx) => {
        const list = placements[idx];
        if (!list.length) return;
        const bark = new THREE.InstancedMesh(arch.barkGeom, arch.dead ? deadBarkMat : livingBarkMat, list.length);
        const foliage = arch.foliageGeom
            ? new THREE.InstancedMesh(arch.foliageGeom, foliageMat, list.length)
            : null;
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            _q.setFromAxisAngle(_yAxis, t.rotY);
            _m.compose(new THREE.Vector3(t.x, 0, t.z), _q, new THREE.Vector3(t.scale, t.scale, t.scale));
            bark.setMatrixAt(i, _m);
            if (foliage) foliage.setMatrixAt(i, _m);
        }
        bark.instanceMatrix.needsUpdate = true;
        // Trunks vary too, just far less and never toward autumn.
        applyInstanceTints(bark, list.length, 0.16, 0);
        bark.castShadow = true;
        bark.receiveShadow = false;
        bark.frustumCulled = false;
        scene.add(bark);
        if (foliage) {
            foliage.instanceMatrix.needsUpdate = true;
            applyInstanceTints(foliage, list.length, 0.3, 0.4);
            foliage.castShadow = false;
            foliage.receiveShadow = false;
            foliage.frustumCulled = false;
            scene.add(foliage);
        }
    });

    // --- Far band: dense billboard wall so you can't see through to infinity ---
    const bareTex = createDeadTreeTexture();
    bareTex.colorSpace = THREE.SRGBColorSpace;
    const leafyTex = createOldGrowthTreeTexture();
    leafyTex.colorSpace = THREE.SRGBColorSpace;

    const treeWidth = 5;
    const treeHeight = 10;
    const plane1 = new THREE.PlaneGeometry(treeWidth, treeHeight);
    plane1.translate(0, treeHeight / 2, 0);
    const plane2 = plane1.clone();
    plane2.rotateY(Math.PI / 2);
    const treeGeom = mergeGeometries([plane1, plane2]);

    const bareMat = makeWindyTreeMaterial(bareTex, 0x1c1814);
    const leafyMat = makeWindyTreeMaterial(leafyTex, 0x141a14);

    const farTrees = [];
    for (let i = 0; i < 700; i++) {
        const p = scatterPoint(24, 46, i);
        farTrees.push({
            x: p.x, z: p.z,
            scale: 0.7 + Math.random() * 0.7,
            rotY: Math.random() * Math.PI * 2,
            type: Math.random() < 0.6 ? 1 : 0
        });
    }
    [
        { mat: bareMat, type: 0 },
        { mat: leafyMat, type: 1 }
    ].forEach(({ mat, type }) => {
        const subset = farTrees.filter(t => t.type === type);
        if (subset.length === 0) return;
        const mesh = new THREE.InstancedMesh(treeGeom, mat, subset.length);
        for (let i = 0; i < subset.length; i++) {
            const t = subset[i];
            _q.setFromAxisAngle(_yAxis, t.rotY);
            _m.compose(new THREE.Vector3(t.x, 0, t.z), _q, new THREE.Vector3(t.scale, t.scale, t.scale));
            mesh.setMatrixAt(i, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        // The far band is 700 copies of two billboards; without per-instance
        // tint it reads as wallpaper. Bare snags get a narrow grey spread,
        // leafy ones a wide one with plenty of turned colour.
        applyInstanceTints(mesh, subset.length, type === 0 ? 0.34 : 0.42, type === 0 ? 0.1 : 0.45);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // bounding sphere doesn't account for scattered instances
        scene.add(mesh);
    });

    buildForestFloor();
    buildUndergrowth(foliageTex);
    buildForestBackdrop();
}

// Fully opaque painted forest wall encircling the playfield — the final
// guarantee that nothing beyond the woods is ever visible, regardless of how
// the instanced trees happen to line up. Three silhouette layers, fog-toned
// far to dark near, with a ragged canopy line against the sky.
function buildForestBackdrop() {
    const W = 1024, H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Deliberately NOT filled with a sky gradient. It used to paint its own hazy
    // sky above the canopy, which made this an opaque dome rather than a tree
    // line: it swallowed every sightline below ~33° elevation and, because the
    // whole material dims with nightness, that band of sky went pitch black after
    // dark. Leaving it transparent above the treetops lets the real sky show —
    // the Sky shader by day, stars and the moon by night — and the ragged canopy
    // silhouette becomes the horizon, which is what it should have been.
    const layers = [
        { top: 58, color: '#7c8a7c', trunkColor: '#6a7a6c' },
        { top: 86, color: '#525f4b', trunkColor: '#414e3c' },
        { top: 118, color: '#2c3629', trunkColor: '#1d251b' }
    ];
    for (const layer of layers) {
        // Ragged canopy line: overlapping blobs along an undulating ridge
        ctx.fillStyle = layer.color;
        let x = -20;
        while (x < W + 20) {
            const y = layer.top + Math.sin(x * 0.05) * 8 + (Math.random() - 0.5) * 14;
            const r = 14 + Math.random() * 22;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            x += r * 0.7;
        }
        ctx.fillRect(0, layer.top + 18, W, H - layer.top - 18);
        // Trunk striping fading down into the layer
        ctx.fillStyle = layer.trunkColor;
        for (let t = 0; t < 70; t++) {
            const tx = Math.random() * W;
            const tw = 2 + Math.random() * 6;
            ctx.fillRect(tx, layer.top + 30 + Math.random() * 30, tw, H);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(7, 1);

    // alphaTest with transparent:false keeps this in the OPAQUE draw list, which
    // matters twice over: it still writes depth where there are trees, and the
    // renderer builds its transmission buffer from the opaque list, so the glass
    // would not show the tree line at all if this were a transparent material.
    const mat = new THREE.MeshBasicMaterial({
        map: tex, side: THREE.BackSide, fog: true,
        transparent: false, alphaTest: 0.5
    });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 44, 48, 1, true), mat);
    wall.position.set(0, 22, -20); // centered on the greenhouse footprint
    scene.add(wall);
    sharedAssets._backdropMat = mat;
}

// Leaf-litter / moss forest floor outside the greenhouse — a big plane with a
// rectangular hole cut where the greenhouse dirt floor shows through.
function buildForestFloor() {
    const SIZE = 512;
    const moss = makeFbmField(SIZE, 4, 4);
    const litter = makeFbmField(SIZE, 5, 10);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const m = moss[i];     // mossy (green) vs bare loam (brown)
        const l = litter[i];
        img.data[i * 4 + 0] = 24 + l * 30 + (1 - m) * 18;
        img.data[i * 4 + 1] = 22 + l * 26 + m * 26;
        img.data[i * 4 + 2] = 12 + l * 14;
        img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Dead leaves strewn across the floor
    for (let i = 0; i < 900; i++) {
        const r = 60 + Math.random() * 70;
        const g = 40 + Math.random() * 45;
        ctx.fillStyle = `rgba(${r|0},${g|0},${15 + Math.random() * 15|0},${0.35 + Math.random() * 0.45})`;
        ctx.save();
        ctx.translate(Math.random() * SIZE, Math.random() * SIZE);
        ctx.rotate(Math.random() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.5 + Math.random() * 3, 0.8 + Math.random() * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    const tex = new THREE.CanvasTexture(canvas);
    configureRepeat(tex, [22, 22], true);

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    const himg = hctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const v = 60 + litter[i] * 140;
        himg.data[i * 4 + 0] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = v;
        himg.data[i * 4 + 3] = 255;
    }
    hctx.putImageData(himg, 0, 0);
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 5);
    configureRepeat(normalTex, [22, 22], false);

    // ShapeGeometry rotated flat: shape (x, y) maps to world (x, -y), so the hole
    // for the greenhouse footprint uses y = -worldZ.
    const HALF = 160;
    const shape = new THREE.Shape();
    shape.moveTo(-HALF, -HALF);
    shape.lineTo(HALF, -HALF);
    shape.lineTo(HALF, HALF);
    shape.lineTo(-HALF, HALF);
    shape.closePath();
    const hole = new THREE.Path();
    const hx = 8.6;
    const hyMin = -(GREENHOUSE_BOUNDS.zMax + 0.6); // worldZ 5.6 → shapeY -5.6
    const hyMax = -(GREENHOUSE_BOUNDS.zMin - 0.6); // worldZ -45.6 → shapeY 45.6
    hole.moveTo(-hx, hyMin);
    hole.lineTo(hx, hyMin);
    hole.lineTo(hx, hyMax);
    hole.lineTo(-hx, hyMax);
    hole.closePath();
    shape.holes.push(hole);

    const geom = new THREE.ShapeGeometry(shape);
    // ShapeGeometry UVs span world units — rescale so the texture repeat is sane
    const uvs = geom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
        uvs.setXY(i, uvs.getX(i) / (HALF * 2), uvs.getY(i) / (HALF * 2));
    }
    const mat = new THREE.MeshPhysicalMaterial({
        map: tex,
        // Tinted down to fake canopy shade — the sun shadow camera only covers
        // the greenhouse, so without this the deep forest floor glows in
        // direct sun and reads as an open meadow.
        color: 0x6f786a,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1, 1),
        roughness: 0.95,
        metalness: 0
    });
    const floor = new THREE.Mesh(geom, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    scene.add(floor);
}

// Fern / bush silhouette with alpha for instanced undergrowth.
function makeFernTexture() {
    if (sharedAssets.fernTex) return sharedAssets.fernTex;
    const SIZE = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    const baseX = SIZE / 2, baseY = SIZE - 4;
    const fronds = 7;
    for (let f = 0; f < fronds; f++) {
        const angle = -Math.PI / 2 + (f - (fronds - 1) / 2) * 0.32 + (Math.random() - 0.5) * 0.1;
        const len = SIZE * (0.55 + Math.random() * 0.35);
        const g = 70 + Math.random() * 60;
        ctx.strokeStyle = `rgb(${g * 0.4|0},${g|0},${g * 0.35|0})`;
        ctx.lineWidth = 2;
        const tipX = baseX + Math.cos(angle) * len;
        const tipY = baseY + Math.sin(angle) * len;
        const bendX = baseX + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 10;
        const bendY = baseY + Math.sin(angle) * len * 0.5 - 6;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(bendX, bendY, tipX, tipY);
        ctx.stroke();
        // Pinnae along the frond
        const steps = 11;
        for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const px = baseX + (bendX - baseX) * 2 * t * (1 - t) + (tipX - baseX) * t * t + (baseX - baseX) * (1 - t) * (1 - t);
            const py = baseY + (bendY - baseY) * 2 * t * (1 - t) + (tipY - baseY) * t * t;
            const pinLen = (1 - t) * 13 + 2;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(px - pinLen, py - pinLen * 0.35);
            ctx.lineTo(px, py);
            ctx.lineTo(px + pinLen, py - pinLen * 0.35);
            ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedAssets.fernTex = tex;
    return tex;
}

function buildUndergrowth(foliageTex) {
    const fernTex = makeFernTexture();

    // Cross-quad, base at y=0
    const q1 = new THREE.PlaneGeometry(1.1, 0.9);
    q1.translate(0, 0.45, 0);
    const q2 = q1.clone();
    q2.rotateY(Math.PI / 2);
    const crossGeom = mergeGeometries([q1, q2]);

    const fernMat = new THREE.MeshStandardMaterial({
        map: fernTex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide,
        roughness: 0.95, metalness: 0, color: 0x8aa080, envMapIntensity: 0.25
    });
    injectWindSway(fernMat, 0.9);
    const bushMat = new THREE.MeshStandardMaterial({
        map: foliageTex, alphaTest: 0.45, transparent: false, side: THREE.DoubleSide,
        roughness: 0.95, metalness: 0, color: 0x66805e, envMapIntensity: 0.25
    });
    injectWindSway(bushMat, 0.9);

    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    [
        { mat: fernMat, count: 450, spread: 0.34, warmth: 0.3 },
        { mat: bushMat, count: 520, spread: 0.38, warmth: 0.42 }
    ].forEach(({ mat, count, spread, warmth }) => {
        const mesh = new THREE.InstancedMesh(crossGeom, mat, count);
        for (let i = 0; i < count; i++) {
            const side = i % 4;
            // Pack the understory close, but never so close that a wide
            // cross-quad (up to ~1.3 m half-width) pokes through the glass
            const dist = 1.7 + Math.pow(Math.random(), 1.4) * 34;
            let x, z;
            if (side === 0)      { x = -8 - dist; z = -60 + Math.random() * 80; }
            else if (side === 1) { x =  8 + dist; z = -60 + Math.random() * 80; }
            else if (side === 2) { x = -40 + Math.random() * 80; z = -45 - dist; }
            else                 { x = -40 + Math.random() * 80; z =   5 + dist; }
            _q.setFromAxisAngle(_yAxis, Math.random() * Math.PI * 2);
            const s = 0.6 + Math.random() * 1.7;
            _m.compose(new THREE.Vector3(x, 0, z), _q, new THREE.Vector3(s, s * (0.8 + Math.random() * 0.5), s));
            mesh.setMatrixAt(i, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        applyInstanceTints(mesh, count, spread, warmth);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        scene.add(mesh);
    });
}

// --- Forest atmosphere: drifting ground mist + fireflies (night) ---

function makeMistTexture() {
    const SIZE = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 4, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, 'rgba(200, 215, 220, 0.55)');
    grad.addColorStop(0.55, 'rgba(190, 205, 212, 0.22)');
    grad.addColorStop(1, 'rgba(180, 200, 210, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    return new THREE.CanvasTexture(canvas);
}

function buildForestAtmosphere() {
    // Ground mist — big soft sprites drifting slowly between the trees.
    const mistTex = makeMistTexture();
    for (let i = 0; i < 14; i++) {
        const mat = new THREE.SpriteMaterial({
            map: mistTex,
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
            fog: true
        });
        const sprite = new THREE.Sprite(mat);
        const side = i % 4;
        const dist = 9 + Math.random() * 22;
        let x, z;
        if (side === 0)      { x = -8 - dist; z = -55 + Math.random() * 70; }
        else if (side === 1) { x =  8 + dist; z = -55 + Math.random() * 70; }
        else if (side === 2) { x = -30 + Math.random() * 60; z = -45 - dist; }
        else                 { x = -30 + Math.random() * 60; z =   5 + dist; }
        sprite.position.set(x, 1.0 + Math.random() * 1.2, z);
        sprite.scale.set(10 + Math.random() * 9, 3.2 + Math.random() * 2.2, 1);
        sprite.userData.vx = (Math.random() - 0.5) * 0.16;
        sprite.userData.vz = (Math.random() - 0.5) * 0.16;
        sprite.userData.baseOpacity = 0.5 + Math.random() * 0.5;
        scene.add(sprite);
        mistSprites.push(sprite);
    }

    // Fireflies — additive shader points that twinkle and wander; night only.
    const COUNT = 80;
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        const side = i % 4;
        const dist = 9 + Math.random() * 24;
        let x, z;
        if (side === 0)      { x = -8 - dist; z = -55 + Math.random() * 70; }
        else if (side === 1) { x =  8 + dist; z = -55 + Math.random() * 70; }
        else if (side === 2) { x = -30 + Math.random() * 60; z = -45 - dist; }
        else                 { x = -30 + Math.random() * 60; z =   5 + dist; }
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = 0.4 + Math.random() * 1.9;
        positions[i * 3 + 2] = z;
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uNight: { value: 0 }
        },
        vertexShader: `
            uniform float uTime;
            attribute float aPhase;
            varying float vTwinkle;
            void main() {
                vec3 p = position;
                p.x += sin(uTime * 0.31 + aPhase) * 0.8;
                p.y += sin(uTime * 0.43 + aPhase * 2.0) * 0.35;
                p.z += cos(uTime * 0.27 + aPhase) * 0.8;
                vTwinkle = smoothstep(0.15, 0.9, 0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 7.0));
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = min((4.0 + 5.0 * vTwinkle) * (18.0 / max(1.0, -mv.z)), 16.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uNight;
            varying float vTwinkle;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float falloff = smoothstep(0.5, 0.0, d);
                vec3 col = mix(vec3(0.5, 0.9, 0.3), vec3(1.0, 0.95, 0.55), vTwinkle);
                gl_FragColor = vec4(col, falloff * vTwinkle * uNight);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    fireflySystem = new THREE.Points(geom, mat);
    fireflySystem.frustumCulled = false;
    scene.add(fireflySystem);
}

// --- The far light ---
//
// One cold blue-white light, a long way back in the trees, at about the height of
// a window. It is never explained and never approached: the tree line hides it
// for most of a lap of the greenhouse and it is only ever a few pixels across.
//
// Opaque on purpose, like the stars and the moon. The renderer builds its
// transmission buffer from the opaque draw list only, so a transparent sprite —
// which is what the fireflies and the eyes are — does not exist as far as the
// glass is concerned, and the whole point of this one is that you catch it
// through a pane. transparent:false plus a discard in the shader gets it into
// that buffer; on a near-black night wood, "replace" and "add" look the same.
let farLight = null;
function buildFarForestLight() {
    const geom = new THREE.PlaneGeometry(2.2, 2.2);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uNight: { value: 0 }, uPulse: { value: 1 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uNight;
            uniform float uPulse;
            varying vec2 vUv;
            void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                float r = length(p);
                if (r > 1.0) discard;
                // Tight core with a wide halo — a small bright source seen through
                // a lot of damp air.
                float core = pow(1.0 - smoothstep(0.0, 0.30, r), 2.0);
                float halo = pow(1.0 - smoothstep(0.1, 1.0, r), 2.4) * 0.28;
                float b = (core + halo) * uNight * uPulse;
                if (b < 0.004) discard;
                // Mercury-vapour blue-white, and brighter than 1 so the core
                // tone-maps to a hard point rather than a pale smudge.
                gl_FragColor = vec4(vec3(0.62, 0.80, 1.0) * b * 4.2, 1.0);
            }
        `,
        transparent: false,
        depthWrite: false,
        fog: false
    });
    farLight = new THREE.Mesh(geom, mat);
    // Deep in the woods off the north-west corner: 56 m out, just past the far
    // tree band (which reaches ~46 m) so there is a lot of forest between you and
    // it — but INSIDE the painted backdrop wall, which is an opaque cylinder at
    // 64 m and hid this completely at its first position of 75 m.
    // Up at 5 m — well above the undergrowth and most of the trunk clutter. At
    // eye height it spent nearly the whole time behind a tree; the trees here are
    // 10 m, so this is still inside the canopy, just up where a window would be.
    farLight.position.set(-33, 5.0, -45);
    farLight.renderOrder = 1;
    farLight.visible = false;
    scene.add(farLight);
    sharedAssets._farLightMat = mat;
}

function updateFarForestLight(now) {
    if (!farLight || !farLight.visible) return;
    farLight.quaternion.copy(camera.quaternion);
    // Slow unsteadiness, and every so often it drops out for a second or two.
    const t = now / 1000;
    const breathe = 0.72 + 0.28 * Math.sin(t * 0.29) * Math.sin(t * 0.11 + 2.0);
    const gap = THREE.MathUtils.smoothstep(Math.sin(t * 0.041), -0.999, -0.986);
    farLight.material.uniforms.uPulse.value = breathe * gap;
}

// --- Glowing red eyes at the forest edge (night only) ---

function createEyeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0,   'rgba(255, 120, 60, 1)');
    grad.addColorStop(0.3, 'rgba(255, 30, 0, 0.85)');
    grad.addColorStop(0.7, 'rgba(180, 0, 0, 0.25)');
    grad.addColorStop(1,   'rgba(120, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function buildHauntedEyes() {
    const tex = createEyeTexture();
    const PAIRS = 6;
    for (let i = 0; i < PAIRS; i++) {
        const mat = new THREE.SpriteMaterial({
            map: tex,
            color: 0xff2200,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false
        });
        const left = new THREE.Sprite(mat);
        const right = new THREE.Sprite(mat);
        left.scale.set(0.16, 0.16, 1);
        right.scale.set(0.16, 0.16, 1);
        left.visible = false;
        right.visible = false;
        scene.add(left);
        scene.add(right);
        eyePairs.push({
            material: mat,
            left, right,
            state: 'off',
            // Stagger initial appearance so they don't all spawn together
            nextEvent: performance.now() + 4000 + Math.random() * 30000,
            transitionStart: 0,
            transitionEnd: 0
        });
    }
}

function pickEyeForestPoint() {
    const side = Math.floor(Math.random() * 4);
    const dist = 11 + Math.random() * 9;
    const y = 1.3 + Math.random() * 0.5;
    if (side === 0) return new THREE.Vector3(-8 - dist, y, -50 + Math.random() * 60);
    if (side === 1) return new THREE.Vector3( 8 + dist, y, -50 + Math.random() * 60);
    if (side === 2) return new THREE.Vector3(-25 + Math.random() * 50, y, -45 - dist);
    return                new THREE.Vector3(-25 + Math.random() * 50, y,   5 + dist);
}

function updateHauntedEyes(now) {
    const isNight = currentDayness < 0.4;
    for (const pair of eyePairs) {
        if (!isNight) {
            if (pair.state !== 'off') {
                pair.state = 'off';
                pair.left.visible = false;
                pair.right.visible = false;
                pair.material.opacity = 0;
                pair.nextEvent = now + 5000 + Math.random() * 10000;
            }
            continue;
        }
        switch (pair.state) {
            case 'off':
                if (now >= pair.nextEvent) {
                    const c = pickEyeForestPoint();
                    pair.left.position.set(c.x - 0.05, c.y, c.z);
                    pair.right.position.set(c.x + 0.05, c.y, c.z);
                    pair.left.visible = true;
                    pair.right.visible = true;
                    pair.state = 'fadeIn';
                    pair.transitionStart = now;
                    pair.transitionEnd = now + 1000 + Math.random() * 1200;
                }
                break;
            case 'fadeIn': {
                const t = (now - pair.transitionStart) / (pair.transitionEnd - pair.transitionStart);
                pair.material.opacity = Math.min(t, 1);
                if (t >= 1) {
                    pair.state = 'hold';
                    pair.nextEvent = now + 2000 + Math.random() * 4500;
                }
                break;
            }
            case 'hold':
                if (now >= pair.nextEvent) {
                    pair.state = 'fadeOut';
                    pair.transitionStart = now;
                    pair.transitionEnd = now + 700 + Math.random() * 700;
                }
                break;
            case 'fadeOut': {
                const t = (now - pair.transitionStart) / (pair.transitionEnd - pair.transitionStart);
                pair.material.opacity = Math.max(1 - t, 0);
                if (t >= 1) {
                    pair.state = 'off';
                    pair.left.visible = false;
                    pair.right.visible = false;
                    pair.nextEvent = now + 5000 + Math.random() * 18000;
                }
                break;
            }
        }
    }
}

function updateTreeWind(now) {
    if (treeMaterials.length === 0) return;

    let strength;
    if (currentDayness < 0.5) {
        strength = 0;
    } else {
        // Roughly every 22 s, a 5 s gust during the day
        const cycle = (now / 1000) % 22;
        if (cycle < 5) {
            const t = cycle / 5;
            strength = Math.sin(t * Math.PI) * 0.09 + 0.004;
        } else {
            strength = 0.004;
        }
    }

    for (const mat of treeMaterials) {
        if (!mat.userData.shader) continue;
        mat.userData.shader.uniforms.uTime.value = now / 1000;
        mat.userData.shader.uniforms.uWindStrength.value = strength;
    }
}

// --- Wet interior: puddles, roof drips with ripples, floating dust ---

function buildPuddles() {
    // Irregular glossy puddles in the walking aisle and under table edges.
    const puddleGeoms = [];
    const spots = [
        [0.4, -3.2, 1.0], [-0.8, -9.5, 1.3], [1.1, -15.8, 0.8], [-0.3, -22.5, 1.5],
        [0.7, -29.0, 1.0], [-1.0, -35.5, 1.2], [0.2, -41.0, 0.9],
        [-5.6, -12.0, 0.9], [5.8, -26.0, 1.1], [-5.9, -33.0, 0.8]
    ];
    for (const [px, pz, size] of spots) {
        const pts = [];
        const lobes = 9;
        for (let i = 0; i < lobes; i++) {
            const a = (i / lobes) * Math.PI * 2;
            const r = size * (0.55 + Math.random() * 0.45);
            pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
        }
        const shape = new THREE.Shape();
        shape.splineThru(pts);
        shape.closePath();
        const g = new THREE.ShapeGeometry(shape, 12);
        g.rotateX(-Math.PI / 2);
        g.translate(px, 0, pz);
        puddleGeoms.push(g);
    }
    const merged = mergeGeometries(puddleGeoms);
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x0c1012,
        // Standing water is close to a mirror, but the only thing there is to
        // mirror in here is a bright sky directly overhead — so at an environment
        // strength of 1.5 these came back as flat white cut-outs lying on the
        // floor, brighter than anything else in the room. Water reads as water
        // because it is *dark* with a sharp highlight, not because it is bright.
        roughness: 0.09,
        metalness: 0,
        envMapIntensity: 0.5,
        clearcoat: 0.7,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.9
    });
    const puddles = new THREE.Mesh(merged, mat);
    puddles.position.y = 0.012;
    puddles.receiveShadow = true;
    scene.add(puddles);
}

function buildGreenhouseParticles() {
    // Roof height at a given x (gable: ridge y=11 at x=0 down to y=6 at |x|=8)
    const roofY = (x) => 11 - Math.abs(x) * (5 / 8);

    // --- Drips: condensation falling from the roof glass ---
    const DRIPS = 45;
    const positions = new Float32Array(DRIPS * 3);
    const speeds = new Float32Array(DRIPS);
    for (let i = 0; i < DRIPS; i++) {
        const x = -7.5 + Math.random() * 15;
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = Math.random() * roofY(x);
        positions[i * 3 + 2] = -44 + Math.random() * 48;
        speeds[i] = 2.6 + Math.random() * 2.0;
    }
    const dripGeom = new THREE.BufferGeometry();
    dripGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Shader points with a HARD pixel clamp. Drops respawn anywhere in the
    // walkable area, so one will eventually fall straight through the camera —
    // an unclamped attenuated point then explodes to thousands of pixels and
    // rasterizes as a giant garbage-black quad on some GPU backends.
    const dripMat = new THREE.ShaderMaterial({
        vertexShader: `
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = clamp(30.0 / max(0.6, -mv.z), 1.0, 9.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float a = smoothstep(0.5, 0.12, d);
                gl_FragColor = vec4(0.75, 0.85, 0.92, a * 0.55);
            }
        `,
        transparent: true,
        depthWrite: false
    });
    const dripPoints = new THREE.Points(dripGeom, dripMat);
    dripPoints.frustumCulled = false;
    scene.add(dripPoints);
    dripSystem = { points: dripPoints, positions, speeds, roofY };

    // --- Ripple pool: rings that expand where drips land ---
    // Broad and faint. A narrow bright ring on a dark floor does not read as
    // water — it reads as a drawn circle, which is exactly what the old
    // 0.75→0.85 ring at 0.45 opacity looked like once the night ambient came down.
    const rippleGeom = new THREE.RingGeometry(0.5, 0.9, 24);
    rippleGeom.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xcfe4f0,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(rippleGeom, mat);
        ring.position.y = 0.016;
        ring.visible = false;
        scene.add(ring);
        ripplePool.push({ mesh: ring, age: 0, active: false });
    }

    // --- Dust motes / pollen drifting through the air ---
    const DUST = 260;
    const dustPos = new Float32Array(DUST * 3);
    const dustPhase = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
        dustPos[i * 3 + 0] = -7.5 + Math.random() * 15;
        dustPos[i * 3 + 1] = 0.3 + Math.random() * 5.0;
        dustPos[i * 3 + 2] = -44 + Math.random() * 48;
        dustPhase[i] = Math.random() * Math.PI * 2;
    }
    const dustGeom = new THREE.BufferGeometry();
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeom.setAttribute('aPhase', new THREE.BufferAttribute(dustPhase, 1));
    const dustMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 0.2 }
        },
        vertexShader: `
            uniform float uTime;
            attribute float aPhase;
            void main() {
                vec3 p = position;
                p.x += sin(uTime * 0.13 + aPhase) * 0.4;
                p.y += sin(uTime * 0.09 + aPhase * 2.0) * 0.3;
                p.z += cos(uTime * 0.11 + aPhase) * 0.4;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = min(2.2 * (14.0 / max(1.0, -mv.z)), 7.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uIntensity;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float falloff = smoothstep(0.5, 0.05, d);
                gl_FragColor = vec4(vec3(0.95, 0.92, 0.82), falloff * uIntensity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    dustSystem = new THREE.Points(dustGeom, dustMat);
    dustSystem.frustumCulled = false;
    scene.add(dustSystem);
}

// --- Night garnish: ground fog, condensation on the panes, one restless vine ---

// Cold air settling onto a warm wet floor after dark. Three horizontal planes
// rather than a volume: at eye height you are looking along them, so each one
// reads as a sheet of haze lying in the aisle, and three stacked at different
// drift rates give it depth without a single ray-march.
//
// NormalBlending with alpha as density, not additive: fog's whole job here is to
// *hide* the floor as it recedes. Additive would leave the floor's contrast
// intact and paint a pale film over the top of it.
let groundFog = null;
const groundFogMats = [];
function buildGroundFog() {
    // Each layer gets its own material rather than sharing one. They sample the
    // same noise function, so with a shared uniform block all three would show the
    // *same* patch of fog stacked on itself; uOffset decorrelates them, which is
    // what makes three planes read as a volume.
    const LAYERS = [
        { y: 0.10, scale: 0.95, drift: 0.013, alpha: 1.0, offset: [0, 0] },
        { y: 0.24, scale: 1.05, drift: -0.009, alpha: 0.7, offset: [11.3, 4.1] },
        { y: 0.42, scale: 1.15, drift: 0.006, alpha: 0.42, offset: [3.7, 19.6] }
    ];
    groundFog = new THREE.Group();
    groundFogMats.length = 0;
    const geom = new THREE.PlaneGeometry(17, 54);
    geom.rotateX(-Math.PI / 2);
    const baseMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uNight: { value: 0 },
            uAlpha: { value: 1 },
            uOffset: { value: new THREE.Vector2() },
            uColor: { value: new THREE.Color(0x9fb4bd) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vViewPos;
            varying vec3 vViewNormal;
            void main() {
                vUv = uv;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vViewPos = mv.xyz;
                vViewNormal = normalMatrix * normal;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uNight;
            uniform float uAlpha;
            uniform vec2 uOffset;
            uniform vec3 uColor;
            varying vec2 vUv;
            varying vec3 vViewPos;
            varying vec3 vViewNormal;
            // Value noise. Two octaves is plenty — fog has no fine detail, and
            // any more just costs fill rate on a plane this large on screen.
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float vnoise(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                           mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
            }
            void main() {
                vec2 uv = vUv * vec2(6.0, 19.0) + uOffset;
                float n = vnoise(uv + vec2(uTime, uTime * 0.6)) * 0.65
                        + vnoise(uv * 2.7 - vec2(uTime * 1.7, 0.0)) * 0.35;
                n = smoothstep(0.42, 0.95, n);
                // Thin out toward the ends of the house so the sheet has no edge,
                // and fade the few metres nearest the camera: you are standing in
                // this, and un-faded it becomes a flat wash across the screen.
                // Fade every edge of the sheet, sides as well as ends. Without the
                // side fade the plane's own boundary lands on the floor as a
                // straight-edged pale rectangle in each near corner — the layers
                // are wider than the house, so that edge is inside the view.
                float ends = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y))
                           * smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
                float near = smoothstep(2.5, 9.0, length(vViewPos));
                // Grazing term — the whole reason this reads as fog rather than as
                // paint. A sheet of haze contributes in proportion to how much of
                // it a sightline crosses: looking along it, metres; looking
                // straight down at it, millimetres. Without this the layer nearest
                // the camera is seen face-on and lands on the floor as a flat
                // white smear.
                vec3 nrm = normalize(vViewNormal);
                float grazing = pow(1.0 - abs(dot(nrm, normalize(-vViewPos))), 2.0);
                float a = n * ends * near * grazing * uNight * uAlpha * 0.42;
                if (a < 0.004) discard;
                gl_FragColor = vec4(uColor, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
    });
    for (const L of LAYERS) {
        const mat = baseMat.clone();
        mat.uniforms.uAlpha.value = L.alpha;
        mat.uniforms.uOffset.value.set(L.offset[0], L.offset[1]);
        const m = new THREE.Mesh(geom, mat);
        m.position.set(0, L.y, -20);
        m.scale.set(L.scale, 1, 1);
        m.renderOrder = 2;
        m.userData.fogLayer = L;
        groundFog.add(m);
        groundFogMats.push(mat);
    }
    baseMat.dispose();
    groundFog.visible = false;
    scene.add(groundFog);
}

// Condensation gathering on the inside of the wall panes, running down in fits
// and starts, then letting go and falling. Each drop carries its own stall timer
// — a real runnel hangs up on a speck of grime, swells, and goes again.
let paneDrops = null;
function buildPaneCondensation() {
    const COUNT = 30;
    const pos = new Float32Array(COUNT * 3);
    const state = [];
    for (let i = 0; i < COUNT; i++) {
        const s = {
            x: (i % 2 === 0 ? -1 : 1) * 7.72,
            y: 1.4 + Math.random() * 3.4,
            z: -44 + Math.random() * 48,
            v: 0,
            stall: Math.random() * 3,
            falling: false
        };
        state.push(s);
        pos[i * 3] = s.x; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = s.z;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
        uniforms: { uNight: { value: 0 } },
        vertexShader: `
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                // Hard clamp — a drop can pass close to the camera, and an
                // unclamped attenuated point becomes a screen-filling quad.
                gl_PointSize = clamp(26.0 / max(0.6, -mv.z), 1.0, 7.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            void main() {
                vec2 p = gl_PointCoord - vec2(0.5);
                // Slightly taller than wide: a bead of water on glass, not a dot.
                p.y *= 0.62;
                float a = smoothstep(0.5, 0.1, length(p));
                if (a < 0.02) discard;
                gl_FragColor = vec4(0.80, 0.88, 0.94, a * 0.5);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    scene.add(points);
    paneDrops = { points, positions: pos, state };
}

function updatePaneCondensation(delta) {
    if (!paneDrops) return;
    const { positions, state } = paneDrops;
    for (let i = 0; i < state.length; i++) {
        const s = state[i];
        if (s.stall > 0) {
            // Hung up on the glass, swelling. Nothing moves.
            s.stall -= delta;
        } else if (!s.falling) {
            // Creeping down the pane, held back by surface tension.
            s.v = Math.min(0.35, s.v + delta * 0.5);
            s.y -= s.v * delta;
            if (Math.random() < delta * 0.7) { s.stall = 0.4 + Math.random() * 2.5; s.v = 0; }
            // Occasionally it detaches from the glass entirely and drops.
            if (Math.random() < delta * 0.06) { s.falling = true; s.v = 0.4; }
        } else {
            s.v += delta * 9.8;
            s.y -= s.v * delta;
            s.x += (s.x > 0 ? -1 : 1) * delta * 0.05; // clears the wall base as it goes
        }
        if (s.y <= 0.03) {
            if (s.falling) spawnRipple(s.x, s.z);
            s.x = (i % 2 === 0 ? -1 : 1) * 7.72;
            s.y = 2.4 + Math.random() * 3.2;
            s.z = -44 + Math.random() * 48;
            s.v = 0;
            s.falling = false;
            s.stall = Math.random() * 4;
        }
        positions[i * 3] = s.x;
        positions[i * 3 + 1] = s.y;
        positions[i * 3 + 2] = s.z;
    }
    paneDrops.points.geometry.attributes.position.needsUpdate = true;
}

// One vine that will not hold still. Everything else in here is merged into a
// single static mesh, which is the right call for 300 metres of ivy — but a room
// where nothing at all moves reads as a photograph. This is a separate group
// pivoted at the beam it hangs from, swinging on two beats so it never looks like
// a metronome.
let swayVine = null;
function buildSwayingVine() {
    const anchor = new THREE.Vector3(-1.7, 3.0, -11.0);
    const pts = [];
    const len = 1.9;
    for (let s = 0; s <= 6; s++) {
        const f = s / 6;
        pts.push(new THREE.Vector3(
            Math.sin(f * 2.2) * 0.16,
            -f * len,
            Math.sin(f * 3.1) * 0.1
        ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    swayVine = new THREE.Group();
    swayVine.position.copy(anchor);
    const stem = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 22, 0.012, 5, false),
        new THREE.MeshStandardMaterial({ color: 0x3c4a24, roughness: 0.9, metalness: 0 })
    );
    swayVine.add(stem);

    const leafMat = new THREE.MeshStandardMaterial({
        map: makeIvyLeafTexture(), alphaTest: 0.4, transparent: false,
        side: THREE.DoubleSide, roughness: 0.75, metalness: 0
    });
    const leafGeom = new THREE.PlaneGeometry(1, 1);
    const COUNT = 22;
    const leaves = new THREE.InstancedMesh(leafGeom, leafMat, COUNT);
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();
    for (let i = 0; i < COUNT; i++) {
        const p = curve.getPointAt(Math.min(0.99, (i + 0.5) / COUNT));
        _e.set(Math.random() * 0.9 - 0.45, Math.random() * Math.PI * 2, Math.random() * 0.9 - 0.45);
        _q.setFromEuler(_e);
        const s = 0.075 + Math.random() * 0.06;
        _m.compose(
            new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.05, p.y, p.z + (Math.random() - 0.5) * 0.05),
            _q, new THREE.Vector3(s, s, s));
        leaves.setMatrixAt(i, _m);
    }
    leaves.instanceMatrix.needsUpdate = true;
    leaves.frustumCulled = false;
    swayVine.add(leaves);
    scene.add(swayVine);
}

function updateSwayingVine(now) {
    if (!swayVine) return;
    const t = now / 1000;
    // Two incommensurate periods, so the swing never repeats on a beat you can
    // count. Amplitude is a couple of degrees — draughty, not windy.
    swayVine.rotation.z = Math.sin(t * 0.41) * 0.045 + Math.sin(t * 0.97 + 1.1) * 0.016;
    swayVine.rotation.x = Math.sin(t * 0.33 + 2.0) * 0.03;
}

function spawnRipple(x, z) {
    const free = ripplePool.find(r => !r.active);
    if (!free) return;
    free.active = true;
    free.age = 0;
    free.mesh.position.x = x;
    free.mesh.position.z = z;
    free.mesh.visible = true;
}

function updateParticles(now, delta) {
    const t = now / 1000;

    // Drips fall, land, and respawn at the roof
    if (dripSystem) {
        const { points, positions, speeds, roofY } = dripSystem;
        for (let i = 0; i < speeds.length; i++) {
            positions[i * 3 + 1] -= speeds[i] * delta;
            if (positions[i * 3 + 1] <= 0.02) {
                if (Math.random() < 0.6) spawnRipple(positions[i * 3], positions[i * 3 + 2]);
                const x = -7.5 + Math.random() * 15;
                positions[i * 3 + 0] = x;
                positions[i * 3 + 1] = roofY(x) - Math.random() * 1.5;
                positions[i * 3 + 2] = -44 + Math.random() * 48;
            }
        }
        points.geometry.attributes.position.needsUpdate = true;
    }

    // Ripples expand and fade over ~0.9 s
    for (const r of ripplePool) {
        if (!r.active) continue;
        r.age += delta;
        const k = r.age / 0.9;
        if (k >= 1) {
            r.active = false;
            r.mesh.visible = false;
            continue;
        }
        const s = 0.08 + k * 0.55;
        r.mesh.scale.set(s, 1, s);
        // Fades in fast then out, so it never appears at full strength — a ripple
        // is a disturbance you half-notice, not an outline.
        r.mesh.material.opacity = 0.17 * Math.min(1, k * 6) * (1 - k) * (1 - k);
    }

    // Dust + firefly shader clocks
    if (dustSystem) dustSystem.material.uniforms.uTime.value = t;
    if (fireflySystem) fireflySystem.material.uniforms.uTime.value = t;

    // Night garnish: fog sheets drift at their own rates, condensation runs.
    if (groundFog) {
        groundFog.visible = groundFogMats[0].uniforms.uNight.value > 0.02;
        if (groundFog.visible) {
            for (let i = 0; i < groundFog.children.length; i++) {
                const layer = groundFog.children[i];
                groundFogMats[i].uniforms.uTime.value = t * 0.02;
                // Each sheet creeps along the house at its own pace; the parallax
                // between them is what reads as depth in three flat planes.
                layer.position.z = -20 + Math.sin(t * layer.userData.fogLayer.drift) * 6;
            }
        }
    }
    updatePaneCondensation(delta);

    // Ground mist drifts slowly through the trees; denser at night
    const mistDayFactor = 0.06 + (1 - currentDayness) * 0.16;
    for (const sprite of mistSprites) {
        sprite.position.x += sprite.userData.vx * delta;
        sprite.position.z += sprite.userData.vz * delta;
        // Keep mist out of the greenhouse and from wandering off into the void
        const p = sprite.position;
        const insideX = p.x > GREENHOUSE_BOUNDS.xMin - 1 && p.x < GREENHOUSE_BOUNDS.xMax + 1;
        const insideZ = p.z > GREENHOUSE_BOUNDS.zMin - 1 && p.z < GREENHOUSE_BOUNDS.zMax + 1;
        if ((insideX && insideZ) || Math.abs(p.x) > 60 || p.z < -100 || p.z > 50) {
            sprite.userData.vx *= -1;
            sprite.userData.vz *= -1;
        }
        sprite.material.opacity = sprite.userData.baseOpacity * mistDayFactor
            * (0.85 + 0.15 * Math.sin(t * 0.21 + p.x));
    }
}

// --- Vines, ivy, hanging baskets, big ferns (interior overgrowth) ---

function makeIvyLeafTexture() {
    if (sharedAssets.ivyTex) return sharedAssets.ivyTex;
    const SIZE = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Three-lobed ivy leaf pointing down, stem at top
    const grad = ctx.createRadialGradient(32, 30, 4, 32, 32, 32);
    grad.addColorStop(0, '#4f8a3c');
    grad.addColorStop(0.7, '#33632a');
    grad.addColorStop(1, '#1d4019');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(32, 6);                                  // stem joint
    ctx.bezierCurveTo(14, 4, 2, 18, 10, 30);            // left basal lobe
    ctx.bezierCurveTo(2, 36, 12, 50, 22, 44);           // left mid lobe
    ctx.bezierCurveTo(24, 56, 40, 56, 42, 44);          // center tip
    ctx.bezierCurveTo(52, 50, 62, 36, 54, 30);          // right mid lobe
    ctx.bezierCurveTo(62, 18, 50, 4, 32, 6);            // right basal lobe
    ctx.closePath();
    ctx.fill();
    // Veins
    ctx.strokeStyle = 'rgba(190, 220, 170, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 8); ctx.lineTo(32, 52);
    ctx.moveTo(32, 22); ctx.lineTo(14, 32);
    ctx.moveTo(32, 22); ctx.lineTo(50, 32);
    ctx.moveTo(32, 14); ctx.lineTo(12, 18);
    ctx.moveTo(32, 14); ctx.lineTo(52, 18);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedAssets.ivyTex = tex;
    return tex;
}

function buildVinesAndIvy() {
    const tubeGeoms = [];
    const leafMatrices = [];
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();

    // One vine: tube along a curve + leaf transforms scattered along it
    function addVine(points, leafEvery = 0.1, leafScale = 1) {
        const curve = new THREE.CatmullRomCurve3(points);
        const len = curve.getLength();
        const segs = Math.max(6, Math.floor(len * 5));
        tubeGeoms.push(new THREE.TubeGeometry(curve, segs, 0.013, 5, false));
        const count = Math.max(2, Math.floor(len / leafEvery));
        for (let i = 0; i < count; i++) {
            const tt = Math.min(0.98, (i + Math.random() * 0.6) / count);
            const p = curve.getPointAt(tt);
            _e.set(Math.random() * 0.9 - 0.45, Math.random() * Math.PI * 2, Math.random() * 0.9 - 0.45);
            _q.setFromEuler(_e);
            const s = (0.07 + Math.random() * 0.07) * leafScale;
            _m.compose(
                new THREE.Vector3(
                    p.x + (Math.random() - 0.5) * 0.06,
                    p.y + (Math.random() - 0.5) * 0.06,
                    p.z + (Math.random() - 0.5) * 0.06
                ),
                _q,
                new THREE.Vector3(s, s, s)
            );
            leafMatrices.push(_m.clone());
        }
    }

    // 1. Ivy climbing the side walls from the floor (inside, hugging the glass)
    for (const wx of [-7.75, 7.75]) {
        for (let i = 0; i < 5; i++) {
            const z0 = -42 + Math.random() * 44;
            const h = 3.2 + Math.random() * 2.2;
            const pts = [];
            const steps = 6;
            for (let s = 0; s <= steps; s++) {
                const f = s / steps;
                pts.push(new THREE.Vector3(
                    wx + (Math.random() - 0.5) * 0.18,
                    f * h,
                    z0 + Math.sin(f * Math.PI * 2 + i) * 0.7 + (Math.random() - 0.5) * 0.3
                ));
            }
            addVine(pts, 0.1);
        }
    }

    // 2. Vines dangling from the cross beams (y=3) over the aisle and tables
    for (let beam = 0; beam < 10; beam++) {
        const bz = -beam * 4;
        const danglers = 2 + (beam % 2);
        for (let d = 0; d < danglers; d++) {
            const bx = -6 + Math.random() * 12;
            const len = 0.9 + Math.random() * 1.4;
            const sway = (Math.random() - 0.5) * 0.5;
            const pts = [];
            const steps = 4;
            for (let s = 0; s <= steps; s++) {
                const f = s / steps;
                pts.push(new THREE.Vector3(
                    bx + sway * f * f,
                    3.0 - f * len,
                    bz + Math.sin(f * Math.PI) * 0.2
                ));
            }
            addVine(pts, 0.09);
        }
    }

    // 3. Runners weaving along the trellises above the tables
    for (const tx of [-3, 3]) {
        for (let run = 0; run < 3; run++) {
            const z0 = -36 + run * 14 + Math.random() * 4;
            const runLen = 6 + Math.random() * 5;
            const pts = [];
            const steps = 7;
            for (let s = 0; s <= steps; s++) {
                const f = s / steps;
                pts.push(new THREE.Vector3(
                    tx + Math.sin(f * Math.PI * 3) * 0.65,
                    3.04 + Math.sin(f * Math.PI * 5) * 0.06 - (s % 2) * 0.12,
                    z0 + f * runLen
                ));
            }
            addVine(pts, 0.09);
        }
    }

    const stemMat = new THREE.MeshStandardMaterial({
        color: 0x3c4a24, roughness: 0.9, metalness: 0
    });
    const stems = new THREE.Mesh(mergeGeometries(tubeGeoms), stemMat);
    stems.castShadow = false;
    stems.receiveShadow = false;
    scene.add(stems);

    const ivyMat = new THREE.MeshStandardMaterial({
        map: makeIvyLeafTexture(),
        alphaTest: 0.4,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: 0.75,
        metalness: 0
    });
    const leafGeom = new THREE.PlaneGeometry(1, 1);
    const leaves = new THREE.InstancedMesh(leafGeom, ivyMat, leafMatrices.length);
    for (let i = 0; i < leafMatrices.length; i++) leaves.setMatrixAt(i, leafMatrices[i]);
    leaves.instanceMatrix.needsUpdate = true;
    leaves.frustumCulled = false;
    scene.add(leaves);

    buildHangingBaskets();
    buildBigFerns();
}

function buildHangingBaskets() {
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x1f140b });
    const foliageMat = new THREE.MeshStandardMaterial({
        map: makeFoliageClumpTexture(),
        alphaTest: 0.45,
        transparent: false,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
        color: 0x9cc488
    });

    const basketSpots = [
        [-3, -6], [3, -10], [-3, -18], [3, -26], [-3, -34]
    ];
    for (const [bx, bz] of basketSpots) {
        const g = new THREE.Group();
        g.position.set(bx + (Math.random() - 0.5) * 0.8, 2.35, bz);

        const bowl = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
            potMat
        );
        bowl.castShadow = true;
        g.add(bowl);
        const soil = new THREE.Mesh(new THREE.CircleGeometry(0.25, 14), soilMat);
        soil.rotation.x = -Math.PI / 2;
        soil.position.y = 0.01;
        g.add(soil);

        // Three cords up to the cross-beam level (y=3 world)
        const cordLen = 3.0 - g.position.y;
        for (let c = 0; c < 3; c++) {
            const a = (c / 3) * Math.PI * 2;
            const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, cordLen, 4), cordMat);
            const topX = 0, topZ = 0;
            const botX = Math.cos(a) * 0.24, botZ = Math.sin(a) * 0.24;
            cord.position.set((topX + botX) / 2, cordLen / 2, (topZ + botZ) / 2);
            cord.rotation.z = Math.atan2(botX - topX, cordLen);
            cord.rotation.x = -Math.atan2(botZ - topZ, cordLen);
            g.add(cord);
        }

        // Foliage tuft bursting out of the bowl
        for (let f = 0; f < 3; f++) {
            const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), foliageMat);
            quad.position.y = 0.16;
            quad.rotation.set((Math.random() - 0.5) * 0.5, (f / 3) * Math.PI, (Math.random() - 0.5) * 0.4);
            g.add(quad);
        }

        // Trailing strands spilling over the rim
        const ivyMat = new THREE.MeshStandardMaterial({
            map: makeIvyLeafTexture(), alphaTest: 0.4, side: THREE.DoubleSide,
            roughness: 0.75, metalness: 0
        });
        const strandLeaf = new THREE.PlaneGeometry(0.09, 0.09);
        for (let v = 0; v < 4; v++) {
            const a = Math.random() * Math.PI * 2;
            const sx = Math.cos(a) * 0.22, sz = Math.sin(a) * 0.22;
            const drop = 0.5 + Math.random() * 0.7;
            for (let s = 0; s < 6; s++) {
                const f = s / 5;
                const leaf = new THREE.Mesh(strandLeaf, ivyMat);
                leaf.position.set(sx * (1 + f * 0.5), 0.02 - f * drop, sz * (1 + f * 0.5));
                leaf.rotation.set(Math.random() * 0.8 - 0.4, Math.random() * Math.PI * 2, Math.random() * 0.8 - 0.4);
                g.add(leaf);
            }
        }
        scene.add(g);
    }
}

function buildBigFerns() {
    const fernTex = makeFernTexture();
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();
    const fernMat = new THREE.MeshStandardMaterial({
        map: fernTex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide,
        roughness: 0.9, metalness: 0, color: 0xc4d8ba
    });

    const spots = [
        [-6.9, -43.6], [6.9, -43.6], [-6.9, 3.6], [6.9, 3.6],
        [-6.9, -20.2], [6.9, -28.4]
    ];
    for (const [fx, fz] of spots) {
        const g = new THREE.Group();
        g.position.set(fx, 0, fz);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.25, 0.42, 16), potMat);
        pot.position.y = 0.21;
        pot.castShadow = true;
        pot.receiveShadow = true;
        g.add(pot);
        const soil = new THREE.Mesh(new THREE.CircleGeometry(0.31, 14), soilMat);
        soil.rotation.x = -Math.PI / 2;
        soil.position.y = 0.41;
        g.add(soil);
        const fronds = 4;
        for (let f = 0; f < fronds; f++) {
            const quad = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.15), fernMat);
            quad.position.y = 0.95;
            quad.rotation.y = (f / fronds) * Math.PI;
            quad.rotation.z = (Math.random() - 0.5) * 0.15;
            g.add(quad);
        }
        g.rotation.y = Math.random() * Math.PI * 2;
        g.scale.setScalar(0.85 + Math.random() * 0.4);
        scene.add(g);
    }
}

// --- Mess: moss, fallen leaves, and worn clutter props ---

function makeMossTexture() {
    if (sharedAssets.mossTex) return sharedAssets.mossTex;
    const SIZE = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 350; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.pow(Math.random(), 0.5) * SIZE * 0.46;
        const x = SIZE / 2 + Math.cos(a) * d;
        const y = SIZE / 2 + Math.sin(a) * d;
        const g = 70 + Math.random() * 60;
        ctx.fillStyle = `rgba(${g * 0.45|0},${g|0},${g * 0.35|0},${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedAssets.mossTex = tex;
    return tex;
}

function buildClutter() {
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();

    // --- Fallen leaves scattered on floor and tabletops ---
    const ivyTex = makeIvyLeafTexture();
    const leafMat = new THREE.MeshStandardMaterial({
        map: ivyTex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide,
        roughness: 0.95, metalness: 0
    });
    const FALLEN = 240;
    const fallen = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMat, FALLEN);
    const tint = new THREE.Color();
    for (let i = 0; i < FALLEN; i++) {
        const onTable = i % 5 === 0; // every 5th leaf litters a tabletop
        let x, y, z;
        if (onTable) {
            x = (Math.random() < 0.5 ? -3 : 3) + (Math.random() - 0.5) * 1.8;
            y = 1.057;
            z = -Math.floor(Math.random() * 10) * 4 + (Math.random() - 0.5) * 2.8;
        } else {
            x = -7.4 + Math.random() * 14.8;
            y = 0.018;
            z = -44 + Math.random() * 48;
        }
        _e.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.35, 0, Math.random() * Math.PI * 2, 'YXZ');
        _q.setFromEuler(_e);
        const s = 0.06 + Math.random() * 0.07;
        _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
        fallen.setMatrixAt(i, _m);
        // Browns through sickly greens — dead and dying litter
        tint.setHSL(0.06 + Math.random() * 0.16, 0.5 + Math.random() * 0.3, 0.25 + Math.random() * 0.2);
        fallen.setColorAt(i, tint);
    }
    fallen.instanceMatrix.needsUpdate = true;
    if (fallen.instanceColor) fallen.instanceColor.needsUpdate = true;
    fallen.frustumCulled = false;
    scene.add(fallen);

    // --- Moss patches on the wood bases and table corners ---
    const mossMat = new THREE.MeshStandardMaterial({
        map: makeMossTexture(), alphaTest: 0.3, transparent: false, side: THREE.DoubleSide,
        roughness: 1, metalness: 0
    });
    const MOSS = 70;
    const mossGeom = new THREE.CircleGeometry(0.5, 10);
    mossGeom.rotateX(-Math.PI / 2);
    const moss = new THREE.InstancedMesh(mossGeom, mossMat, MOSS);
    for (let i = 0; i < MOSS; i++) {
        let x, y, z;
        const where = i % 3;
        if (where === 0) {        // top of side wood bases
            x = (Math.random() < 0.5 ? -8 : 8) + (Math.random() - 0.5) * 0.12;
            y = 1.205;
            z = -44 + Math.random() * 48;
        } else if (where === 1) { // table corners / edges
            x = (Math.random() < 0.5 ? -3 : 3) + (Math.random() < 0.5 ? -0.85 : 0.85);
            y = 1.052;
            z = -Math.floor(Math.random() * 10) * 4 + (Math.random() < 0.5 ? -1.3 : 1.3);
        } else {                  // damp floor against the walls
            x = (Math.random() < 0.5 ? -1 : 1) * (6.6 + Math.random() * 0.8);
            y = 0.016;
            z = -44 + Math.random() * 48;
        }
        _e.set(0, Math.random() * Math.PI * 2, 0);
        _q.setFromEuler(_e);
        // Ledge moss stays small — the wood base top is only 0.2 m wide and a
        // wide disc would float in mid-air past its edge.
        const s = where === 0 ? 0.12 + Math.random() * 0.1 : 0.25 + Math.random() * 0.55;
        _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, 1, s));
        moss.setMatrixAt(i, _m);
        // Desaturated and dark. The tint multiplies an already-green texture, so a
        // saturated green here squares up into flat kelly-green plates on the
        // benches — moss growing in the dark under a bench is nearly black-green,
        // and only the odd patch by a window is bright.
        tint.setHSL(0.27 + Math.random() * 0.07, 0.16 + Math.random() * 0.16, 0.16 + Math.random() * 0.12);
        moss.setColorAt(i, tint);
    }
    moss.instanceMatrix.needsUpdate = true;
    if (moss.instanceColor) moss.instanceColor.needsUpdate = true;
    moss.frustumCulled = false;
    scene.add(moss);

    // --- Stacked wooden crates in the front corner ---
    const crateMat = makeWoodMaterial({ repeat: [1, 1], roughness: 0.9, color: 0x9a7c58 });
    const crates = [
        { p: [-6.6, 0.35, -43.2], s: 0.7, ry: 0.1 },
        { p: [-5.7, 0.3, -43.5], s: 0.6, ry: -0.35 },
        { p: [-6.4, 0.99, -43.3], s: 0.58, ry: 0.5 }
    ];
    for (const c of crates) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(c.s, c.s, c.s), crateMat);
        crate.position.set(c.p[0], c.p[1], c.p[2]);
        crate.rotation.y = c.ry;
        crate.castShadow = true;
        crate.receiveShadow = true;
        scene.add(crate);
    }

    // --- Galvanized watering can by the aisle ---
    const galvMat = new THREE.MeshStandardMaterial({ color: 0x8a9298, metalness: 0.85, roughness: 0.4 });
    const can = new THREE.Group();
    can.position.set(1.15, 0, -9.4);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 14), galvMat);
    body.position.y = 0.15;
    body.castShadow = true;
    can.add(body);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.36, 8), galvMat);
    spout.position.set(0.2, 0.22, 0);
    spout.rotation.z = -Math.PI / 3.2;
    can.add(spout);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 12, Math.PI), galvMat);
    handle.position.set(-0.13, 0.27, 0);
    handle.rotation.z = Math.PI / 2.4;
    can.add(handle);
    can.rotation.y = 0.7;
    scene.add(can);

    // --- Tipped-over broken pot with spilled soil and shards ---
    const tipped = new THREE.Group();
    tipped.position.set(-1.35, 0, -23.2);
    const tpot = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.105, 0.2, 18, 1, true), potMat);
    tpot.rotation.z = Math.PI / 2;
    tpot.rotation.y = 0.4;
    tpot.position.y = 0.13;
    tpot.castShadow = true;
    tipped.add(tpot);
    const spill = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), soilMat);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0.28, 0.017, 0.05);
    spill.scale.set(1.4, 1, 0.8);
    tipped.add(spill);
    for (let s = 0; s < 3; s++) {
        const shard = new THREE.Mesh(new THREE.CircleGeometry(0.06 + Math.random() * 0.04, 3), potMat);
        shard.position.set(0.2 + Math.random() * 0.4, 0.02, -0.2 + Math.random() * 0.4);
        shard.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.5, 0, Math.random() * Math.PI);
        tipped.add(shard);
    }
    tipped.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tipped);

    // --- Coiled garden hose by the door ---
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x274d2a, roughness: 0.6, metalness: 0 });
    const hose = new THREE.Group();
    hose.position.set(6.7, 0, 3.5);
    for (let h = 0; h < 3; h++) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.32 - h * 0.015, 0.028, 8, 20), hoseMat);
        loop.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.12;
        loop.position.y = 0.035 + h * 0.055;
        loop.castShadow = true;
        hose.add(loop);
    }
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.16, 8), galvMat);
    nozzle.position.set(0.34, 0.05, 0.12);
    nozzle.rotation.z = Math.PI / 2.4;
    hose.add(nozzle);
    scene.add(hose);

    // --- Bags of potting soil slumped against the bases ---
    // One open and half used with its contents spilling out, one still sealed and
    // lying flat where it was dropped, plus a third leaning further down the row.
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x33281c, roughness: 1, metalness: 0 });
    const bags = [
        { p: [7.45, 0.3, -12.3], rot: [0, 0, 0.42], s: [1, 0.85, 0.6], spill: [7.1, -12.0] },
        { p: [7.3, 0.18, -13.4], rot: [0, 0.6, Math.PI / 2], s: [1, 0.8, 0.65], spill: null },
        { p: [-7.4, 0.31, -30.6], rot: [0, -0.3, -0.38], s: [1, 0.9, 0.6], spill: [-7.05, -30.2] }
    ];
    for (const b of bags) {
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 4, 10), bagMat);
        bag.scale.set(b.s[0], b.s[1], b.s[2]);
        bag.position.set(b.p[0], b.p[1], b.p[2]);
        bag.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
        bag.castShadow = true;
        bag.receiveShadow = true;
        scene.add(bag);
        if (!b.spill) continue;
        const bagSpill = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), soilMat);
        bagSpill.rotation.x = -Math.PI / 2;
        bagSpill.position.set(b.spill[0], 0.017, b.spill[1]);
        bagSpill.scale.set(1.3, 1, 0.9);
        scene.add(bagSpill);
    }

    // --- Stacks of empty pots, nested rim-to-rim ---
    // Nested pots do not sit one on top of another; each drops most of the way
    // into the one below, so a stack of six is only about knee high and every rim
    // shows as a ring. The lean accumulates up the stack the way a real one does.
    const stacks = [
        { x: -6.2, z: -18.4, n: 7, lean: 0.035, ry: 0.4 },
        { x: 6.4, z: -37.2, n: 5, lean: -0.05, ry: -1.1 },
        // Kept out of the centre aisle: nothing here has collision, and a stack
        // in the walkway is a stack you walk straight through every lap.
        { x: 5.95, z: 2.6, n: 4, lean: 0.06, ry: 2.2 }
    ];
    stacks.forEach((st, si) => {
        const g = new THREE.Group();
        g.position.set(st.x, 0, st.z);
        g.rotation.y = st.ry;
        const stackMat = getPotVariantMaterial(si * 2);
        const bodyGeom = new THREE.CylinderGeometry(0.155, 0.105, 0.2, 16, 1, true);
        const rimGeom = new THREE.TorusGeometry(0.155, 0.012, 6, 16);
        for (let i = 0; i < st.n; i++) {
            const y = 0.045 * i;      // nesting depth, not pot height
            const tilt = st.lean * i;
            const body = new THREE.Mesh(bodyGeom, stackMat);
            body.position.set(Math.sin(tilt) * 0.1 * i, y + 0.1, 0);
            body.rotation.z = tilt;
            body.rotation.y = i * 1.3;
            body.castShadow = true;
            body.receiveShadow = true;
            g.add(body);
            const rim = new THREE.Mesh(rimGeom, stackMat);
            rim.position.set(body.position.x, y + 0.205, 0);
            rim.rotation.set(Math.PI / 2, 0, tilt);
            g.add(rim);
        }
        scene.add(g);
    });

    // --- Water rings and dirt smudges staining the tabletops ---
    const stainCanvas = document.createElement('canvas');
    stainCanvas.width = stainCanvas.height = 128;
    const sctx = stainCanvas.getContext('2d');
    sctx.clearRect(0, 0, 128, 128);
    // Ragged ring (where a wet pot sat) with a faint inner blotch
    sctx.strokeStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i++) {
        sctx.lineWidth = 3 + Math.random() * 4;
        sctx.beginPath();
        sctx.arc(64, 64, 44 - i * 3, Math.random() * 2, Math.random() * 2 + Math.PI * (1.4 + Math.random() * 0.6));
        sctx.stroke();
    }
    sctx.fillStyle = 'rgba(255,255,255,0.22)';
    sctx.beginPath();
    sctx.arc(64, 64, 38, 0, Math.PI * 2);
    sctx.fill();
    const stainTex = new THREE.CanvasTexture(stainCanvas);
    const stainMat = new THREE.MeshBasicMaterial({
        color: 0x241608,
        alphaMap: stainTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2
    });
    const stainGeom = new THREE.PlaneGeometry(1, 1);
    stainGeom.rotateX(-Math.PI / 2);
    const STAINS = 60;
    const stains = new THREE.InstancedMesh(stainGeom, stainMat, STAINS);
    for (let i = 0; i < STAINS; i++) {
        const x = (Math.random() < 0.5 ? -3 : 3) + (Math.random() - 0.5) * 1.7;
        const z = -Math.floor(Math.random() * 10) * 4 + (Math.random() - 0.5) * 2.7;
        _e.set(0, Math.random() * Math.PI * 2, 0);
        _q.setFromEuler(_e);
        const s = 0.14 + Math.random() * 0.26;
        _m.compose(new THREE.Vector3(x, 1.0515, z), _q, new THREE.Vector3(s, 1, s));
        stains.setMatrixAt(i, _m);
    }
    stains.instanceMatrix.needsUpdate = true;
    stains.frustumCulled = false;
    scene.add(stains);
}

// --- Flower variants (one is randomly chosen per completed todo) ---

const NUM_FLOWER_VARIANTS = 5;

// Curved, cupped petal geometry: base at origin extending +Y, edges cupping
// toward +Z (concave inner face), tip curling toward -Z. Dense segments so the
// silhouette reads organic instead of polygonal. `curl` < 0 wraps the tip
// inward instead (rose hearts, tulip cups).
function makeRealisticPetal(width, length, opts = {}) {
    const {
        cup = 0.4,        // edge lift across the width
        curl = 0.45,      // tip bend along the length (negative = inward)
        tipShape = 1.0,   // >1 pointier tip, <1 rounder
        baseWidth = 0.3   // fraction of width kept at the very base
    } = opts;
    const geom = new THREE.PlaneGeometry(width, length, 8, 14);
    geom.translate(0, length / 2, 0);
    const pos = geom.attributes.position;
    const halfW = width / 2;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const t = THREE.MathUtils.clamp(y / length, 0, 1);
        const profile = Math.pow(Math.sin(t * Math.PI), tipShape) * (1 - baseWidth) + baseWidth;
        const nx = x * profile;
        pos.setX(i, nx);
        const cupZ = cup * Math.pow(Math.abs(nx) / halfW, 2) * halfW;
        const curlZ = -curl * t * t * length * 0.45;
        // faint lengthwise mid-vein crease
        const crease = -0.12 * (1 - Math.abs(nx) / halfW) * halfW * Math.sin(t * Math.PI);
        pos.setZ(i, cupZ + curlZ + crease);
    }
    geom.computeVertexNormals();
    return geom;
}

// Bake a base→tip color gradient into the petal's vertices. Real petals are
// never one flat color — the base sits deeper/greener and the tip carries the
// display color. Used with vertexColors materials; survives geometry cloning
// and merging, so the gradient costs nothing per flower.
function applyPetalGradient(geom, baseHex, tipHex) {
    const base = new THREE.Color(baseHex);
    const tip = new THREE.Color(tipHex);
    const pos = geom.attributes.position;
    // Petal extends 0..length along +Y; find length from the geometry itself
    let maxY = 0;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const t = THREE.MathUtils.clamp(pos.getY(i) / maxY, 0, 1);
        c.copy(base).lerp(tip, Math.pow(t, 0.75));
        colors[i * 3 + 0] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geom;
}

// Matte organic petal material with velvety sheen — no emissive glow. Petals
// should catch light like tissue, not radiate like plastic toys.
function makePetalMaterial(hex, opts = {}) {
    const { rough = 0.55, sheen = 0.5, clearcoat = 0, vertexColors = false } = opts;
    return new THREE.MeshPhysicalMaterial({
        color: hex,
        vertexColors,
        roughness: rough,
        metalness: 0,
        sheen,
        sheenColor: new THREE.Color(0xffffff),
        sheenRoughness: 0.6,
        clearcoat,
        clearcoatRoughness: 0.35,
        side: THREE.DoubleSide,
        envMapIntensity: 0.45
    });
}

// Place a petal: ring rotation -> radial/height offset -> outward tilt -> roll
// -> scale. Tilt is "outward lean" (0 = vertical, ~1.4 = nearly flat); the
// rotation signs keep the cupped (concave) face toward the flower center.
const _petalM = new THREE.Matrix4();
const _petalTmp = new THREE.Matrix4();
function petalMatrix(ringAngle, tilt, y, radial, scale, roll = 0) {
    _petalM.makeRotationY(ringAngle);
    _petalTmp.makeTranslation(0, y, -radial); _petalM.multiply(_petalTmp);
    _petalTmp.makeRotationX(-tilt); _petalM.multiply(_petalTmp);
    if (roll) { _petalTmp.makeRotationZ(roll); _petalM.multiply(_petalTmp); }
    if (scale !== 1) { _petalTmp.makeScale(scale, scale, scale); _petalM.multiply(_petalTmp); }
    return _petalM;
}

// One whorl of petals with natural per-petal jitter, appended pre-transformed
// to `list` for merging into a single draw call per material.
function addPetalRing(list, petalGeom, count, { tilt, y = 0, radial = 0, scale = 1, phase = 0, jitter = 0.12 }) {
    for (let i = 0; i < count; i++) {
        const g = petalGeom.clone();
        g.applyMatrix4(petalMatrix(
            (i / count) * Math.PI * 2 + phase + (Math.random() - 0.5) * jitter,
            tilt + (Math.random() - 0.5) * jitter,
            y, radial,
            scale * (0.9 + Math.random() * 0.2),
            (Math.random() - 0.5) * jitter * 1.5
        ));
        list.push(g);
    }
}

// Sunflower-style phyllotaxis spiral over a slightly domed disc.
function addPhyllotaxis(list, srcGeom, count, radius, { y = 0, dome = 0.25, scaleMin = 0.8, scaleMax = 1.2 } = {}) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const r = radius * Math.sqrt((i + 0.5) / count);
        const a = i * golden;
        const g = srcGeom.clone();
        const s = scaleMin + Math.random() * (scaleMax - scaleMin);
        _petalM.makeTranslation(
            Math.cos(a) * r,
            y + dome * radius * (1 - (r / radius) * (r / radius)),
            Math.sin(a) * r
        );
        _petalTmp.makeScale(s, s, s);
        _petalM.multiply(_petalTmp);
        g.applyMatrix4(_petalM);
        list.push(g);
    }
}

// Green calyx (sepal star) tucked under every bloom so it joins the stem.
function getCalyxAssets() {
    if (sharedAssets.calyx) return sharedAssets.calyx;
    sharedAssets.calyx = {
        geom: applyPetalGradient(
            makeRealisticPetal(0.018, 0.034, { cup: 0.3, curl: 0.7, tipShape: 1.6, baseWidth: 0.5 }),
            0x29401e, 0x5f8042
        ),
        mat: new THREE.MeshPhysicalMaterial({
            color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0,
            sheen: 0.3, sheenColor: new THREE.Color(0xa8c890), sheenRoughness: 0.6,
            side: THREE.DoubleSide, envMapIntensity: 0.4
        })
    };
    return sharedAssets.calyx;
}

function buildCalyx(scale = 1) {
    const a = getCalyxAssets();
    const parts = [];
    addPetalRing(parts, a.geom, 5, { tilt: 1.45, y: 0.002, radial: 0.004, scale });
    return new THREE.Mesh(mergeGeometries(parts), a.mat);
}

function getDaisyAssets() {
    if (sharedAssets.daisy) return sharedAssets.daisy;
    const baseGeom = new THREE.SphereGeometry(0.02, 12, 8);
    baseGeom.scale(1, 0.45, 1);
    sharedAssets.daisy = {
        petalGeom: applyPetalGradient(
            makeRealisticPetal(0.018, 0.066, { cup: 0.25, curl: 0.3, tipShape: 0.8, baseWidth: 0.35 }),
            0xcdbf94, 0xfbf8ef
        ),
        petalMat: makePetalMaterial(0xffffff, { rough: 0.6, sheen: 0.55, vertexColors: true }),
        floretGeom: new THREE.SphereGeometry(0.0032, 5, 4),
        floretMat: new THREE.MeshPhysicalMaterial({ color: 0xc8860f, roughness: 0.85, metalness: 0 }),
        baseGeom,
        baseMat: new THREE.MeshPhysicalMaterial({ color: 0x6e7e2e, roughness: 0.8, metalness: 0 })
    };
    return sharedAssets.daisy;
}

function buildFlower_Daisy() {
    const a = getDaisyAssets();
    const group = new THREE.Group();
    // Disc florets — a true 3D dome of tiny florets, not a painted ball
    const florets = [];
    addPhyllotaxis(florets, a.floretGeom, 60, 0.0205, { y: 0.012, dome: 0.45 });
    group.add(new THREE.Mesh(mergeGeometries(florets), a.floretMat));
    const base = new THREE.Mesh(a.baseGeom, a.baseMat);
    base.position.y = 0.008;
    group.add(base);
    // Two offset whorls of white ray petals with a relaxed droop
    const petals = [];
    addPetalRing(petals, a.petalGeom, 18, { tilt: 1.42, y: 0.012, radial: 0.012 });
    addPetalRing(petals, a.petalGeom, 14, { tilt: 1.26, y: 0.014, radial: 0.010, scale: 0.85, phase: 0.22 });
    group.add(new THREE.Mesh(mergeGeometries(petals), a.petalMat));
    group.add(buildCalyx(1.1));
    return group;
}

function getSunflowerAssets() {
    if (sharedAssets.sunflower) return sharedAssets.sunflower;
    const discGeom = new THREE.SphereGeometry(0.043, 16, 10);
    discGeom.scale(1, 0.32, 1);
    sharedAssets.sunflower = {
        discGeom,
        discMat: new THREE.MeshPhysicalMaterial({ color: 0x3a2210, roughness: 0.95, metalness: 0 }),
        seedGeom: new THREE.ConeGeometry(0.0028, 0.006, 5),
        seedMat: new THREE.MeshPhysicalMaterial({ color: 0x1c0f06, roughness: 1, metalness: 0 }),
        petalGeom: applyPetalGradient(
            makeRealisticPetal(0.02, 0.085, { cup: 0.3, curl: 0.35, tipShape: 1.5, baseWidth: 0.25 }),
            0x8a4206, 0xf2b322
        ),
        petalMat: makePetalMaterial(0xffffff, { rough: 0.55, sheen: 0.45, vertexColors: true }),
        innerPetalMat: makePetalMaterial(0xc89058, { rough: 0.55, sheen: 0.45, vertexColors: true })
    };
    return sharedAssets.sunflower;
}

function buildFlower_Sunflower() {
    const a = getSunflowerAssets();
    const group = new THREE.Group();
    const disc = new THREE.Mesh(a.discGeom, a.discMat);
    disc.position.y = 0.012;
    group.add(disc);
    // Seed head — phyllotaxis spiral of tiny cones, like a real sunflower disc
    const seeds = [];
    addPhyllotaxis(seeds, a.seedGeom, 110, 0.04, { y: 0.018, dome: 0.32 });
    group.add(new THREE.Mesh(mergeGeometries(seeds), a.seedMat));
    const outer = [];
    addPetalRing(outer, a.petalGeom, 21, { tilt: 1.38, y: 0.012, radial: 0.04 });
    group.add(new THREE.Mesh(mergeGeometries(outer), a.petalMat));
    const inner = [];
    addPetalRing(inner, a.petalGeom, 16, { tilt: 1.18, y: 0.016, radial: 0.036, scale: 0.8, phase: 0.15 });
    group.add(new THREE.Mesh(mergeGeometries(inner), a.innerPetalMat));
    group.add(buildCalyx(1.7));
    return group;
}

function getRoseAssets() {
    if (sharedAssets.rose) return sharedAssets.rose;
    sharedAssets.rose = {
        // Inner petals wrap inward (negative curl) into the classic spiral heart;
        // outer petals relax and roll back outward.
        innerGeom: applyPetalGradient(
            makeRealisticPetal(0.03, 0.042, { cup: 0.9, curl: -0.5, tipShape: 0.7, baseWidth: 0.55 }),
            0x2c0206, 0x6e0c1a
        ),
        midGeom: applyPetalGradient(
            makeRealisticPetal(0.042, 0.055, { cup: 0.75, curl: -0.15, tipShape: 0.75, baseWidth: 0.5 }),
            0x42040e, 0x9c1830
        ),
        outerGeom: applyPetalGradient(
            makeRealisticPetal(0.055, 0.062, { cup: 0.55, curl: 0.4, tipShape: 0.8, baseWidth: 0.45 }),
            0x560818, 0xc04060
        ),
        innerMat: makePetalMaterial(0xffffff, { rough: 0.5, sheen: 0.6, vertexColors: true }),
        midMat:   makePetalMaterial(0xffffff, { rough: 0.5, sheen: 0.6, vertexColors: true }),
        outerMat: makePetalMaterial(0xffffff, { rough: 0.5, sheen: 0.6, vertexColors: true })
    };
    return sharedAssets.rose;
}

function buildFlower_Rose() {
    const a = getRoseAssets();
    const group = new THREE.Group();
    const inner = [];
    addPetalRing(inner, a.innerGeom, 4,  { tilt: 0.18, y: 0.020, radial: 0.002, scale: 0.8, jitter: 0.2 });
    addPetalRing(inner, a.innerGeom, 6,  { tilt: 0.45, y: 0.016, radial: 0.006, phase: 0.5, jitter: 0.18 });
    group.add(new THREE.Mesh(mergeGeometries(inner), a.innerMat));
    const mid = [];
    addPetalRing(mid, a.midGeom, 8,  { tilt: 0.78, y: 0.012, radial: 0.009, phase: 0.2 });
    addPetalRing(mid, a.midGeom, 11, { tilt: 1.05, y: 0.008, radial: 0.012, scale: 1.08, phase: 0.65 });
    group.add(new THREE.Mesh(mergeGeometries(mid), a.midMat));
    const outer = [];
    addPetalRing(outer, a.outerGeom, 14, { tilt: 1.32, y: 0.004, radial: 0.014, phase: 0.35 });
    group.add(new THREE.Mesh(mergeGeometries(outer), a.outerMat));
    group.add(buildCalyx(1.3));
    return group;
}

function getTulipAssets() {
    if (sharedAssets.tulip) return sharedAssets.tulip;
    sharedAssets.tulip = {
        petalGeom: applyPetalGradient(
            makeRealisticPetal(0.038, 0.082, { cup: 0.85, curl: -0.25, tipShape: 1.2, baseWidth: 0.55 }),
            0xe6d2b4, 0xa22850 // pale waxy base flaring into the deep tip — classic tulip
        ),
        // Waxy tulip petals — a touch of clearcoat for that glossy skin
        outerMat: makePetalMaterial(0xffffff, { rough: 0.45, sheen: 0.4, clearcoat: 0.5, vertexColors: true }),
        innerMat: makePetalMaterial(0xffe2ea, { rough: 0.45, sheen: 0.4, clearcoat: 0.5, vertexColors: true }),
        stamenGeom: new THREE.CylinderGeometry(0.0028, 0.0024, 0.05, 5),
        anther: new THREE.CapsuleGeometry(0.0034, 0.008, 3, 6),
        stamenMat: new THREE.MeshPhysicalMaterial({ color: 0x2c2418, roughness: 0.8, metalness: 0 })
    };
    return sharedAssets.tulip;
}

function buildFlower_Tulip() {
    const a = getTulipAssets();
    const group = new THREE.Group();
    const outer = [];
    addPetalRing(outer, a.petalGeom, 3, { tilt: 0.42, y: 0.0, radial: 0.012, jitter: 0.08 });
    group.add(new THREE.Mesh(mergeGeometries(outer), a.outerMat));
    const inner = [];
    addPetalRing(inner, a.petalGeom, 3, { tilt: 0.28, y: 0.002, radial: 0.008, phase: Math.PI / 3, scale: 0.94, jitter: 0.08 });
    group.add(new THREE.Mesh(mergeGeometries(inner), a.innerMat));
    const stamens = [];
    for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const stalk = a.stamenGeom.clone();
        stalk.translate(Math.cos(ang) * 0.007, 0.028, Math.sin(ang) * 0.007);
        stamens.push(stalk);
        const tip = a.anther.clone();
        tip.translate(Math.cos(ang) * 0.007, 0.056, Math.sin(ang) * 0.007);
        stamens.push(tip);
    }
    group.add(new THREE.Mesh(mergeGeometries(stamens), a.stamenMat));
    group.add(buildCalyx(1.0));
    return group;
}

function getHydrangeaAssets() {
    if (sharedAssets.hydrangea) return sharedAssets.hydrangea;
    // One floret = four tiny cupped petals around a dot center — real geometry,
    // merged per color into a mophead.
    const floretPetal = applyPetalGradient(
        makeRealisticPetal(0.016, 0.024, { cup: 0.25, curl: 0.15, tipShape: 0.7, baseWidth: 0.4 }),
        0x9ab886, 0xf6f4ff // greenish heart fading to near-white; material tint sets the hue
    );
    const parts = [];
    addPetalRing(parts, floretPetal, 4, { tilt: 1.2, y: 0, radial: 0.003, jitter: 0.18 });
    const floretGeom = mergeGeometries(parts);
    sharedAssets.hydrangea = {
        floretGeom,
        centerGeom: new THREE.SphereGeometry(0.0028, 5, 4),
        centerMat: new THREE.MeshPhysicalMaterial({ color: 0xe8e2c0, roughness: 0.8, metalness: 0 }),
        blueMat:   makePetalMaterial(0x8fa8d8, { rough: 0.6, sheen: 0.5, vertexColors: true }),
        violetMat: makePetalMaterial(0xb09cd6, { rough: 0.6, sheen: 0.5, vertexColors: true }),
        pinkMat:   makePetalMaterial(0xd8a0bc, { rough: 0.6, sheen: 0.5, vertexColors: true })
    };
    return sharedAssets.hydrangea;
}

function buildFlower_Hydrangea() {
    const a = getHydrangeaAssets();
    const lists = [[], [], []];
    const centers = [];
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const COUNT = 46, R = 0.052;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
        const u = (i + 0.5) / COUNT;
        const phi = Math.acos(1 - 1.05 * u); // upper cap of the sphere
        const theta = i * golden;
        n.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        q.setFromUnitVectors(up, n);
        const s = 0.85 + Math.random() * 0.3;
        m.compose(
            new THREE.Vector3(n.x * R, n.y * R * 0.75 + 0.02, n.z * R),
            q,
            new THREE.Vector3(s, s, s)
        );
        const g = a.floretGeom.clone();
        g.applyMatrix4(m);
        lists[(i * 7) % 3].push(g);
        const c = a.centerGeom.clone();
        c.applyMatrix4(m);
        centers.push(c);
    }
    const group = new THREE.Group();
    [a.blueMat, a.violetMat, a.pinkMat].forEach((mat, idx) => {
        if (lists[idx].length) group.add(new THREE.Mesh(mergeGeometries(lists[idx]), mat));
    });
    group.add(new THREE.Mesh(mergeGeometries(centers), a.centerMat));
    group.add(buildCalyx(1.4));
    return group;
}

function buildFlowerByVariant(variantIdx) {
    const v = ((variantIdx | 0) % NUM_FLOWER_VARIANTS + NUM_FLOWER_VARIANTS) % NUM_FLOWER_VARIANTS;
    switch (v) {
        case 0: return buildFlower_Daisy();
        case 1: return buildFlower_Sunflower();
        case 2: return buildFlower_Rose();
        case 3: return buildFlower_Tulip();
        case 4: return buildFlower_Hydrangea();
    }
    return buildFlower_Daisy();
}

function createLeafGeometry() {
    if (sharedAssets.leafGeom) return sharedAssets.leafGeom;
    const geom = new THREE.PlaneGeometry(0.18, 0.22, 6, 8);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = -Math.pow(x / 0.09, 2) * 0.03 + Math.pow((y + 0.11) / 0.22, 1.5) * 0.022;
        pos.setZ(i, z);
    }
    geom.computeVertexNormals();
    sharedAssets.leafGeom = geom;
    return geom;
}

// Stem surface: faint vertical fiber streaks so stems read as plant tissue
// instead of extruded plastic. Texture is shared; the material is fresh per
// plant because updatePlantVisual tints `material.color` as health changes.
function getStemTexture() {
    if (sharedAssets.stemTex) return sharedAssets.stemTex;
    const W = 64, H = 128;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9fb37a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * W;
        const light = Math.random() < 0.5;
        ctx.strokeStyle = light
            ? `rgba(205, 225, 160, ${0.15 + Math.random() * 0.3})`
            : `rgba(70, 95, 45, ${0.15 + Math.random() * 0.3})`;
        ctx.lineWidth = 0.6 + Math.random() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x + (Math.random() - 0.5) * 6, H + 4);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    sharedAssets.stemTex = tex;
    return tex;
}

function makeStemMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: 0x55833f,
        map: getStemTexture(),
        roughness: 0.7,
        metalness: 0,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xa8cc8a),
        sheenRoughness: 0.6
    });
}

// --- Plant Generation Logic ---
const tablePositions = []; // To track where to put next plant

function buildGreenhouse() {
    // Collect table positions for plant placement
    for (let i = 0; i < 10; i++) {
        const zPos = -i * 4;

        // Define grid points on left table (2x3 grid)
        for(let xOffset = -0.5; xOffset <= 0.5; xOffset += 1.0) {
            for(let zOffset = -1.0; zOffset <= 1.0; zOffset += 1.0) {
                tablePositions.push(new THREE.Vector3(-3 + xOffset, 1.05, zPos + zOffset));
            }
        }

        // Define grid points on right table (2x3 grid)
        for(let xOffset = -0.5; xOffset <= 0.5; xOffset += 1.0) {
            for(let zOffset = -1.0; zOffset <= 1.0; zOffset += 1.0) {
                tablePositions.push(new THREE.Vector3(3 + xOffset, 1.05, zPos + zOffset));
            }
        }
    }

    // Empty pots — InstancedMesh (one per pot piece) for all 120 positions
    createEmptyPotsInstanced();

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floor = new THREE.Mesh(floorGeometry, getDirtFloorMaterial());
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Tables — InstancedMesh for tops + legs across all 20 tables
    // Grey-brown tint + high roughness ages the hardwood into decades-old,
    // water-stained potting benches instead of fresh showroom planks.
    const tableMaterial = makeWoodMaterial({ repeat: [2, 3], roughness: 0.92, color: 0xbdb2a0 });
    const numTables = 10;
    const tableSpacing = 4;
    const totalTables = numTables * 2;

    const topGeom = new THREE.BoxGeometry(2, 0.1, 3);
    const legGeom = new THREE.BoxGeometry(0.1, 1.0, 0.1);
    const topsMesh = new THREE.InstancedMesh(topGeom, tableMaterial, totalTables);
    const legsMesh = new THREE.InstancedMesh(legGeom, tableMaterial, totalTables * 4);
    topsMesh.castShadow = topsMesh.receiveShadow = true;
    legsMesh.castShadow = legsMesh.receiveShadow = true;

    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(1, 1, 1);
    const legOffsets = [
        [-0.9, -1.4], [0.9, -1.4],
        [-0.9, 1.4], [0.9, 1.4]
    ];
    let topIdx = 0;
    let legIdx = 0;
    for (let i = 0; i < numTables; i++) {
        const zPos = -i * tableSpacing;
        for (const x of [-3, 3]) {
            _m.compose(new THREE.Vector3(x, 1.0, zPos), _q, _s);
            topsMesh.setMatrixAt(topIdx++, _m);
            for (const [lx, lz] of legOffsets) {
                _m.compose(new THREE.Vector3(x + lx, 0.5, zPos + lz), _q, _s);
                legsMesh.setMatrixAt(legIdx++, _m);
            }
        }
    }
    topsMesh.instanceMatrix.needsUpdate = true;
    legsMesh.instanceMatrix.needsUpdate = true;
    scene.add(topsMesh);
    scene.add(legsMesh);

    // Greenhouse Structure
    const glassMat = getWallGlassMaterial();
    const roofGlassMat = getRoofGlassMaterial();
    const copperMat = getCopperMaterial();

    const ghGroup = new THREE.Group();

    const woodMat = makeWoodMaterial({ repeat: [1, 8], roughness: 0.9, color: 0xa98e6d });
    // Weathered wood for the rafters/trusses — darker, more saturated
    const rafterMat = makeWoodMaterial({ repeat: [4, 1], roughness: 0.92, color: 0x8a6a48 });

    // Waist-level Wood Bases
    const baseHeight = 1.2;
    const wallHeight = 4.8; // glass section height (top of glass at y=6)
    const totalLength = 50;
    const totalWidth = 16;
    const zCenter = -20;
    const wallTopY = baseHeight + wallHeight; // 6
    const ridgeY = wallTopY + 5;               // 11 — peak of gable roof
    const halfWidth = totalWidth / 2;          // 8
    const slopeRise = ridgeY - wallTopY;       // 5
    const slopeRun = halfWidth;                // 8
    const slopeLength = Math.hypot(slopeRun, slopeRise); // ~9.434
    const slopeAngle = Math.atan2(slopeRise, slopeRun);  // ~32°

    // Publish the roof planes for buildSunShafts()
    roofShape.wallTopY = wallTopY;
    roofShape.ridgeY = ridgeY;
    roofShape.halfWidth = halfWidth;
    roofShape.zMin = -45;
    roofShape.zMax = -45 + totalLength;

    // Wood Bases
    const leftBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, baseHeight, totalLength), woodMat);
    leftBase.position.set(-8, baseHeight / 2, zCenter);
    ghGroup.add(leftBase);

    const rightBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, baseHeight, totalLength), woodMat);
    rightBase.position.set(8, baseHeight / 2, zCenter);
    ghGroup.add(rightBase);

    const frontBase = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, baseHeight, 0.2), woodMat);
    frontBase.position.set(0, baseHeight / 2, -45);
    ghGroup.add(frontBase);

    // Back base with a gap for the door
    const doorWidth = 2.0;
    const backBaseLeftWidth = (totalWidth - doorWidth) / 2;

    const backBaseLeft = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, baseHeight, 0.2), woodMat);
    backBaseLeft.position.set(-doorWidth / 2 - backBaseLeftWidth / 2, baseHeight / 2, 5);
    ghGroup.add(backBaseLeft);

    const backBaseRight = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, baseHeight, 0.2), woodMat);
    backBaseRight.position.set(doorWidth / 2 + backBaseLeftWidth / 2, baseHeight / 2, 5);
    ghGroup.add(backBaseRight);

    // Glass Walls (above the wood base). The panes are slightly thinner than
    // the bases and sunk 3 cm into them: if the glass bottom face sits exactly
    // on the base top face the two coplanar surfaces z-fight, which showed up
    // as violent flickering along the ledge whenever the camera moved nearby.
    const glassSink = 0.03;
    const glassWallH = wallHeight + glassSink;
    const glassWallY = baseHeight - glassSink + glassWallH / 2;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, glassWallH, totalLength), glassMat);
    leftWall.position.set(-8, glassWallY, zCenter);
    ghGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, glassWallH, totalLength), glassMat);
    rightWall.position.set(8, glassWallY, zCenter);
    ghGroup.add(rightWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, glassWallH, 0.16), glassMat);
    frontWall.position.set(0, glassWallY, -45);
    ghGroup.add(frontWall);

    // Back Wall Glass (also with a gap for the door)
    const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, glassWallH, 0.16), glassMat);
    backWallLeft.position.set(-doorWidth / 2 - backBaseLeftWidth / 2, glassWallY, 5);
    ghGroup.add(backWallLeft);

    const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, glassWallH, 0.16), glassMat);
    backWallRight.position.set(doorWidth / 2 + backBaseLeftWidth / 2, glassWallY, 5);
    ghGroup.add(backWallRight);

    // Top glass above the door — offset 16 cm behind the wall plane so its side
    // faces sit at the same x=±1 planes as the wall-glass end faces but in a
    // disjoint z range (coplanar-but-overlapping faces z-fight), and its bottom
    // edge is buried inside the oversized door-frame header below.
    const doorHeight = 4.0;
    if (baseHeight + wallHeight > doorHeight) {
        const topGlass = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, wallTopY - (doorHeight + 0.06), 0.1),
            glassMat
        );
        topGlass.position.set(0, (doorHeight + 0.06 + wallTopY) / 2, 5.16);
        ghGroup.add(topGlass);
    }

    // ---- Steeple (gable) roof: two flat panels meeting at the ridge ----
    const roofGeomBox = new THREE.BoxGeometry(slopeLength, 0.08, totalLength);

    const leftRoof = new THREE.Mesh(roofGeomBox, roofGlassMat);
    leftRoof.position.set(-halfWidth / 2, (wallTopY + ridgeY) / 2, zCenter);
    leftRoof.rotation.z = slopeAngle;
    ghGroup.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofGeomBox, roofGlassMat);
    rightRoof.position.set(halfWidth / 2, (wallTopY + ridgeY) / 2, zCenter);
    rightRoof.rotation.z = -slopeAngle;
    ghGroup.add(rightRoof);

    // Triangular gable ends (front and back) — glass panes filling the gable
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-halfWidth, 0);
    gableShape.lineTo(halfWidth, 0);
    gableShape.lineTo(0, slopeRise);
    gableShape.closePath();
    const gableGeom = new THREE.ExtrudeGeometry(gableShape, { depth: 0.1, bevelEnabled: false });

    const frontGable = new THREE.Mesh(gableGeom, glassMat);
    frontGable.position.set(0, wallTopY, -45);
    frontGable.rotation.y = Math.PI; // face inward
    ghGroup.add(frontGable);

    const backGable = new THREE.Mesh(gableGeom, glassMat);
    backGable.position.set(0, wallTopY, 5);
    ghGroup.add(backGable);

    // ---- Verdigris copper mullions (vertical bars dividing each glass wall into panes) ----
    const mullionThickness = 0.06;
    const mullionDepth = 0.08;

    // Long-wall mullions (left & right). 8 panes per wall → 9 mullions each.
    const longPanes = 8;
    const longMullionGeom = new THREE.BoxGeometry(mullionDepth, wallHeight, mullionThickness);
    for (let i = 0; i <= longPanes; i++) {
        const z = -45 + (totalLength / longPanes) * i;
        for (const x of [-halfWidth - 0.04, halfWidth + 0.04]) {
            const m = new THREE.Mesh(longMullionGeom, copperMat);
            m.position.set(x, wallTopY - wallHeight / 2, z);
            m.userData.detail = true;
            ghGroup.add(m);
        }
    }

    // Short-wall mullions (front & back). 4 panes per wall → 5 mullions, but skip door area on back.
    const shortPanes = 4;
    const shortMullionGeom = new THREE.BoxGeometry(mullionThickness, wallHeight, mullionDepth);
    for (let i = 0; i <= shortPanes; i++) {
        const x = -halfWidth + (totalWidth / shortPanes) * i;
        // Front wall (z = -45)
        const fm = new THREE.Mesh(shortMullionGeom, copperMat);
        fm.position.set(x, wallTopY - wallHeight / 2, -45 - 0.04);
        fm.userData.detail = true;
        ghGroup.add(fm);
        // Back wall (z = 5) — skip if mullion would land in the door gap
        if (Math.abs(x) > 1.05) {
            const bm = new THREE.Mesh(shortMullionGeom, copperMat);
            bm.position.set(x, wallTopY - wallHeight / 2, 5 + 0.04);
            bm.userData.detail = true;
            ghGroup.add(bm);
        }
    }

    // Horizontal mid-rail along all four walls (one long rail per wall)
    const midY = wallTopY - wallHeight / 2;
    const longRailGeom = new THREE.BoxGeometry(mullionDepth, mullionThickness, totalLength);
    for (const x of [-halfWidth - 0.04, halfWidth + 0.04]) {
        const rail = new THREE.Mesh(longRailGeom, copperMat);
        rail.position.set(x, midY, zCenter);
        rail.userData.detail = true;
        ghGroup.add(rail);
    }
    const frontRail = new THREE.Mesh(
        new THREE.BoxGeometry(totalWidth, mullionThickness, mullionDepth),
        copperMat
    );
    frontRail.position.set(0, midY, -45 - 0.04);
    frontRail.userData.detail = true;
    ghGroup.add(frontRail);

    // Cap rail at top of glass walls (along all four walls) — copper
    const longCapGeom = new THREE.BoxGeometry(0.12, 0.1, totalLength);
    for (const x of [-halfWidth, halfWidth]) {
        const cap = new THREE.Mesh(longCapGeom, copperMat);
        cap.position.set(x, wallTopY, zCenter);
        cap.userData.detail = true;
        ghGroup.add(cap);
    }
    const shortCapGeom = new THREE.BoxGeometry(totalWidth, 0.1, 0.12);
    const frontCap = new THREE.Mesh(shortCapGeom, copperMat);
    frontCap.position.set(0, wallTopY, -45);
    frontCap.userData.detail = true;
    ghGroup.add(frontCap);
    const backCap = new THREE.Mesh(shortCapGeom, copperMat);
    backCap.position.set(0, wallTopY, 5);
    backCap.userData.detail = true;
    ghGroup.add(backCap);

    // Glass Door at the back wall (entrance)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, doorHeight / 2, 5.05); // Slightly offset from back wall

    // Door Frame — deliberately oversized. The uprights are centered exactly on
    // the x=±1 planes where the back-wall glass ends, and the header is
    // centered on the y=4 plane where the transom glass starts, so every
    // glass edge terminates INSIDE opaque frame volume. Edge-to-edge contact
    // (coplanar faces) is what caused the flickering along the door frame.
    const doorFrameMat = getMetalFrameMaterial();
    const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight + 0.18, 0.35), doorFrameMat);
    doorFrameLeft.position.set(-doorWidth / 2, 0.07, 0);
    doorGroup.add(doorFrameLeft);

    const doorFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight + 0.18, 0.35), doorFrameMat);
    doorFrameRight.position.set(doorWidth / 2, 0.07, 0);
    doorGroup.add(doorFrameRight);

    const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.5, 0.16, 0.35), doorFrameMat);
    doorFrameTop.position.set(0, doorHeight / 2, 0);
    doorGroup.add(doorFrameTop);

    // Glass Pane — floats 2 cm above the floor and tucks its top edge into the
    // header so neither edge touches another surface exactly.
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.2, doorHeight - 0.08, 0.1), glassMat);
    doorGlass.position.set(0, -0.02, 0);
    doorGroup.add(doorGlass);

    // Door handle
    const handleMat = getDoorHandleMaterial();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), handleMat);
    handle.position.set(doorWidth / 2 - 0.2, 0, 0.15);
    doorGroup.add(handle);

    ghGroup.add(doorGroup);

    // ---- Gable trusses (weathered wood) running across the width at intervals ----
    const trussCount = 9;
    const trussSpacing = totalLength / (trussCount - 1);
    const trussBeamThickness = 0.08;
    const trussBeamGeom = new THREE.BoxGeometry(slopeLength, trussBeamThickness, trussBeamThickness);
    const tieBeamGeom = new THREE.BoxGeometry(totalWidth, trussBeamThickness, trussBeamThickness);

    for (let i = 0; i < trussCount; i++) {
        const z = -45 + i * trussSpacing;
        // Left slope beam
        const leftBeam = new THREE.Mesh(trussBeamGeom, rafterMat);
        leftBeam.position.set(-halfWidth / 2, (wallTopY + ridgeY) / 2 - 0.06, z);
        leftBeam.rotation.z = slopeAngle;
        ghGroup.add(leftBeam);
        // Right slope beam
        const rightBeam = new THREE.Mesh(trussBeamGeom, rafterMat);
        rightBeam.position.set(halfWidth / 2, (wallTopY + ridgeY) / 2 - 0.06, z);
        rightBeam.rotation.z = -slopeAngle;
        ghGroup.add(rightBeam);
        // Horizontal tie beam at wall top
        const tieBeam = new THREE.Mesh(tieBeamGeom, rafterMat);
        tieBeam.position.set(0, wallTopY - 0.05, z);
        ghGroup.add(tieBeam);
    }

    // Ridge beam along the roof apex
    const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, totalLength),
        rafterMat
    );
    ridge.position.set(0, ridgeY - 0.06, zCenter);
    ghGroup.add(ridge);

    // ---- Trellis: one above each row of tables (over x = ±3) ----
    const trellisY = 3.0;
    const trellisHalfWidth = 0.7;
    const trellisLengthZ = 42;          // covers tables (z 0 to -36) plus margin
    const trellisCenterZ = -18;
    const trellisStartZ = trellisCenterZ - trellisLengthZ / 2;
    const trellisLongBeamGeom = new THREE.BoxGeometry(0.07, 0.09, trellisLengthZ);
    const trellisSlatGeom = new THREE.BoxGeometry(trellisHalfWidth * 2 + 0.1, 0.04, 0.04);
    const tslatSpacing = 2;
    const tslatCount = Math.floor(trellisLengthZ / tslatSpacing);

    for (const trellisX of [-3, 3]) {
        for (const dx of [-trellisHalfWidth, trellisHalfWidth]) {
            const beam = new THREE.Mesh(trellisLongBeamGeom, rafterMat);
            beam.position.set(trellisX + dx, trellisY, trellisCenterZ);
            beam.userData.detail = true;
            ghGroup.add(beam);
        }
        for (let i = 0; i <= tslatCount; i++) {
            const z = trellisStartZ + i * tslatSpacing;
            const slat = new THREE.Mesh(trellisSlatGeom, rafterMat);
            slat.position.set(trellisX, trellisY + 0.05, z);
            slat.userData.detail = true;
            ghGroup.add(slat);
        }
    }

    // Wide wall-to-wall connector beams perpendicular to the main axis — one per
    // lamp row, so each lamp cord visibly attaches to a beam.
    const crossBeamGeom = new THREE.BoxGeometry(totalWidth - 0.2, 0.12, 0.12);
    for (let i = 0; i < numTables; i++) {
        const zPos = -i * tableSpacing;
        const beam = new THREE.Mesh(crossBeamGeom, rafterMat);
        beam.position.set(0, trellisY, zPos);
        beam.userData.detail = true;
        ghGroup.add(beam);
    }

    // ---- Hooded Edison pendant lamps: one over each table (20 total) ----
    // Lamp components are instanced by piece — 6 InstancedMesh draws total
    // covering all 20 lamps.
    const numLamps = numTables * 2; // 20
    const lampPositions = [];
    for (let i = 0; i < numTables; i++) {
        const zPos = -i * tableSpacing;
        for (const lx of [-3, 3]) lampPositions.push(new THREE.Vector3(lx, 0, zPos));
    }

    // Geometry / position constants
    const cordHeight = 0.3;
    const cordCenterY = trellisY - cordHeight / 2;
    const cordBottomY = trellisY - cordHeight;
    const hoodHeight = 0.22;
    const hoodRimR = 0.3;
    const hoodCenterY = cordBottomY - hoodHeight / 2;
    const hoodBottomY = cordBottomY - hoodHeight;
    // Bulb nests up inside the shade at the reflector's focus (only the tip of
    // the glass peeks below the rim) instead of dangling under it.
    const bulbY = hoodBottomY + 0.05;

    // Shared materials — keep ONE per piece so `bulbMat.emissiveIntensity = ...`
    // updates all 20 bulbs in a single write.
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x1f140b });
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.55, metalness: 0.7 });
    // Painted metal, and metal does not glow. It had a warm emissive before,
    // which lit the *outside* of the shade too and turned every lamp into a
    // floating ember. The bulb is the only thing here that emits; the shade's job
    // is to be opaque and aim the light down, which the geometry already does —
    // the bulb sits 5 cm up inside the rim, and on the few lamps that cast
    // shadows the hood genuinely occludes the upward half of the bulb's output.
    const hoodMat = new THREE.MeshStandardMaterial({
        color: 0x3a2515,
        roughness: 0.4,
        metalness: 0.7,
        side: THREE.DoubleSide
    });
    const filamentMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
    const bulbMat = makeBulbMaterial();
    bulbMeshes.length = 0; // reset (in case of any re-init)

    // Geometries
    const cordGeom = new THREE.CylinderGeometry(0.008, 0.008, cordHeight, 6);
    const socketGeom = new THREE.CylinderGeometry(0.038, 0.046, 0.07, 12);
    // Parabolic shade: radius widens from the socket neck to the rim while the
    // profile drops quadratically — a wide reflector dish with the bulb at its
    // focus, throwing the light down across the whole table.
    const hoodProfile = [];
    const HOOD_SEGS = 10;
    for (let s = 0; s <= HOOD_SEGS; s++) {
        const t = s / HOOD_SEGS;
        hoodProfile.push(new THREE.Vector2(
            0.045 + (hoodRimR - 0.045) * t,
            hoodHeight * (1 - t * t)
        ));
    }
    const hoodGeom = new THREE.LatheGeometry(hoodProfile, 24);
    hoodGeom.translate(0, -hoodHeight / 2, 0); // center on origin like the other pieces
    const bulbGeom = new THREE.SphereGeometry(0.05, 12, 10);
    bulbGeom.scale(1, 1.25, 1);
    const filamentGeom = new THREE.TorusGeometry(0.012, 0.002, 4, 10);

    const cordsMesh = new THREE.InstancedMesh(cordGeom, cordMat, numLamps);
    const socketsMesh = new THREE.InstancedMesh(socketGeom, socketMat, numLamps);
    const hoodsMesh = new THREE.InstancedMesh(hoodGeom, hoodMat, numLamps);
    const bulbsMesh = new THREE.InstancedMesh(bulbGeom, bulbMat, numLamps);
    const filamentsMesh = new THREE.InstancedMesh(filamentGeom, filamentMat, numLamps);
    [cordsMesh, socketsMesh, hoodsMesh, bulbsMesh, filamentsMesh].forEach(m => {
        m.userData.detail = true;
    });

    // Visible haze cone, as emissive *and absorbing* media.
    //
    // This was additive at first, and additive light can only ever brighten — it
    // has no way to hide what is behind it. So the wall grime and the tree line
    // kept their full contrast straight through the beam and read as a ghostly
    // negative laid over the cone. Real dust does two things at once: it scatters
    // light toward you, and it obscures what is behind it. That is exactly
    // `bg * T + L` for transmittance T, and setting L = colour * (1 - T) makes it
    // ordinary alpha-over compositing — so this uses NormalBlending, with alpha as
    // the density of air the sightline crossed. At full density the cone replaces
    // what is behind it instead of tinting it.
    //
    // Because every fragment emits the same colour, the compositing is
    // order-independent (`c·(a₁+a₂−a₁a₂)` either way), which matters: all 20 cones
    // are one InstancedMesh and therefore cannot be depth-sorted against each other.
    //
    // Three terms shape the density:
    //   facing  — follows |dot(normal, view)|, peaking down the middle of the cone
    //             where a sightline crosses the most air and falling to zero at the
    //             silhouette. Removes the hard triangular edge, and is roughly the
    //             real path length through the volume.
    //   along   — dims with distance from the bulb, and closes off both ends. The
    //             ramp at the rim is deliberately short so the shade keeps a crisp
    //             edge instead of dissolving into its own glow.
    //   near    — fades out within ~4 m of the camera, so the cone you are standing
    //             under doesn't fill the screen. Matches how godrays actually read.
    const shaftTopY = hoodBottomY;              // emerges from the shade rim
    // Stop clear of the pot rims rather than at the table top. The pots are the
    // things you aim at and click, and running the haze down through them left
    // them veiled; the lit pool on the bench is the bulb's job anyway.
    const shaftHeight = shaftTopY - 1.24;
    const shaftGeom = new THREE.CylinderGeometry(hoodRimR * 0.95, 0.85, shaftHeight, 24, 1, true);
    // One lamp misbehaves, and its haze cone has to misbehave with it or the
    // flicker reads as a bug in the light rather than a bad fixture. All 20 cones
    // are one InstancedMesh sharing one uniform, so the flickering one is singled
    // out by a per-instance flag: aFlicker is 1 on that lamp and 0 on the rest.
    const shaftFlickerAttr = new THREE.InstancedBufferAttribute(new Float32Array(numLamps), 1);
    const shaftMat = new THREE.ShaderMaterial({
        uniforms: {
            uIntensity: { value: 0 },
            uFlicker: { value: 1 },
            // Radiance of the lit air. Over 1 so the core tone-maps to a warm
            // near-white glow rather than flat orange paint — but only just. This
            // was 1.7 when the room had a generous ambient fill to compete with;
            // against the near-black night ambient the cones at that radiance
            // saturated to opaque white and read as milk-glass lampshades.
            uColor: { value: new THREE.Color(0xffd7a8).multiplyScalar(1.3) }
        },
        vertexShader: `
            attribute float aFlicker;
            varying vec2 vUv;
            varying vec3 vViewPos;
            varying vec3 vViewNormal;
            varying float vFlicker;
            void main() {
                vUv = uv;
                vFlicker = aFlicker;
                // instanceMatrix is pure translation for every lamp, so it does
                // not affect normals and normalMatrix alone is correct here.
                vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                vViewPos = mvPos.xyz;
                vViewNormal = normalMatrix * normal;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform float uIntensity;
            uniform float uFlicker;
            uniform vec3 uColor;
            varying vec2 vUv;
            varying vec3 vViewPos;
            varying vec3 vViewNormal;
            varying float vFlicker;
            void main() {
                vec3 n = normalize(vViewNormal);
                vec3 v = normalize(-vViewPos);
                // A higher exponent keeps the glow as a narrow core down the axis
                // instead of filling the whole cone silhouette evenly, which is
                // what made it read as frosted plastic rather than lit air.
                // The exponent trades core density against edge softness. A dense
                // core is what actually hides the woods; a steep exponent is what
                // keeps the silhouette from going with it and reading as plastic.
                float facing = pow(abs(dot(n, v)), 3.0);
                // v = 1 at the shade rim, 0 at the table top. The top ramp is
                // short on purpose: a long one bled glow up over the shade and
                // lost its edge. The geometry's top rim sits just inside the
                // shade, so the shade occludes the cut itself.
                float along = (1.0 - smoothstep(0.965, 1.0, vUv.y))
                            * smoothstep(0.0, 0.42, vUv.y)
                            * mix(0.35, 1.0, vUv.y);
                // Short fade, and only as a safety margin. This used to ramp from
                // 1 m to 4.5 m, which was the right answer while the cone was
                // additive — back then a nearby cone brightened the whole
                // background and had to be suppressed. Now that it composites
                // over instead, that long ramp was the bug: at 2 m it left the
                // cone barely 19% opaque, so the forest showed straight through
                // the beam. Table collision keeps the camera at least 1 m from a
                // lamp axis and the cone is only 0.62 m wide at eye height, so it
                // is never entered; this just thins it if you press right up
                // against one, rather than filling the screen with flat glow.
                float near = smoothstep(0.3, 1.4, length(vViewPos));
                // Alpha is density, not brightness. NormalBlending turns it into
                // bg * (1 - a) + colour * a, so a dense core genuinely hides the
                // woods behind it instead of adding a tint on top of them.
                float a = uIntensity * facing * along * near * mix(1.0, uFlicker, vFlicker);
                gl_FragColor = vec4(uColor, a);
            }
        `,
        transparent: true,
        blending: THREE.NormalBlending, // absorbs as well as emits — see above
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const shaftsMesh = new THREE.InstancedMesh(shaftGeom, shaftMat, numLamps);
    shaftGeom.setAttribute('aFlicker', shaftFlickerAttr);
    shaftsMesh.visible = false;
    shaftsMesh.userData.detail = true;
    // Track a single mesh-and-material pair for night updates
    shaftMeshes.length = 0;
    shaftMeshes.push(shaftsMesh);

    // The one bad fixture. Fixed index rather than random so it is always the
    // same lamp between reloads — a flicker that moves house every session reads
    // as a rendering glitch, not as a fixture that needs replacing.
    const FLICKER_LAMP = 7;

    const _lm = new THREE.Matrix4();
    const _lq = new THREE.Quaternion();
    const _ls = new THREE.Vector3(1, 1, 1);
    lampSlots.length = 0;
    for (let i = 0; i < numLamps; i++) {
        const p = lampPositions[i];
        const flickers = i === FLICKER_LAMP;
        _lm.compose(new THREE.Vector3(p.x, cordCenterY,             p.z), _lq, _ls);
        cordsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, cordBottomY + 0.03,      p.z), _lq, _ls);
        socketsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, hoodCenterY,             p.z), _lq, _ls);
        hoodsMesh.setMatrixAt(i, _lm);
        // The flickering lamp's bulb is built separately below with its own
        // material, so that its glass can dim with the light. The instanced bulbs
        // all share one material and cannot be varied per instance.
        _lm.compose(
            new THREE.Vector3(p.x, bulbY, p.z), _lq,
            flickers ? new THREE.Vector3(0, 0, 0) : _ls
        );
        bulbsMesh.setMatrixAt(i, _lm);
        filamentsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, shaftTopY - shaftHeight / 2, p.z), _lq, _ls);
        shaftsMesh.setMatrixAt(i, _lm);
        shaftFlickerAttr.setX(i, flickers ? 1 : 0);

        lampSlots.push({ pos: new THREE.Vector3(p.x, bulbY, p.z), flicker: flickers });
    }
    shaftFlickerAttr.needsUpdate = true;

    // Its own bulb + filament, at full scale where the instanced pair is zeroed.
    const soloBulbMat = makeBulbMaterial();
    const soloFilamentMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
    const soloBulb = new THREE.Mesh(bulbGeom, soloBulbMat);
    const soloFilament = new THREE.Mesh(filamentGeom, soloFilamentMat);
    const fp = lampPositions[FLICKER_LAMP];
    soloBulb.position.set(fp.x, bulbY, fp.z);
    soloFilament.position.copy(soloBulb.position);
    soloBulb.userData.detail = true;
    soloFilament.userData.detail = true;
    ghGroup.add(soloBulb, soloFilament);

    // --- Bulb lights ---
    // A pool of point lights, not one light per fixture. Only the first few cast
    // shadows, and rather than switching castShadow on and off as you walk — which
    // changes numPointLightShadows and recompiles every material in the scene —
    // the pool is *reassigned* to fixtures by distance to the camera. The lamps
    // are identical, so swapping which position a light occupies is invisible,
    // and the light and shadow counts never change after startup.
    //
    // Point, not spot: the hood is real opaque geometry, so on the lights that
    // cast shadows it does the aiming physically, the way a reflector actually
    // does — and the leakage the far un-shadowed ones allow is what puts warm
    // glints on the rafters and reflections in the panes after dark.
    lampShadowCount = isTouchDevice ? 3 : 4;
    for (let i = 0; i < numLamps; i++) {
        // 2700 K tungsten. Decay 2 is the physical inverse square; with it the
        // pool of light on the bench falls off fast enough that the aisle between
        // two lamps stays genuinely dim.
        const light = new THREE.PointLight(0xffa957, 0, 9, 2);
        light.position.copy(lampSlots[i].pos);
        if (i < lampShadowCount) {
            light.castShadow = true;
            light.shadow.mapSize.set(512, 512);
            light.shadow.camera.near = 0.04;
            // Short of the light's own 9 m range: at decay 2 anything past 6 m
            // receives under 3 % of the bulb's output, and this is a *cube* map,
            // so every metre of far plane is paid for six times over.
            light.shadow.camera.far = 6;
            light.shadow.bias = -0.004;
            light.shadow.normalBias = 0.03;
            light.shadow.radius = 3;
            // Rebuilt only when this light is moved to another fixture — see
            // assignLampLights. Six faces × four lights every frame is 24 full
            // scene passes for a picture that never changes.
            light.shadow.autoUpdate = false;
            light.shadow.needsUpdate = true;
        }
        ghGroup.add(light);
        bulbLights.push(light);
    }

    // Module-shared references for night-mode updates.
    sharedAssets._bulbMat = bulbMat;
    sharedAssets._soloBulbMat = soloBulbMat;
    sharedAssets._shaftMat = shaftMat;
    sharedAssets._lampFlickerIndex = FLICKER_LAMP;

    [cordsMesh, socketsMesh, hoodsMesh, bulbsMesh, filamentsMesh, shaftsMesh].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        ghGroup.add(m);
    });

    buildLampMotes(lampSlots, bulbY, shaftTopY - shaftHeight, hoodRimR * 0.95, 0.85);
    buildLampMoths(lampSlots);

    // Selectively set shadow casting/receiving:
    // - Skip detail meshes (mullions, slats, bulbs) and transparent glass — they don't
    //   produce useful shadows but cost real GPU time.
    // - Opaque structural meshes still cast and receive shadows.
    ghGroup.traverse(obj => {
        if (!obj.isMesh) return;
        const isDetail = obj.userData.detail === true;
        const isGlass = obj.material === glassMat || obj.material === roofGlassMat;
        obj.castShadow = !isDetail && !isGlass;
        obj.receiveShadow = !isDetail;
    });

    scene.add(ghGroup);
}

// --- Lamps: dust in the beam, the shadow-caster pool, and the filament ramp ---

// Motes suspended in the lit air under each shade. The haze cone sells the shape
// of the beam; these sell that it is full of something. They are placed *inside*
// the cone geometry at build time — a mote outside the beam is just a firefly —
// and drift by a few centimetres in the shader, which is small enough that none
// of them wanders out of it.
let lampMotes = null;
function buildLampMotes(slots, bulbY, botY, rTop, rBot) {
    const PER_LAMP = 26;
    const total = slots.length * PER_LAMP;
    const pos = new Float32Array(total * 3);
    const phase = new Float32Array(total);
    const depth = new Float32Array(total);   // 0 at the shade rim, 1 at the bottom
    const flick = new Float32Array(total);
    let n = 0;
    for (const slot of slots) {
        for (let i = 0; i < PER_LAMP; i++) {
            // Biased toward the top: that is where the light is strongest and
            // where you actually notice dust in a beam.
            const f = Math.pow(Math.random(), 1.6);
            const r = (rTop + (rBot - rTop) * f) * 0.88 * Math.sqrt(Math.random());
            const a = Math.random() * Math.PI * 2;
            pos[n * 3 + 0] = slot.pos.x + Math.cos(a) * r;
            pos[n * 3 + 1] = bulbY + (botY - bulbY) * f;
            pos[n * 3 + 2] = slot.pos.z + Math.sin(a) * r;
            phase[n] = Math.random() * Math.PI * 2;
            depth[n] = f;
            flick[n] = slot.flicker ? 1 : 0;
            n++;
        }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geom.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
    geom.setAttribute('aFlicker', new THREE.BufferAttribute(flick, 1));
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uLevel: { value: 0 },
            uFlicker: { value: 1 }
        },
        vertexShader: `
            uniform float uTime;
            attribute float aPhase;
            attribute float aDepth;
            attribute float aFlicker;
            varying float vBright;
            varying float vFlick;
            void main() {
                vec3 p = position;
                // Slow convection, not wind — warm air rising off a hot bulb.
                p.x += sin(uTime * 0.21 + aPhase) * 0.05;
                p.y += sin(uTime * 0.17 + aPhase * 1.7) * 0.04;
                p.z += cos(uTime * 0.19 + aPhase) * 0.05;
                vBright = 1.0 - aDepth * 0.65;
                vFlick = aFlicker;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                // Hard clamp, always. An attenuated point that drifts near the
                // camera otherwise rasterises as a screen-filling quad.
                gl_PointSize = clamp(2.6 * (12.0 / max(0.5, -mv.z)), 1.0, 6.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uLevel;
            uniform float uFlicker;
            varying float vBright;
            varying float vFlick;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float falloff = smoothstep(0.5, 0.04, d);
                float a = falloff * vBright * uLevel * mix(1.0, uFlicker, vFlick) * 0.5;
                if (a < 0.003) discard;
                gl_FragColor = vec4(1.0, 0.86, 0.66, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    lampMotes = new THREE.Points(geom, mat);
    lampMotes.frustumCulled = false;
    lampMotes.visible = false;
    scene.add(lampMotes);
    sharedAssets._moteMat = mat;
}

// Moths. Every one is tied to a fixture and flies a lopsided orbit around its
// bulb — the classic moth-to-a-lamp spiral, which is a circle that keeps changing
// its mind about radius and tilt. All of the motion is in the vertex shader, so
// this is one draw call and one uniform write per frame for the whole swarm.
//
// They are billboarded points rather than modelled wings: at the range you see
// them (across a dark greenhouse, against a bright shade) a moth is a pale flake
// with a fluttering silhouette, and the flutter is what identifies it. That is a
// size wobble, which a point can do.
let lampMoths = null;
function buildLampMoths(slots) {
    const PER_LAMP = 3;
    const total = slots.length * PER_LAMP;
    const centre = new Float32Array(total * 3);
    const orbit = new Float32Array(total * 4);   // radius, height offset, speed, phase
    let n = 0;
    for (const slot of slots) {
        for (let i = 0; i < PER_LAMP; i++) {
            centre[n * 3 + 0] = slot.pos.x;
            centre[n * 3 + 1] = slot.pos.y;
            centre[n * 3 + 2] = slot.pos.z;
            orbit[n * 4 + 0] = 0.18 + Math.random() * 0.36;
            orbit[n * 4 + 1] = -0.16 + Math.random() * 0.3;
            orbit[n * 4 + 2] = (0.6 + Math.random() * 1.1) * (Math.random() < 0.5 ? -1 : 1);
            orbit[n * 4 + 3] = Math.random() * Math.PI * 2;
            n++;
        }
    }
    const geom = new THREE.BufferGeometry();
    // `position` is unused by the shader — the orbit is computed from aCentre —
    // but three needs the attribute to work out the draw count.
    geom.setAttribute('position', new THREE.BufferAttribute(centre, 3));
    geom.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
    geom.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
        vertexShader: `
            uniform float uTime;
            attribute vec3 aCentre;
            attribute vec4 aOrbit;
            varying float vFlutter;
            void main() {
                float r = aOrbit.x, dy = aOrbit.y, sp = aOrbit.z, ph = aOrbit.w;
                float a = uTime * sp + ph;
                // Radius breathes and the orbit plane tilts, so the path is a
                // wandering spiral rather than a clean ring.
                float rr = r * (0.72 + 0.28 * sin(uTime * 0.61 + ph * 2.0));
                vec3 p = aCentre + vec3(
                    cos(a) * rr,
                    dy + sin(uTime * 1.7 + ph) * 0.06 + sin(a * 2.0) * 0.03,
                    sin(a) * rr
                );
                // Wingbeat. Fast, and slightly different for every moth.
                vFlutter = 0.55 + 0.45 * sin(uTime * (24.0 + ph * 3.0));
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = clamp((3.4 + 2.6 * vFlutter) * (10.0 / max(0.4, -mv.z)), 1.0, 9.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uLevel;
            varying float vFlutter;
            void main() {
                vec2 p = gl_PointCoord - vec2(0.5);
                float a = smoothstep(0.5, 0.15, length(p));
                a *= uLevel * (0.35 + 0.4 * vFlutter);
                if (a < 0.01) discard;
                // Dusty pale brown, not white — and lit warm by the bulb it is
                // circling, which is the only light reaching it.
                gl_FragColor = vec4(0.85, 0.74, 0.56, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    lampMoths = new THREE.Points(geom, mat);
    lampMoths.frustumCulled = false;
    lampMoths.visible = false;
    scene.add(lampMoths);
    sharedAssets._mothMat = mat;
}

// Hand the shadow-casting lights to the fixtures nearest the camera. The lamps
// are identical, so which light object sits in which fixture is unobservable —
// what matters is that the pool's members never change their castShadow flag,
// because that would alter numPointLightShadows and recompile every material.
const _lampOrder = [];
let lastLampAssign = 0;
function assignLampLights(now) {
    if (!bulbLights.length || !lampSlots.length) return;
    if (now - lastLampAssign < 300) return;
    lastLampAssign = now;
    if (_lampOrder.length !== lampSlots.length) {
        _lampOrder.length = 0;
        for (let i = 0; i < lampSlots.length; i++) _lampOrder.push(i);
    }
    const cam = camera.position;
    _lampOrder.sort((a, b) =>
        lampSlots[a].pos.distanceToSquared(cam) - lampSlots[b].pos.distanceToSquared(cam));
    lampState.flickerLight = -1;
    for (let i = 0; i < bulbLights.length; i++) {
        const light = bulbLights[i];
        const slot = lampSlots[_lampOrder[i]];
        // Only the lights that cast shadows care about having moved, and only if
        // they actually did — walking a few metres usually leaves the nearest four
        // fixtures the same four, and re-rendering six cube faces for a light that
        // did not move is pure waste.
        if (light.castShadow && !light.position.equals(slot.pos)) {
            light.shadow.needsUpdate = true;
        }
        light.position.copy(slot.pos);
        if (slot.flicker) lampState.flickerLight = i;
    }
}

// Something that casts a shadow has appeared, moved or gone. Shadow maps here are
// on-demand (see setupLighting), so they have to be told.
function invalidateShadows() {
    if (sunLight) sunLight.shadow.needsUpdate = true;
    if (moonLight) moonLight.shadow.needsUpdate = true;
    for (const light of bulbLights) {
        if (light.castShadow) light.shadow.needsUpdate = true;
    }
}

// Peak candela per bulb. Decay 2 is a true inverse square, so this is the value
// at one metre — the bench sits 1.5 m under the bulb and gets about half of it.
const LAMP_PEAK = 7.5;
const _lampColor = new THREE.Color();
const _lampWarm = new THREE.Color(0xffa957); // 2700 K

// Filament ramp. A cold tungsten bulb does not snap on: it glows dull red, then
// climbs to colour over a couple of seconds. `level` chases the switch state and
// everything the lamps drive is derived from it.
function updateLamps(now, delta) {
    const target = lampState.on ? 1 : 0;
    const rate = delta / (lampState.on ? LAMP_WARMUP : LAMP_COOLDOWN);
    lampState.level = target > lampState.level
        ? Math.min(target, lampState.level + rate)
        : Math.max(target, lampState.level - rate);

    const lvl = lampState.level;
    const lit = lvl > 0.004;
    // Radiant output climbs far faster than temperature, so the perceived
    // brightness curve is steep while the colour is still crawling up from ember.
    const glow = Math.pow(lvl, 2.2);
    const t = now / 1000;

    // The bad fixture. Two beat frequencies plus a rare deeper dip, so it reads
    // as a loose connection rather than a sine wave.
    const jitter = 0.5 + 0.5 * Math.sin(t * 11.3) * Math.sin(t * 4.7 + 1.3);
    const dip = Math.max(0, Math.sin(t * 0.83) - 0.93) * 9; // ~0 most of the time
    lampState.flicker = Math.max(0.35, 1 - 0.14 * jitter - 0.4 * dip);

    // Colour: dull orange ember at the bottom of the ramp to 2700 K at the top.
    _lampColor.setHex(0xff4a08).lerp(_lampWarm, THREE.MathUtils.smoothstep(lvl, 0.05, 0.75));

    for (let i = 0; i < bulbLights.length; i++) {
        const light = bulbLights[i];
        light.visible = lit;
        if (!lit) continue;
        const f = i === lampState.flickerLight ? lampState.flicker : 1;
        light.intensity = LAMP_PEAK * glow * f;
        light.color.copy(_lampColor);
    }

    // 19 bulbs share one material, so this is a single write.
    if (sharedAssets._bulbMat) sharedAssets._bulbMat.emissiveIntensity = glow * 1.8;
    if (sharedAssets._soloBulbMat) {
        sharedAssets._soloBulbMat.emissiveIntensity = glow * 1.8 * lampState.flicker;
    }
    // Haze cone density — alpha, i.e. how much of the background the beam hides,
    // which is a separate dial from the radiance above. Over 1 because the
    // shader's facing/along/near terms scale it well down everywhere except the
    // core; the peak alpha this produces is a little over half, so the beam is
    // genuinely translucent lit air. It used to be pinned high enough to occlude
    // the woods completely, and a fully opaque beam is not a beam — it is a cone.
    // The cone is DoubleSide, so a sightline through it crosses two faces and the
    // alpha compounds as 1-(1-a)². 0.38 per face gives a peak around 0.6 — dense
    // enough to soften what is behind the beam, translucent enough to still be
    // lit air rather than a cone-shaped object.
    if (sharedAssets._shaftMat) {
        sharedAssets._shaftMat.uniforms.uIntensity.value = glow * 0.28;
        sharedAssets._shaftMat.uniforms.uFlicker.value = lampState.flicker;
    }
    for (const mesh of shaftMeshes) mesh.visible = lit;
    if (lampMotes) {
        lampMotes.visible = lit;
        const u = sharedAssets._moteMat.uniforms;
        u.uTime.value = t;
        u.uLevel.value = glow;
        u.uFlicker.value = lampState.flicker;
    }
    // Moths only come to a lit lamp, and they take a moment to find it — hence
    // the extra ramp rather than reusing `glow` directly.
    if (lampMoths) {
        lampMoths.visible = lit;
        const u = sharedAssets._mothMat.uniforms;
        u.uTime.value = t;
        u.uLevel.value = THREE.MathUtils.smoothstep(lvl, 0.35, 1.0);
    }
}

function createTable(x, z, material) {
    const tableGroup = new THREE.Group();

    // Top
    const topGeom = new THREE.BoxGeometry(2, 0.1, 3);
    const top = new THREE.Mesh(topGeom, material);
    top.position.y = 1.0; // Table height
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    // Legs
    const legGeom = new THREE.BoxGeometry(0.1, 1.0, 0.1);
    const legPositions = [
        [-0.9, -1.4], [0.9, -1.4],
        [-0.9, 1.4], [0.9, 1.4]
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeom, material);
        leg.position.set(pos[0], 0.5, pos[1]);
        leg.castShadow = true;
        tableGroup.add(leg);
    });

    tableGroup.position.set(x, 0, z);
    scene.add(tableGroup);
}

// --- Per-slot pot character ---
//
// 120 pots on identical 1 m centres is the single most artificial thing about a
// room like this; a real bench has them shoved about, turned any which way, in
// three sizes and four firings, with gaps where someone took one away. This table
// gives every slot a fixed personality.
//
// It is hashed from the slot index rather than drawn from Math.random() on
// purpose. Only positionIndex survives in localStorage, so a random table would
// re-roll every reload and a pot you planted yesterday would be a different size
// and colour today; a hash means slot 47 is the same slightly-large pinkish pot
// leaning north-east forever.
const POT_HUE_VARIANTS = 5;
const potJitter = [];

// Cheap integer hash → [0,1). Three decorrelated streams per slot from one seed.
function slotRandom(index, stream) {
    let h = (index * 374761393 + stream * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
}

function buildPotJitter(count) {
    potJitter.length = 0;
    for (let i = 0; i < count; i++) {
        const r = (s) => slotRandom(i, s);
        // Every 11th slot or so is bare bench — someone took that pot away. The
        // gap is what makes the rest look placed rather than tiled.
        const missing = r(6) < 0.085;
        potJitter.push({
            // ±10 % of the 1 m grid pitch.
            dx: (r(1) - 0.5) * 0.2,
            dz: (r(2) - 0.5) * 0.2,
            ry: r(3) * Math.PI * 2,
            // ±15 % on scale. Applied to the pot only, so a small pot does not
            // also mean a small plant.
            s: 1 + (r(4) - 0.5) * 0.3,
            hue: Math.floor(r(5) * POT_HUE_VARIANTS),
            missing,
            // Exactly one pot has been knocked over and left there.
            tipped: false
        });
    }
    // Pick the tipped one from the slots that have a pot, near the front of the
    // house where it will actually be seen. It is not plantable — a pot lying on
    // its side is not a pot you put a seed in.
    for (let i = 6; i < Math.min(count, 40); i++) {
        if (!potJitter[i].missing) { potJitter[i].tipped = true; break; }
    }
    return potJitter;
}

// Terracotta comes out of the kiln a different colour every firing. Five tinted
// clones of the one pot material, so the variation costs five materials rather
// than 120 — and the instanced empty pots can reach the same five colours through
// instanceColor, which keeps a planted pot the same colour as the empty one it
// replaced.
function getPotVariantColors() {
    if (sharedAssets.potTints) return sharedAssets.potTints;
    const tints = [];
    for (let i = 0; i < POT_HUE_VARIANTS; i++) {
        const c = new THREE.Color();
        // Warm orange through dusty pink to pale buff, at varied value. These
        // multiply an already strongly orange clay texture, so the spread has to
        // be wider than it looks here to be legible on the bench at all.
        c.setHSL(0.05 + (i / POT_HUE_VARIANTS) * 0.045, 0.34 - i * 0.055, 0.44 + i * 0.07);
        tints.push(c);
    }
    sharedAssets.potTints = tints;
    return tints;
}

function getPotVariantMaterial(hue) {
    if (!sharedAssets.potVariants) {
        const base = getPotMaterial();
        sharedAssets.potVariants = getPotVariantColors().map(c => {
            const m = base.clone();   // shares the textures, not the uniforms
            m.color.copy(c);
            return m;
        });
    }
    return sharedAssets.potVariants[hue % POT_HUE_VARIANTS];
}

function buildPotMeshes(group, jitter) {
    const potMat = jitter ? getPotVariantMaterial(jitter.hue) : getPotMaterial();
    const soilMat = getSoilMaterial();

    // Sub-group so the pot can be scaled and turned without touching the plant
    // growing out of it. gatherIntersectables looks inside groups flagged this way
    // so the pot stays clickable.
    const pot = new THREE.Group();
    pot.userData.isPotGroup = true;
    if (jitter) {
        pot.rotation.y = jitter.ry;
        pot.scale.setScalar(jitter.s);
    }
    group.add(pot);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.105, 0.2, 28, 1),
        potMat
    );
    body.position.y = 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    pot.add(body);

    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.155, 0.012, 8, 28),
        potMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.205;
    rim.castShadow = true;
    rim.receiveShadow = true;
    pot.add(rim);

    // Soil mound (slightly domed)
    const soil = new THREE.Mesh(
        new THREE.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
        soilMat
    );
    soil.position.y = 0.18;
    soil.scale.y = 0.45;
    soil.receiveShadow = true;
    soil.castShadow = true;
    pot.add(soil);
}

function createEmptyPotsInstanced() {
    const count = tablePositions.length;
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();
    const jitter = buildPotJitter(count);
    const tints = getPotVariantColors();

    // Lower-poly geometries for the instanced empty pots — they're seen at distance
    const bodyGeom = new THREE.CylinderGeometry(0.155, 0.105, 0.2, 18, 1);
    const rimGeom = new THREE.TorusGeometry(0.155, 0.012, 6, 18);
    const soilGeom = new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);

    const bodies = new THREE.InstancedMesh(bodyGeom, potMat, count);
    const rims = new THREE.InstancedMesh(rimGeom, potMat, count);
    const soils = new THREE.InstancedMesh(soilGeom, soilMat, count);

    [bodies, rims, soils].forEach(m => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.isEmptyPotMesh = true;
    });

    for (let i = 0; i < count; i++) {
        emptyPotOccupied.push(false);
        writeEmptyPotMatrices(bodies, rims, soils, i);
        // Firing colour. The clay itself is one texture; this is the per-pot tint
        // the plant's own material will match when the slot gets planted.
        const c = tints[jitter[i].hue];
        bodies.setColorAt(i, c);
        rims.setColorAt(i, c);
    }
    bodies.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;
    soils.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (rims.instanceColor) rims.instanceColor.needsUpdate = true;

    scene.add(bodies);
    scene.add(rims);
    scene.add(soils);

    emptyPotInstances = { bodies, rims, soils };
    buildTippedBenchPot();
}

const _potTmpMatrix = new THREE.Matrix4();
const _potNoRot = new THREE.Quaternion();
const _potRimRot = new THREE.Quaternion();
const _potJitRot = new THREE.Quaternion();
const _potZeroScale = new THREE.Matrix4().makeScale(0, 0, 0);
const _potYAxis = new THREE.Vector3(0, 1, 0);
const _potXAxis = new THREE.Vector3(1, 0, 0);
const _potScale = new THREE.Vector3();
const _potSoilScale = new THREE.Vector3();
const _potTmpVec = new THREE.Vector3();

// One place that knows where an unoccupied pot sits, so createEmptyPotsInstanced
// and setEmptyPotOccupied cannot drift apart on the jitter.
function writeEmptyPotMatrices(bodies, rims, soils, index) {
    const j = potJitter[index];
    // Missing and tipped slots have no upright instanced pot. The tipped one is a
    // separate little group; the missing ones are bare bench. Both are excluded
    // from planting for free, because a zero-scale instance cannot be hit by the
    // raycast that opens the "plant a seed here" prompt.
    if (j.missing || j.tipped) {
        bodies.setMatrixAt(index, _potZeroScale);
        rims.setMatrixAt(index, _potZeroScale);
        soils.setMatrixAt(index, _potZeroScale);
        return;
    }
    const p = tablePositions[index];
    const x = p.x + j.dx;
    const z = p.z + j.dz;
    _potJitRot.setFromAxisAngle(_potYAxis, j.ry);
    _potScale.setScalar(j.s);
    _potSoilScale.set(j.s, j.s * 0.45, j.s);
    // Scaling a pot about its own base, not its middle, or a big pot sinks into
    // the bench and a small one floats above it.
    _potTmpMatrix.compose(_potTmpVec.set(x, p.y + 0.1 * j.s, z), _potJitRot, _potScale);
    bodies.setMatrixAt(index, _potTmpMatrix);
    _potRimRot.setFromAxisAngle(_potXAxis, Math.PI / 2).premultiply(_potJitRot);
    _potTmpMatrix.compose(_potTmpVec.set(x, p.y + 0.205 * j.s, z), _potRimRot, _potScale);
    rims.setMatrixAt(index, _potTmpMatrix);
    _potTmpMatrix.compose(_potTmpVec.set(x, p.y + 0.18 * j.s, z), _potJitRot, _potSoilScale);
    soils.setMatrixAt(index, _potTmpMatrix);
}

function setEmptyPotOccupied(index, occupied) {
    if (!emptyPotInstances) return;
    emptyPotOccupied[index] = occupied;

    const { bodies, rims, soils } = emptyPotInstances;
    if (occupied) {
        // Hide via zero-scale matrix
        bodies.setMatrixAt(index, _potZeroScale);
        rims.setMatrixAt(index, _potZeroScale);
        soils.setMatrixAt(index, _potZeroScale);
    } else {
        writeEmptyPotMatrices(bodies, rims, soils, index);
    }
    // A saved to-do from before pots had personalities can land on the slot that
    // now holds the tipped pot. The plant wins; the wreckage gets tidied away.
    if (tippedPot && tippedPot.userData.slot === index) tippedPot.visible = !occupied;
    bodies.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;
    soils.instanceMatrix.needsUpdate = true;
}

// The one pot somebody knocked over and never picked up, lying on the bench in
// its own slot with its soil tipped out beside it.
let tippedPot = null;
function buildTippedBenchPot() {
    const index = potJitter.findIndex(j => j.tipped);
    if (index < 0) return;
    const p = tablePositions[index];
    const j = potJitter[index];
    const g = new THREE.Group();
    g.userData.slot = index;
    g.position.set(p.x + j.dx, p.y, p.z + j.dz);
    g.rotation.y = j.ry;

    const potMat = getPotVariantMaterial(j.hue);
    const soilMat = getSoilMaterial();

    // Open cylinder on its side, so you can see into it.
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.105, 0.2, 20, 1, true), potMat);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.155, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.012, 6, 20), potMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(0.1, 0.155, 0);
    g.add(rim);

    // The soil that came out of it, in a fan away from the mouth.
    const spill = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), soilMat);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0.22, 0.006, 0);
    spill.scale.set(1.5, 1, 0.85);
    g.add(spill);
    for (let i = 0; i < 5; i++) {
        const r = slotRandom(index, 20 + i);
        const crumb = new THREE.Mesh(new THREE.SphereGeometry(0.012 + r * 0.014, 5, 4), soilMat);
        crumb.position.set(0.18 + r * 0.3, 0.012, (slotRandom(index, 30 + i) - 0.5) * 0.28);
        g.add(crumb);
    }
    scene.add(g);
    tippedPot = g;
}

function createPlant(todoData, isLoad = false) {
    let positionIndex = todoData.positionIndex;
    if (positionIndex === undefined) {
        console.error("No position index provided for plant.");
        return false;
    }

    const pos = tablePositions[positionIndex];

    // Hide the instanced empty pot at this slot (the plant brings its own pot meshes)
    setEmptyPotOccupied(positionIndex, true);

    // If a plant already lives here, dispose of it before creating the replacement
    const existingObjIndex = objects.findIndex(obj => obj.userData.positionIndex === positionIndex);
    if (existingObjIndex > -1) {
        const existingObj = objects[existingObjIndex];
        scene.remove(existingObj);
        disposeHierarchy(existingObj);
        objects.splice(existingObjIndex, 1);
    }

    // Plant Group. The slot's jitter moves the whole plant, so a planted pot sits
    // exactly where the empty one it replaced was standing.
    const jitter = potJitter[positionIndex];
    const plantGroup = new THREE.Group();
    plantGroup.position.copy(pos);
    if (jitter) plantGroup.position.x += jitter.dx, plantGroup.position.z += jitter.dz;
    plantGroup.userData = {
        id: todoData.id,
        positionIndex: positionIndex,
        isEmpty: false
    };

    // 1. Pot + soil
    buildPotMeshes(plantGroup, jitter);
    // Soil surface rises and falls with the pot's scale, so the stem has to
    // follow it or a big pot buries its seedling and a small one floats it.
    const soilY = 0.2 * (jitter ? jitter.s : 1);

    if (todoData.completed) {
        // Short thin stem — flower is the star, not the stalk.
        const stemHeight = 0.18;
        const stemGeom = new THREE.CylinderGeometry(0.011, 0.017, stemHeight, 10);
        stemGeom.translate(0, stemHeight / 2, 0);
        const plantMat = makeStemMaterial();
        const stem = new THREE.Mesh(stemGeom, plantMat);
        stem.position.y = soilY;
        stem.castShadow = true;
        // Keep the age-based growth the plant had when it was completed — without
        // this, completing a mature plant would shrink it back to seedling size.
        stem.scale.setScalar(growthScaleFor(todoData));
        plantGroup.add(stem);

        // Pick a flower variant. New completions get an explicit random pick saved to
        // todoData.flowerVariant; legacy completions without one fall back to a
        // deterministic pick keyed off the todo id, so the chosen flower is permanent.
        const variantIdx = (typeof todoData.flowerVariant === 'number')
            ? todoData.flowerVariant
            : Math.abs(todoData.id || 0);
        const flower = buildFlowerByVariant(variantIdx);
        flower.position.y = stemHeight + 0.015;
        flower.scale.setScalar(1.7);
        stem.add(flower);

        // Slight bend
        stem.rotation.x = Math.PI / 14;
        stem.rotation.z = (Math.random() - 0.5) * 0.12;
    } else {
        // Shorter thinner stem for growing plants too.
        const stemHeight = 0.22;
        const stemGeom = new THREE.CylinderGeometry(0.011, 0.018, stemHeight, 10);
        stemGeom.translate(0, stemHeight / 2, 0);
        const plantMat = makeStemMaterial();
        const stem = new THREE.Mesh(stemGeom, plantMat);
        stem.position.y = soilY; // Start at dirt level
        stem.castShadow = true;
        stem.name = "stem";
        plantGroup.add(stem);

        // 4. Leaves — multiple curved planes at varied angles for fullness
        if (!sharedLeafMat) sharedLeafMat = createLeafMaterial();
        const perPlantLeafMat = sharedLeafMat.clone(); // clone so we can color independently
        const leafGeom = createLeafGeometry();

        // Leaf positions rescaled to fit the shorter stem; sizes nudged down slightly.
        // Seven leaves in a loose spiral with varied droop and size — a fuller,
        // less geometric rosette than the old five-leaf cup.
        const leafConfigs = [
            { y: 0.055, ry: 0.3,            rz: -Math.PI / 2.7, scale: 0.98 },
            { y: 0.08,  ry: Math.PI / 2.2,  rz: -Math.PI / 3.0, scale: 0.9 },
            { y: 0.105, ry: Math.PI * 1.05, rz:  Math.PI / 3.4, scale: 0.94 },
            { y: 0.135, ry: Math.PI / 3.6,  rz:  Math.PI / 2.9, scale: 0.86 },
            { y: 0.16,  ry: Math.PI * 0.78, rz: -Math.PI / 3.6, scale: 0.8 },
            { y: 0.185, ry: Math.PI * 1.55, rz: -Math.PI / 4.2, scale: 0.72 },
            { y: 0.205, ry: Math.PI * 0.42, rz:  Math.PI / 4.0, scale: 0.62 }
        ];

        leafConfigs.forEach((cfg, i) => {
            const leaf = new THREE.Mesh(leafGeom, perPlantLeafMat);
            // Per-plant jitter so the rosette isn't a clone of its neighbors
            const ry = cfg.ry + (Math.random() - 0.5) * 0.7;
            const rz = cfg.rz + (Math.random() - 0.5) * 0.18;
            const scale = cfg.scale * 0.9 * (0.88 + Math.random() * 0.24);
            leaf.position.set(0, cfg.y, 0);
            leaf.rotation.set(0, ry, rz);
            leaf.scale.setScalar(scale);
            // Shadow casting disabled — alpha-tested shadows are expensive and
            // leaves are too small to read clearly in shadow anyway.
            leaf.name = i === 0 ? "leaf1" : (i === 1 ? "leaf2" : `leaf${i + 1}`);
            // Base transform + index, so updatePlantVisual can droop/curl/drop
            // each leaf individually as the plant withers.
            leaf.userData.wilt = { baseRz: rz, baseScale: scale, idx: i };
            stem.add(leaf);
        });

        // Two dead leaves lying on the soil — hidden while healthy, revealed as
        // the plant sheds foliage at low health.
        for (let i = 0; i < 2; i++) {
            const dead = new THREE.Mesh(leafGeom, perPlantLeafMat);
            const a = Math.random() * Math.PI * 2;
            dead.position.set(Math.cos(a) * 0.07, soilY + 0.04, Math.sin(a) * 0.07);
            dead.rotation.set(-Math.PI / 2 + 0.18, Math.random() * Math.PI * 2, 0, 'YXZ');
            dead.scale.setScalar(0.55 + Math.random() * 0.15);
            dead.name = `fallenLeaf${i + 1}`;
            dead.visible = false;
            plantGroup.add(dead);
        }
    }

    // Save reference for interaction and updates
    objects.push(plantGroup);
    scene.add(plantGroup);

    // Bind mesh to data
    todoData.mesh = plantGroup;

    if (!todoData.completed) {
        updatePlantVisual(todoData);
    }

    // A new shadow caster on the bench — the on-demand shadow maps need to know.
    invalidateShadows();

    return true;
}

// --- Volumetric sun shafts through the roof glass ---
//
// Real volumetrics would mean ray-marching the shadow map. This does the cheap
// trick that sells the same read: each shaft is a flat quad that spins around
// its own axis to keep facing the camera, so it never shows an edge and reads as
// a solid column of lit dust.
//
// The geometry is derived backwards from where you want the light to land. Each
// shaft owns a fixed spot on the floor; every frame we trace from that spot
// toward the sun, find where the ray crosses one of the two roof planes, and
// stand the quad up between the two points. That means the shafts track the real
// sun continuously — sweeping across the floor over the day, standing straight up
// at noon, swinging over to the other slope in the afternoon — with no seam when
// the sun crosses the ridge, and each one is exactly as long as it needs to be.
const SUNSHAFT_COUNT = 24;

function buildSunShafts() {
    // Unit quad hanging from its top edge: local -Y is down-beam, v = 1 is the
    // roof end, v = 0 the floor end. The instance matrix supplies width, length
    // and orientation.
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.translate(0, -0.5, 0);

    const seeds = new Float32Array(SUNSHAFT_COUNT);
    const beams = [];
    for (let i = 0; i < SUNSHAFT_COUNT; i++) {
        seeds[i] = Math.random();
        // Spread the landing spots down the length of the house and across it,
        // biased away from dead centre so shafts fall across the benches and
        // aisle rather than lining up in one stripe.
        const row = i % 3;                    // left aisle / centre / right aisle
        const along = (Math.floor(i / 3) + 0.5) / Math.ceil(SUNSHAFT_COUNT / 3);
        beams.push({
            x: (row - 1) * 4.3 + (Math.random() - 0.5) * 2.6,
            z: THREE.MathUtils.lerp(roofShape.zMin + 2, roofShape.zMax - 2, along)
                + (Math.random() - 0.5) * 3,
            width: 0.85 + Math.random() * 1.15
        });
    }
    geom.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uSunDir: { value: new THREE.Vector3(0, 1, 0) },
            uIntensity: { value: 0 },
            uColor: { value: new THREE.Color(0xffeec2) }
        },
        vertexShader: `
            attribute float aSeed;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying float vSeed;
            void main() {
                vUv = uv;
                vSeed = aSeed;
                vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 uSunDir;
            uniform float uIntensity;
            uniform vec3 uColor;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying float vSeed;
            void main() {
                // Soft shoulders across the beam so there is no hard silhouette.
                float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
                float edge = smoothstep(0.0, 0.42, across);
                edge *= edge;
                // Fade in below the glass and out again before the floor, so the
                // quad never shows a crisp line where it meets geometry.
                float along = smoothstep(0.0, 0.30, vUv.y) * (1.0 - smoothstep(0.80, 1.0, vUv.y));
                // Forward scattering: dust lights up when you look toward the sun.
                vec3 viewDir = normalize(vWorldPos - cameraPosition);
                float phase = mix(0.28, 1.0, pow(max(dot(viewDir, uSunDir), 0.0), 2.5));
                // Standing inside a shaft should not white out the screen.
                float near = smoothstep(0.5, 3.2, length(vWorldPos - cameraPosition));
                float a = uIntensity * edge * along * phase * near * (0.65 + vSeed * 0.7);
                // AdditiveBlending is (SRC_ALPHA, ONE), so the alpha channel is
                // the multiplier — pre-multiplying rgb here would apply it twice.
                gl_FragColor = vec4(uColor, a);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    sunShafts = new THREE.InstancedMesh(geom, mat, SUNSHAFT_COUNT);
    sunShafts.frustumCulled = false; // instances are repositioned every frame
    sunShafts.visible = false;
    sunShafts.userData.beams = beams;
    // Last of the transparent objects, so a beam adds light on top of the drips,
    // mist and dust it passes through rather than being occluded by their sort
    // order. (The glass is already ahead of all of them — three draws the
    // transmissive pass before the transparent one.)
    sunShafts.renderOrder = 5;
    scene.add(sunShafts);
}

const _shaftEntry = new THREE.Vector3();
const _shaftAxis = new THREE.Vector3();
const _shaftRight = new THREE.Vector3();
const _shaftUp = new THREE.Vector3();
const _shaftFwd = new THREE.Vector3();
const _shaftToCam = new THREE.Vector3();
const _shaftMatrix = new THREE.Matrix4();
const _ROOF_SIGNS = [-1, 1];

// Trace from a floor point toward the sun and return the distance to the roof
// glass, or -1 if that ray leaves through a wall or gable instead.
function distanceToRoof(x, z) {
    const { wallTopY, ridgeY, halfWidth, zMin, zMax } = roofShape;
    const slope = (ridgeY - wallTopY) / halfWidth;
    // The two roof planes, as  ±slope * x + y = ridgeY.
    for (const sign of _ROOF_SIGNS) {
        const denom = sign * slope * sunDir.x + sunDir.y;
        if (Math.abs(denom) < 1e-4) continue;
        const s = (ridgeY - (sign * slope * x + 0.05)) / denom;
        if (s <= 0.5) continue;
        const hx = x + sunDir.x * s;
        const hy = 0.05 + sunDir.y * s;
        const hz = z + sunDir.z * s;
        // Only count it if the hit is actually on that pane.
        if (sign * hx < -1e-3 || sign * hx > halfWidth) continue;
        if (hy < wallTopY - 1e-3 || hy > ridgeY + 1e-3) continue;
        if (hz < zMin || hz > zMax) continue;
        return s;
    }
    return -1;
}

function updateSunShafts() {
    if (!sunShafts) return;
    // Only while the sun is high enough to actually come through the roof rather
    // than the side walls, and only in daylight.
    const elevGate = THREE.MathUtils.smoothstep(sunDir.y, 0.18, 0.5);
    const strength = currentDayness * elevGate;
    if (strength <= 0.001) {
        sunShafts.visible = false;
        return;
    }
    sunShafts.visible = true;
    sunShafts.material.uniforms.uIntensity.value = 0.30 * strength;
    sunShafts.material.uniforms.uSunDir.value.copy(sunDir);

    const beams = sunShafts.userData.beams;
    _shaftAxis.copy(sunDir).multiplyScalar(-1); // direction the light travels
    for (let i = 0; i < beams.length; i++) {
        const b = beams[i];
        const len = distanceToRoof(b.x, b.z);
        if (len < 0) {
            // No roof entry for this spot right now — collapse the instance.
            _shaftMatrix.makeScale(0, 0, 0);
            sunShafts.setMatrixAt(i, _shaftMatrix);
            continue;
        }
        _shaftEntry.set(b.x + sunDir.x * len, 0.05 + sunDir.y * len, b.z + sunDir.z * len);
        // Billboard around the beam's own axis: spin the quad until its face is
        // as square to the camera as the axis allows.
        _shaftToCam.subVectors(camera.position, _shaftEntry);
        _shaftRight.crossVectors(_shaftAxis, _shaftToCam);
        if (_shaftRight.lengthSq() < 1e-8) {
            // Looking straight down the beam — any perpendicular will do.
            _shaftRight.set(1, 0, 0).cross(_shaftAxis);
        }
        _shaftRight.normalize().multiplyScalar(b.width);
        _shaftUp.copy(sunDir).multiplyScalar(len);           // local +Y = up-beam
        _shaftFwd.crossVectors(_shaftRight, _shaftUp).normalize();
        _shaftMatrix.makeBasis(_shaftRight, _shaftUp, _shaftFwd);
        _shaftMatrix.setPosition(_shaftEntry);
        sunShafts.setMatrixAt(i, _shaftMatrix);
    }
    sunShafts.instanceMatrix.needsUpdate = true;
}

// --- Sky positions (SunCalc algorithms) and day/night lighting ---
//
// Shared celestial plumbing. These were local to computeSunPosition until the moon
// needed the same right-ascension/declination/sidereal-time chain; keeping one copy
// means the sun and the moon can never drift out of the same coordinate frame.
const ASTRO = (() => {
    const rad = Math.PI / 180;
    const J1970 = 2440588;
    const J2000 = 2451545;
    const e = rad * 23.4397; // obliquity of the Earth

    const toDays = (d) => (d.getTime() / 86400000 - 0.5 + J1970) - J2000;

    const rightAsc = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const decl = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    const azimuthFn = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    const altitudeFn = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

    // Geocentric ecliptic coordinates of the sun.
    const sunCoords = (d) => {
        const M = rad * (357.5291 + 0.98560028 * d);                       // mean anomaly
        const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M)
                       + 0.0003 * Math.sin(3 * M));                        // equation of the centre
        const L = M + C + rad * 102.9372 + Math.PI;                        // ecliptic longitude
        return { ra: rightAsc(L, 0), dec: decl(L, 0) };
    };

    // Geocentric ecliptic coordinates of the moon, plus its distance in km.
    const moonCoords = (d) => {
        const L = rad * (218.316 + 13.176396 * d);                         // ecliptic longitude
        const M = rad * (134.963 + 13.064993 * d);                         // mean anomaly
        const F = rad * (93.272 + 13.229350 * d);                          // mean distance
        const l = L + rad * 6.289 * Math.sin(M);
        const b = rad * 5.128 * Math.sin(F);
        return { ra: rightAsc(l, b), dec: decl(l, b), dist: 385001 - 20905 * Math.cos(M) };
    };

    return { rad, toDays, azimuthFn, altitudeFn, sidereal, sunCoords, moonCoords };
})();

function computeSunPosition(date, lat, lng) {
    const { rad, toDays, sidereal, sunCoords, azimuthFn, altitudeFn } = ASTRO;
    const d = toDays(date);
    const c = sunCoords(d);
    const lw = rad * -lng;
    const phi = rad * lat;
    const H = sidereal(d, lw) - c.ra;

    return {
        altitude: altitudeFn(H, phi, c.dec),      // radians; >0 means above horizon
        azimuth: azimuthFn(H, phi, c.dec) + Math.PI // radians from north (0=N, π/2=E, π=S, 3π/2=W)
    };
}

function computeMoonPosition(date, lat, lng) {
    const { rad, toDays, sidereal, moonCoords, azimuthFn, altitudeFn } = ASTRO;
    const d = toDays(date);
    const c = moonCoords(d);
    const lw = rad * -lng;
    const phi = rad * lat;
    const H = sidereal(d, lw) - c.ra;
    return {
        altitude: altitudeFn(H, phi, c.dec),
        azimuth: azimuthFn(H, phi, c.dec) + Math.PI,
        distance: c.dist
    };
}

// Illuminated fraction, and the roll angle of the bright limb on screen. Without
// the angle a gibbous moon looks wrong — the terminator has to tilt with the
// sun's direction relative to the moon, not sit vertically.
function computeMoonIllumination(date) {
    const { toDays, sunCoords, moonCoords } = ASTRO;
    const d = toDays(date);
    const s = sunCoords(d);
    const m = moonCoords(d);
    const SUN_DIST = 149598000; // km
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec)
              + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(SUN_DIST * Math.sin(phi), m.dist - SUN_DIST * Math.cos(phi));
    const angle = Math.atan2(
        Math.cos(s.dec) * Math.sin(s.ra - m.ra),
        Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
    );
    return { fraction: (1 + Math.cos(inc)) / 2, angle };
}

// --- Night sky: stars and the moon, seen through the roof glass ---
//
// The Sky mesh is hidden after dark (its pre-dawn glow used to leak through the
// windows), which left the roof a black void — so this supplies what should
// actually be up there.
//
// Both materials are deliberately OPAQUE. The renderer builds its transmission
// buffer from the opaque draw list, and the roof glass reads what you see through
// it out of that buffer, so a transparent star would simply not exist as far as
// the glass is concerned. Being opaque costs nothing here: on a night sky the
// background is essentially black, so "replace" and "add" look identical.
//
// Both also set fog:false. Fog is exponential-squared and at 1.4 km these would be
// swallowed whole.
const STAR_COUNT = 1600;
const STAR_RADIUS = 1400;
let nightSky = null, starField = null, starRig = null, moonDisc = null;

function buildNightSky() {
    nightSky = new THREE.Group();
    nightSky.userData.detail = true;

    // ---- Stars ----
    // A random catalogue, not a real one, so absolute orientation is meaningless;
    // what matters is that it turns about the true celestial pole at the true rate.
    const pos = new Float32Array(STAR_COUNT * 3);
    const mag = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const tint = new Float32Array(STAR_COUNT * 3);
    const c = new THREE.Color();
    for (let i = 0; i < STAR_COUNT; i++) {
        // Uniform on the sphere, but skip most of the lower hemisphere — it is
        // under the floor and behind the tree line either way.
        const y = Math.pow(Math.random(), 0.75) * 1.1 - 0.1;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(a) * r * STAR_RADIUS;
        pos[i * 3 + 1] = y * STAR_RADIUS;
        pos[i * 3 + 2] = Math.sin(a) * r * STAR_RADIUS;
        // Magnitude distribution: a great many faint ones, a handful of bright.
        mag[i] = Math.pow(Math.random(), 2.6);
        phase[i] = Math.random();
        // Mostly blue-white, a minority warm — real star colours are subtle.
        const t = Math.random();
        if (t < 0.7) c.setHSL(0.58, 0.18, 0.94);
        else if (t < 0.9) c.setHSL(0.11, 0.30, 0.92);
        else c.setHSL(0.05, 0.45, 0.88);
        tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeom.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    starGeom.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    starGeom.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));

    const starMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uNight: { value: 0 },
            uPixelRatio: { value: 1 }
        },
        vertexShader: `
            attribute float aMag;
            attribute float aPhase;
            attribute vec3 aTint;
            uniform float uTime;
            uniform float uNight;
            uniform float uPixelRatio;
            varying float vBright;
            varying vec3 vTint;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                // Brighter stars scintillate faster; the phase offset stops the
                // whole sky pulsing in unison.
                float twinkle = 0.78 + 0.22 * sin(uTime * (0.7 + aMag * 2.2) + aPhase * 6.2832);
                vBright = (0.12 + aMag) * twinkle * uNight;
                vTint = aTint;
                // Fixed screen size — these are at infinity, so no attenuation —
                // and hard-clamped: an unclamped point that drifts near the camera
                // rasterises as a screen-filling quad on ANGLE/Metal.
                gl_PointSize = clamp((0.85 + aMag * 2.4) * uPixelRatio, 1.0, 6.0);
            }
        `,
        fragmentShader: `
            varying float vBright;
            varying vec3 vTint;
            void main() {
                vec2 p = gl_PointCoord - 0.5;
                float r2 = dot(p, p);
                if (r2 > 0.25) discard;
                // Soft core so the bigger stars don't read as flat discs.
                float core = 1.0 - smoothstep(0.01, 0.25, r2);
                float b = vBright * core;
                if (b < 0.004) discard;   // never paint a dark dot on the sky
                gl_FragColor = vec4(vTint * b, 1.0);
            }
        `,
        transparent: false,
        depthWrite: false,
        fog: false
    });

    starField = new THREE.Points(starGeom, starMat);
    starField.frustumCulled = false;
    starField.renderOrder = -2; // just after the Sky, before all real geometry
    // Own group so the sidereal rotation applies to the stars only, not the moon.
    starRig = new THREE.Group();
    starRig.add(starField);
    nightSky.add(starRig);

    // ---- Moon ----
    // The real disc is 0.52° across. At true scale it renders about 8 px here and
    // vanishes among the stars, so this is 40/1344 rad ≈ 1.7°, a bit over 3x life
    // size. Games routinely exaggerate the moon for exactly this reason, and it
    // needs the help more than usual seen through algae-covered glass.
    const moonGeom = new THREE.PlaneGeometry(40, 40);
    const moonMat = new THREE.ShaderMaterial({
        uniforms: {
            uFraction: { value: 1 },     // illuminated fraction, 0 new .. 1 full
            uLimbAngle: { value: 0 },    // roll of the bright limb, radians
            uNight: { value: 0 },
            uColor: { value: new THREE.Color(0xfff6e2).multiplyScalar(3.1) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uFraction;
            uniform float uLimbAngle;
            uniform float uNight;
            uniform vec3 uColor;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                float r2 = dot(p, p);
                if (r2 > 1.0) discard;
                // Rotate so the bright limb lies on +x, then cut the terminator.
                float ca = cos(-uLimbAngle), sa = sin(-uLimbAngle);
                vec2 q = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
                // Terminator is an ellipse: at full it sits off the left edge, at
                // half it runs down the middle, at new it clears the right edge.
                float halfW = sqrt(max(0.0, 1.0 - q.y * q.y));
                float term = (1.0 - 2.0 * uFraction) * halfW;
                float lit = smoothstep(term - 0.07, term + 0.07, q.x);
                // Earthshine: the dark limb is never truly black, and it shows most
                // when there is least sunlit disc to overpower it.
                lit = max(lit, 0.045 * (1.0 - uFraction));
                float limb = sqrt(max(0.0, 1.0 - r2));
                float shade = mix(0.70, 1.0, pow(limb, 0.45));         // limb darkening
                float mare = 0.87 + 0.13 * hash(floor(p * 6.0));       // hint of maria
                float b = lit * shade * mare * uNight;
                if (b < 0.002) discard;
                gl_FragColor = vec4(uColor * b, 1.0);
            }
        `,
        transparent: false,
        depthWrite: false,
        fog: false
    });
    moonDisc = new THREE.Mesh(moonGeom, moonMat);
    moonDisc.frustumCulled = false;
    moonDisc.renderOrder = -1; // last of the background, still before the world
    nightSky.add(moonDisc);

    nightSky.visible = false;
    scene.add(nightSky);
}

const _polarAxis = new THREE.Vector3();
const _moonDir = new THREE.Vector3();

// Positions the sky. Cheap enough for the 30 s sun tick — stars move 0.125° in
// that time — so this rides along with updateSunAndLighting.
function placeNightSky(date, nightness) {
    if (!nightSky) return;
    nightSky.visible = nightness > 0.01;
    if (!nightSky.visible) return;

    starField.material.uniforms.uNight.value = nightness;
    starField.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    // Turn the catalogue about the true north celestial pole, which sits due
    // north at an altitude equal to the latitude, at the true sidereal rate.
    const lat = SUN_LOCATION.lat * Math.PI / 180;
    _polarAxis.set(0, Math.sin(lat), -Math.cos(lat)).normalize();
    const lst = ASTRO.sidereal(ASTRO.toDays(date), ASTRO.rad * -SUN_LOCATION.lng);
    starRig.quaternion.setFromAxisAngle(_polarAxis, -lst);

    const moon = computeMoonPosition(date, SUN_LOCATION.lat, SUN_LOCATION.lng);
    const lit = computeMoonIllumination(date);
    // Below the horizon it is simply not there.
    const up = moon.altitude > 0;
    moonDisc.visible = up;
    if (up) {
        _moonDir.set(
            Math.sin(moon.azimuth) * Math.cos(moon.altitude),
            Math.sin(moon.altitude),
            -Math.cos(moon.azimuth) * Math.cos(moon.altitude)
        );
        moonDisc.position.copy(_moonDir).multiplyScalar(STAR_RADIUS * 0.96);
        moonDisc.lookAt(nightSky.position); // the group sits on the camera
        moonDisc.material.uniforms.uFraction.value = lit.fraction;
        moonDisc.material.uniforms.uLimbAngle.value = lit.angle;
        // Fade out through dawn along with the stars, and dim it near the horizon
        // the way real extinction does.
        const lowFade = THREE.MathUtils.smoothstep(moon.altitude, 0.0, 0.22);
        moonDisc.material.uniforms.uNight.value = nightness * lowFade;
    }
}

// Per-frame: keep the dome centred on the camera so the stars sit at infinity
// instead of parallaxing across a 50 m greenhouse, and advance the twinkle.
function updateNightSky(time) {
    if (!nightSky || !nightSky.visible) return;
    nightSky.position.copy(camera.position);
    starField.material.uniforms.uTime.value = time * 0.001;
}

function updateSunAndLighting() {
    if (!sky || !sunLight) return;

    const now = sunClockNow();
    const sun = computeSunPosition(now, SUN_LOCATION.lat, SUN_LOCATION.lng);
    const elev = sun.altitude;
    const azim = sun.azimuth;
    const altDeg = elev * 180 / Math.PI;

    // World convention: north = -Z, east = +X.
    const dir = new THREE.Vector3(
        Math.sin(azim) * Math.cos(elev),
        Math.sin(elev),
        -Math.cos(azim) * Math.cos(elev)
    );

    sky.material.uniforms.sunPosition.value.copy(dir);
    sunLight.position.copy(dir).multiplyScalar(40);
    sunDir.copy(dir); // read every frame by updateSunShafts

    // Three bands, keyed off solar elevation:
    //   day      >= +10°  full sun, hard frame shadows
    //   twilight  -6°..+10°  sun ramps out, blue hour, lamps come up
    //   night    <= -6°   civil twilight is over; ambient is near-black
    // The ramp is deliberately wide. The old one finished at +5°, which put the
    // whole of golden hour in "full day" and made sunset happen all at once.
    const dayness = THREE.MathUtils.clamp((altDeg + 6) / 16, 0, 1);
    const nightness = 1 - dayness;
    currentDayness = dayness;
    // Peaks at 1 in the middle of the twilight band, 0 at either end — the dial
    // for anything that should only happen while the sun is on the horizon.
    const twilight = 1 - Math.abs(dayness * 2 - 1);

    // Stronger key light + weaker ambient fill = harder shadows and more
    // contrast, which reads far more photographic than even flat lighting.
    sunLight.intensity = 4 * dayness;
    // Prune the sun entirely after dark. Left visible it costs a full 2048²
    // shadow-map render per frame for a light contributing nothing, and it would
    // be a second directional shadow alongside the moon's.
    sunLight.visible = dayness > 0.004;
    // Sunlight reddens as it goes through more atmosphere. This is the
    // difference between "the sun got dimmer" and sunset.
    sunLight.color.setHex(0xfff0d6).lerp(new THREE.Color(0xff9d52), twilight * 0.85);

    // --- Moon: real position, brightness by phase ---
    const moon = computeMoonPosition(now, SUN_LOCATION.lat, SUN_LOCATION.lng);
    const moonLit = computeMoonIllumination(now);
    if (moonLight) {
        // Extinction near the horizon, same as the disc gets.
        const moonLow = THREE.MathUtils.smoothstep(moon.altitude, 0.0, 0.22);
        // Phase response is deliberately non-linear: a half moon is nowhere near
        // half as bright as a full one (roughly a tenth), because at full phase
        // the surface backscatters straight at you with no shadows on it.
        const phase = Math.pow(moonLit.fraction, 2.4);
        const moonStrength = nightness * moonLow * phase;
        // Wildly exaggerated against reality — full moonlight is about a
        // hundred-thousandth of sunlight — but the point of it here is that the
        // tree line and the far end of the house stay readable after dark, and
        // that a full moon throws a faint pattern of frame shadows on the floor.
        moonLight.intensity = 1.15 * moonStrength;
        moonLight.visible = moonStrength > 0.01;
        // Shadows only from a moon bright enough to actually throw one. Below
        // that it is a 1024² map rendered for a shadow nobody can see.
        moonLight.castShadow = moonStrength > 0.22;
        if (moonLight.visible) {
            moonLight.position.set(
                Math.sin(moon.azimuth) * Math.cos(moon.altitude),
                Math.sin(moon.altitude),
                -Math.cos(moon.azimuth) * Math.cos(moon.altitude)
            ).multiplyScalar(40);
        }
    }

    // Ambient. At night this goes almost to nothing — moonlight and the lamp row
    // are the only real sources, which is what gives the room its shape after
    // dark. A generous hemisphere here reads as a grey wash over everything.
    skyFill.intensity = 0.3 * dayness + 0.035 * nightness;
    skyFill.color.setHex(0xb6dbff).lerp(new THREE.Color(0x4c6088), nightness);
    skyFill.groundColor.setHex(0x4a3a2a).lerp(new THREE.Color(0x0b0f14), nightness);
    // Warm bounce — light kicked off the wood and floor. At night this is a
    // stand-in for the lamp row's own bounce, so it follows the filament level
    // rather than nightness, and stays low: the lamps light the room, not this.
    warmFill.intensity = 0.6 * dayness + 0.22 * nightness * lampState.level;

    // Global IBL multiplier. scene.environmentIntensity only landed in three
    // r163, so on the r160 build this page pins it does nothing — the way to dim
    // the IBL here is to dim what it is generated from, a few lines below.
    scene.environmentIntensity = 0.03 + 0.97 * dayness;

    // Renderer exposure dips at night, but not as far as it used to. Raising the
    // hemisphere and IBL floors alone barely moved the room — 3x on skyFill was
    // almost invisible — because at night almost every surface is lit by the lamp
    // spots rather than by ambient, and those are already exposed correctly.
    // Exposure is the dial that actually lifts the shadows here, and ACES rolls
    // the highlights off, so the lamp pools do not blow out as it comes up.
    // Ambient is near-black now, so exposure has to come up further than before
    // to keep the room navigable — ACES rolls the highlights off, so the lamp
    // pools do not blow out as it does.
    renderer.toneMappingExposure = 1.02 * dayness + 0.95 * nightness;

    // Atmosphere. Rayleigh is what makes the sky blue, so it goes *up* through
    // twilight rather than straight down — that is the blue hour, a deep
    // saturated blue overhead once the sun is a few degrees under. Turbidity
    // (haze) peaks with it and holds the orange band low on the horizon.
    // Then both collapse for true night and the Sky mesh is hidden outright: its
    // residual pre-dawn glow used to leak through the windows, and the stars and
    // moon take over from it, so the roof is not a black void.
    sky.material.uniforms.rayleigh.value = 1.4 * dayness + 2.6 * twilight * (0.35 + 0.65 * dayness);
    sky.material.uniforms.turbidity.value = 6 * dayness + 5 * twilight + 0.6 * nightness;
    sky.visible = dayness > 0.02;
    placeNightSky(now, nightness);

    // --- Lamp switch, with hysteresis ---
    // A photocell has a dead band or it chatters. Below +2° they come on, and
    // they do not go off again until +3.5°, so the flip happens once per dawn and
    // once per dusk instead of oscillating around a single threshold. `level`
    // (the filament warm-up) is chased per frame in updateLamps().
    if (altDeg < LAMP_ON_ELEV) lampState.on = true;
    else if (altDeg > LAMP_OFF_ELEV) lampState.on = false;

    // Rebuild the IBL from the sky in its current state (runs at the same 30 s
    // cadence as this function — a few ms of GPU work). Collapsing rayleigh and
    // turbidity above already darkens the sky dome; the ground plane is a flat
    // colour, so it has to be dimmed by hand or it keeps up-lighting every
    // surface with daytime mossy green long after dark.
    if (pmremGen && envSky) {
        envSky.material.uniforms.sunPosition.value.copy(dir);
        envSky.material.uniforms.rayleigh.value = sky.material.uniforms.rayleigh.value;
        envSky.material.uniforms.turbidity.value = sky.material.uniforms.turbidity.value;
        // setHex, not setRGB — setRGB writes the working (linear) space, which
        // would make this ~10x brighter than the 0x1a2018 it is meant to match.
        // The night floor is deliberately not near-zero: this ground plane is the
        // only thing filling the lower hemisphere of the IBL, so it is what keeps
        // undersides and the far end of the house from going to flat black.
        if (envGroundMat) envGroundMat.color.setHex(0x1a2018).multiplyScalar(0.28 + 0.72 * dayness);
        const old = envRT;
        envRT = pmremGen.fromScene(envScene, 0.04);
        scene.environment = envRT.texture;
        if (old) old.dispose();
    }

    // Lamp brightness, bulb emissive and the haze cones all follow lampState.level,
    // which is ramped per frame — see updateLamps().

    // The glass is lit, so it darkens on its own after sunset. It keeps its green
    // tint after dark: the tint is old horticultural glass, and glass does not
    // stop being green when the sun goes down. It used to be lerped 75% toward
    // clear to help see the woods, which read as the panes turning into open air.
    // A little of that is still worth having — the transmission buffer is dim at
    // night and heavy grime on top of it hides the tree line entirely — so the
    // panes open up slightly and no further.
    for (const mat of [sharedAssets.wallGlass, sharedAssets.roofGlass]) {
        if (!mat) continue;
        // A little extra through twilight as well as at night. The blue hour is
        // the one time the sky above the roof is worth looking at, and heavy green
        // horticultural glass turns a deep blue sky into flat teal.
        mat.color.copy(mat.userData.dayTint).lerp(_WHITE, nightness * 0.22 + twilight * 0.34);
        mat.transmission = THREE.MathUtils.lerp(
            mat.userData.dayTransmission, mat.userData.nightTransmission, nightness);
        // Reflections of the lamp row in the panes. Two things make them appear:
        // the panes get smoother (a rough pane scatters a bulb into nothing), and
        // clearcoat adds a second, sharper specular lobe on top of the glass's
        // own — which is what turns a soft sheen into a distinct bright bulb
        // sitting in the glass. Both are dialled by nightness so daytime keeps
        // the diffusing horticultural look.
        mat.roughness = THREE.MathUtils.lerp(
            mat.userData.dayRoughness, mat.userData.nightRoughness, nightness);
        mat.clearcoat = 0.08 + 0.42 * nightness;
        mat.clearcoatRoughness = 0.22 - 0.14 * nightness;
        mat.specularIntensity = 1 + 0.5 * nightness;
    }

    // Humid haze. Densest through twilight — cool air over a warm wet floor is
    // exactly when a greenhouse fogs, and it is what puts the sunbeams and the
    // lamp cones in visible air at the moment they overlap.
    if (scene.fog) {
        scene.fog.density = 0.003 + nightness * 0.005 + twilight * 0.004;
        scene.fog.color
            .setHex(0xb6c9c2)
            .lerp(new THREE.Color(0x8a6f5e), twilight * 0.55)   // dusty gold on the horizon
            .lerp(new THREE.Color(0x070d12), nightness * nightness);
    }

    // Painted forest wall darkens with the night but keeps a moonlit trace so
    // the tree line is still there when you look out through the glass.
    if (sharedAssets._backdropMat) {
        sharedAssets._backdropMat.color.setScalar(0.17 + 0.83 * dayness);
    }

    // Fireflies only come out after dark; dust motes show best in daylight.
    if (fireflySystem) fireflySystem.material.uniforms.uNight.value = nightness;
    if (dustSystem) dustSystem.material.uniforms.uIntensity.value = 0.08 + 0.16 * dayness;

    // Night garnish that only needs the slow tick.
    for (const m of groundFogMats) m.uniforms.uNight.value = nightness;
    if (farLight) {
        // Visibility belongs on this tick, not the per-frame updater: it is purely
        // a function of nightness, and setting it here means it is already correct
        // on the first rendered frame rather than one frame later.
        farLight.material.uniforms.uNight.value = nightness;
        farLight.visible = nightness > 0.02;
    }

    // The sun and moon have moved, so their shadow maps are stale.
    sunLight.shadow.needsUpdate = true;
    if (moonLight) moonLight.shadow.needsUpdate = true;

    // Snapshot for the diagnostics overlay.
    skyState.altDeg = altDeg;
    skyState.twilight = twilight;
    skyState.moonAltDeg = moon.altitude * 180 / Math.PI;
    skyState.moonPhase = moonLit.fraction;
}

// --- Attention: an idle nudge toward an empty pot, and a nag from a wilting one ---
//
// Both of these exist because the room is big and quiet. A greenhouse with a
// hundred identical pots gives you no idea where to start, and a plant dying
// twenty metres behind you is a thing you find out about a week later.

let lastTaskActivity = 0;          // performance.now() of the last deliberate act
const IDLE_HINT_DELAY = 6000;      // ms of not gardening before the nudge appears
const HINT_RANGE = 16;             // m — beyond this, pointing at a pot is noise

let plantHint = null;              // { group, ring, motes, slot, level, target }

// A ring of light spreading out across the soil, plus a few motes lifting off it.
// Deliberately on the pot rather than in the HUD: the thing being pointed at is a
// place in the room, and an arrow on the screen would make you translate between
// the two.
function buildPlantHint() {
    const group = new THREE.Group();
    group.visible = false;

    // Sized to stay inside its own slot — the pots are on a 1 m grid, and a wider
    // ring reaches over its neighbours and stops reading as "this one".
    const geom = new THREE.PlaneGeometry(0.82, 0.82);
    geom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uLevel;
            varying vec2 vUv;
            void main() {
                float r = length(vUv - 0.5) * 2.0;
                if (r > 1.0) discard;
                // Two rings, half a cycle apart, so there is always one arriving.
                // They start out past the pot rim rather than at the centre: the
                // middle of this plane sits inside the pot, where the soil mound
                // hides it, so a ring born at r=0 spends its brightest moments
                // invisible.
                float a = 0.0;
                for (int i = 0; i < 2; i++) {
                    float phase = fract(uTime * 0.5 + float(i) * 0.5);
                    float rad = 0.34 + phase * 0.62;
                    // Thins as it spreads — a ripple, not a hoop. Fades linearly
                    // rather than quadratically, or it is faint for most of its life.
                    float w = 0.055 * (1.0 - phase * 0.45);
                    a += (1.0 - smoothstep(0.0, w, abs(r - rad))) * (1.0 - phase);
                }
                // A steady hairline at the rim, so there is always an outline even
                // between ripples, plus a soft bloom under it.
                a += (1.0 - smoothstep(0.02, 0.07, abs(r - 0.36))) * 0.30;
                a += (1.0 - smoothstep(0.30, 0.85, r)) * 0.16;
                a *= uLevel;
                if (a < 0.004) discard;
                gl_FragColor = vec4(vec3(0.62, 1.0, 0.55) * a * 1.6, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geom, ringMat);
    group.add(ring);

    const COUNT = 10;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.05 + Math.random() * 0.14;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = Math.sin(a) * r;
        seed[i] = Math.random();
    }
    const mGeom = new THREE.BufferGeometry();
    mGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mGeom.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const moteMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
        vertexShader: `
            uniform float uTime;
            attribute float aSeed;
            varying float vFade;
            void main() {
                // Each mote drifts up on its own loop and restarts at the soil.
                float k = fract(uTime * (0.22 + aSeed * 0.16) + aSeed);
                vec3 p = position;
                p.y += k * 0.55;
                p.x += sin(uTime * 0.9 + aSeed * 6.28) * 0.035;
                p.z += cos(uTime * 0.8 + aSeed * 6.28) * 0.035;
                vFade = sin(k * 3.14159);          // fades in and out over the rise
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = clamp(3.2 * (12.0 / max(0.4, -mv.z)), 1.0, 7.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform float uLevel;
            varying float vFade;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float a = smoothstep(0.5, 0.05, d) * vFade * uLevel;
                if (a < 0.004) discard;
                gl_FragColor = vec4(0.72, 1.0, 0.62, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const motes = new THREE.Points(mGeom, moteMat);
    motes.frustumCulled = false;
    group.add(motes);

    scene.add(group);
    plantHint = { group, ringMat, moteMat, slot: -1, level: 0, target: 0 };
}

// Nearest slot that has a pot in it and nothing planted. Missing and tipped slots
// are excluded for the same reason they are unclickable: you cannot plant there.
function nearestFreeSlot() {
    let best = -1, bestD = HINT_RANGE * HINT_RANGE;
    const cam = camera.position;
    for (let i = 0; i < tablePositions.length; i++) {
        if (emptyPotOccupied[i]) continue;
        const j = potJitter[i];
        if (!j || j.missing || j.tipped) continue;
        const p = tablePositions[i];
        const dx = p.x + j.dx - cam.x, dy = p.y - cam.y, dz = p.z + j.dz - cam.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
    }
    return best;
}

function updatePlantHint(now, delta) {
    if (!plantHint) return;
    const exploring = controls.isLocked || mobileActive;
    const idle = now - lastTaskActivity;
    const wants = exploring && idle > IDLE_HINT_DELAY && !prefersReducedMotion;

    const h = plantHint;
    // Re-target only while faded out, so the ring never appears to teleport
    // between benches as you walk.
    if (wants && h.level < 0.02) {
        const slot = nearestFreeSlot();
        if (slot >= 0) {
            h.slot = slot;
            const p = tablePositions[slot];
            const j = potJitter[slot];
            // Just clear of the soil mound, whose top sits about 0.24 of a pot
            // height above the bench. Level with the soil, the plane's centre is
            // buried and the ring only appears once it has spread past the rim.
            h.group.position.set(p.x + j.dx, p.y + 0.30 * j.s + 0.02, p.z + j.dz);
        } else {
            h.slot = -1;
        }
    }
    // Drop the hint if the pot it is pointing at just got planted, or if the
    // player has wandered out of range of it.
    if (h.slot >= 0 && (emptyPotOccupied[h.slot]
        || h.group.position.distanceToSquared(camera.position) > HINT_RANGE * HINT_RANGE * 1.5)) {
        h.target = 0;
    } else {
        h.target = wants && h.slot >= 0 ? 1 : 0;
    }
    // Fades in over ~0.9 s and out over ~0.35 s: an invitation should arrive
    // gently and get out of the way promptly.
    const rate = h.target > h.level ? delta / 0.9 : delta / 0.35;
    h.level = h.target > h.level
        ? Math.min(h.target, h.level + rate)
        : Math.max(h.target, h.level - rate);

    h.group.visible = h.level > 0.005;
    if (!h.group.visible) return;
    const t = now / 1000;
    h.ringMat.uniforms.uTime.value = t;
    h.ringMat.uniforms.uLevel.value = h.level;
    h.moteMat.uniforms.uTime.value = t;
    h.moteMat.uniforms.uLevel.value = h.level;
}

// --- Wilting plants asking to be noticed ---

const ATTENTION_SLOTS = 6;         // how many plants can glow at once
const attentionPool = [];          // pooled halo meshes, reassigned every second
const rattleState = { id: null, until: 0, next: 0 };
const suppressedAttention = new Set();  // ids tended this session; nag cleared
let attentionRanked = [];               // cache of the sweep below
let attentionSweep = 0;

// How badly a to-do needs looking at. Health is the right input rather than
// elapsed time, because health is the thing the player can already see: the cue
// and the plant are telling the same story.
function stalenessOf(todo) {
    if (todo.completed) return 0;
    if (suppressedAttention.has(todo.id)) return 0;
    return THREE.MathUtils.clamp((72 - todo.health) / 46, 0, 1);
}

function clearAttention(id) {
    suppressedAttention.add(id);
    if (rattleState.id === id) rattleState.id = null;
}

function buildAttentionHalos() {
    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uLevel: { value: 0 },
            uHue: { value: 0 }      // 0 amber .. 1 red
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uLevel;
            uniform float uHue;
            varying vec2 vUv;
            void main() {
                float r = length(vUv - 0.5) * 2.0;
                if (r > 1.0) discard;
                // A soft body with a brighter shell, breathing about once a second
                // — slow enough to read as a glow, quick enough to catch the eye.
                float pulse = 0.62 + 0.38 * sin(uTime * 6.0);
                float body = pow(1.0 - smoothstep(0.0, 0.85, r), 2.2) * 0.5;
                float shell = (1.0 - smoothstep(0.06, 0.30, abs(r - 0.62))) * 0.5 * pulse;
                float a = (body + shell) * uLevel;
                if (a < 0.004) discard;
                vec3 col = mix(vec3(1.0, 0.72, 0.26), vec3(1.0, 0.34, 0.22), uHue);
                gl_FragColor = vec4(col * a * 1.5, a);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    for (let i = 0; i < ATTENTION_SLOTS; i++) {
        const m = new THREE.Mesh(geom, mat.clone());
        m.visible = false;
        m.frustumCulled = false;
        m.renderOrder = 3;
        scene.add(m);
        attentionPool.push(m);
    }
}

const _attnPos = new THREE.Vector3();

function updateAttention(now, delta) {
    if (!attentionPool.length) return;

    // Rank the active to-dos by how much they need attention. Cheap enough at
    // this scale to do every second; there are at most 120 of them.
    let ranked = null;
    if (now - attentionSweep > 1000) {
        attentionSweep = now;
        ranked = todos
            .filter(t => !t.completed && t.mesh)
            .map(t => ({ todo: t, stale: stalenessOf(t) }))
            .filter(e => e.stale > 0.02)
            .sort((a, b) => b.stale - a.stale)
            .slice(0, ATTENTION_SLOTS);
        attentionRanked = ranked;
    }
    ranked = attentionRanked;

    for (let i = 0; i < attentionPool.length; i++) {
        const halo = attentionPool[i];
        const entry = ranked[i];
        if (!entry) { halo.visible = false; continue; }
        const mesh = entry.todo.mesh;
        halo.visible = true;
        // Centred on the plant, a little above the rim, and sized so it reads as
        // light around the plant rather than a disc behind it.
        halo.position.set(mesh.position.x, mesh.position.y + 0.24, mesh.position.z);
        const s = 0.62 + entry.stale * 0.22;
        halo.scale.set(s, s, s);
        halo.quaternion.copy(camera.quaternion);
        const u = halo.material.uniforms;
        u.uTime.value = now / 1000 + i * 1.7;   // out of step with each other
        u.uLevel.value = prefersReducedMotion ? entry.stale * 0.5 : entry.stale;
        u.uHue.value = THREE.MathUtils.smoothstep(entry.stale, 0.45, 1.0);
    }

    if (prefersReducedMotion) return;

    // --- Rattle ---
    // One plant at a time. Two plants shaking at once reads as a physics glitch;
    // one reads as something moving over there.
    if (!rattleState.id && now > rattleState.next && ranked.length) {
        // Prefer whichever candidate is closest to the edge of the frame. Motion
        // in peripheral vision is what actually turns a head — a plant rattling
        // dead centre is just a plant you were already looking at.
        let bestId = null, bestScore = -1;
        for (const e of ranked) {
            const edge = edgeProminence(e.todo.mesh);
            const score = e.stale * (0.35 + edge);
            if (score > bestScore) { bestScore = score; bestId = e.todo.id; }
        }
        rattleState.id = bestId;
        rattleState.until = now + 850;
    }

    for (const e of ranked) {
        const stem = e.todo.mesh.getObjectByName('stem');
        if (!stem) continue;
        if (e.todo.id !== rattleState.id) { stem.rotation.z = 0; continue; }
        if (now > rattleState.until) {
            stem.rotation.z = 0;
            rattleState.id = null;
            // A gap long enough that the next one is a fresh event rather than a
            // continuous twitch. Randomised so it never becomes a rhythm.
            rattleState.next = now + 2600 + Math.random() * 2600;
            continue;
        }
        const k = (rattleState.until - now) / 850;        // 1 → 0 over the burst
        const envelope = Math.sin(Math.PI * k) * k;        // quick attack, long tail
        // Centred, this is about a degree — a twitch you notice only if you happen
        // to be looking. Out at the edge of the frame it reaches nearly seven,
        // which is what actually turns a head.
        const amp = 0.07 * (0.5 + e.stale) * (0.5 + edgeProminence(e.todo.mesh) * 2.2);
        stem.rotation.z = Math.sin(now * 0.055) * envelope * amp;
    }
}

// How close to the edge of the frame this object sits, 0 in the middle and 1 in
// the periphery, falling back to 0 once it is off screen entirely (nothing is
// gained by shaking something nobody can see).
function edgeProminence(mesh) {
    _attnPos.copy(mesh.position);
    _attnPos.y += 0.3;
    _attnPos.project(camera);
    if (_attnPos.z > 1) return 0;                       // behind the camera
    const m = Math.max(Math.abs(_attnPos.x), Math.abs(_attnPos.y));
    return THREE.MathUtils.smoothstep(m, 0.35, 0.92)
         * (1 - THREE.MathUtils.smoothstep(m, 0.95, 1.25));
}

// --- Raycasting helpers — handle both regular Plant Groups and InstancedMesh empty pots ---
function gatherIntersectables() {
    const list = [];
    for (const group of objects) {
        for (const child of group.children) {
            // The pot sits in its own sub-group so per-slot rotation and scale can
            // be applied to it without also turning the plant. Reach one level in
            // for its meshes — deliberately not a full traverse, which would add
            // every petal of every flower to the per-frame raycast.
            if (child.userData && child.userData.isPotGroup) {
                for (const piece of child.children) list.push(piece);
            } else {
                list.push(child);
            }
        }
    }
    if (emptyPotInstances) {
        list.push(emptyPotInstances.bodies);
        list.push(emptyPotInstances.rims);
        list.push(emptyPotInstances.soils);
    }
    return list;
}

// Classify the first raycast hit. Returns { kind: 'empty'|'plant'|null, ... }
function classifyHit(hit) {
    if (!hit || !hit.object) return { kind: null };
    const obj = hit.object;
    if (obj.userData && obj.userData.isEmptyPotMesh) {
        const idx = hit.instanceId;
        if (idx === undefined || emptyPotOccupied[idx]) return { kind: null };
        return { kind: 'empty', index: idx };
    }
    let target = obj;
    while (target && target.userData && target.userData.id === undefined) {
        target = target.parent;
        if (!target || target === scene) return { kind: null };
    }
    if (target.userData && target.userData.id) {
        const todo = todos.find(t => t.id === target.userData.id);
        if (todo) return { kind: 'plant', todo };
    }
    return { kind: null };
}

// Table collision — block walking into or through any of the 20 tables.
// Tables are 2m (x) × 3m (z) tops centered at x = ±3, z = 0, -4, ..., -36.
// AABB is tight to the actual table edge (no player-radius buffer), so the 1m
// gaps between adjacent tables in the same row are fully walkable.
const TABLE_HALF_X = 1.0;
const TABLE_HALF_Z = 1.5;
function collidesWithTable(x, z) {
    // Quick reject outside the band that any table could occupy.
    if (z > TABLE_HALF_Z || z < -36 - TABLE_HALF_Z) return false;
    if (Math.abs(x) > 3 + TABLE_HALF_X) return false;
    for (let i = 0; i < 10; i++) {
        const tz = -i * 4;
        const dz = Math.abs(z - tz);
        if (dz >= TABLE_HALF_Z) continue;
        for (const tx of [-3, 3]) {
            if (Math.abs(x - tx) < TABLE_HALF_X) return true;
        }
    }
    return false;
}

// Helper to clean up 3D objects
function disposeHierarchy(node) {
    if (!node) return;

    if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
            disposeHierarchy(node.children[i]);
        }
    }

    if (node.geometry) {
        node.geometry.dispose();
    }

    if (node.material) {
        if (Array.isArray(node.material)) {
            node.material.forEach(mat => mat.dispose());
        } else {
            node.material.dispose();
        }
    }
}

// UI Event Listeners for adding todos
addTodoForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // Validated here rather than by the `required` attribute: the native bubble
    // is positioned by the browser and lands over the 3D canvas outside the
    // dialog, where it looks like a rendering fault.
    if (!validateTitle(true)) return;

    const title = todoTitle.value.trim();
    const desc = todoDesc.value.trim();
    const urgency = currentUrgency();

    if (activePotIndex === null) {
        console.error("No pot selected to plant seed.");
        return;
    }

    const newTodo = {
        id: Date.now(),
        title: title,
        desc: desc,
        urgency: urgency,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        health: 100,
        healthAtLastUpdate: 100, // anchor for half-life decay
        positionIndex: activePotIndex,
        status: "Not Started",
        completed: false
    };

    if (createPlant(newTodo)) {
        todos.push(newTodo);
        saveTodosToLocal();
        showToast(`“${title}” planted.`);
        this.reset();
        closeAddTodoModal();
    }
});

function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // A resize to zero area has to be ignored, not forwarded. Passing 0 through
    // composer.setSize() makes N8AO allocate 0×0 render targets, which raises
    // GL_INVALID_VALUE and leaves the AO pass permanently broken — it has no
    // reason to resize itself again once a later event brings the real size
    // back. Keeping the last good size is both harmless and self-correcting.
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    // composer.setSize forwards the pixel-ratio-scaled size to every pass,
    // including N8AO's beauty/depth/AO targets.
    if (composer) composer.setSize(w, h);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    // Clamp so a backgrounded tab doesn't produce a giant catch-up step
    const delta = Math.min(0.1, (time - prevTime) / 1000);

    if (controls.isLocked === true || mobileActive) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        // moveRight / moveForward update both x AND z when the camera faces
        // diagonally, so we can't selectively revert a single axis. Revert both
        // when a step would land inside a table — player simply stops at the wall.
        const pos = controls.getObject().position;
        const startX = pos.x;
        const startZ = pos.z;
        controls.moveRight(-velocity.x * delta);
        if (collidesWithTable(pos.x, pos.z)) {
            pos.x = startX;
            pos.z = startZ;
        }
        const midX = pos.x;
        const midZ = pos.z;
        controls.moveForward(-velocity.z * delta);
        if (collidesWithTable(pos.x, pos.z)) {
            pos.x = midX;
            pos.z = midZ;
        }

        // Greenhouse wall boundary
        if (pos.x < -7.5) pos.x = -7.5;
        if (pos.x > 7.5) pos.x = 7.5;
        if (pos.z < -44.5) pos.z = -44.5;
        if (pos.z > 4.5) pos.z = 4.5;

        // Hover raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(gatherIntersectables(), false);
        const hit = classifyHit(intersects[0]);
        // Aiming at something interactable counts as engagement: the nudge exists
        // to help you find a pot, so it has nothing left to do once you are
        // looking at one.
        if (hit.kind) markTaskActivity();
        if (hit.kind === 'empty') {
            hoverTooltip.textContent = "Click to plant a new to-do";
            hoverTooltip.style.display = 'block';
        } else if (hit.kind === 'plant') {
            const todo = hit.todo;
            hoverTooltip.textContent = todo.completed
                ? `Completed: ${todo.title}`
                : `${todo.title}\n[${todo.status || "Not Started"}]`;
            hoverTooltip.style.display = 'block';
        } else {
            hoverTooltip.style.display = 'none';
        }
    } else {
        hoverTooltip.style.display = 'none';
    }

    // Update plant decay
    updateDecay();

    // Refresh sun position every 30s — slow real-time motion
    if (time - lastSunUpdate > 30000) {
        lastSunUpdate = time;
        updateSunAndLighting();
    }

    // Lamps run per frame, not on the 30 s sun tick: the filament warm-up is a
    // few seconds long and the shadow-caster assignment follows the camera.
    assignLampLights(time);
    updateLamps(time, delta);

    // Attention cues. Both are per-frame: one is a timer against the player's
    // idleness, the other reads screen-space position every frame.
    updatePlantHint(time, delta);
    updateAttention(time, delta);

    // Atmosphere — wind sway (GPU-side, just a uniform write) + glowing eyes state
    updateTreeWind(time);
    updateHauntedEyes(time);
    updateFarForestLight(time);
    updateSwayingVine(time);
    updateParticles(time, delta);
    // Shafts re-aim at the camera every frame, so this can't ride the 30 s tick.
    updateSunShafts();
    // Star dome tracks the camera; twinkle needs a per-frame clock.
    updateNightSky(time);

    prevTime = time;

    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }

    if (stats) stats.update();
    updateDiagPanel(time);
}

function updateDiagPanel(time) {
    if (!diagPanel || diagPanel.style.display === 'none') return;
    if (time - diagLastUpdate < 250) return;
    diagLastUpdate = time;

    const info = renderer.info;
    const lights = { dir: 0, spot: 0, point: 0, hemi: 0 };
    scene.traverse(obj => {
        if (!obj.isLight || !obj.visible) return;
        if (obj.isDirectionalLight) lights.dir++;
        else if (obj.isSpotLight) lights.spot++;
        else if (obj.isPointLight) lights.point++;
        else if (obj.isHemisphereLight) lights.hemi++;
    });

    const sunVec = sky && sky.material && sky.material.uniforms.sunPosition.value;
    const sunAlt = sunVec
        ? Math.round(Math.asin(Math.max(-1, Math.min(1, sunVec.y))) * 180 / Math.PI)
        : '-';

    const cam = controls.getObject().position;
    const activeCount = todos.filter(t => !t.completed).length;
    const completedCount = todos.length - activeCount;
    const bulbsOn = `${lampState.on ? 'ON' : 'off'} ${lampState.level.toFixed(2)}`;
    const eyesLit = eyePairs.filter(p => p.state !== 'off').length;
    const winds = treeMaterials[0] && treeMaterials[0].userData.shader
        ? treeMaterials[0].userData.shader.uniforms.uWindStrength.value.toFixed(3)
        : '-';
    const programs = info.programs ? info.programs.length : '-';

    diagPanel.textContent = [
        '── GPU ─────────────',
        `Draw calls   ${info.render.calls}`,
        `Triangles    ${info.render.triangles.toLocaleString()}`,
        `Geometries   ${info.memory.geometries}`,
        `Textures     ${info.memory.textures}`,
        `Programs     ${programs}`,
        '',
        '── Lights ──────────',
        `Directional  ${lights.dir}`,
        `Spot         ${lights.spot}`,
        `Point        ${lights.point}`,
        `Hemisphere   ${lights.hemi}`,
        `Lamps        ${bulbsOn}`,
        `Lamp shadows ${lampShadowCount}`,
        '',
        '── World ───────────',
        `Sun alt      ${sunAlt}°`,
        `Dayness      ${currentDayness.toFixed(2)}`,
        `Twilight     ${skyState.twilight.toFixed(2)}`,
        `Moon         ${skyState.moonAltDeg.toFixed(0)}° ${(skyState.moonPhase * 100).toFixed(0)}%`
            + (moonLight && moonLight.visible ? ` ${moonLight.intensity.toFixed(2)}` : ' —'),
        `Exposure     ${renderer.toneMappingExposure.toFixed(2)}`,
        `Wind         ${winds}`,
        `Eyes lit     ${eyesLit}`,
        `Pos          ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)}`,
        `Todos        ${activeCount} active · ${completedCount} done`
    ].join('\n');
}

// --- Decay Logic ---

function getCurrentSimulatedTime() {
    return Date.now() + simulatedTimeOffset;
}

// Half-life decay: every `halfLifeDays` since the last check-in, the plant's
// health is cut in half. Urgency picks the half-life:
//   high   (3) -> 1 day
//   medium (2) -> 2 days
//   low    (1) -> 4 days
function halfLifeDaysFor(urgency) {
    if (urgency === 3) return 1;
    if (urgency === 1) return 4;
    return 2;
}

function updateDecay() {
    const currentTime = getCurrentSimulatedTime();

    todos.forEach(todo => {
        if (todo.completed) return;

        const daysElapsed = (currentTime - todo.lastUpdated) / 86400000;
        if (daysElapsed < 0) return;

        // Health at the last update (creation or check-in). Fall back to 100 for
        // legacy todos that predate this field.
        const baseHealth = typeof todo.healthAtLastUpdate === 'number'
            ? todo.healthAtLastUpdate
            : 100;
        const decay = Math.pow(0.5, daysElapsed / halfLifeDaysFor(todo.urgency));
        todo.health = Math.max(0, baseHealth * decay);

        updatePlantVisual(todo);
    });
}

// Age-based growth scale: seedlings start at 70% and reach full size over ~1.5 days.
// Shared by active plants (updatePlantVisual) and the completed-flower rebuild.
function growthScaleFor(todo) {
    const ageDays = Math.max(0, (getCurrentSimulatedTime() - (todo.createdAt || 0)) / 86400000);
    return 0.7 + 0.3 * Math.min(1, ageDays / 1.5);
}

function updatePlantVisual(todo) {
    if (!todo.mesh) return;

    const stem = todo.mesh.getObjectByName("stem");
    if (!stem) return;

    const r = Math.max(0, Math.min(1, todo.health / 100));

    // Two-stop color lerp: vibrant green -> mustard yellow -> dry brown.
    // More lifelike wilt than the previous green-to-brown linear lerp.
    const greenC = new THREE.Color(0x2ecc71);
    const yellowC = new THREE.Color(0xb89020);
    const brownC = new THREE.Color(0x5a3a20);
    const color = r > 0.5
        ? greenC.clone().lerp(yellowC, (1 - r) * 2)
        : yellowC.clone().lerp(brownC, (0.5 - r) * 2);

    stem.material.color.copy(color);
    // Leaves on a plant share one cloned material, so a single color write tints all leaves.
    const anyLeaf = stem.getObjectByName("leaf1");
    if (anyLeaf) anyLeaf.material.color.copy(color);

    // Growth: seedlings start small and reach full size over ~1.5 days of life.
    const growth = growthScaleFor(todo);

    // Droop stronger as health drops (max ~80° bend at zero health).
    stem.rotation.x = (1 - r) * (Math.PI / 2.2);
    // Stem shrinks vertically as it dies; leaves squash with it.
    stem.scale.set(growth, growth * (0.55 + r * 0.45), growth);

    // Per-leaf wither: each leaf droops, curls inward, and eventually detaches.
    // Higher leaves (later idx) drop first, like a real dying plant.
    const wiltAmount = 1 - r;
    const dropThresholds = [0, 0.06, 0.14, 0.24, 0.34, 0.44, 0.52];
    for (const child of stem.children) {
        const w = child.userData && child.userData.wilt;
        if (!w) continue;
        const stagger = 1 + w.idx * 0.18;
        const droop = wiltAmount * 0.85 * stagger;
        child.rotation.z = w.baseRz + (w.baseRz > 0 ? droop : -droop);
        // Curl: leaf narrows and shortens as it dries out
        child.scale.set(
            w.baseScale * (1 - 0.4 * wiltAmount),
            w.baseScale * (1 - 0.2 * wiltAmount),
            w.baseScale
        );
        child.visible = r > dropThresholds[w.idx] || w.idx < 2;
    }

    // Shed leaves appear on the soil once the plant starts dropping foliage.
    const fallen1 = todo.mesh.getObjectByName("fallenLeaf1");
    const fallen2 = todo.mesh.getObjectByName("fallenLeaf2");
    if (fallen1) fallen1.visible = r < 0.45;
    if (fallen2) fallen2.visible = r < 0.25;
}

// Console-accessible debug helpers (UI buttons were removed from the pause overlay):
//   greenhouseDev.fastForwardDays(n)  — jump n days into the future
//   greenhouseDev.clearSave()         — wipe local save and reload
window.greenhouseDev = {
    fastForwardDays(n = 1) {
        simulatedTimeOffset += n * 86400000;
    },
    // Move the player and aim the camera (yaw around Y, pitch on the camera).
    teleport(x = 0, y = 1.6, z = 0, yaw = 0, pitch = 0) {
        controls.getObject().position.set(x, y, z);
        controls.getObject().rotation.y = yaw;
        camera.rotation.x = pitch;
    },
    // Snapshot of live todo state (id, health, completed, slot) for debugging.
    dump() {
        return todos.map(t => ({
            id: t.id, health: Math.round(t.health), completed: !!t.completed,
            slot: t.positionIndex
        }));
    },
    clearSave() {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
};

// --- Interaction Logic ---
let activeTodo = null;
let activePotIndex = null;

// Add click listener for raycasting
document.addEventListener('click', function() {
    if (!controls.isLocked) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gatherIntersectables(), false);
    const hit = classifyHit(intersects[0]);
    if (hit.kind === 'empty') {
        activePotIndex = hit.index;
        openAddTodoModal();
    } else if (hit.kind === 'plant' && !hit.todo.completed) {
        openTodoModal(hit.todo);
    }
});

// Any deliberate act of gardening. Resets the idle timer that eventually points
// out an empty pot — see updatePlantHint.
function markTaskActivity() {
    lastTaskActivity = performance.now();
}

function openAddTodoModal() {
    markTaskActivity();
    // Display the modal BEFORE releasing pointer-lock so the unlock-event handler
    // sees a modal is open and doesn't briefly flash the pause overlay underneath.
    addTodoModal.style.display = 'flex';
    uiContainer.style.display = 'none';
    pauseForModal();

    addTodoForm.reset();
    setUrgency(2);
    titleError.textContent = '';
    todoTitle.removeAttribute('aria-invalid');
    syncCounts();
    validateTitle(false);
    const frame = vinesFor(addTodoModal);
    if (frame) frame.open();
    trapFocus(addTodoModal.querySelector('.gh-panel'), todoTitle);
}

function closeAddTodoModal() {
    addTodoModal.style.display = 'none';
    activePotIndex = null;
    uiContainer.style.display = 'none'; // paranoid: ensure pause overlay isn't lingering
    const frame = vinesFor(addTodoModal);
    if (frame) frame.close();
    releaseFocus();
    markTaskActivity();
    startExploring();
}

closeAddModal.addEventListener('click', closeAddTodoModal);

function setUrgency(level) {
    const el = addTodoModal.querySelector(`input[name="urgency"][value="${level}"]`);
    if (el) el.checked = true;
}

function currentUrgency() {
    const el = addTodoModal.querySelector('input[name="urgency"]:checked');
    return el ? parseInt(el.value, 10) : 2;
}

function currentEffort() {
    const el = todoModal.querySelector('input[name="effort"]:checked');
    return el ? parseInt(el.value, 10) : 0;
}

// Character counters stay invisible until they matter. A counter that is always
// on reads as a limit you are being warned about; one that appears at 80 % reads
// as help.
function syncCounts() {
    const pairs = [[todoTitle, titleCount, 70], [todoDesc, descCount, 280]];
    for (const [input, out, max] of pairs) {
        if (!input || !out) continue;
        const left = max - input.value.length;
        out.textContent = `${left} left`;
        out.classList.toggle('is-near', input.value.length > max * 0.8);
    }
}

// `announce` is false while typing — nagging on every keystroke before the user
// has finished is the classic inline-validation mistake. The message only appears
// once they try to submit.
function validateTitle(announce) {
    const ok = todoTitle.value.trim().length > 0;
    btnPlant.disabled = !ok;
    if (announce && !ok) {
        titleError.textContent = 'Give it a name and it can be planted.';
        todoTitle.setAttribute('aria-invalid', 'true');
        todoTitle.focus();
    } else if (ok) {
        titleError.textContent = '';
        todoTitle.removeAttribute('aria-invalid');
    }
    return ok;
}

todoTitle.addEventListener('input', () => { syncCounts(); validateTitle(false); });
todoDesc.addEventListener('input', syncCounts);
// Cmd/Ctrl+Enter submits from the notes field, where a bare Enter has to stay a
// newline.
todoDesc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        addTodoForm.requestSubmit ? addTodoForm.requestSubmit() : btnPlant.click();
    }
});

function openTodoModal(todo) {
    activeTodo = todo;
    markTaskActivity();
    // Show the modal BEFORE releasing pointer-lock; see openAddTodoModal for why.
    todoModal.style.display = 'flex';
    uiContainer.style.display = 'none';
    pauseForModal();

    modalTitle.textContent = todo.title;
    modalDesc.textContent = todo.desc || '';

    const urgency = URGENCY[todo.urgency] || URGENCY[2];
    modalUrgency.textContent = urgency.name;
    modalTended.textContent = todo.lastUpdated
        ? `tended ${relativeTime(todo.lastUpdated)}`
        : 'just planted';
    const days = urgency.halfLifeDays;
    modalDecay.textContent = days === 1
        ? 'Loses half its health every day it goes untended.'
        : `Loses half its health every ${days} days it goes untended.`;

    setStatusChip(todo.status || 'Not Started');
    const zero = todoModal.querySelector('input[name="effort"][value="0"]');
    if (zero) zero.checked = true;
    renderVitals(todo.health);
    syncCheckinPreview();

    const frame = vinesFor(todoModal);
    if (frame) frame.open();
    trapFocus(todoModal.querySelector('.gh-panel'), btnCheckin);
}

function closeTodoModal() {
    // Flush before dropping the reference. Status changes already save on click, so
    // this is belt-and-braces — but "close the dialog and keep my changes" should
    // not depend on every individual control having remembered to save itself.
    if (activeTodo) saveTodosToLocal();
    todoModal.style.display = 'none';
    activeTodo = null;
    uiContainer.style.display = 'none'; // paranoid: ensure pause overlay isn't lingering
    const frame = vinesFor(todoModal);
    if (frame) frame.close();
    releaseFocus();
    markTaskActivity();
    startExploring();
}

closeModal.addEventListener('click', closeTodoModal);

// Clicking the backdrop dismisses. Guarded on the target being the scrim itself,
// so a drag that starts inside the panel and ends outside it does not close.
for (const scrim of [addTodoModal, todoModal]) {
    scrim.addEventListener('mousedown', (e) => {
        if (e.target !== scrim) return;
        (scrim === todoModal ? closeTodoModal : closeAddTodoModal)();
    });
}

function renderVitals(health) {
    const h = Math.max(0, Math.min(100, health));
    const band = healthBand(h);
    modalHealth.textContent = Math.round(h) + '%';
    modalHealthLabel.textContent = band.label;
    modalMeterFill.style.width = h + '%';
    modalMeterFill.classList.remove('is-wilting', 'is-dying');
    if (band.cls) modalMeterFill.classList.add(band.cls);
    modalMeter.setAttribute('aria-valuenow', String(Math.round(h)));
    modalMeter.setAttribute('aria-valuetext', `${Math.round(h)} percent, ${band.label}`);
}

// The ghost bar and the button's suffix both show where this watering lands, so
// the choice is made against its outcome rather than against a label.
function syncCheckinPreview() {
    if (!activeTodo) return;
    const boost = currentEffort();
    const target = Math.min(100, activeTodo.health + boost);
    modalMeterGhost.style.width = target + '%';
    checkinPreview.textContent = boost > 0
        ? `${Math.round(activeTodo.health)}% → ${Math.round(target)}%`
        : '';
}

todoModal.querySelectorAll('input[name="effort"]').forEach(el => {
    el.addEventListener('change', syncCheckinPreview);
});

// --- Status chips ---
function setStatusChip(status) {
    for (const chip of statusChips.querySelectorAll('.gh-chip')) {
        const on = chip.dataset.status === status;
        chip.setAttribute('aria-checked', on ? 'true' : 'false');
        chip.setAttribute('role', 'radio');
        chip.tabIndex = on ? 0 : -1;
    }
}

statusChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.gh-chip');
    if (!chip || !activeTodo) return;
    activeTodo.status = chip.dataset.status;
    setStatusChip(activeTodo.status);
    saveTodosToLocal();
    markTaskActivity();
});

// Arrow keys move through a radio group; that is what a radiogroup promises.
statusChips.addEventListener('keydown', (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const chips = Array.from(statusChips.querySelectorAll('.gh-chip'));
    const at = chips.findIndex(c => c.getAttribute('aria-checked') === 'true');
    const step = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
    const next = chips[(at + step + chips.length) % chips.length];
    next.click();
    next.focus();
});

btnCheckin.addEventListener('click', function() {
    if (!activeTodo) return;
    const effortBoost = currentEffort();
    const oldHealth = activeTodo.health;
    const newHealth = Math.min(100, activeTodo.health + effortBoost);

    // Apply health + anchor decay base to the new value, then save.
    activeTodo.health = newHealth;
    activeTodo.healthAtLastUpdate = newHealth;
    activeTodo.lastUpdated = getCurrentSimulatedTime();
    updatePlantVisual(activeTodo);
    saveTodosToLocal();
    markTaskActivity();
    // Tending it is the whole point of the nagging, so stop nagging.
    clearAttention(activeTodo.id);

    const checkinBtn = this;
    checkinBtn.disabled = true;
    modalTended.textContent = 'tended just now';
    modalMeterGhost.style.width = '0%';
    checkinPreview.textContent = '';
    showToast(effortBoost > 0
        ? `Watered. ${healthBand(newHealth).label.toLowerCase()} at ${Math.round(newHealth)}%.`
        : 'Noted. It will keep for now.');

    // Count the meter up rather than snapping it — the number moving is the
    // feedback that the check-in registered.
    const ANIM_MS = 900;
    const t0 = performance.now();
    (function tickHealth(now) {
        const t = Math.min((now - t0) / ANIM_MS, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        renderVitals(oldHealth + (newHealth - oldHealth) * eased);
        if (t < 1) requestAnimationFrame(tickHealth);
    })(performance.now());

    setTimeout(() => {
        checkinBtn.disabled = false;
        closeTodoModal();
    }, 1700);
});

// Only initialize if not in test environment
if (typeof window === 'undefined' || !window.__TEST_ENV__) {
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        init();
        animate();
    }
}

btnComplete.addEventListener('click', function() {
    if (!activeTodo) return;
    const title = activeTodo.title;
    activeTodo.completed = true;
    activeTodo.health = 100;
    activeTodo.status = "Completed";
    // Lock in a random flower variant — saved with the todo so it's permanent.
    if (typeof activeTodo.flowerVariant !== 'number') {
        activeTodo.flowerVariant = Math.floor(Math.random() * NUM_FLOWER_VARIANTS);
    }

    saveTodosToLocal();
    clearAttention(activeTodo.id);

    // Recreate the plant visually to show the flower
    createPlant(activeTodo);

    showToast(`“${title}” is flowering.`);
    closeTodoModal();
});

// --- Mobile / touch helpers ---

function resetMovement() {
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
}

function startExploring() {
    if (isTouchDevice) {
        mobileActive = true;
        blocker.style.display = 'none';
        uiContainer.style.display = 'none';
        mobileControls.classList.add('active');
    } else {
        requestResume();
    }
}

// Keep asking for pointer lock until we get it or three seconds run out. A single
// controls.lock() is enough when it follows a click, but not when it follows
// Escape — see the note on resumeUntil.
function requestResume() {
    resumeUntil = performance.now() + 3000;
    attemptLock();
}

function attemptLock() {
    clearTimeout(resumeTimer);
    if (anyModalOpen()) { resumeUntil = 0; return; }
    const now = performance.now();
    if (now > resumeUntil) {
        resumeUntil = 0;
        // Gave up. Show the pause overlay rather than leaving the player unlocked
        // with nothing to click.
        if (!controls.isLocked) uiContainer.style.display = 'flex';
        return;
    }
    // Wait out Chrome's post-Escape cooldown instead of asking and being refused;
    // every refusal is a console error from PointerLockControls.
    const cooling = ESCAPE_COOLDOWN - (now - lastEscapeAt);
    if (cooling <= 0 && !controls.isLocked) controls.lock();
    // The timer keeps running for the rest of the window even once we are locked,
    // because Chrome will sometimes grant the lock and take it straight back — and
    // then this is what re-acquires it instead of the player getting a pause screen.
    resumeTimer = setTimeout(attemptLock, cooling > 0 ? cooling + 40 : 400);
}

function cancelResume() {
    resumeUntil = 0;
    clearTimeout(resumeTimer);
}

function pauseForModal() {
    cancelResume();
    // Always, not just on touch: a key held down when the dialog opened would
    // otherwise stay held, because onKeyDown is suppressed while a dialog is up.
    resetMovement();
    if (isTouchDevice) {
        mobileActive = false;
        mobileControls.classList.remove('active');
    } else {
        controls.unlock();
    }
}

function showMobileMenu() {
    mobileActive = false;
    resetMovement();
    mobileControls.classList.remove('active');
    uiContainer.style.display = 'flex';
}

function setupTouchControls() {
    const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const JOY_RADIUS = 50;
    const TAP_THRESHOLD_PX = 10;
    const LOOK_SENSITIVITY = 0.005;

    // ----- Joystick -----
    let joyTouchId = null;
    let joyCenterX = 0;
    let joyCenterY = 0;

    joystick.addEventListener('touchstart', (e) => {
        if (joyTouchId !== null) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        joyTouchId = touch.identifier;
        const rect = joystick.getBoundingClientRect();
        joyCenterX = rect.left + rect.width / 2;
        joyCenterY = rect.top + rect.height / 2;
    }, { passive: false });

    joystick.addEventListener('touchmove', (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== joyTouchId) continue;
            e.preventDefault();
            const dx = touch.clientX - joyCenterX;
            const dy = touch.clientY - joyCenterY;
            const dist = Math.min(JOY_RADIUS, Math.hypot(dx, dy));
            const angle = Math.atan2(dy, dx);
            const sx = Math.cos(angle) * dist;
            const sy = Math.sin(angle) * dist;
            stick.style.transform = `translate(${sx}px, ${sy}px)`;
            const nx = sx / JOY_RADIUS;
            const ny = sy / JOY_RADIUS;
            moveLeft = nx < -0.3;
            moveRight = nx > 0.3;
            moveForward = ny < -0.3;
            moveBackward = ny > 0.3;
        }
    }, { passive: false });

    function endJoystick(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== joyTouchId) continue;
            e.preventDefault();
            joyTouchId = null;
            stick.style.transform = '';
            resetMovement();
        }
    }
    joystick.addEventListener('touchend', endJoystick, { passive: false });
    joystick.addEventListener('touchcancel', endJoystick, { passive: false });

    // ----- Look zone (drag to rotate, tap to interact) -----
    let lookTouchId = null;
    let lookLastX = 0;
    let lookLastY = 0;
    let lookMoved = 0;

    lookZone.addEventListener('touchstart', (e) => {
        if (lookTouchId !== null) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        lookTouchId = touch.identifier;
        lookLastX = touch.clientX;
        lookLastY = touch.clientY;
        lookMoved = 0;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== lookTouchId) continue;
            e.preventDefault();
            const dx = touch.clientX - lookLastX;
            const dy = touch.clientY - lookLastY;
            lookLastX = touch.clientX;
            lookLastY = touch.clientY;
            lookMoved += Math.abs(dx) + Math.abs(dy);

            lookEuler.setFromQuaternion(camera.quaternion);
            lookEuler.y -= dx * LOOK_SENSITIVITY;
            lookEuler.x -= dy * LOOK_SENSITIVITY;
            lookEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, lookEuler.x));
            camera.quaternion.setFromEuler(lookEuler);
        }
    }, { passive: false });

    function endLook(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== lookTouchId) continue;
            const tappedX = touch.clientX;
            const tappedY = touch.clientY;
            const wasTap = lookMoved < TAP_THRESHOLD_PX;
            lookTouchId = null;
            if (wasTap && mobileActive) {
                performTapInteraction(tappedX, tappedY);
            }
        }
    }
    lookZone.addEventListener('touchend', endLook, { passive: false });
    lookZone.addEventListener('touchcancel', endLook, { passive: false });

    // ----- Menu button -----
    menuBtn.addEventListener('click', showMobileMenu);
}

function performTapInteraction(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const tapMouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(tapMouse, camera);
    const intersects = raycaster.intersectObjects(gatherIntersectables(), false);
    const hit = classifyHit(intersects[0]);
    if (hit.kind === 'empty') {
        activePotIndex = hit.index;
        openAddTodoModal();
    } else if (hit.kind === 'plant' && !hit.todo.completed) {
        openTodoModal(hit.todo);
    }
}

// Export for tests
export { saveTodosToLocal };