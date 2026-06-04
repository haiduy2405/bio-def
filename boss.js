// ============================================================
// BOSS SYSTEM
// ============================================================
function spawnBoss() {
    const coords = getSpawnCoords(50); bossCount++;
    const bossType = bossCount % 2 === 1 ? "circle" : "triangle";
    const scale = player.level >= 10 ? 1 + 0.2 * (Math.floor((player.level-10)/5)+1) : 1;
    let hp = Math.floor((bossType === "circle" ? 60 : 45) * scale * (player.level >= 8 ? 1.3 : 1));
    if (player.level >= 10) hp = Math.floor(1.2 * hp);
    bosses.push({
        id: enemyIdCounter++,
        x: coords.x, y: coords.y, type: bossType,
        size: bossType === "circle" ? 45 : 38,
        baseSpeed: (bossType === "circle" ? 1.3 : 1.8) * (player.level >= 10 ? scale : 1) * 60,
        speed: 0,
        hp, maxHp: hp,
        color: bossType === "circle" ? "#cc0055" : "#e65c00",
        phase: 1,
        dashCooldown: 0,
        orbitAngle: 0,
        behaviorTimer: 0
    });
    document.getElementById("bossWarning").style.display = "block";
    SFX.boss();
    setTimeout(() => document.getElementById("bossWarning").style.display = "none", 3000);
}

function updateBoss(b, dt) {
    const hpRatio = b.hp / b.maxHp;
    if (hpRatio < 0.25 && b.phase < 3) {
        b.phase = 3; createExplosion(b.x, b.y, "#ff6600", 30); SFX.boss();
        document.getElementById("bossWarning").innerText = "⚠️ CUỒNG NỘ CHI BỘ! ⚠️";
        document.getElementById("bossWarning").style.display = "block";
        setTimeout(() => { document.getElementById("bossWarning").innerText = "⚠️ ĐỘC TỐ BIẾN DỊ XUẤT HIỆN! ⚠️"; document.getElementById("bossWarning").style.display = "none"; }, 2000);
    } else if (hpRatio < 0.5 && b.phase < 2) {
        b.phase = 2; createExplosion(b.x, b.y, "#ff3300", 20);
    }

    const angle = Math.atan2(player.y - b.y, player.x - b.x);

    if (b.phase === 1) {
        b.speed = b.baseSpeed;
        if (b.type === "circle") b.hp = Math.min(b.maxHp, b.hp + 0.015 * 60 * dt);
        b.x += Math.cos(angle) * b.speed * dt;
        b.y += Math.sin(angle) * b.speed * dt;
    } else if (b.phase === 2) {
        b.speed = b.baseSpeed * 1.4;
        b.dashCooldown -= dt * 1000;
        if (b.dashCooldown <= 0) {
            b.x += Math.cos(angle) * 80; b.y += Math.sin(angle) * 80;
            b.dashCooldown = 2500 + Math.random() * 1500;
            createExplosion(b.x, b.y, b.color, 8);
        }
        b.x += Math.cos(angle) * b.speed * dt;
        b.y += Math.sin(angle) * b.speed * dt;
    } else {
        b.speed = b.baseSpeed * 1.8;
        b.dashCooldown -= dt * 1000;
        b.orbitAngle += dt * 1.5;
        const orbitX = player.x + Math.cos(b.orbitAngle) * 120;
        const orbitY = player.y + Math.sin(b.orbitAngle) * 120;
        const toOrbitAngle = Math.atan2(orbitY - b.y, orbitX - b.x);
        if (b.dashCooldown <= 0) {
            b.x += Math.cos(angle) * 110; b.y += Math.sin(angle) * 110;
            b.dashCooldown = 1200 + Math.random() * 800;
            createExplosion(b.x, b.y, "#ff6600", 12);
        }
        b.x += Math.cos(toOrbitAngle) * b.speed * dt;
        b.y += Math.sin(toOrbitAngle) * b.speed * dt;
    }
    // Clamp boss to world
    b.x = Math.max(b.size, Math.min(WORLD_W - b.size, b.x));
    b.y = Math.max(b.size, Math.min(WORLD_H - b.size, b.y));
    return angle;
}
