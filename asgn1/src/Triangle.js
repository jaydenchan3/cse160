class Triangle {
  constructor() {
    this.position = [0, 0];
    this.color    = [1.0, 1.0, 1.0, 1.0];
    this.size     = 10;
    this.segments = 0;
  }

  render() {
    var x = this.position[0];
    var y = this.position[1];
    var d = this.size / 200.0;

    var verts = [
      x,     y + d,   // top
      x - d, y - d,   // bottom left
      x + d, y - d    // bottom right
    ];

    drawTriangle(verts, this.color);
  }
}