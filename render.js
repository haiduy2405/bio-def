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

function applyGameVersionLabels() {
    const label = "Version " + GAME_VERSION;
    if (dom.menuVersion) dom.menuVersion.textContent = label;
    if (dom.hudVersion) dom.hudVersion.textContent = label;
    document.title = "BIO-DEFENSE: LEUKOCYTE v" + GAME_VERSION;
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
        { label: "Tốc độ bắn", value: `${(1000 / player.fireRate).toFixed(1)}/s` },
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
        ctx.shadowBlur = 24;
        ctx.fillStyle = "#ff5500";
        ctx.beginPath();
        ctx.arc(dsx, dsy, d.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffcc66";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💣", dsx, dsy);
        ctx.restore();
        return;
    }
    ctx.save();
    ctx.shadowColor = d.type === "magnet" ? "#00ffff" : "#ff66ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(dsx, dsy, d.size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = d.type === "magnet" ? "#00cccc" : "#cc66cc";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.type === "magnet" ? "🧲" : "🩹", dsx, dsy);
    ctx.restore();
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

let uiUpdateThrottle = 0;
function flushUI() {
    if (!uiDirty || !player) return;
    uiDirty = false;
    const now = performance.now();
    if (now - uiUpdateThrottle < 50) return;
    uiUpdateThrottle = now;
    document.getElementById("hp").innerText = player.hp;
    document.getElementById("score").innerText = score;
    document.getElementById("level").innerText = player.level;
    document.getElementById("xp").innerText = Math.floor(player.xp);
    document.getElementById("xpNeeded").innerText = player.xpNeeded;
    updateXpBar();
    const isPauseMenuVisible = dom.pauseScreen.style.display === "block";
    if (isPauseMenuVisible) {
        renderUpgradeTracker();
        renderPauseStats();
    }
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
