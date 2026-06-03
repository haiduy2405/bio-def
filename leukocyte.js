// ============================================================
// UPGRADES & GENE SYNERGY CORES
// ============================================================
const ALL_UPGRADES = [
    { id: "fireRate",    title: "⚡ Tăng Cường Phóng Kháng Thể",    desc: "Giảm 20% thời gian tái tạo liên kết đạn tự động." },
    { id: "speed",       title: "👟 Thủy Động Lực Học Biểu Mô",     desc: "Tăng 20% tốc độ di chuyển xuyên dòng chảy huyết tương." },
    { id: "magnet",      title: "🧲 Thụ Thể Hóa Hướng Động",        desc: "Mở rộng tầm tự động hút phân tử Adenosine dinh dưỡng." },
    { id: "damage",      title: "🔥 Tăng Độc Tính Thực Bào",        desc: "Mỗi mảnh kháng thể gây thêm +1 sát thương phá hủy màng tế bào dịch." },
    { id: "bulletCount", title: "🔮 Phân Tách Tuyến Đề Kháng",      desc: "Tăng thêm 1 luồng kháng thể (tối đa 5). Mỗi tia chỉ gây 60% sát thương gốc — đổi sát thương dồn lấy kiểm soát đám đông." },
    { id: "xpBoost",     title: "💎 Tối Ưu Hóa Hấp Thụ Gen",       desc: "Nhận thêm 50% mật độ Adenosine từ mỗi mảnh năng lượng." },
    { id: "range",       title: "🎯 Mở Rộng Tầm Quét Độc Tố",      desc: "Tăng 25% bán kính nhận diện và tự động tấn công tác nhân ngoại lai." },
    { id: "pierce",      title: "🏹 Kháng Thể Xuyên Thấu",         desc: "Mảnh đạn xuyên qua thêm +1 mục tiêu vi khuẩn trước khi phân rã." },
    { id: "knockback",   title: "🛡️ Xung Lực Đẩy Lùi Cơ Học",     desc: "Tạo áp lực dòng chảy đẩy lùi quái vật ra xa khi trúng đạn." }
];

/** Lõi ẩn — mở khi đã hấp thụ đủ chuỗi gene trong `requires` */
const SYNERGY_CORES = [
    {
        id: "phagocyte_core",
        title: "🧬 Lõi Thực Bào (Cộng Hưởng)",
        desc: "Phóng kháng + Độc tính: mỗi va chạm tạo sóng huyết tương 42px, gây 50% sát thương lan.",
        requires: ["fireRate", "damage"]
    },
    {
        id: "plasma_current_core",
        title: "🧬 Lõi Dòng Chảy Huyết Tương",
        desc: "Tốc độ + Hướng động: tăng 15% tốc độ và 35% tầm hút Adenosine.",
        requires: ["speed", "magnet"]
    },
    {
        id: "antibody_cascade_core",
        title: "🧬 Lõi Thác Kháng Thể",
        desc: "Phân tách + Xuyên thấu: mỗi tia phụ gây 80% sát thương (thay vì 60%).",
        requires: ["bulletCount", "pierce"]
    },
    {
        id: "toxin_radar_core",
        title: "🧬 Lõi Radar Độc Tố",
        desc: "Tầm quét + Đẩy lùi: +20% tầm bắn và +1.5 lực đẩy dòng chảy.",
        requires: ["range", "knockback"]
    },
    {
        id: "gen_harvest_core",
        title: "🧬 Lõi Thu Hoạch Gen",
        desc: "Hấp thụ gen + Hướng động: +30% XP và tốc độ hút năng lượng.",
        requires: ["xpBoost", "magnet"]
    },
    {
        id: "membrane_assault_core",
        title: "🧬 Lõi Xâm Lấn Màng",
        desc: "Độc tính + Xuyên thấu: +2 sát thương và +1 lần xuyên màng.",
        requires: ["damage", "pierce"]
    }
];

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
