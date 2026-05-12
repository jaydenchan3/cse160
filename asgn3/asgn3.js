// asgn3.js - CSE160 Asgn3 (Mini Minecraft)

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform float u_texColorWeight;  // 0 = solid color, 1 = pure texture
  varying vec2 v_UV;
  void main() {
    vec4 texColor = texture2D(u_Sampler0, v_UV);
    gl_FragColor = mix(u_FragColor, texColor, u_texColorWeight);
  }
`;

let gl;
let canvas;

let a_Position;
let a_UV;
let u_FragColor;
let u_ModelMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_Sampler0;
let u_texColorWeight;

let g_cubeBuffer;
let g_cubeVertexCount;

let g_grassTexture;
let g_dirtTexture;
let g_stoneTexture;
let g_woodTexture;
let g_goldTexture;

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

const FPS_WINDOW = 20;
const FPS_DOM_HZ = 5;
let g_lastFrameTime = 0;
let g_frameDeltas = [];
let g_frameDeltaSum = 0;
let g_lastFpsUpdateTime = 0;
let g_fpsEl = null;
let g_statusEl = null;

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  initCubeBuffer();
  initMatrices();
  setupInput();

  gl.clearColor(0.6, 0.8, 0.95, 1.0);  // sky blue fallback (sky cube usually covers it)
  gl.enable(gl.DEPTH_TEST);

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
    ' | F=place G=remove [1/2/3 type] | current: ' + g_currentBlockType +
    ' | verts d=' + g_worldVertexCounts[T_DIRT] +
    ' s=' + g_worldVertexCounts[T_STONE] +
    ' w=' + g_worldVertexCounts[T_WOOD] +
    ' g=' + g_worldVertexCounts[T_GOLD]
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
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_texColorWeight = gl.getUniformLocation(gl.program, 'u_texColorWeight');
}

function initMatrices() {
  g_modelMatrix = new Matrix4();
  g_camera = new Camera(canvas);
}

// Unit cube from (0,0,0) to (1,1,1). 36 verts, interleaved [x,y,z,u,v].
function initCubeBuffer() {
  // per face: two triangles using the standard quad UV pattern
  // (0,0)(1,0)(1,1) | (0,0)(1,1)(0,1)
  const v = [
    // +Z front
    0,0,1, 0,0, 1,0,1, 1,0, 1,1,1, 1,1,
    0,0,1, 0,0, 1,1,1, 1,1, 0,1,1, 0,1,
    // -Z back
    1,0,0, 0,0, 0,1,0, 1,1, 0,0,0, 1,0,
    1,0,0, 0,0, 1,1,0, 0,1, 0,1,0, 1,1,
    // +Y top
    0,1,0, 0,0, 0,1,1, 0,1, 1,1,1, 1,1,
    0,1,0, 0,0, 1,1,1, 1,1, 1,1,0, 1,0,
    // -Y bottom
    0,0,0, 0,0, 1,0,0, 1,0, 1,0,1, 1,1,
    0,0,0, 0,0, 1,0,1, 1,1, 0,0,1, 0,1,
    // +X right
    1,0,0, 0,0, 1,1,0, 0,1, 1,1,1, 1,1,
    1,0,0, 0,0, 1,1,1, 1,1, 1,0,1, 1,0,
    // -X left
    0,0,0, 0,0, 0,0,1, 1,0, 0,1,1, 1,1,
    0,0,0, 0,0, 0,1,1, 1,1, 0,1,0, 0,1,
  ];

  const vertices = new Float32Array(v);
  g_cubeVertexCount = vertices.length / 5;

  g_cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

// per-face vertex layout in cube-local coords: 6 verts x [dx, dy, dz, u, v].
// Same UV pattern (0,0)(1,0)(1,1)(0,0)(1,1)(0,1) on every face.
// These are added to a (x,y,z) world offset by pushFace().
const FACE_PX = [  // +X (right)
  1,0,0, 0,0, 1,1,0, 0,1, 1,1,1, 1,1,
  1,0,0, 0,0, 1,1,1, 1,1, 1,0,1, 1,0,
];
const FACE_NX = [  // -X (left)
  0,0,0, 0,0, 0,0,1, 1,0, 0,1,1, 1,1,
  0,0,0, 0,0, 0,1,1, 1,1, 0,1,0, 0,1,
];
const FACE_PY = [  // +Y (top)
  0,1,0, 0,0, 0,1,1, 0,1, 1,1,1, 1,1,
  0,1,0, 0,0, 1,1,1, 1,1, 1,1,0, 1,0,
];
const FACE_PZ = [  // +Z (front)
  0,0,1, 0,0, 1,0,1, 1,0, 1,1,1, 1,1,
  0,0,1, 0,0, 1,1,1, 1,1, 0,1,1, 0,1,
];
const FACE_NZ = [  // -Z (back)
  1,0,0, 0,0, 0,1,0, 1,1, 0,0,0, 1,0,
  1,0,0, 0,0, 1,1,0, 0,1, 0,1,0, 1,1,
];

function pushFace(verts, base, x, y, z) {
  for (let i = 0; i < 30; i += 5) {
    verts.push(
      base[i] + x,
      base[i+1] + y,
      base[i+2] + z,
      base[i+3],
      base[i+4],
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
  g_worldVertexCounts[type] = arr.length / 5;
  if (g_worldBuffers[type] === null) g_worldBuffers[type] = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_worldBuffers[type]);
  // DYNAMIC_DRAW since these get rebuilt whenever blocks change
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
}

function drawWorld() {
  g_modelMatrix.setIdentity();
  gl.uniformMatrix4fv(u_ModelMatrix, false, g_modelMatrix.elements);
  gl.uniform4f(u_FragColor, 1, 1, 1, 1);
  gl.uniform1f(u_texColorWeight, 1.0);

  for (const t of BLOCK_TYPES) drawWorldChunk(t, textureFor(t));
}

function drawWorldChunk(type, texture) {
  const count = g_worldVertexCounts[type];
  if (count === 0) return;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u_Sampler0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, g_worldBuffers[type]);
  const FSIZE = Float32Array.BYTES_PER_ELEMENT;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 5 * FSIZE, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 5 * FSIZE, 3 * FSIZE);
  gl.enableVertexAttribArray(a_UV);

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

function bindCubeAttribs() {
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  const FSIZE = Float32Array.BYTES_PER_ELEMENT;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 5 * FSIZE, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 5 * FSIZE, 3 * FSIZE);
  gl.enableVertexAttribArray(a_UV);
}

function drawTexturedCube(M, texture) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_FragColor, 1, 1, 1, 1);
  gl.uniform1f(u_texColorWeight, 1.0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u_Sampler0, 0);

  bindCubeAttribs();
  gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
}

function drawSolidCube(M, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_texColorWeight, 0.0);

  bindCubeAttribs();
  gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
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
}

window.onload = main;
