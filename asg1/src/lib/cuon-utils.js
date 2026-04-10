// ================================================================
//  lib/cuon-utils.js
//  Minimal version of the cuon-utils helper from the Matsuda textbook.
//  Matches the API used throughout the WebGL Programming Guide.
//
//  Source: WebGL Programming Guide (Matsuda & Lea)
//  You can also download the full original from:
//  https://sites.google.com/site/webglbook/
// ================================================================

/**
 * Get the WebGL rendering context — used by every book example
 * instead of calling canvas.getContext('webgl') directly.
 * @param  {HTMLCanvasElement} canvas
 * @param  {object}            opt  optional context attributes
 * @return {WebGLRenderingContext|null}
 */
function getWebGLContext(canvas, opt) {
  var names = ['webgl', 'experimental-webgl'];
  var ctx = null;
  for (var i = 0; i < names.length; i++) {
    try {
      ctx = canvas.getContext(names[i], opt || { preserveDrawingBuffer: true });
    } catch (e) {}
    if (ctx) break;
  }
  return ctx;
}

/**
 * Compile vertex + fragment shaders, link them into a program,
 * and attach it to gl.program.
 * @param  {WebGLRenderingContext} gl
 * @param  {string} vshader  GLSL source for the vertex shader
 * @param  {string} fshader  GLSL source for the fragment shader
 * @return {boolean}         true on success
 */
function initShaders(gl, vshader, fshader) {
  var program = createProgram(gl, vshader, fshader);
  if (!program) {
    console.error('initShaders: failed to create program');
    return false;
  }
  gl.useProgram(program);
  gl.program = program;
  return true;
}

function createProgram(gl, vshader, fshader) {
  var vs = loadShader(gl, gl.VERTEX_SHADER,   vshader);
  var fs = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vs || !fs) return null;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('createProgram link error: ' + gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function loadShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('loadShader compile error: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
