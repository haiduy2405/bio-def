// ============================================================
// AUDIO
// ============================================================
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function updateVolume(val) {
    globalVolumeModifier = parseInt(val) / 100;
    if (dom.volumeVal) dom.volumeVal.innerText = val + "%";
}

const SFX = {
    shoot: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sine"; osc.frequency.setValueAtTime(120, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 0.06);
        filter.type = "lowpass"; filter.Q.setValueAtTime(3, audioCtx.currentTime); filter.frequency.setValueAtTime(400, audioCtx.currentTime); filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.15 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.06);
        osc.start(); osc.stop(audioCtx.currentTime + 0.06);
    },
    hit: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "triangle"; osc.frequency.setValueAtTime(180, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.04);
        filter.type = "bandpass"; filter.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.04);
        osc.start(); osc.stop(audioCtx.currentTime + 0.04);
    },
    hurt: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(220, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(55, audioCtx.currentTime + 0.15);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(800, audioCtx.currentTime); filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.36 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    },
    gem: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(660, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.09 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.12);
        osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    },
    item: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(329.63, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    },
    bomb: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.22);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(320, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.28 * globalVolumeModifier, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.22);
        osc.start(); osc.stop(audioCtx.currentTime + 0.22);
    },
    levelUp: () => {
        SFX.item();
        setTimeout(() => {
            if (!audioCtx) return;
            let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1318.51, audioCtx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.25);
            osc.start(); osc.stop(audioCtx.currentTime + 0.25);
        }, 60);
    },
    boss: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "triangle"; osc.frequency.setValueAtTime(55, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(35, audioCtx.currentTime + 0.5);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(90, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.9 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    },
    menuMove: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine"; osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.03);
        osc.start(); osc.stop(audioCtx.currentTime + 0.03);
    },
    menuSelect: () => {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); osc.type = "sine";
        osc.frequency.setValueAtTime(330, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.12 * globalVolumeModifier, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.06);
        osc.start(); osc.stop(audioCtx.currentTime + 0.06);
    }
};
