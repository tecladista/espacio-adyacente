let nodes = [];
let paths = [];
let walkerPos;
let walkerTarget;
let trail = [];

// Elementos de audio
let osc, noiseGen, lpFilter;
let audioStarted = false;

function setup() {
  createCanvas(800, 600, WEBGL);
  
  walkerPos = createVector(0, 0, 0);
  walkerTarget = createVector(0, 0, 0);

  // Generación del entramado urbano situacionista (Nodos 3D)
  let numNodes = 82;
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      pos: createVector(random(-600, 600), random(-600, 600), random(-150, 150)),
      size: random(30, 80),
      h: random(20, 120)
    });
  }

  // Pasarelas del laberinto New Babylon
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let d = nodes[i].pos.dist(nodes[j].pos);
      if (d < 320) {
        paths.push({ start: nodes[i].pos, end: nodes[j].pos });
      }
    }
  }
}

function initSynth() {
  // Filtro Pasa-Bajos Resonante
  lpFilter = new p5.LowPass();

  // Generador de Ruido Rosa
  noiseGen = new p5.Noise('pink');
  noiseGen.disconnect();
  noiseGen.connect(lpFilter);
  noiseGen.start();
  noiseGen.amp(0);

  // Oscilador Sub-Drone (Sierra)
  osc = new p5.Oscillator('sawtooth');
  osc.disconnect();
  osc.connect(lpFilter);
  osc.start();
  osc.amp(0);
}

function mousePressed() {
  if (!audioStarted) {
    userStartAudio();
    initSynth();
    audioStarted = true;
  }
}

function draw() {
  background(242, 238, 226); // Tono plano conceptual / soporte de Constant

  // Mapeo del mouse al plano cartesiano 3D
  let targetX = map(mouseX, 0, width, -1500, 500);
  let targetY = map(mouseY, 0, height, -500, 500);
  walkerTarget.set(targetX, targetY, sin(frameCount * 0.02) * 40);

  // Deriva del caminante (Velocidad y desplazamiento continuo)
  let prevPos = walkerPos.copy();
  walkerPos.lerp(walkerTarget, 0.03);
  let speed = p5.Vector.dist(walkerPos, prevPos);

  // Guardar rastro psicogeográfico
  if (frameCount % 2 === 0) {
    trail.push(walkerPos.copy());
    if (trail.length > 90) trail.shift();
  }

  // --- MODULACIÓN SONORA (NOISE DRONE) ---
  if (audioStarted && lpFilter) {
    // La altura Z y la velocidad modulan la frecuencia del filtro
    let cutoff = map(walkerPos.z + speed * 15, -150, 300, 120, 3500, true);
    lpFilter.freq(cutoff);
    lpFilter.res(map(speed, 0, 15, 1, 10, true));

    // Pitch del tono grave según la posición Y
    let dronePitch = map(walkerPos.y, -500, 500, 110, 40, true);
    osc.freq(dronePitch);

    // Amplitudes moduladas por la deriva
    let masterAmp = map(speed, 0, 10, 0.1, 0.4, true);
    noiseGen.amp(masterAmp * 0.6, 0.05);
    osc.amp(masterAmp * 0.4, 0.05);
  }

  // --- CÁMARA Y PERSPECTIVA 3D ---
  let camDist = map(speed, 0, 15, 750, 1050, true);
  let camAngle = map(walkerPos.x, -500, 500, -PI / 4, PI / 4);
  let camTilt = map(speed, 0, 15, 0.35, 0.95, true);

  let camX = walkerPos.x + sin(camAngle) * camDist * cos(camTilt);
  let camY = walkerPos.y + sin(camTilt) * camDist + 200;
  let camZ = cos(camAngle) * camDist * cos(camTilt);

  camera(camX, camY, camZ, walkerPos.x, walkerPos.y, walkerPos.z, 0, 1, 0);

  // Luces de la estructura
  ambientLight(140);
  directionalLight(255, 255, 255, -1, 1, -1);
  pointLight(220, 30, 30, walkerPos.x, walkerPos.y, walkerPos.z + 80);

  // --- DIBUJAR ESPACIO CARTOGRÁFICO ---

  // 1. Red de Pasarelas / Conexiones
  strokeWeight(1.5);
  for (let p of paths) {
    let d = dist(walkerPos.x, walkerPos.y, (p.start.x + p.end.x) / 2, (p.start.y + p.end.y) / 2);
    if (d < 250) {
      stroke(210, 40, 40, 220);
    } else {
      stroke(80, 80, 80, 70);
    }
    line(p.start.x, p.start.y, p.start.z, p.end.x, p.end.y, p.end.z);
  }

  // 2. Volúmenes Habitables (Transformación 2D -> 3D)
  for (let n of nodes) {
    let d = p5.Vector.dist(walkerPos, n.pos);
    
    push();
    translate(n.pos.x, n.pos.y, n.pos.z);
    
    let extrusion = map(d, 0, 450, n.h, 2, true);
    
    if (d < 220) {
      fill(210, 40, 40, 180);
      stroke(30);
    } else {
      fill(220, 215, 200, 110);
      stroke(80, 80, 80, 90);
    }
    
    box(n.size, n.size, extrusion);
    pop();
  }

  // 3. Rastro Psicogeográfico (Línea de deriva)
  noFill();
  stroke(210, 30, 30, 200);
  strokeWeight(2);
  beginShape();
  for (let pt of trail) {
    vertex(pt.x, pt.y, pt.z + 3);
  }
  endShape();

  // 4. El Caminante y Pulsación Audiovisual
  push();
  translate(walkerPos.x, walkerPos.y, walkerPos.z + 12);
  
  noStroke();
  fill(20);
  sphere(10);

  // Halo reactivo al pulso sonoro
  noFill();
  stroke(220, 30, 30, 160 + sin(frameCount * 0.15) * 80);
  strokeWeight(1.5);
  ellipse(0, 0, 35 + speed * 3 + sin(frameCount * 0.1) * 10);
  pop();
}