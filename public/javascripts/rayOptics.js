let W = 1200  // width of bgCanvas
let H = 500  // height of bgCanvas
let Wsim = W * 0.69
let Hsim = H
let Wplot = 0.25 * W
let Hplot = 0.875 * H
let bgCanvas, simCanvas, plotCanvas;

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
}

 function draw(){
  // border of simCanvas
  simCanvas.clear()
  simCanvas.stroke(255)
  simCanvas.strokeWeight(2)
  simCanvas.noFill()
  simCanvas.rect(10, 10, Wsim - 20, Hsim - 20)

  // sim canvas
  image(simCanvas, 0, 0);
  ellipse(50,50,80,80);
}
