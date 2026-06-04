// ============================================================
// LEUKOCYTE — level-up & upgrade application
// ============================================================
let lastUpgradePicked = null;

function hasGeneChain(requires) {
    return requires.every(g => (player.genesTaken[g] || 0) > 0);
}

function getNextSynergyOffer() {
    for (const core of SYNERGY_CORES) {
        if (player.synergiesUnlocked[core.id]) continue;
        if (hasGeneChain(core.requires)) return core;
    }
    return null;
}

function applySynergyCore(id) {
    if (player.synergiesUnlocked[id]) return;
    player.synergiesUnlocked[id] = true;
    if (id === "phagocyte_core") player.synergyAoE = 0.5;
    else if (id === "plasma_current_core") { player.speed *= 1.15; player.magnetRange *= 1.35; player.gemSpeed += 60; }
    else if (id === "antibody_cascade_core") player.synergySplitBuff = true;
    else if (id === "toxin_radar_core") { player.shootRange *= 1.2; player.knockback += 1.5; player.synergyToxinRadar = true; }
    else if (id === "gen_harvest_core") { player.xpRate += 0.3; player.gemSpeed += 80; }
    else if (id === "membrane_assault_core") { player.damage += 2; player.pierce++; }
    createExplosion(player.x, player.y, "#ffd700", 35);
    SFX.levelUp();
}

function triggerLevelUp() {
    isUpgrading = true; keys = {}; clearMousePosition();
    player.level++; player.xp = 0;
    player.xpNeeded = Math.floor(1.3 * player.xpNeeded) + 5;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    createExplosion(player.x, player.y, "#ffffff", 25);
    updateUI(); SFX.levelUp();
    const subs = { mouse:"Chọn hướng đột biến để tối ưu hóa thực bào:", keyboard:"Dùng phím W/S để chọn chuỗi gen, ENTER để nạp:", gamepad:"Dùng D-pad để di chuyển, nút (A) để chọn chuỗi gen:", touch:"Chạm vào thẻ gene để hấp thụ đột biến:" };
    document.getElementById("upgradeSubtitle").innerText = subs[currentControlMode] || subs.keyboard;
    const container = document.getElementById("upgradeOptions");
    container.innerHTML = "";

    let pool = ALL_UPGRADES.filter(u => u.id !== lastUpgradePicked);
    pool = [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);

    const synergy = getNextSynergyOffer();
    if (synergy) {
        pool = [{ ...synergy, isSynergy: true }, ...pool.slice(0, 2)];
        document.getElementById("upgradeSubtitle").innerText =
            "✨ Chuỗi gen cộng hưởng! Một lõi ẩn đã xuất hiện — " + (subs[currentControlMode] || subs.keyboard);
    }

    activeUpgradeCards = pool;
    currentFocusIndex = 0;
    activeUpgradeCards.forEach((upg, i) => {
        const card = document.createElement("div");
        card.className = "upgrade-card" + (upg.isSynergy ? " synergy-card" : "");
        card.id = "upg-card-" + i;
        let descText = upg.desc;
        if (!upg.isSynergy && upg.id === "bulletCount" && player.bulletCount >= 5) {
            descText = "⚠️ Đạt giới hạn phân tách tuyến đề kháng (Tối đa 5 tia).";
        }
        card.innerHTML = `<div class="upgrade-title">${upg.title}</div><div class="upgrade-desc">${descText}</div>`;
        card.onclick = e => { e.stopPropagation(); e.preventDefault(); applyUpgrade(upg.id); };
        container.appendChild(card);
    });
    renderSelectionFocus();
    document.getElementById("upgradeScreen").style.display = "block";
    updateGlobalHint();
}

function applyUpgrade(id) {
    lastUpgradePicked = id;
    SFX.menuSelect();

    if (SYNERGY_CORES.some(c => c.id === id)) {
        applySynergyCore(id);
    } else {
        player.genesTaken[id] = (player.genesTaken[id] || 0) + 1;
        if (id === "fireRate") player.fireRate = Math.max(100, 0.8 * player.fireRate);
        else if (id === "speed") player.speed *= 1.15;
        else if (id === "magnet") { player.magnetRange *= 1.3; player.gemSpeed += 90; }
        else if (id === "damage") player.damage += 1;
        else if (id === "bulletCount" && player.bulletCount < 5) player.bulletCount++;
        else if (id === "xpBoost") player.xpRate += 0.5;
        else if (id === "range") player.shootRange *= 1.25;
        else if (id === "pierce") player.pierce++;
        else if (id === "knockback") player.knockback += 2.0;
    }

    document.getElementById("upgradeScreen").style.display = "none";
    clearMousePosition(); setCanvasCursor(false);
    updateUI();
    mouseLockout = true;
    setTimeout(() => { mouseLockout = false; isUpgrading = false; updateGlobalHint(); }, 200);
}
