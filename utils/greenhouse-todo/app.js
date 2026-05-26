import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
const bulbLights = []; // PointLights inside Edison bulbs
const bulbMeshes = []; // bulb glass meshes for emissive control
const SUN_LOCATION = { lat: 40.7128, lng: -74.0060 }; // NYC — Eastern Time
let lastSunUpdate = 0;

// Instanced empty pots — one InstancedMesh per pot piece, hidden per-slot when planted
let emptyPotInstances = null;
const emptyPotOccupied = [];

// Forest + atmosphere
const treeMaterials = [];    // tree billboard materials (one per type) with onBeforeCompile-injected wind
const shaftMeshes = [];      // additive light-shaft cones below each lamp (night only)
let currentDayness = 1;      // 1 = full day, 0 = full night (set by updateSunAndLighting)
const eyePairs = [];         // glowing-red eye pair state machines

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
    // 4. Image-based lighting via procedural room environment (gives nice IBL on PBR materials)
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

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

    // 8b. Haunted forest backdrop + glowing eyes
    buildHauntedForest();
    buildHauntedEyes();

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

// Real PBR wood from threejs.org's CDN. Each call returns a material with cloned-textures
// so different surfaces can have their own UV repeats.
function makeWoodMaterial({ repeat = [1, 1], roughness = 0.85, color = 0xffffff } = {}) {
    const colorMap = textureLoader.load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
    const bumpMap = textureLoader.load('https://threejs.org/examples/textures/hardwood2_bump.jpg');
    const roughMap = textureLoader.load('https://threejs.org/examples/textures/hardwood2_roughness.jpg');
    configureRepeat(colorMap, repeat, true);
    configureRepeat(bumpMap, repeat, false);
    configureRepeat(roughMap, repeat, false);
    return new THREE.MeshPhysicalMaterial({
        color,
        map: colorMap,
        bumpMap: bumpMap,
        bumpScale: 0.0015,
        roughnessMap: roughMap,
        roughness,
        metalness: 0,
        envMapIntensity: 0.7
    });
}

function getGlassMaterial() {
    if (sharedAssets.glass) return sharedAssets.glass;
    // MeshBasicMaterial — unlit, so glass tint is constant from every angle. No envMap
    // reflections, no specular glare, no view-dependent color. Slight green tint with
    // ~28% opacity reads as "foggy old greenhouse glass".
    sharedAssets.glass = new THREE.MeshBasicMaterial({
        color: 0xc0dcc4,
        transparent: true,
        opacity: 0.28,
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

    // Color
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const cctx = colorCanvas.getContext('2d');
    cctx.fillStyle = '#3a2718';
    cctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 5000; i++) {
        const r = 30 + Math.random() * 35;
        const g = 18 + Math.random() * 25;
        const b = 8 + Math.random() * 18;
        cctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.15 + Math.random() * 0.45})`;
        cctx.beginPath();
        cctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 3, 0, Math.PI * 2);
        cctx.fill();
    }
    // Pebbles
    for (let i = 0; i < 220; i++) {
        const shade = 70 + Math.random() * 70;
        cctx.fillStyle = `rgb(${shade|0},${(shade-12)|0},${(shade-22)|0})`;
        cctx.beginPath();
        cctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1.5 + Math.random() * 4.5, 0, Math.PI * 2);
        cctx.fill();
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    configureRepeat(colorTex, [12, 12], true);

    // Height
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#3a3a3a';
    hctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 1200; i++) {
        const grey = 50 + Math.random() * 130;
        hctx.fillStyle = `rgb(${grey|0},${grey|0},${grey|0})`;
        hctx.beginPath();
        hctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 6, 0, Math.PI * 2);
        hctx.fill();
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 8);
    configureRepeat(normalTex, [12, 12], false);

    sharedAssets.floor = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughness: 0.95,
        metalness: 0
    });
    return sharedAssets.floor;
}

function getPotMaterial() {
    if (sharedAssets.pot) return sharedAssets.pot;
    const SIZE = 256;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const ctx = colorCanvas.getContext('2d');
    // Terracotta base
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, '#b06138');
    grad.addColorStop(0.5, '#9a5331');
    grad.addColorStop(1, '#7a3f24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Variation specks
    for (let i = 0; i < 600; i++) {
        const r = 130 + Math.random() * 80;
        const g = 60 + Math.random() * 40;
        const b = 35 + Math.random() * 25;
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${Math.random() * 0.45})`;
        ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 4, 1 + Math.random() * 3);
    }
    // Subtle horizontal bands (throwing rings)
    for (let y = 0; y < SIZE; y += 6 + Math.random() * 4) {
        ctx.fillStyle = `rgba(40,20,10,${0.04 + Math.random() * 0.08})`;
        ctx.fillRect(0, y, SIZE, 1);
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 6 + Math.random() * 4) {
        hctx.fillStyle = `rgba(40,40,40,0.6)`;
        hctx.fillRect(0, y, SIZE, 1);
    }
    for (let i = 0; i < 240; i++) {
        const grey = 110 + Math.random() * 100;
        hctx.fillStyle = `rgb(${grey|0},${grey|0},${grey|0})`;
        hctx.beginPath();
        hctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 2.5, 0, Math.PI * 2);
        hctx.fill();
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 4);

    sharedAssets.pot = new THREE.MeshStandardMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.82,
        metalness: 0
    });
    return sharedAssets.pot;
}

function getSoilMaterial() {
    if (sharedAssets.soil) return sharedAssets.soil;
    const SIZE = 128;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const ctx = colorCanvas.getContext('2d');
    ctx.fillStyle = '#1f1108';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 800; i++) {
        const r = 30 + Math.random() * 40;
        const g = 18 + Math.random() * 25;
        const b = 8 + Math.random() * 18;
        ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${0.4 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 0.8 + Math.random() * 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = SIZE;
    const hctx = heightCanvas.getContext('2d');
    hctx.fillStyle = '#606060';
    hctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 600; i++) {
        const grey = 80 + Math.random() * 120;
        hctx.fillStyle = `rgb(${grey|0},${grey|0},${grey|0})`;
        hctx.beginPath();
        hctx.arc(Math.random() * SIZE, Math.random() * SIZE, 0.8 + Math.random() * 2, 0, Math.PI * 2);
        hctx.fill();
    }
    const normalTex = makeNormalMapFromCanvas(heightCanvas, 5);

    sharedAssets.soil = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1, 1),
        roughness: 1,
        metalness: 0
    });
    return sharedAssets.soil;
}

function createLeafMaterial() {
    const SIZE = 256;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = SIZE;
    const cctx = colorCanvas.getContext('2d');
    cctx.clearRect(0, 0, SIZE, SIZE);
    const grad = cctx.createRadialGradient(SIZE / 2, SIZE * 0.55, 8, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, '#7ed47a');
    grad.addColorStop(0.55, '#3da650');
    grad.addColorStop(1, '#1f5a2c');
    cctx.fillStyle = grad;
    cctx.beginPath();
    cctx.ellipse(SIZE / 2, SIZE / 2, SIZE / 2.45, SIZE / 2.05, 0, 0, Math.PI * 2);
    cctx.fill();

    cctx.strokeStyle = 'rgba(20, 60, 25, 0.5)';
    cctx.lineWidth = 1.6;
    cctx.beginPath();
    cctx.moveTo(SIZE / 2, 8);
    cctx.lineTo(SIZE / 2, SIZE - 8);
    for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const yPos = 12 + t * (SIZE - 24);
        const len = (1 - Math.abs(t - 0.5) * 1.5) * SIZE / 2.6;
        cctx.moveTo(SIZE / 2, yPos);
        cctx.lineTo(SIZE / 2 + len, yPos - len * 0.4);
        cctx.moveTo(SIZE / 2, yPos);
        cctx.lineTo(SIZE / 2 - len, yPos - len * 0.4);
    }
    cctx.stroke();
    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = alphaCanvas.height = SIZE;
    const actx = alphaCanvas.getContext('2d');
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, SIZE, SIZE);
    actx.fillStyle = '#fff';
    actx.beginPath();
    actx.ellipse(SIZE / 2, SIZE / 2, SIZE / 2.45, SIZE / 2.05, 0, 0, Math.PI * 2);
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

    return new THREE.MeshStandardMaterial({
        map: colorTex,
        alphaMap: alphaTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.65,
        metalness: 0,
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
    // GPU-only wind sway — uniforms are written from updateTreeWind once per frame.
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
                float _swayFactor = smoothstep(0.0, 7.0, position.y);
                float _swayX = sin(_phase) * uWindStrength * _swayFactor;
                float _swayZ = sin(_phase * 0.8 + 1.2) * uWindStrength * 0.5 * _swayFactor;
                transformed.x += _swayX;
                transformed.z += _swayZ;
            `);
        mat.userData.shader = shader;
    };
    return mat;
}

function buildHauntedForest() {
    // Two textures for variation — bare gnarled and leafy old-growth.
    const bareTex = createDeadTreeTexture();
    bareTex.colorSpace = THREE.SRGBColorSpace;
    const leafyTex = createOldGrowthTreeTexture();
    leafyTex.colorSpace = THREE.SRGBColorSpace;

    // Crossed planes per tree → merged into one BufferGeometry, instanced.
    const treeWidth = 5;
    const treeHeight = 10;
    const plane1 = new THREE.PlaneGeometry(treeWidth, treeHeight);
    plane1.translate(0, treeHeight / 2, 0);
    const plane2 = plane1.clone();
    plane2.rotateY(Math.PI / 2);
    const treeGeom = mergeGeometries([plane1, plane2]);

    const bareMat = makeWindyTreeMaterial(bareTex, 0x1c1814);
    const leafyMat = makeWindyTreeMaterial(leafyTex, 0x141a14);
    treeMaterials.push(bareMat, leafyMat);

    // Three distance bands of dense trees so the back rows form a wall and you
    // can't see through to infinity. Far band is heavily packed silhouettes.
    const trees = [];
    const bands = [
        { distMin: 10, distMax: 20, count: 120, scaleMin: 0.85, scaleMax: 1.55 },
        { distMin: 18, distMax: 32, count: 180, scaleMin: 0.7,  scaleMax: 1.25 },
        { distMin: 30, distMax: 55, count: 260, scaleMin: 0.55, scaleMax: 1.00 }
    ];
    for (const band of bands) {
        for (let i = 0; i < band.count; i++) {
            const side = i % 4;
            const dist = band.distMin + Math.random() * (band.distMax - band.distMin);
            let x, z;
            if (side === 0)      { x = -8 - dist; z = -60 + Math.random() * 80; }
            else if (side === 1) { x =  8 + dist; z = -60 + Math.random() * 80; }
            else if (side === 2) { x = -32 + Math.random() * 64; z = -45 - dist; }
            else                 { x = -32 + Math.random() * 64; z =   5 + dist; }
            trees.push({
                x, z,
                scale: band.scaleMin + Math.random() * (band.scaleMax - band.scaleMin),
                rotY: Math.random() * Math.PI * 2,
                type: Math.random() < 0.6 ? 1 : 0 // 60% leafy, 40% bare
            });
        }
    }

    // Split into two InstancedMesh per type (still 2 draw calls total).
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _yAxis = new THREE.Vector3(0, 1, 0);
    [
        { mat: bareMat, type: 0 },
        { mat: leafyMat, type: 1 }
    ].forEach(({ mat, type }) => {
        const subset = trees.filter(t => t.type === type);
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

// --- Flower variants (one is randomly chosen per completed todo) ---

const NUM_FLOWER_VARIANTS = 5;

// Flat horizontal petal: base at origin, length along +X, slight upward curve at tip.
function makeHorizontalPetal(width, length, curveAmount = 0.012) {
    const geom = new THREE.PlaneGeometry(width, length, 4, 8);
    geom.rotateZ(-Math.PI / 2);
    geom.rotateX(Math.PI / 2);
    geom.translate(length / 2, 0, 0);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const t = x / length;
        const taper = Math.sin(t * Math.PI * 1.05);
        pos.setZ(i, z * Math.max(0.15, taper));
        pos.setY(i, curveAmount * Math.pow(t, 1.5));
    }
    geom.computeVertexNormals();
    return geom;
}

// Vertical petal: base at origin, length along +Y, curving inward (-Z) at tip for cup shape.
function makeVerticalPetal(width, length, curveAmount = 0.04) {
    const geom = new THREE.PlaneGeometry(width, length, 4, 10);
    geom.translate(0, length / 2, 0);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const t = y / length;
        const taper = Math.sin(t * Math.PI * 1.05);
        pos.setX(i, x * Math.max(0.18, taper));
        pos.setZ(i, -curveAmount * Math.pow(t, 1.4));
    }
    geom.computeVertexNormals();
    return geom;
}

function getDaisyAssets() {
    if (sharedAssets.daisy) return sharedAssets.daisy;
    sharedAssets.daisy = {
        centerGeom: (() => { const g = new THREE.SphereGeometry(0.025, 16, 12); g.scale(1, 0.5, 1); return g; })(),
        centerMat: new THREE.MeshStandardMaterial({
            color: 0xffc54a, roughness: 0.45, emissive: 0xffaa00, emissiveIntensity: 0.12
        }),
        ringGeom: new THREE.TorusGeometry(0.018, 0.003, 6, 18),
        ringMat: new THREE.MeshStandardMaterial({ color: 0xe6850a, roughness: 0.5, emissive: 0xc06000, emissiveIntensity: 0.1 }),
        petalGeom: makeHorizontalPetal(0.025, 0.062, 0.008),
        petalMat: new THREE.MeshStandardMaterial({
            color: 0xfafff5, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0xfff8f0, emissiveIntensity: 0.08
        })
    };
    return sharedAssets.daisy;
}

function buildFlower_Daisy() {
    const a = getDaisyAssets();
    const group = new THREE.Group();
    const center = new THREE.Mesh(a.centerGeom, a.centerMat);
    center.position.y = 0.005;
    group.add(center);
    const ring = new THREE.Mesh(a.ringGeom, a.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;
    group.add(ring);
    const petalCount = 14;
    for (let i = 0; i < petalCount; i++) {
        const petal = new THREE.Mesh(a.petalGeom, a.petalMat);
        petal.rotation.y = -(i / petalCount) * Math.PI * 2;
        group.add(petal);
    }
    return group;
}

function getSunflowerAssets() {
    if (sharedAssets.sunflower) return sharedAssets.sunflower;
    const centerGeom = new THREE.SphereGeometry(0.04, 18, 14);
    centerGeom.scale(1, 0.5, 1);
    sharedAssets.sunflower = {
        centerGeom,
        centerMat: new THREE.MeshStandardMaterial({ color: 0x4a2618, roughness: 0.85 }),
        seedGeom: new THREE.SphereGeometry(0.004, 5, 4),
        seedMat: new THREE.MeshStandardMaterial({ color: 0x180a04, roughness: 1 }),
        petalGeom: makeHorizontalPetal(0.03, 0.085, 0.014),
        petalMat: new THREE.MeshStandardMaterial({
            color: 0xffc846, roughness: 0.5, side: THREE.DoubleSide,
            emissive: 0xff7a00, emissiveIntensity: 0.1
        }),
        innerPetalMat: new THREE.MeshStandardMaterial({
            color: 0xff9020, roughness: 0.5, side: THREE.DoubleSide,
            emissive: 0xc04000, emissiveIntensity: 0.12
        })
    };
    return sharedAssets.sunflower;
}

function buildFlower_Sunflower() {
    const a = getSunflowerAssets();
    const group = new THREE.Group();
    const center = new THREE.Mesh(a.centerGeom, a.centerMat);
    center.position.y = 0.006;
    group.add(center);
    for (let i = 0; i < 28; i++) {
        const seed = new THREE.Mesh(a.seedGeom, a.seedMat);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 0.034;
        seed.position.set(Math.cos(angle) * r, 0.022, Math.sin(angle) * r);
        group.add(seed);
    }
    const outerCount = 18;
    for (let i = 0; i < outerCount; i++) {
        const petal = new THREE.Mesh(a.petalGeom, a.petalMat);
        petal.rotation.y = -(i / outerCount) * Math.PI * 2;
        group.add(petal);
    }
    const innerCount = 12;
    for (let i = 0; i < innerCount; i++) {
        const petal = new THREE.Mesh(a.petalGeom, a.innerPetalMat);
        petal.rotation.y = -(i / innerCount) * Math.PI * 2 + Math.PI / innerCount;
        petal.position.y = 0.003;
        petal.scale.setScalar(0.78);
        group.add(petal);
    }
    return group;
}

function getRoseAssets() {
    if (sharedAssets.rose) return sharedAssets.rose;
    sharedAssets.rose = {
        innerGeom: makeVerticalPetal(0.025, 0.05, 0.06),
        midGeom:   makeVerticalPetal(0.04,  0.07, 0.05),
        outerGeom: makeVerticalPetal(0.052, 0.085, 0.04),
        innerMat: new THREE.MeshStandardMaterial({
            color: 0x8a0820, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0x300208, emissiveIntensity: 0.18
        }),
        midMat: new THREE.MeshStandardMaterial({
            color: 0xc41a4a, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0x500511, emissiveIntensity: 0.15
        }),
        outerMat: new THREE.MeshStandardMaterial({
            color: 0xe04070, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0x701030, emissiveIntensity: 0.12
        })
    };
    return sharedAssets.rose;
}

function buildFlower_Rose() {
    const a = getRoseAssets();
    const group = new THREE.Group();
    function addLayer(geom, mat, count, tilt, yOffset, phase) {
        for (let i = 0; i < count; i++) {
            const wrap = new THREE.Group();
            wrap.rotation.y = (i / count) * Math.PI * 2 + (phase || 0);
            const tilted = new THREE.Group();
            tilted.rotation.x = tilt;
            tilted.position.y = yOffset;
            tilted.add(new THREE.Mesh(geom, mat));
            wrap.add(tilted);
            group.add(wrap);
        }
    }
    addLayer(a.innerGeom, a.innerMat, 5, -Math.PI / 2.4, 0.018, 0);
    addLayer(a.midGeom,   a.midMat,   8, -Math.PI / 3,   0.008, 0.4);
    addLayer(a.outerGeom, a.outerMat, 12, -Math.PI / 4,  0.0,   0.2);
    addLayer(a.outerGeom, a.outerMat, 14, -Math.PI / 5,  -0.004, 0.6);
    return group;
}

function getTulipAssets() {
    if (sharedAssets.tulip) return sharedAssets.tulip;
    sharedAssets.tulip = {
        outerGeom: makeVerticalPetal(0.045, 0.13, 0.07),
        innerGeom: makeVerticalPetal(0.04, 0.105, 0.085),
        outerMat: new THREE.MeshStandardMaterial({
            color: 0xcc4488, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0x501030, emissiveIntensity: 0.12
        }),
        innerMat: new THREE.MeshStandardMaterial({
            color: 0xe060a0, roughness: 0.4, side: THREE.DoubleSide,
            emissive: 0x70204a, emissiveIntensity: 0.15
        }),
        stamenGeom: new THREE.CylinderGeometry(0.0035, 0.003, 0.04, 6),
        stamenMat: new THREE.MeshStandardMaterial({
            color: 0xffd84a, roughness: 0.45,
            emissive: 0xffaa00, emissiveIntensity: 0.2
        })
    };
    return sharedAssets.tulip;
}

function buildFlower_Tulip() {
    const a = getTulipAssets();
    const group = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const wrap = new THREE.Group();
        wrap.rotation.y = (i / 6) * Math.PI * 2;
        const tilted = new THREE.Group();
        tilted.rotation.x = -Math.PI / 11;
        tilted.add(new THREE.Mesh(a.outerGeom, a.outerMat));
        wrap.add(tilted);
        group.add(wrap);
    }
    for (let i = 0; i < 3; i++) {
        const wrap = new THREE.Group();
        wrap.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const tilted = new THREE.Group();
        tilted.rotation.x = -Math.PI / 18;
        tilted.position.y = 0.005;
        tilted.add(new THREE.Mesh(a.innerGeom, a.innerMat));
        wrap.add(tilted);
        group.add(wrap);
    }
    for (let i = 0; i < 4; i++) {
        const stamen = new THREE.Mesh(a.stamenGeom, a.stamenMat);
        const angle = (i / 4) * Math.PI * 2;
        stamen.position.set(Math.cos(angle) * 0.006, 0.04, Math.sin(angle) * 0.006);
        group.add(stamen);
    }
    return group;
}

function createFloretTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(32, 32);
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.ellipse(0, -11, 7, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.fillStyle = '#ffea7a';
    ctx.beginPath();
    ctx.arc(32, 32, 3.2, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

function getHydrangeaAssets() {
    if (sharedAssets.hydrangea) return sharedAssets.hydrangea;
    const tex = createFloretTexture();
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedAssets.hydrangea = {
        floretGeom: new THREE.PlaneGeometry(0.026, 0.026),
        blueMat: new THREE.MeshStandardMaterial({
            map: tex, color: 0x9ab8ff, roughness: 0.4, side: THREE.DoubleSide,
            transparent: true, alphaTest: 0.4,
            emissive: 0x3050aa, emissiveIntensity: 0.1
        }),
        violetMat: new THREE.MeshStandardMaterial({
            map: tex, color: 0xc8a4ff, roughness: 0.4, side: THREE.DoubleSide,
            transparent: true, alphaTest: 0.4,
            emissive: 0x603090, emissiveIntensity: 0.1
        }),
        pinkMat: new THREE.MeshStandardMaterial({
            map: tex, color: 0xffa0d0, roughness: 0.4, side: THREE.DoubleSide,
            transparent: true, alphaTest: 0.4,
            emissive: 0x901050, emissiveIntensity: 0.1
        })
    };
    return sharedAssets.hydrangea;
}

function buildFlower_Hydrangea() {
    const a = getHydrangeaAssets();
    const group = new THREE.Group();
    const mats = [a.blueMat, a.violetMat, a.pinkMat];
    const floretCount = 24;
    const lookTarget = new THREE.Vector3();
    for (let i = 0; i < floretCount; i++) {
        const u = (i + 0.5) / floretCount;
        const theta = u * Math.PI * 2 * 4.7;
        const phi = Math.acos(1 - 1.65 * u);
        const r = 0.058;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi) * 0.7 + 0.018;
        const z = r * Math.sin(phi) * Math.sin(theta);
        const mat = mats[(i * 7) % mats.length];
        const floret = new THREE.Mesh(a.floretGeom, mat);
        floret.position.set(x, y, z);
        // Face outward from the cluster center
        const len = Math.hypot(x, y - 0.018, z) || 1;
        lookTarget.set(x + x / len, y + (y - 0.018) / len, z + z / len);
        floret.lookAt(lookTarget);
        floret.scale.setScalar(0.85 + Math.random() * 0.35);
        group.add(floret);
    }
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
    const tableMaterial = makeWoodMaterial({ repeat: [2, 3], roughness: 0.78 });
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

    const woodMat = makeWoodMaterial({ repeat: [1, 8], roughness: 0.82, color: 0xc8a070 });
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

    // Glass Walls (above the wood base)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallHeight, totalLength), glassMat);
    leftWall.position.set(-8, baseHeight + wallHeight / 2, zCenter);
    ghGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, wallHeight, totalLength), glassMat);
    rightWall.position.set(8, baseHeight + wallHeight / 2, zCenter);
    ghGroup.add(rightWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, wallHeight, 0.2), glassMat);
    frontWall.position.set(0, baseHeight + wallHeight / 2, -45);
    ghGroup.add(frontWall);

    // Back Wall Glass (also with a gap for the door)
    const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, wallHeight, 0.2), glassMat);
    backWallLeft.position.set(-doorWidth / 2 - backBaseLeftWidth / 2, baseHeight + wallHeight / 2, 5);
    ghGroup.add(backWallLeft);

    const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(backBaseLeftWidth, wallHeight, 0.2), glassMat);
    backWallRight.position.set(doorWidth / 2 + backBaseLeftWidth / 2, baseHeight + wallHeight / 2, 5);
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

const _potTmpMatrix = new THREE.Matrix4();
const _potNoRot = new THREE.Quaternion();
const _potRimRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const _potZeroScale = new THREE.Matrix4().makeScale(0, 0, 0);
const _potBaseScale = new THREE.Vector3(1, 1, 1);
const _potSoilScale = new THREE.Vector3(1, 0.45, 1);
const _potTmpVec1 = new THREE.Vector3();
const _potTmpVec2 = new THREE.Vector3();
const _potTmpVec3 = new THREE.Vector3();

function setEmptyPotOccupied(index, occupied) {
    if (!emptyPotInstances) return;
    emptyPotOccupied[index] = occupied;

    if (occupied) {
        // Hide via zero-scale matrix
        emptyPotInstances.bodies.setMatrixAt(index, _potZeroScale);
        emptyPotInstances.rims.setMatrixAt(index, _potZeroScale);
        emptyPotInstances.soils.setMatrixAt(index, _potZeroScale);
    } else {
        const p = tablePositions[index];
        _potTmpVec1.set(p.x, p.y + 0.1, p.z);
        _potTmpMatrix.compose(_potTmpVec1, _potNoRot, _potBaseScale);
        emptyPotInstances.bodies.setMatrixAt(index, _potTmpMatrix);
        _potTmpVec2.set(p.x, p.y + 0.205, p.z);
        _potTmpMatrix.compose(_potTmpVec2, _potRimRot, _potBaseScale);
        emptyPotInstances.rims.setMatrixAt(index, _potTmpMatrix);
        _potTmpVec3.set(p.x, p.y + 0.18, p.z);
        _potTmpMatrix.compose(_potTmpVec3, _potNoRot, _potSoilScale);
        emptyPotInstances.soils.setMatrixAt(index, _potTmpMatrix);
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
        const plantMat = new THREE.MeshStandardMaterial({
            color: 0x4caf50,
            roughness: 0.7,
            metalness: 0
        });
        const stem = new THREE.Mesh(stemGeom, plantMat);
        stem.position.y = 0.2;
        stem.castShadow = true;
        plantGroup.add(stem);

        // Pick a flower variant. New completions get an explicit random pick saved to
        // todoData.flowerVariant; legacy completions without one fall back to a
        // deterministic pick keyed off the todo id, so the chosen flower is permanent.
        const variantIdx = (typeof todoData.flowerVariant === 'number')
            ? todoData.flowerVariant
            : Math.abs(todoData.id || 0);
        const flower = buildFlowerByVariant(variantIdx);
        flower.position.y = stemHeight + 0.015;
        flower.scale.setScalar(1.55);
        stem.add(flower);

        // Slight bend
        stem.rotation.x = Math.PI / 14;
        stem.rotation.z = (Math.random() - 0.5) * 0.12;
    } else {
        // Shorter thinner stem for growing plants too.
        const stemHeight = 0.22;
        const stemGeom = new THREE.CylinderGeometry(0.011, 0.018, stemHeight, 10);
        stemGeom.translate(0, stemHeight / 2, 0);
        const plantMat = new THREE.MeshStandardMaterial({
            color: 0x4caf50,
            roughness: 0.7,
            metalness: 0
        });
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
        const leafConfigs = [
            { y: 0.07, ry: 0,              rz: -Math.PI / 3.2, scale: 0.92 },
            { y: 0.10, ry: Math.PI / 2,    rz: -Math.PI / 3.2, scale: 0.88 },
            { y: 0.14, ry: Math.PI / 4,    rz:  Math.PI / 3.2, scale: 0.95 },
            { y: 0.17, ry: Math.PI * 0.75, rz: -Math.PI / 4,   scale: 0.82 },
            { y: 0.20, ry: Math.PI * 1.2,  rz:  Math.PI / 3.5, scale: 0.78 }
        ];

        leafConfigs.forEach((cfg, i) => {
            const leaf = new THREE.Mesh(leafGeom, perPlantLeafMat);
            leaf.position.set(0, cfg.y, 0);
            leaf.rotation.set(0, cfg.ry, cfg.rz);
            leaf.scale.setScalar(cfg.scale * 0.9);
            // Shadow casting disabled — alpha-tested shadows are expensive and
            // leaves are too small to read clearly in shadow anyway.
            leaf.name = i === 0 ? "leaf1" : (i === 1 ? "leaf2" : `leaf${i + 1}`);
            stem.add(leaf);
        });
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

    sunLight.intensity = 3.0 * dayness;
    skyFill.intensity = 0.45 * dayness;                     // off entirely at night
    warmFill.intensity = 0.6 * dayness;                     // off entirely at night

    // Global IBL multiplier — collapses ambient PBR fill to near-zero at night so
    // only direct lamp cones illuminate anything.
    scene.environmentIntensity = 0.005 + 0.995 * dayness;

    // Renderer exposure also dips at night so any stray brightness stays muted.
    renderer.toneMappingExposure = 0.95 * dayness + 0.45 * nightness;

    // Atmosphere: collapse rayleigh/turbidity at night and hide the Sky mesh entirely
    // when fully night — its pre-dawn glow was leaking through the windows.
    sky.material.uniforms.rayleigh.value = 1.4 * dayness + 0.04 * nightness;
    sky.material.uniforms.turbidity.value = 6 * dayness + 0.6 * nightness;
    sky.visible = dayness > 0.05;

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

    if (controls.isLocked === true || mobileActive) {
        const delta = (time - prevTime) / 1000;

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

    // Droop stronger as health drops (max ~80° bend at zero health).
    stem.rotation.x = (1 - r) * (Math.PI / 2.2);
    // Stem shrinks vertically as it dies; leaves squash with it.
    stem.scale.set(1, 0.55 + r * 0.45, 1);
}

// Console-accessible debug helpers (UI buttons were removed from the pause overlay):
//   greenhouseDev.fastForwardDays(n)  — jump n days into the future
//   greenhouseDev.clearSave()         — wipe local save and reload
window.greenhouseDev = {
    fastForwardDays(n = 1) {
        simulatedTimeOffset += n * 86400000;
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