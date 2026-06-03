// ============================================================
// CONSTANTS & STATE
// ============================================================
const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
let player, bullets, enemies, particles, gems, drops, score;
let isGameOver, isUpgrading, isPlaying = false, isPausedByOptions = false;
let keys = {}, currentControlMode = "keyboard";
let mouseX = null, mouseY = null;
let spawnTimer = 0, lastShotTime = 0, animationFrameId = null;
let bosses = [], nextBossScore = 40, bossCount = 0;
let mouseLockout = false, activeUpgradeCards = [], currentFocusIndex = 0;
let mainMenuFocusIndex = 0, optFocusIndex = 0, pauseMenuFocusIndex = 0, gameOverFocusIndex = 0;
let gamepadButtonCooldown = false, lastStartButtonState = false, lastBButtonState = false;
let audioCtx = null;
let enemyIdCounter = 0;
let glowCacheCanvas = null;
let globalVolumeModifier = 3.0;
let uiDirty = false;
let hitFlashTimeout = null;
let lastFrameTime = 0;
let highScore = 0;

// ============================================================
// SCREEN SHAKE
// ============================================================
let shakeTime = 0, shakeMagnitude = 0;
function triggerScreenShake(mag, duration) {
    if (mag > shakeMagnitude) { shakeMagnitude = mag; shakeTime = duration; }
}
function applyScreenShake() {
    if (shakeTime <= 0) return;
    const ox = (Math.random() - 0.5) * 2 * shakeMagnitude;
    const oy = (Math.random() - 0.5) * 2 * shakeMagnitude;
    ctx.save(); ctx.translate(ox, oy);
}
function resetScreenShake() {
    if (shakeTime > 0) ctx.restore();
}

// ============================================================
// SCORE POP-UPS
// ============================================================
const scorePopups = [];
function spawnScorePopup(x, y, value) {
    scorePopups.push({ x: x - camX, y: y - camY, value, alpha: 1.0, vy: -60, life: 0.85 });
}
function updateDrawScorePopups(dt) {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
        const p = scorePopups[i];
        p.y += p.vy * dt;
        p.alpha -= dt / p.life;
        if (p.alpha <= 0) { scorePopups.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.font = `bold ${p.value >= 10 ? 18 : 14}px sans-serif`;
        ctx.fillStyle = p.value >= 10 ? "#ffd700" : "#ff9999";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = p.value >= 10 ? "#ffd700" : "#ff3355";
        ctx.shadowBlur = 6;
        ctx.fillText("+" + p.value, p.x, p.y);
        ctx.restore();
    }
}

// ============================================================
// BULLET TRAIL SYSTEM
// ============================================================
const bulletTrails = [];
function spawnBulletTrail(x, y) {
    bulletTrails.push({ x: x - camX, y: y - camY, alpha: 0.55, radius: 3.5 });
}
function updateDrawBulletTrails(dt) {
    for (let i = bulletTrails.length - 1; i >= 0; i--) {
        const t = bulletTrails[i];
        t.alpha -= dt * 5.5;
        t.radius -= dt * 8;
        if (t.alpha <= 0 || t.radius <= 0) { bulletTrails.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = "#ff88cc";
        ctx.shadowColor = "#ff3399";
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, 2 * Math.PI); ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// WORLD MAP — 3000x3000 world, camera follows player
// ============================================================
const WORLD_W = 3000, WORLD_H = 3000;
let camX = 0, camY = 0; // top-left corner of camera in world coords

function worldToScreen(wx, wy) { return { x: wx - camX, y: wy - camY }; }
function screenToWorld(sx, sy) { return { x: sx + camX, y: sy + camY }; }

function updateCamera() {
    // Center camera on player
    camX = player.x - canvas.width / 2;
    camY = player.y - canvas.height / 2;
    // Clamp camera to world bounds
    camX = Math.max(0, Math.min(WORLD_W - canvas.width, camX));
    camY = Math.max(0, Math.min(WORLD_H - canvas.height, camY));
}

// ============================================================
// SPATIAL HASHING — O(1) collision lookups
// ============================================================
const CELL_SIZE = 80; // grid cell size in world px

class SpatialHash {
    constructor() { this.cells = new Map(); }
    clear() { this.cells.clear(); }
    _key(cx, cy) { return (cx & 0xFFFF) | ((cy & 0xFFFF) << 16); }
    insert(obj) {
        const r = (obj.size || 10) + 4;
        const x0 = Math.floor((obj.x - r) / CELL_SIZE);
        const x1 = Math.floor((obj.x + r) / CELL_SIZE);
        const y0 = Math.floor((obj.y - r) / CELL_SIZE);
        const y1 = Math.floor((obj.y + r) / CELL_SIZE);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = this._key(cx, cy);
                if (!this.cells.has(k)) this.cells.set(k, []);
                this.cells.get(k).push(obj);
            }
        }
    }
    query(x, y, r) {
        const x0 = Math.floor((x - r) / CELL_SIZE);
        const x1 = Math.floor((x + r) / CELL_SIZE);
        const y0 = Math.floor((y - r) / CELL_SIZE);
        const y1 = Math.floor((y + r) / CELL_SIZE);
        const seen = new Set(); const results = [];
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = this._key(cx, cy);
                const cell = this.cells.get(k);
                if (!cell) continue;
                for (const obj of cell) {
                    if (!seen.has(obj)) { seen.add(obj); results.push(obj); }
                }
            }
        }
        return results;
    }
}
const spatialHash = new SpatialHash();

// ============================================================
// OFF-SCREEN CANVAS SPRITES — Pre-rendered shapes
// ============================================================
const spriteCache = {};

function makeSprite(type, size, color) {
    const key = `${type}_${size}_${color}`;
    if (spriteCache[key]) return spriteCache[key];
    const pad = 4;
    const s = document.createElement("canvas");
    const dim = size * 2 + pad * 2;
    s.width = dim; s.height = dim;
    const c = s.getContext("2d");
    const cx = dim / 2, cy = dim / 2;
    c.fillStyle = color;
    c.beginPath();
    if (type === "triangle") {
        c.moveTo(cx, cy - size);
        c.lineTo(cx + size, cy + size);
        c.lineTo(cx - size, cy + size);
    } else if (type === "rhombus") {
        c.moveTo(cx, cy - size);
        c.lineTo(cx + size, cy);
        c.lineTo(cx, cy + size);
        c.lineTo(cx - size, cy);
    } else {
        c.arc(cx, cy, size, 0, 2 * Math.PI);
    }
    c.closePath(); c.fill();
    // Glow effect
    c.globalCompositeOperation = "source-atop";
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, size);
    grad.addColorStop(0, "rgba(255,255,255,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = grad; c.fillRect(0, 0, dim, dim);
    c.globalCompositeOperation = "source-over";
    spriteCache[key] = s;
    return s;
}

function drawSprite(type, wx, wy, size, color) {
    const sp = makeSprite(type, size, color);
    const pad = 4;
    const sx = wx - camX - size - pad;
    const sy = wy - camY - size - pad;
    ctx.drawImage(sp, sx, sy);
}

// ============================================================
// OBJECT POOLS
// ============================================================
const bulletPool = [];
const particlePool = [];

function getBullet(x, y, vx, vy, size, dmg, pierce, kbPower) {
    let b = bulletPool.pop() || {};
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.size = size; b.dmg = dmg; b.pierceLeft = pierce;
    b.kbPower = kbPower;
    b.hitTargets = b.hitTargets ? (b.hitTargets.clear(), b.hitTargets) : new Set();
    return b;
}
function recycleBullet(b) { bulletPool.push(b); }

function getParticle(x, y, vx, vy, radius, color) {
    let p = particlePool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.radius = radius; p.alpha = 1; p.color = color;
    return p;
}
function recycleParticle(p) { particlePool.push(p); }

// ============================================================
// LOCAL STORAGE — HIGH SCORE
// ============================================================
function loadHighScore() {
    try { highScore = parseInt(localStorage.getItem("biodefense_hiscore") || "0") || 0; }
    catch(e) { highScore = 0; }
    document.getElementById("menuHiScoreVal").innerText = highScore;
}
function saveHighScore(s) {
    if (s > highScore) {
        highScore = s;
        try { localStorage.setItem("biodefense_hiscore", String(s)); } catch(e) {}
        return true;
    }
    return false;
}

// ============================================================
// AUDIO
// ============================================================
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function updateVolume(val) {
    globalVolumeModifier = parseInt(val) / 100;
    document.getElementById("volumeVal").innerText = val + "%";
}

const SFX = {
    shoot: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sine"; osc.frequency.setValueAtTime(120, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 0.06);
        filter.type = "lowpass"; filter.Q.setValueAtTime(3, audioCtx.currentTime); filter.frequency.setValueAtTime(400, audioCtx.currentTime); filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.15 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.06);
        osc.start(); osc.stop(audioCtx.currentTime + 0.06);
    },
    hit: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "triangle"; osc.frequency.setValueAtTime(180, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.04);
        filter.type = "bandpass"; filter.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.04);
        osc.start(); osc.stop(audioCtx.currentTime + 0.04);
    },
    hurt: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(220, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(55, audioCtx.currentTime + 0.15);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(800, audioCtx.currentTime); filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.36 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    },
    gem: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(660, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.09 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.12);
        osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    },
    item: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    },
    levelUp: () => {
        SFX.item();
        setTimeout(() => {
            if (!audioCtx) return;
            let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1318.51, audioCtx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.25);
            osc.start(); osc.stop(audioCtx.currentTime + 0.25);
        }, 60);
    },
    boss: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "triangle"; osc.frequency.setValueAtTime(55, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(35, audioCtx.currentTime + 0.5);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(90, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.9 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    },
    menuMove: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine"; osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.03);
        osc.start(); osc.stop(audioCtx.currentTime + 0.03);
    },
    menuSelect: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(330, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.06);
        osc.start(); osc.stop(audioCtx.currentTime + 0.06);
    }
};

// ============================================================
// HELPERS
// ============================================================
const getDist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

function createGlowCache() {
    glowCacheCanvas = document.createElement("canvas");
    glowCacheCanvas.width = 40; glowCacheCanvas.height = 40;
    const gCtx = glowCacheCanvas.getContext("2d");
    const grad = gCtx.createRadialGradient(20, 20, 2, 20, 20, 18);
    grad.addColorStop(0, "rgba(255, 51, 153, 1)");
    grad.addColorStop(0.3, "rgba(255, 51, 102, 0.4)");
    grad.addColorStop(1, "rgba(255, 51, 102, 0)");
    gCtx.fillStyle = grad; gCtx.beginPath(); gCtx.arc(20, 20, 18, 0, 2 * Math.PI); gCtx.fill();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (player && isPlaying) {
        player.x = Math.min(player.x, WORLD_W - player.size / 2);
        player.y = Math.min(player.y, WORLD_H - player.size / 2);
    }
}

function triggerHitFlash() {
    const flash = document.getElementById("hitFlash");
    flash.classList.add("active");
    if (hitFlashTimeout) clearTimeout(hitFlashTimeout);
    hitFlashTimeout = setTimeout(() => flash.classList.remove("active"), 60);
}

function updateXpBar() {
    if (!player) return;
    document.getElementById("xpBarFill").style.width = Math.min(100, (player.xp / player.xpNeeded) * 100) + "%";
}

function createExplosion(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        particles.push(getParticle(x, y, 5*(Math.random()-.5), 5*(Math.random()-.5), 3*Math.random()+1, color));
    }
}

// ============================================================
// SPAWN — spawn off-screen relative to player in world coords
// ============================================================
function getSpawnCoords(offset) {
    const edge = Math.floor(4 * Math.random());
    const vw = canvas.width, vh = canvas.height;
    const px = player.x, py = player.y;
    // Spawn just outside the visible area
    const mx = vw / 2 + offset, my = vh / 2 + offset;
    let sx, sy;
    if (edge === 0) { sx = px - mx + Math.random() * (2 * mx); sy = py - my; }
    else if (edge === 1) { sx = px + mx; sy = py - my + Math.random() * (2 * my); }
    else if (edge === 2) { sx = px - mx + Math.random() * (2 * mx); sy = py + my; }
    else { sx = px - mx; sy = py - my + Math.random() * (2 * my); }
    // Clamp to world
    sx = Math.max(20, Math.min(WORLD_W - 20, sx));
    sy = Math.max(20, Math.min(WORLD_H - 20, sy));
    return { x: sx, y: sy };
}

// ============================================================
// MOBILE JOYSTICK
// ============================================================
let joystickActive = false, joystickStartX = 0, joystickStartY = 0, joystickDX = 0, joystickDY = 0;
const JOYSTICK_RADIUS = 55;

function setupMobileJoystick() {
    const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    const container = document.getElementById("joystickContainer");
    if (!isTouchDevice || currentControlMode === "keyboard" || currentControlMode === "mouse" || currentControlMode === "gamepad") {
        container.style.display = "none"; return;
    }
    container.style.display = "block";
    currentControlMode = "touch";
    updateModeDisplay();
    const base = document.getElementById("joystickBase");
    const thumb = document.getElementById("joystickThumb");
    function onTouchStart(e) {
        e.preventDefault();
        const t = e.changedTouches[0];
        joystickActive = true; joystickStartX = t.clientX; joystickStartY = t.clientY;
    }
    function onTouchMove(e) {
        e.preventDefault();
        if (!joystickActive) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - joystickStartX, dy = t.clientY - joystickStartY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, JOYSTICK_RADIUS);
        const nx = dx / (dist || 1) * clamped, ny = dy / (dist || 1) * clamped;
        joystickDX = nx / JOYSTICK_RADIUS; joystickDY = ny / JOYSTICK_RADIUS;
        thumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
    function onTouchEnd(e) {
        e.preventDefault();
        joystickActive = false; joystickDX = 0; joystickDY = 0;
        thumb.style.transform = "translate(-50%, -50%)";
    }
    base.addEventListener("touchstart", onTouchStart, { passive: false });
    base.addEventListener("touchmove", onTouchMove, { passive: false });
    base.addEventListener("touchend", onTouchEnd, { passive: false });
    base.addEventListener("touchcancel", onTouchEnd, { passive: false });
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop(timestamp) {
    processGamepadInput();
    if (!isPlaying) { animationFrameId = requestAnimationFrame(gameLoop); return; }

    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;
    if (shakeTime > 0) shakeTime -= dt;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isGameOver || isUpgrading || isPausedByOptions) {
        // Render frozen state in screen coords
        renderFrozenState();
    } else {
        applyScreenShake();
        runGameFrame(dt, timestamp);
        resetScreenShake();
    }

    flushUI();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function renderFrozenState() {
    drawWorldBackground();
    bullets.forEach(b => {
        const sx = b.x - camX, sy = b.y - camY;
        ctx.fillStyle = "#ffb3d9"; ctx.beginPath(); ctx.arc(sx, sy, b.size, 0, 2*Math.PI); ctx.fill();
    });
    gems.forEach(g => ctx.drawImage(glowCacheCanvas, g.x - camX - 20, g.y - camY - 20));
    drops.forEach(d => {
        const sx = d.x - camX, sy = d.y - camY;
        ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(sx, sy, d.size, 0, 2*Math.PI); ctx.fill();
    });
    enemies.forEach(e => drawSprite(e.type, e.x, e.y, e.size, e.color));
    bosses.forEach(b => drawSprite(b.type, b.x, b.y, b.size, b.color));
    // Player
    const psx = player.x - camX, psy = player.y - camY;
    ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(psx, psy, player.size/2, 0, 2*Math.PI); ctx.fill();
}

function drawWorldBackground() {
    // Draw a tiled organic-looking background for the world
    ctx.fillStyle = "#0a0101";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Subtle grid lines to give sense of movement
    ctx.strokeStyle = "rgba(60,10,10,0.35)";
    ctx.lineWidth = 1;
    const gridSize = 80;
    const offX = camX % gridSize, offY = camY % gridSize;
    for (let x = -offX; x < canvas.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = -offY; y < canvas.height + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // World boundary indicator
    drawWorldBorder();
}

function drawWorldBorder() {
    const bx = -camX, by = -camY;
    const bw = WORLD_W, bh = WORLD_H;
    // Only draw visible portions
    ctx.strokeStyle = "rgba(255,51,85,0.4)";
    ctx.lineWidth = 6;
    ctx.strokeRect(bx, by, bw, bh);
    // Red warning glow near edges
    const margin = 200;
    const px = player.x, py = player.y;
    const nearLeft = px < margin, nearRight = px > WORLD_W - margin;
    const nearTop = py < margin, nearBottom = py > WORLD_H - margin;
    if (nearLeft || nearRight || nearTop || nearBottom) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// BOIDS SEPARATION — keeps enemies spread out (O(N * local))
// ============================================================
const SEPARATION_RADIUS = 32;
const SEPARATION_FORCE = 140; // px/sec push

function applySeparation(allEnemies) {
    for (let i = 0; i < allEnemies.length; i++) {
        const a = allEnemies[i];
        let fx = 0, fy = 0;
        // Use spatial hash to only check nearby
        const nearby = spatialHash.query(a.x, a.y, SEPARATION_RADIUS * 2);
        for (const b of nearby) {
            if (b === a || b.id === undefined) continue; // skip non-enemies
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < SEPARATION_RADIUS && dist > 0) {
                const push = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
                fx += (dx / dist) * push;
                fy += (dy / dist) * push;
            }
        }
        a._sepX = fx * SEPARATION_FORCE;
        a._sepY = fy * SEPARATION_FORCE;
    }
}

// ============================================================
// BOTTOM HINT & MENU FOCUS
// ============================================================
function updateGlobalHint() {
    const hintBox = document.getElementById("globalHint");
    let _gpList; try { _gpList = navigator.getGamepads(); } catch(e) { _gpList = []; }
    const isGamepad = (currentControlMode === "gamepad" || (_gpList[0] || false));
    const isMobile = currentControlMode === "touch";
    if (document.getElementById("mainMenu").style.display !== "none") {
        hintBox.innerHTML = isMobile ? "Chạm vào nút để chọn" :
            isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn" :
            "Dùng phím <span>W / S</span> hoặc <span>Mũi tên</span> để Duyệt • Nhấn <span>ENTER / SPACE</span> để Chọn";
        hintBox.style.display = "block"; return;
    }
    if (document.getElementById("optionsScreen").style.display === "block") {
        if (optFocusIndex === 3) {
            hintBox.innerHTML = isGamepad ? "Dùng <span>Analog Trái / D-Pad (Trái/Phải)</span> để tăng giảm âm lượng • Nhấn <span>(B)</span> để Hủy" :
                "Dùng phím <span>A / D</span> hoặc <span>Mũi Tên Trái / Phải</span> để tăng giảm âm lượng";
        } else {
            hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn • Nhấn <span>(B)</span> để Quay lại" :
                "Dùng phím <span>W / S</span> để Duyệt • Nhấn <span>ENTER</span> để Kích hoạt • Nhấn <span>ESC</span> để Hủy";
        }
        hintBox.style.display = "block"; return;
    }
    if (document.getElementById("pauseScreen").style.display === "block") {
        hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad</span> để chọn • Nhấn <span>(A)</span> để Thực thi • Nhấn <span>(B)</span> để Tiếp tục" :
            "Dùng phím <span>W / S</span> để chọn • Nhấn <span>ENTER</span> để Thực thi • Nhấn <span>ESC</span> để Tiếp tục";
        hintBox.style.display = "block"; return;
    }
    if (document.getElementById("upgradeScreen").style.display === "block") {
        hintBox.innerHTML = isMobile ? "Chạm vào thẻ gene để hấp thụ đột biến" :
            isGamepad ? "Dùng <span>D-Pad</span> chọn chuỗi gen • Nhấn <span>(A)</span> để hấp thụ Đột biến" :
            "Dùng phím <span>W / S</span> chọn chuỗi gen • Nhấn <span>ENTER</span> để hấp thụ Đột biến";
        hintBox.style.display = "block"; return;
    }
    if (document.getElementById("gameOverScreen").style.display === "block") {
        hintBox.innerHTML = isGamepad ? "Nhấn <span>(A)</span> để Tái tạo bạch cầu ngay lập tức" :
            "Nhấn <span>ENTER / SPACE</span> để Tái tạo bạch cầu ngay";
        hintBox.style.display = "block"; return;
    }
    if (isPlaying) {
        if (isMobile) hintBox.innerHTML = "Dùng <span>Joystick trái</span> để di chuyển • Hệ thống kháng thể bắn tự động";
        else if (currentControlMode === "keyboard") hintBox.innerHTML = "Dùng cụm <span>WASD / Mũi tên</span> để điều khiển Bạch Cầu • Hệ thống kháng thể bắn tự động • Nhấn <span>ESC</span> để Tạm dừng";
        else if (currentControlMode === "mouse") hintBox.innerHTML = "Bạch Cầu tự động bám đuổi theo <span>Con trỏ Chuột</span> • Nhấn <span>ESC</span> để Tạm dừng";
        else hintBox.innerHTML = "Dùng <span>Analog Trái</span> để điều khiển Bạch Cầu • Nhấn <span>START</span> để Tạm dừng";
        hintBox.style.display = "block"; return;
    }
    hintBox.style.display = "none";
}

function renderMainMenuFocus() { for (let i = 0; i < 3; i++) document.getElementById(`menu-btn-${i}`).classList.toggle("menu-focused", i === mainMenuFocusIndex); }
function renderPauseMenuFocus() { for (let i = 0; i < 3; i++) document.getElementById(`pause-btn-${i}`).classList.toggle("menu-focused", i === pauseMenuFocusIndex); }
function renderGameOverFocus() {
    document.getElementById("gover-btn-0").classList.toggle("menu-focused", gameOverFocusIndex === 0);
    document.getElementById("gover-btn-2").classList.toggle("menu-focused", gameOverFocusIndex === 1);
}
function renderOptionsFocus() {
    for (let i = 0; i < 4; i++) document.getElementById(`opt-label-${i}`).classList.toggle("opt-focused", i === optFocusIndex);
    document.getElementById("opt-btn-save").classList.toggle("btn-focused", optFocusIndex === 4);
    document.getElementById("opt-btn-cancel").classList.toggle("btn-focused", optFocusIndex === 5);
}
function renderSelectionFocus() {
    document.querySelectorAll(".upgrade-card").forEach((c, idx) => c.classList.toggle("keyboard-focused", idx === currentFocusIndex));
}

// ============================================================
// GAME FLOW
// ============================================================
function startGame() {
    initAudio(); SFX.menuSelect();
    document.getElementById("mainMenu").style.display = "none";
    ["gameCanvas","ui","xpBar"].forEach(id => document.getElementById(id).style.display = "block");
    isPlaying = true; isPausedByOptions = mouseLockout = false;
    resizeCanvas(); createGlowCache(); init();
    updateModeDisplay(); setCanvasCursor(false);
    setupMobileJoystick(); updateGlobalHint();
}

function togglePauseMenu() {
    if (!isPlaying || isGameOver || isUpgrading || document.getElementById("optionsScreen").style.display === "block") return;
    isPausedByOptions = !isPausedByOptions; SFX.menuSelect();
    if (isPausedByOptions) {
        setCanvasCursor(true);
        document.getElementById("pauseScreen").style.display = "block";
        pauseMenuFocusIndex = 0; renderPauseMenuFocus();
    } else {
        document.getElementById("pauseScreen").style.display = "none";
        clearMousePosition(); setCanvasCursor(false);
        mouseLockout = true; setTimeout(() => mouseLockout = false, 200);
    }
    updateGlobalHint();
}

function openOptions() {
    initAudio(); SFX.menuSelect();
    document.getElementById("optionsScreen").style.display = "block";
    document.querySelector(`input[name="controlModeOpt"][value="${currentControlMode}"]`).checked = true;
    optFocusIndex = ["keyboard","mouse","gamepad"].indexOf(currentControlMode);
    if (optFocusIndex < 0) optFocusIndex = 0;
    renderOptionsFocus(); updateGlobalHint();
}
function openOptionsFromPause() { document.getElementById("pauseScreen").style.display = "none"; openOptions(); }

function closeOptions(isSaved) {
    SFX.menuSelect();
    if (isSaved) {
        let _gp2; try { _gp2 = navigator.getGamepads()[0]; } catch(e) { _gp2 = null; }
        if (currentControlMode === "gamepad" || _gp2) {
            currentControlMode = ["keyboard","mouse","gamepad"][Math.min(optFocusIndex, 2)] || currentControlMode;
        } else {
            const selected = document.getElementsByName("controlModeOpt");
            for (let i = 0; i < selected.length; i++) if (selected[i].checked) { currentControlMode = selected[i].value; break; }
        }
        updateModeDisplay();
        if (isPlaying) setupMobileJoystick();
    }
    document.getElementById("optionsScreen").style.display = "none";
    clearMousePosition();
    if (isPlaying) { document.getElementById("pauseScreen").style.display = "block"; pauseMenuFocusIndex = 1; renderPauseMenuFocus(); }
    else updateGlobalHint();
}

function setCanvasCursor(show) { canvas.style.cursor = show ? "default" : "none"; }
function clearMousePosition() { mouseX = mouseY = null; }
function updateModeDisplay() {
    document.getElementById("currentModeDisplay").innerText = {keyboard:"Bàn phím (WASD)",mouse:"Chuột (Mouse)",gamepad:"Tay cầm (Gamepad)",touch:"Cảm ứng (Mobile)"}[currentControlMode] || "Bàn phím";
}

function exitGame() {
    SFX.menuSelect();
    if (confirm("Xác nhận đóng liên kết phòng vệ sinh học?")) { window.close(); alert("Hãy đóng tab để thoát."); }
}

function backToMenu() {
    SFX.menuSelect(); isPlaying = isPausedByOptions = false;
    ["bossWarning","gameCanvas","ui","gameOverScreen","optionsScreen","upgradeScreen","pauseScreen","xpBar","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    document.getElementById("joystickContainer").style.display = "none";
    document.getElementById("mainMenu").style.display = "flex";
    loadHighScore(); mainMenuFocusIndex = 0; renderMainMenuFocus(); updateGlobalHint();
}

function init() {
    player = {
        x: WORLD_W/2, y: WORLD_H/2, size: 24, speed: 252,
        hp: 3, maxHp: 3, level: 1, xp: 0, xpNeeded: 12,
        fireRate: 400, magnetRange: 75, gemSpeed: 330,
        color: "#f5f0f0", damage: 1, bulletCount: 1, xpRate: 1,
        shootRange: 420, pierce: 1, knockback: 0
    };
    bullets = []; enemies = []; bosses = []; particles = []; gems = []; drops = [];
    score = spawnTimer = bossCount = enemyIdCounter = 0;
    nextBossScore = 40;
    isGameOver = isUpgrading = false;
    lastFrameTime = 0;
    camX = WORLD_W/2 - window.innerWidth/2;
    camY = WORLD_H/2 - window.innerHeight/2;
    ["gameOverScreen","upgradeScreen","bossWarning","pauseScreen","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    clearMousePosition(); updateUI(); updateGlobalHint();
}

function updateUI() { uiDirty = true; }
function flushUI() {
    if (!uiDirty || !player) return;
    uiDirty = false;
    document.getElementById("hp").innerText = player.hp;
    document.getElementById("score").innerText = score;
    document.getElementById("level").innerText = player.level;
    document.getElementById("xp").innerText = Math.floor(player.xp);
    document.getElementById("xpNeeded").innerText = player.xpNeeded;
    updateXpBar();
    if (bosses.length > 0) {
        const b = bosses[0];
        document.getElementById("bossPhaseBar").style.display = "flex";
        document.getElementById("bossPhaseFill").style.width = Math.max(0, (b.hp / b.maxHp) * 100) + "%";
        const phaseLabel = b.phase >= 2 ? "BOSS PHASE " + b.phase + " 🔥" : "BOSS HP";
        document.getElementById("bossPhaseLabel").innerText = phaseLabel;
    } else {
        document.getElementById("bossPhaseBar").style.display = "none";
    }
}

function resetGame() { SFX.menuSelect(); init(); isGameOver = false; document.getElementById("gameOverScreen").style.display = "none"; setCanvasCursor(false); }
function handlePlayerDeath() {
    isGameOver = true; gameOverFocusIndex = 0;
    document.getElementById("finalScore").innerText = score;
    document.getElementById("finalLevel").innerText = player.level;
    const isNewRecord = saveHighScore(score);
    document.getElementById("finalHiScore").innerText = highScore;
    document.getElementById("newRecordBadge").style.display = isNewRecord ? "block" : "none";
    setCanvasCursor(true);
    document.getElementById("gameOverScreen").style.display = "block";
    renderGameOverFocus(); SFX.hurt(); updateGlobalHint();
}

// ============================================================
// INPUT HANDLING
// ============================================================
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); if (isPlaying) togglePauseMenu(); return; }
    if (!isPlaying && document.getElementById("mainMenu").style.display !== "none") {
        if (e.key==="w"||e.key==="ArrowUp") { mainMenuFocusIndex=(mainMenuFocusIndex-1+3)%3; SFX.menuMove(); renderMainMenuFocus(); }
        else if (e.key==="s"||e.key==="ArrowDown") { mainMenuFocusIndex=(mainMenuFocusIndex+1)%3; SFX.menuMove(); renderMainMenuFocus(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById(`menu-btn-${mainMenuFocusIndex}`).click();
        updateGlobalHint();
    } else if (document.getElementById("optionsScreen").style.display === "block") {
        if (e.key==="w"||e.key==="ArrowUp") { optFocusIndex=(optFocusIndex-1+6)%6; renderOptionsFocus(); SFX.menuMove(); updateGlobalHint(); }
        else if (e.key==="s"||e.key==="ArrowDown") { optFocusIndex=(optFocusIndex+1)%6; renderOptionsFocus(); SFX.menuMove(); updateGlobalHint(); }
        else if (optFocusIndex===3 && (e.key==="a"||e.key==="ArrowLeft"||e.key==="d"||e.key==="ArrowRight")) {
            let v = parseInt(document.getElementById("gameVolume").value);
            v = (e.key==="a"||e.key==="ArrowLeft") ? Math.max(0,v-5) : Math.min(100,v+5);
            document.getElementById("gameVolume").value = v; updateVolume(v); SFX.menuMove();
        } else if (e.key===" "||e.key==="Enter") {
            if (optFocusIndex<=2) { document.getElementsByName("controlModeOpt")[optFocusIndex].checked=true; SFX.menuSelect(); }
            else if (optFocusIndex===4) closeOptions(true);
            else if (optFocusIndex===5) closeOptions(false);
        }
    } else if (isPausedByOptions) {
        if (e.key==="w"||e.key==="ArrowUp") { pauseMenuFocusIndex=(pauseMenuFocusIndex-1+3)%3; renderPauseMenuFocus(); SFX.menuMove(); }
        else if (e.key==="s"||e.key==="ArrowDown") { pauseMenuFocusIndex=(pauseMenuFocusIndex+1)%3; renderPauseMenuFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById(`pause-btn-${pauseMenuFocusIndex}`).click();
    } else if (isGameOver) {
        if (e.key==="w"||e.key==="ArrowUp"||e.key==="s"||e.key==="ArrowDown") { gameOverFocusIndex=gameOverFocusIndex===0?1:0; renderGameOverFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById("gover-btn-"+(gameOverFocusIndex===0?0:2)).click();
    } else if (isUpgrading) {
        if (e.key==="w"||e.key==="ArrowUp") { currentFocusIndex=(currentFocusIndex-1+activeUpgradeCards.length)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); }
        else if (e.key==="s"||e.key==="ArrowDown") { currentFocusIndex=(currentFocusIndex+1)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") { e.preventDefault(); if (activeUpgradeCards[currentFocusIndex]) applyUpgrade(activeUpgradeCards[currentFocusIndex].id); }
    } else if (isPlaying) {
        keys[e.key.toLowerCase()] = true;
    }
});
window.addEventListener("keyup", e => { if (isPlaying) keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", e => {
    if (!isPlaying||isUpgrading||isGameOver||isPausedByOptions||mouseLockout||currentControlMode!=="mouse") return;
    const r = canvas.getBoundingClientRect(); mouseX = e.clientX-r.left; mouseY = e.clientY-r.top;
});
window.addEventListener("gamepadconnected", () => {
    currentControlMode = "gamepad"; document.body.classList.add("gp-active");
    updateModeDisplay(); renderMainMenuFocus(); updateGlobalHint();
});

// ============================================================
// GAMEPAD INPUT
// ============================================================
function processGamepadInput() {
    let gpList; try { gpList = navigator.getGamepads(); } catch(e) { return; }
    const gp = (gpList || [])[0]; if (!gp) return;
    const startPressed = gp.buttons[9]?.pressed;
    if (startPressed && !lastStartButtonState && isPlaying && !isGameOver && !isUpgrading) togglePauseMenu();
    lastStartButtonState = startPressed;
    const bPressed = gp.buttons[1]?.pressed;
    if (bPressed && !lastBButtonState) {
        if (document.getElementById("optionsScreen").style.display==="block") { closeOptions(false); activateGamepadCooldown(); }
        else if (isPausedByOptions) { togglePauseMenu(); activateGamepadCooldown(); }
    }
    lastBButtonState = bPressed;
    const moveUp = gp.buttons[12]?.pressed || gp.axes[1] < -.5;
    const moveDown = gp.buttons[13]?.pressed || gp.axes[1] > .5;
    const moveLeft = gp.buttons[14]?.pressed || gp.axes[0] < -.5;
    const moveRight = gp.buttons[15]?.pressed || gp.axes[0] > .5;
    const actionA = gp.buttons[0]?.pressed;

    if (document.getElementById("mainMenu").style.display !== "none") {
        if (!gamepadButtonCooldown) {
            if (moveUp) { mainMenuFocusIndex=(mainMenuFocusIndex-1+3)%3; renderMainMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { mainMenuFocusIndex=(mainMenuFocusIndex+1)%3; renderMainMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById(`menu-btn-${mainMenuFocusIndex}`).click(); activateGamepadCooldown(); }
        }
    } else if (document.getElementById("optionsScreen").style.display==="block") {
        if (!gamepadButtonCooldown) {
            if (moveUp) { optFocusIndex=(optFocusIndex-1+6)%6; renderOptionsFocus(); SFX.menuMove(); activateGamepadCooldown(); updateGlobalHint(); }
            else if (moveDown) { optFocusIndex=(optFocusIndex+1)%6; renderOptionsFocus(); SFX.menuMove(); activateGamepadCooldown(); updateGlobalHint(); }
            else if (optFocusIndex===3 && (moveLeft||moveRight)) {
                let v=parseInt(document.getElementById("gameVolume").value);
                v = moveLeft?Math.max(0,v-5):Math.min(100,v+5);
                document.getElementById("gameVolume").value=v; updateVolume(v); SFX.menuMove(); activateGamepadCooldown();
            } else if (actionA) {
                if (optFocusIndex<=2) { document.getElementsByName("controlModeOpt")[optFocusIndex].checked=true; SFX.menuSelect(); }
                else if (optFocusIndex===4) closeOptions(true);
                else if (optFocusIndex===5) closeOptions(false);
                activateGamepadCooldown();
            }
        }
    } else if (isPausedByOptions) {
        if (!gamepadButtonCooldown) {
            if (moveUp) { pauseMenuFocusIndex=(pauseMenuFocusIndex-1+3)%3; renderPauseMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { pauseMenuFocusIndex=(pauseMenuFocusIndex+1)%3; renderPauseMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById(`pause-btn-${pauseMenuFocusIndex}`).click(); activateGamepadCooldown(); }
        }
    } else if (isGameOver) {
        if (!gamepadButtonCooldown) {
            if (moveUp||moveDown) { gameOverFocusIndex=gameOverFocusIndex===0?1:0; renderGameOverFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById("gover-btn-"+(gameOverFocusIndex===0?0:2)).click(); activateGamepadCooldown(); }
        }
    } else if (isUpgrading) {
        if (!gamepadButtonCooldown) {
            if (moveUp) { currentFocusIndex=(currentFocusIndex-1+activeUpgradeCards.length)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { currentFocusIndex=(currentFocusIndex+1)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA && activeUpgradeCards[currentFocusIndex]) { applyUpgrade(activeUpgradeCards[currentFocusIndex].id); activateGamepadCooldown(); }
        }
    } else if (isPlaying && !isGameOver && !isUpgrading && !isPausedByOptions) {
        const axisX = gp.axes[0], axisY = gp.axes[1];
        if (Math.abs(axisX)>.15 || Math.abs(axisY)>.15) {
            keys["_gpx"] = axisX; keys["_gpy"] = axisY;
        } else { keys["_gpx"] = 0; keys["_gpy"] = 0; }
    }
}
function activateGamepadCooldown() { gamepadButtonCooldown=true; setTimeout(()=>gamepadButtonCooldown=false, 180); }

// ============================================================
// INIT
// ============================================================
loadHighScore();
renderMainMenuFocus();
updateGlobalHint();
animationFrameId = requestAnimationFrame(gameLoop);
