const W = 1200 // width of bgCanvas
const H = 600 // height of bgCanvas
const Wsim = W * 0.69 - 20;
const Hsim = H - 15;
const Wplot = 0.25 * W
const Hplot = 0.875 * H
const CANVAS_OFFSET = 10;
let bgCanvas, simCanvas, plotCanvas;

const _V = p5.Vector;
const MAX_LENGTH = 2000;
const MAX_RAY_LEVEL = 5;
const EPSILON = 1e-5;
const SHOW_RAY_SOURCES = false;  // to show ray reflection points
const SHOW_BOUNDS = false;
let scene;

function setup() {
  bgCanvas = createCanvas(W, H)
  bgCanvas.parent("simwrapper");

  simCanvas = createGraphics(Wsim, Hsim)

  plotCanvas = createGraphics(Wplot, Hplot)
  plotCanvas.background(20)
  plotCanvas.stroke(255)
  plotCanvas.strokeWeight(3)
  plotCanvas.noFill()
  plotCanvas.rect(0, 0, Wplot, Hplot)

  const m1Concave = new SphericalMirror(
    'concave1',
    createVector(350, 200),
    createVector(550, 250),
    createVector(350, 300),
    false, // is convex
  )
  const m2Convex = new SphericalMirror(
    'convex1',
    createVector(100, 120),
    createVector(150, 250),
    createVector(100, 330),
    true, // is convex
  )
  scene = new Scene(
    [
      // new Ray(createVector(300, 300), createVector(-13, 50)),
      new Ray('ray1', createVector(450, 270), createVector(-100, -20)),
      new Beam('beam1', createVector(250, 450), createVector(-1, -2), 10, 40),
    ],
    [
      m1Concave,
      m2Convex,
      new PlaneMirror('pm1', createVector(50, 500), createVector(550, 500)),
      new PlaneMirror('pm2', createVector(550, 100), createVector(50, 100)),
    ]
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
  // scene.updateSampleRayDirection(0, mouseX, mouseY);
  // scene.translateSampleRay(0, random(-5, 5),  random(-5, 5));
  image(simCanvas, CANVAS_OFFSET, CANVAS_OFFSET);
  // mouseClicked();
}

// Mouse interactions ------------
function mouseClicked() {
  scene.handleClick();
}

function mousePressed() {
  scene.handleMousePress();
}

function mouseDragged() {
  scene.handleMouseDrag();
}

function mouseReleased() {
  scene.handleMouseRelease();
}

// Custom methods and classes ---------

// test whether a point lies on the right of a line
// line from v2 to v1
function isPointOnRight(v1, v2, p) {
  return _V.sub(v1, v2).cross(_V.sub(p, v2)).z > 0;
}

function invertCoordinates(x, y, canvas) {
  x = x * pixelDensity();
  y = y * pixelDensity();
  const ctx = canvas.elt.getContext("2d");
  const t = ctx.getTransform();  // transform
  const M = t.a * t.d - t.b * t.c;  // Factor that shows up a lot
  const x_t = (x * t.d - y * t.c + t.c * t.f - t.d * t.e) / M;
  const y_t = (-x * t.b + y * t.a + t.b * t.e - t.a * t.f) / M;
  return [x_t, y_t];
}

/**
 * Scene class contains every entity in the simulation like rays, mirrors, etc.
 *
 * Any methods which update entity position/rotation,
 * must call `cast` method on rays and pass mirrors as arguments
 */
class Scene {

  constructor(rays, mirrors) {
    this.rays = rays;
    this.mirrors = mirrors;
    this.entities = [...rays, ...mirrors];
    this.buttonGroup = new ButtonGroup();
    this.buttonGroupActive = false;
    this.update();
  }

  get mousePos() {
    return [mouseX - CANVAS_OFFSET, mouseY - CANVAS_OFFSET];
  }

  get mousePosVec() {
    return createVector(...this.mousePos);
  }

  handleClick() {
    if (this.buttonGroupActive) {
      // button group is active, do nothing
      return;
    }
    const [x, y] = this.mousePos;
    let selected = null;
    // TODO: optimize looping
    this.entities.forEach(e => {
      if (e.isPointInside(x, y)) {
        selected = e;
      }
    })
    this.buttonGroup.setEntity(selected);
  }

  handleMousePress() {
    this.buttonGroupActive = this.buttonGroup.isActive;
    if (this.buttonGroupActive) {
      this.buttonGroup.handleMousePress();
    }
  }

  handleMouseDrag() {
    if (this.buttonGroupActive) {
      this.buttonGroup.handleMouseDrag();
    }
  }

  handleMouseRelease() {
    if (this.buttonGroupActive) {
      this.buttonGroup.handleMouseRelease();
    }
  }

  /**
   * casts all rays onto scene mirrors
   * *important* This must be called if any of the mirrors are updated
   */
  update = () => {
    this.rays.forEach(r => r.cast(this.mirrors));
  }

  draw(canvas) {
    this.mirrors.forEach(m => m.draw(canvas));
    this.rays.forEach(r => r.draw(canvas));
    this.buttonGroup.draw(canvas);
  }
}

class ButtonGroup {

  constructor() {
    this.width = 100;
    this.height = 40;
    this.setEntity(null);
    this.isActive = false;
    this.translateButton = new TranslateButton(this.translateEntity);
    this.rotateButton = new RotateButton(this.rotateEntity);
  }

  setEntity(entity) {
    this.entity = entity;
  }

  translateEntity = (dx, dy) => {
    this.entity.translate(dx, dy);
    scene.update();
  }

  rotateEntity = (da) => {
    this.entity.rotate(da);
    scene.update();
  }

  isMouseOver() {
    if (!this.entity) return false;
    const [mx, my] = scene.mousePos;
    const location = this.entity.buttonLocation;
    const [x, y] = [mx - location.x, my - location.y];
    return (x > 0 && x < this.width && y > 0 && y < this.height);
  }

  handleMousePress() {
    this.translateButton.handleMousePress();
    this.rotateButton.handleMousePress(this.entity.centerLocation);
  }

  handleMouseDrag() {
    this.translateButton.handleMouseDrag();
    this.rotateButton.handleMouseDrag(this.entity.centerLocation);
  }

  handleMouseRelease() {
    this.translateButton.handleMouseRelease();
    this.rotateButton.handleMouseRelease();
  }

  draw(canvas) {
    this.isActive = false;
    if (!this.entity) return;
    canvas.push();
    canvas.noFill();
    canvas.strokeWeight(1);
    canvas.stroke(255);
    const location = this.entity.buttonLocation;
    canvas.translate(location.x, location.y);
    canvas.rect(0, 0, this.width, this.height);

    this.isActive = this.isMouseOver();

    canvas.translate(this.height / 2, this.height / 2);
    this.translateButton.draw(canvas);
    canvas.translate(this.height, 0);
    this.rotateButton.draw(canvas);
    canvas.pop();
  }
}

class Button {

  constructor() {
    this.r1 = 10;
    this.r2 = 15;
    this.lineWidth = 2;
    this.edgeWidth = 0.8;
    this.fill = 'white';
  }

  isMouseOver(canvas) {
    const mousePos = invertCoordinates(...scene.mousePos, canvas);
    return mag(mousePos[0], mousePos[1]) < this.r2;
  }

  updateColor() {
    if (this.mouseIsOver) {
      this.fill = mouseIsPressed ? this.activeFill : this.highlightFill;
    } else {
      this.fill = this.normalFill;
    }
  }

  handleMousePress() {
    if (!this.mouseIsOver) return;
    this.lastPos = scene.mousePos;
    this.beingDragged = true;
  }

  handleMouseRelease() {
    this.beingDragged = false;
  }

  drawBackground(canvas) {
    canvas.push();
    canvas.fill(this.fill);
    canvas.noStroke();
    canvas.circle(0, 0, this.r2 * 2);
    canvas.pop();
  }

  drawArrow(canvas, length, size) {
    canvas.push();
    canvas.line(0, 0, length, 0);
    canvas.translate(length, 0);
    canvas.line(-size, -size, 0, 0);
    canvas.line(-size, size, 0, 0);
    canvas.pop();
  }

  draw(canvas) {
    canvas.push();
    this.mouseIsOver = this.isMouseOver(canvas);
    this.updateColor();
    this.drawBackground(canvas);
    this.drawInterior(canvas);
    canvas.pop();
  }
}

class TranslateButton extends Button {

  constructor(translateEntity) {
    super();
    this.translateEntity = translateEntity;
    this.fill = 'deepskyblue';
    this.highlightFill = 'cornflowerblue';
    this.normalFill = 'deepskyblue';
    this.activeFill = 'darkblue';
    this.color = 'white';
  }

  handleMouseDrag() {
    if (!this.beingDragged) return;
    const currPos = scene.mousePos;
    const [dx, dy] = [currPos[0] - this.lastPos[0], currPos[1] - this.lastPos[1]];
    this.lastPos = currPos;
    this.translateEntity(dx, dy);
  }

  drawInterior(canvas) {
    canvas.push();
    canvas.strokeWeight(this.lineWidth);
    canvas.stroke(this.color);
    for (let i = 0; i < 4; ++i) {
      this.drawArrow(canvas, this.r1, 2);
      canvas.rotate(PI / 2);
    }
    canvas.pop();
  }
}

class RotateButton extends Button {

  constructor(rotateEntity) {
    super();
    this.lineWidth = 2.5;
    this.r1 = 8;
    this.rotateEntity = rotateEntity;
    this.color = 'white';
    this.highlightFill = 'olive';
    this.normalFill = 'green';
    this.activeFill = 'darkgreen';
  }

  handleMousePress(center) {
    super.handleMousePress();
    this.lastDir = _V.sub(scene.mousePosVec, center);
  }

  handleMouseDrag(center) {
    if (!this.beingDragged) return;
    const currDir = _V.sub(scene.mousePosVec, center);
    const da = currDir.angleBetween(this.lastDir);
    this.lastDir = currDir;
    this.rotateEntity(-da);
  }

  drawInterior(canvas) {
    canvas.push();
    canvas.strokeWeight(this.lineWidth);
    canvas.stroke(this.color);
    const d = this.r1 * 2;
    const a = PI * 1.5;
    canvas.arc(0, 0, d, d, 0, a);
    canvas.rotate(a);
    canvas.translate(this.r1, 0);
    canvas.rotate(PI * 0.4);
    this.drawArrow(canvas, 0, 2);
    canvas.pop();
  }
}

class SelectableEntity {

  constructor(name) {
    this.name = name;
  }

  get buttonLocation() {
    console.error('Button location getter not implemented');
  }

  // is the mouse click on (x, y) inside the entity
  isPointInside(x, y) {
    console.error('Bound check method not implemented');
  }

  drawBounds(canvas) {
    console.error('Bound draw not implemented');
  }

  draw(canvas) {
    console.error('Draw method not implemented');
  }
}

class Mirror extends SelectableEntity {

  constructor(name) {
    super(name);
  }

  intersectRay(ray) {
    console.error('Ray intersection not implemented');
  }
}

class PlaneMirror extends Mirror {

  constructor(name, start, end) {
    super(name);
    this.start = start.copy();
    this.end = end.copy();
    this.reset();
  }

  reset() {
    this.direction = _V.sub(this.end, this.start).normalize(); // direction parallel to mirror;
    this.normal = this.direction.copy().rotate(-HALF_PI);
    this.length = _V.dist(this.start, this.end);
    this.shadeDirection = this.direction.copy().rotate(3 * PI / 4);
    this.center = _V.add(this.start, _V.mult(this.direction, this.length / 2));
    this.initBoundingBox();
  }

  initBoundingBox() {
    const offset = 10;
    const A = _V.add(this.start, _V.mult(this.direction, -offset)).add(_V.mult(this.normal, -offset));
    const B = _V.add(A, _V.mult(this.normal, offset * 2));
    const C = _V.add(B, _V.mult(this.direction, offset * 2 + this.length));
    const D = _V.add(C, _V.mult(this.normal, -offset * 2));
    this.boundingBox = [A, B, C, D];
  }

  isPointInside(x, y) {
    const p = createVector(x, y);
    const [A, B, C, D] = this.boundingBox;
    return isPointOnRight(B, A, p) && isPointOnRight(C, B, p)
      && isPointOnRight(D, C, p) && isPointOnRight(A, D, p);
  }

  get buttonLocation() {
    return this.boundingBox[0];
  }

  get centerLocation() {
    return this.center;
  }

  translate(dx, dy) {
    const step = createVector(dx, dy);
    this.start.add(step);
    this.end.add(step);
    this.reset();
  }

  rotate(da) {
    this.direction.rotate(da);
    this.start = _V.add(this.center, _V.mult(this.direction, -this.length / 2));
    this.end = _V.add(this.start, _V.mult(this.direction, this.length));
    this.reset();
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

  drawBounds(canvas) {
    canvas.push();
    const [A, B, C, D] = this.boundingBox;
    canvas.noFill();
    canvas.stroke(255);
    canvas.beginShape();
    canvas.vertex(A.x, A.y);
    canvas.vertex(B.x, B.y);
    canvas.vertex(C.x, C.y);
    canvas.vertex(D.x, D.y);
    canvas.endShape(CLOSE);
    canvas.pop();
  }

  draw(canvas) {
    canvas.push();
    SHOW_BOUNDS && this.drawBounds(canvas);

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

class SphericalMirror extends Mirror {

  // p1, p2, p3 are position vectors of points on the circumference
  constructor(name, p1, p2, p3, isConvex = true) {
    super(name);
    this.boundOffset = 10;
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
    this.resetArcAngles();
  }

  resetArcAngles() {
    const v1 = _V.sub(this.p1, this.c);
    const v3 = _V.sub(this.p3, this.c);
    this.arcStart = v1.heading();
    this.arcEnd = v3.heading();

    const a = v1.angleBetween(v3);
    this.arcAngle = a < 0 ? a + 2 * PI : a;
  }

  get buttonLocation() {
    return this.p3;
    // use location below, to keep buttonGroup at bottom
    // return _V.add(this.c, createVector(0, this.r));
  }

  get centerLocation() {
    return this.c;
  }

  translate(dx, dy) {
    if (!this.isValid) return;
    const step = createVector(dx, dy);
    this.p1.add(step);
    this.p2.add(step);
    this.p3.add(step);
    this.c.add(step);
  }

  rotatePointByCenter(p, angle) {
    p.sub(this.c).rotate(angle).add(this.c);
  }

  rotate(da) {
    if (!this.isValid) return;
    this.rotatePointByCenter(this.p1, da);
    this.rotatePointByCenter(this.p2, da);
    this.rotatePointByCenter(this.p3, da);
    this.resetArcAngles();
  }

  isPointInside(x, y) {
    const p = createVector(x, y);
    if (!this.isPointOnArcSide(p)) {
      return false;
    }
    const d = _V.dist(p, this.c);
    return abs(d - this.r) < this.boundOffset;
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

  drawBounds(canvas) {
    const offset = this.boundOffset * 2;
    const d = this.r * 2;
    const d1 = max(d - offset, 1);
    const d2 = d + offset;
    canvas.push();
    canvas.strokeWeight(1);
    canvas.arc(0, 0, d1, d1, this.arcStart, this.arcEnd);
    canvas.arc(0, 0, d2, d2, this.arcStart, this.arcEnd);
    canvas.pop();
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

    let d = 2 * this.r;
    canvas.translate(this.c.x, this.c.y);

    SHOW_BOUNDS && this.drawBounds(canvas);

    // main arc
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

class Ray extends SelectableEntity {

  constructor(name, origin, direction, level = 0, sourceName = null) {
    super(name);
    this.origin = origin.copy();
    this.direction = direction.copy().normalize();
    this.level = level;
    this.sourceName = sourceName || name;
    this.rayColor = color(247, 213, 74, 255 * max(0.1, 1 - level / MAX_RAY_LEVEL));
    this.boundsOffset = 15;
    this.reset();
  }

  updateOrigin(o) {
    this.origin = o;
    this.reset();
  }

  // (x, y) point in space
  // direction will be along origin -> (x, y)
  updateDirection(x, y) {
    const dir = createVector(x, y).sub(this.origin);
    this.direction = dir.normalize();
    this.reset();
  }

  translate(dx, dy) {
    this.origin.add(createVector(dx, dy));
    this.reset();
  }

  reset() {
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
      // print(`Ray level limit reached: ${MAX_RAY_LEVEL}`);
      return;
    }
    if (canReflect) {
      const r = _V.sub(this.direction, _V.mult(n, 2 * _V.dot(this.direction, n)));
      const nextName = `${this.sourceName}_${this.level + 1}`;
      this.next = new Ray(nextName, this.end, r, this.level + 1, this.sourceName);
      this.next.cast(mirrors);
    }
  }

  get buttonLocation() {
    return this.origin;
  }

  isPointInside(x, y) {
    return createVector(x, y).sub(this.origin).mag() < this.boundsOffset;
  }

  drawBounds(canvas) {
    canvas.push();
    canvas.strokeWeight(1);
    canvas.noFill();
    canvas.circle(this.origin.x, this.origin.y, this.boundsOffset);
    canvas.pop();
  }

  draw(canvas) {
    canvas.push();
    canvas.stroke(this.rayColor);
    canvas.strokeWeight(1);
    if (this.level === 0) {
      // source ray
      canvas.ellipse(this.origin.x, this.origin.y, 5, 5);
      SHOW_BOUNDS && this.drawBounds(canvas);
    } else {
      // reflected ray
      SHOW_RAY_SOURCES && canvas.ellipse(this.origin.x, this.origin.y, 3, 3);
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

class Beam extends SelectableEntity {

  constructor(name, origin, direction, numRays = 5, width = 25) {
    super(name);
    this.origin = origin.copy();
    this.direction = direction.copy().normalize();
    this.numRays = numRays;
    this.width = width;
    this.rays = [];
    this.reset();
  }

  reset() {
    this.initRays();
    this.initBoundingBox();
  }

  initBoundingBox() {
    const offset = 7;
    const n = this.direction.copy().rotate(-PI / 2);
    const A = _V.add(this.origin, _V.mult(this.direction, -offset)).add(_V.mult(n, -offset - this.width/2));
    const B = _V.add(A, _V.mult(n, this.width + offset * 2));
    const C = _V.add(B, _V.mult(this.direction, offset * 2));
    const D = _V.add(C, _V.mult(n, -this.width -offset * 2));
    this.boundingBox = [A, B, C, D];
  }

  updateDirection(x, y) {
    const dir = createVector(x, y).sub(this.origin);
    this.direction = dir.normalize();
    this.reset();
  }

  translate(dx, dy) {
    this.origin.add(createVector(dx, dy));
    this.reset();
  }

  initRays() {
    this.rays = [];
    this.normal = this.direction.copy().rotate(PI / 2);
    this.start = this.end = this.origin;
    if (this.width < 1 || this.numRays <= 0) return;
    if (this.numRays === 1) {
      // if only one ray, width does not matter
      this.rays.push(new Ray(`${name}_ray1`, this.origin, this.direction));
      return;
    }
    this.start = _V.mult(this.normal, - this.width / 2).add(this.origin);
    const posV = this.start.copy();
    const stepV = _V.mult(this.normal, this.width / (this.numRays - 1));
    for (let i = 0; i < this.numRays; ++i) {
      this.rays.push(new Ray(`${name}_ray${i + 1}`, posV, this.direction, 1));
      posV.add(stepV);
    }
    this.end = posV.copy().sub(stepV);
  }

  cast(mirrors) {
    this.rays.forEach(r => r.cast(mirrors));
  }

  get buttonLocation() {
    return this.boundingBox[0];
  }

  isPointInside(x, y) {
    const p = createVector(x, y);
    const [A, B, C, D] = this.boundingBox;
    return isPointOnRight(B, A, p) && isPointOnRight(C, B, p)
      && isPointOnRight(D, C, p) && isPointOnRight(A, D, p);
  }

  drawBounds(canvas) {
    canvas.push();
    const [A, B, C, D] = this.boundingBox;
    canvas.noFill();
    canvas.stroke(255);
    canvas.beginShape();
    canvas.vertex(A.x, A.y);
    canvas.vertex(B.x, B.y);
    canvas.vertex(C.x, C.y);
    canvas.vertex(D.x, D.y);
    canvas.endShape(CLOSE);
    canvas.pop();
  }

  draw(canvas) {
    canvas.push();
    SHOW_BOUNDS && this.drawBounds(canvas);
    canvas.stroke(0, 255, 0);
    canvas.strokeWeight(3);
    canvas.line(this.start.x, this.start.y, this.end.x, this.end.y);
    this.rays.forEach(r => r.draw(canvas, false));
    canvas.pop();
  }
}