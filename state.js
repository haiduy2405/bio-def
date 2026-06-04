// ============================================================
// GLOBAL STATE, CONSTANTS, DOM, POOLS & SPATIAL HASH
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
// HELPERS
// ============================================================
const getDistSq = (x1, y1, x2, y2) => {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy;
};
const getDist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

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
