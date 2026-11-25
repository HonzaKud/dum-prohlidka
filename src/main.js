import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HouseControls } from './controls.js';
const $ = (id) => document.getElementById(id);
const container = $('scene-container');
const helpContent = $('help-panel').innerHTML;
const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth <= 760;
let renderer, controls, modelLoaded = false, animation = 0, previous = 0;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e6ece7');
scene.fog = new THREE.Fog('#e6ece7', 55, 140);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 220);
function showError(message) {
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error').textContent = message;
}
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Trojrozměrná studie domu. Ovládání je dostupné v nápovědě.');
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
} catch {
  showError('3D zobrazení se nepodařilo spustit. Zkus aktuální prohlížeč se zapnutou hardwarovou akcelerací.');
}
if (renderer) {
  scene.add(new THREE.HemisphereLight(0xf3f6f0, 0x67735d, 2.8));
  const sun = new THREE.DirectionalLight(0xffefcf, 3.4);
  sun.position.set(-18, 32, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 23, bottom: -23, near: 1, far: 90 });
  sun.shadow.normalBias = .035;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 3;
  scene.add(sun, new THREE.AmbientLight(0xffffff, .25));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), new THREE.MeshStandardMaterial({ color: '#98a789', roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.025;
  ground.receiveShadow = true;
  scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 8), new THREE.MeshStandardMaterial({ color: '#b9b4a5', roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(5.85, -.015, 8.7);
  path.receiveShadow = true;
  scene.add(path);
  function syncUI(state) {
    document.body.dataset.mode = state.mode;
    for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    $('touch-controls').hidden = !coarse || state.mode === 'orbit';
    $('fly-up').hidden = state.mode !== 'fly';
    $('fly-down').hidden = state.mode !== 'fly';
    $('enter-button').hidden = coarse || state.mode === 'orbit' || state.locked || !modelLoaded;
    $('enter-button').textContent = state.mode === 'fly' ? 'Spustit let' : 'Spustit chůzi';
    if (state.error) { $('help-panel').hidden = false; $('help-panel').textContent = state.error; }
    else { $('help-panel').innerHTML = helpContent; }
  }
  controls = new HouseControls(camera, renderer.domElement, { onStateChange: syncUI });
  controls.setMode('orbit');
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.addEventListener('click', () => {
      controls.setMode(button.dataset.mode);
      $('help-panel').hidden = true;
      renderer.domElement.focus({ preventScroll: true });
    });
  }
  $('home-button').addEventListener('click', () => controls.reset());
  $('enter-button').addEventListener('click', () => controls.enter());
  $('help-button').addEventListener('click', () => {
    $('help-panel').hidden = !$('help-panel').hidden;
    $('help-button').setAttribute('aria-expanded', String(!$('help-panel').hidden));
  });
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  new GLTFLoader().load(import.meta.env.BASE_URL + 'assets/house.glb', (gltf) => {
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !object.material.transparent;
      object.receiveShadow = true;
      if (object.material.transparent) { object.material.depthWrite = false; object.material.opacity = .70; }
    });
    scene.add(gltf.scene);
    renderer.shadowMap.needsUpdate = true;
    modelLoaded = true;
    $('loading').hidden = true;
    syncUI(controls.state);
    document.documentElement.dataset.modelReady = 'true';
  }, (event) => {
    $('loading-status').textContent = event.total ? 'Načítání domu · ' + Math.round(event.loaded / event.total * 100) + ' %' : 'Načítání domu…';
  }, () => showError('Model se nepodařilo načíst. Zkontroluj připojení a obnov stránku.'));
  function frame(time) {
    const dt = previous ? Math.min((time - previous) / 1000, .08) : 0;
    previous = time;
    controls.update(dt);
    renderer.render(scene, camera);
    animation = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animation); previous = 0;
    if (!document.hidden) animation = requestAnimationFrame(frame);
  });
  animation = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => cancelAnimationFrame(animation), { once: true });
  window.addEventListener('pageshow', (event) => { if (event.persisted) { previous = 0; animation = requestAnimationFrame(frame); } });
}
