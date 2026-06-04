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

// ============================================================
// PLAYER MOVEMENT, CLAMPING & FIRING
// ============================================================
function processPlayerMovement(dt) {
    const moveSpeedMult = getBiofilmSlowMult();
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
}

function processPlayerShooting(timestamp) {
    if (timestamp - lastShotTime > player.fireRate && (enemies.length > 0 || bosses.length > 0)) {
        let target = null, minDist = Infinity;
        bosses.forEach(b => { const d = getDist(b.x,b.y,player.x,player.y); if (d < minDist) { minDist=d; target=b; } });
        if (minDist > 300) enemies.forEach(e => { const d = getDist(e.x,e.y,player.x,player.y); if (d < minDist) { minDist=d; target=e; } });
        if (target && (minDist < player.shootRange || minDist <= player.size)) {
            const baseAngle = Math.atan2(target.y-player.y, target.x-player.x);
            const offsets = [[], [0], [-.08,.08], [-.15,0,.15], [-.18,-.06,.06,.18], [-.22,-.11,0,.11,.22]][player.bulletCount];
            // BALANCED: each split ray does 70% of base damage (rounded normally, min 1)
            const splitRatio = player.synergySplitBuff ? 0.85 : 0.7;
            const splitDmg = player.bulletCount > 1
                ? Math.max(1, Math.round(player.damage * splitRatio))
                : player.damage;
            offsets.forEach(offset => {
                bullets.push(getBullet(player.x, player.y, Math.cos(baseAngle+offset), Math.sin(baseAngle+offset), 4.0, splitDmg, player.pierce, player.knockback));
            });
            lastShotTime = timestamp; SFX.shoot();
        }
    }
}

function drawPlayerHpDots() {
    const psx = player.x - camX, psy = player.y - camY;
    const totalDots = player.maxHp, startX = psx - 10*(totalDots-1)/2, dotY = psy - player.size/2 - 14;
    for (let i=0; i<totalDots; i++) {
        ctx.beginPath(); ctx.arc(startX+10*i, dotY, 4, 0, 2*Math.PI);
        ctx.fillStyle = i<player.hp ? "#ff3355" : "#331111"; ctx.fill();
    }
}
