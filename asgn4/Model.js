// Model.js - OBJ loader (based on the Lab 3 parser). Parses v/vn/f into the same
// 8-float interleaved layout [x,y,z, u,v, nx,ny,nz] as the rest of asgn4 so the
// Phong lighting works on it. UVs are dummy; the model draws as a solid color.

class Model {
  constructor(gl, filePath) {
    this.filePath = filePath;
    this.color = [0.8, 0.4, 0.2, 1.0];  // warm copper-ish default
    this.matrix = new Matrix4();
    this.isLoaded = false;
    this.vertexBuffer = null;
    this.vertexCount = 0;

    this.loadAndParse(gl);
  }

  async loadAndParse(gl) {
    try {
      const response = await fetch(this.filePath);
      if (!response.ok) {
        console.log('Failed to load', this.filePath);
        return;
      }
      const text = await response.text();
      this.parseOBJ(text);
      this.uploadToGPU(gl);
      this.isLoaded = true;
    } catch (e) {
      console.log('Model load error:', e);
    }
  }

  parseOBJ(text) {
    const lines = text.split('\n');
    const allPositions = [];
    const allNormals = [];
    const interleavedData = [];

    for (let i = 0; i < lines.length; i++) {
      const tokens = lines[i].trim().split(/\s+/);
      if (tokens[0] === 'v') {
        allPositions.push(
          parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])
        );
      } else if (tokens[0] === 'vn') {
        allNormals.push(
          parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])
        );
      } else if (tokens[0] === 'f') {
        // assumes triangulated faces in v//vn form (matches Lab 3 / teapot.obj)
        for (const face of [tokens[1], tokens[2], tokens[3]]) {
          const indices = face.split('//');
          const vIdx = (parseInt(indices[0], 10) - 1) * 3;
          const nIdx = (parseInt(indices[1], 10) - 1) * 3;
          interleavedData.push(
            allPositions[vIdx], allPositions[vIdx + 1], allPositions[vIdx + 2],
            0.0, 0.0,  // dummy UVs (model isn't textured)
            allNormals[nIdx], allNormals[nIdx + 1], allNormals[nIdx + 2]
          );
        }
      }
    }

    this.vertices = new Float32Array(interleavedData);
    this.vertexCount = interleavedData.length / 8;
  }

  uploadToGPU(gl) {
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
  }

  render(gl) {
    if (!this.isLoaded) return;

    setModelMatrix(this.matrix);   // also sets the inverse-transpose normal matrix
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1f(u_texColorWeight, 0.0);  // pure solid color, no texture
    gl.uniform1i(u_UseLighting, 1);       // participate in Phong lighting

    bindAttribs(this.vertexBuffer);       // existing 8-float interleaved binder
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }
}
