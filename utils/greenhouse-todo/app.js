import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import Stats from 'three/addons/libs/stats.module.js';

THREE.Cache.enabled = true;

let camera, scene, renderer, controls;
let raycaster, mouse;
let composer; // post-processing composer
let sharedLeafMat; // shared leaf material across plants
const textureLoader = new THREE.TextureLoader();
const sharedAssets = {}; // shared textures / materials

// Sun + lighting (updated each tick)
let sky, sunLight, skyFill, warmFill;
let pmremGen, envScene, envSky, envRT; // sky-driven IBL, refreshed with the sun
const bulbLights = []; // PointLights inside Edison bulbs
const bulbMeshes = []; // bulb glass meshes for emissive control
const SUN_LOCATION = { lat: 40.7128, lng: -74.0060 }; // NYC — Eastern Time
let lastSunUpdate = 0;

// Instanced empty pots — one InstancedMesh per pot piece, hidden per-slot when planted
let emptyPotInstances = null;
const emptyPotOccupied = [];

// Forest + atmosphere
const treeMaterials = [];    // tree/foliage materials with onBeforeCompile-injected wind
const shaftMeshes = [];      // additive light-shaft cones below each lamp (night only)
let currentDayness = 1;      // 1 = full day, 0 = full night (set by updateSunAndLighting)
const eyePairs = [];         // glowing-red eye pair state machines

// Particles & weather (built in buildParticles / buildForestAtmosphere)
let dripSystem = null;       // falling water drops inside the greenhouse
const ripplePool = [];       // expanding rings where drips land
let dustSystem = null;       // floating dust motes / pollen
let fireflySystem = null;    // night fireflies out in the forest
const mistSprites = [];      // drifting ground-fog sprites outside
const GREENHOUSE_BOUNDS = { xMin: -8, xMax: 8, zMin: -45, zMax: 5 };

// FPS / stats overlay (toggled with F)
let stats = null;
let diagPanel = null;
let diagLastUpdate = 0;
// Chrome enforces a ~1.25 s cooldown after Escape releases pointer-lock during
// which requestPointerLock is silently refused. We retry once when that happens.
let lockRetryScheduled = false;

const objects = []; // Interactable objects (plants)
let todos = []; // Data for todos

// Time tracking
let simulatedTimeOffset = 0; // Fast forward offset in ms

// Local Storage keys
const STORAGE_KEY = 'greenhouse-todos-data';

// Touch device detection (coarse pointer = primary input is touch)
const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
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
const modalStatus = document.getElementById('modal-status');
const modalUrgency = document.getElementById('modal-urgency');
const todoEffort = document.getElementById('todo-effort');

// Form Elements
const addTodoForm = document.getElementById('add-todo-form');
const todoTitle = document.getElementById('todo-title');
const todoDesc = document.getElementById('todo-desc');
const todoUrgency = document.getElementById('todo-urgency');

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

    // 5. Sky shader for outdoor backdrop
    sky = new Sky();
    sky.scale.setScalar(1500);
    sky.material.uniforms.mieCoefficient.value = 0.005;
    sky.material.uniforms.mieDirectionalG.value = 0.85;
    scene.add(sky);

    // 6. Lighting — sun (directional) + soft fill from sky
    sunLight = new THREE.DirectionalLight(0xfff0d6, 0); // intensity set by updateSunAndLighting
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -55;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.04;
    sunLight.shadow.radius = 4;
    scene.add(sunLight);

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
        blocker.style.display = 'none';
        uiContainer.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        const todoModalOpen = todoModal.style.display !== 'none';
        const addTodoModalOpen = addTodoModal.style.display !== 'none';
        if (!todoModalOpen && !addTodoModalOpen) {
            uiContainer.style.display = 'flex';
            blocker.style.display = 'none';
        }
    });

    scene.add(controls.getObject());

    // 6. Movement Event Listeners
    const onKeyDown = function (event) {
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
    //   - If a modal is open, close it AND resume walking.
    //   - If pointer-lock is engaged (walking), let the browser release it; the
    //     'unlock' event shows the pause overlay.
    //   - If pause overlay or home blocker is showing, resume walking.
    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Escape') return;
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

    // Auto-retry requestPointerLock when Chrome rejects it during the
    // ~1.25s post-Escape cooldown. Without this the first ESC press on the
    // pause overlay silently fails and the user has to press multiple times.
    document.addEventListener('pointerlockerror', () => {
        if (lockRetryScheduled) return;
        if (isTouchDevice) return;
        lockRetryScheduled = true;
        setTimeout(() => {
            lockRetryScheduled = false;
            if (controls.isLocked) return;
            const todoOpen = todoModal.style.display !== 'none';
            const addOpen = addTodoModal.style.display !== 'none';
            if (todoOpen || addOpen) return; // user is reading a modal
            const wantsWalking = uiContainer.style.display === 'flex'
                || blocker.style.display !== 'none';
            if (wantsWalking) controls.lock();
        }, 1350);
    });
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

function setupPostProcessing() {
    // 10. Post-processing — bloom for soft highlights through the glass
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
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

    // 8c. Wet, messy, overgrown interior
    buildPuddles();
    buildVinesAndIvy();
    buildClutter();
    buildGreenhouseParticles();

    // 9. Initial sun + lighting (uses real Eastern Time)
    updateSunAndLighting();

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

    // Per-plank character: tone variation + how far it has greyed with age
    const planks = [];
    for (let p = 0; p < 4; p++) {
        planks.push({
            tone: 0.82 + Math.random() * 0.3,
            grey: 0.15 + Math.random() * 0.4,
            phase: Math.random() * Math.PI * 2,
            freq: 0.26 + Math.random() * 0.18
        });
    }

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
            // Grain: streaks running along the plank, warped by low-freq noise
            const s = 0.5 + 0.5 * Math.sin((x + warp[i] * 46) * plank.freq + plank.phase);
            const lum = (0.58 + 0.22 * fine[i] + 0.2 * s) * plank.tone * (isGap ? 0.4 : 1);
            // Base oak browns desaturated toward weathered grey per plank
            const r0 = 128, g0 = 101, b0 = 74;
            const grey = (r0 + g0 + b0) / 3;
            const k = plank.grey;
            const px = i * 4;
            cimg.data[px + 0] = (r0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 1] = (g0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 2] = (b0 * (1 - k) + grey * k) * lum;
            cimg.data[px + 3] = 255;
            const b = isGap ? 40 : 110 + fine[i] * 80 + s * 50;
            bimg.data[px + 0] = bimg.data[px + 1] = bimg.data[px + 2] = b;
            bimg.data[px + 3] = 255;
            const rough = 205 + fine[i] * 35 - s * 18;
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
        envMapIntensity: 0.5
    });
}

function getGlassMaterial() {
    if (sharedAssets.glass) return sharedAssets.glass;
    // MeshBasicMaterial — unlit, so glass tint is constant from every angle. No envMap
    // reflections, no specular glare, no view-dependent color. A streaky grime map
    // (condensation runs, algae film, mineral spots) makes the panes read as decades-old
    // greenhouse glass rather than clean acrylic.
    const SIZE = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c0dcc4';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Vertical condensation streaks running down the pane
    for (let i = 0; i < 70; i++) {
        const x = Math.random() * SIZE;
        const top = Math.random() * SIZE * 0.5;
        const len = 30 + Math.random() * (SIZE - top);
        const light = Math.random() < 0.5;
        ctx.strokeStyle = light
            ? `rgba(230,245,235,${0.10 + Math.random() * 0.20})`
            : `rgba(90,120,95,${0.08 + Math.random() * 0.18})`;
        ctx.lineWidth = 0.6 + Math.random() * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 5, top + len * 0.5, x + (Math.random() - 0.5) * 7, top + len);
        ctx.stroke();
    }
    // Algae film creeping up from the bottom edge
    const algae = ctx.createLinearGradient(0, SIZE, 0, SIZE * 0.55);
    algae.addColorStop(0, 'rgba(70,110,70,0.5)');
    algae.addColorStop(1, 'rgba(70,110,70,0)');
    ctx.fillStyle = algae;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Mineral spots / old splashes
    for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(225,235,220,${0.06 + Math.random() * 0.16})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 0.5 + Math.random() * 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    const grimeTex = new THREE.CanvasTexture(canvas);
    configureRepeat(grimeTex, [3, 1], true);

    sharedAssets.glass = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: grimeTex,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: true
    });
    return sharedAssets.glass;
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
    // Pebbles + bits of debris pressed into the mud
    for (let i = 0; i < 260; i++) {
        const shade = 60 + Math.random() * 70;
        cctx.fillStyle = `rgb(${shade|0},${(shade-12)|0},${(shade-22)|0})`;
        cctx.beginPath();
        cctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1.5 + Math.random() * 4, 0, Math.PI * 2);
        cctx.fill();
    }
    // Scattered dead-leaf fragments trodden into the floor
    for (let i = 0; i < 120; i++) {
        const r = 80 + Math.random() * 50;
        const g = 55 + Math.random() * 35;
        cctx.fillStyle = `rgba(${r|0},${g|0},20,${0.4 + Math.random() * 0.4})`;
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

    // Roughness — wet patches are glossy (low roughness) so they catch the light
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    const rimg = rctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const w = Math.pow(wet[i], 1.6);
        const rough = 235 - w * 190 + grain[i] * 20;
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
        envMapIntensity: 0.9
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

    // Roughness: damp clay is slightly glossy, salt bloom is bone dry
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    const rimg = rctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const wet = Math.max(0, 0.4 - blotch[i]) * 2.2;
        const rough = 225 - wet * 110 + grain[i] * 25;
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
        envMapIntensity: 0.4
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
        // Fresh potting mix: nearly black where damp, browner where drying out
        const m = moist[i];
        const px = i * 4;
        img.data[px + 0] = 18 + (1 - m) * 26;
        img.data[px + 1] = 11 + (1 - m) * 16;
        img.data[px + 2] = 6 + (1 - m) * 8;
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

    // Damp patches catch the light — low roughness where the mix is wet
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = SIZE;
    const rctx = roughCanvas.getContext('2d');
    const rimg = rctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const rough = 235 - Math.pow(moist[i], 1.4) * 150;
        const px = i * 4;
        rimg.data[px + 0] = rimg.data[px + 1] = rimg.data[px + 2] = rough;
        rimg.data[px + 3] = 255;
    }
    rctx.putImageData(rimg, 0, 0);
    const roughTex = new THREE.CanvasTexture(roughCanvas);

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
        normalScale: new THREE.Vector2(1.3, 1.3),
        roughnessMap: roughTex,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.5
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
        const p = scatterPoint(1.5, 32, i);
        // 70% living, 30% dead snags for the haunted look
        const dead = Math.random() < 0.3;
        const pool = archetypes
            .map((a, idx) => ({ a, idx }))
            .filter(e => e.a.dead === dead);
        const pick = pool[Math.floor(Math.random() * pool.length)].idx;
        placements[pick].push({
            x: p.x, z: p.z,
            rotY: Math.random() * Math.PI * 2,
            scale: 0.85 + Math.random() * 1.05
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
        bark.castShadow = true;
        bark.receiveShadow = false;
        bark.frustumCulled = false;
        scene.add(bark);
        if (foliage) {
            foliage.instanceMatrix.needsUpdate = true;
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
        const p = scatterPoint(26, 60, i);
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
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false; // bounding sphere doesn't account for scattered instances
        scene.add(mesh);
    });

    buildForestFloor();
    buildUndergrowth(foliageTex);
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
        { mat: fernMat, count: 450 },
        { mat: bushMat, count: 520 }
    ].forEach(({ mat, count }) => {
        const mesh = new THREE.InstancedMesh(crossGeom, mat, count);
        for (let i = 0; i < count; i++) {
            const side = i % 4;
            // Pack the understory right up against the glass and keep it deep
            const dist = 0.6 + Math.pow(Math.random(), 1.4) * 36;
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
        color: 0x12181a,
        roughness: 0.04,
        metalness: 0,
        envMapIntensity: 1.5,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.92
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
    const rippleGeom = new THREE.RingGeometry(0.75, 0.85, 24);
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
        r.mesh.material.opacity = 0.45 * (1 - k);
    }

    // Dust + firefly shader clocks
    if (dustSystem) dustSystem.material.uniforms.uTime.value = t;
    if (fireflySystem) fireflySystem.material.uniforms.uTime.value = t;

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
        tint.setHSL(0.3 + Math.random() * 0.05, 0.4 + Math.random() * 0.2, 0.3 + Math.random() * 0.15);
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

    // --- Half-used bag of potting soil slumped against the right base ---
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x33281c, roughness: 1, metalness: 0 });
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 4, 10), bagMat);
    bag.scale.set(1, 0.85, 0.6);
    bag.position.set(7.45, 0.3, -12.3);
    bag.rotation.z = 0.42;
    bag.castShadow = true;
    bag.receiveShadow = true;
    scene.add(bag);
    const bagSpill = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), soilMat);
    bagSpill.rotation.x = -Math.PI / 2;
    bagSpill.position.set(7.1, 0.017, -12.0);
    bagSpill.scale.set(1.3, 1, 0.9);
    scene.add(bagSpill);

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
    const glassMat = getGlassMaterial();
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

    // Top glass above the door
    const doorHeight = 4.0;
    if (baseHeight + wallHeight > doorHeight) {
        const topGlassHeight = (baseHeight + wallHeight) - doorHeight;
        const topGlass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, topGlassHeight, 0.2), glassMat);
        topGlass.position.set(0, doorHeight + topGlassHeight / 2, 5);
        ghGroup.add(topGlass);
    }

    // ---- Steeple (gable) roof: two flat panels meeting at the ridge ----
    const roofGeomBox = new THREE.BoxGeometry(slopeLength, 0.08, totalLength);

    const leftRoof = new THREE.Mesh(roofGeomBox, glassMat);
    leftRoof.position.set(-halfWidth / 2, (wallTopY + ridgeY) / 2, zCenter);
    leftRoof.rotation.z = slopeAngle;
    ghGroup.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofGeomBox, glassMat);
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

    // Door Frame
    const doorFrameMat = getMetalFrameMaterial();
    const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorHeight, 0.25), doorFrameMat);
    doorFrameLeft.position.set(-doorWidth / 2 + 0.05, 0, 0);
    doorGroup.add(doorFrameLeft);

    const doorFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorHeight, 0.25), doorFrameMat);
    doorFrameRight.position.set(doorWidth / 2 - 0.05, 0, 0);
    doorGroup.add(doorFrameRight);

    const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 0.1, 0.25), doorFrameMat);
    doorFrameTop.position.set(0, doorHeight / 2 - 0.05, 0);
    doorGroup.add(doorFrameTop);

    // Glass Pane
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.2, doorHeight - 0.1, 0.1), glassMat);
    doorGlass.position.set(0, -0.05, 0);
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
    const hoodHeight = 0.18;
    const hoodCenterY = cordBottomY - hoodHeight / 2;
    const hoodBottomY = cordBottomY - hoodHeight;
    const bulbY = hoodBottomY - 0.02;

    // Shared materials — keep ONE per piece so `bulbMat.emissiveIntensity = ...`
    // updates all 20 bulbs in a single write.
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x1f140b });
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.55, metalness: 0.7 });
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
    const hoodGeom = new THREE.CylinderGeometry(0.04, 0.18, hoodHeight, 18, 1, true);
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

    // Light-shaft cone — narrow (~28°), pointed at the table surface (y=1)
    const SPOT_ANGLE = Math.PI / 6.4;
    const shaftHeight = bulbY - 1.0;            // ends at the table top
    const shaftBottomR = Math.tan(SPOT_ANGLE) * shaftHeight;
    const shaftGeom = new THREE.CylinderGeometry(0.02, shaftBottomR, shaftHeight, 18, 1, true);
    const shaftMat = new THREE.MeshBasicMaterial({
        color: 0xffb070,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
    });
    const shaftsMesh = new THREE.InstancedMesh(shaftGeom, shaftMat, numLamps);
    shaftsMesh.visible = false;
    shaftsMesh.userData.detail = true;
    // Track a single mesh-and-material pair for night updates
    shaftMeshes.length = 0;
    shaftMeshes.push(shaftsMesh);

    const _lm = new THREE.Matrix4();
    const _lq = new THREE.Quaternion();
    const _ls = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < numLamps; i++) {
        const p = lampPositions[i];
        _lm.compose(new THREE.Vector3(p.x, cordCenterY,             p.z), _lq, _ls);
        cordsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, cordBottomY + 0.03,      p.z), _lq, _ls);
        socketsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, hoodCenterY,             p.z), _lq, _ls);
        hoodsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, bulbY,                   p.z), _lq, _ls);
        bulbsMesh.setMatrixAt(i, _lm);
        filamentsMesh.setMatrixAt(i, _lm);
        _lm.compose(new THREE.Vector3(p.x, bulbY - shaftHeight / 2, p.z), _lq, _ls);
        shaftsMesh.setMatrixAt(i, _lm);

        // SpotLight + target object — these can't be instanced.
        const spot = new THREE.SpotLight(0xffaa55, 0, 6, SPOT_ANGLE, 0.35, 2.2);
        spot.position.set(p.x, bulbY, p.z);
        const target = new THREE.Object3D();
        target.position.set(p.x, 0, p.z);
        ghGroup.add(target);
        spot.target = target;
        spot.castShadow = false;
        ghGroup.add(spot);
        bulbLights.push(spot);
    }
    [cordsMesh, socketsMesh, hoodsMesh, bulbsMesh, filamentsMesh, shaftsMesh].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        ghGroup.add(m);
    });

    // Module-shared references for night-mode updates.
    sharedAssets._bulbMat = bulbMat;
    sharedAssets._shaftMat = shaftMat;

    // Selectively set shadow casting/receiving:
    // - Skip detail meshes (mullions, slats, bulbs) and transparent glass — they don't
    //   produce useful shadows but cost real GPU time.
    // - Opaque structural meshes still cast and receive shadows.
    ghGroup.traverse(obj => {
        if (!obj.isMesh) return;
        const isDetail = obj.userData.detail === true;
        const isGlass = obj.material === glassMat;
        obj.castShadow = !isDetail && !isGlass;
        obj.receiveShadow = !isDetail;
    });

    scene.add(ghGroup);
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

function buildPotMeshes(group) {
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.105, 0.2, 28, 1),
        potMat
    );
    body.position.y = 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.155, 0.012, 8, 28),
        potMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.205;
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);

    // Soil mound (slightly domed)
    const soil = new THREE.Mesh(
        new THREE.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.5),
        soilMat
    );
    soil.position.y = 0.18;
    soil.scale.y = 0.45;
    soil.receiveShadow = true;
    soil.castShadow = true;
    group.add(soil);
}

function createEmptyPotsInstanced() {
    const count = tablePositions.length;
    const potMat = getPotMaterial();
    const soilMat = getSoilMaterial();

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

    const tmp = new THREE.Matrix4();
    const noRot = new THREE.Quaternion();
    const rimRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const baseScale = new THREE.Vector3(1, 1, 1);
    const soilScale = new THREE.Vector3(1, 0.45, 1);

    for (let i = 0; i < count; i++) {
        const p = tablePositions[i];
        emptyPotOccupied.push(false);

        tmp.compose(new THREE.Vector3(p.x, p.y + 0.1, p.z), noRot, baseScale);
        bodies.setMatrixAt(i, tmp);

        tmp.compose(new THREE.Vector3(p.x, p.y + 0.205, p.z), rimRot, baseScale);
        rims.setMatrixAt(i, tmp);

        tmp.compose(new THREE.Vector3(p.x, p.y + 0.18, p.z), noRot, soilScale);
        soils.setMatrixAt(i, tmp);
    }
    bodies.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;
    soils.instanceMatrix.needsUpdate = true;

    scene.add(bodies);
    scene.add(rims);
    scene.add(soils);

    emptyPotInstances = { bodies, rims, soils };
}

function setEmptyPotOccupied(index, occupied) {
    if (!emptyPotInstances) return;
    emptyPotOccupied[index] = occupied;
    const tmp = new THREE.Matrix4();
    const noRot = new THREE.Quaternion();
    const rimRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    if (occupied) {
        // Hide via zero-scale matrix
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        emptyPotInstances.bodies.setMatrixAt(index, zero);
        emptyPotInstances.rims.setMatrixAt(index, zero);
        emptyPotInstances.soils.setMatrixAt(index, zero);
    } else {
        const p = tablePositions[index];
        const s = new THREE.Vector3(1, 1, 1);
        const soilS = new THREE.Vector3(1, 0.45, 1);
        tmp.compose(new THREE.Vector3(p.x, p.y + 0.1, p.z), noRot, s);
        emptyPotInstances.bodies.setMatrixAt(index, tmp);
        tmp.compose(new THREE.Vector3(p.x, p.y + 0.205, p.z), rimRot, s);
        emptyPotInstances.rims.setMatrixAt(index, tmp);
        tmp.compose(new THREE.Vector3(p.x, p.y + 0.18, p.z), noRot, soilS);
        emptyPotInstances.soils.setMatrixAt(index, tmp);
    }
    emptyPotInstances.bodies.instanceMatrix.needsUpdate = true;
    emptyPotInstances.rims.instanceMatrix.needsUpdate = true;
    emptyPotInstances.soils.instanceMatrix.needsUpdate = true;
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

    // Plant Group
    const plantGroup = new THREE.Group();
    plantGroup.position.copy(pos);
    plantGroup.userData = {
        id: todoData.id,
        positionIndex: positionIndex,
        isEmpty: false
    };

    // 1. Pot + soil
    buildPotMeshes(plantGroup);

    if (todoData.completed) {
        // Short thin stem — flower is the star, not the stalk.
        const stemHeight = 0.18;
        const stemGeom = new THREE.CylinderGeometry(0.011, 0.017, stemHeight, 10);
        stemGeom.translate(0, stemHeight / 2, 0);
        const plantMat = makeStemMaterial();
        const stem = new THREE.Mesh(stemGeom, plantMat);
        stem.position.y = 0.2;
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
        stem.position.y = 0.2; // Start at dirt level
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
            dead.position.set(Math.cos(a) * 0.07, 0.24, Math.sin(a) * 0.07);
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

    return true;
}

// --- Sun position (SunCalc algorithm) and day/night lighting ---

function computeSunPosition(date, lat, lng) {
    const rad = Math.PI / 180;
    const J1970 = 2440588;
    const J2000 = 2451545;
    const e = rad * 23.4397; // obliquity of the Earth

    const toJulian = (d) => d.getTime() / 86400000 - 0.5 + J1970;
    const toDays = (d) => toJulian(d) - J2000;

    const rightAsc = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const decl = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    const azimuthFn = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    const altitudeFn = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

    const sunMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
    const eclipticLong = (M) => {
        const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
        const P = rad * 102.9372;
        return M + C + P + Math.PI;
    };

    const d = toDays(date);
    const M = sunMeanAnomaly(d);
    const L = eclipticLong(M);
    const ra = rightAsc(L, 0);
    const dec = decl(L, 0);

    const lw = rad * -lng;
    const phi = rad * lat;
    const H = sidereal(d, lw) - ra;

    return {
        altitude: altitudeFn(H, phi, dec),     // radians; >0 means above horizon
        azimuth: azimuthFn(H, phi, dec) + Math.PI // radians from north (0=N, π/2=E, π=S, 3π/2=W)
    };
}

function updateSunAndLighting() {
    if (!sky || !sunLight) return;

    const sun = computeSunPosition(new Date(), SUN_LOCATION.lat, SUN_LOCATION.lng);
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

    // dayness: 1 fully day, 0 fully night, smooth between altitude -6° → +5°
    const dayness = THREE.MathUtils.clamp((altDeg + 6) / 11, 0, 1);
    const nightness = 1 - dayness;
    currentDayness = dayness;

    // Stronger key light + weaker ambient fill = harder shadows and more
    // contrast, which reads far more photographic than even flat lighting.
    sunLight.intensity = 3.5 * dayness;
    skyFill.intensity = 0.3 * dayness;                      // off entirely at night
    warmFill.intensity = 0.6 * dayness;                     // off entirely at night

    // Global IBL multiplier — collapses ambient PBR fill to near-zero at night so
    // only direct lamp cones illuminate anything.
    scene.environmentIntensity = 0.005 + 0.995 * dayness;

    // Renderer exposure also dips at night so any stray brightness stays muted.
    renderer.toneMappingExposure = 1.02 * dayness + 0.45 * nightness;

    // Atmosphere: collapse rayleigh/turbidity at night and hide the Sky mesh entirely
    // when fully night — its pre-dawn glow was leaking through the windows.
    sky.material.uniforms.rayleigh.value = 1.4 * dayness + 0.04 * nightness;
    sky.material.uniforms.turbidity.value = 6 * dayness + 0.6 * nightness;
    sky.visible = dayness > 0.05;

    // Rebuild the IBL from the sky in its current state (runs at the same 30 s
    // cadence as this function — a few ms of GPU work).
    if (pmremGen && envSky) {
        envSky.material.uniforms.sunPosition.value.copy(dir);
        envSky.material.uniforms.rayleigh.value = sky.material.uniforms.rayleigh.value;
        envSky.material.uniforms.turbidity.value = sky.material.uniforms.turbidity.value;
        const old = envRT;
        envRT = pmremGen.fromScene(envScene, 0.04);
        scene.environment = envRT.texture;
        if (old) old.dispose();
    }

    // Edison bulbs glow at night. Setting visible=false prunes them from the
    // PBR shader's light list entirely — big win during the day.
    const bulbsOn = nightness > 0.01;
    bulbLights.forEach(light => {
        light.visible = bulbsOn;
        light.intensity = nightness * 9;
    });
    // Bulbs share one material, so a single write handles all 20.
    if (sharedAssets._bulbMat) {
        sharedAssets._bulbMat.emissiveIntensity = nightness * 1.8;
    }

    // Light shafts: fade in at night, hide entirely during day.
    if (sharedAssets._shaftMat) {
        sharedAssets._shaftMat.opacity = nightness * 0.15;
    }
    shaftMeshes.forEach(mesh => {
        mesh.visible = bulbsOn;
    });

    // Humid haze: thicker and colder at night, soft green-grey by day.
    if (scene.fog) {
        // Lighter daytime haze so the forest keeps its depth and color instead
        // of washing out into the pale sky; thick and cold after dark.
        scene.fog.density = 0.003 + nightness * 0.009;
        scene.fog.color.setHex(0xb6c9c2).lerp(new THREE.Color(0x070d12), nightness);
    }

    // Fireflies only come out after dark; dust motes show best in daylight.
    if (fireflySystem) fireflySystem.material.uniforms.uNight.value = nightness;
    if (dustSystem) dustSystem.material.uniforms.uIntensity.value = 0.08 + 0.16 * dayness;
}

// --- Raycasting helpers — handle both regular Plant Groups and InstancedMesh empty pots ---
function gatherIntersectables() {
    const list = [];
    for (const group of objects) {
        for (const child of group.children) list.push(child);
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

    const title = todoTitle.value;
    const desc = todoDesc.value;
    const urgency = parseInt(todoUrgency.value);

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
        this.reset();
        closeAddTodoModal();
    }
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
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

    // Atmosphere — wind sway (GPU-side, just a uniform write) + glowing eyes state
    updateTreeWind(time);
    updateHauntedEyes(time);
    updateParticles(time, delta);

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
    const bulbsOn = bulbLights.length && bulbLights[0].visible ? 'ON' : 'off';
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
        `Bulbs        ${bulbsOn}`,
        '',
        '── World ───────────',
        `Sun alt      ${sunAlt}°`,
        `Dayness      ${currentDayness.toFixed(2)}`,
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

function openAddTodoModal() {
    // Display the modal BEFORE releasing pointer-lock so the unlock-event handler
    // sees a modal is open and doesn't briefly flash the pause overlay underneath.
    addTodoModal.style.display = 'flex';
    uiContainer.style.display = 'none';
    pauseForModal();
}

function closeAddTodoModal() {
    addTodoModal.style.display = 'none';
    activePotIndex = null;
    uiContainer.style.display = 'none'; // paranoid: ensure pause overlay isn't lingering
    startExploring();
}

closeAddModal.addEventListener('click', closeAddTodoModal);

function openTodoModal(todo) {
    activeTodo = todo;
    // Show the modal BEFORE releasing pointer-lock; see openAddTodoModal for why.
    todoModal.style.display = 'flex';
    uiContainer.style.display = 'none';
    pauseForModal();

    modalTitle.textContent = todo.title;
    modalDesc.textContent = todo.desc;
    modalHealth.textContent = Math.round(todo.health) + '%';
    modalStatus.textContent = todo.status || "Not Started";

    let urgencyText = "Medium";
    if (todo.urgency === 1) urgencyText = "Low";
    if (todo.urgency === 3) urgencyText = "High";
    modalUrgency.textContent = urgencyText;

    todoEffort.value = "0";
}

function closeTodoModal() {
    todoModal.style.display = 'none';
    activeTodo = null;
    uiContainer.style.display = 'none'; // paranoid: ensure pause overlay isn't lingering
    startExploring();
}

closeModal.addEventListener('click', closeTodoModal);

// Status buttons
const statusButtons = [
    { id: 'btn-status-procrastinating', text: 'Procrastinating' },
    { id: 'btn-status-inprogress', text: 'In Progress' },
    { id: 'btn-status-almostdone', text: 'Almost Done' }
];

statusButtons.forEach(btnInfo => {
    document.getElementById(btnInfo.id).addEventListener('click', () => {
        if (activeTodo) {
            activeTodo.status = btnInfo.text;
            modalStatus.textContent = btnInfo.text;
            saveTodosToLocal();
        }
    });
});

btnCheckin.addEventListener('click', function() {
    if (!activeTodo) return;
    const effortBoost = parseInt(todoEffort.value);
    const oldHealth = activeTodo.health;
    const newHealth = Math.min(100, activeTodo.health + effortBoost);

    // Apply health + anchor decay base to the new value, then save.
    activeTodo.health = newHealth;
    activeTodo.healthAtLastUpdate = newHealth;
    activeTodo.lastUpdated = getCurrentSimulatedTime();
    updatePlantVisual(activeTodo);
    saveTodosToLocal();

    // Count-up animation on the health display (~1s), then auto-close at 2s.
    const healthEl = modalHealth;
    const checkinBtn = this;
    checkinBtn.disabled = true;
    const ANIM_MS = 1000;
    const t0 = performance.now();
    function tickHealth(now) {
        const t = Math.min((now - t0) / ANIM_MS, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const v = oldHealth + (newHealth - oldHealth) * eased;
        healthEl.textContent = Math.round(v) + '%';
        if (t < 1) requestAnimationFrame(tickHealth);
    }
    requestAnimationFrame(tickHealth);

    setTimeout(() => {
        checkinBtn.disabled = false;
        closeTodoModal();
    }, 2000);
});

// Only initialize if not in test environment
if (typeof window === 'undefined' || !window.__TEST_ENV__) {
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        init();
        animate();
    }
}

btnComplete.addEventListener('click', function() {
    if (activeTodo) {
        activeTodo.completed = true;
        activeTodo.health = 100;
        activeTodo.status = "Completed";
        // Lock in a random flower variant — saved with the todo so it's permanent.
        if (typeof activeTodo.flowerVariant !== 'number') {
            activeTodo.flowerVariant = Math.floor(Math.random() * NUM_FLOWER_VARIANTS);
        }

        saveTodosToLocal();

        // Recreate the plant visually to show the flower
        createPlant(activeTodo);

        closeTodoModal();
    }
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
        controls.lock();
    }
}

function pauseForModal() {
    if (isTouchDevice) {
        mobileActive = false;
        resetMovement();
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