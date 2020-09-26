const W = 1200  // width of bgCanvas
const H = 500  // height of bgCanvas
const Wsim = W * 0.69
const Hsim = H
const Wplot = 0.25 * W
const Hplot = 0.875 * H
let bgCanvas, simCanvas, plotCanvas;

const _V = p5.Vector;
const MAX_LENGTH = 2000;
const MAX_RAY_LEVEL = 50;
let scene;

function setup() {
  bgCanvas = createCanvas(W, H)
  bgCanvas.parent("simwrapper")

  simCanvas = createGraphics(Wsim, Hsim)

  plotCanvas = createGraphics(Wplot, Hplot)
  plotCanvas.background(20)
  plotCanvas.stroke(255)
  plotCanvas.strokeWeight(3)
  plotCanvas.noFill()
  plotCanvas.rect(0, 0, Wplot, Hplot)

  scene = new Scene(
    [
      new Ray(createVector(300, 300), createVector(-13, 50)),
      new Ray(createVector(550, 300), createVector(-100, -20)),
    ],
    [
      new Mirror(createVector(50, 400), createVector(550, 400)),
      new Mirror(createVector(550, 100), createVector(50, 100)),
      new Mirror(createVector(100, 200), createVector(100, 400)),
      new Mirror(createVector(350, 200), createVector(500, 400)),
    ]
  );
}

 function draw(){
  // border of simCanvas
  simCanvas.clear()
  simCanvas.stroke(255)
  simCanvas.strokeWeight(2)
  simCanvas.noFill()
  simCanvas.rect(10, 10, Wsim - 20, Hsim - 20)

  background(0);

  // sim canvas
  image(simCanvas, 0, 0);

  scene.draw();
  scene.updateSampleRayDirection(0, mouseX, mouseY);
}

class Scene {

  constructor(rays, mirrors) {
    this.rays = rays;
    this.mirrors = mirrors;
    rays.forEach(r => r.cast(mirrors));
  }

  // just for testing
  updateSampleRayDirection(index, x, y) {
    this.rays[index].updateDirection(x, y);
    this.rays[index].cast(this.mirrors);
  }

  draw() {
    this.mirrors.forEach(m => m.draw());
    this.rays.forEach(r => r.draw());
  }
}

class Mirror {

  constructor(start, end) {
    this.start = start;
    this.end = end;
    this.direction = _V.sub(end, start).normalize();  // direction parallel to mirror;
    this.normal = this.direction.copy().rotate(-HALF_PI);
    this.length = _V.dist(start, end);
    this.shadeDirection = this.direction.copy().rotate(3 * PI / 4);
  }

  intersectRay(ray) {
    // ray <-> line-segment collision
    const v1 = _V.sub(ray.origin, this.start);
    const v2 = _V.sub(this.end, this.start);
    const v3 = createVector(-ray.direction.y, ray.direction.x);
    const denom = _V.dot(v2, v3);
    if (denom == 0) return false;  // ray is parallel
    const t1 = _V.cross(v2, v1).z / denom;
    if (abs(t1) < 1e-5) return false;  // if origin is very close to line
    const t2 = _V.dot(v1, v3) / _V.dot(v2, v3);
    if (t2 < 0 || t2 > 1) return false;  // intersects outside the mirror
    return { t: t1, n: this.normal.copy() };
  }

  draw() {
    push();
    stroke(255);
    strokeWeight(3);
    line(this.start.x, this.start.y, this.end.x, this.end.y);

    // mirror shade
    strokeWeight(1);
    const step = 7;
    const shadeLength = 10;
    for (let d = step; d < this.length; d += step) {
      const p = _V.add(this.start, _V.mult(this.direction, d));
      const pe = _V.add(p, _V.mult(this.shadeDirection, shadeLength));
      line(p.x, p.y, pe.x, pe.y);
    }
    pop();
  }
}

class Ray {

  constructor(origin, direction, level = 0) {
    this.origin = origin;
    this.direction = direction.normalize();
    this.level = level;
    this.rayColor = color(247, 213, 74, 255 * max(0.1, 1 - 2 * level / MAX_RAY_LEVEL));
    this.resetEnd();
  }

  // (x, y) point in space
  // direction will be along origin -> (x, y)
  updateDirection(x, y) {
    const dir = createVector(x, y).sub(this.origin);
    this.direction = dir.normalize();
    this.resetEnd();
  }

  resetEnd(end) {
    this.end = _V.mult(this.direction, MAX_LENGTH).add(this.origin);
    this.updateArrowPos();
    this.next = null;
  }

  // update arrow position if end changes
  updateArrowPos() {
    const length = _V.sub(this.end, this.origin).mag();
    const arrowDist = length > 200 ? 100 : length / 2;
    this.arrowPos = _V.add(this.origin, _V.mult(this.direction, arrowDist));
  }

  cast(mirrors) {
    if (!mirrors.length) return;
    let t = MAX_LENGTH;
    let n;
    let canReflect = false;
    for (const m of mirrors) {
      const hit = m.intersectRay(this);
      // print(hit);
      if (hit) {
        if (hit.t > 0 && hit.t < t) {
          t = hit.t;
          n = hit.n;
          canReflect = _V.dot(n, this.direction) < 0;
        }
      }
    }
    this.end = _V.add(this.origin, _V.mult(this.direction, t));
    this.updateArrowPos();
    if (this.level >= MAX_RAY_LEVEL) {
      // check if ray level limit is reached
      print(`Ray level limit reached: ${MAX_RAY_LEVEL}`);
      return;
    }
    if (canReflect) {
      const r = _V.sub(this.direction, _V.mult(n, 2 * _V.dot(this.direction, n)));
      this.next = new Ray(this.end, r, this.level + 1);
      this.next.cast(mirrors);
    }
  }

  draw() {
    push();
    stroke(this.rayColor);
    strokeWeight(1);
    ellipse(this.origin.x, this.origin.y, 5, 5);
    line(this.origin.x, this.origin.y, this.end.x, this.end.y);
    // draw arrow
    push()
    const arrowSize = 4;
    translate(this.arrowPos.x, this.arrowPos.y);
    rotate(this.direction.heading() + PI / 2);
    fill(this.rayColor);
    noStroke();
    triangle(0, 0, -arrowSize, arrowSize * 2, arrowSize, arrowSize * 2)
    pop();
    pop();
    if (this.next) {
      this.next.draw();
    }
  }
}
