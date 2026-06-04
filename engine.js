// ============================================================
// CONSTANTS & STATE
// ============================================================
const SCREEN_BOMB_DAMAGE = 1;
const canvas = document.getElementById("gameCanvas"), ctx = canvas.getContext("2d");
const dom = {
    mainMenu: document.getElementById("mainMenu"),
    ui: document.getElementById("ui"),
    hudVersion: document.getElementById("hudVersion"),
    bossWarning: document.getElementById("bossWarning"),
    pauseScreen: document.getElementById("pauseScreen"),
    optionsScreen: document.getElementById("optionsScreen"),
    upgradeScreen: document.getElementById("upgradeScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    xpBar: document.getElementById("xpBar"),
    xpBarFill: document.getElementById("xpBarFill"),
    bossPhaseBar: document.getElementById("bossPhaseBar"),
    bossPhaseFill: document.getElementById("bossPhaseFill"),
    bossPhaseLabel: document.getElementById("bossPhaseLabel"),
    currentModeDisplay: document.getElementById("currentModeDisplay"),
    menuVersion: document.getElementById("menuVersion"),
    menuHiScoreVal: document.getElementById("menuHiScoreVal"),
    volumeVal: document.getElementById("volumeVal"),
    globalHint: document.getElementById("globalHint"),
    joystickContainer: document.getElementById("joystickContainer"),
    joystickBase: document.getElementById("joystickBase"),
    joystickThumb: document.getElementById("joystickThumb"),
    hp: document.getElementById("hp"),
    score: document.getElementById("score"),
    level: document.getElementById("level"),
    xp: document.getElementById("xp"),
    xpNeeded: document.getElementById("xpNeeded"),
    finalScore: document.getElementById("finalScore"),
    finalLevel: document.getElementById("finalLevel"),
    finalHiScore: document.getElementById("finalHiScore"),
    newRecordBadge: document.getElementById("newRecordBadge"),
    controlModeInputs: document.getElementsByName("controlModeOpt"),
    upgradeTracker: document.getElementById("upgradeTracker"),
    upgradeList: document.getElementById("upgradeList"),
    comboList: document.getElementById("comboList"),
    pauseStatList: document.getElementById("pauseStatList")
};
let player, bullets, enemies, particles, gems, drops, score;
let biofilmTrails = [];
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

// ============================================================
// SPATIAL HASH — for efficient collision queries
// ============================================================
const CELL_SIZE = 150;

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
const bulletSpatialHash = new SpatialHash();

// ============================================================
// METABALL PLASMA — white mask + SVG goo + color layer (source-in)
// ============================================================
let metaballWhiteCanvas = null, metaballWhiteCtx = null;
let metaballColorCanvas = null, metaballColorCtx = null;
let metaballMaskCanvas = null, metaballMaskCtx = null;

function resizeMetaballBuffers() {
    const w = canvas.width, h = canvas.height;
    if (!metaballWhiteCanvas) {
        metaballWhiteCanvas = document.createElement("canvas");
        metaballWhiteCtx = metaballWhiteCanvas.getContext("2d");
    }
    if (!metaballColorCanvas) {
        metaballColorCanvas = document.createElement("canvas");
        metaballColorCtx = metaballColorCanvas.getContext("2d");
    }
    if (!metaballMaskCanvas) {
        metaballMaskCanvas = document.createElement("canvas");
        metaballMaskCtx = metaballMaskCanvas.getContext("2d");
    }
    if (metaballWhiteCanvas.width !== w || metaballWhiteCanvas.height !== h) {
        metaballWhiteCanvas.width = metaballColorCanvas.width = metaballMaskCanvas.width = w;
        metaballWhiteCanvas.height = metaballColorCanvas.height = metaballMaskCanvas.height = h;
    }
}

function beginMetaballLayer() {
    resizeMetaballBuffers();
    metaballWhiteCtx.clearRect(0, 0, canvas.width, canvas.height);
    metaballColorCtx.clearRect(0, 0, canvas.width, canvas.height);
}

// ============================================================
// SQUASH & STRETCH — màng tế bào biến dạng theo vận tốc / va chạm
// ============================================================
function updateBodyDeform(body, dt, vx, vy, maxSpeed) {
    const prevX = body._prevX ?? body.x;
    const prevY = body._prevY ?? body.y;
    if (vx === undefined || vy === undefined) {
        vx = (body.x - prevX) / Math.max(dt, 0.001);
        vy = (body.y - prevY) / Math.max(dt, 0.001);
    }
    body._prevX = body.x;
    body._prevY = body.y;
    const speed = Math.hypot(vx, vy);
    maxSpeed = Math.max(maxSpeed || 200, 1);
    const moveStretch = Math.min(0.42, (speed / maxSpeed) * 0.38);
    if (speed > 15) body._squashAngle = Math.atan2(vy, vx);
    body._hitPulse = Math.max(0, (body._hitPulse || 0) - dt * 5.5);
    let squash = Math.max(moveStretch, body._hitPulse);
    if (speed < 25) squash *= 0.88;
    body._squash = squash;
}

function triggerHitSquash(body, amount) {
    body._hitPulse = Math.max(body._hitPulse || 0, amount == null ? 0.3 : amount);
}

function getEntityDeform(entity) {
    return { squash: entity._squash || 0, angle: entity._squashAngle || 0 };
}

function traceCellShape(c, type, size) {
    c.beginPath();
    switch (type) {
        case "triangle": {
            const s = size * 1.05;
            c.moveTo(0, -s);
            c.lineTo(s * 0.92, s * 0.55);
            c.lineTo(-s * 0.92, s * 0.55);
            c.closePath();
            break;
        }
        case "rhombus": {
            const s = size * 0.95;
            c.moveTo(0, -s);
            c.lineTo(s * 0.8, 0);
            c.lineTo(0, s);
            c.lineTo(-s * 0.8, 0);
            c.closePath();
            break;
        }
        case "biofilm":
            c.ellipse(0, 0, size * 1.22, size * 0.7, 0, 0, Math.PI * 2);
            break;
        case "spreader":
            c.arc(0, 0, size, 0, Math.PI * 2);
            break;
        default:
            c.arc(0, 0, size, 0, Math.PI * 2);
    }
}

function fillCellOnLayer(layer, type, size, color) {
    layer.fillStyle = layer === metaballWhiteCtx ? "#ffffff" : color;
    traceCellShape(layer, type, size);
    layer.fill();
}

function drawMetaballShape(type, wx, wy, size, color, deform) {
    const sx = wx - camX, sy = wy - camY;
    const pad = size * 3.2;
    if (sx + pad < 0 || sx - pad > canvas.width || sy + pad < 0 || sy - pad > canvas.height) return;
    const squ = deform && deform.squash > 0.02 ? deform.squash : 0;
    const ang = deform ? deform.angle : 0;
    for (const layer of [metaballWhiteCtx, metaballColorCtx]) {
        layer.save();
        layer.translate(sx, sy);
        if (type === "triangle") layer.rotate(ang + Math.PI / 2);
        else if (squ > 0) layer.rotate(ang);
        if (squ > 0) layer.scale(1 + squ, 1 - squ * 0.72);
        fillCellOnLayer(layer, type, size, color);
        layer.restore();
    }
}

function drawSpreaderCluster(wx, wy, size, color, deform) {
    const r = size * 0.38;
    const lobes = [[0, 0], [size * 0.5, 0], [-size * 0.5, 0], [0, size * 0.46], [0, -size * 0.46]];
    for (let i = 0; i < lobes.length; i++) {
        drawMetaballShape("circle", wx + lobes[i][0], wy + lobes[i][1], r, color, deform);
    }
}

function flushMetaballLayer() {
    metaballMaskCtx.clearRect(0, 0, canvas.width, canvas.height);
    metaballMaskCtx.filter = "url(#plasmaMetaball)";
    metaballMaskCtx.drawImage(metaballWhiteCanvas, 0, 0);
    metaballMaskCtx.filter = "none";

    ctx.save();
    ctx.drawImage(metaballMaskCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(metaballColorCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
}

function drawEntityMetaball(type, wx, wy, size, color, deform, opts) {
    if (type === "spreader" && size >= 9 && !(opts && opts.isSpreaderMini)) {
        drawSpreaderCluster(wx, wy, size, color, deform);
        return;
    }
    let drawType = type;
    let drawSize = size;
    if (type === "spreader") {
        drawType = "circle";
        drawSize = size * 0.95;
    } else if (type === "triangle") drawSize = size * 0.9;
    else if (type === "rhombus") drawSize = size * 0.92;
    else if (type === "biofilm") drawSize = size * 0.95;
    drawMetaballShape(drawType, wx, wy, drawSize, color, deform);
}

function drawPlayerMetaball() {
    const d = getEntityDeform(player);
    const r = player.size / 2;
    drawMetaballShape("circle", player.x, player.y, r * 1.15, player.color, d);
    drawMetaballShape("circle", player.x, player.y, r * 0.45, "#ffffff", d);
}

// ============================================================
// OBJECT POOLS
// ============================================================
const bulletPool = [];
const particlePool = [];

function getBullet(x, y, vx, vy, speed, damage, pierce, knockback) {
    let bullet;
    if (bulletPool.length > 0) {
        bullet = bulletPool.pop();
        bullet.x = x;
        bullet.y = y;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.dmg = damage;
        bullet.pierceLeft = pierce;
        bullet.kbPower = knockback;
        bullet.size = 2;
        if (!bullet.hitTargets) bullet.hitTargets = new Set();
        bullet.hitTargets.clear();
    } else {
        bullet = { x, y, vx, vy, dmg: damage, pierceLeft: pierce, kbPower: knockback, size: 2, hitTargets: new Set() };
    }
    return bullet;
}

function recycleBullet(bullet) {
    if (!bullet) return;
    bullet.x = 0;
    bullet.y = 0;
    bullet.vx = 0;
    bullet.vy = 0;
    if (!bullet.hitTargets) bullet.hitTargets = new Set();
    bullet.hitTargets.clear();
    bulletPool.push(bullet);
}

function getParticle(x, y, vx, vy, radius, color) {
    let p = particlePool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.radius = radius; p.alpha = 1; p.color = color;
    return p;
}

function recycleParticle(p) {
    if (!p) return;
    particlePool.push(p);
}

// ============================================================
// LOCAL STORAGE — HIGH SCORE
// ============================================================
function loadHighScore() {
    try { highScore = parseInt(localStorage.getItem("biodefense_hiscore") || "0") || 0; }
    catch(e) { highScore = 0; }
    if (dom.menuHiScoreVal) dom.menuHiScoreVal.innerText = highScore;
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
    if (dom.volumeVal) dom.volumeVal.innerText = val + "%";
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
    bomb: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.22);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(320, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.28 * globalVolumeModifier, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.22);
        osc.start(); osc.stop(audioCtx.currentTime + 0.22);
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
const getDistSq = (x1, y1, x2, y2) => {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy;
};
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
    if (metaballWhiteCanvas) resizeMetaballBuffers();
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
    if (!player || !dom.xpBarFill) return;
    dom.xpBarFill.style.width = Math.min(100, (player.xp / player.xpNeeded) * 100) + "%";
}

function updateCamera() {
    if (!player) return;
    // Center camera on player
    camX = Math.max(0, Math.min(WORLD_W - canvas.width, player.x - canvas.width / 2));
    camY = Math.max(0, Math.min(WORLD_H - canvas.height, player.y - canvas.height / 2));
}

function renderUpgradeTracker() {
    try {
        if (!player || !dom.upgradeTracker || !dom.upgradeList || !dom.comboList) return;
        if (typeof ALL_UPGRADES === "undefined" || typeof SYNERGY_CORES === "undefined") return;
        
        const selectedGenes = ALL_UPGRADES.filter(u => (player.genesTaken[u.id] || 0) > 0);
        dom.upgradeList.innerHTML = selectedGenes.length
            ? selectedGenes.map(u => `<span class="upgrade-chip">${u.title} <span class="upgrade-count">x${player.genesTaken[u.id]}</span></span>`).join("")
            : `<div class="upgrade-empty">Chưa có đột biến nào được chọn.</div>`;

        const comboEntries = SYNERGY_CORES.map(core => {
            const owned = core.requires.filter(id => (player.genesTaken[id] || 0) > 0);
            const missing = core.requires.filter(id => (player.genesTaken[id] || 0) === 0);
            const unlocked = player.synergiesUnlocked[core.id];
            const ready = !unlocked && missing.length === 0;
            const title = `${core.title}`;
            const status = unlocked ? `✅ Đã kích hoạt` : ready ? `✨ Sẵn sàng` : `${owned.length}/${core.requires.length}`;
            const effectText = core.desc;
            return { title, status, effectText, unlocked, ready };
        });

        dom.comboList.innerHTML = comboEntries.map(entry => `
            <div class="combo-entry ${entry.unlocked ? "unlocked" : entry.ready ? "ready" : "pending"}">
                <div class="combo-title">${entry.title}</div>
                <div class="combo-meta">${entry.status}</div>
                <div class="combo-requirements">${entry.effectText}</div>
            </div>
        `).join("");
    } catch (e) {
        console.error("renderUpgradeTracker error:", e);
    }
}

function renderPauseStats() {
    if (!player || !dom.pauseStatList) return;
    const stats = [
        { label: "Cấp độ", value: player.level },
        { label: "Máu", value: `${player.hp}/${player.maxHp}` },
        { label: "Sát thương", value: player.damage },
        { label: "Số tia", value: player.bulletCount },
        { label: "Tốc độ bắn", value: `${Math.round(player.fireRate)} ms` },
        { label: "Tốc độ chạy", value: `${Math.round(player.speed)}` },
        { label: "Tầm bắn", value: `${Math.round(player.shootRange)}` },
        { label: "Tỉ lệ XP", value: `${player.xpRate.toFixed(2)}x` },
        { label: "Tầm hút", value: `${Math.round(player.magnetRange)}` },
        { label: "Tốc độ hút", value: `${Math.round(player.gemSpeed)}` },
        { label: "Xuyên thấu", value: player.pierce },
        { label: "Đẩy lùi", value: player.knockback }
    ];
    dom.pauseStatList.innerHTML = stats.map(stat =>
        `<div class="stat-row"><span>${stat.label}</span><strong>${stat.value}</strong></div>`
    ).join("");
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
let joystickEventsAttached = false;
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
    const base = dom.joystickBase;
    const thumb = dom.joystickThumb;

    if (!joystickEventsAttached) {
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
        joystickEventsAttached = true;
    }
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
    drawBiofilmTrails();
    beginMetaballLayer();
    enemies.forEach(e => drawEntityMetaball(e.type, e.x, e.y, e.size, e.color, getEntityDeform(e), { isSpreaderMini: e.isSpreaderMini }));
    bosses.forEach(b => drawEntityMetaball(b.type, b.x, b.y, b.size, b.color, getEntityDeform(b)));
    drawPlayerMetaball();
    flushMetaballLayer();
    bullets.forEach(b => {
        const sx = b.x - camX, sy = b.y - camY;
        ctx.fillStyle = "#ffb3d9"; ctx.beginPath(); ctx.arc(sx, sy, b.size, 0, 2*Math.PI); ctx.fill();
    });
    gems.forEach(g => ctx.drawImage(glowCacheCanvas, g.x - camX - 20, g.y - camY - 20));
    drops.forEach(d => drawPickupDrop(d));
}

function isEntityOnScreen(wx, wy, pad) {
    pad = pad || 0;
    const sx = wx - camX, sy = wy - camY;
    return sx >= -pad && sx <= canvas.width + pad && sy >= -pad && sy <= canvas.height + pad;
}

function drawPickupDrop(d) {
    const dsx = d.x - camX, dsy = d.y - camY;
    if (d.type === "bomb") {
        ctx.save();
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#ff5500";
        ctx.beginPath();
        ctx.arc(dsx, dsy, d.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffcc66";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💣", dsx, dsy);
        ctx.restore();
        return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(dsx, dsy, d.size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.type === "magnet" ? "🧲" : "🩹", dsx, dsy);
}

function drawWorldBackground() {
    const tile = 40;
    const majorStep = tile * 5;
    const col0 = Math.floor(camX / tile);
    const col1 = Math.ceil((camX + canvas.width) / tile);
    const row0 = Math.floor(camY / tile);
    const row1 = Math.ceil((camY + canvas.height) / tile);

    const bg = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.3, canvas.width * 0.1, canvas.width * 0.5, canvas.height * 0.6, Math.max(canvas.width, canvas.height) * 0.8);
    bg.addColorStop(0, "#2c0415");
    bg.addColorStop(0.55, "#18030b");
    bg.addColorStop(1, "#070205");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = row0; row <= row1; row++) {
        for (let col = col0; col <= col1; col++) {
            const sx = col * tile - camX;
            const sy = row * tile - camY;
            const light = (col + row) % 2 === 0;
            ctx.fillStyle = light ? "#2d0918" : "#19040d";
            ctx.fillRect(sx, sy, tile + 1, tile + 1);
            const cx = sx + tile / 2, cy = sy + tile / 2;
            ctx.fillStyle = light ? "rgba(255, 110, 135, 0.35)" : "rgba(255, 95, 120, 0.2)";
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = light ? "rgba(255, 130, 160, 0.16)" : "rgba(255, 85, 105, 0.1)";
            ctx.fillRect(sx + 2, sy + 2, 3, 3);
            ctx.fillRect(sx + tile - 5, sy + tile - 5, 3, 3);
        }
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(180, 70, 95, 0.32)";
    const offX = camX % tile;
    const offY = camY % tile;
    for (let x = -offX; x <= canvas.width + tile; x += tile) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = -offY; y <= canvas.height + tile; y += tile) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(240, 120, 145, 0.42)";
    const majorOffX = camX % majorStep;
    const majorOffY = camY % majorStep;
    for (let x = -majorOffX; x <= canvas.width + majorStep; x += majorStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = -majorOffY; y <= canvas.height + majorStep; y += majorStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    drawWorldBorder();
}

function applyGameVersionLabels() {
    const label = "Version " + GAME_VERSION;
    if (dom.menuVersion) dom.menuVersion.textContent = label;
    if (dom.hudVersion) dom.hudVersion.textContent = label;
    document.title = "BIO-DEFENSE: LEUKOCYTE v" + GAME_VERSION;
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
            const distSq = dx*dx + dy*dy;
            if (distSq < SEPARATION_RADIUS * SEPARATION_RADIUS && distSq > 0) {
                const dist = Math.sqrt(distSq);
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
    const hintBox = dom.globalHint;
    let _gpList; try { _gpList = navigator.getGamepads(); } catch(e) { _gpList = []; }
    const isGamepad = (currentControlMode === "gamepad" || (_gpList[0] || false));
    const isMobile = currentControlMode === "touch";
    if (dom.mainMenu.style.display !== "none") {
        hintBox.innerHTML = isMobile ? "Chạm vào nút để chọn" :
            isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn" :
            "Dùng phím <span>W / S</span> hoặc <span>Mũi tên</span> để Duyệt • Nhấn <span>ENTER / SPACE</span> để Chọn";
        hintBox.style.display = "block"; return;
    }
    if (dom.optionsScreen.style.display === "block") {
        if (optFocusIndex === 3) {
            hintBox.innerHTML = isGamepad ? "Dùng <span>Analog Trái / D-Pad (Trái/Phải)</span> để tăng giảm âm lượng • Nhấn <span>(B)</span> để Hủy" :
                "Dùng phím <span>A / D</span> hoặc <span>Mũi Tên Trái / Phải</span> để tăng giảm âm lượng";
        } else {
            hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn • Nhấn <span>(B)</span> để Quay lại" :
                "Dùng phím <span>W / S</span> để Duyệt • Nhấn <span>ENTER</span> để Kích hoạt • Nhấn <span>ESC</span> để Hủy";
        }
        hintBox.style.display = "block"; return;
    }
    if (dom.pauseScreen.style.display === "block") {
        hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad</span> để chọn • Nhấn <span>(A)</span> để Thực thi • Nhấn <span>(B)</span> để Tiếp tục" :
            "Dùng phím <span>W / S</span> để chọn • Nhấn <span>ENTER</span> để Thực thi • Nhấn <span>ESC</span> để Tiếp tục";
        hintBox.style.display = "block"; return;
    }
    if (dom.upgradeScreen.style.display === "block") {
        hintBox.innerHTML = isMobile ? "Chạm vào thẻ gene để hấp thụ đột biến" :
            isGamepad ? "Dùng <span>D-Pad</span> chọn chuỗi gen • Nhấn <span>(A)</span> để hấp thụ Đột biến" :
            "Dùng phím <span>W / S</span> chọn chuỗi gen • Nhấn <span>ENTER</span> để hấp thụ Đột biến";
        hintBox.style.display = "block"; return;
    }
    if (dom.gameOverScreen.style.display === "block") {
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
    applyGameVersionLabels();
    dom.mainMenu.style.display = "none";
    ["gameCanvas","ui","xpBar","hudVersion"].forEach(id => document.getElementById(id).style.display = "block");
    isPlaying = true; isPausedByOptions = mouseLockout = false;
    resizeCanvas(); createGlowCache(); init();
    updateModeDisplay(); setCanvasCursor(false);
    setupMobileJoystick(); updateGlobalHint();
}

function togglePauseMenu() {
    if (!isPlaying || isGameOver || isUpgrading || dom.optionsScreen.style.display === "block") return;
    isPausedByOptions = !isPausedByOptions; SFX.menuSelect();
    if (isPausedByOptions) {
        setCanvasCursor(true);
        dom.pauseScreen.style.display = "block";
        renderUpgradeTracker();
        renderPauseStats();
        pauseMenuFocusIndex = 0; renderPauseMenuFocus();
    } else {
        dom.pauseScreen.style.display = "none";
        clearMousePosition(); setCanvasCursor(false);
        mouseLockout = true; setTimeout(() => mouseLockout = false, 200);
    }
    updateGlobalHint();
}

function openOptions() {
    initAudio(); SFX.menuSelect();
    dom.optionsScreen.style.display = "block";
    const modeInput = document.querySelector(`input[name="controlModeOpt"][value="${currentControlMode}"]`);
    if (modeInput) modeInput.checked = true;
    optFocusIndex = ["keyboard","mouse","gamepad"].indexOf(currentControlMode);
    if (optFocusIndex < 0) optFocusIndex = 0;
    renderOptionsFocus(); updateGlobalHint();
}
function openOptionsFromPause() { dom.pauseScreen.style.display = "none"; openOptions(); }

function closeOptions(isSaved) {
    SFX.menuSelect();
    if (isSaved) {
        let _gp2; try { _gp2 = navigator.getGamepads()[0]; } catch(e) { _gp2 = null; }
        if (currentControlMode === "gamepad" || _gp2) {
            currentControlMode = ["keyboard","mouse","gamepad"][Math.min(optFocusIndex, 2)] || currentControlMode;
        } else {
            const selected = dom.controlModeInputs;
            for (let i = 0; i < selected.length; i++) if (selected[i].checked) { currentControlMode = selected[i].value; break; }
        }
        updateModeDisplay();
        if (isPlaying) setupMobileJoystick();
    }
    dom.optionsScreen.style.display = "none";
    clearMousePosition();
    if (isPlaying) { dom.pauseScreen.style.display = "block"; pauseMenuFocusIndex = 1; renderPauseMenuFocus(); }
    else updateGlobalHint();
}

function setCanvasCursor(show) { canvas.style.cursor = show ? "default" : "none"; }
function clearMousePosition() { mouseX = mouseY = null; }
function updateModeDisplay() {
    dom.currentModeDisplay.innerText = {keyboard:"Bàn phím (WASD)",mouse:"Chuột (Mouse)",gamepad:"Tay cầm (Gamepad)",touch:"Cảm ứng (Mobile)"}[currentControlMode] || "Bàn phím";
}

function exitGame() {
    SFX.menuSelect();
    if (confirm("Xác nhận đóng liên kết phòng vệ sinh học?")) { window.close(); alert("Hãy đóng tab để thoát."); }
}

function backToMenu() {
    SFX.menuSelect(); isPlaying = isPausedByOptions = false;
    ["bossWarning","gameCanvas","ui","hudVersion","gameOverScreen","optionsScreen","upgradeScreen","pauseScreen","xpBar","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    dom.joystickContainer.style.display = "none";
    dom.mainMenu.style.display = "flex";
    loadHighScore(); mainMenuFocusIndex = 0; renderMainMenuFocus(); updateGlobalHint();
}

function init() {
    player = {
        x: WORLD_W/2, y: WORLD_H/2, size: 24, speed: 252,
        hp: 3, maxHp: 3, level: 1, xp: 0, xpNeeded: 12,
        fireRate: 400, magnetRange: 75, gemSpeed: 330,
        color: "#f5f0f0", damage: 1, bulletCount: 1, xpRate: 1,
        shootRange: 420, pierce: 1, knockback: 0,
        genesTaken: {}, synergiesUnlocked: {},
        synergyAoE: 0, synergySplitBuff: false, synergyToxinRadar: false,
        _squash: 0, _hitPulse: 0, _squashAngle: 0, _prevX: WORLD_W / 2, _prevY: WORLD_H / 2
    };
    lastUpgradePicked = null;
    bullets = []; enemies = []; bosses = []; particles = []; gems = []; drops = []; biofilmTrails = [];
    score = spawnTimer = bossCount = enemyIdCounter = 0;
    nextBossScore = 40;
    isGameOver = isUpgrading = false;
    lastFrameTime = 0;
    camX = WORLD_W/2 - window.innerWidth/2;
    camY = WORLD_H/2 - window.innerHeight/2;
    ["gameOverScreen","upgradeScreen","bossWarning","pauseScreen","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    clearMousePosition(); updateUI(); renderUpgradeTracker(); updateGlobalHint();
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
    renderUpgradeTracker();
    renderPauseStats();
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
applyGameVersionLabels();
renderMainMenuFocus();
updateGlobalHint();
animationFrameId = requestAnimationFrame(gameLoop);
