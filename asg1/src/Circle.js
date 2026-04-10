class Circle {
  constructor() {
    this.position = [0, 0];
    this.color    = [1.0, 1.0, 1.0, 1.0];
    this.size     = 10;
    this.segments = 10;
  }

  render() {
    var x = this.position[0];
    var y = this.position[1];
    var r = this.size / 200.0;

    for (var i = 0; i < this.segments; i++) {
      var angle1 = (2 * Math.PI * i)       / this.segments;
      var angle2 = (2 * Math.PI * (i + 1)) / this.segments;

      var verts = [
        x, y,
        x + r * Math.cos(angle1), y + r * Math.sin(angle1),
        x + r * Math.cos(angle2), y + r * Math.sin(angle2)
      ];

      drawTriangle(verts, this.color);
    }
  }
}