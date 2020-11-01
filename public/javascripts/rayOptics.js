const W = 1200 // width of bgCanvas
const H = 600 // height of bgCanvas
const Wsim = W * 0.69 - 20;
const Hsim = H - 15;
const Wplot = 0.25 * W
const Hplot = 0.875 * H
let bgCanvas, simCanvas, plotCanvas;

const _V = p5.Vector;
const MAX_LENGTH = 2000;
const MAX_RAY_LEVEL = 5;
const EPSILON = 1e-5;
let scene;
let beam;

function setup() {
  bgCanvas = createCanvas(W, H);
  bgCanvas.isMouseOver = true;
  //bgCanvas.parent("simwrapper");

  simCanvas = createGraphics(Wsim, Hsim)

  plotCanvas = createGraphics(Wplot, Hplot)
  plotCanvas.background(20)
  plotCanvas.stroke(255)
  plotCanvas.strokeWeight(3)
  plotCanvas.noFill()
  plotCanvas.rect(0, 0, Wplot, Hplot)

  const m1Concave = new SphericalMirror(
    createVector(350, 200),
    createVector(550, 250),
    createVector(350, 300),
    false, // is convex
  )
  const m2Convex = new SphericalMirror(
    createVector(100, 120),
    createVector(150, 250),
    createVector(100, 330),
    true, // is convex
  )
  beam = new Beam(createVector(250, 450), createVector(-1, -2), 10, 40);
  scene = new Scene(
    [
      // new Ray(createVector(300, 300), createVector(-13, 50)),
      // new Ray(createVector(550, 300), createVector(-100, -20)),
      // beam1,
      beam,
    ],
    [
      m1Concave,
      m2Convex,
      new Mirror(createVector(50, 500), createVector(550, 500)),
      new Mirror(createVector(550, 100), createVector(50, 100)),
      // new Mirror(createVector(100, 200), createVector(100, 400)),
      // new Mirror(createVector(350, 200), createVector(500, 400)),
    ],
    beam
  );
}

function draw() {
  background(20);
  stroke(255)
  strokeWeight(2)
  noFill()
  rect(10, 10, Wsim, Hsim)

  simCanvas.clear()
  scene.draw(simCanvas);
  scene.updateSampleRayDirection(0, mouseX, mouseY);
  image(simCanvas, 10, 10);
}

class Scene {

  constructor(rays, mirrors, beam) {
    this.rays = rays;
    this.mirrors = mirrors;
    rays.forEach(r => r.cast(mirrors));
    this.beam = beam;
    beam.scene = this;
  }

  // just for testing
  updateSampleRayDirection(index, x, y) {
    this.rays[index].updateDirection(x, y);
    this.rays[index].cast(this.mirrors);
  }

  draw(canvas) {
    this.mirrors.forEach(m => m.draw(canvas));
    this.rays.forEach(r => r.draw(canvas));
  }
}

class Mirror {

  constructor(start, end) {
    this.start = start;
    this.end = end;
    this.direction = _V.sub(end, start).normalize(); // direction parallel to mirror;
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
    if (denom == 0) return false; // ray is parallel
    const t1 = _V.cross(v2, v1).z / denom;
    if (abs(t1) < 1e-5) return false; // if origin is very close to line
    const t2 = _V.dot(v1, v3) / _V.dot(v2, v3);
    if (t2 < 0 || t2 > 1) return false; // intersects outside the mirror
    return {
      t: t1,
      n: this.normal.copy()
    };
  }

  draw(canvas) {
    canvas.push();
    canvas.stroke(255);
    canvas.strokeWeight(3);
    canvas.translate(this.start.x, this.start.y);
    canvas.rotate(this.direction.heading());
    canvas.line(0, 0, this.length, 0);

    // mirror shade
    canvas.strokeWeight(1);
    const step = 7;
    const shadeLength = 8;
    for (let d = step; d < this.length; d += step) {
      canvas.line(d, 0, d - step, shadeLength);
    }
    canvas.pop();
  }
}

// test whether a point lies on the right of a line
// line from v2 to v1
function isPointOnRight(v1, v2, p) {
  return _V.sub(v1, v2).cross(_V.sub(p, v2)).z > 0;
}

/**
 * Finds the circle equation from 3 points
 * returns the center and radius
 * [source]: https://www.geeksforgeeks.org/equation-of-circle-when-three-points-on-the-circle-are-given/
 */
function findCircle(x1, y1, x2, y2, x3, y3) {
  const x12 = x1 - x2;
  const x13 = x1 - x3;

  const y12 = y1 - y2;
  const y13 = y1 - y3;

  const y31 = y3 - y1;
  const y21 = y2 - y1;

  const x31 = x3 - x1;
  const x21 = x2 - x1;

  const sx13 = x1 * x1 - x3 * x3;
  const sy13 = y1 * y1 - y3 * y3;

  const sx21 = x2 * x2- x1 * x1;
  const sy21 = y2 * y2 - y1 * y1;

  const f = (sx13 * x12 + sy13 * x12 + sx21 * x13 + sy21 * x13) / (2 * (y31 * x12 - y21 * x13));

  const g = (sx13 * y12 + sy13 * y12 + sx21 * y13 + sy21 * y13) / (2 * (x31 * y12 - x21 * y13));

  const c = (- x1 * x1 - y1 * y1 - 2 * g * x1 - 2 * f * y1);

  return {
    center: createVector(-g, -f),
    radius: sqrt(g * g + f * f - c),
  }
}

class SphericalMirror {

  // p1, p2, p3 are position vectors of points on the circumference
  constructor(p1, p2, p3, isConvex = true) {
    this.reset(p1, p2, p3, isConvex);
  }

  reset(p1, p2, p3, isConvex) {
    this.isConvex = isConvex;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    if (isPointOnRight(p3, p1, p2)) {
      this.p1 = p3;
      this.p3 = p1;
    }
    const { center, radius } = findCircle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    if (!radius) {
      // radius is NaN => circle is invalid (3 points are in one line)
      this.isValid = false;
    } else {
      this.c = center;
      this.r = radius;
      this.isValid = true;
    }

    // arc angles
    const v1 = _V.sub(this.p1, this.c);
    const v3 = _V.sub(this.p3, this.c);
    this.arcStart = v1.heading();
    this.arcEnd = v3.heading();

    const a = v1.angleBetween(v3);
    this.arcAngle = a < 0 ? a + 2 * PI : a;
  }

  isPointOnArcSide(p) {
    return isPointOnRight(this.p1, this.p3, p);
  }

  /**
   * Ray - Arc intersection
   * @param {Ray} ray
   */
  intersectRay(ray) {
    if (!this.isValid) return false;
    const A = _V.sub(ray.origin, this.c);
    const modA = A.mag();
    const dA = _V.dot(ray.direction, A);
    const det = dA * dA - modA * modA + this.r * this.r;
    if (det < 0) {
      // clearly no intersection with the circle itself
      return false;
    }
    const sqrtDet = sqrt(det);
    const t1 = - dA - sqrtDet;
    const t2 = - dA + sqrtDet;
    if (t1 < 0 && t2 < 0) {
      // not in ray direction, quick check to avoid point calculation
      return false;
    }

    const p1 = ray.pointAt(t1);
    const p2 = ray.pointAt(t2);
    let t, p;
    // t1 is always less than t2, so check that first
    if (t1 > 0 && t1 > EPSILON && this.isPointOnArcSide(p1)) {
      t = t1;
      p = p1;
    } else if (t2 > 0 && t2 > EPSILON && this.isPointOnArcSide(p2)) {
      t = t2;
      p = p2;
    } else {
      // no valid intersection
      return false;
    }
    const n = _V.sub(p, this.c).normalize().mult(this.isConvex ? 1 : -1);
    return { t, n };
  }

  draw(canvas) {
    if (!this.isValid) return;
    canvas.push();
    canvas.stroke(255);
    canvas.strokeWeight(3);
    canvas.point(this.p1.x, this.p1.y);
    canvas.point(this.p2.x, this.p2.y);
    canvas.point(this.p3.x, this.p3.y);

    canvas.noFill();
    canvas.strokeWeight(3);
    // circle(this.c.x, this.c.y, 2 * this.r);
    let d = 2 * this.r;
    canvas.translate(this.c.x, this.c.y);
    canvas.arc(0, 0, d, d, this.arcStart, this.arcEnd);

    // back shade
    canvas.strokeWeight(1);
    canvas.rotate(this.arcStart);
    const R = this.r;
    const step = 8;
    const shadeLength = 8 * (this.isConvex ? -1 : 1);
    const angleStep = asin(step / R);
    let totalAngle = angleStep;
    while (totalAngle < this.arcAngle) {
      canvas.rotate(angleStep);
      canvas.line(R, 0, R + shadeLength, -step);
      totalAngle += angleStep;
    }
    canvas.pop();
  }

}

class Ray {

  constructor(origin, direction, level = 0) {
    this.origin = origin.copy();
    this.direction = direction.copy().normalize();
    this.level = level;
    this.rayColor = color(247, 213, 74, 255 * max(0.1, 1 - level / MAX_RAY_LEVEL));
    this.resetEnd();
  }

  updateOrigin(o) {
    this.origin = o;
    this.resetEnd();
  }

  // (x, y) point in space
  // direction will be along origin -> (x, y)
  updateDirection(x, y) {
    const dir = createVector(x, y).sub(this.origin);
    this.direction = dir.normalize();
    this.resetEnd();
  }

  resetEnd() {
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

  pointAt(t) {
    return _V.mult(this.direction, t).add(this.origin);
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

  draw(canvas, showSource = true) {
    canvas.push();
    canvas.stroke(this.rayColor);
    canvas.strokeWeight(1);
    if (showSource) {
      canvas.ellipse(this.origin.x, this.origin.y, 3, 3);
    }
    canvas.line(this.origin.x, this.origin.y, this.end.x, this.end.y);
    // draw arrow
    canvas.push()
    const arrowSize = 4;
    canvas.translate(this.arrowPos.x, this.arrowPos.y);
    canvas.rotate(this.direction.heading() + PI / 2);
    canvas.fill(this.rayColor);
    canvas.noStroke();
    canvas.triangle(0, 0, -arrowSize, arrowSize * 2, arrowSize, arrowSize * 2)
    canvas.pop();
    canvas.pop();
    if (this.next) {
      this.next.draw(canvas);
    }
  }
}

class Beam {

  constructor(origin, direction, numRays = 5, width = 25, rotateButton) {
    this.origin = origin.copy();
    this.direction = direction.copy().normalize();
    this.numRays = numRays;
    this.width = width;
    this.rays = [];
    this.initRays();
    this.rotateButton = undefined;
    this.translateButton = undefined;
  }

  updateDirection(x, y) {
    const dir = createVector(x, y).sub(this.origin);
    this.direction = dir.normalize();
    this.initRays();
  }

  initRays() {
    this.rays = [];
    this.normal = this.direction.copy().rotate(PI / 2);
    this.start = this.end = this.origin;
    if (this.width < 1 || this.numRays <= 0) return;
    if (this.numRays === 1) {
      // if only one ray, width does not matter
      this.rays.push(new Ray(this.origin, this.direction));
      return;
    }
    this.start = _V.mult(this.normal, - this.width / 2).add(this.origin);
    const posV = this.start.copy();
    const stepV = _V.mult(this.normal, this.width / (this.numRays - 1));
    for (let i = 0; i < this.numRays; ++i) {
      this.rays.push(new Ray(posV, this.direction));
      posV.add(stepV);
    }
    this.end = posV.copy().sub(stepV);
  }

  cast(mirrors) {
    this.rays.forEach(r => r.cast(mirrors));
  }

  draw(canvas) {
    canvas.push();
    canvas.stroke(0, 255, 0);
    canvas.strokeWeight(3);
    canvas.line(this.start.x, this.start.y, this.end.x, this.end.y);
    this.rays.forEach(r => r.draw(canvas, false));
    canvas.pop();
  }

  setOrigin(x, y){
    this.origin.x = x;
    this.origin.y = y;
    this.initRays();
    this.cast(this.scene.mirrors);
  }
}

const buttons = [];
class rotateBeamButton{
  constructor(canvas, beam) {
    this.x = -15;
    this.y = 0;
    this.r1 = 9;
    this.r2 = 12;
    this.fill = "lightgreen";
    this.color = "white";
    this.highlightFill = "olive";
    this.normalFill = "lightgreen";
    this.activeFill = "darkgreen";
    this.lineWidth = 1;
    this.edgeWidth = .8;
    this.canvas = canvas;
    this.ctx = (canvas.elt!=undefined)? canvas.elt.getContext("2d"): canvas.getContext("2d");
    this.beam = beam;
    beam.rotateButton = this;
    buttons.push(this);
  }
  draw() {
    const canvas = this.canvas;
    canvas.translate(this.beam.origin.x, this.beam.origin.y);
    canvas.rotate(this.beam.direction.heading()+PI/2);
    this.updateColor();
    this.drawBackground();
    this.drawInterior ();
    if (this.isMouseOver()){
      this.mouseIsOver = true;
    } else {
      this.mouseIsOver = false;
    }
    canvas.rotate(-this.beam.direction.heading()-PI/2);
    canvas.translate(-this.beam.origin.x, -this.beam.origin.y);
    canvas.elt.getContext("2d").beginPath();
  }
  isMouseOver(){
    let correc = pixelDensity(); //Correction factor
    const xyMouse = invertCoordinates((mouseX-10) * correc, (mouseY-10) * correc, this.canvas);
    const xyButton = [this.x, this.y];
    if ((xyMouse[0] - xyButton[0]) ** 2 + (xyMouse[1] - xyButton[1]) ** 2 <= this.r2 ** 2) {
      return true;
    } else {
      return false;
    };
  }
  updateColor(){
    if (this.isMouseOver()) {
      this.fill = this.highlightFill;
    } else {
      this.fill = this.normalFill;
      return;
    };
    if (mouseIsPressed){
      this.fill = this.activeFill;
    };
  }
  drawBackground() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.fillStyle = this.fill;
    ctx.lineWidth = this.contourWidth;
    ctx.arc(this.x, this.y, this.r2, 0, PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  drawInterior (){
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.r1 + this.x, this.y);
    ctx.arc(this.x, this.y, this.r1, 0, 1.5 * PI);
    ctx.moveTo(this.r1 + this.x - this.r1 / 5, this.y + this.r1 / 5);
    ctx.lineTo(this.r1 + this.x, this.y);
    ctx.lineTo(this.r1 + this.x + this.r1 / 5, this.y + this.r1 / 5);
    ctx.stroke();
  }
  handleMousePress(){
    this.beingDragged = true;
  }
  handleMouseDrag(){
    const dir = createVector(mouseX, mouseY).sub(this.beam.origin).rotate(PI/2);
    this.beam.direction = dir.normalize();
    this.beam.initRays();
    this.beam.cast(this.beam.scene.mirrors);
  }
  mouseReleased(){
    this.beingDragged = false;
  }
  updateCursor(){
    const canvas = document.getElementById("defaultCanvas0");
    if (canvas.elt.style.cursor != "auto"){return;};
    if (this.beingDragged){
      canvas.elt.style.cursor ="grabbing"
    } else if (this.mouseIsOver){
      canvas.elt.style.cursor = "grab";
    } else {
      canvas.elt.style.cursor = "auto";
    };
  }
}


class translateBeamButton{
  constructor(canvas, beam) {
    this.x = 15;
    this.y = 0;
    this.r1 = 9;
    this.r2 = 12;
    this.fill = "deepskyblue";
    this.color = "white";
    this.highlightFill = "cornflowerblue";
    this.normalFill = "deepskyblue";
    this.activeFill = "darkblue";
    this.lineWidth = 1.3;
    this.edgeWidth = .8;
    this.canvas = canvas;
    this.ctx = (canvas.elt!=undefined)? canvas.elt.getContext("2d"): canvas.getContext("2d");
    this.beam = beam;
    beam.translateButton = this;
    buttons.push(this);
  }
  draw() {
    const canvas = this.canvas;
    canvas.translate(this.beam.origin.x, this.beam.origin.y);
    canvas.rotate(this.beam.direction.heading()+PI/2);
    this.updateColor();
    this.drawBackground();
    this.drawInterior ();
    if (this.isMouseOver()){
      this.mouseIsOver = true;
    } else {
      this.mouseIsOver = false;
    }
    canvas.rotate(-this.beam.direction.heading()-PI/2);
    canvas.translate(-this.beam.origin.x, -this.beam.origin.y);
    canvas.elt.getContext("2d").beginPath();
  }
  isMouseOver(){
    let correc = pixelDensity(); //Correction factor
    const xyMouse = invertCoordinates((mouseX-10) * correc, (mouseY-10) * correc, this.canvas);
    const xyButton = [this.x, this.y];
    if ((xyMouse[0] - xyButton[0]) ** 2 + (xyMouse[1] - xyButton[1]) ** 2 <= this.r2 ** 2) {
      return true;
    } else {
      return false;
    };
  }
  updateColor(){
    if (this.isMouseOver()) {
      this.fill = this.highlightFill;
    } else {
      this.fill = this.normalFill;
      return;
    };
    if (mouseIsPressed){
      this.fill = this.activeFill;
    };
  }
  drawBackground() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.fillStyle = this.fill;
    ctx.lineWidth = this.contourWidth;
    ctx.arc(this.x, this.y, this.r2, 0, PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  drawInterior (){
    const ctx = this.ctx;
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.translate(this.x, this.y);
    const dh = this.r1 / 5;
    for (var i = 1; i <= 4; i++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(this.r1, 0);
      ctx.moveTo(this.r1, 0);
      ctx.lineTo(this.r1 - dh, -dh);
      ctx.moveTo(this.r1, 0);
      ctx.lineTo(this.r1 - dh, +dh);
      ctx.rotate(PI / 2);
    };
    ctx.translate(-this.x, -this.y);
    ctx.stroke();
  }
  handleMousePress(){
    this.initX = mouseX;
    this.initY = mouseY;
    this.initOriginX = this.beam.origin.x;
    this.initOriginY = this.beam.origin.y;
    this.beingDragged = true;
  }
  handleMouseDrag(){
    if (!this.beingDragged){return null;};
    let dx = mouseX - this.initX;
    let dy = mouseY - this.initY;
    this.beam.setOrigin(this.initOriginX + dx, this.initOriginY+dy);
  }
  mouseReleased(){
    this.beingDragged = false;
  }
  updateCursor(){
    const canvas = document.getElementById("defaultCanvas0");
    if (canvas.elt.style.cursor != "auto"){return;};
    if (this.beingDragged){
      canvas.elt.style.cursor ="grabbing"
    } else if (this.mouseIsOver){
      canvas.elt.style.cursor = "grab";
    } else {
      canvas.elt.style.cursor = "auto";
    };
  }
}


class addBeamButton{
  constructor(canvas, beam) {
    this.x = 15;
    this.y = 25;
    this.r1 = 9;
    this.r2 = 12;
    this.fill = "tomato";
    this.color = "white";
    this.highlightFill = "orangered";
    this.normalFill = "tomato";
    this.activeFill = "darkred";
    this.lineWidth = 1.3;
    this.edgeWidth = .8;
    this.canvas = canvas;
    this.ctx = (canvas.elt!=undefined)? canvas.elt.getContext("2d"): canvas.getContext("2d");
    this.beam = beam;
    beam.addButton = this;
    buttons.push(this);
  }
  draw() {
    const canvas = this.canvas;
    canvas.translate(this.beam.origin.x, this.beam.origin.y);
    canvas.rotate(this.beam.direction.heading()+PI/2);
    this.updateColor();
    this.drawBackground();
    this.drawInterior();
    if (this.isMouseOver()){
      this.mouseIsOver = true;
    } else {
      this.mouseIsOver = false;
    }
    canvas.rotate(-this.beam.direction.heading()-PI/2);
    canvas.translate(-this.beam.origin.x, -this.beam.origin.y);
    canvas.elt.getContext("2d").beginPath();
  }
  isMouseOver(){
    let correc = pixelDensity(); //Correction factor
    const xyMouse = invertCoordinates((mouseX-10) * correc, (mouseY-10) * correc, this.canvas);
    const xyButton = [this.x, this.y];
    if ((xyMouse[0] - xyButton[0]) ** 2 + (xyMouse[1] - xyButton[1]) ** 2 <= this.r2 ** 2) {
      return true;
    } else {
      return false;
    };
  }
  updateColor(){
    if (this.isMouseOver()) {
      this.fill = this.highlightFill;
    } else {
      this.fill = this.normalFill;
      return;
    };
    if (mouseIsPressed){
      this.fill = this.activeFill;
    };
  }
  drawBackground() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.fillStyle = this.fill;
    ctx.lineWidth = this.contourWidth;
    ctx.arc(this.x, this.y, this.r2, 0, PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  drawInterior (){
    const ctx = this.ctx;
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.translate(this.x, this.y);
    const dh = this.r1 / 5;
    for (var i = 1; i <= 4; i++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(this.r1, 0);
      ctx.rotate(PI / 2);
    };
    ctx.translate(-this.x, -this.y);
    ctx.stroke();
  }
  handleMousePress(){
    const beam = this.beam;
    beam.numRays++;
    beam.initRays();
    beam.cast(beam.scene.mirrors);
    this.beingDragged = true;
  }
  handleMouseDrag(){
    //Nothing specific;
    return;
  }
  mouseReleased(){
    this.beingDragged = false;
  }
  updateCursor(){
    const canvas = document.getElementById("defaultCanvas0");
    if (canvas.elt.style.cursor != "auto"){return;};
    if (this.beingDragged){
      canvas.elt.style.cursor ="pointer"
    } else if (this.mouseIsOver){
      canvas.elt.style.cursor = "pointer";
    } else {
      canvas.elt.style.cursor = "auto";
    };
  }
}

class subBeamButton{
  constructor(canvas, beam) {
    this.x = -15;
    this.y = 25;
    this.r1 = 9;
    this.r2 = 12;
    this.fill = "mediumorchid";
    this.color = "white";
    this.highlightFill = "purple";
    this.normalFill = "mediumorchid";
    this.activeFill = "indigo";
    this.lineWidth = 1.3;
    this.edgeWidth = .8;
    this.canvas = canvas;
    this.ctx = (canvas.elt!=undefined)? canvas.elt.getContext("2d"): canvas.getContext("2d");
    this.beam = beam;
    beam.subButton = this;
    buttons.push(this);
  }
  draw() {
    const canvas = this.canvas;
    canvas.translate(this.beam.origin.x, this.beam.origin.y);
    canvas.rotate(this.beam.direction.heading()+PI/2);
    this.updateColor();
    this.drawBackground();
    this.drawInterior();
    if (this.isMouseOver()){
      this.mouseIsOver = true;
    } else {
      this.mouseIsOver = false;
    }
    canvas.rotate(-this.beam.direction.heading()-PI/2);
    canvas.translate(-this.beam.origin.x, -this.beam.origin.y);
    canvas.elt.getContext("2d").beginPath();
  }
  isMouseOver(){
    let correc = pixelDensity(); //Correction factor
    const xyMouse = invertCoordinates((mouseX-10) * correc, (mouseY-10) * correc, this.canvas);
    const xyButton = [this.x, this.y];
    if ((xyMouse[0] - xyButton[0]) ** 2 + (xyMouse[1] - xyButton[1]) ** 2 <= this.r2 ** 2) {
      return true;
    } else {
      return false;
    };
  }
  updateColor(){
    if (this.isMouseOver()) {
      this.fill = this.highlightFill;
    } else {
      this.fill = this.normalFill;
      return;
    };
    if (mouseIsPressed){
      this.fill = this.activeFill;
    };
  }
  drawBackground() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.fillStyle = this.fill;
    ctx.lineWidth = this.contourWidth;
    ctx.arc(this.x, this.y, this.r2, 0, PI * 2);
    ctx.stroke();
    ctx.fill();
  }
  drawInterior (){
    const ctx = this.ctx;
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.color;
    ctx.beginPath();
    ctx.translate(this.x, this.y);
    const dh = this.r1 / 5;
    for (var i = 1; i <= 2; i++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(this.r1, 0);
      ctx.rotate(PI);
    };
    ctx.translate(-this.x, -this.y);
    ctx.stroke();
  }
  handleMousePress(){
    const beam = this.beam;
    const scene = this.beam.scene;
    if (beam.numRays>1){
      beam.numRays--;
    } else {return;};
    beam.initRays();
    beam.cast(scene.mirrors);
  }
  handleMouseDrag(){
    //Nothing specific;
    return;
  }
  mouseReleased(){
    this.beingDragged = false;
  }
  updateCursor(){
    const canvas = document.getElementById("defaultCanvas0");
    if (canvas.elt.style.cursor != "auto"){return;};
    if (this.beingDragged){
      canvas.elt.style.cursor ="pointer"
    } else if (this.mouseIsOver){
      canvas.elt.style.cursor = "pointer";
    } else {
      canvas.elt.style.cursor = "auto";
    };
  }
}

/*Now we can sense when the mouse is close enough. Now we need a funciton to draw the buttons*/
function setup() {
  bgCanvas = createCanvas(W, H);
  bgCanvas.isMouseOver = true;
  //bgCanvas.parent("simwrapper");

  simCanvas = createGraphics(Wsim, Hsim)

  plotCanvas = createGraphics(Wplot, Hplot)
  plotCanvas.background(20)
  plotCanvas.stroke(255)
  plotCanvas.strokeWeight(3)
  plotCanvas.noFill()
  plotCanvas.rect(0, 0, Wplot, Hplot)

  const m1Concave = new SphericalMirror(
    createVector(350, 200),
    createVector(550, 250),
    createVector(350, 300),
    false, // is convex
  )
  const m2Convex = new SphericalMirror(
    createVector(100, 120),
    createVector(150, 250),
    createVector(100, 330),
    true, // is convex
  )
  beam = new Beam(createVector(250, 450), createVector(-1, -2), 10, 40);
  scene = new Scene(
    [beam,],
    [m1Concave,m2Convex,
      new Mirror(createVector(50, 500), createVector(550, 500)),
      new Mirror(createVector(550, 100), createVector(50, 100)),
    ],
    beam
  );
  const rotateButton = new rotateBeamButton(
    simCanvas, beam
  );

  const translateButton = new translateBeamButton(
    simCanvas, beam
  );
  const addButton = new addBeamButton(
    simCanvas, beam
  );
  const subButton = new subBeamButton(
    simCanvas, beam
  ) //Buttons are automatically stored in an array
}


function invertCoordinates(x, y, canvas) {
  const ctx = canvas.elt.getContext("2d");
  const t = ctx.getTransform(); //transform
  const M = t.a * t.d - t.b * t.c; //Factor that shows up a lot
  const xnew = (x * t.d - y * t.c + t.c * t.f - t.d * t.e) / M;
  const ynew = (-x * t.b + y * t.a + t.b * t.e - t.a * t.f) / M;
  return [xnew, ynew];
};

//Now we override the original draw function to include the buttons
function draw() {
  background(20);
  stroke(255)
  strokeWeight(2)
  noFill()
  rect(10, 10, Wsim, Hsim)

  simCanvas.clear()
  scene.draw(simCanvas);
  //scene.updateSampleRayDirection(0, mouseX, mouseY);
  for (let button of buttons){
    button.draw();
  }
  image(simCanvas, 10, 10);
}

function mousePressed(){
  for (let button of buttons){
    if (button.mouseIsOver){
      button.handleMousePress();
      break;
    };
  };
};

function mouseDragged(){
  for (let button of buttons){
    if (button.beingDragged){
      button.handleMouseDrag();
      break;
    };
  };
}

function mouseReleased(){
  for (let button of buttons){
    button.mouseReleased();
  };
};
