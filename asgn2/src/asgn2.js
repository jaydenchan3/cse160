// asgn2.js - CSE160 Asgn2 (Blocky Peacock)

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

const POKE_DURATION = 2.0;

let gl;
let canvas;

let a_Position;
let u_FragColor;
let u_ModelMatrix;
let u_GlobalRotateMatrix;

let g_cubeBuffer;
let g_cubeVertexCount;
let g_cylinderBuffer;
let g_cylinderVertexCount;

let g_globalAngle = 0;

let g_upperLegAngleL = 0, g_upperLegAngleR = 0;
let g_lowerLegAngleL = 0, g_lowerLegAngleR = 0;
let g_footAngleL     = 0, g_footAngleR     = 0;
let g_neckAngle      = 0;
let g_headAngle      = 0;
let g_tailSwayAngle  = 0;

let g_animationOn = true;
let g_startTime   = 0;
let g_seconds     = 0;

let g_isDragging = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;
let g_mouseRotX  = 0;
let g_mouseRotY  = 0;

let g_pokeActive      = false;
let g_pokeStartTime   = 0;
let g_tailFanAmount   = 0;
let g_bodyYawAngle    = 0;
let g_prePokeSnapshot = null;

const FPS_WINDOW = 20;
const FPS_DOM_HZ = 5;
let g_lastFrameTime     = 0;
let g_frameDeltas       = [];
let g_frameDeltaSum     = 0;
let g_lastFpsUpdateTime = 0;
let g_fpsEl             = null;

function main() {
  setupWebGL();
  connectVariablesToGLSL();
  initCubeBuffer();
  initCylinderBuffer();
  setupUI();

  gl.clearColor(0.85, 0.92, 0.97, 1.0);
  gl.enable(gl.DEPTH_TEST);

  g_fpsEl     = document.getElementById('fps');
  g_startTime = performance.now() / 1000.0;
  requestAnimationFrame(tick);
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
  a_Position           = gl.getAttribLocation(gl.program, 'a_Position');
  u_FragColor          = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix        = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
}

function initCubeBuffer() {
  const v = [
    0,0,1, 1,0,1, 1,1,1,   0,0,1, 1,1,1, 0,1,1,
    0,0,0, 1,1,0, 1,0,0,   0,0,0, 0,1,0, 1,1,0,
    0,1,0, 0,1,1, 1,1,1,   0,1,0, 1,1,1, 1,1,0,
    0,0,0, 1,0,0, 1,0,1,   0,0,0, 1,0,1, 0,0,1,
    1,0,0, 1,1,0, 1,1,1,   1,0,0, 1,1,1, 1,0,1,
    0,0,0, 0,0,1, 0,1,1,   0,0,0, 0,1,1, 0,1,0,
  ];

  const vertices = new Float32Array(v);
  g_cubeVertexCount = vertices.length / 3;

  g_cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function drawCube(M, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);

  gl.bindBuffer(gl.ARRAY_BUFFER, g_cubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, g_cubeVertexCount);
}

function initCylinderBuffer() {
  const N = 16;
  const R = 0.5;
  const verts = [];

  for (let i = 0; i < N; i++) {
    const a1 = (i     / N) * 2 * Math.PI;
    const a2 = ((i+1) / N) * 2 * Math.PI;
    const x1 = R * Math.cos(a1), z1 = R * Math.sin(a1);
    const x2 = R * Math.cos(a2), z2 = R * Math.sin(a2);

    verts.push(x1, 0, z1,  x2, 0, z2,  x2, 1, z2);
    verts.push(x1, 0, z1,  x2, 1, z2,  x1, 1, z1);
    verts.push(0, 1, 0,  x1, 1, z1,  x2, 1, z2);
    verts.push(0, 0, 0,  x2, 0, z2,  x1, 0, z1);
  }

  const vertices = new Float32Array(verts);
  g_cylinderVertexCount = vertices.length / 3;

  g_cylinderBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_cylinderBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function drawCylinder(M, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);

  gl.bindBuffer(gl.ARRAY_BUFFER, g_cylinderBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, g_cylinderVertexCount);
}

function setupUI() {
  bindSlider('globalRotate', v => { g_globalAngle = v; });

  bindSlider('upperLeg', v => { g_upperLegAngleL = v; g_upperLegAngleR = v; });
  bindSlider('lowerLeg', v => { g_lowerLegAngleL = v; g_lowerLegAngleR = v; });
  bindSlider('foot',     v => { g_footAngleL     = v; g_footAngleR     = v; });

  bindSlider('neck',    v => { g_neckAngle     = v; });
  bindSlider('head',    v => { g_headAngle     = v; });
  bindSlider('tail',    v => { g_tailSwayAngle = v; });
  bindSlider('bodyYaw', v => { g_bodyYawAngle  = v; });

  document.getElementById('animOn').addEventListener('click', () => {
    g_animationOn = true;
    renderScene();
  });
  document.getElementById('animOff').addEventListener('click', () => {
    g_animationOn = false;
    renderScene();
  });

  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
}

function onMouseDown(ev) {
  ev.preventDefault();

  if (ev.shiftKey) {
    triggerPoke();
    return;
  }

  g_isDragging = true;
  g_lastMouseX = ev.clientX;
  g_lastMouseY = ev.clientY;
}

function triggerPoke() {
  // only snapshot on first click so repeated shift-clicks keep the original pose
  if (!g_pokeActive) {
    g_prePokeSnapshot = {
      upperL: g_upperLegAngleL, upperR: g_upperLegAngleR,
      lowerL: g_lowerLegAngleL, lowerR: g_lowerLegAngleR,
      footL:  g_footAngleL,     footR:  g_footAngleR,
      neck:   g_neckAngle,      head:   g_headAngle,
      tailSway: g_tailSwayAngle,
      bodyYaw: g_bodyYawAngle,
    };
  }
  g_pokeActive    = true;
  g_pokeStartTime = g_seconds;
}

function onMouseMove(ev) {
  if (!g_isDragging) return;
  const dx = ev.clientX - g_lastMouseX;
  const dy = ev.clientY - g_lastMouseY;
  g_mouseRotY += dx * 0.5;
  g_mouseRotX += dy * 0.5;
  g_lastMouseX = ev.clientX;
  g_lastMouseY = ev.clientY;
}

function onMouseUp() {
  g_isDragging = false;
}

function bindSlider(id, setter) {
  const el = document.getElementById(id);
  el.addEventListener('input', ev => {
    setter(Number(ev.target.value));
    renderScene();
  });
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

  g_seconds = now / 1000.0 - g_startTime;
  updateAnimationAngles();
  renderScene();
  requestAnimationFrame(tick);
}

function updateAnimationAngles() {
  // poke runs even when animation is off
  if (g_pokeActive) {
    const elapsed = g_seconds - g_pokeStartTime;
    if (elapsed >= POKE_DURATION) {
      g_pokeActive    = false;
      g_tailFanAmount = 0;

      if (!g_animationOn && g_prePokeSnapshot) {
        const s = g_prePokeSnapshot;
        g_upperLegAngleL = s.upperL; g_upperLegAngleR = s.upperR;
        g_lowerLegAngleL = s.lowerL; g_lowerLegAngleR = s.lowerR;
        g_footAngleL     = s.footL;  g_footAngleR     = s.footR;
        g_neckAngle      = s.neck;   g_headAngle      = s.head;
        g_tailSwayAngle  = s.tailSway;
        g_bodyYawAngle   = s.bodyYaw;
      } else {
        g_bodyYawAngle = 0;
      }
      g_prePokeSnapshot = null;
    } else {
      runPokeAnimation(elapsed);
      return;
    }
  }

  if (!g_animationOn) return;

  g_tailFanAmount = 0;
  g_bodyYawAngle  = 0;

  const t = g_seconds;
  const phase = 2 * Math.PI * 1.2 * t;
  const lSwing = Math.sin(phase);
  const rSwing = Math.sin(phase + Math.PI);

  g_upperLegAngleL = 25 * lSwing;
  g_upperLegAngleR = 25 * rSwing;

  // knee only bends on the forward swing so it looks like walking, not a pendulum
  g_lowerLegAngleL = -35 * Math.max(0, lSwing);
  g_lowerLegAngleR = -35 * Math.max(0, rSwing);

  g_footAngleL = 15 * Math.sin(phase + Math.PI / 2);
  g_footAngleR = 15 * Math.sin(phase + Math.PI / 2 + Math.PI);

  const np = 2 * Math.PI * 0.6 * t;
  g_neckAngle = 6 * Math.sin(np);
  g_headAngle = 4 * Math.sin(np + Math.PI / 3);

  g_tailSwayAngle = 5 * Math.sin(2 * Math.PI * 0.3 * t);
}

function runPokeAnimation(elapsed) {
  const RAMP = 0.3;
  let fan;
  if (elapsed < RAMP) {
    fan = elapsed / RAMP;
  } else if (elapsed < POKE_DURATION - RAMP) {
    fan = 1;
  } else {
    fan = Math.max(0, (POKE_DURATION - elapsed) / RAMP);
  }
  g_tailFanAmount = fan;

  const wig = Math.sin(2 * Math.PI * 3.0 * elapsed);

  g_neckAngle    =  35 + 8 * wig;
  g_headAngle    =  25 + 6 * wig;
  g_bodyYawAngle = 18 * wig;

  g_upperLegAngleL =  5 * wig;
  g_upperLegAngleR = -5 * wig;
  g_lowerLegAngleL = 0;
  g_lowerLegAngleR = 0;
  g_footAngleL     = 0;
  g_footAngleR     = 0;

  g_tailSwayAngle = 0;
}

function renderScene() {
  const globalRot = new Matrix4()
    .setRotate(g_globalAngle, 0, 1, 0)
    .rotate(g_mouseRotY,      0, 1, 0)
    .rotate(g_mouseRotX,      1, 0, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRot.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawPeacock();
}

function drawPeacock() {
  const bodyJoint = new Matrix4();
  bodyJoint.rotate(g_bodyYawAngle, 0, 1, 0);

  // body
  {
    const M = new Matrix4(bodyJoint);
    M.translate(-0.3, -0.15, -0.15);
    M.scale(0.6, 0.3, 0.3);
    drawCube(M, [0.15, 0.35, 0.70, 1.0]);
  }

  // neck, head, beak
  const neckJoint = new Matrix4(bodyJoint);
  neckJoint.translate(0.22, 0.15, 0);
  neckJoint.rotate(g_neckAngle, 0, 0, 1);
  {
    const M = new Matrix4(neckJoint);
    M.scale(0.12, 0.4, 0.12);
    drawCylinder(M, [0.12, 0.30, 0.60, 1.0]);
  }

  const headJoint = new Matrix4(neckJoint);
  headJoint.translate(0, 0.4, 0);
  headJoint.rotate(g_headAngle, 0, 0, 1);
  {
    const M = new Matrix4(headJoint);
    M.translate(-0.1, 0, -0.1);
    M.scale(0.2, 0.18, 0.2);
    drawCube(M, [0.15, 0.35, 0.70, 1.0]);
  }

  const beakJoint = new Matrix4(headJoint);
  beakJoint.translate(0.1, 0.09, 0);
  {
    const M = new Matrix4(beakJoint);
    M.translate(0, -0.03, -0.03);
    M.scale(0.12, 0.06, 0.06);
    drawCube(M, [0.95, 0.80, 0.20, 1.0]);
  }

  // legs
  drawLeg(bodyJoint,  0.10, g_upperLegAngleL, g_lowerLegAngleL, g_footAngleL);
  drawLeg(bodyJoint, -0.10, g_upperLegAngleR, g_lowerLegAngleR, g_footAngleR);

  drawTail(bodyJoint);
}

function drawLeg(parentJoint, zOffset, upperAngle, lowerAngle, footAngle) {
  const upperJoint = new Matrix4(parentJoint);
  upperJoint.translate(-0.05, -0.15, zOffset);
  upperJoint.rotate(upperAngle, 0, 0, 1);
  {
    const M = new Matrix4(upperJoint);
    M.translate(-0.04, -0.2, -0.04);
    M.scale(0.08, 0.2, 0.08);
    drawCube(M, [0.30, 0.22, 0.18, 1.0]);
  }

  const lowerJoint = new Matrix4(upperJoint);
  lowerJoint.translate(0, -0.2, 0);
  lowerJoint.rotate(lowerAngle, 0, 0, 1);
  {
    const M = new Matrix4(lowerJoint);
    M.translate(-0.035, -0.2, -0.035);
    M.scale(0.07, 0.2, 0.07);
    drawCube(M, [0.30, 0.22, 0.18, 1.0]);
  }

  const footJoint = new Matrix4(lowerJoint);
  footJoint.translate(0, -0.2, 0);
  footJoint.rotate(footAngle, 0, 0, 1);
  {
    const M = new Matrix4(footJoint);
    M.translate(0, -0.05, -0.06);
    M.scale(0.15, 0.05, 0.12);
    drawCube(M, [0.50, 0.40, 0.30, 1.0]);
  }
}

function drawTail(parentJoint) {
  const tailJoint = new Matrix4(parentJoint);
  tailJoint.translate(-0.3, 0, 0);
  tailJoint.rotate(g_tailSwayAngle, 0, 1, 0);

  {
    const M = new Matrix4(tailJoint);
    M.translate(-0.05, -0.1, -0.1);
    M.scale(0.05, 0.2, 0.2);
    drawCube(M, [0.08, 0.30, 0.30, 1.0]);
  }

  const featherCount = 5;
  const spread = 70 + 100 * g_tailFanAmount;
  for (let i = 0; i < featherCount; i++) {
    const t = (i / (featherCount - 1)) - 0.5;
    const yaw = t * spread;

    const featherJoint = new Matrix4(tailJoint);
    featherJoint.translate(-0.05, 0, 0);
    featherJoint.rotate(yaw, 0, 1, 0);
    featherJoint.rotate(-8, 0, 0, 1);

    const M = new Matrix4(featherJoint);
    M.translate(-0.5, -0.025, -0.025);
    M.scale(0.5, 0.05, 0.05);
    drawCube(M, [0.10, 0.55, 0.45, 1.0]);
  }
}

window.onload = main;
