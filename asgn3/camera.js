// camera.js

class Camera {
  constructor(canvas) {
    this.fov = 60;

    this.eye = new Vector3([0, 1, 5]);
    this.at = new Vector3([0, 1, 4]);  // one unit forward
    this.up = new Vector3([0, 1, 0]);

    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();

    // reused, don't realloc each frame
    this._rotScratch = new Matrix4();

    const aspect = canvas.width / canvas.height;
    this.projectionMatrix.setPerspective(this.fov, aspect, 0.1, 1000);
    this._updateView();
  }

  _updateView() {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    this.viewMatrix.setLookAt(
      e[0], e[1], e[2],
      a[0], a[1], a[2],
      u[0], u[1], u[2]
    );
  }

  setSpawn(ex, ey, ez, ax, ay, az) {
    const e = this.eye.elements, a = this.at.elements;
    e[0] = ex; e[1] = ey; e[2] = ez;
    a[0] = ax; a[1] = ay; a[2] = az;
    this._updateView();
  }

  moveForward(speed) {
    const e = this.eye.elements, a = this.at.elements;
    let fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];
    const len = Math.hypot(fx, fy, fz);
    if (len === 0) return;
    fx = fx / len * speed; fy = fy / len * speed; fz = fz / len * speed;
    e[0] += fx; e[1] += fy; e[2] += fz;
    a[0] += fx; a[1] += fy; a[2] += fz;
    this._updateView();
  }

  moveBackwards(speed) {
    const e = this.eye.elements, a = this.at.elements;
    let bx = e[0] - a[0], by = e[1] - a[1], bz = e[2] - a[2];
    const len = Math.hypot(bx, by, bz);
    if (len === 0) return;
    bx = bx / len * speed; by = by / len * speed; bz = bz / len * speed;
    e[0] += bx; e[1] += by; e[2] += bz;
    a[0] += bx; a[1] += by; a[2] += bz;
    this._updateView();
  }

  // strafe left: side = up x forward
  moveLeft(speed) {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    const fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];
    let sx = u[1]*fz - u[2]*fy;
    let sy = u[2]*fx - u[0]*fz;
    let sz = u[0]*fy - u[1]*fx;
    const len = Math.hypot(sx, sy, sz);
    if (len === 0) return;
    sx = sx / len * speed; sy = sy / len * speed; sz = sz / len * speed;
    e[0] += sx; e[1] += sy; e[2] += sz;
    a[0] += sx; a[1] += sy; a[2] += sz;
    this._updateView();
  }

  // strafe right: side = forward x up
  moveRight(speed) {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    const fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];
    let sx = fy*u[2] - fz*u[1];
    let sy = fz*u[0] - fx*u[2];
    let sz = fx*u[1] - fy*u[0];
    const len = Math.hypot(sx, sy, sz);
    if (len === 0) return;
    sx = sx / len * speed; sy = sy / len * speed; sz = sz / len * speed;
    e[0] += sx; e[1] += sy; e[2] += sz;
    a[0] += sx; a[1] += sy; a[2] += sz;
    this._updateView();
  }

  panLeft(alpha) {
    this._panBy(alpha);
  }

  panRight(alpha) {
    this._panBy(-alpha);
  }

  _panBy(alpha) {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    const fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];

    this._rotScratch.setRotate(alpha, u[0], u[1], u[2]);
    const m = this._rotScratch.elements;  // column-major

    // m * (fx, fy, fz, 0). w=0 means treat it as a direction, not a point
    const rx = m[0]*fx + m[4]*fy + m[8]*fz;
    const ry = m[1]*fx + m[5]*fy + m[9]*fz;
    const rz = m[2]*fx + m[6]*fy + m[10]*fz;

    a[0] = e[0] + rx;
    a[1] = e[1] + ry;
    a[2] = e[2] + rz;
    this._updateView();
  }

  // pitch around the side axis (right = forward x up). caller does the clamping.
  panUp(alpha) { this._pitchBy(alpha); }
  panDown(alpha) { this._pitchBy(-alpha); }

  _pitchBy(alpha) {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    const fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];

    // right = forward x up
    let sx = fy*u[2] - fz*u[1];
    let sy = fz*u[0] - fx*u[2];
    let sz = fx*u[1] - fy*u[0];
    const slen = Math.hypot(sx, sy, sz);
    if (slen === 0) return;  // looking straight up/down: no defined right axis
    sx /= slen; sy /= slen; sz /= slen;

    this._rotScratch.setRotate(alpha, sx, sy, sz);
    const m = this._rotScratch.elements;

    const nx = m[0]*fx + m[4]*fy + m[8]*fz;
    const ny = m[1]*fx + m[5]*fy + m[9]*fz;
    const nz = m[2]*fx + m[6]*fy + m[10]*fz;

    a[0] = e[0] + nx;
    a[1] = e[1] + ny;
    a[2] = e[2] + nz;
    this._updateView();
  }
}
