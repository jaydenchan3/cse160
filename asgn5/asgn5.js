import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const g_canvas = document.getElementById('webgl');

const g_renderer = new THREE.WebGLRenderer({ canvas: g_canvas, antialias: true });
g_renderer.setSize(window.innerWidth, window.innerHeight);
g_renderer.setPixelRatio(window.devicePixelRatio);

const g_scene = new THREE.Scene();

// skybox cubemap, faces in +x -x +y -y +z -z order
const g_cubeLoader = new THREE.CubeTextureLoader();
g_scene.background = g_cubeLoader.setPath('assets/skybox/').load([
  'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'
]);

const g_texLoader = new THREE.TextureLoader();

const g_camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
g_camera.position.set(0, 4, 10);
g_camera.lookAt(0, 0, 0);

const g_controls = new OrbitControls(g_camera, g_canvas);
g_controls.enableDamping = true;

// moonlight - dim bluish ambient
const g_ambient = new THREE.AmbientLight(0x6688aa, 0.3);
g_scene.add(g_ambient);

const g_dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
g_dirLight.position.set(5, 10, 5);
g_dirLight.target.position.set(0, 0, 0);
g_scene.add(g_dirLight);
g_scene.add(g_dirLight.target);

// warm campfire glow (goes where the fire lands in stage 4)
const g_pointLight = new THREE.PointLight(0xff7733, 30, 10, 2);
g_pointLight.position.set(3, 0.8, 3);
g_scene.add(g_pointLight);

// moon - just a glowing sphere up in the sky, no actual light on it
const g_moon = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.0 })
);
g_moon.position.set(15, 25, -25);
g_scene.add(g_moon);

// ground plane lying flat
const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5a32 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
g_scene.add(ground);

// cube (this one spins)
const woodTex = g_texLoader.load('assets/textures/wood.jpg');
woodTex.colorSpace = THREE.SRGBColorSpace; // keep texture from looking washed out
const g_cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff })
);
g_cube.position.set(-2, 0.5, 3);
g_scene.add(g_cube);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0xa0a0a8 })
);
sphere.position.set(-4, 1, 3);
g_scene.add(sphere);

const cylinder = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.7, 2, 24),
  new THREE.MeshStandardMaterial({ color: 0x555555 })
);
cylinder.position.set(0, 0.5, 3);
g_scene.add(cylinder);

// trees - trunk plus a blob of foliage
function makeTree(x, z) {
  const trunkH = 1.7 + Math.random() * 0.7;
  const foliageR = 1.0 + Math.random() * 0.5;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, trunkH),
    new THREE.MeshStandardMaterial({ color: 0x4a2f1a })
  );
  trunk.position.set(x, trunkH / 2, z);
  g_scene.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(foliageR),
    new THREE.MeshStandardMaterial({ color: 0x1a4020 })
  );
  foliage.position.set(x, trunkH + foliageR * 0.5, z);
  g_scene.add(foliage);
}
makeTree(-9, -4);
makeTree(-6, 6);
makeTree(8, -6);
makeTree(7, 7);

// fire ring stones in a circle around (3,0,3)
for (let i = 0; i < 6; i++) {
  const angle = i * (Math.PI * 2 / 6);
  const stone = new THREE.Mesh(
    new THREE.SphereGeometry(0.45),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  stone.position.set(3 + 1.2 * Math.cos(angle), 0.22, 3 + 1.2 * Math.sin(angle));
  g_scene.add(stone);
}

// fire logs crossed in the middle
for (let i = 0; i < 3; i++) {
  const log = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x3d2914 })
  );
  log.position.set(3, 0.2, 3);
  log.rotation.z = Math.PI / 2; // lie flat
  log.rotation.y = i * (Math.PI / 3); // fan out so they cross
  g_scene.add(log);
}

// scattered rocks - squashed spheres
const rockPositions = [
  [1, 0.3, -3], [-1, 0.3, 4], [5, 0.3, -2], [-4, 0.3, -4], [4, 0.3, 5]
];
for (const p of rockPositions) {
  const rock = new THREE.Mesh(
    new THREE.SphereGeometry(0.55),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  rock.position.set(p[0], p[1], p[2]);
  const s = 0.8 + Math.random() * 0.5; // 0.8 to 1.3 size variation
  rock.scale.set(s, s * 0.6, s); // keep them squashed
  g_scene.add(rock);
}

// log bench by the fire
const bench = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, 3),
  new THREE.MeshStandardMaterial({ color: 0x4a2f1a })
);
bench.position.set(3, 0.4, 6);
bench.rotation.z = Math.PI / 2;
g_scene.add(bench);

// fireflies - glowing spheres that drift, no real light just emissive
const g_fireflies = [];
function makeFirefly(x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffff88, emissiveIntensity: 2.0 })
  );
  g_scene.add(mesh);
  g_fireflies.push({
    mesh,
    baseX: x, baseY: y, baseZ: z,
    speed: 0.5 + Math.random() * 0.5,
    offset: Math.random() * Math.PI * 2
  });
}
makeFirefly(-2, 2, 2);
makeFirefly(0, 1.5, -4);
makeFirefly(5, 2, 1);
makeFirefly(-5, 1.8, -2);
makeFirefly(2, 2.5, 6);
makeFirefly(-7, 2, 3);

// load campsite model
let g_model = null;
const g_gltfLoader = new GLTFLoader();
g_gltfLoader.load('assets/models/tent.glb', (gltf) => {
  g_model = gltf.scene;
  g_model.position.set(-3, 0, 0);
  g_model.scale.setScalar(0.5);
  g_model.rotation.y = Math.atan2(6, 3);
  g_scene.add(g_model);
}, undefined, (err) => {
  console.error('failed to load tent.glb', err);
});

window.addEventListener('resize', () => {
  g_camera.aspect = window.innerWidth / window.innerHeight;
  g_camera.updateProjectionMatrix();
  g_renderer.setSize(window.innerWidth, window.innerHeight);
});

const g_clock = new THREE.Clock();

function render() {
  const dt = g_clock.getDelta();
  const t = g_clock.getElapsedTime();
  g_cube.rotation.y += dt * 1.0; // framerate-independent spin

  // fire flicker - sine pulse plus random crackle
  const pulse = Math.sin(t * 8) * 4;
  const jitter = (Math.random() - 0.5) * 6;
  g_pointLight.intensity = Math.max(15, 28 + pulse + jitter);

  // drift the fireflies on offset sine waves so they wander
  for (const f of g_fireflies) {
    f.mesh.position.y = f.baseY + Math.sin(t * f.speed + f.offset) * 0.5;
    f.mesh.position.x = f.baseX + Math.cos(t * f.speed * 0.7 + f.offset) * 0.8;
    f.mesh.position.z = f.baseZ + Math.sin(t * f.speed * 0.5 + f.offset * 1.3) * 0.8;
  }

  g_controls.update();
  g_renderer.render(g_scene, g_camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
