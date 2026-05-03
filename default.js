// GeoFlyerJS — Endless Ship Mode
// p5play / CodeHS Abacus port of np8248/geoflyer (endless-mode branch)

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const T    = 40;           // tile size (px)
const W    = 960;
const H    = 540;
const GND  = T * 11;       // ground y = 440
const G    = GND / T;      // ground row index = 11

let SPEED     = 5.0;
let SHIP_UP   = -0.5;      // vy added per frame when holding
let SHIP_GRAV =  0.3;      // vy added per frame when releasing
let SHIP_MAX  =  7;        // terminal velocity (±)
let PSIZ      = 36;        // player hitbox size

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = 'start';       // 'start' | 'playing' | 'dead'
let camX  = 0;
let att   = 1;
let particles = [];
let highScore = 0;
let P;                     // player: { x, y, vy, rot, dead }

// ─── ASSETS ───────────────────────────────────────────────────────────────────
let gunshipImg;

// ─── LEVEL DATA ───────────────────────────────────────────────────────────────
const L = [];              // active level objects { t, x, y }
let genX = 20;             // next tile column to generate at

// ─── BACKGROUND DATA ──────────────────────────────────────────────────────────
const BG_TILE_W = 2600;
const bgRects = [];
(function () {
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      bgRects.push({
        x: c * 260 - 100 + (Math.random() - 0.5) * 80,
        y: r * (GND / 3)  + (Math.random() - 0.5) * 30,
        w: 140 + Math.random() * 180,
        h:  70 + Math.random() * 110
      });
    }
  }
})();

const stars = [];
for (let i = 0; i < 50; i++) {
  stars.push({
    x:  Math.random() * 20000,
    y:  Math.random() * (GND - 30) + 10,
    sz: Math.random() * 2.5 + 0.8,
    br: Math.random() * 0.5 + 0.3
  });
}

// ─── COLOR ZONES ──────────────────────────────────────────────────────────────
const zones = [
  { bg: '#0a0e3a', bgR: '#101878', gnd: '#04061a', gl: '#4488ff' },
  { bg: '#7a0040', bgR: '#a00058', gnd: '#1a0008', gl: '#ff4090' },
  { bg: '#2a0060', bgR: '#3c0090', gnd: '#0a0018', gl: '#aa66ff' },
  { bg: '#3a0000', bgR: '#580000', gnd: '#0a0000', gl: '#ff2020' },
  { bg: '#3a0040', bgR: '#580068', gnd: '#140018', gl: '#e040fb' }
];
function getZone(px) { return zones[Math.floor(px / 3000) % zones.length]; }

// ─── P5 LIFECYCLE ─────────────────────────────────────────────────────────────
function preload() {
  gunshipImg = loadImage('Gunship.png');
}

function setup() {
  new Canvas(W, H);
  world.gravity.y = 0;
  frameRate(60);
  textFont('Arial');
  resetPlayer();
}

function draw() {
  clear();
  drawBG();
  drawObjects();

  if (state === 'playing') {
    updateGame();
    if (!P.dead) drawShip();
    drawParticles();
    drawHUD();
  } else if (state === 'start') {
    drawScreen('GEOFLYER', 'Endless Ship Mode', 'Click or press Space to fly',
               'Hold to fly up  •  Release to fall', color(255), color(180, 220, 255));
  } else if (state === 'dead') {
    drawParticles();
    const dist = Math.floor(camX / T);
    drawScreen('YOU CRASHED!',
               'Distance: ' + dist + 'm  |  Best: ' + highScore + 'm',
               'Click or press Space to retry', '',
               color(255, 60, 60), color(255));
  }

  // Start / restart on input
  if (state === 'start' && (kb.presses('space') || mouse.presses())) {
    startGame();
  }
  if (state === 'dead' && (kb.presses('space') || mouse.presses())) {
    att++;
    startGame();
  }
}

// ─── GAME CONTROL ─────────────────────────────────────────────────────────────
function resetPlayer() {
  P = { x: 120, y: GND / 2 - PSIZ / 2, vy: 0, rot: 0, dead: false };
}

function startGame() {
  state = 'playing';
  camX = 0;
  particles = [];
  L.length = 0;
  genX = 20;
  resetPlayer();
  generateAhead();
}

function kill() {
  if (P.dead) return;
  P.dead = true;
  state = 'dead';
  const dist = Math.floor(camX / T);
  if (dist > highScore) highScore = dist;
  for (let i = 0; i < 16; i++) {
    const cols = ['#0f0', '#0af', '#ff0'];
    particles.push({
      x: P.x + PSIZ / 2,  y: P.y + PSIZ / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 4,
      sz: Math.random() * 8 + 3,
      life: 1.0,
      col: cols[Math.floor(Math.random() * 3)]
    });
  }
}

// ─── PHYSICS & COLLISION ──────────────────────────────────────────────────────
function isHolding() {
  return kb.pressing('space') || kb.pressing('up') || mouse.pressing();
}

// Shrunk hitbox rect for the player
function pr() { return { x: P.x + 2, y: P.y + 2, w: PSIZ - 4, h: PSIZ - 4 }; }

// AABB overlap
function ov(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateGame() {
  if (P.dead) return;

  camX += SPEED;

  // Ship vertical physics
  P.vy += isHolding() ? SHIP_UP : SHIP_GRAV;
  P.vy = constrain(P.vy, -SHIP_MAX, SHIP_MAX);
  P.y  += P.vy;

  // Boundary clamp
  if (P.y < 0)             { P.y = 0;           P.vy = 0; }
  if (P.y + PSIZ > GND)    { P.y = GND - PSIZ;  P.vy = 0; }

  // Visual rotation follows vertical velocity
  P.rot = P.vy * 2;

  // Narrow collision window
  const pR  = pr();
  const wX  = pR.x + camX;
  const stx = Math.floor((wX - T * 2) / T);
  const etx = Math.floor((wX + pR.w + T * 2) / T);

  for (const obj of L) {
    if (obj.x < stx || obj.x > etx) continue;
    const ox = obj.x * T - camX;
    const oy = obj.y * T;

    switch (obj.t) {
      case 'B': {
        const bR = { x: ox, y: oy, w: T, h: T };
        const p  = pr();
        if (!ov(p, bR)) break;
        const oL = (p.x + p.w) - bR.x,  oR = (bR.x + bR.w) - p.x;
        const oT = (p.y + p.h) - bR.y,  oB = (bR.y + bR.h) - p.y;
        const mn = Math.min(oL, oR, oT, oB);
        if      (mn === oL || mn === oR)            { kill(); return; }
        else if (mn === oT && P.vy >= 0) { P.y = oy - PSIZ;  P.vy = 0; }
        else if (mn === oB && P.vy <= 0) { P.y = oy + T;     P.vy = 0; }
        else                                        { kill(); return; }
        break;
      }
      case 'S':
        if (ov(pr(), { x: ox+8,  y: oy+10,    w: T-16, h: T-10 })) { kill(); return; }
        break;
      case 'CS':
        if (ov(pr(), { x: ox+8,  y: oy,       w: T-16, h: T-10 })) { kill(); return; }
        break;
      case 'HG':
        if (ov(pr(), { x: ox+6,  y: oy+T,     w: T-12, h: T    })) { kill(); return; }
        break;
      case 'FR':
        if (ov(pr(), { x: ox+6,  y: oy+T-18,  w: T-12, h: 18   })) { kill(); return; }
        break;
    }
  }

  generateAhead();
  cleanupBehind();
}

// ─── PROCEDURAL LEVEL GENERATOR ───────────────────────────────────────────────
function diff()           { return Math.min(1, camX / 40000); }
function rng()            { return Math.random(); }
function rngInt(mn, mx)   { return mn + Math.floor(rng() * (mx - mn + 1)); }
function pick(arr)        { return arr[Math.floor(rng() * arr.length)]; }
function gapSz()          { const d = diff(); return rngInt(Math.max(2, Math.floor(4 - d*2)), Math.max(3, Math.floor(6 - d*3))); }
function ao(t, tx, ty)    { L.push({ t, x: tx, y: ty }); }

const patterns = [
  function floorSpikes() {
    const n = rngInt(2, 3 + Math.floor(diff() * 4));
    for (let i = 0; i < n; i++) ao('S', genX+i, G-1);
    return n + gapSz();
  },
  function ceilSpikes() {
    const n = rngInt(2, 3 + Math.floor(diff() * 4));
    for (let i = 0; i < n; i++) ao('CS', genX+i, 0);
    return n + gapSz();
  },
  function spikeSandwich() {
    const n = rngInt(2, 3 + Math.floor(diff() * 4));
    for (let i = 0; i < n; i++) { ao('S', genX+i, G-1); ao('CS', genX+i, 0); }
    return n + gapSz();
  },
  function floorWall() {
    const h = rngInt(2, 3 + Math.floor(diff() * 3));
    for (let i = 0; i < 2; i++) for (let j = 0; j < h; j++) ao('B', genX+i, G-1-j);
    return 2 + gapSz();
  },
  function ceilWall() {
    const h = rngInt(2, 3 + Math.floor(diff() * 3));
    for (let i = 0; i < 2; i++) for (let j = 0; j < h; j++) ao('B', genX+i, j);
    return 2 + gapSz();
  },
  function corridor() {
    const w    = rngInt(3, 4);
    const maxH = Math.floor((G - 3) / 2);
    const h    = rngInt(2, Math.min(maxH, 2 + Math.floor(diff() * 2)));
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) { ao('B', genX+i, j); ao('B', genX+i, G-1-j); }
    }
    return w + gapSz();
  },
  function altWalls() {
    const h = rngInt(3, 4 + Math.floor(diff() * 2));
    const g = rngInt(4, 6);
    for (let i = 0; i < 2; i++) for (let j = 0; j < h; j++) ao('B', genX+i, G-1-j);
    for (let i = 0; i < 2; i++) for (let j = 0; j < h; j++) ao('B', genX+g+i, j);
    return g + 2 + gapSz();
  },
  function hangingSpikes() {
    const n  = rngInt(2, 3 + Math.floor(diff() * 2));
    const sp = rngInt(2, 3);
    for (let i = 0; i < n; i++) ao('HG', genX + i*sp, 0);
    for (let i = 0; i < n * sp; i++) ao('FR', genX+i, G-1);
    return n * sp + rngInt(3, 5);
  },
  function fireRow() {
    const n = rngInt(4, 6 + Math.floor(diff() * 3));
    for (let i = 0; i < n; i++) ao('FR', genX+i, G-1);
    return n + gapSz();
  },
  function floatingBlocks() {
    const row = rngInt(3, G - 4);
    const w   = rngInt(2, 3 + Math.floor(diff() * 2));
    for (let i = 0; i < w; i++) { ao('B', genX+i, row); ao('S', genX+i, row-1); }
    return w + gapSz();
  },
  function zigzagBlocks() {
    if (diff() < 0.15) return 0;
    const count = rngInt(3, 4 + Math.floor(diff() * 2));
    let ox = 0;
    for (let i = 0; i < count; i++) {
      const row = i % 2 === 0 ? rngInt(2, 4) : rngInt(G-5, G-3);
      ao('B', genX+ox, row); ao('B', genX+ox+1, row);
      ao('S', genX+ox, row-1); ao('S', genX+ox+1, row-1);
      ox += rngInt(3, 4);
    }
    return ox + gapSz();
  },
  function midCorridor() {
    const w      = rngInt(3, 5 + Math.floor(diff() * 2));
    const midRow = rngInt(4, G - 5);
    for (let i = 0; i < w; i++) {
      ao('B', genX+i, midRow); ao('B', genX+i, midRow+1);
      if (midRow > 1)       ao('S',  genX+i, midRow-1);
      if (midRow+2 < G-1)   ao('CS', genX+i, midRow+2);
    }
    return w + gapSz();
  }
];

function generateAhead() {
  const ahead = Math.floor((camX + W + T * 10) / T);
  let safety = 0;
  while (genX < ahead && safety < 50) {
    safety++;
    const used = pick(patterns)();
    genX += used > 0 ? used : Math.max(3, gapSz());
  }
}

function cleanupBehind() {
  const behind = Math.floor((camX - T * 5) / T);
  while (L.length > 0 && L[0].x < behind) L.shift();
}

// ─── RENDERING ────────────────────────────────────────────────────────────────
function drawBG() {
  const z = getZone(camX);

  // Sky
  noStroke();
  fill(z.bg);
  rect(0, 0, W, GND);

  // Parallax background rects
  const pOff = (camX * 0.15) % BG_TILE_W;
  fill(z.bgR);
  for (const r of bgRects) {
    let rx = r.x - pOff;
    if (rx + r.w < 0)  rx += BG_TILE_W;
    if (rx > W)        rx -= BG_TILE_W;
    if (rx + r.w < -50 || rx > W + 50) continue;
    rect(rx, r.y, r.w, r.h);
  }

  // Stars
  for (const s of stars) {
    let sx = ((s.x - camX * 0.08) % (W + 80));
    if (sx < 0) sx += W + 80;
    const a = (s.br + Math.sin(millis() * 0.002 + s.x) * 0.12) * 255;
    fill(255, 255, 200, max(0, a));
    noStroke();
    rect(sx, s.y, s.sz, s.sz);
  }

  // Underground fill
  fill(z.gnd);
  rect(0, GND, W, H - GND);

  // Ground line
  stroke(z.gl);
  strokeWeight(2);
  line(0, GND, W, GND);
  noStroke();
}

function drawBlock(bx, by) {
  fill(17);
  noStroke();
  rect(bx, by, T, T);
  stroke(255, 255, 255, 46);
  strokeWeight(0.7);
  for (let i = T / 4; i < T; i += T / 4) {
    line(bx+i, by, bx+i, by+T);
    line(bx, by+i, bx+T, by+i);
  }
  noFill();
  stroke(255);
  strokeWeight(1.5);
  rect(bx + 0.5, by + 0.5, T - 1, T - 1);
  noStroke();
}

function drawSpike(bx, by) {
  fill(255);
  noStroke();
  triangle(bx+T/2, by+2,    bx+T-3, by+T,   bx+3,   by+T);
  fill(220);
  triangle(bx+T/2, by+10,   bx+T-9, by+T-2, bx+9,   by+T-2);
}

function drawCSpike(bx, by) {
  fill(255);
  noStroke();
  triangle(bx+T/2, by+T-2,  bx+T-3, by,     bx+3,   by);
  fill(220);
  triangle(bx+T/2, by+T-10, bx+T-9, by+2,   bx+9,   by+2);
}

function drawHang(bx, by) {
  // Chains
  stroke(255, 214, 0);
  strokeWeight(2.5);
  noFill();
  for (let i = 0; i < 3; i++) ellipse(bx+T/2, by + i*13 + 5, 10, 14);

  // Spike body
  const dy = by + 38;
  noStroke();
  fill(34);
  rect(bx+4,  dy,       T-8,  T-10);
  fill(255);
  rect(bx+8,  dy+3,     T-16, T-16);
  fill(34);
  triangle(bx+4,    dy+T-10, bx+T-4, dy+T-10, bx+T/2, dy+T+12);
  fill(255);
  triangle(bx+10,   dy+T-10, bx+T-10, dy+T-10, bx+T/2, dy+T+5);
}

function drawFire(bx, by) {
  const t = millis() * 0.005;
  noStroke();
  for (let i = 0; i < 4; i++) {
    const fx = bx + 3 + i*10 + Math.sin(t + i*1.8) * 3;
    const fh = 14  + Math.sin(t*1.5  + i) * 6;
    fill(i % 2 === 0 ? color('#ffd600') : color('#ff6f00'));
    triangle(fx, by+T, fx+5, by+T, fx+2.5, by+T-fh);
  }
}

function drawObjects() {
  const vL = camX - T*2, vR = camX + W + T*2;
  for (const o of L) {
    const wx = o.x * T;
    if (wx < vL || wx > vR) continue;
    const ox = wx - camX, oy = o.y * T;
    switch (o.t) {
      case 'B':  drawBlock(ox, oy);  break;
      case 'S':  drawSpike(ox, oy);  break;
      case 'CS': drawCSpike(ox, oy); break;
      case 'HG': drawHang(ox, oy);   break;
      case 'FR': drawFire(ox, oy);   break;
    }
  }
}

function drawShip() {
  const cx = P.x + PSIZ / 2;
  const cy = P.y + PSIZ / 2;
  push();
  translate(cx, cy);
  rotate(P.rot * PI / 180);

  // Thrust trail
  noStroke();
  fill(0, 255, 100, 100);
  rect(-PSIZ/2 - 18, -4, 20, 8);
  fill(0, 255, 100, 51);
  rect(-PSIZ/2 - 36, -3, 20, 6);

  if (gunshipImg) {
    imageMode(CENTER);
    image(gunshipImg, 0, 0, PSIZ, PSIZ);
  } else {
    // Fallback drawn ship
    noStroke();
    fill('#00e676');
    beginShape();
      vertex( PSIZ/2,        0);
      vertex(-PSIZ/2,       -PSIZ/2);
      vertex(-PSIZ/2 + 6,    0);
      vertex(-PSIZ/2,        PSIZ/2);
    endShape(CLOSE);
    fill('#69f0ae');
    beginShape();
      vertex( PSIZ/2 - 8,    0);
      vertex(-PSIZ/2 + 8,   -PSIZ/2 + 8);
      vertex(-PSIZ/2 + 12,   0);
      vertex(-PSIZ/2 + 8,    PSIZ/2 - 8);
    endShape(CLOSE);
    stroke('#1b5e20');
    strokeWeight(2);
    noFill();
    beginShape();
      vertex( PSIZ/2,        0);
      vertex(-PSIZ/2,       -PSIZ/2);
      vertex(-PSIZ/2 + 6,    0);
      vertex(-PSIZ/2,        PSIZ/2);
    endShape(CLOSE);
    // Cockpit
    noStroke();
    fill(255);
    rect(-2, -5, 10, 8);
    fill(0);
    rect(2, -3, 5, 5);
  }
  pop();
}

function drawParticles() {
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life -= 0.02;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const c = color(p.col);
    c.setAlpha(p.life * 255);
    fill(c);
    rect(p.x - p.sz/2, p.y - p.sz/2, p.sz, p.sz);
  }
}

function drawHUD() {
  const dist = Math.floor(camX / T);
  noStroke();
  textSize(18);
  textAlign(LEFT, TOP);
  fill(0, 255, 0);
  text(dist + 'm', 12, 10);
  fill(255, 255, 0);
  textSize(12);
  text('Best: ' + highScore + 'm', 12, 32);
  textAlign(LEFT, BASELINE);
}

function drawScreen(title, sub, prompt, hint, titleCol, subCol) {
  fill(0, 0, 0, 160);
  noStroke();
  rect(0, 0, W, H);
  textAlign(CENTER, CENTER);
  fill(titleCol);
  textSize(48);
  text(title, W/2, H/2 - 60);
  fill(subCol);
  textSize(20);
  text(sub, W/2, H/2 - 5);
  fill(200);
  textSize(16);
  text(prompt, W/2, H/2 + 40);
  if (hint) {
    fill(150);
    textSize(13);
    text(hint, W/2, H/2 + 68);
  }
  textAlign(LEFT, BASELINE);
}
