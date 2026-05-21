// asgn4.js - CSE160 Asgn4 (Lighting, built on Asgn3 Mini Minecraft)

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_NormalMatrix;   // inverse-transpose of model matrix
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec3 v_WorldPos;
  void main() {
    vec4 worldPos = u_ModelMatrix * a_Position;
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * worldPos;
    v_UV = a_UV;
    v_WorldPos = worldPos.xyz;
    v_Normal = normalize(mat3(u_NormalMatrix) * a_Normal);
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform float u_texColorWeight;  // 0 = solid color, 1 = pure texture
  uniform bool u_NormalViz;        // when true, paint normals as RGB
  uniform bool u_LightOn;          // global lighting toggle
  uniform bool u_UseLighting;      // does this object participate in lighting?
  uniform vec3 u_LightPos;         // point light position (world space)
  uniform vec3 u_LightColor;       // RGB color/intensity of the point light
  uniform vec3 u_CameraPos;        // eye position (world space), for specular
  uniform bool u_SpotOn;           // spot light toggle (independent of point light)
  uniform vec3 u_SpotPos;          // spot light position (world space)
  uniform vec3 u_SpotDir;          // spot light aim direction
  uniform vec3 u_SpotColor;        // spot light RGB
  uniform float u_SpotCutoffInner; // cos(angle): full intensity inside this
  uniform float u_SpotCutoffOuter; // cos(angle): zero intensity outside this
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec3 v_WorldPos;
  void main() {
    if (u_NormalViz) {
      gl_FragColor = vec4(normalize(v_Normal), 1.0);
      return;
    }

    vec4 texColor = texture2D(u_Sampler0, v_UV);
    vec3 baseColor = mix(u_FragColor, texColor, u_texColorWeight).rgb;

    if (u_UseLighting) {
      vec3 N = normalize(v_Normal);
      vec3 V = normalize(u_CameraPos - v_WorldPos);

      // ambient stays full-color (not tinted by a light) so base color always shows
      vec3 ambient = baseColor * 0.2;

      // --- point light (gated by u_LightOn) ---
      vec3 pointContribution = vec3(0.0);
      if (u_LightOn) {
        vec3 L = normalize(u_LightPos - v_WorldPos);
        vec3 R = reflect(-L, N);
        float diff = max(dot(N, L), 0.0);
        float spec = pow(max(dot(R, V), 0.0), 32.0);
        if (diff <= 0.0) spec = 0.0;
        vec3 diffuse = baseColor * diff * u_LightColor;
        vec3 specular = vec3(1.0) * spec * u_LightColor;  // crisp white highlight, tinted by light
        pointContribution = diffuse + specular;
      }

      // --- spot light (gated by u_SpotOn, with soft cone falloff) ---
      vec3 spotContribution = vec3(0.0);
      if (u_SpotOn) {
        vec3 toFrag = normalize(v_WorldPos - u_SpotPos);
        vec3 spotDirN = normalize(u_SpotDir);
        float theta = dot(toFrag, spotDirN);
        float intensity = smoothstep(u_SpotCutoffOuter, u_SpotCutoffInner, theta);
        if (intensity > 0.0) {
          vec3 L_spot = normalize(u_SpotPos - v_WorldPos);
          float diff_spot = max(dot(N, L_spot), 0.0);
          float spec_spot = 0.0;
          if (diff_spot > 0.0) {
            vec3 R_spot = reflect(-L_spot, N);
            spec_spot = pow(max(dot(R_spot, V), 0.0), 32.0);
          }
          vec3 diffuse_spot = baseColor * diff_spot * u_SpotColor;
          vec3 specular_spot = vec3(1.0) * spec_spot * u_SpotColor;
          spotContribution = (diffuse_spot + specular_spot) * intensity;
        }
      }

      vec3 finalColor = ambient + pointContribution + spotContribution;
      gl_FragColor = vec4(finalColor, 1.0);
    } else {
      gl_FragColor = vec4(baseColor, 1.0);
    }
  }
`;

let gl;
let canvas;

let a_Position;
let a_UV;
let a_Normal;
let u_FragColor;
let u_ModelMatrix;
let u_NormalMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_Sampler0;
let u_texColorWeight;
let u_NormalViz;
let u_LightOn;
let u_UseLighting;
let u_LightPos;
let u_LightColor;
let u_CameraPos;
let u_SpotOn;
let u_SpotPos;
let u_SpotDir;
let u_SpotColor;
let u_SpotCutoffInner;
let u_SpotCutoffOuter;

let g_cubeBuffer;
let g_cubeVertexCount;

let g_sphereBuffer;
let g_sphereVertexCount;

let g_grassTexture;
let g_dirtTexture;
let g_stoneTexture;
let g_woodTexture;
let g_goldTexture;

// debug: paint surface normals as RGB instead of color/texture
let g_normalViz = false;

// point light
let g_lightPos = null;  // Vector3, set in initMatrices, driven by the orbit each frame
let g_lightOn = true;
let g_lightColor = [1.0, 1.0, 1.0];  // RGB, driven by the sliders (default white)
const g_lightMarkerColor = [1.0, 0.85, 0.2, 1.0];  // tracks light color (set on slider input)

// point light orbit: auto-circles the tower; the angle slider can take over
let g_lightAngle = 0;             // current angle, radians
let g_lightOrbitAuto = true;      // auto-orbit running vs. manual slider control
let g_lightLastSliderTime = 0;    // g_seconds at the last slider input
let g_lightSliderActive = false;  // user is mid-drag on the angle slider
let g_orbitTimeOffset = 0;        // phase rebase so auto-orbit resumes without a jump
const LIGHT_ORBIT_RADIUS = 5.0;
const LIGHT_ORBIT_CENTER = [15.5, 8.0, 23.0];
const LIGHT_ORBIT_SPEED = 2 * Math.PI / 10.0;  // rad/sec (one revolution every 10s)
const SLIDER_PAUSE_DURATION = 3.0;             // seconds idle before auto-orbit resumes

// spot light: "moonlight" shining straight down from high above the world center
const SPOT_POS = [15.5, 30.0, 23.0];
const SPOT_DIR = [0.0, -1.0, 0.0];
const SPOT_CUTOFF_INNER = 0.85;   // cos(~31.8 deg): full intensity inside this
const SPOT_CUTOFF_OUTER = 0.75;   // cos(~41.4 deg): fades to zero by here
let g_spotOn = true;
let g_spotColor = [0.5, 0.7, 1.0];               // cool blue
const g_spotMarkerColor = [0.5, 0.7, 1.0, 1.0];  // marker mirrors the spot color

// where the demo sphere sits (above the central tower)
const SPHERE_POS = [15.5, 6.5, 23.0];
const SPHERE_RADIUS = 1.2;

// OBJ model loaded from teapot.obj (see Model.js)
let g_teapot = null;

// block types
const T_DIRT = 'dirt';
const T_STONE = 'stone';
const T_WOOD = 'wood';
const T_GOLD = 'gold';
const BLOCK_TYPES = [T_DIRT, T_STONE, T_WOOD, T_GOLD];

const MAX_BLOCK_HEIGHT = 4;
const TARGET_DISTANCE = 2;  // how far in front of the eye the place/remove cursor sits
let g_currentBlockType = T_STONE;

// 5 gold blocks scattered through the world. walk near one to pick it up.
const GOLD_POSITIONS = [
  [7, 7],     // inside the SW wooden cabin
  [24, 24],   // inside the NE dirt room
  [14, 20],   // just south of the central tower
  [20, 8],    // tucked inside the L-shaped wall
  [5, 15],    // open NW area
];
const GOLD_COLLECT_RADIUS = 1.5;
let g_goldCollected = 0;
let g_goldTotal = GOLD_POSITIONS.length;

// day/night cycle: lerp through 4 sky colors over 60 seconds
const DAY_LENGTH_SECONDS = 60;
const SKY_KEYS = [
  { t: 0.00, c: [0.95, 0.65, 0.60], label: 'dawn' },
  { t: 0.25, c: [0.60, 0.80, 0.95], label: 'day' },
  { t: 0.50, c: [0.95, 0.50, 0.30], label: 'sunset' },
  { t: 0.75, c: [0.10, 0.10, 0.25], label: 'night' },
];
let g_skyColor = [0.6, 0.8, 0.95, 1.0];  // overwritten every frame
let g_currentSkyLabel = 'day';

let g_startTime = 0;
let g_seconds = 0;

let g_camera = null;

const MOVE_SPEED = 0.2;
const PAN_DEGREES = 5;
const MOUSE_SENS = 0.4;  // degrees per pixel of drag
const PITCH_LIMIT = 85;  // +/- degrees from horizontal

let g_isDragging = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;
let g_pitch = 0;  // cumulative pitch, kept in [-PITCH_LIMIT, +PITCH_LIMIT]

// [x][z] = {height, type}
const MAP_SIZE = 32;
let g_map = null;

const g_worldBuffers = { [T_DIRT]: null, [T_STONE]: null, [T_WOOD]: null, [T_GOLD]: null };
const g_worldVertexCounts = { [T_DIRT]: 0, [T_STONE]: 0, [T_WOOD]: 0, [T_GOLD]: 0 };

// reused, don't realloc each frame
let g_modelMatrix = null;
let g_normalMatrix = null;

const FPS_WINDOW = 20;
const FPS_DOM_HZ = 5;
let g_lastFrameTime = 0;
let g_frameDeltas = [];
let g_frameDeltaSum = 0;
let g_lastFpsUpdateTime = 0;
let g_fpsEl = null;
let g_statusEl = null;

// every vertex is [x, y, z, u, v, nx, ny, nz] = 8 floats
const FLOATS_PER_VERT = 8;

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  initCubeBuffer();
  initSphereBuffer();
  initMatrices();
  setupInput();

  // OBJ model: loads async (fetch), renders once isLoaded flips true
  g_teapot = new Model(gl, 'teapot.obj');
  g_teapot.color = [0.85, 0.55, 0.25, 1.0];      // copper/orange
  g_teapot.matrix.setTranslate(12.0, 1.6, 17.0);  // open ground, left-front of spawn
  g_teapot.matrix.rotate(90, 1, 0, 0);            // stand it up so it faces the camera
  g_teapot.matrix.scale(0.9, 0.9, 0.9);

  gl.clearColor(0.6, 0.8, 0.95, 1.0);  // sky blue fallback (sky cube usually covers it)
  gl.enable(gl.DEPTH_TEST);
  gl.uniform1i(u_NormalViz, 0);
  gl.uniform1i(u_LightOn, g_lightOn ? 1 : 0);
  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);

  g_fpsEl = document.getElementById('fps');
  g_statusEl = document.getElementById('status');

  loadAllTextures(() => {
    g_map = buildMap();
    buildWorldGeometry();
    g_camera.setSpawn(16, 1.5, 16, 16, 1.5, 17);  // spawn at center, looking at the tower
    g_startTime = performance.now() / 1000;
    refreshStatus();
    requestAnimationFrame(tick);
  });
}

function loadAllTextures(done) {
  loadTexture('textures/grass.png', t1 => {
    g_grassTexture = t1;
    loadTexture('textures/dirt.png', t2 => {
      g_dirtTexture = t2;
      loadTexture('textures/stone.png', t3 => {
        g_stoneTexture = t3;
        loadTexture('textures/wood.png', t4 => {
          g_woodTexture = t4;
          loadTexture('textures/gold.png', t5 => {
            g_goldTexture = t5;
            done();
          });
        });
      });
    });
  });
}

function textureFor(type) {
  switch (type) {
    case T_DIRT: return g_dirtTexture;
    case T_STONE: return g_stoneTexture;
    case T_WOOD: return g_woodTexture;
    case T_GOLD: return g_goldTexture;
  }
  return g_dirtTexture;
}

function toggleNormalViz() {
  g_normalViz = !g_normalViz;
  gl.uniform1i(u_NormalViz, g_normalViz ? 1 : 0);
  const btn = document.getElementById('normalVizBtn');
  if (btn) btn.textContent = 'Normal Viz: ' + (g_normalViz ? 'ON' : 'OFF');
  refreshStatus();
}

function toggleLighting() {
  g_lightOn = !g_lightOn;
  gl.uniform1i(u_LightOn, g_lightOn ? 1 : 0);
  const btn = document.getElementById('lightingBtn');
  if (btn) btn.textContent = 'Lighting: ' + (g_lightOn ? 'ON' : 'OFF');
  refreshStatus();
}

function toggleSpot() {
  g_spotOn = !g_spotOn;
  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);
  const btn = document.getElementById('spotToggle');
  if (btn) btn.textContent = 'Spot Light: ' + (g_spotOn ? 'ON' : 'OFF');
  refreshStatus();
}

// read the R/G/B sliders (0..100) into g_lightColor (0..1); marker tracks the color
function updateLightColor() {
  const r = document.getElementById('lightR');
  const g = document.getElementById('lightG');
  const b = document.getElementById('lightB');
  if (!r || !g || !b) return;
  g_lightColor[0] = parseInt(r.value, 10) / 100;
  g_lightColor[1] = parseInt(g.value, 10) / 100;
  g_lightColor[2] = parseInt(b.value, 10) / 100;
  g_lightMarkerColor[0] = g_lightColor[0];
  g_lightMarkerColor[1] = g_lightColor[1];
  g_lightMarkerColor[2] = g_lightColor[2];
}

// angle slider: take manual control of the orbit angle
function onLightAngleInput() {
  const el = document.getElementById('lightAngle');
  if (!el) return;
  g_lightAngle = parseFloat(el.value) * Math.PI / 180;
  g_lightOrbitAuto = false;
  g_lightSliderActive = true;
  g_lightLastSliderTime = g_seconds;
}

// release: stop treating the slider as actively dragged
function onLightAngleChange() {
  g_lightSliderActive = false;
}

// advance the orbiting light and write its world position into g_lightPos
function updateLight() {
  // after a quiet period, resume auto-orbit; rebase the phase so the angle is
  // continuous (picks up from wherever the slider left it, no snap)
  if (!g_lightOrbitAuto && (g_seconds - g_lightLastSliderTime > SLIDER_PAUSE_DURATION)) {
    g_lightOrbitAuto = true;
    g_orbitTimeOffset = g_seconds - g_lightAngle / LIGHT_ORBIT_SPEED;
  }

  if (g_lightOrbitAuto) {
    g_lightAngle = ((g_seconds - g_orbitTimeOffset) * LIGHT_ORBIT_SPEED) % (2 * Math.PI);
    if (g_lightAngle < 0) g_lightAngle += 2 * Math.PI;
    // keep the slider visually in sync while auto-orbiting (not mid-drag)
    const sliderEl = document.getElementById('lightAngle');
    if (sliderEl && !g_lightSliderActive) {
      sliderEl.value = (g_lightAngle * 180 / Math.PI) | 0;
    }
  }

  const e = g_lightPos.elements;
  e[0] = LIGHT_ORBIT_CENTER[0] + Math.cos(g_lightAngle) * LIGHT_ORBIT_RADIUS;
  e[1] = LIGHT_ORBIT_CENTER[1];
  e[2] = LIGHT_ORBIT_CENTER[2] + Math.sin(g_lightAngle) * LIGHT_ORBIT_RADIUS;
}

function setupInput() {
  document.onkeydown = (ev) => {
    const k = ev.key.toLowerCase();
    switch (k) {
      case 'w': g_camera.moveForward(MOVE_SPEED); break;
      case 's': g_camera.moveBackwards(MOVE_SPEED); break;
      case 'a': g_camera.moveLeft(MOVE_SPEED); break;
      case 'd': g_camera.moveRight(MOVE_SPEED); break;
      case 'q': g_camera.panLeft(PAN_DEGREES); break;
      case 'e': g_camera.panRight(PAN_DEGREES); break;
      case 'f': placeBlock(); break;
      case 'g': removeBlock(); break;
      case '1': g_currentBlockType = T_DIRT; refreshStatus(); break;
      case '2': g_currentBlockType = T_STONE; refreshStatus(); break;
      case '3': g_currentBlockType = T_WOOD; refreshStatus(); break;
      default: return;
    }
  };

  // click-drag to look around
  canvas.onmousedown = (ev) => {
    ev.preventDefault();
    g_isDragging = true;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
  };
  canvas.onmouseup = () => { g_isDragging = false; };
  canvas.onmouseleave = () => { g_isDragging = false; };

  canvas.onmousemove = (ev) => {
    if (!g_isDragging) return;
    const dx = ev.clientX - g_lastMouseX;
    const dy = ev.clientY - g_lastMouseY;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;

    if (dx !== 0) g_camera.panRight(dx * MOUSE_SENS);

    // pitch with clamp so we don't flip
    if (dy !== 0) {
      const desired = -dy * MOUSE_SENS;
      const clamped = Math.max(-PITCH_LIMIT - g_pitch,
                      Math.min(PITCH_LIMIT - g_pitch, desired));
      if (clamped !== 0) {
        g_camera.panUp(clamped);
        g_pitch += clamped;
      }
    }
  };
}

function setStatus(msg) {
  if (g_statusEl) g_statusEl.textContent = msg;
}

function refreshStatus() {
  const won = g_goldCollected >= g_goldTotal;
  const head = won
    ? '🎉 YOU COLLECTED ALL ' + g_goldTotal + ' GOLD BLOCKS! 🎉'
    : 'Gold: ' + g_goldCollected + ' / ' + g_goldTotal;

  setStatus(
    head +
    ' | ' + g_currentSkyLabel +
    ' | point: ' + (g_lightOn ? 'on' : 'off') +
    ' | spot: ' + (g_spotOn ? 'on' : 'off') +
    ' | normalViz: ' + (g_normalViz ? 'on' : 'off') +
    ' | F=place G=remove [1/2/3 type] current: ' + g_currentBlockType
  );
}

function targetCell() {
  const e = g_camera.eye.elements, a = g_camera.at.elements;
  let fx = a[0] - e[0];
  let fz = a[2] - e[2];
  const len = Math.hypot(fx, fz);
  if (len === 0) return null;  // looking straight up or straight down
  fx = fx / len * TARGET_DISTANCE;
  fz = fz / len * TARGET_DISTANCE;
  const tx = Math.floor(e[0] + fx);
  const tz = Math.floor(e[2] + fz);
  if (tx < 0 || tx >= MAP_SIZE || tz < 0 || tz >= MAP_SIZE) return null;
  return { x: tx, z: tz };
}

function placeBlock() {
  const c = targetCell();
  if (!c) return;
  const cell = g_map[c.x][c.z];
  if (cell.height >= MAX_BLOCK_HEIGHT) return;
  cell.height++;
  cell.type = g_currentBlockType;
  buildWorldGeometry();
  refreshStatus();
}

function removeBlock() {
  const c = targetCell();
  if (!c) return;
  const cell = g_map[c.x][c.z];
  if (cell.height === 0) return;
  cell.height--;
  buildWorldGeometry();
  refreshStatus();
}

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { console.log('Failed to get WebGL context'); return; }
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to init shaders');
    return;
  }
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_texColorWeight = gl.getUniformLocation(gl.program, 'u_texColorWeight');
  u_NormalViz = gl.getUniformLocation(gl.program, 'u_NormalViz');
  u_LightOn = gl.getUniformLocation(gl.program, 'u_LightOn');
  u_UseLighting = gl.getUniformLocation(gl.program, 'u_UseLighting');
  u_LightPos = gl.getUniformLocation(gl.program, 'u_LightPos');
  u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  u_CameraPos = gl.getUniformLocation(gl.program, 'u_CameraPos');
  u_SpotOn = gl.getUniformLocation(gl.program, 'u_SpotOn');
  u_SpotPos = gl.getUniformLocation(gl.program, 'u_SpotPos');
  u_SpotDir = gl.getUniformLocation(gl.program, 'u_SpotDir');
  u_SpotColor = gl.getUniformLocation(gl.program, 'u_SpotColor');
  u_SpotCutoffInner = gl.getUniformLocation(gl.program, 'u_SpotCutoffInner');
  u_SpotCutoffOuter = gl.getUniformLocation(gl.program, 'u_SpotCutoffOuter');
}

function initMatrices() {
  g_modelMatrix = new Matrix4();
  g_normalMatrix = new Matrix4();
  g_lightPos = new Vector3([15.5, 8.0, 23.0]);
  g_camera = new Camera(canvas);
}

// Unit cube from (0,0,0) to (1,1,1). 36 verts, interleaved [x,y,z, u,v, nx,ny,nz].
function initCubeBuffer() {
  const v = [
    // +Z front, n=(0,0,1)
    0,0,1, 0,0, 0,0,1,  1,0,1, 1,0, 0,0,1,  1,1,1, 1,1, 0,0,1,
    0,0,1, 0,0, 0,0,1,  1,1,1, 1,1, 0,0,1,  0,1,1, 0,1, 0,0,1,
    // -Z back, n=(0,0,-1)
    1,0,0, 0,0, 0,0,-1,  0,1,0, 1,1, 0,0,-1,  0,0,0, 1,0, 0,0,-1,
    1,0,0, 0,0, 0,0,-1,  1,1,0, 0,1, 0,0,-1,  0,1,0, 1,1, 0,0,-1,
    // +Y top, n=(0,1,0)
    0,1,0, 0,0, 0,1,0,  0,1,1, 0,1, 0,1,0,  1,1,1, 1,1, 0,1,0,
    0,1,0, 0,0, 0,1,0,  1,1,1, 1,1, 0,1,0,  1,1,0, 1,0, 0,1,0,
    // -Y bottom, n=(0,-1,0)
    0,0,0, 0,0, 0,-1,0,  1,0,0, 1,0, 0,-1,0,  1,0,1, 1,1, 0,-1,0,
    0,0,0, 0,0, 0,-1,0,  1,0,1, 1,1, 0,-1,0,  0,0,1, 0,1, 0,-1,0,
    // +X right, n=(1,0,0)
    1,0,0, 0,0, 1,0,0,  1,1,0, 0,1, 1,0,0,  1,1,1, 1,1, 1,0,0,
    1,0,0, 0,0, 1,0,0,  1,1,1, 1,1, 1,0,0,  1,0,1, 1,0, 1,0,0,
    // -X left, n=(-1,0,0)
    0,0,0, 0,0, -1,0,0,  0,0,1, 1,0, -1,0,0,  0,1,1, 1,1, -1,0,0,
    0,0,0, 0,0, -1,0,0,  0,1,1, 1,1, -1,0,0,  0,1,0, 0,1, -1,0,0,
  ];

  const vertices = new Float32Array(v);
  g_cubeVertexCount = vertices.length / FLOATS_PER_VERT;

  g_cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

// UV sphere centered at origin, radius 1. Built once.
// For a unit sphere the surface normal equals the (normalized) position.
function initSphereBuffer() {
  const LAT = 24;  // stacks
  const LON = 24;  // slices
  const verts = [];

  const point = (theta, phi) => {
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.cos(theta);
    const z = Math.sin(theta) * Math.sin(phi);
    const u = phi / (2 * Math.PI);
    const w = theta / Math.PI;
    // position, uv, normal (== position for a unit sphere)
    return [x, y, z, u, w, x, y, z];
  };
  const push = (p) => { for (let i = 0; i < FLOATS_PER_VERT; i++) verts.push(p[i]); };

  for (let i = 0; i < LAT; i++) {
    const theta1 = i * Math.PI / LAT;
    const theta2 = (i + 1) * Math.PI / LAT;
    for (let j = 0; j < LON; j++) {
      const phi1 = j * 2 * Math.PI / LON;
      const phi2 = (j + 1) * 2 * Math.PI / LON;

      const a = point(theta1, phi1);
      const b = point(theta2, phi1);
      const c = point(theta2, phi2);
      const d = point(theta1, phi2);

      // two triangles per grid quad
      push(a); push(b); push(c);
      push(a); push(c); push(d);
    }
  }

  const vertices = new Float32Array(verts);
  g_sphereVertexCount = vertices.length / FLOATS_PER_VERT;

  g_sphereBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

// per-face vertex layout in cube-local coords: 6 verts x [dx, dy, dz, u, v, nx, ny, nz].
// position is added to a (x,y,z) world offset by pushFace(); the rest is copied as-is.
const FACE_PX = [  // +X (right), n=(1,0,0)
  1,0,0, 0,0, 1,0,0,  1,1,0, 0,1, 1,0,0,  1,1,1, 1,1, 1,0,0,
  1,0,0, 0,0, 1,0,0,  1,1,1, 1,1, 1,0,0,  1,0,1, 1,0, 1,0,0,
];
const FACE_NX = [  // -X (left), n=(-1,0,0)
  0,0,0, 0,0, -1,0,0,  0,0,1, 1,0, -1,0,0,  0,1,1, 1,1, -1,0,0,
  0,0,0, 0,0, -1,0,0,  0,1,1, 1,1, -1,0,0,  0,1,0, 0,1, -1,0,0,
];
const FACE_PY = [  // +Y (top), n=(0,1,0)
  0,1,0, 0,0, 0,1,0,  0,1,1, 0,1, 0,1,0,  1,1,1, 1,1, 0,1,0,
  0,1,0, 0,0, 0,1,0,  1,1,1, 1,1, 0,1,0,  1,1,0, 1,0, 0,1,0,
];
const FACE_PZ = [  // +Z (front), n=(0,0,1)
  0,0,1, 0,0, 0,0,1,  1,0,1, 1,0, 0,0,1,  1,1,1, 1,1, 0,0,1,
  0,0,1, 0,0, 0,0,1,  1,1,1, 1,1, 0,0,1,  0,1,1, 0,1, 0,0,1,
];
const FACE_NZ = [  // -Z (back), n=(0,0,-1)
  1,0,0, 0,0, 0,0,-1,  0,1,0, 1,1, 0,0,-1,  0,0,0, 1,0, 0,0,-1,
  1,0,0, 0,0, 0,0,-1,  1,1,0, 0,1, 0,0,-1,  0,1,0, 1,1, 0,0,-1,
];

function pushFace(verts, base, x, y, z) {
  for (let i = 0; i < base.length; i += FLOATS_PER_VERT) {
    verts.push(
      base[i] + x,
      base[i+1] + y,
      base[i+2] + z,
      base[i+3], base[i+4],          // u, v
      base[i+5], base[i+6], base[i+7] // nx, ny, nz
    );
  }
}

function hasBlockAt(x, y, z) {
  if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return false;
  if (y < 0) return false;
  return y < g_map[x][z].height;
}

// hardcoded 32x32 map. spawn at (16,16) is forced open.
function buildMap() {
  const m = new Array(MAP_SIZE);
  for (let x = 0; x < MAP_SIZE; x++) {
    m[x] = new Array(MAP_SIZE);
    for (let z = 0; z < MAP_SIZE; z++) m[x][z] = { height: 0, type: T_DIRT };
  }

  const set = (x, z, h, t) => { m[x][z].height = h; m[x][z].type = t; };

  // perimeter wall (stone, height 4)
  for (let i = 0; i < MAP_SIZE; i++) {
    set(0, i, 4, T_STONE);
    set(MAP_SIZE - 1, i, 4, T_STONE);
    set(i, 0, 4, T_STONE);
    set(i, MAP_SIZE - 1, 4, T_STONE);
  }

  const room = (x0, x1, z0, z1, h, t) => {
    for (let x = x0; x <= x1; x++) { set(x, z0, h, t); set(x, z1, h, t); }
    for (let z = z0; z <= z1; z++) { set(x0, z, h, t); set(x1, z, h, t); }
  };
  // SW: wooden cabin walls
  room(4, 10, 4, 10, 3, T_WOOD);
  set(7, 10, 0, T_DIRT);  // south doorway

  // NE: dirt-walled enclosure
  room(20, 27, 20, 27, 2, T_DIRT);
  set(23, 20, 0, T_DIRT); // north doorway

  // central 3x3 stone tower
  for (let x = 14; x <= 16; x++) {
    for (let z = 22; z <= 24; z++) {
      set(x, z, 4, T_STONE);
    }
  }
  set(16, 16, 0, T_DIRT);  // make sure spawn is clear

  // L-shaped stone wall in the NE quadrant
  for (let x = 18; x <= 25; x++) set(x, 5, 2, T_STONE);
  for (let z = 5; z <= 9; z++) set(25, z, 2, T_STONE);

  // scattered "rocks" of mixed types
  const bumps = [
    [12, 6, 1, T_DIRT],
    [8, 24, 2, T_WOOD],
    [5, 25, 1, T_STONE],
    [18, 14, 2, T_WOOD],
    [24, 5, 1, T_DIRT],
    [6, 18, 2, T_STONE],
    [26, 16, 1, T_WOOD],
    [15, 20, 1, T_DIRT],
  ];
  for (const [x, z, h, t] of bumps) set(x, z, h, t);

  // gold blocks last, so nothing else overrides them
  for (const [x, z] of GOLD_POSITIONS) set(x, z, 1, T_GOLD);

  return m;
}

function buildWorldGeometry() {
  // one vertex array per block type. each face goes into the array matching its type.
  const verts = { [T_DIRT]: [], [T_STONE]: [], [T_WOOD]: [], [T_GOLD]: [] };

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      const cell = g_map[x][z];
      const h = cell.height;
      if (h === 0) continue;
      const target = verts[cell.type];
      for (let y = 0; y < h; y++) {
        if (y === h - 1) pushFace(target, FACE_PY, x, y, z);
        if (!hasBlockAt(x + 1, y, z)) pushFace(target, FACE_PX, x, y, z);
        if (!hasBlockAt(x - 1, y, z)) pushFace(target, FACE_NX, x, y, z);
        if (!hasBlockAt(x, y, z + 1)) pushFace(target, FACE_PZ, x, y, z);
        if (!hasBlockAt(x, y, z - 1)) pushFace(target, FACE_NZ, x, y, z);
      }
    }
  }

  for (const t of BLOCK_TYPES) uploadWorldBuffer(t, verts[t]);
}

function uploadWorldBuffer(type, vertList) {
  const arr = new Float32Array(vertList);
  g_worldVertexCounts[type] = arr.length / FLOATS_PER_VERT;
  if (g_worldBuffers[type] === null) g_worldBuffers[type] = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_worldBuffers[type]);
  // DYNAMIC_DRAW since these get rebuilt whenever blocks change
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
}

// bind position(3)/uv(2)/normal(3) for any buffer in our interleaved layout
function bindAttribs(buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const FSIZE = Float32Array.BYTES_PER_ELEMENT;
  const stride = FLOATS_PER_VERT * FSIZE;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, stride, 3 * FSIZE);
  gl.enableVertexAttribArray(a_UV);
  if (a_Normal >= 0) {
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, stride, 5 * FSIZE);
    gl.enableVertexAttribArray(a_Normal);
  }
}

// sets u_ModelMatrix and the matching u_NormalMatrix (inverse-transpose of M)
function setModelMatrix(M) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  g_normalMatrix.setInverseOf(M);
  g_normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);
}

function drawWorld() {
  g_modelMatrix.setIdentity();
  setModelMatrix(g_modelMatrix);  // world VBO is pre-transformed -> identity
  gl.uniform4f(u_FragColor, 1, 1, 1, 1);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform1i(u_UseLighting, 1);

  for (const t of BLOCK_TYPES) drawWorldChunk(t, textureFor(t));
}

function drawWorldChunk(type, texture) {
  const count = g_worldVertexCounts[type];
  if (count === 0) return;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u_Sampler0, 0);

  bindAttribs(g_worldBuffers[type]);
  gl.drawArrays(gl.TRIANGLES, 0, count);
}

function loadTexture(url, onReady) {
  const img = new Image();
  img.onload = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    onReady(tex);
  };
  img.onerror = () => {
    console.log('Failed to load texture: ' + url);
    setStatus('Status: ERROR loading ' + url + ' (serve via a local web server, not file://)');
  };
  img.src = url;
}

// lit textured cube (used for the ground slab)
function drawTexturedCube(M, texture) {
  setModelMatrix(M);
  gl.uniform4f(u_FragColor, 1, 1, 1, 1);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform1i(u_UseLighting, 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u_Sampler0, 0);

  bindAttribs(g_cubeBuffer);
  gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
}

// unlit solid cube (used for the sky cube and the light marker)
function drawSolidCube(M, color) {
  setModelMatrix(M);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform1i(u_UseLighting, 0);

  bindAttribs(g_cubeBuffer);
  gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
}

// lit solid-color sphere
function drawSphere(M, color) {
  setModelMatrix(M);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform1i(u_UseLighting, 1);

  bindAttribs(g_sphereBuffer);
  gl.drawArrays(gl.TRIANGLES, 0, g_sphereVertexCount);
}

function tick() {
  const now = performance.now();

  if (g_lastFrameTime !== 0) {
    const delta = now - g_lastFrameTime;
    g_frameDeltas.push(delta);
    g_frameDeltaSum += delta;
    if (g_frameDeltas.length > FPS_WINDOW) {
      g_frameDeltaSum -= g_frameDeltas.shift();
    }
    if (now - g_lastFpsUpdateTime >= 1000 / FPS_DOM_HZ) {
      const avgDelta = g_frameDeltaSum / g_frameDeltas.length;
      const fps = 1000 / avgDelta;
      if (g_fpsEl) g_fpsEl.textContent = 'FPS: ' + fps.toFixed(0);
      g_lastFpsUpdateTime = now;
    }
  }
  g_lastFrameTime = now;

  g_seconds = now / 1000 - g_startTime;
  updateSkyColor();
  updateLight();
  checkGoldCollection();

  renderScene();
  requestAnimationFrame(tick);
}

// Lerp sky color between SKY_KEYS over a DAY_LENGTH_SECONDS loop.
function updateSkyColor() {
  const t = (g_seconds % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;

  const n = SKY_KEYS.length;
  let i = 0;
  while (i < n - 1 && t >= SKY_KEYS[i + 1].t) i++;

  const a = SKY_KEYS[i];
  const b = SKY_KEYS[(i + 1) % n];
  const aT = a.t;
  const bT = (i === n - 1) ? 1.0 : b.t;
  const lt = (t - aT) / (bT - aT);

  g_skyColor[0] = a.c[0] + (b.c[0] - a.c[0]) * lt;
  g_skyColor[1] = a.c[1] + (b.c[1] - a.c[1]) * lt;
  g_skyColor[2] = a.c[2] + (b.c[2] - a.c[2]) * lt;
  g_skyColor[3] = 1.0;

  gl.clearColor(g_skyColor[0], g_skyColor[1], g_skyColor[2], 1.0);

  if (a.label !== g_currentSkyLabel) {
    g_currentSkyLabel = a.label;
    refreshStatus();
  }
}

function checkGoldCollection() {
  if (g_goldCollected >= g_goldTotal) return;
  const e = g_camera.eye.elements;
  const r2 = GOLD_COLLECT_RADIUS * GOLD_COLLECT_RADIUS;
  let collected = false;

  for (const [x, z] of GOLD_POSITIONS) {
    const cell = g_map[x][z];
    if (cell.height === 0 || cell.type !== T_GOLD) continue;  // already taken
    const cx = x + 0.5, cy = 0.5, cz = z + 0.5;
    const dx = e[0] - cx, dy = e[1] - cy, dz = e[2] - cz;
    if (dx*dx + dy*dy + dz*dz < r2) {
      cell.height = 0;
      cell.type = T_DIRT;
      g_goldCollected++;
      collected = true;
    }
  }

  if (collected) {
    buildWorldGeometry();
    refreshStatus();
  }
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

  // point light + camera position (world space) for the lit objects this frame
  const lp = g_lightPos.elements;
  gl.uniform3f(u_LightPos, lp[0], lp[1], lp[2]);
  gl.uniform3f(u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
  const eye = g_camera.eye.elements;
  gl.uniform3f(u_CameraPos, eye[0], eye[1], eye[2]);

  // spot light
  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);
  gl.uniform3f(u_SpotPos, SPOT_POS[0], SPOT_POS[1], SPOT_POS[2]);
  gl.uniform3f(u_SpotDir, SPOT_DIR[0], SPOT_DIR[1], SPOT_DIR[2]);
  gl.uniform3f(u_SpotColor, g_spotColor[0], g_spotColor[1], g_spotColor[2]);
  gl.uniform1f(u_SpotCutoffInner, SPOT_CUTOFF_INNER);
  gl.uniform1f(u_SpotCutoffOuter, SPOT_CUTOFF_OUTER);

  // sky cube. camera lives inside it. color updated by updateSkyColor each frame
  g_modelMatrix.setTranslate(-50, -50, -50);
  g_modelMatrix.scale(100, 100, 100);
  drawSolidCube(g_modelMatrix, g_skyColor);

  // ground: 32x32 grass slab, top at y=0
  g_modelMatrix.setTranslate(0, -0.1, 0);
  g_modelMatrix.scale(MAP_SIZE, 0.1, MAP_SIZE);
  drawTexturedCube(g_modelMatrix, g_grassTexture);

  // 32x32 voxel world (one drawArrays per block type)
  drawWorld();

  // demo sphere above the central tower
  g_modelMatrix.setTranslate(SPHERE_POS[0], SPHERE_POS[1], SPHERE_POS[2]);
  g_modelMatrix.scale(SPHERE_RADIUS, SPHERE_RADIUS, SPHERE_RADIUS);
  drawSphere(g_modelMatrix, [0.85, 0.85, 0.9, 1.0]);

  // OBJ teapot (lit by the same Phong pipeline; no-op until it finishes loading)
  if (g_teapot) g_teapot.render(gl);

  // point light marker: small unlit cube centered on the light, always full bright
  const MS = 0.3;
  g_modelMatrix.setTranslate(lp[0] - MS / 2, lp[1] - MS / 2, lp[2] - MS / 2);
  g_modelMatrix.scale(MS, MS, MS);
  drawSolidCube(g_modelMatrix, g_lightMarkerColor);

  // spot light marker: bigger blue cube high above the world center
  const SS = 0.5;
  g_modelMatrix.setTranslate(SPOT_POS[0] - SS / 2, SPOT_POS[1] - SS / 2, SPOT_POS[2] - SS / 2);
  g_modelMatrix.scale(SS, SS, SS);
  drawSolidCube(g_modelMatrix, g_spotMarkerColor);
}

window.onload = main;
