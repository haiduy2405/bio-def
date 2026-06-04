// ============================================================
// GAME FLOW
// ============================================================
function startGame() {
    initAudio(); SFX.menuSelect();
    applyGameVersionLabels();
    dom.mainMenu.style.display = "none";
    ["gameCanvas","ui","xpBar","hudVersion"].forEach(id => document.getElementById(id).style.display = "block");
    isPlaying = true; isPausedByOptions = mouseLockout = false;
    resizeCanvas(); createGlowCache(); init();
    updateModeDisplay(); setCanvasCursor(false);
    setupMobileJoystick(); updateGlobalHint();
}

function togglePauseMenu() {
    if (!isPlaying || isGameOver || isUpgrading || dom.optionsScreen.style.display === "block") return;
    isPausedByOptions = !isPausedByOptions; SFX.menuSelect();
    if (isPausedByOptions) {
        setCanvasCursor(true);
        dom.pauseScreen.style.display = "block";
        renderUpgradeTracker();
        renderPauseStats();
        pauseMenuFocusIndex = 0; renderPauseMenuFocus();
    } else {
        dom.pauseScreen.style.display = "none";
        clearMousePosition(); setCanvasCursor(false);
        mouseLockout = true; setTimeout(() => mouseLockout = false, 200);
    }
    updateGlobalHint();
}

function openOptions() {
    initAudio(); SFX.menuSelect();
    dom.optionsScreen.style.display = "block";
    const modeInput = document.querySelector(`input[name="controlModeOpt"][value="${currentControlMode}"]`);
    if (modeInput) modeInput.checked = true;
    optFocusIndex = ["keyboard","mouse","gamepad"].indexOf(currentControlMode);
    if (optFocusIndex < 0) optFocusIndex = 0;
    renderOptionsFocus(); updateGlobalHint();
}
function openOptionsFromPause() { dom.pauseScreen.style.display = "none"; openOptions(); }

function closeOptions(isSaved) {
    SFX.menuSelect();
    if (isSaved) {
        let _gp2; try { _gp2 = navigator.getGamepads()[0]; } catch(e) { _gp2 = null; }
        if (currentControlMode === "gamepad" || _gp2) {
            currentControlMode = ["keyboard","mouse","gamepad"][Math.min(optFocusIndex, 2)] || currentControlMode;
        } else {
            const selected = dom.controlModeInputs;
            for (let i = 0; i < selected.length; i++) if (selected[i].checked) { currentControlMode = selected[i].value; break; }
        }
        updateModeDisplay();
        if (isPlaying) setupMobileJoystick();
    }
    dom.optionsScreen.style.display = "none";
    clearMousePosition();
    if (isPlaying) { dom.pauseScreen.style.display = "block"; pauseMenuFocusIndex = 1; renderPauseMenuFocus(); }
    else updateGlobalHint();
}

function setCanvasCursor(show) { canvas.style.cursor = show ? "default" : "none"; }
function clearMousePosition() { mouseX = mouseY = null; }
function updateModeDisplay() {
    dom.currentModeDisplay.innerText = {keyboard:"Bàn phím",mouse:"Chuột",gamepad:"Gamepad",touch:"Cảm ứng"}[currentControlMode] || "Bàn phím";
}

function exitGame() {
    SFX.menuSelect();
    if (confirm("Xác nhận đóng liên kết phòng vệ sinh học?")) { window.close(); alert("Hãy đóng tab để thoát."); }
}

function backToMenu() {
    SFX.menuSelect(); isPlaying = isPausedByOptions = false;
    ["bossWarning","gameCanvas","ui","hudVersion","gameOverScreen","optionsScreen","upgradeScreen","pauseScreen","xpBar","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    dom.joystickContainer.style.display = "none";
    dom.mainMenu.style.display = "flex";
    loadHighScore(); mainMenuFocusIndex = 0; renderMainMenuFocus(); updateGlobalHint();
}

function init() {
    player = {
        x: WORLD_W/2, y: WORLD_H/2, size: 24, speed: 252,
        hp: 3, maxHp: 3, level: 1, xp: 0, xpNeeded: 12,
        fireRate: 400, magnetRange: 75, gemSpeed: 330,
        color: "#f5f0f0", damage: 1, bulletCount: 1, xpRate: 1,
        shootRange: 420, pierce: 1, knockback: 0,
        genesTaken: {}, synergiesUnlocked: {},
        synergyAoE: 0, synergySplitBuff: false, synergyToxinRadar: false,
        _squash: 0, _hitPulse: 0, _squashAngle: 0, _prevX: WORLD_W / 2, _prevY: WORLD_H / 2
    };
    lastUpgradePicked = null;
    bullets = []; enemies = []; bosses = []; particles = []; gems = []; drops = []; biofilmTrails = [];
    score = spawnTimer = bossCount = enemyIdCounter = 0;
    nextBossScore = 40;
    isGameOver = isUpgrading = false;
    lastFrameTime = 0;
    camX = WORLD_W/2 - window.innerWidth/2;
    camY = WORLD_H/2 - window.innerHeight/2;
    keys = {};
    mouseX = null;
    mouseY = null;
    lastShotTime = 0;
    mouseLockout = false;
    activeUpgradeCards = [];
    currentFocusIndex = 0;
    mainMenuFocusIndex = 0;
    optFocusIndex = 0;
    pauseMenuFocusIndex = 0;
    gameOverFocusIndex = 0;
    gamepadButtonCooldown = false;
    lastStartButtonState = false;
    lastBButtonState = false;
    uiDirty = false;
    hitFlashTimeout = null;
    shakeTime = 0;
    shakeMagnitude = 0;
    scorePopups.length = 0;
    ["gameOverScreen","upgradeScreen","bossWarning","pauseScreen","bossPhaseBar"].forEach(id => document.getElementById(id).style.display = "none");
    clearMousePosition(); updateUI(); renderUpgradeTracker(); updateGlobalHint();
}

function updateUI() { uiDirty = true; }

function resetGame() { SFX.menuSelect(); init(); isGameOver = false; document.getElementById("gameOverScreen").style.display = "none"; setCanvasCursor(false); }
function handlePlayerDeath() {
    isGameOver = true; gameOverFocusIndex = 0;
    document.getElementById("finalScore").innerText = score;
    document.getElementById("finalLevel").innerText = player.level;
    const isNewRecord = saveHighScore(score);
    document.getElementById("finalHiScore").innerText = highScore;
    document.getElementById("newRecordBadge").style.display = isNewRecord ? "block" : "none";
    setCanvasCursor(true);
    document.getElementById("gameOverScreen").style.display = "block";
    renderGameOverFocus(); SFX.hurt(); updateGlobalHint();
}

function bootGame() {
    loadHighScore();
    applyGameVersionLabels();
    renderMainMenuFocus();
    updateGlobalHint();
    animationFrameId = requestAnimationFrame(gameLoop);
}
