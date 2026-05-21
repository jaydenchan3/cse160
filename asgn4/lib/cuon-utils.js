// cuon-utils.js (c) 2012 kanda and matsuda
// Standard helper from the WebGL Programming Guide textbook (Matsuda/Lea).

/**
 * Get the WebGL rendering context. Tries WebGL then experimental-webgl.
 * @param canvas the canvas element
 * @param opt_debug if true, wraps the context for debug error reporting (optional)
 * @return WebGLRenderingContext or null
 */
function getWebGLContext(canvas, opt_debug) {
  // Try the standard context first, then the experimental fallback for older browsers
  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  if (opt_debug !== undefined && !opt_debug && typeof WebGLDebugUtils !== 'undefined') {
    gl = WebGLDebugUtils.makeDebugContext(gl);
  }
  return gl;
}

/**
 * Compile and link a vertex+fragment shader pair into a program, then make it the current program.
 * Also stashes the program on gl.program for convenience (this is what the textbook does).
 */
function initShaders(gl, vshader, fshader) {
  var program = createProgram(gl, vshader, fshader);
  if (!program) {
    console.log('Failed to create program');
    return false;
  }
  gl.useProgram(program);
  gl.program = program;
  return true;
}

/**
 * Create and link a program from vertex + fragment shader source strings.
 */
function createProgram(gl, vshader, fshader) {
  var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
  var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vertexShader || !fragmentShader) return null;

  var program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    var error = gl.getProgramInfoLog(program);
    console.log('Failed to link program: ' + error);
    gl.deleteProgram(program);
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    return null;
  }
  return program;
}

/**
 * Compile a single shader of the given type from source.
 */
function loadShader(gl, type, source) {
  var shader = gl.createShader(type);
  if (shader == null) {
    console.log('unable to create shader');
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    var error = gl.getShaderInfoLog(shader);
    console.log('Failed to compile shader: ' + error);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
