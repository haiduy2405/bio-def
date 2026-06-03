// ============================================================
// UPGRADES
// ============================================================
const ALL_UPGRADES = [
    { id: "fireRate",    title: "⚡ Tăng Cường Phóng Kháng Thể",    desc: "Giảm 20% thời gian tái tạo liên kết đạn tự động." },
    { id: "speed",       title: "👟 Thủy Động Lực Học Biểu Mô",     desc: "Tăng 20% tốc độ di chuyển xuyên dòng chảy huyết tương." },
    { id: "magnet",      title: "🧲 Thụ Thể Hóa Hướng Động",        desc: "Mở rộng tầm tự động hút phân tử Adenosine dinh dưỡng." },
    { id: "damage",      title: "🔥 Tăng Độc Tính Thực Bào",        desc: "Mỗi mảnh kháng thể gây thêm +1 sát thương phá hủy màng tế bào dịch." },
    // Bullet split nerf: each extra ray deals 60% damage of base, noted in desc
    { id: "bulletCount", title: "🔮 Phân Tách Tuyến Đề Kháng",      desc: "Tăng thêm 1 luồng kháng thể (tối đa 5). Mỗi tia chỉ gây 60% sát thương gốc — đổi sát thương dồn lấy kiểm soát đám đông." },
    { id: "xpBoost",     title: "💎 Tối Ưu Hóa Hấp Thụ Gen",       desc: "Nhận thêm 50% mật độ Adenosine từ mỗi mảnh năng lượng." },
    { id: "range",       title: "🎯 Mở Rộng Tầm Quét Độc Tố",      desc: "Tăng 25% bán kính nhận diện và tự động tấn công tác nhân ngoại lai." },
    { id: "pierce",      title: "🏹 Kháng Thể Xuyên Thấu",         desc: "Mảnh đạn xuyên qua thêm +1 mục tiêu vi khuẩn trước khi phân rã." },
    { id: "knockback",   title: "🛡️ Xung Lực Đẩy Lùi Cơ Học",     desc: "Tạo áp lực dòng chảy đẩy lùi quái vật ra xa khi trúng đạn." }
];
let lastUpgradePicked = null;

// ============================================================
// UPGRADES
// ============================================================
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
    activeUpgradeCards = pool;
    currentFocusIndex = 0;
    activeUpgradeCards.forEach((upg, i) => {
        const card = document.createElement("div");
        card.className = "upgrade-card"; card.id = "upg-card-" + i;
        let descText = upg.desc;
        if (upg.id === "bulletCount" && player.bulletCount >= 5) descText = "⚠️ Đạt giới hạn phân tách tuyến đề kháng (Tối đa 5 tia).";
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
    if (id === "fireRate") player.fireRate = Math.max(100, 0.8 * player.fireRate);
    else if (id === "speed") player.speed *= 1.15;
    else if (id === "magnet") { player.magnetRange *= 1.3; player.gemSpeed += 90; }
    else if (id === "damage") player.damage += 1;
    else if (id === "bulletCount" && player.bulletCount < 5) player.bulletCount++;
    else if (id === "xpBoost") player.xpRate += 0.5;
    else if (id === "range") player.shootRange *= 1.25;
    else if (id === "pierce") player.pierce++;
    else if (id === "knockback") player.knockback += 2.0;
    document.getElementById("upgradeScreen").style.display = "none";
    clearMousePosition(); setCanvasCursor(false);
    mouseLockout = true;
    setTimeout(() => { mouseLockout = false; isUpgrading = false; updateGlobalHint(); }, 200);
}
