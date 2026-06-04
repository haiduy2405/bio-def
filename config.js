// ============================================================
// GAME CONFIGURATION
// ============================================================
const GAME_VERSION = "0.41";
const GAME_TITLE = "BIO-DEFENSE: LEUKOCYTE";
const GAME_SUBTITLE = "Hệ Thống Phòng Ngự Miễn Dịch Vi Mô";

// ============================================================
// UPGRADES & GENE SYNERGY CORES
// ============================================================
const ALL_UPGRADES = [
    { id: "fireRate",    title: "⚡ Tốc độ bắn",    desc: "-20% thời gian hồi đạn." },
    { id: "speed",       title: "👟 Tốc độ di chuyển",     desc: "+20% tốc độ di chuyển." },
    { id: "magnet",      title: "🧲 Tầm hút",        desc: "+30% tầm hút Adenosine." },
    { id: "damage",      title: "🔥 Sát thương",        desc: "+1 sát thương mỗi đạn." },
    { id: "bulletCount", title: "🔮 Số tia đạn",      desc: "+1 tia đạn (tối đa 5). Mỗi tia 70% sát thương." },
    { id: "xpBoost",     title: "💎 Tỉ lệ XP",       desc: "+50% XP nhận được." },
    { id: "range",       title: "🎯 Tầm bắn",      desc: "+25% tầm bắn tự động." },
    { id: "pierce",      title: "🏹 Xuyên thấu",         desc: "+1 mục tiêu xuyên qua." },
    { id: "knockback",   title: "🛡️ Đẩy lùi",     desc: "+2 lực đẩy lùi." }
];

/** Lõi ẩn — mở khi đã hấp thụ đủ chuỗi gene trong `requires` */
const SYNERGY_CORES = [
    {
        id: "phagocyte_core",
        title: "🧬 Sát thương lan",
        desc: "Va chạm gây sát thương lan 50% trong bán kính 42px.",
        requires: ["fireRate", "damage"]
    },
    {
        id: "plasma_current_core",
        title: "🧬 Tốc độ & Hút",
        desc: "+15% tốc độ, +35% tầm hút.",
        requires: ["speed", "magnet"]
    },
    {
        id: "antibody_cascade_core",
        title: "🧬 Sát thương đa tia",
        desc: "Tia phụ gây 85% sát thương (thay vì 70%).",
        requires: ["bulletCount", "pierce"]
    },
    {
        id: "toxin_radar_core",
        title: "🧬 Tầm bắn & Đẩy lùi",
        desc: "+20% tầm bắn, +1.5 lực đẩy.",
        requires: ["range", "knockback"]
    },
    {
        id: "gen_harvest_core",
        title: "🧬 XP & Tốc độ hút",
        desc: "+30% XP, +80 tốc độ hút.",
        requires: ["xpBoost", "magnet"]
    },
    {
        id: "membrane_assault_core",
        title: "🧬 Xuyên thấu & Sát thương",
        desc: "+2 sát thương, +1 xuyên thấu.",
        requires: ["damage", "pierce"]
    }
];
