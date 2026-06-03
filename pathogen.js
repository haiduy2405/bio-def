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

// ============================================================
// PATHOGEN TYPES — Spreader & Biofilm Carrier
// ============================================================
const MAX_BIOFILM_TRAILS = 110;
const MAX_ENEMIES = 160;
const MAX_SPREADER_SPLITS_PER_FRAME = 4;
const BIOFILM_SLOW_MULT = 0.5;
let spreaderSplitsThisFrame = 0;

function ensureBiofilmTrails() {
    if (!biofilmTrails) biofilmTrails = [];
}

function gemSizeForEnemy(e) {
    if (e.type === "rhombus") return 7;
    if (e.type === "spreader" && e.isSpreaderMini) return 4;
    return 5;
}

function spawnSpreaderSplit(x, y) {
    if (spreaderSplitsThisFrame >= MAX_SPREADER_SPLITS_PER_FRAME) return;
    if (enemies.length >= MAX_ENEMIES) return;
    const count = 3 + Math.floor(Math.random() * 2);
    const slots = Math.min(count, MAX_ENEMIES - enemies.length);
    for (let i = 0; i < slots; i++) {
        const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        let dist = 28 + Math.random() * 18;
        let sx = x + Math.cos(a) * dist;
        let sy = y + Math.sin(a) * dist;
        const pd = getDist(sx, sy, player.x, player.y);
        if (pd < player.size + 36) {
            const pushA = Math.atan2(sy - player.y, sx - player.x);
            sx = player.x + Math.cos(pushA) * (player.size + 40);
            sy = player.y + Math.sin(pushA) * (player.size + 40);
        }
        sx = Math.max(8, Math.min(WORLD_W - 8, sx));
        sy = Math.max(8, Math.min(WORLD_H - 8, sy));
        enemies.push({
            id: enemyIdCounter++,
            type: "spreader",
            isSpreaderMini: true,
            x: sx,
            y: sy,
            size: 7,
            speed: (3.8 + Math.random() * 1.2) * 60,
            hp: 1,
            maxHp: 1,
            color: "#ff55ee",
            _sepX: 0,
            _sepY: 0
        });
    }
    spreaderSplitsThisFrame++;
    createExplosion(x, y, "#cc44ff", 14);
}

function rollDropType() {
    const r = Math.random();
    if (r < 0.14) return "bomb";
    if (r < 0.57) return "magnet";
    return "heal";
}

function trySpawnDrop(x, y, size, chance) {
    if (chance == null) chance = 0.015;
    if (Math.random() < chance) drops.push({ x, y, type: rollDropType(), size: size || 9 });
}

function onBossKilled(b) {
    createExplosion(b.x, b.y, b.color, 45);
    SFX.hurt();
    triggerScreenShake(10, 0.4);
    for (let i = 0; i < 15; i++) {
        gems.push({ x: b.x + 50 * (Math.random() - 0.5), y: b.y + 50 * (Math.random() - 0.5), size: 5.5, magnetizedByItem: false });
    }
    trySpawnDrop(b.x, b.y, 10, 0.12);
    spawnScorePopup(b.x, b.y, 10);
    score += 10;
    updateUI();
}

function activateScreenBomb() {
    SFX.bomb();
    triggerScreenShake(14, 0.4);
    createExplosion(player.x, player.y, "#ff9900", 40);
    const flash = document.getElementById("hitFlash");
    if (flash) {
        flash.style.background = "rgba(255, 120, 40, 0.3)";
        flash.classList.add("active");
        setTimeout(() => {
            flash.classList.remove("active");
            flash.style.background = "";
        }, 100);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!isEntityOnScreen(e.x, e.y, e.size + 10)) continue;
        e.hp -= SCREEN_BOMB_DAMAGE;
        triggerHitSquash(e, 0.26);
        createExplosion(e.x, e.y, "#ffaa44", 10);
        if (e.hp <= 0) {
            onEnemyKilled(e, true);
            enemies.splice(i, 1);
        }
    }

    for (let i = bosses.length - 1; i >= 0; i--) {
        const b = bosses[i];
        if (!isEntityOnScreen(b.x, b.y, b.size + 16)) continue;
        b.hp -= SCREEN_BOMB_DAMAGE;
        triggerHitSquash(b, 0.3);
        createExplosion(b.x, b.y, "#ff6600", 14);
        if (b.hp <= 0) {
            onBossKilled(b);
            bosses.splice(i, 1);
        }
    }
    updateUI();
}

function onEnemyKilled(e, withRewards) {
    // Chỉ tách khi bị kháng thể tiêu diệt — tránh bùng mini ngay trên người chơi khi va chạm
    if (withRewards && e.type === "spreader" && !e.isSpreaderMini) spawnSpreaderSplit(e.x, e.y);
    if (!withRewards) return;
    gems.push({ x: e.x, y: e.y, size: gemSizeForEnemy(e), magnetizedByItem: false });
    trySpawnDrop(e.x, e.y, 9);
    spawnScorePopup(e.x, e.y, 1);
    score++;
    updateUI();
}

function buildEnemy(type, x, y) {
    const lvl = player.level;
    const base = { id: enemyIdCounter++, type, x, y, _sepX: 0, _sepY: 0 };
    if (type === "spreader") {
        return Object.assign(base, {
            size: 16,
            speed: (0.85 + Math.random() * 0.35 + lvl * 0.04) * 60,
            hp: 2 + Math.floor(lvl / 6),
            maxHp: 2 + Math.floor(lvl / 6),
            color: "#cc44ff",
            isSpreaderMini: false
        });
    }
    if (type === "biofilm") {
        const hp = 2 + Math.floor(lvl / 5);
        return Object.assign(base, {
            size: 15,
            speed: (0.45 + Math.random() * 0.15 + lvl * 0.02) * 60,
            hp,
            maxHp: hp,
            color: "#8b5cf6",
            _trailTimer: 0
        });
    }
    let size = 12, speed = 0.7 * (1.3 * Math.random() + 1.2 + 0.1 * lvl) * 60, hp = 1, color = "#4df333";
    if (type === "triangle") { size = 10; speed = 0.75 * (1.1 * Math.random() + 2.7 + 0.1 * lvl) * 60; color = "#ffcc00"; }
    else if (type === "rhombus") { size = 14; speed = (0.5 * Math.random() + 0.7 + 0.05 * lvl) * 60; hp = 3 + Math.floor(lvl / 4); color = "#33ccff"; }
    if (lvl >= 7 && lvl < 10) hp = Math.floor(1.2 * hp) || 1;
    if (lvl >= 10) {
        const mult = 1.2 + 0.2 * (Math.floor((lvl - 10) / 5) + 1);
        hp = Math.floor(hp * mult);
        speed *= mult;
    }
    return Object.assign(base, { size, speed, hp, maxHp: hp, color });
}

function pickSpawnType() {
    const allowed = ["circle"];
    if (player.level >= 2) allowed.push("triangle");
    if (player.level >= 3) allowed.push("rhombus");
    if (player.level >= 5) allowed.push("spreader");
    if (player.level >= 6) allowed.push("biofilm");
    let chosen = allowed[Math.floor(Math.random() * allowed.length)];
    if (player.level >= 10 && chosen === "rhombus" && Math.random() < 0.4) {
        chosen = Math.random() < 0.5 ? "circle" : "triangle";
    }
    return chosen;
}

function depositBiofilmTrail(e, dt) {
    if (e.type !== "biofilm") return;
    ensureBiofilmTrails();
    e._trailTimer = (e._trailTimer || 0) - dt;
    if (e._trailTimer > 0) return;
    e._trailTimer = 0.14;
    if (biofilmTrails.length >= MAX_BIOFILM_TRAILS) biofilmTrails.shift();
    biofilmTrails.push({ x: e.x, y: e.y, radius: 17, life: 9, maxLife: 9 });
}

function updateBiofilmTrails(dt) {
    ensureBiofilmTrails();
    for (let i = biofilmTrails.length - 1; i >= 0; i--) {
        biofilmTrails[i].life -= dt;
        if (biofilmTrails[i].life <= 0) biofilmTrails.splice(i, 1);
    }
}

function getBiofilmSlowMult() {
    if (!player) return 1;
    ensureBiofilmTrails();
    for (let i = 0; i < biofilmTrails.length; i++) {
        const t = biofilmTrails[i];
        if (getDist(player.x, player.y, t.x, t.y) < t.radius + player.size * 0.4) return BIOFILM_SLOW_MULT;
    }
    return 1;
}

function drawBiofilmTrails() {
    ensureBiofilmTrails();
    for (let i = 0; i < biofilmTrails.length; i++) {
        const t = biofilmTrails[i];
        const sx = t.x - camX, sy = t.y - camY;
        if (sx + t.radius < 0 || sx - t.radius > canvas.width || sy + t.radius < 0 || sy - t.radius > canvas.height) continue;
        const alpha = 0.22 + 0.38 * (t.life / t.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#5a2d7a";
        ctx.beginPath();
        ctx.arc(sx, sy, t.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "rgba(180, 100, 255, 0.25)";
        ctx.beginPath();
        ctx.arc(sx, sy, t.radius * 0.55, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// GAME FRAME LOGIC - ENEMIES & COLLISIONS
// ============================================================
function applySynergySplashDamage(hitX, hitY, dmg, excludeId) {
    if (!player.synergyAoE) return;
    const splash = Math.max(1, Math.floor(dmg * player.synergyAoE));
    const r = 42;
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.id === excludeId) continue;
        if (getDist(hitX, hitY, e.x, e.y) < r + e.size) {
            e.hp -= splash;
            triggerHitSquash(e, 0.22);
            createExplosion(e.x, e.y, e.color, 3);
            if (e.hp <= 0) {
                onEnemyKilled(e, true);
                enemies.splice(i, 1);
            }
        }
    }
}

function runGameFrame(dt, timestamp) {
    spreaderSplitsThisFrame = 0;
    drawWorldBackground();
    updateBiofilmTrails(dt);
    drawBiofilmTrails();
    beginMetaballLayer();
    const moveSpeedMult = getBiofilmSlowMult();

    // Spawn boss
    if (score >= nextBossScore) { spawnBoss(); nextBossScore += 40; }

    // ---- Player movement ----
    let moveX = 0, moveY = 0;
    if (currentControlMode === "touch" && joystickActive) {
        const mag = Math.hypot(joystickDX, joystickDY);
        if (mag > 0.08) { moveX = joystickDX; moveY = joystickDY; }
    } else if (currentControlMode === "mouse" && mouseX !== null && mouseY !== null && !mouseLockout) {
        // Mouse position is in screen coords; convert to world target
        const wx = mouseX + camX, wy = mouseY + camY;
        const dist = getDist(wx, wy, player.x, player.y);
        if (dist > 5) { moveX = (wx - player.x) / dist; moveY = (wy - player.y) / dist; }
    } else if (currentControlMode === "gamepad") {
        moveX = keys["_gpx"] || 0; moveY = keys["_gpy"] || 0;
    } else if (currentControlMode === "keyboard") {
        if (keys.w || keys.arrowup) moveY -= 1;
        if (keys.s || keys.arrowdown) moveY += 1;
        if (keys.a || keys.arrowleft) moveX -= 1;
        if (keys.d || keys.arrowright) moveX += 1;
        const mag2 = Math.hypot(moveX, moveY);
        if (mag2 > 1) { moveX /= mag2; moveY /= mag2; }
    }

    const spd = player.speed * moveSpeedMult;
    const pvx = moveX * spd, pvy = moveY * spd;
    if (currentControlMode === "mouse" && mouseX !== null) {
        player.x += pvx * dt;
        player.y += pvy * dt;
    } else {
        player.x += pvx * dt;
        player.y += pvy * dt;
    }
    updateBodyDeform(player, dt, pvx, pvy, spd);

    // Clamp player to world
    player.x = Math.max(player.size/2, Math.min(WORLD_W - player.size/2, player.x));
    player.y = Math.max(player.size/2, Math.min(WORLD_H - player.size/2, player.y));

    // Update camera
    updateCamera();

    // ---- Shooting ----
    if (timestamp - lastShotTime > player.fireRate && (enemies.length > 0 || bosses.length > 0)) {
        let target = null, minDist = Infinity;
        bosses.forEach(b => { const d = getDist(b.x,b.y,player.x,player.y); if (d < minDist) { minDist=d; target=b; } });
        if (minDist > 300) enemies.forEach(e => { const d = getDist(e.x,e.y,player.x,player.y); if (d < minDist) { minDist=d; target=e; } });
        if (target && (minDist < player.shootRange || minDist <= player.size)) {
            const baseAngle = Math.atan2(target.y-player.y, target.x-player.x);
            const offsets = [[], [0], [-.08,.08], [-.15,0,.15], [-.18,-.06,.06,.18], [-.22,-.11,0,.11,.22]][player.bulletCount];
            // NERF: each split ray does 60% of base damage (rounded up, min 1)
            const splitRatio = player.synergySplitBuff ? 0.8 : 0.6;
            const splitDmg = player.bulletCount > 1
                ? Math.max(1, Math.ceil(player.damage * splitRatio))
                : player.damage;
            offsets.forEach(offset => {
                bullets.push(getBullet(player.x, player.y, Math.cos(baseAngle+offset), Math.sin(baseAngle+offset), 4.0, splitDmg, player.pierce, player.knockback));
            });
            lastShotTime = timestamp; SFX.shoot();
        }
    }

    // ---- Bullets ----
    for (let bIdx = bullets.length-1; bIdx >= 0; bIdx--) {
        const b = bullets[bIdx];
        b.x += b.vx * 540 * dt;
        b.y += b.vy * 540 * dt;
        spawnBulletTrail(b.x, b.y);
        // Cull if out of world or far from screen
        if (b.x < -20 || b.x > WORLD_W+20 || b.y < -20 || b.y > WORLD_H+20) { recycleBullet(b); bullets.splice(bIdx,1); }
    }

    // ---- Spawn enemies ----
    spawnTimer += dt * 60;
    const spawnRate = player.level >= 6 ? Math.max(8, Math.floor(0.7 * Math.max(12, 45 - 2*player.level))) : Math.max(12, 45-2*player.level);
    if (spawnTimer > spawnRate && enemies.length < MAX_ENEMIES) {
        const coords = getSpawnCoords(25);
        const chosen = pickSpawnType();
        enemies.push(buildEnemy(chosen, coords.x, coords.y));
        spawnTimer = 0;
    }

    // ---- Build spatial hash for this frame ----
    spatialHash.clear();
    enemies.forEach(e => spatialHash.insert(e));
    bosses.forEach(b => spatialHash.insert(b));

    // ---- Build bullet hash once per frame ----
    bulletSpatialHash.clear();
    bullets.forEach(bu => bulletSpatialHash.insert(bu));

    // ---- Boids separation pass ----
    applySeparation(enemies);

    // ---- Bosses ----
    for (let bIdx = bosses.length-1; bIdx >= 0; bIdx--) {
        const b = bosses[bIdx];
        updateBoss(b, dt);
        updateBodyDeform(b, dt, undefined, undefined, b.speed || b.baseSpeed);
        drawEntityMetaball(b.type, b.x, b.y, b.size, b.color, getEntityDeform(b));
        // Collision with player
        const bossPlayerDistSq = getDistSq(b.x, b.y, player.x, player.y);
        const bossPlayerRadius = player.size / 2 + b.size;
        if (bossPlayerDistSq < bossPlayerRadius * bossPlayerRadius) {
            player.hp--; triggerHitSquash(player, 0.36); createExplosion(player.x,player.y,"#ff3355",20); SFX.hurt(); triggerHitFlash();
            triggerScreenShake(12, 0.35);
            const pAngle = Math.atan2(b.y-player.y, b.x-player.x);
            b.x -= 150*Math.cos(pAngle); b.y -= 150*Math.sin(pAngle);
            updateUI(); if (player.hp <= 0) { triggerScreenShake(18, 0.5); handlePlayerDeath(); break; }
        }
        const nearBossBullets = bulletSpatialHash.query(b.x, b.y, b.size + 8);
        for (const bu of nearBossBullets) {
            if (bu.hitTargets.has(b.id)) continue;
            const dx = b.x - bu.x, dy = b.y - bu.y;
            const collR = b.size + bu.size;
            if (dx*dx + dy*dy >= collR * collR) continue;
            bu.hitTargets.add(b.id); b.hp -= bu.dmg; triggerHitSquash(b, 0.28); SFX.hit();
            if (bu.kbPower > 0) { const bAngle2=Math.atan2(bu.vy,bu.vx); b.x+=Math.cos(bAngle2)*0.3*bu.kbPower; b.y+=Math.sin(bAngle2)*0.3*bu.kbPower; }
            createExplosion(bu.x, bu.y, b.color, 3);
            applySynergySplashDamage(bu.x, bu.y, bu.dmg, b.id);
            bu.pierceLeft--;
            if (bu.pierceLeft <= 0) { recycleBullet(bu); const idx = bullets.indexOf(bu); if (idx >= 0) bullets.splice(idx, 1); }
            if (b.hp <= 0) {
                onBossKilled(b);
                bosses.splice(bIdx, 1);
                break;
            }
        }
    }

    // ---- Enemies — with Boids separation ----
    for (let eIdx = enemies.length-1; eIdx >= 0; eIdx--) {
        const e = enemies[eIdx];
        const angle = Math.atan2(player.y-e.y, player.x-e.x);
        // Chase + separation
        e.x += (Math.cos(angle)*e.speed + (e._sepX||0)) * dt;
        e.y += (Math.sin(angle)*e.speed + (e._sepY||0)) * dt;
        // Clamp to world
        e.x = Math.max(e.size, Math.min(WORLD_W-e.size, e.x));
        e.y = Math.max(e.size, Math.min(WORLD_H-e.size, e.y));
        depositBiofilmTrail(e, dt);
        const evx = Math.cos(angle) * e.speed + (e._sepX || 0);
        const evy = Math.sin(angle) * e.speed + (e._sepY || 0);
        updateBodyDeform(e, dt, evx, evy, e.speed);

        // Only draw if on screen
        const esx = e.x - camX, esy = e.y - camY;
        if (esx > -e.size*2 && esx < canvas.width+e.size*2 && esy > -e.size*2 && esy < canvas.height+e.size*2) {
            drawEntityMetaball(e.type, e.x, e.y, e.size, e.color, getEntityDeform(e), { isSpreaderMini: e.isSpreaderMini });
        }

        if (getDist(e.x,e.y,player.x,player.y) < player.size/2+e.size) {
            player.hp--;
            triggerHitSquash(player, 0.34);
            onEnemyKilled(e, false);
            enemies.splice(eIdx,1);
            createExplosion(player.x,player.y,"#ff3355",10); updateUI(); SFX.hurt(); triggerHitFlash();
            triggerScreenShake(8, 0.25);
            if (player.hp <= 0) { triggerScreenShake(18, 0.5); handlePlayerDeath(); }
        } else {
            // Spatial hash bullet collision
            const nearBullets = bulletSpatialHash.query(e.x, e.y, e.size + 8);
            for (const b of nearBullets) {
                if (b.hitTargets.has(e.id)) continue;
                const dx = e.x - b.x, dy = e.y - b.y;
                const collR = e.size + b.size;
                if (dx*dx + dy*dy >= collR * collR) continue;
                b.hitTargets.add(e.id); e.hp -= b.dmg; triggerHitSquash(e, 0.26); SFX.hit();
                if (b.kbPower > 0) { const bAngle3=Math.atan2(b.vy,b.vx); e.x+=Math.cos(bAngle3)*b.kbPower; e.y+=Math.sin(bAngle3)*b.kbPower; }
                createExplosion(b.x,b.y,e.color,4);
                applySynergySplashDamage(b.x, b.y, b.dmg, e.id);
                b.pierceLeft--;
                if (b.pierceLeft <= 0) { recycleBullet(b); const idx = bullets.indexOf(b); if (idx >= 0) bullets.splice(idx,1); }
                if (e.hp <= 0) {
                    onEnemyKilled(e, true);
                    enemies.splice(eIdx,1);
                    break;
                }
            }
        }
    }

    drawPlayerMetaball();
    flushMetaballLayer();

    // ---- Bullets (sharp antibodies on top of plasma) ----
    for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
        const b = bullets[bIdx];
        const bsx = b.x - camX, bsy = b.y - camY;
        ctx.fillStyle = "#ffb3d9";
        ctx.beginPath(); ctx.arc(bsx, bsy, b.size, 0, 2 * Math.PI); ctx.fill();
    }

    // ---- Boss healthbars (after metaball merge) ----
    bosses.forEach(b => {
        const bsx = b.x - camX, bsy = b.y - camY;
        ctx.fillStyle = "#330a0a"; ctx.fillRect(bsx - b.size, bsy - b.size - 15, 2 * b.size, 6);
        const hpColor = b.phase === 3 ? "#ff6600" : b.phase === 2 ? "#ff6633" : "#ff3355";
        ctx.fillStyle = hpColor; ctx.fillRect(bsx - b.size, bsy - b.size - 15, b.hp / b.maxHp * 2 * b.size, 6);
        for (let p = 1; p <= 3; p++) {
            ctx.fillStyle = b.phase >= p ? hpColor : "#331111";
            ctx.beginPath(); ctx.arc(bsx - b.size + (p - 1) * 14 + 6, bsy - b.size - 22, 4, 0, 2 * Math.PI); ctx.fill();
        }
    });

    // ---- Drops ----
    for (let dIdx = drops.length-1; dIdx >= 0; dIdx--) {
        const d = drops[dIdx];
        drawPickupDrop(d);
        if (getDist(d.x,d.y,player.x,player.y) < player.size/2+d.size) {
            if (d.type === "bomb") {
                createExplosion(d.x, d.y, "#ff8800", 20);
                activateScreenBomb();
            } else {
                createExplosion(d.x,d.y,"#fff",15);
                SFX.item();
                if (d.type==="magnet") gems.forEach(g=>g.magnetizedByItem=true);
                else player.hp = Math.min(player.maxHp, player.hp+1);
            }
            drops.splice(dIdx,1);
            updateUI();
        }
    }

    // ---- Gems ----
    for (let gIdx = gems.length-1; gIdx >= 0; gIdx--) {
        const g = gems[gIdx];
        const dx = player.x-g.x, dy = player.y-g.y, dist = Math.hypot(dx,dy);
        if (dist > 0 && (g.magnetizedByItem || dist < player.magnetRange)) {
            const mult = g.magnetizedByItem ? 2.5 : 1;
            g.x += dx/dist * player.gemSpeed * dt * mult;
            g.y += dy/dist * player.gemSpeed * dt * mult;
        }
        ctx.drawImage(glowCacheCanvas, g.x - camX - 20, g.y - camY - 20);
        if (getDist(g.x,g.y,player.x,player.y) < player.size/2+g.size) {
            player.xp += (g.size>6?2:1) * player.xpRate;
            gems.splice(gIdx,1); SFX.gem();
            if (player.xp >= player.xpNeeded) triggerLevelUp();
            updateUI();
        }
    }

    // ---- Particles ----
    for (let pIdx = particles.length-1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
        p.alpha -= 0.03 * dt * 60;
        if (p.alpha <= 0) { recycleParticle(p); particles.splice(pIdx,1); continue; }
        ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
        ctx.beginPath(); ctx.arc(p.x - camX, p.y - camY, p.radius, 0, 2*Math.PI); ctx.fill();
        ctx.globalAlpha = 1;
    }

    // ---- Bullet trails ----
    updateDrawBulletTrails(dt);

    // ---- Player HP dots ----
    const psx = player.x - camX, psy = player.y - camY;
    const totalDots = player.maxHp, startX = psx - 10*(totalDots-1)/2, dotY = psy - player.size/2 - 14;
    for (let i=0; i<totalDots; i++) {
        ctx.beginPath(); ctx.arc(startX+10*i, dotY, 4, 0, 2*Math.PI);
        ctx.fillStyle = i<player.hp ? "#ff3355" : "#331111"; ctx.fill();
    }

    // ---- Score pop-ups ----
    updateDrawScorePopups(dt);
}
