// ════════════════════════════════════════════════
// ELEMENTS
// ════════════════════════════════════════════════
const video          = document.getElementById("video");
const overlay        = document.getElementById("overlay");
const ctx            = overlay.getContext("2d", { willReadFrequently: true });
const distBadge      = document.getElementById("distBadge");
const videoWrapper   = document.getElementById("videoWrapper");
const camPlaceholder = document.getElementById("camPlaceholder");

const cameraBtn      = document.getElementById("cameraBtn");
const startBtn       = document.getElementById("startBtn");
const stopBtn        = document.getElementById("stopBtn");
const clearBtn       = document.getElementById("clearBtn");
const exportBtn      = document.getElementById("exportBtn");

const statusDot      = document.getElementById("statusDot");
const smoothSlider   = document.getElementById("smoothSlider");
const smoothVal      = document.getElementById("smoothVal");
const autoScaleToggle = document.getElementById("autoScaleToggle");

// Header icon toggles
const distToggleBtn      = document.getElementById("distToggleBtn");
const speedoToggleBtn    = document.getElementById("speedoToggleBtn");
const signSlopeToggleBtn = document.getElementById("signSlopeToggleBtn");
const settingsOpenBtn    = document.getElementById("settingsOpenBtn");
const settingsCloseBtn   = document.getElementById("settingsCloseBtn");
const settingsPanel      = document.getElementById("settingsPanel");
const panelOverlay       = document.getElementById("panelOverlay");

// Speedometer
const speedoBanner = document.getElementById("speedoBanner");
const slopeVal     = document.getElementById("slopeVal");
const slopeArrow   = document.getElementById("slopeArrow");
const slopeDir     = document.getElementById("slopeDir");

// Big distance display
const bigDistDisplay = document.getElementById("bigDistDisplay");
const bigDistVal     = document.getElementById("bigDistVal");

// Countdown
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNum     = document.getElementById("countdownNum");

// Settings panel fields
const markerSizeInput          = document.getElementById("markerSize");
const calibrationDistanceInput = document.getElementById("calibrationDistance");
const maxTimeInput             = document.getElementById("maxTime");
const countdownDelayInput      = document.getElementById("countdownDelay");
const calibrateBtn             = document.getElementById("calibrateBtn");
const calStatus                = document.getElementById("calStatus");

// Challenge
const newChallengeBtn  = document.getElementById("newChallengeBtn");
const judgeChallengeBtn= document.getElementById("judgeChallengeBtn");
const challengeText    = document.getElementById("challengeText");
const challengeScore   = document.getElementById("challengeScore");

// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
let focalLength         = null;
let lastKnownPixelWidth = null;
let recording           = false;
let countingDown        = false;
let data                = [];
let startTime           = null;
let smoothBuffer        = [];
let lastRecordTime      = 0;
let detector            = null;
let currentSlope        = 0;
let slopeBuffer         = [];
let currentChallenge    = null;
let speedoOn            = false;
let signSlopeOn         = false;
let bigDistOn           = false;
let countdownTimer      = null;

// ════════════════════════════════════════════════
// SETTINGS PANEL OPEN / CLOSE
// ════════════════════════════════════════════════
function openPanel() {
    settingsPanel.classList.add("open");
    panelOverlay.classList.add("visible");
}
function closePanel() {
    settingsPanel.classList.remove("open");
    panelOverlay.classList.remove("visible");
}
settingsOpenBtn.onclick  = openPanel;
settingsCloseBtn.onclick = closePanel;
panelOverlay.onclick     = closePanel;

// ════════════════════════════════════════════════
// HEADER TOGGLE BUTTONS
// ════════════════════════════════════════════════
distToggleBtn.onclick = () => {
    bigDistOn = !bigDistOn;
    distToggleBtn.classList.toggle("active", bigDistOn);
    bigDistDisplay.style.display = bigDistOn ? "block" : "none";
};

speedoToggleBtn.onclick = () => {
    speedoOn = !speedoOn;
    speedoToggleBtn.classList.toggle("active", speedoOn);
    speedoBanner.style.display = speedoOn ? "block" : "none";
};

signSlopeToggleBtn.onclick = () => {
    signSlopeOn = !signSlopeOn;
    signSlopeToggleBtn.classList.toggle("active", signSlopeOn);
    chart.update();
};

// ════════════════════════════════════════════════
// SMOOTH SLIDER
// ════════════════════════════════════════════════
smoothSlider.addEventListener("input", () => {
    smoothVal.textContent = smoothSlider.value;
});

// ════════════════════════════════════════════════
// CHART
// ════════════════════════════════════════════════
const chart = new Chart(document.getElementById("chart"), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Distance (ft)',
            data: [],
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0,229,255,0.07)',
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
            segment: {
                borderColor: seg => getSegmentColor(seg)
            }
        }]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#7986cb', font: { family: 'Space Mono', size: 11 } } }
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: "Time (s)", color: '#7986cb' },
                ticks: {
                    color: '#7986cb',
                    font: { family: 'Space Mono', size: 10 },
                    stepSize: 0.5,
                    callback: v => Number.isInteger(v * 2) ? v.toFixed(1) : null
                },
                grid: { color: '#2e3356' },
                min: 0
            },
            y: {
                title: { display: true, text: "Distance (ft)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 } },
                grid: { color: '#2e3356' },
                min: 0, max: 10
            }
        }
    }
});

function getSegmentColor(seg) {
    if (!signSlopeOn) return '#00e5ff';
    const d = seg.p1.parsed.y - seg.p0.parsed.y;
    if (Math.abs(d) < 0.015) return '#ffd740';
    return d > 0 ? '#ff4081' : '#69f0ae';
}

autoScaleToggle.addEventListener("change", () => {
    chart.options.scales.y.min = autoScaleToggle.checked ? undefined : 0;
    chart.options.scales.y.max = autoScaleToggle.checked ? undefined : 10;
    chart.update();
});

// ════════════════════════════════════════════════
// CAMERA
// ════════════════════════════════════════════════
cameraBtn.onclick = function () {
    if (typeof AR === "undefined") {
        alert("ArUco library failed to load. Refresh and try again.");
        return;
    }
    if (!detector) detector = new AR.Detector();

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.style.display = "block";
            camPlaceholder.style.display = "none";
            video.onloadedmetadata = () => {
                video.play();
                statusDot.classList.add("active");
                startBtn.disabled = false;
                requestAnimationFrame(processVideo);
            };
            cameraBtn.disabled = true;
            cameraBtn.textContent = "Camera On";
        })
        .catch(err => {
            alert("Camera access denied: " + err.message);
        });
};

// ════════════════════════════════════════════════
// SMOOTHING
// ════════════════════════════════════════════════
function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > parseInt(smoothSlider.value)) smoothBuffer.shift();
    return smoothBuffer.reduce((a, b) => a + b) / smoothBuffer.length;
}

// ════════════════════════════════════════════════
// SLOPE CALCULATION
// ════════════════════════════════════════════════
function calcSlope(t, distFt) {
    slopeBuffer.push({ t, d: distFt });
    slopeBuffer = slopeBuffer.filter(p => t - p.t <= 0.5);
    if (slopeBuffer.length < 2) return currentSlope;
    const oldest = slopeBuffer[0];
    const newest = slopeBuffer[slopeBuffer.length - 1];
    const dt = newest.t - oldest.t;
    if (dt < 0.05) return currentSlope;
    return (newest.d - oldest.d) / dt;
}

// ════════════════════════════════════════════════
// SPEEDOMETER UPDATE
// ════════════════════════════════════════════════
function updateSpeedometer(slope) {
    currentSlope = slope;
    const abs = Math.abs(slope);
    slopeVal.textContent = (slope >= 0 ? '+' : '') + slope.toFixed(1);

    speedoBanner.classList.remove('pos', 'neg', 'zero');
    videoWrapper.classList.remove('slope-pos', 'slope-neg', 'slope-zero');

    if (abs < 0.05) {
        speedoBanner.classList.add('zero');
        if (signSlopeOn) videoWrapper.classList.add('slope-zero');
        slopeDir.textContent = 'constant';
        slopeArrow.textContent = '→';
        slopeArrow.style.transform = 'none';
    } else if (slope > 0) {
        speedoBanner.classList.add('pos');
        if (signSlopeOn) videoWrapper.classList.add('slope-pos');
        slopeDir.textContent = 'moving away';
        slopeArrow.textContent = '↗';
    } else {
        speedoBanner.classList.add('neg');
        if (signSlopeOn) videoWrapper.classList.add('slope-neg');
        slopeDir.textContent = 'moving closer';
        slopeArrow.textContent = '↘';
    }
}

// ════════════════════════════════════════════════
// PROCESS VIDEO FRAME
// ════════════════════════════════════════════════
function processVideo() {
    if (!video.videoWidth) { requestAnimationFrame(processVideo); return; }

    // Use the video's true pixel resolution — NOT the CSS display size.
    // This prevents the marker outline from appearing stretched or rectangular.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    overlay.width  = vw;
    overlay.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);

    const imageData = ctx.getImageData(0, 0, vw, vh);
    const markers   = detector.detect(imageData);
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (markers.length > 0) {
        const corners = markers[0].corners;

        // Draw cyan outline
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth   = 3;
        ctx.beginPath();
        corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.stroke();

        // Pink corner dots
        ctx.fillStyle = "#ff4081";
        corners.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI*2); ctx.fill(); });

        const widthPixels = Math.hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y);
        lastKnownPixelWidth = widthPixels;

        if (focalLength) {
            let distCm = (parseFloat(markerSizeInput.value) * focalLength) / widthPixels;
            distCm     = smooth(distCm);
            const distFt = distCm / 30.48;

            distBadge.innerText = "Distance: " + distFt.toFixed(3) + " ft";
            if (bigDistOn) bigDistVal.textContent = distFt.toFixed(1) + " ft";

            const now   = (Date.now() - (startTime || Date.now())) / 1000;
            const slope = calcSlope(now, distFt);
            updateSpeedometer(slope);

            if (recording) {
                const t = (Date.now() - startTime) / 1000;
                if (t >= parseFloat(maxTimeInput.value)) {
                    stopRecording();
                } else if (t - lastRecordTime >= 0.05) {
                    lastRecordTime = t;
                    const tVal = parseFloat(t.toFixed(2));
                    const dVal = parseFloat(distFt.toFixed(3));
                    chart.data.labels.push(tVal);
                    chart.data.datasets[0].data.push(dVal);
                    chart.update();
                    data.push([tVal, dVal]);
                }
            }
        } else {
            distBadge.innerText = "Not calibrated";
        }

    } else {
        distBadge.innerText = "Marker not detected";
        lastKnownPixelWidth = null;
        videoWrapper.classList.remove('slope-pos','slope-neg','slope-zero');
    }

    requestAnimationFrame(processVideo);
}

// ════════════════════════════════════════════════
// CALIBRATE
// ════════════════════════════════════════════════
calibrateBtn.onclick = function () {
    if (!lastKnownPixelWidth) {
        alert("Hold the marker in front of the camera first, then click Calibrate.");
        return;
    }
    const d = parseFloat(calibrationDistanceInput.value);
    const s = parseFloat(markerSizeInput.value);
    focalLength = (lastKnownPixelWidth * d) / s;
    startTime   = Date.now();
    calStatus.textContent = "✓ Calibrated at " + d + " cm";
    calStatus.classList.add("ok");
    closePanel();
};

// ════════════════════════════════════════════════
// RECORDING CONTROLS
// ════════════════════════════════════════════════
// ── Web Audio chime ──
function playChime(isGo) {
    try {
        const ac  = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.frequency.value = isGo ? 880 : 440;   // high ping for GO, lower tick for countdown
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (isGo ? 0.6 : 0.25));
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + (isGo ? 0.6 : 0.25));
    } catch(e) { /* audio unavailable, silent fallback */ }
}

startBtn.onclick = function () {
    if (!focalLength) { alert("Please calibrate first (open ⚙️ Settings)."); return; }
    if (countingDown || recording) return;

    const delay = parseInt(countdownDelayInput.value) || 0;
    if (delay <= 0) { beginRecording(); return; }

    // ── Giant countdown: 3 → 2 → 1 → GO! ──
    countingDown = true;
    startBtn.disabled = true;
    let remaining = delay;

    countdownOverlay.classList.add("visible");
    countdownNum.classList.remove('go');
    countdownNum.textContent = remaining;
    playChime(false);

    countdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            countdownNum.classList.remove('go');
            countdownNum.textContent = remaining;
            playChime(false);
        } else {
            countdownNum.classList.add('go');
            countdownNum.textContent = 'GO!';
            playChime(true);
            clearInterval(countdownTimer);
            setTimeout(() => {
                countdownOverlay.classList.remove("visible");
                countdownNum.classList.remove('go');
                countingDown = false;
                startBtn.disabled = false;
                beginRecording();
            }, 800);
        }
    }, 1000);
};

function beginRecording() {
    recording      = true;
    startTime      = Date.now();
    lastRecordTime = 0;
    smoothBuffer   = [];
    slopeBuffer    = [];
    statusDot.classList.add("recording");
}

function stopRecording() {
    recording = false;
    statusDot.classList.remove("recording");
    if (focalLength) statusDot.classList.add("active");
    evaluateChallenge();
}

stopBtn.onclick = function () {
    if (countingDown) {
        clearInterval(countdownTimer);
        countdownOverlay.classList.remove("visible");
        countingDown = false;
        startBtn.disabled = false;
    }
    stopRecording();
    smoothBuffer = []; lastRecordTime = 0; slopeBuffer = [];
};

clearBtn.onclick = function () {
    if (countingDown) {
        clearInterval(countdownTimer);
        countdownOverlay.classList.remove("visible");
        countingDown = false;
    }
    recording = false;
    startBtn.disabled = !focalLength;
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
    data = []; smoothBuffer = []; lastRecordTime = 0; slopeBuffer = [];
    statusDot.classList.remove("recording");
    challengeScore.textContent = '';
    challengeScore.className   = '';
};

exportBtn.onclick = function () {
    if (!data.length) { alert("No data to export yet!"); return; }
    let csv = "time_seconds,distance_ft\n";
    data.forEach(r => { csv += r[0] + "," + r[1] + "\n"; });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "motion_data.csv";
    link.click();
};

// ════════════════════════════════════════════════
// SLOPE CHALLENGES
// ════════════════════════════════════════════════
const CHALLENGES = [
    { description: "Walk at a <span class='target'>constant</span> speed away — target slope: <span class='target'>+1.0 ft/sec</span>.", targetSlope:  1.0, tolerance: 0.25 },
    { description: "Hold <span class='target'>perfectly still</span> — target slope: <span class='target'>0.0 ft/sec</span>.",          targetSlope:  0.0, tolerance: 0.10 },
    { description: "Walk <span class='target'>slowly toward</span> the camera — target slope: <span class='target'>−0.5 ft/sec</span>.", targetSlope: -0.5, tolerance: 0.20 },
    { description: "Walk <span class='target'>quickly away</span> — target slope: <span class='target'>+2.0 ft/sec</span>.",             targetSlope:  2.0, tolerance: 0.40 },
    { description: "Walk <span class='target'>slowly away</span> — target slope: <span class='target'>+0.5 ft/sec</span>.",             targetSlope:  0.5, tolerance: 0.15 },
    { description: "Move <span class='target'>quickly toward</span> — target slope: <span class='target'>−1.5 ft/sec</span>.",          targetSlope: -1.5, tolerance: 0.40 },
];

newChallengeBtn.onclick = function () {
    currentChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    challengeText.innerHTML = currentChallenge.description +
        `<br><br><em style="color:var(--muted);font-size:0.68rem">Record for ~5s then press Stop or Judge My Run.</em>`;
    challengeScore.textContent = '';
    challengeScore.className   = '';
};

judgeChallengeBtn.onclick = evaluateChallenge;

function evaluateChallenge() {
    if (!currentChallenge || data.length < 4) return;
    const n = data.length;
    let sumT=0, sumD=0, sumTD=0, sumT2=0;
    data.forEach(([t,d]) => { sumT+=t; sumD+=d; sumTD+=t*d; sumT2+=t*t; });
    const slope = (n*sumTD - sumT*sumD) / (n*sumT2 - sumT*sumT);
    const error = Math.abs(slope - currentChallenge.targetSlope);
    const sign  = slope >= 0 ? '+' : '';
    const tgt   = currentChallenge.targetSlope;

    if (error <= currentChallenge.tolerance) {
        challengeScore.textContent = `🏅 Great! Avg slope: ${sign}${slope.toFixed(2)} ft/sec (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'great';
    } else if (error <= currentChallenge.tolerance * 2) {
        challengeScore.textContent = `👍 Close! Avg slope: ${sign}${slope.toFixed(2)} ft/sec (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'ok';
    } else {
        challengeScore.textContent = `Keep trying! Avg slope: ${sign}${slope.toFixed(2)} ft/sec (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'miss';
    }
}
