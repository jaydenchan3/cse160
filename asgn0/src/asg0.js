function main() {
  var canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return;
  }

  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var v1 = new Vector3([2.25, 2.25, 0]);
  drawVector(v1, 'red');
}

function drawVector(v, color) {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  var cx = canvas.width / 2;
  var cy = canvas.height / 2;

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + v.elements[0] * 20, cy - v.elements[1] * 20);
  ctx.stroke();
}

function handleDrawEvent() {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var x1 = parseFloat(document.getElementById('v1x').value);
  var y1 = parseFloat(document.getElementById('v1y').value);
  var v1 = new Vector3([x1, y1, 0]);
  drawVector(v1, 'red');

  var x2 = parseFloat(document.getElementById('v2x').value);
  var y2 = parseFloat(document.getElementById('v2y').value);
  var v2 = new Vector3([x2, y2, 0]);
  drawVector(v2, 'blue');
}

function angleBetween(v1, v2) {
  var dot = Vector3.dot(v1, v2);
  var mag1 = v1.magnitude();
  var mag2 = v2.magnitude();
  var angle = Math.acos(dot / (mag1 * mag2));
  return angle * (180 / Math.PI);
}

function areaTriangle(v1, v2) {
  var cross = Vector3.cross(v1, v2);
  return cross.magnitude() / 2;
}

function handleDrawOperationEvent() {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var x1 = parseFloat(document.getElementById('v1x').value);
  var y1 = parseFloat(document.getElementById('v1y').value);
  var v1 = new Vector3([x1, y1, 0]);
  drawVector(v1, 'red');

  var x2 = parseFloat(document.getElementById('v2x').value);
  var y2 = parseFloat(document.getElementById('v2y').value);
  var v2 = new Vector3([x2, y2, 0]);
  drawVector(v2, 'blue');

  var op = document.getElementById('operation').value;
  var scalar = parseFloat(document.getElementById('scalar').value);

  if (op === 'add') {
    var v3 = new Vector3([x1, y1, 0]);
    v3.add(v2);
    drawVector(v3, 'green');
  } else if (op === 'sub') {
    var v3 = new Vector3([x1, y1, 0]);
    v3.sub(v2);
    drawVector(v3, 'green');
  } else if (op === 'mul') {
    var v3 = new Vector3([x1, y1, 0]);
    var v4 = new Vector3([x2, y2, 0]);
    v3.mul(scalar);
    v4.mul(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  } else if (op === 'div') {
    var v3 = new Vector3([x1, y1, 0]);
    var v4 = new Vector3([x2, y2, 0]);
    v3.div(scalar);
    v4.div(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  } else if (op === 'magnitude') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());
  } else if (op === 'normalize') {
    var v3 = new Vector3([x1, y1, 0]);
    var v4 = new Vector3([x2, y2, 0]);
    v3.normalize();
    v4.normalize();
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  } else if (op === 'angle') {
    console.log('Angle between v1 and v2: ' + angleBetween(v1, v2) + ' degrees');
  } else if (op === 'area') {
    console.log('Area of triangle: ' + areaTriangle(v1, v2));
  }
}