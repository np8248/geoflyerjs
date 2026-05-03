// GeoFlyerJS — Endless Ship Mode
// Standalone canvas port of np8248/geoflyer (endless-mode branch)

const C = document.getElementById('game');
const X = C.getContext('2d');
const W = 960, H = 540;

// ─── RESIZE ───────────────────────────────────────────────────────────────────
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  C.width = W; C.height = H;
  C.style.width  = (W * s) + 'px';
  C.style.height = (H * s) + 'px';
}
resize();
addEventListener('resize', resize);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const T   = 40;
const GND = T * 11;   // 440 — ground y
const G   = GND / T;  // 11  — ground tile row

let SPEED     = 5.0;
let SHIP_UP   = -0.5;
let SHIP_GRAV =  0.3;
let SHIP_MAX  =  7;
let PSIZ      = 36;

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = 'start';
let camX  = 0;
let att   = 1;
let particles = [];
let highScore = 0;
let P;  // { x, y, vy, rot, dead }

// ─── INPUT ────────────────────────────────────────────────────────────────────
let inputDown = false;

document.addEventListener('keydown', e => {
  if (['Space','ArrowUp'].includes(e.code) || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    inputDown = true;
    onInput();
  }
  if (e.key === 'r' || e.key === 'R') forceRestart();
});
document.addEventListener('keyup', e => {
  if (['Space','ArrowUp'].includes(e.code) || e.key === 'w' || e.key === 'W') {
    inputDown = false;
  }
});
C.addEventListener('mousedown',  () => { inputDown = true;  onInput(); });
C.addEventListener('mouseup',    () => { inputDown = false; });
C.addEventListener('touchstart', e => { e.preventDefault(); inputDown = true;  onInput(); }, { passive: false });
C.addEventListener('touchend',   e => { e.preventDefault(); inputDown = false; }, { passive: false });

function onInput() {
  if (state === 'start')             { startGame(); }
  else if (state === 'dead')         { att++; startGame(); }
}

function forceRestart() {
  att++;
  startGame();
}

// ─── GAME CONTROL ─────────────────────────────────────────────────────────────
function resetPlayer() {
  P = { x: 120, y: GND / 2 - PSIZ / 2, vy: 0, rot: 0, dead: false };
}

function startGame() {
  state = 'playing';
  camX  = 0;
  particles = [];
  L.length  = 0;
  genX      = 20;
  resetPlayer();
  generateAhead();
}

function kill() {
  if (P.dead) return;
  P.dead = true;
  state  = 'dead';
  const dist = Math.floor(camX / T);
  if (dist > highScore) highScore = dist;
  for (let i = 0; i < 16; i++) {
    particles.push({
      x: P.x + PSIZ / 2, y: P.y + PSIZ / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 4,
      sz: Math.random() * 8 + 3,
      life: 1.0,
      col: ['#0f0', '#0af', '#ff0'][Math.floor(Math.random() * 3)]
    });
  }
}

// ─── PHYSICS & COLLISION ──────────────────────────────────────────────────────
function pr() { return { x: P.x + 2, y: P.y + 2, w: PSIZ - 4, h: PSIZ - 4 }; }
function ov(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (state !== 'playing' || P.dead) return;

  camX += SPEED;

  // Ship vertical physics
  P.vy += inputDown ? SHIP_UP : SHIP_GRAV;
  P.vy  = Math.max(-SHIP_MAX, Math.min(SHIP_MAX, P.vy));
  P.y  += P.vy;

  if (P.y < 0)          { P.y = 0;          P.vy = 0; }
  if (P.y + PSIZ > GND) { P.y = GND - PSIZ; P.vy = 0; }

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
        if      (mn === oL || mn === oR)           { kill(); return; }
        else if (mn === oT && P.vy >= 0) { P.y = oy - PSIZ; P.vy = 0; }
        else if (mn === oB && P.vy <= 0) { P.y = oy + T;    P.vy = 0; }
        else                                       { kill(); return; }
        break;
      }
      case 'S':
        if (ov(pr(), { x: ox+8,  y: oy+10,   w: T-16, h: T-10 })) { kill(); return; }
        break;
      case 'CS':
        if (ov(pr(), { x: ox+8,  y: oy,      w: T-16, h: T-10 })) { kill(); return; }
        break;
      case 'HG':
        if (ov(pr(), { x: ox+6,  y: oy+T,    w: T-12, h: T    })) { kill(); return; }
        break;
      case 'FR':
        if (ov(pr(), { x: ox+6,  y: oy+T-18, w: T-12, h: 18   })) { kill(); return; }
        break;
    }
  }

  generateAhead();
  cleanupBehind();
}

// ─── LEVEL DATA & GENERATOR ───────────────────────────────────────────────────
const L = [];
let genX = 20;

function diff()          { return Math.min(1, camX / 40000); }
function rng()           { return Math.random(); }
function rngInt(mn, mx)  { return mn + Math.floor(rng() * (mx - mn + 1)); }
function pick(arr)       { return arr[Math.floor(rng() * arr.length)]; }
function gapSz()         { const d = diff(); return rngInt(Math.max(2, Math.floor(4 - d*2)), Math.max(3, Math.floor(6 - d*3))); }
function ao(t, tx, ty)   { L.push({ t, x: tx, y: ty }); }

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
    for (let i = 0; i < 2; i++) for (let j = 0; j < h; j++) ao('B', genX+i,   G-1-j);
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
      if (midRow > 1)     ao('S',  genX+i, midRow-1);
      if (midRow+2 < G-1) ao('CS', genX+i, midRow+2);
    }
    return w + gapSz();
  },
  function doubleAlt() {
    if (diff() < 0.3) return 0;
    const h = rngInt(3, 5);
    const g = rngInt(4, 5);
    for (let rep = 0; rep < 2; rep++) {
      const ox        = rep * (g + 2);
      const fromFloor = rep % 2 === 0;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < h; j++)
          ao('B', genX + ox + i, fromFloor ? G-1-j : j);
    }
    return 2 * (g + 2) + gapSz();
  }
];

function generateAhead() {
  const ahead  = Math.floor((camX + W + T * 10) / T);
  let   safety = 0;
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

// ─── COLOR ZONES ──────────────────────────────────────────────────────────────
const zones = [
  { bg: '#0a0e3a', bgR: '#101878', gnd: '#04061a', gl: '#4488ff', sk: '#fff', skIn: '#ddd', skB: '#aaa' },
  { bg: '#7a0040', bgR: '#a00058', gnd: '#1a0008', gl: '#ff4090', sk: '#fff', skIn: '#ddd', skB: '#aaa' },
  { bg: '#2a0060', bgR: '#3c0090', gnd: '#0a0018', gl: '#aa66ff', sk: '#fff', skIn: '#ddd', skB: '#aaa' },
  { bg: '#3a0000', bgR: '#580000', gnd: '#0a0000', gl: '#ff2020', sk: '#fff', skIn: '#ddd', skB: '#aaa' },
  { bg: '#3a0040', bgR: '#580068', gnd: '#140018', gl: '#e040fb', sk: '#fff', skIn: '#ddd', skB: '#aaa' }
];
function getZone(px) { return zones[Math.floor(px / 3000) % zones.length]; }

// ─── BACKGROUND ───────────────────────────────────────────────────────────────
const BG_TILE_W = 2600;
const bgRects   = [];
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

function drawBG() {
  const z    = getZone(camX);
  const pOff = (camX * 0.15) % BG_TILE_W;

  // Sky
  X.fillStyle = z.bg;
  X.fillRect(0, 0, W, GND);

  // Parallax rects
  X.fillStyle = z.bgR;
  for (const r of bgRects) {
    let rx = r.x - pOff;
    if (rx + r.w < 0) rx += BG_TILE_W;
    if (rx > W)       rx -= BG_TILE_W;
    if (rx + r.w < -50 || rx > W + 50) continue;
    X.fillRect(rx, r.y, r.w, r.h);
  }

  // Stars
  for (const s of stars) {
    let sx = ((s.x - camX * 0.08) % (W + 80));
    if (sx < 0) sx += W + 80;
    const a = s.br + Math.sin(Date.now() * 0.002 + s.x) * 0.12;
    X.fillStyle = `rgba(255,255,200,${Math.max(0, a)})`;
    X.fillRect(sx, s.y, s.sz, s.sz);
  }

  // Underground
  X.fillStyle = z.gnd;
  X.fillRect(0, GND, W, H - GND);

  // Ground line
  X.strokeStyle = z.gl;
  X.lineWidth   = 2;
  X.beginPath(); X.moveTo(0, GND); X.lineTo(W, GND); X.stroke();
}

// ─── DRAW OBJECTS ─────────────────────────────────────────────────────────────
function drawBlock(bx, by) {
  X.fillStyle = '#111';
  X.fillRect(bx, by, T, T);
  X.strokeStyle = 'rgba(255,255,255,0.18)'; X.lineWidth = 0.7;
  for (let i = T/4; i < T; i += T/4) {
    X.beginPath(); X.moveTo(bx+i, by); X.lineTo(bx+i, by+T); X.stroke();
    X.beginPath(); X.moveTo(bx, by+i); X.lineTo(bx+T, by+i); X.stroke();
  }
  X.strokeStyle = '#fff'; X.lineWidth = 1.5;
  X.strokeRect(bx+0.5, by+0.5, T-1, T-1);
}

function drawSpike(bx, by, z) {
  X.fillStyle = z.sk;
  X.beginPath(); X.moveTo(bx+T/2, by+2); X.lineTo(bx+T-3, by+T); X.lineTo(bx+3, by+T); X.closePath(); X.fill();
  X.fillStyle = z.skIn;
  X.beginPath(); X.moveTo(bx+T/2, by+10); X.lineTo(bx+T-9, by+T-2); X.lineTo(bx+9, by+T-2); X.closePath(); X.fill();
  X.strokeStyle = z.skB; X.lineWidth = 1.5;
  X.beginPath(); X.moveTo(bx+T/2, by+2); X.lineTo(bx+T-3, by+T); X.lineTo(bx+3, by+T); X.closePath(); X.stroke();
}

function drawCSpike(bx, by, z) {
  X.fillStyle = z.sk;
  X.beginPath(); X.moveTo(bx+T/2, by+T-2); X.lineTo(bx+T-3, by); X.lineTo(bx+3, by); X.closePath(); X.fill();
  X.fillStyle = z.skIn;
  X.beginPath(); X.moveTo(bx+T/2, by+T-10); X.lineTo(bx+T-9, by+2); X.lineTo(bx+9, by+2); X.closePath(); X.fill();
  X.strokeStyle = z.skB; X.lineWidth = 1.5;
  X.beginPath(); X.moveTo(bx+T/2, by+T-2); X.lineTo(bx+T-3, by); X.lineTo(bx+3, by); X.closePath(); X.stroke();
}

function drawHang(bx, by) {
  X.strokeStyle = '#ffd600'; X.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    X.beginPath(); X.ellipse(bx+T/2, by+i*13+5, 5, 7, 0, 0, Math.PI*2); X.stroke();
  }
  const dy = by + 38;
  X.fillStyle = '#222'; X.fillRect(bx+4, dy, T-8, T-10);
  X.fillStyle = '#fff'; X.fillRect(bx+8, dy+3, T-16, T-16);
  X.fillStyle = '#222';
  X.beginPath(); X.moveTo(bx+4, dy+T-10); X.lineTo(bx+T-4, dy+T-10); X.lineTo(bx+T/2, dy+T+12); X.closePath(); X.fill();
  X.fillStyle = '#fff';
  X.beginPath(); X.moveTo(bx+10, dy+T-10); X.lineTo(bx+T-10, dy+T-10); X.lineTo(bx+T/2, dy+T+5); X.closePath(); X.fill();
}

function drawFire(bx, by) {
  const t = Date.now() * 0.005;
  for (let i = 0; i < 4; i++) {
    const fx = bx + 3 + i*10 + Math.sin(t + i*1.8) * 3;
    const fh = 14 + Math.sin(t*1.5 + i) * 6;
    X.fillStyle = i % 2 === 0 ? '#ffd600' : '#ff6f00';
    X.globalAlpha = 0.85;
    X.beginPath(); X.moveTo(fx, by+T); X.lineTo(fx+5, by+T); X.lineTo(fx+2.5, by+T-fh); X.closePath(); X.fill();
  }
  X.globalAlpha = 1;
}

function drawObjects() {
  const vL = camX - T*2, vR = camX + W + T*2;
  for (const o of L) {
    const wx = o.x * T;
    if (wx < vL || wx > vR) continue;
    const ox = wx - camX, oy = o.y * T;
    const z  = getZone(wx);
    switch (o.t) {
      case 'B':  drawBlock(ox, oy);     break;
      case 'S':  drawSpike(ox, oy, z);  break;
      case 'CS': drawCSpike(ox, oy, z); break;
      case 'HG': drawHang(ox, oy);      break;
      case 'FR': drawFire(ox, oy);      break;
    }
  }
}

// ─── DRAW PLAYER ──────────────────────────────────────────────────────────────
function drawPlayer() {
  if (P.dead) return;
  const cx = P.x + PSIZ / 2, cy = P.y + PSIZ / 2;
  X.save();
  X.translate(cx, cy);
  X.rotate(P.rot * Math.PI / 180);

  // Thrust trail
  X.globalAlpha = 0.4; X.fillStyle = '#0f0';
  X.fillRect(-PSIZ/2 - 18, -4, 20, 8);
  X.globalAlpha = 0.2;
  X.fillRect(-PSIZ/2 - 36, -3, 20, 6);
  X.globalAlpha = 1;

  // Ship body
  X.fillStyle = '#00e676';
  X.beginPath();
  X.moveTo( PSIZ/2,        0);
  X.lineTo(-PSIZ/2,       -PSIZ/2);
  X.lineTo(-PSIZ/2 + 6,    0);
  X.lineTo(-PSIZ/2,        PSIZ/2);
  X.closePath(); X.fill();

  X.fillStyle = '#69f0ae';
  X.beginPath();
  X.moveTo( PSIZ/2 - 8,    0);
  X.lineTo(-PSIZ/2 + 8,   -PSIZ/2 + 8);
  X.lineTo(-PSIZ/2 + 12,   0);
  X.lineTo(-PSIZ/2 + 8,    PSIZ/2 - 8);
  X.closePath(); X.fill();

  X.strokeStyle = '#1b5e20'; X.lineWidth = 2;
  X.beginPath();
  X.moveTo( PSIZ/2,        0);
  X.lineTo(-PSIZ/2,       -PSIZ/2);
  X.lineTo(-PSIZ/2 + 6,    0);
  X.lineTo(-PSIZ/2,        PSIZ/2);
  X.closePath(); X.stroke();

  // Cockpit
  X.fillStyle = '#fff'; X.fillRect(-2, -5, 10, 8);
  X.fillStyle = '#000'; X.fillRect( 2, -3,  5, 5);
  X.restore();
}

// ─── DRAW PARTICLES ───────────────────────────────────────────────────────────
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.02;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    X.globalAlpha = p.life;
    X.fillStyle   = p.col;
    X.fillRect(p.x - p.sz/2, p.y - p.sz/2, p.sz, p.sz);
  }
  X.globalAlpha = 1;
}

// ─── HUD & SCREENS ────────────────────────────────────────────────────────────
function drawHUD() {
  const dist = Math.floor(camX / T);
  X.fillStyle = '#0f0'; X.font = 'bold 18px Arial'; X.textAlign = 'left';
  X.fillText(dist + 'm', 12, 28);
  X.fillStyle = '#ff0'; X.font = '12px Arial';
  X.fillText('Best: ' + highScore + 'm', 12, 46);
  X.fillStyle = '#adf'; X.font = '11px Arial';
  X.fillText('Attempt ' + att, 12, 60);
}

function drawStartScreen() {
  X.fillStyle = 'rgba(0,0,0,0.7)'; X.fillRect(0, 0, W, H);
  X.textAlign = 'center';
  X.fillStyle = '#fff'; X.font = 'bold 52px Arial';
  X.shadowColor = '#0af'; X.shadowBlur = 30;
  X.fillText('GEOFLYER', W/2, H/2 - 60);
  X.shadowBlur = 0;
  X.fillStyle = '#8af'; X.font = '22px Arial';
  X.fillText('Endless Ship Mode', W/2, H/2 - 8);
  X.fillStyle = '#ccc'; X.font = '16px Arial';
  X.fillText('Click or press Space to fly', W/2, H/2 + 40);
  X.fillStyle = '#8af'; X.font = '13px Arial';
  X.fillText('Hold to fly up  •  Release to fall  •  R = restart', W/2, H/2 + 68);
  X.textAlign = 'left';
}

function drawDeathScreen() {
  const dist = Math.floor(camX / T);
  X.fillStyle = 'rgba(0,0,0,0.72)'; X.fillRect(0, 0, W, H);
  X.textAlign = 'center';
  X.fillStyle = '#f44'; X.font = 'bold 40px Arial';
  X.shadowColor = '#f00'; X.shadowBlur = 20;
  X.fillText('YOU CRASHED!', W/2, H/2 - 40);
  X.shadowBlur = 0;
  X.fillStyle = '#fff'; X.font = '18px Arial';
  X.fillText('Distance: ' + dist + 'm  |  Best: ' + highScore + 'm', W/2, H/2 + 10);
  X.fillStyle = '#aaa'; X.font = '14px Arial';
  X.fillText('Click or press Space to retry', W/2, H/2 + 50);
  X.textAlign = 'left';
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
function loop() {
  X.clearRect(0, 0, W, H);
  drawBG();
  drawObjects();
  update();
  drawPlayer();
  drawParticles();

  if      (state === 'start') drawStartScreen();
  else if (state === 'dead')  drawDeathScreen();
  else if (state === 'playing') drawHUD();

  requestAnimationFrame(loop);
}

loop();
