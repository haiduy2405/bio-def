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

function createExplosion(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        particles.push(getParticle(x, y, 5*(Math.random()-.5), 5*(Math.random()-.5), 3*Math.random()+1, color));
    }
}
