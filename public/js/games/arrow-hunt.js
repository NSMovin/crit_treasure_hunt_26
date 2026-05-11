// ─────────────────────────────────────────────────────────────────────────────
// games/arrow-hunt.js
// Arrow Hunt mini-game — container-scoped module for Treasure Hunt Live.
// ─────────────────────────────────────────────────────────────────────────────

export function run(task, container, onComplete) {

  // ── Google Fonts (once per session) ────────────────────────────────────────
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600&display=swap';
    document.head.appendChild(link);
  }

  // ── Config ──────────────────────────────────────────────────────────────────
  const CONFIG = {
    target_rotation_speed:    1.8,
    arrow_count:              10,
    speed_increase_per_arrow: 0.18,
    collision_tolerance:      12,
    reverse_at_arrow:         5,
    scoring: { base_per_arrow: 10, bonus_at_5: 25, bonus_at_10: 75 },
    ...(task.config || {})
  };

  // ── Container setup ─────────────────────────────────────────────────────────
  container.style.position   = 'relative';
  container.style.overflow   = 'hidden';
  container.style.minHeight  = '460px';
  container.style.cursor     = 'crosshair';
  container.style.userSelect = 'none';

  // ── DOM ─────────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="ah-wrap">
      <div class="ah-bg-glow"></div>

      <div class="ah-corner ah-corner--tl"></div>
      <div class="ah-corner ah-corner--tr"></div>
      <div class="ah-corner ah-corner--bl"></div>
      <div class="ah-corner ah-corner--br"></div>

      <div id="ah-flash"></div>

      <div class="ah-ui-top">
        <div class="ah-stat-block">
          <span class="ah-stat-label">Score</span>
          <span class="ah-stat-value" id="ah-score-display">0</span>
        </div>
        <div class="ah-stat-block" style="align-items:flex-end">
          <span class="ah-stat-label" style="text-align:right">Arrows</span>
          <div class="ah-arrows-left" id="ah-arrows-pip"></div>
        </div>
      </div>

      <canvas id="ah-canvas"></canvas>

      <div class="ah-hud-bottom">
        <div id="ah-hint-text">Click to throw</div>
      </div>

      <div class="ah-screen" id="ah-start-screen">
        <div class="ah-screen-title">Arrow Hunt</div>
        <div class="ah-screen-sub">Stick the arrows — don't overlap</div>
        <button class="ah-btn" id="ah-begin-btn">Begin Hunt</button>
      </div>

      <div class="ah-screen ah-hidden" id="ah-gameover-screen">
        <div class="ah-screen-title">Shattered</div>
        <div class="ah-screen-sub">Arrow collision detected</div>
        <div class="ah-screen-score" id="ah-final-score">0</div>
        <div class="ah-screen-score-label">points scored</div>
        <button class="ah-btn" id="ah-try-again-btn">Try Again</button>
      </div>

      <div class="ah-screen ah-hidden" id="ah-win-screen">
        <div class="ah-screen-title">Masterful</div>
        <div class="ah-screen-sub">All arrows placed perfectly</div>
        <div class="ah-screen-score" id="ah-win-score">0</div>
        <div class="ah-screen-score-label">points scored</div>
      </div>
    </div>
  `;

  // ── Element refs ────────────────────────────────────────────────────────────
  const canvas        = container.querySelector('#ah-canvas');
  const ctx           = canvas.getContext('2d');
  const scoreEl       = container.querySelector('#ah-score-display');
  const pipsEl        = container.querySelector('#ah-arrows-pip');
  const hintEl        = container.querySelector('#ah-hint-text');
  const flashEl       = container.querySelector('#ah-flash');
  const startScreen   = container.querySelector('#ah-start-screen');
  const gameOverScreen= container.querySelector('#ah-gameover-screen');
  const winScreen     = container.querySelector('#ah-win-screen');
  const finalScoreEl  = container.querySelector('#ah-final-score');
  const winScoreEl    = container.querySelector('#ah-win-score');
  const beginBtn      = container.querySelector('#ah-begin-btn');
  const tryAgainBtn   = container.querySelector('#ah-try-again-btn');

  // ── State ───────────────────────────────────────────────────────────────────
  let W, H, CX, CY, LOG_R, ARROW_LEN, ARROW_W;
  let angle = 0, rotSpeed = 0, rotDir = 1;
  let stuckArrows = [], arrowsLeft = 0, score = 0;
  let gameState = 'idle';
  let canThrow = true, throwing = false;
  let throwArrow = null;
  let particles = [];
  let raf;
  let startTime = null;
  let wrongAttempts = 0;

  // ── Sizing ──────────────────────────────────────────────────────────────────
  function resize() {
    const cw   = container.clientWidth  || 360;
    const ch   = container.clientHeight || 460;
    const size = Math.min(cw, ch, 600);
    canvas.width  = cw;
    canvas.height = ch;
    W = cw; H = ch; CX = W / 2; CY = H / 2;
    LOG_R     = size * 0.22;
    ARROW_LEN = LOG_R * 1.1;
    ARROW_W   = 4;
  }

  // ── Pips ────────────────────────────────────────────────────────────────────
  function updatePips() {
    pipsEl.innerHTML = '';
    for (let i = 0; i < CONFIG.arrow_count; i++) {
      const pip = document.createElement('div');
      pip.className = 'ah-arrow-pip' + (i >= arrowsLeft ? ' ah-arrow-pip--used' : '');
      pipsEl.appendChild(pip);
    }
  }

  // ── Start / restart ─────────────────────────────────────────────────────────
  function resetGameState() {
    angle      = 0;
    rotDir     = 1;
    rotSpeed   = CONFIG.target_rotation_speed;
    stuckArrows = [];
    arrowsLeft  = CONFIG.arrow_count;
    score       = 0;
    canThrow    = true;
    throwing    = false;
    throwArrow  = null;
    particles   = [];
    gameState   = 'playing';
    scoreEl.textContent = '0';
    startScreen.classList.add('ah-hidden');
    gameOverScreen.classList.add('ah-hidden');
    winScreen.classList.add('ah-hidden');
    hintEl.style.opacity = '1';
    updatePips();
  }

  function startGame() {
    startTime = Date.now();
    wrongAttempts = 0;
    resetGameState();
    loop();
  }

  function restartGame() {
    wrongAttempts++;
    resetGameState();
    loop();
  }

  // ── Input handlers (named for removal) ──────────────────────────────────────
  function handleClick(e) {
    if (gameState !== 'playing' || !canThrow || throwing) return;
    throwArrowFrom(e.clientY - canvas.getBoundingClientRect().top);
  }

  function handleTouch(e) {
    if (gameState !== 'playing' || !canThrow || throwing) return;
    e.preventDefault();
    throwArrowFrom(e.changedTouches[0].clientY - canvas.getBoundingClientRect().top);
  }

  function handleResize() {
    resize();
  }

  function throwArrowFrom(clientY) {
    if (arrowsLeft <= 0) return;
    canThrow   = false;
    throwing   = true;
    throwArrow = { y: clientY, vy: -12, landed: false };
    hintEl.style.opacity = '0';
  }

  // ── Collision ────────────────────────────────────────────────────────────────
  function checkCollision(newAngle) {
    for (const a of stuckArrows) {
      let diff = Math.abs(((newAngle - a.angle) % 360 + 360) % 360);
      if (diff > 180) diff = 360 - diff;
      if (diff < CONFIG.collision_tolerance) return true;
    }
    return false;
  }

  // ── Scoring ──────────────────────────────────────────────────────────────────
  function addScore(count) {
    const s = CONFIG.scoring;
    let pts = s.base_per_arrow;
    if (count === 5)  pts += s.bonus_at_5;
    if (count === 10) pts += s.bonus_at_10;
    score += pts;
    scoreEl.textContent = score;
    spawnScorePopup('+' + pts);
  }

  function spawnScorePopup(text) {
    const el = document.createElement('div');
    el.className  = 'ah-score-popup';
    el.textContent = text;
    el.style.left = (CX + (Math.random() - 0.5) * 60 - 20) + 'px';
    el.style.top  = (CY - LOG_R - 30) + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  // ── Particles ────────────────────────────────────────────────────────────────
  function spawnImpact(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 1, color });
    }
  }

  function spawnExplosion(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 2, life: 1,
        color: i % 2 === 0 ? '#c0392b' : '#f0c040' });
    }
  }

  // ── Draw log ─────────────────────────────────────────────────────────────────
  function drawLog(ang) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(ang * Math.PI / 180);

    const glow = ctx.createRadialGradient(0, 0, LOG_R*0.7, 0, 0, LOG_R*1.15);
    glow.addColorStop(0, 'rgba(139,69,19,0.0)');
    glow.addColorStop(1, 'rgba(139,69,19,0.25)');
    ctx.beginPath();
    ctx.arc(0, 0, LOG_R*1.15, 0, Math.PI*2);
    ctx.fillStyle = glow;
    ctx.fill();

    for (let r = LOG_R; r > 0; r -= LOG_R * 0.12) {
      const t = r / LOG_R;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${80+70*(1-t)}, ${30+30*(1-t)}, 10, ${0.3 + 0.4*t})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const grad = ctx.createRadialGradient(-LOG_R*0.2, -LOG_R*0.2, 0, 0, 0, LOG_R);
    grad.addColorStop(0,   '#c8845a');
    grad.addColorStop(0.4, '#a0522d');
    grad.addColorStop(0.8, '#7a3b1a');
    grad.addColorStop(1,   '#5a2b0e');
    ctx.beginPath();
    ctx.arc(0, 0, LOG_R, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(-LOG_R*Math.cos(a), -LOG_R*Math.sin(a));
      ctx.lineTo( LOG_R*Math.cos(a),  LOG_R*Math.sin(a));
      ctx.strokeStyle = 'rgba(60,25,5,0.12)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, LOG_R, 0, Math.PI*2);
    ctx.strokeStyle = '#5a2b0e';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI*2);
    ctx.fillStyle = '#3a1a05';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI*2);
    ctx.fillStyle = '#c8845a';
    ctx.fill();

    ctx.restore();
  }

  // ── Draw single arrow ─────────────────────────────────────────────────────────
  function drawArrow(x1, y1, x2, y2, alpha = 1) {
    const dx = x2-x1, dy = y2-y1;
    const len = Math.sqrt(dx*dx+dy*dy);
    const ux = dx/len, uy = dy/len;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#c8a96e';
    ctx.lineWidth = ARROW_W;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux*ARROW_LEN*0.25, y2 - uy*ARROW_LEN*0.25);
    ctx.strokeStyle = 'rgba(100,65,20,0.35)';
    ctx.lineWidth = ARROW_W * 0.5;
    ctx.stroke();

    const tx = x2, ty = y2;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(0, -5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fillStyle = '#d4d4d4';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const fx = x1, fy = y1;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.atan2(dy, dx) + Math.PI);
    [[1], [-1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(10, s*8, 20, s*3);
      ctx.quadraticCurveTo(14, s*2, 0, 0);
      ctx.fillStyle = s > 0 ? '#e05050' : '#e08030';
      ctx.globalAlpha = alpha * 0.85;
      ctx.fill();
    });
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Draw stuck arrows ─────────────────────────────────────────────────────────
  function drawStuckArrows(logAngle) {
    for (const a of stuckArrows) {
      const worldAngle = (a.angle + logAngle) * Math.PI / 180;
      const tipX  = CX + Math.cos(worldAngle) * LOG_R;
      const tipY  = CY + Math.sin(worldAngle) * LOG_R;
      const tailX = tipX + Math.cos(worldAngle) * ARROW_LEN * 0.85;
      const tailY = tipY + Math.sin(worldAngle) * ARROW_LEN * 0.85;
      drawArrow(tailX, tailY, tipX, tipY);
    }
  }

  // ── Draw flying arrow ─────────────────────────────────────────────────────────
  function drawFlyingArrow(arr) {
    const x   = CX;
    const y   = arr.y;
    const tip  = { x, y: y - ARROW_LEN * 0.6 };
    const tail = { x, y: y + ARROW_LEN * 0.4 };
    drawArrow(tail.x, tail.y, tip.x, tip.y);
  }

  // ── Particles ─────────────────────────────────────────────────────────────────
  function drawParticles() {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI*2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life * 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── Game loop ─────────────────────────────────────────────────────────────────
  function loop() {
    if (gameState !== 'playing') return;
    cancelAnimationFrame(raf);

    angle += rotSpeed * rotDir * 0.7;

    if (throwing && throwArrow) {
      throwArrow.y += throwArrow.vy * 6;
      const dist = Math.abs(throwArrow.y - CY);
      if (dist <= LOG_R + 2) {
        const impactAngle = (270 - angle % 360 + 360) % 360;

        if (checkCollision(impactAngle)) {
          spawnExplosion(CX, CY + LOG_R);
          triggerGameOver();
        } else {
          stuckArrows.push({ angle: impactAngle });
          arrowsLeft--;
          updatePips();
          addScore(stuckArrows.length);
          spawnImpact(CX, CY + LOG_R, '#c8a96e');

          rotSpeed += CONFIG.speed_increase_per_arrow;
          if (stuckArrows.length === CONFIG.reverse_at_arrow) rotDir *= -1;

          throwing   = false;
          throwArrow = null;

          if (arrowsLeft <= 0) {
            setTimeout(() => triggerWin(), 400);
          } else {
            setTimeout(() => {
              canThrow = true;
              hintEl.style.opacity = '1';
            }, 300);
          }
        }
      }
    }

    for (const p of particles) {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.15;
      p.life -= 0.035;
    }
    particles = particles.filter(p => p.life > 0);

    ctx.clearRect(0, 0, W, H);

    const vig = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W,H)*0.7);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    drawLog(angle);
    drawStuckArrows(angle);
    drawParticles();
    if (throwing && throwArrow) drawFlyingArrow(throwArrow);

    raf = requestAnimationFrame(loop);
  }

  // ── Game over (internal restart) ─────────────────────────────────────────────
  function triggerGameOver() {
    gameState = 'over';
    cancelAnimationFrame(raf);

    flashEl.style.opacity = '1';
    setTimeout(() => { flashEl.style.opacity = '0'; }, 120);

    setTimeout(() => {
      finalScoreEl.textContent = score;
      gameOverScreen.classList.remove('ah-hidden');
    }, 500);
  }

  // ── Win ───────────────────────────────────────────────────────────────────────
  function triggerWin() {
    gameState = 'win';
    cancelAnimationFrame(raf);
    winScoreEl.textContent = score;
    winScreen.classList.remove('ah-hidden');

    setTimeout(() => {
      cleanup();
      onComplete({
        correct:      true,
        timeTakenSec: (Date.now() - startTime) / 1000,
        wrongAttempts,
        score,
        arrowsPlaced: CONFIG.arrow_count
      });
    }, 1200);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  function cleanup() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('click',     handleClick);
    canvas.removeEventListener('touchend',  handleTouch);
    window.removeEventListener('resize',    handleResize);
    container.querySelectorAll('.ah-score-popup').forEach(e => e.remove());
  }

  // ── Button wiring ─────────────────────────────────────────────────────────────
  beginBtn.addEventListener('click',    startGame);
  tryAgainBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('ah-hidden');
    restartGame();
  });

  canvas.addEventListener('click',    handleClick);
  canvas.addEventListener('touchend', handleTouch, { passive: false });
  window.addEventListener('resize',   handleResize);

  // ── Init ──────────────────────────────────────────────────────────────────────
  resize();
}
