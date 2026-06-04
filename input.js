// ============================================================
// MOBILE JOYSTICK
// ============================================================
let joystickActive = false, joystickStartX = 0, joystickStartY = 0, joystickDX = 0, joystickDY = 0;
let joystickEventsAttached = false;
const JOYSTICK_RADIUS = 55;

function setupMobileJoystick() {
    const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    const container = document.getElementById("joystickContainer");
    if (!isTouchDevice || currentControlMode === "keyboard" || currentControlMode === "mouse" || currentControlMode === "gamepad") {
        container.style.display = "none"; return;
    }
    container.style.display = "block";
    currentControlMode = "touch";
    updateModeDisplay();
    const base = dom.joystickBase;
    const thumb = dom.joystickThumb;

    if (!joystickEventsAttached) {
        function onTouchStart(e) {
            e.preventDefault();
            const t = e.changedTouches[0];
            joystickActive = true; joystickStartX = t.clientX; joystickStartY = t.clientY;
        }
        function onTouchMove(e) {
            e.preventDefault();
            if (!joystickActive) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - joystickStartX, dy = t.clientY - joystickStartY;
            const dist = Math.hypot(dx, dy);
            const clamped = Math.min(dist, JOYSTICK_RADIUS);
            const nx = dx / (dist || 1) * clamped, ny = dy / (dist || 1) * clamped;
            joystickDX = nx / JOYSTICK_RADIUS; joystickDY = ny / JOYSTICK_RADIUS;
            thumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
        }
        function onTouchEnd(e) {
            e.preventDefault();
            joystickActive = false; joystickDX = 0; joystickDY = 0;
            thumb.style.transform = "translate(-50%, -50%)";
        }
        base.addEventListener("touchstart", onTouchStart, { passive: false });
        base.addEventListener("touchmove", onTouchMove, { passive: false });
        base.addEventListener("touchend", onTouchEnd, { passive: false });
        base.addEventListener("touchcancel", onTouchEnd, { passive: false });
        joystickEventsAttached = true;
    }
}

// ============================================================
// BOTTOM HINT & MENU FOCUS
// ============================================================
function updateGlobalHint() {
    const hintBox = dom.globalHint;
    let _gpList; try { _gpList = navigator.getGamepads(); } catch(e) { _gpList = []; }
    const isGamepad = (currentControlMode === "gamepad" || (_gpList[0] || false));
    const isMobile = currentControlMode === "touch";
    if (dom.mainMenu.style.display !== "none") {
        hintBox.innerHTML = isMobile ? "Chạm vào nút để chọn" :
            isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn" :
            "Dùng phím <span>W / S</span> hoặc <span>Mũi tên</span> để Duyệt • Nhấn <span>ENTER / SPACE</span> để Chọn";
        hintBox.style.display = "block"; return;
    }
    if (dom.optionsScreen.style.display === "block") {
        if (optFocusIndex === 3) {
            hintBox.innerHTML = isGamepad ? "Dùng <span>Analog Trái / D-Pad (Trái/Phải)</span> để tăng giảm âm lượng • Nhấn <span>(B)</span> để Hủy" :
                "Dùng phím <span>A / D</span> hoặc <span>Mũi Tên Trái / Phải</span> để tăng giảm âm lượng";
        } else {
            hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad / Analog</span> để di chuyển • Nhấn <span>(A)</span> để Chọn • Nhấn <span>(B)</span> để Quay lại" :
                "Dùng phím <span>W / S</span> để Duyệt • Nhấn <span>ENTER</span> để Kích hoạt • Nhấn <span>ESC</span> để Hủy";
        }
        hintBox.style.display = "block"; return;
    }
    if (dom.pauseScreen.style.display === "block") {
        hintBox.innerHTML = isGamepad ? "Dùng <span>D-Pad</span> để chọn • Nhấn <span>(A)</span> để Thực thi • Nhấn <span>(B)</span> để Tiếp tục" :
            "Dùng phím <span>W / S</span> để chọn • Nhấn <span>ENTER</span> để Thực thi • Nhấn <span>ESC</span> để Tiếp tục";
        hintBox.style.display = "block"; return;
    }
    if (dom.upgradeScreen.style.display === "block") {
        hintBox.innerHTML = isMobile ? "Chạm vào thẻ gene để hấp thụ đột biến" :
            isGamepad ? "Dùng <span>D-Pad</span> chọn chuỗi gen • Nhấn <span>(A)</span> để hấp thụ Đột biến" :
            "Dùng phím <span>W / S</span> chọn chuỗi gen • Nhấn <span>ENTER</span> để hấp thụ Đột biến";
        hintBox.style.display = "block"; return;
    }
    if (dom.gameOverScreen.style.display === "block") {
        hintBox.innerHTML = isGamepad ? "Nhấn <span>(A)</span> để Tái tạo bạch cầu ngay lập tức" :
            "Nhấn <span>ENTER / SPACE</span> để Tái tạo bạch cầu ngay";
        hintBox.style.display = "block"; return;
    }
    if (isPlaying) {
        if (isMobile) hintBox.innerHTML = "Dùng <span>Joystick trái</span> để di chuyển • Hệ thống kháng thể bắn tự động";
        else if (currentControlMode === "keyboard") hintBox.innerHTML = "Dùng cụm <span>WASD / Mũi tên</span> để điều khiển Bạch Cầu • Hệ thống kháng thể bắn tự động • Nhấn <span>ESC</span> để Tạm dừng";
        else if (currentControlMode === "mouse") hintBox.innerHTML = "Bạch Cầu tự động bám đuổi theo <span>Con trỏ Chuột</span> • Nhấn <span>ESC</span> để Tạm dừng";
        else hintBox.innerHTML = "Dùng <span>Analog Trái</span> để điều khiển Bạch Cầu • Nhấn <span>START</span> để Tạm dừng";
        hintBox.style.display = "block"; return;
    }
    hintBox.style.display = "none";
}

function renderMainMenuFocus() { for (let i = 0; i < 3; i++) document.getElementById(`menu-btn-${i}`).classList.toggle("menu-focused", i === mainMenuFocusIndex); }
function renderPauseMenuFocus() { for (let i = 0; i < 3; i++) document.getElementById(`pause-btn-${i}`).classList.toggle("menu-focused", i === pauseMenuFocusIndex); }
function renderGameOverFocus() {
    document.getElementById("gover-btn-0").classList.toggle("menu-focused", gameOverFocusIndex === 0);
    document.getElementById("gover-btn-2").classList.toggle("menu-focused", gameOverFocusIndex === 1);
}
function renderOptionsFocus() {
    for (let i = 0; i < 4; i++) document.getElementById(`opt-label-${i}`).classList.toggle("opt-focused", i === optFocusIndex);
    document.getElementById("opt-btn-save").classList.toggle("btn-focused", optFocusIndex === 4);
    document.getElementById("opt-btn-cancel").classList.toggle("btn-focused", optFocusIndex === 5);
}
function renderSelectionFocus() {
    document.querySelectorAll(".upgrade-card").forEach((c, idx) => c.classList.toggle("keyboard-focused", idx === currentFocusIndex));
}

// ============================================================
// INPUT HANDLING
// ============================================================
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); if (isPlaying) togglePauseMenu(); return; }
    if (!isPlaying && document.getElementById("mainMenu").style.display !== "none") {
        if (e.key==="w"||e.key==="ArrowUp") { mainMenuFocusIndex=(mainMenuFocusIndex-1+3)%3; SFX.menuMove(); renderMainMenuFocus(); }
        else if (e.key==="s"||e.key==="ArrowDown") { mainMenuFocusIndex=(mainMenuFocusIndex+1)%3; SFX.menuMove(); renderMainMenuFocus(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById(`menu-btn-${mainMenuFocusIndex}`).click();
        updateGlobalHint();
    } else if (document.getElementById("optionsScreen").style.display === "block") {
        if (e.key==="w"||e.key==="ArrowUp") { optFocusIndex=(optFocusIndex-1+6)%6; renderOptionsFocus(); SFX.menuMove(); updateGlobalHint(); }
        else if (e.key==="s"||e.key==="ArrowDown") { optFocusIndex=(optFocusIndex+1)%6; renderOptionsFocus(); SFX.menuMove(); updateGlobalHint(); }
        else if (optFocusIndex===3 && (e.key==="a"||e.key==="ArrowLeft"||e.key==="d"||e.key==="ArrowRight")) {
            let v = parseInt(document.getElementById("gameVolume").value);
            v = (e.key==="a"||e.key==="ArrowLeft") ? Math.max(0,v-5) : Math.min(100,v+5);
            document.getElementById("gameVolume").value = v; updateVolume(v); SFX.menuMove();
        } else if (e.key===" "||e.key==="Enter") {
            if (optFocusIndex<=2) { document.getElementsByName("controlModeOpt")[optFocusIndex].checked=true; SFX.menuSelect(); }
            else if (optFocusIndex===4) closeOptions(true);
            else if (optFocusIndex===5) closeOptions(false);
        }
    } else if (isPausedByOptions) {
        if (e.key==="w"||e.key==="ArrowUp") { pauseMenuFocusIndex=(pauseMenuFocusIndex-1+3)%3; renderPauseMenuFocus(); SFX.menuMove(); }
        else if (e.key==="s"||e.key==="ArrowDown") { pauseMenuFocusIndex=(pauseMenuFocusIndex+1)%3; renderPauseMenuFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById(`pause-btn-${pauseMenuFocusIndex}`).click();
    } else if (isGameOver) {
        if (e.key==="w"||e.key==="ArrowUp"||e.key==="s"||e.key==="ArrowDown") { gameOverFocusIndex=gameOverFocusIndex===0?1:0; renderGameOverFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") document.getElementById("gover-btn-"+(gameOverFocusIndex===0?0:2)).click();
    } else if (isUpgrading) {
        if (e.key==="w"||e.key==="ArrowUp") { currentFocusIndex=(currentFocusIndex-1+activeUpgradeCards.length)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); }
        else if (e.key==="s"||e.key==="ArrowDown") { currentFocusIndex=(currentFocusIndex+1)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); }
        else if (e.key===" "||e.key==="Enter") { e.preventDefault(); if (activeUpgradeCards[currentFocusIndex]) applyUpgrade(activeUpgradeCards[currentFocusIndex].id); }
    } else if (isPlaying) {
        keys[e.key.toLowerCase()] = true;
    }
});
window.addEventListener("keyup", e => { if (isPlaying) keys[e.key.toLowerCase()] = false; });
canvas.addEventListener("mousemove", e => {
    if (!isPlaying||isUpgrading||isGameOver||isPausedByOptions||mouseLockout||currentControlMode!=="mouse") return;
    const r = canvas.getBoundingClientRect(); mouseX = e.clientX-r.left; mouseY = e.clientY-r.top;
});
window.addEventListener("gamepadconnected", () => {
    currentControlMode = "gamepad"; document.body.classList.add("gp-active");
    updateModeDisplay(); renderMainMenuFocus(); updateGlobalHint();
});

// ============================================================
// GAMEPAD INPUT
// ============================================================
function processGamepadInput() {
    let gpList; try { gpList = navigator.getGamepads(); } catch(e) { return; }
    const gp = (gpList || [])[0]; if (!gp) return;
    const startPressed = gp.buttons[9]?.pressed;
    if (startPressed && !lastStartButtonState && isPlaying && !isGameOver && !isUpgrading) togglePauseMenu();
    lastStartButtonState = startPressed;
    const bPressed = gp.buttons[1]?.pressed;
    if (bPressed && !lastBButtonState) {
        if (document.getElementById("optionsScreen").style.display==="block") { closeOptions(false); activateGamepadCooldown(); }
        else if (isPausedByOptions) { togglePauseMenu(); activateGamepadCooldown(); }
    }
    lastBButtonState = bPressed;
    const moveUp = gp.buttons[12]?.pressed || gp.axes[1] < -.5;
    const moveDown = gp.buttons[13]?.pressed || gp.axes[1] > .5;
    const moveLeft = gp.buttons[14]?.pressed || gp.axes[0] < -.5;
    const moveRight = gp.buttons[15]?.pressed || gp.axes[0] > .5;
    const actionA = gp.buttons[0]?.pressed;

    if (document.getElementById("mainMenu").style.display !== "none") {
        if (!gamepadButtonCooldown) {
            if (moveUp) { mainMenuFocusIndex=(mainMenuFocusIndex-1+3)%3; renderMainMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { mainMenuFocusIndex=(mainMenuFocusIndex+1)%3; renderMainMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById(`menu-btn-${mainMenuFocusIndex}`).click(); activateGamepadCooldown(); }
        }
    } else if (document.getElementById("optionsScreen").style.display==="block") {
        if (!gamepadButtonCooldown) {
            if (moveUp) { optFocusIndex=(optFocusIndex-1+6)%6; renderOptionsFocus(); SFX.menuMove(); activateGamepadCooldown(); updateGlobalHint(); }
            else if (moveDown) { optFocusIndex=(optFocusIndex+1)%6; renderOptionsFocus(); SFX.menuMove(); activateGamepadCooldown(); updateGlobalHint(); }
            else if (optFocusIndex===3 && (moveLeft||moveRight)) {
                let v=parseInt(document.getElementById("gameVolume").value);
                v = moveLeft?Math.max(0,v-5):Math.min(100,v+5);
                document.getElementById("gameVolume").value=v; updateVolume(v); SFX.menuMove(); activateGamepadCooldown();
            } else if (actionA) {
                if (optFocusIndex<=2) { document.getElementsByName("controlModeOpt")[optFocusIndex].checked=true; SFX.menuSelect(); }
                else if (optFocusIndex===4) closeOptions(true);
                else if (optFocusIndex===5) closeOptions(false);
                activateGamepadCooldown();
            }
        }
    } else if (isPausedByOptions) {
        if (!gamepadButtonCooldown) {
            if (moveUp) { pauseMenuFocusIndex=(pauseMenuFocusIndex-1+3)%3; renderPauseMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { pauseMenuFocusIndex=(pauseMenuFocusIndex+1)%3; renderPauseMenuFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById(`pause-btn-${pauseMenuFocusIndex}`).click(); activateGamepadCooldown(); }
        }
    } else if (isGameOver) {
        if (!gamepadButtonCooldown) {
            if (moveUp||moveDown) { gameOverFocusIndex=gameOverFocusIndex===0?1:0; renderGameOverFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA) { document.getElementById("gover-btn-"+(gameOverFocusIndex===0?0:2)).click(); activateGamepadCooldown(); }
        }
    } else if (isUpgrading) {
        if (!gamepadButtonCooldown) {
            if (moveUp) { currentFocusIndex=(currentFocusIndex-1+activeUpgradeCards.length)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (moveDown) { currentFocusIndex=(currentFocusIndex+1)%activeUpgradeCards.length; renderSelectionFocus(); SFX.menuMove(); activateGamepadCooldown(); }
            else if (actionA && activeUpgradeCards[currentFocusIndex]) { applyUpgrade(activeUpgradeCards[currentFocusIndex].id); activateGamepadCooldown(); }
        }
    } else if (isPlaying && !isGameOver && !isUpgrading && !isPausedByOptions) {
        const axisX = gp.axes[0], axisY = gp.axes[1];
        if (Math.abs(axisX)>.15 || Math.abs(axisY)>.15) {
            keys["_gpx"] = axisX; keys["_gpy"] = axisY;
        } else { keys["_gpx"] = 0; keys["_gpy"] = 0; }
    }
}
function activateGamepadCooldown() { gamepadButtonCooldown=true; setTimeout(()=>gamepadButtonCooldown=false, 180); }
