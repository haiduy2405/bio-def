// ============================================================
// GAME LOOP
// ============================================================
function gameLoop(timestamp) {
    processGamepadInput();
    if (!isPlaying) { animationFrameId = requestAnimationFrame(gameLoop); return; }

    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;
    if (shakeTime > 0) shakeTime -= dt;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isGameOver || isUpgrading || isPausedByOptions) {
        // Render frozen state in screen coords
        renderFrozenState();
    } else {
        applyScreenShake();
        runGameFrame(dt, timestamp);
        resetScreenShake();
    }

    flushUI();
    animationFrameId = requestAnimationFrame(gameLoop);
}

bootGame();
