// Vertex Shader
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'uniform float u_Size;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = u_Size;\n' +
  '}\n';

// Fragment Shader
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform vec4 u_FragColor;\n' +
  'void main() {\n' +
  '  gl_FragColor = u_FragColor;\n' +
  '}\n';

var gl;
var canvas;
var a_Position;
var u_FragColor;
var u_Size;

var g_shapesList = [];

var g_selectedType = 'point';
var g_selectedColor = [1.0, 1.0, 0.0, 1.0];
var g_selectedSize = 10;
var g_selectedSegments = 10;


function main() {
  setupWebGL();
  connectVariablesToGLSL();

  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) {
    if (ev.buttons == 1) { click(ev); }
  };

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
window.onload = main;


function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas, { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}


function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }
}


function click(ev) {
  g_selectedColor[0] = document.getElementById('redSlider').value / 255;
  g_selectedColor[1] = document.getElementById('greenSlider').value / 255;
  g_selectedColor[2] = document.getElementById('blueSlider').value / 255;
  g_selectedSize     = document.getElementById('sizeSlider').value / 1;
  g_selectedSegments = document.getElementById('segmentSlider').value / 1;

  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  x = ((x - rect.left) - canvas.width/2)  / (canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))  / (canvas.height/2);

  var shape;
  if (g_selectedType == 'point') {
    shape = new Point();
  } else if (g_selectedType == 'triangle') {
    shape = new Triangle();
  } else {
    shape = new Circle();
  }

  shape.position = [x, y];
  shape.color    = [g_selectedColor[0], g_selectedColor[1], g_selectedColor[2], 1.0];
  shape.size     = g_selectedSize;
  shape.segments = g_selectedSegments;

  g_shapesList.push(shape);
  renderAllShapes();
}


function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (var i = 0; i < g_shapesList.length; i++) {
    g_shapesList[i].render();
  }
}


function clearCanvas() {
  g_shapesList = [];
  renderAllShapes();
}


function drawTriangle(vertices, color) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);

  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}