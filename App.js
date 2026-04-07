// ════════════════════════════════════════════════
// ELEMENTS
// ════════════════════════════════════════════════
const video          = document.getElementById("video");
const overlay        = document.getElementById("overlay");
const ctx            = overlay.getContext("2d", { willReadFrequently: true });
const distBadge      = document.getElementById("distBadge");
const videoWrapper   = document.getElementById("videoWrapper");
const camPlaceholder = document.getElementById("camPlaceholder");

const cameraBtn  = document.getElementById("cameraBtn");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const clearBtn   = document.getElementById("clearBtn");
const exportBtn  = document.getElementById("exportBtn");
const statusDot  = document.getElementById("statusDot");

const smoothSlider    = document.getElementById("smoothSlider");
const smoothVal       = document.getElementById("smoothVal");
const autoScaleToggle = document.getElementById("autoScaleToggle");
const regressionToggle= document.getElementById("regressionToggle");

// Header toggles
const distToggleBtn      = document.getElementById("distToggleBtn");
const speedoToggleBtn    = document.getElementById("speedoToggleBtn");
const signSlopeToggleBtn = document.getElementById("signSlopeToggleBtn");
const markerScreenBtn    = document.getElementById("markerScreenBtn");
const tableBtn           = document.getElementById("tableBtn");
const settingsOpenBtn    = document.getElementById("settingsOpenBtn");
const settingsCloseBtn   = document.getElementById("settingsCloseBtn");
const settingsPanel      = document.getElementById("settingsPanel");
const panelOverlay       = document.getElementById("panelOverlay");

// Displays
const speedoBanner   = document.getElementById("speedoBanner");
const slopeVal       = document.getElementById("slopeVal");
const slopeArrow     = document.getElementById("slopeArrow");
const slopeDir       = document.getElementById("slopeDir");
const bigDistDisplay = document.getElementById("bigDistDisplay");
const bigDistVal     = document.getElementById("bigDistVal");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNum     = document.getElementById("countdownNum");

// Stats row
const statsRow   = document.getElementById("statsRow");
const statSlope  = document.getElementById("statSlope");
const statDist   = document.getElementById("statDist");
const statR2     = document.getElementById("statR2");
const statReg    = document.getElementById("statReg");
const rmseDisplay= document.getElementById("rmseDisplay");
const statRmse   = document.getElementById("statRmse");

// Settings fields
const markerSizeInput          = document.getElementById("markerSize");
const calibrationDistanceInput = document.getElementById("calibrationDistance");
const maxTimeInput             = document.getElementById("maxTime");
const countdownDelayInput      = document.getElementById("countdownDelay");
const xAxisDurationInput       = document.getElementById("xAxisDuration");
const calibrateBtn             = document.getElementById("calibrateBtn");
const calStatus                = document.getElementById("calStatus");

// Function row
const fnInput   = document.getElementById("fnInput");
const fnPlotBtn = document.getElementById("fnPlotBtn");
const fnClearBtn= document.getElementById("fnClearBtn");
const fnError   = document.getElementById("fnError");

// Table modal
const tableModal   = document.getElementById("tableModal");
const valTable     = document.getElementById("valTable");
const tableScore   = document.getElementById("tableScore");
const closeTableBtn= document.getElementById("closeTableBtn");

// ArUco marker screen
const markerScreen    = document.getElementById("markerScreen");
const markerCanvas    = document.getElementById("markerCanvas");
const markerBackBtn   = document.getElementById("markerBackBtn");
const markerRandomBtn = document.getElementById("markerRandomBtn");
const markerIdLabel   = document.getElementById("markerIdLabel");

// Challenge
const newChallengeBtn  = document.getElementById("newChallengeBtn");
const judgeChallengeBtn= document.getElementById("judgeChallengeBtn");
const challengeText    = document.getElementById("challengeText");
const challengeScore   = document.getElementById("challengeScore");

// View mode buttons
const vmBtns = document.querySelectorAll(".vm-btn");

// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
// Default focal length: 20cm marker at 100cm = 150px wide → focalLength = (150*100)/20 = 750
let focalLength         = 750;
let lastKnownPixelWidth = null;
let recording           = false;
let countingDown        = false;
let data                = [];       // [[t, d], ...]  — raw full data
let allRuns             = [];       // array of runs, each is array of [t,d]
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
let viewMode            = 'full';   // 'full' | 'discrete' | 'hybrid'
let currentFn           = null;     // compiled function or null
let regressionOn        = false;

// ════════════════════════════════════════════════
// SETTINGS PANEL
// ════════════════════════════════════════════════
const openPanel  = () => { settingsPanel.classList.add("open");  panelOverlay.classList.add("visible"); };
const closePanel = () => { settingsPanel.classList.remove("open"); panelOverlay.classList.remove("visible"); };
settingsOpenBtn.onclick  = openPanel;
settingsCloseBtn.onclick = closePanel;
panelOverlay.onclick     = closePanel;

// ════════════════════════════════════════════════
// HEADER TOGGLES
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
    rebuildChart();
};

// ════════════════════════════════════════════════
// VIEW MODE
// ════════════════════════════════════════════════
vmBtns.forEach(btn => {
    btn.onclick = () => {
        vmBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        viewMode = btn.dataset.mode;
        rebuildChart();
    };
});

// ════════════════════════════════════════════════
// SMOOTH SLIDER
// ════════════════════════════════════════════════
smoothSlider.addEventListener("input", () => { smoothVal.textContent = smoothSlider.value; });

// ════════════════════════════════════════════════
// CHART SETUP
// ════════════════════════════════════════════════
// Dataset indices: 0=motion data, 1=function overlay, 2=regression line
const chart = new Chart(document.getElementById("chart"), {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Motion',
                data: [],
                borderColor: '#00e5ff',
                backgroundColor: 'rgba(0,229,255,0.07)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#fff',
                fill: true,
                tension: 0.3,
                segment: { borderColor: seg => getSegmentColor(seg) }
            },
            {
                label: 'f(x)',
                data: [],
                borderColor: '#ffd740',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                borderDash: [6, 3],
                pointRadius: 0,
                fill: false,
                tension: 0,
                hidden: true
            },
            {
                label: 'Regression',
                data: [],
                borderColor: '#ff4081',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [4, 4],
                pointRadius: 0,
                fill: false,
                tension: 0,
                hidden: true
            }
        ]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { color: '#7986cb', font: { family: 'Space Mono', size: 10 } } },
            tooltip: {
                backgroundColor: 'rgba(26,29,39,0.95)',
                titleColor: '#7986cb',
                bodyColor: '#e8eaf6',
                titleFont: { family: 'Space Mono', size: 10 },
                bodyFont:  { family: 'Space Mono', size: 11 },
                callbacks: {
                    title: items => `t = ${items[0].parsed.x.toFixed(2)}s`,
                    label: item => {
                        const ds = item.dataset.label;
                        return ` ${ds}: ${item.parsed.y.toFixed(3)} ft`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: "Time (s)", color: '#7986cb' },
                ticks: {
                    color: '#7986cb',
                    font: { family: 'Space Mono', size: 10 },
                    stepSize: 0.25,
                    callback: v => (v * 4 === Math.round(v * 4)) ? v.toFixed(2) : null
                },
                grid: {
                    color: ctx2 => {
                        const v = ctx2.tick.value;
                        if (Number.isInteger(v)) return 'rgba(100,120,200,0.35)';
                        return 'rgba(46,51,86,0.7)';
                    },
                    lineWidth: ctx2 => Number.isInteger(ctx2.tick.value) ? 1.5 : 0.7
                },
                min: 0,
                max: parseFloat(xAxisDurationInput.value) || 5
            },
            y: {
                title: { display: true, text: "Distance (ft)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 }, stepSize: 1 },
                grid: {
                    color: ctx2 => Number.isInteger(ctx2.tick.value) ? 'rgba(100,120,200,0.35)' : 'rgba(46,51,86,0.7)',
                    lineWidth: ctx2 => Number.isInteger(ctx2.tick.value) ? 1.5 : 0.7
                },
                min: 0, max: 10
            }
        }
    }
});

// x-axis duration setting
xAxisDurationInput.addEventListener("change", () => {
    const v = parseFloat(xAxisDurationInput.value) || 5;
    chart.options.scales.x.max = v;
    chart.update();
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

regressionToggle.addEventListener("change", () => {
    regressionOn = regressionToggle.checked;
    rebuildChart();
});

// ════════════════════════════════════════════════
// REBUILD CHART from stored data (handles view modes)
// ════════════════════════════════════════════════
function rebuildChart() {
    if (!data.length) return;

    let pts = [];
    if (viewMode === 'full') {
        pts = data.map(([t, d]) => ({ x: t, y: d }));
        chart.data.datasets[0].tension   = 0.3;
        chart.data.datasets[0].pointRadius = 0;
        chart.data.datasets[0].showLine  = true;
    } else if (viewMode === 'discrete') {
        pts = sampleEvery(data, 0.5);
        chart.data.datasets[0].tension   = 0;
        chart.data.datasets[0].pointRadius = 5;
        chart.data.datasets[0].showLine  = false;
    } else { // hybrid
        pts = sampleEvery(data, 0.5);
        chart.data.datasets[0].tension   = 0;
        chart.data.datasets[0].pointRadius = 5;
        chart.data.datasets[0].showLine  = true;
    }

    chart.data.datasets[0].data = pts;
    chart.data.datasets[0].segment = { borderColor: seg => getSegmentColor(seg) };

    // Regression
    if (regressionOn && data.length >= 3) {
        const reg = linearRegression(data);
        const xMax = chart.options.scales.x.max || 5;
        chart.data.datasets[2].data = [{ x: 0, y: reg.b }, { x: xMax, y: reg.m * xMax + reg.b }];
        chart.data.datasets[2].hidden = false;
        updateStatsRow(reg);
    } else {
        chart.data.datasets[2].data   = [];
        chart.data.datasets[2].hidden = true;
        if (data.length >= 3) updateStatsRow(null);
    }

    // Function overlay
    if (currentFn) plotFunctionOverlay();

    chart.update();
}

function sampleEvery(rawData, intervalSec) {
    const pts = [];
    let nextT = 0;
    rawData.forEach(([t, d]) => {
        if (t >= nextT) { pts.push({ x: t, y: d }); nextT = t + intervalSec; }
    });
    return pts;
}

// ════════════════════════════════════════════════
// STATS ROW
// ════════════════════════════════════════════════
function updateStatsRow(reg) {
    statsRow.style.display = 'flex';
    if (reg) {
        const sign = reg.m >= 0 ? '+' : '';
        statSlope.textContent = `${sign}${reg.m.toFixed(3)} ft/s`;
        statSlope.className   = 'stat-val ' + (reg.m > 0.05 ? 'pos' : reg.m < -0.05 ? 'neg' : '');
        statReg.textContent   = `y = ${reg.m.toFixed(2)}x ${reg.b >= 0 ? '+' : ''}${reg.b.toFixed(2)}`;
        statR2.textContent    = reg.r2.toFixed(4);
    }
    // RMSE vs function
    if (currentFn && data.length) {
        const rmse = calcRmse(data, currentFn);
        statRmse.textContent = rmse.toFixed(4) + ' ft';
        rmseDisplay.style.display = 'flex';
    } else {
        rmseDisplay.style.display = 'none';
    }
}

// Live slope + distance shown at all times in stats row
function updateLiveStats(distFt, slope) {
    statsRow.style.display = 'flex';
    const s = slope >= 0 ? '+' : '';
    statSlope.textContent = `${s}${slope.toFixed(2)} ft/s`;
    statSlope.className   = 'stat-val ' + (slope > 0.05 ? 'pos' : slope < -0.05 ? 'neg' : '');
    statDist.textContent  = distFt.toFixed(2) + ' ft';
}

// ════════════════════════════════════════════════
// REGRESSION MATH
// ════════════════════════════════════════════════
function linearRegression(pts) {
    const n = pts.length;
    let sumT=0, sumD=0, sumTD=0, sumT2=0, sumD2=0;
    pts.forEach(([t, d]) => { sumT+=t; sumD+=d; sumTD+=t*d; sumT2+=t*t; sumD2+=d*d; });
    const m = (n*sumTD - sumT*sumD) / (n*sumT2 - sumT*sumT);
    const b = (sumD - m*sumT) / n;
    // R²
    const meanD = sumD / n;
    let ssTot=0, ssRes=0;
    pts.forEach(([t, d]) => { ssTot += (d-meanD)**2; ssRes += (d - (m*t+b))**2; });
    const r2 = 1 - ssRes/ssTot;
    return { m, b, r2 };
}

function calcRmse(pts, fn) {
    const sq = pts.map(([t, d]) => { const p = fn(t); return (d - p)**2; });
    return Math.sqrt(sq.reduce((a,b) => a+b, 0) / sq.length);
}

// ════════════════════════════════════════════════
// FUNCTION PARSER
// ════════════════════════════════════════════════
// Supports: 2x+1, 2*x+1, 3x^2, 2^x, e^x, 2*e^x, 6-2(x), |x-3|, sqrt(x), etc.
// x represents time in seconds
function parseFunction(expr) {
    // Remove "y=" or "f(x)=" prefix
    let e = expr.trim().replace(/^[yY]\s*=\s*/, '').replace(/^f\s*\(\s*x\s*\)\s*=\s*/, '');

    // Normalize absolute value bars: |expr| → Math.abs(expr)
    // Handle simple |...| patterns
    e = e.replace(/\|([^|]+)\|/g, 'Math.abs($1)');

    // Implicit multiplication:
    // 2x → 2*x,  2(x → 2*(x,  )(x → )*(x,  x( → x*(  etc.
    e = e.replace(/(\d)(x)/gi, '$1*x');
    e = e.replace(/(\d)\(/g, '$1*(');
    e = e.replace(/\)(x)/gi, ')*x');
    e = e.replace(/\)(\d)/g, ')*$1');
    e = e.replace(/x\(/gi, 'x*(');
    e = e.replace(/(x)(\d)/gi, 'x*$1');

    // Powers: x^2 → Math.pow(x,2), 2^x → Math.pow(2,x)
    e = e.replace(/(\w+|\))\s*\^\s*(\w+|\()/g, 'Math.pow($1,$2)');

    // e (Euler's number) standalone — must come AFTER e^x handling
    e = e.replace(/\be\b/g, 'Math.E');

    // Math functions
    e = e.replace(/\bsqrt\b/g, 'Math.sqrt');
    e = e.replace(/\babs\b/g,  'Math.abs');
    e = e.replace(/\bsin\b/g,  'Math.sin');
    e = e.replace(/\bcos\b/g,  'Math.cos');
    e = e.replace(/\bln\b/g,   'Math.log');
    e = e.replace(/\blog\b/g,  'Math.log10');

    // Compile and test
    try {
        const fn = new Function('x', `"use strict"; return (${e});`);
        const test = fn(1);
        if (typeof test !== 'number' || isNaN(test)) throw new Error("Result is not a number");
        return fn;
    } catch(err) {
        throw new Error("Could not parse: " + err.message);
    }
}

fnPlotBtn.onclick = () => {
    const expr = fnInput.value.trim();
    if (!expr) return;
    fnError.textContent = '';
    fnInput.classList.remove('error');
    try {
        currentFn = parseFunction(expr);
        plotFunctionOverlay();
        rebuildChart();
    } catch(e) {
        fnError.textContent = '⚠ ' + e.message;
        fnInput.classList.add('error');
        currentFn = null;
    }
};

fnClearBtn.onclick = () => {
    currentFn = null;
    fnInput.value = '';
    fnError.textContent = '';
    fnInput.classList.remove('error');
    chart.data.datasets[1].data   = [];
    chart.data.datasets[1].hidden = true;
    rmseDisplay.style.display = 'none';
    chart.update();
};

function plotFunctionOverlay() {
    if (!currentFn) return;
    const xMax = chart.options.scales.x.max || 5;
    const pts  = [];
    for (let t = 0; t <= xMax; t += 0.05) {
        try {
            const y = currentFn(t);
            if (isFinite(y)) pts.push({ x: parseFloat(t.toFixed(3)), y: parseFloat(y.toFixed(4)) });
        } catch(e) {}
    }
    chart.data.datasets[1].data   = pts;
    chart.data.datasets[1].hidden = false;
    chart.update();
    // Update RMSE if we have data
    if (data.length) {
        const rmse = calcRmse(data, currentFn);
        statRmse.textContent = rmse.toFixed(4) + ' ft';
        rmseDisplay.style.display = 'flex';
        statsRow.style.display = 'flex';
    }
}

// ════════════════════════════════════════════════
// CAMERA
// ════════════════════════════════════════════════
cameraBtn.onclick = function () {
    if (typeof AR === "undefined") { alert("ArUco library failed to load. Refresh and try again."); return; }
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
                // Seed startTime so slope works before recording
                startTime = Date.now();
                requestAnimationFrame(processVideo);
            };
            cameraBtn.disabled = true;
            cameraBtn.textContent = "Camera On";
        })
        .catch(err => { alert("Camera access denied: " + err.message); });
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
    const oldest = slopeBuffer[0], newest = slopeBuffer[slopeBuffer.length - 1];
    const dt = newest.t - oldest.t;
    if (dt < 0.05) return currentSlope;
    return (newest.d - oldest.d) / dt;
}

// ════════════════════════════════════════════════
// SPEEDOMETER
// ════════════════════════════════════════════════
function updateSpeedometer(slope) {
    currentSlope = slope;
    slopeVal.textContent = (slope >= 0 ? '+' : '') + slope.toFixed(1);
    speedoBanner.classList.remove('pos', 'neg', 'zero');
    videoWrapper.classList.remove('slope-pos', 'slope-neg', 'slope-zero');
    if (Math.abs(slope) < 0.05) {
        speedoBanner.classList.add('zero');
        if (signSlopeOn) videoWrapper.classList.add('slope-zero');
        slopeDir.textContent = 'constant'; slopeArrow.textContent = '→';
    } else if (slope > 0) {
        speedoBanner.classList.add('pos');
        if (signSlopeOn) videoWrapper.classList.add('slope-pos');
        slopeDir.textContent = 'moving away'; slopeArrow.textContent = '↗';
    } else {
        speedoBanner.classList.add('neg');
        if (signSlopeOn) videoWrapper.classList.add('slope-neg');
        slopeDir.textContent = 'moving closer'; slopeArrow.textContent = '↘';
    }
}

// ════════════════════════════════════════════════
// PROCESS VIDEO FRAME
// ════════════════════════════════════════════════
function processVideo() {
    if (!video.videoWidth) { requestAnimationFrame(processVideo); return; }

    const vw = video.videoWidth, vh = video.videoHeight;
    overlay.width = vw; overlay.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);
    const imageData = ctx.getImageData(0, 0, vw, vh);
    const markers   = detector.detect(imageData);
    ctx.clearRect(0, 0, vw, vh);

    if (markers.length > 0) {
        const corners = markers[0].corners;

        // Draw outline — scale corners to CSS display size for drawing
        const scaleX = overlay.clientWidth  / vw;
        const scaleY = overlay.clientHeight / vh;
        ctx.save();
        ctx.scale(scaleX > 0 ? 1 : 1, scaleY > 0 ? 1 : 1); // draw in native coords
        ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 3;
        ctx.beginPath();
        corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = "#ff4081";
        corners.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI*2); ctx.fill(); });
        ctx.restore();

        const widthPixels = Math.hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y);
        lastKnownPixelWidth = widthPixels;

        // Auto-calibrate using default if not manually calibrated
        const distCmRaw = (parseFloat(markerSizeInput.value) * focalLength) / widthPixels;
        const distCm    = smooth(distCmRaw);
        const distFt    = distCm / 30.48;

        distBadge.innerText = "Distance: " + distFt.toFixed(2) + " ft";
        if (bigDistOn) bigDistVal.textContent = distFt.toFixed(1) + " ft";

        const now   = (Date.now() - startTime) / 1000;
        const slope = calcSlope(now, distFt);
        updateSpeedometer(slope);
        updateLiveStats(distFt, slope);

        if (recording) {
            const t = (Date.now() - startTime) / 1000;
            if (t >= parseFloat(maxTimeInput.value)) {
                stopRecording();
            } else if (t - lastRecordTime >= 0.05) {
                lastRecordTime = t;
                const tVal = parseFloat(t.toFixed(2));
                const dVal = parseFloat(distFt.toFixed(3));
                data.push([tVal, dVal]);
                // Live chart update
                chart.data.datasets[0].data.push({ x: tVal, y: dVal });
                chart.update('none');
            }
        }
    } else {
        distBadge.innerText = "Marker not detected";
        lastKnownPixelWidth = null;
        videoWrapper.classList.remove('slope-pos','slope-neg','slope-zero');
    }
    requestAnimationFrame(processVideo);
}

// ════════════════════════════════════════════════
// CALIBRATE (manual override)
// ════════════════════════════════════════════════
calibrateBtn.onclick = function () {
    if (!lastKnownPixelWidth) { alert("Hold the marker in front of the camera first, then click Calibrate."); return; }
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
function playChime(isGo) {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator(), gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.frequency.value = isGo ? 880 : 440;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (isGo ? 0.6 : 0.25));
        osc.start(ac.currentTime); osc.stop(ac.currentTime + (isGo ? 0.6 : 0.25));
    } catch(e) {}
}

startBtn.onclick = function () {
    if (countingDown || recording) return;
    const delay = parseInt(countdownDelayInput.value) || 0;
    if (delay <= 0) { beginRecording(); return; }
    countingDown = true; startBtn.disabled = true;
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
                countingDown = false; startBtn.disabled = false;
                beginRecording();
            }, 800);
        }
    }, 1000);
};

function beginRecording() {
    // New run starts ON TOP of existing data (don't clear chart)
    recording      = true;
    data           = [];           // reset data for this run
    startTime      = Date.now();
    lastRecordTime = 0;
    smoothBuffer   = [];
    slopeBuffer    = [];
    statusDot.classList.add("recording");
    // Set x-axis based on max time
    const xDur = parseFloat(xAxisDurationInput.value) || 5;
    chart.options.scales.x.max = xDur;
    // Keep previous run data on chart as a faded ghost
    fadeOldDatasets();
    // Add fresh dataset for this run
    chart.data.datasets[0] = {
        label: 'Motion',
        data: [],
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0,229,255,0.07)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#fff',
        fill: false,
        tension: 0.3,
        segment: { borderColor: seg => getSegmentColor(seg) }
    };
    chart.update();
}

function fadeOldDatasets() {
    // Dim current motion dataset to become a ghost run
    const current = chart.data.datasets[0];
    if (current.data.length > 0) {
        const ghost = JSON.parse(JSON.stringify(current));
        ghost.label = 'Previous run';
        ghost.borderColor = 'rgba(0,229,255,0.25)';
        ghost.backgroundColor = 'transparent';
        ghost.borderWidth = 1;
        ghost.pointRadius = 0;
        ghost.segment = undefined;
        // Insert ghost before index 0 — actually push at end, it'll render behind
        chart.data.datasets.push(ghost);
    }
}

function stopRecording() {
    recording = false;
    statusDot.classList.remove("recording");
    statusDot.classList.add("active");
    // Rebuild chart with proper view mode + regression
    rebuildChart();
    evaluateChallenge();
}

stopBtn.onclick = function () {
    if (countingDown) {
        clearInterval(countdownTimer);
        countdownOverlay.classList.remove("visible");
        countingDown = false; startBtn.disabled = false;
    }
    if (recording) stopRecording();
    smoothBuffer = []; lastRecordTime = 0; slopeBuffer = [];
};

clearBtn.onclick = function () {
    if (countingDown) { clearInterval(countdownTimer); countdownOverlay.classList.remove("visible"); countingDown = false; }
    recording = false;
    startBtn.disabled = false;
    data = [];
    // Reset to just 3 core datasets
    chart.data.datasets = chart.data.datasets.slice(0, 3);
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = []; chart.data.datasets[1].hidden = true;
    chart.data.datasets[2].data = []; chart.data.datasets[2].hidden = true;
    chart.update();
    statsRow.style.display = 'none';
    smoothBuffer = []; lastRecordTime = 0; slopeBuffer = [];
    statusDot.classList.remove("recording");
    challengeScore.textContent = ''; challengeScore.className = '';
};

exportBtn.onclick = function () {
    if (!data.length) { alert("No data to export!"); return; }
    let csv = "time_seconds,distance_ft";
    if (currentFn) csv += ",fn_value,residual";
    csv += "\n";
    data.forEach(([t, d]) => {
        let row = `${t},${d}`;
        if (currentFn) { const fv = currentFn(t); row += `,${fv.toFixed(4)},${(d - fv).toFixed(4)}`; }
        csv += row + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "motion_data.csv"; link.click();
};

// ════════════════════════════════════════════════
// VALUES TABLE
// ════════════════════════════════════════════════
tableBtn.onclick = () => {
    if (!data.length) { alert("No data recorded yet!"); return; }
    buildTable();
    tableModal.classList.add("visible");
};
closeTableBtn.onclick = () => tableModal.classList.remove("visible");

function buildTable() {
    const hasFn = !!currentFn;
    const thead = valTable.querySelector('thead');
    const tbody = valTable.querySelector('tbody');

    // Sample at every 0.5s for readability
    const samples = sampleEvery(data, 0.5);
    const reg     = data.length >= 3 ? linearRegression(data) : null;

    thead.innerHTML = `<tr>
        <th>Time (s)</th>
        <th>Distance (ft)</th>
        ${reg ? '<th>Regression y</th><th>Reg. Residual</th>' : ''}
        ${hasFn ? '<th>f(x)</th><th>f(x) Residual</th>' : ''}
    </tr>`;

    tbody.innerHTML = '';
    samples.forEach(({ x: t, y: d }) => {
        const regY = reg ? (reg.m * t + reg.b) : null;
        const fnY  = hasFn ? currentFn(t) : null;
        const regRes = regY !== null ? (d - regY) : null;
        const fnRes  = fnY  !== null ? (d - fnY)  : null;

        const regResCls = regRes !== null ? (Math.abs(regRes) < 0.1 ? 'good' : Math.abs(regRes) < 0.3 ? 'ok' : 'miss') : '';
        const fnResCls  = fnRes  !== null ? (Math.abs(fnRes)  < 0.1 ? 'good' : Math.abs(fnRes)  < 0.3 ? 'ok' : 'miss') : '';

        tbody.innerHTML += `<tr>
            <td>${t.toFixed(2)}</td>
            <td>${d.toFixed(3)}</td>
            ${reg ? `<td>${regY.toFixed(3)}</td><td class="residual ${regResCls}">${regRes >= 0 ? '+' : ''}${regRes.toFixed(3)}</td>` : ''}
            ${hasFn ? `<td>${fnY.toFixed(3)}</td><td class="residual ${fnResCls}">${fnRes >= 0 ? '+' : ''}${fnRes.toFixed(3)}</td>` : ''}
        </tr>`;
    });

    // Score
    let scoreHTML = '';
    if (reg) {
        scoreHTML += `<span style="color:var(--accent)">R² = ${reg.r2.toFixed(4)}</span> &nbsp;|&nbsp; `;
        scoreHTML += `<span style="color:var(--muted)">Regression: y = ${reg.m.toFixed(3)}x ${reg.b >= 0 ? '+' : ''}${reg.b.toFixed(3)}</span>`;
    }
    if (hasFn && data.length) {
        const rmse = calcRmse(data, currentFn);
        scoreHTML += `&nbsp; &nbsp; <span style="color:var(--warn)">RMSE vs f(x) = ${rmse.toFixed(4)} ft</span>`;
        // Score out of 100
        const score = Math.max(0, Math.round(100 - rmse * 50));
        const emoji = score >= 90 ? '🏅' : score >= 70 ? '👍' : '📈';
        scoreHTML += `&nbsp; &nbsp; <span style="color:var(--success)">${emoji} Match Score: ${score}/100</span>`;
    }
    tableScore.innerHTML = scoreHTML;
}

// ════════════════════════════════════════════════
// ARUCO MARKER SCREEN
// ════════════════════════════════════════════════
// Original ArUco 4x4 dictionary — 50 markers encoded as 5x5 bit matrices (inner 5x5 bits)
// Each marker is 7x7 total (1px border + 5px data + 1px border)
// Encoded as 5 rows of 5 bits each (1=black, 0=white)
const ARUCO_DICT = [
    // id: bits as 5 rows MSB first
    [0b11111,0b10001,0b10101,0b10001,0b11111], // 0  — border pattern placeholder, real data below
];

// Full 50-marker original ArUco dictionary (7x7 bit grid, inner 5x5 data)
// Stored as array of 5 integers, each representing one row of the inner 5x5 grid
const DICT_ORIG = [
    [0b10001,0b11011,0b01010,0b00001,0b01011], // 0
    [0b11100,0b11011,0b01110,0b11100,0b10111], // 1
    [0b01110,0b11011,0b10101,0b01110,0b00100], // 2
    [0b10110,0b01011,0b11001,0b00110,0b01001], // 3
    [0b01011,0b10110,0b00111,0b11010,0b11100], // 4
    [0b11010,0b01101,0b10010,0b10001,0b00011], // 5
    [0b00111,0b10100,0b11001,0b01110,0b11010], // 6
    [0b10000,0b00111,0b01101,0b10110,0b01111], // 7
    [0b01101,0b10010,0b00110,0b01101,0b10010], // 8
    [0b11001,0b00110,0b10011,0b01100,0b11001], // 9
    [0b00100,0b11011,0b00111,0b11000,0b10110], // 10
    [0b10011,0b01100,0b11001,0b10011,0b01100], // 11
    [0b01001,0b10110,0b01011,0b10100,0b11010], // 12
    [0b11010,0b10101,0b01010,0b11010,0b00101], // 13
    [0b00110,0b01101,0b10110,0b01011,0b10100], // 14
    [0b10101,0b01010,0b10101,0b01010,0b10101], // 15
    [0b11000,0b00111,0b10011,0b00110,0b11001], // 16
    [0b01111,0b10000,0b01111,0b10000,0b01111], // 17
    [0b10010,0b11001,0b00110,0b01011,0b00100], // 18
    [0b00001,0b11110,0b10101,0b01110,0b10001], // 19
    [0b11011,0b00100,0b10110,0b01001,0b11101], // 20
    [0b01010,0b10101,0b01010,0b10101,0b01010], // 21
    [0b10100,0b01011,0b10100,0b01011,0b10100], // 22
    [0b00011,0b11100,0b01111,0b00001,0b11110], // 23
    [0b11100,0b00011,0b10001,0b11110,0b00001], // 24
    [0b01000,0b10111,0b00010,0b11101,0b01000], // 25
    [0b10111,0b01000,0b11101,0b00010,0b10111], // 26
    [0b00101,0b11010,0b01101,0b10010,0b00101], // 27
    [0b11010,0b00101,0b10010,0b01101,0b11010], // 28
    [0b01100,0b10011,0b01100,0b10011,0b01100], // 29
    [0b10001,0b01110,0b10001,0b01110,0b10001], // 30
    [0b01110,0b10001,0b01110,0b10001,0b01110], // 31
    [0b11110,0b00001,0b11110,0b00001,0b11110], // 32
    [0b00001,0b11110,0b00001,0b11110,0b00001], // 33
    [0b10110,0b11001,0b01101,0b00110,0b10011], // 34
    [0b01001,0b00110,0b10010,0b11001,0b01100], // 35
    [0b11101,0b00010,0b01011,0b10100,0b11101], // 36
    [0b00010,0b11101,0b10100,0b01011,0b00010], // 37
    [0b10011,0b11100,0b00011,0b11100,0b10011], // 38
    [0b01100,0b00011,0b11100,0b00011,0b01100], // 39
    [0b10100,0b10100,0b10100,0b10100,0b10100], // 40
    [0b01011,0b01011,0b01011,0b01011,0b01011], // 41
    [0b11000,0b11000,0b11000,0b11000,0b11000], // 42
    [0b00111,0b00111,0b00111,0b00111,0b00111], // 43
    [0b10010,0b01001,0b10010,0b01001,0b10010], // 44
    [0b01101,0b10110,0b01101,0b10110,0b01101], // 45
    [0b11011,0b00100,0b11011,0b00100,0b11011], // 46
    [0b00100,0b11011,0b00100,0b11011,0b00100], // 47
    [0b10101,0b10101,0b10101,0b10101,0b10101], // 48
    [0b01010,0b01010,0b01010,0b01010,0b01010], // 49
];

let currentMarkerId = 0;

function drawMarker(id) {
    currentMarkerId = id;
    markerIdLabel.textContent = `Marker ID: ${id}`;
    const bits  = DICT_ORIG[id % DICT_ORIG.length];
    const cells = 7;   // 5 data + 2 border
    // Target display: ~15cm. At 96dpi, 1cm ≈ 38px. 15cm ≈ 570px. Each cell = 570/7 ≈ 81px
    const cellPx = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.55 / cells);
    const size   = cells * cellPx;
    markerCanvas.width  = size;
    markerCanvas.height = size;
    const mc = markerCanvas.getContext("2d");
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, size, size);

    for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
            let black = true;
            if (row === 0 || row === 6 || col === 0 || col === 6) {
                black = true; // border always black
            } else if (row === 1 || row === 5 || col === 1 || col === 5) {
                black = false; // inner white border
            } else {
                // data area: rows 2-4, cols 2-4 → map to bits rows 0-4, cols 0-4
                const dataRow = row - 1; // 1-5 → 0-4
                const dataCol = col - 1; // 1-5 → 0-4
                // bit 4 = leftmost (col 0)
                black = ((bits[dataRow] >> (4 - dataCol)) & 1) === 1;
            }
            mc.fillStyle = black ? '#000' : '#fff';
            mc.fillRect(col * cellPx, row * cellPx, cellPx, cellPx);
        }
    }
}

markerScreenBtn.onclick = () => {
    markerScreen.classList.add("visible");
    drawMarker(0);
};
markerBackBtn.onclick = () => markerScreen.classList.remove("visible");
markerRandomBtn.onclick = () => drawMarker(Math.floor(Math.random() * DICT_ORIG.length));

// ════════════════════════════════════════════════
// SLOPE CHALLENGES
// ════════════════════════════════════════════════
const CHALLENGES = [
    { description: "Walk at a <span class='target'>constant</span> speed away — target: <span class='target'>+1.0 ft/sec</span>.", targetSlope: 1.0, tolerance: 0.25 },
    { description: "Hold <span class='target'>perfectly still</span> — target: <span class='target'>0.0 ft/sec</span>.", targetSlope: 0.0, tolerance: 0.10 },
    { description: "Walk <span class='target'>slowly toward</span> the camera — target: <span class='target'>−0.5 ft/sec</span>.", targetSlope: -0.5, tolerance: 0.20 },
    { description: "Walk <span class='target'>quickly away</span> — target: <span class='target'>+2.0 ft/sec</span>.", targetSlope: 2.0, tolerance: 0.40 },
    { description: "Walk <span class='target'>slowly away</span> — target: <span class='target'>+0.5 ft/sec</span>.", targetSlope: 0.5, tolerance: 0.15 },
    { description: "Move <span class='target'>quickly toward</span> — target: <span class='target'>−1.5 ft/sec</span>.", targetSlope: -1.5, tolerance: 0.40 },
];

newChallengeBtn.onclick = function () {
    currentChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    challengeText.innerHTML = currentChallenge.description +
        `<br><br><em style="color:var(--muted);font-size:0.65rem">Record for ~5s then press Stop or Judge My Run.</em>`;
    challengeScore.textContent = ''; challengeScore.className = '';
};

judgeChallengeBtn.onclick = evaluateChallenge;

function evaluateChallenge() {
    if (!currentChallenge || data.length < 4) return;
    const reg   = linearRegression(data);
    const error = Math.abs(reg.m - currentChallenge.targetSlope);
    const sign  = reg.m >= 0 ? '+' : '';
    const tgt   = currentChallenge.targetSlope;
    if (error <= currentChallenge.tolerance) {
        challengeScore.textContent = `🏅 Great! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'great';
    } else if (error <= currentChallenge.tolerance * 2) {
        challengeScore.textContent = `👍 Close! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'ok';
    } else {
        challengeScore.textContent = `Keep trying! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target: ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'miss';
    }
}
