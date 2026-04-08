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

const autoScaleToggle  = document.getElementById("autoScaleToggle");
const regressionToggle = document.getElementById("regressionToggle");
const signSlopeToggleBtn = document.getElementById("signSlopeToggleBtn");

// Settings panel
const settingsOpenBtn  = document.getElementById("settingsOpenBtn");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingsPanel    = document.getElementById("settingsPanel");
const panelOverlay     = document.getElementById("panelOverlay");

// Right gauges
const distReadout  = document.getElementById("distReadout");
const distUnit     = document.getElementById("distUnit");
const arrowCanvas  = document.getElementById("arrowCanvas");
const arrowCtx     = arrowCanvas.getContext("2d");
const slopeReadout = document.getElementById("slopeReadout");
const slopeDirLabel= document.getElementById("slopeDirLabel");

// Countdown
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
const tableModal    = document.getElementById("tableModal");
const valTable      = document.getElementById("valTable");
const tableScore    = document.getElementById("tableScore");
const closeTableBtn = document.getElementById("closeTableBtn");
const tableBtn      = document.getElementById("tableBtn");

// Marker screen
const markerScreenBtn  = document.getElementById("markerScreenBtn");
const markerScreen     = document.getElementById("markerScreen");
const markerCanvas     = document.getElementById("markerCanvas");
const markerBackBtn    = document.getElementById("markerBackBtn");
const markerRandomBtn  = document.getElementById("markerRandomBtn");
const markerIdLabel    = document.getElementById("markerIdLabel");
const markerSizePx     = document.getElementById("markerSizePx");
const markerSizeCm     = document.getElementById("markerSizeCm");

// Challenge
const newChallengeBtn   = document.getElementById("newChallengeBtn");
const judgeChallengeBtn = document.getElementById("judgeChallengeBtn");
const challengeText     = document.getElementById("challengeText");
const challengeScore    = document.getElementById("challengeScore");

// View mode buttons
const vmBtns = document.querySelectorAll(".vm-btn");

// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
// Default focal length: 20cm marker at 100cm = 150px → f = (150*100)/20 = 750
let focalLength         = 750;
let lastKnownPixelWidth = null;
let recording           = false;
let countingDown        = false;
let data                = [];
let startTime           = null;
let lastRecordTime      = 0;
let smoothBuffer        = [];
let detector            = null;
let currentSlope        = 0;
let slopeBuffer         = [];
let currentChallenge    = null;
let signSlopeOn         = false;
let countdownTimer      = null;
let viewMode            = 'full';
let currentFn           = null;
let regressionOn        = false;
// Smooth arrow angle for rendering
let arrowAngleDeg       = 0;
let targetAngleDeg      = 0;

// ════════════════════════════════════════════════
// SETTINGS PANEL
// ════════════════════════════════════════════════
const openPanel  = () => { settingsPanel.classList.add("open");  panelOverlay.classList.add("visible"); };
const closePanel = () => { settingsPanel.classList.remove("open"); panelOverlay.classList.remove("visible"); };
settingsOpenBtn.onclick  = openPanel;
settingsCloseBtn.onclick = closePanel;
panelOverlay.onclick     = closePanel;

// ════════════════════════════════════════════════
// SIGN OF SLOPE TOGGLE (header)
// ════════════════════════════════════════════════
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
// CHART
// ════════════════════════════════════════════════
const chart = new Chart(document.getElementById("chart"), {
    type: 'line',
    data: {
        datasets: [
            {   // 0 — motion data
                label: 'Motion',
                data: [],
                borderColor: '#00e5ff',
                backgroundColor: 'rgba(0,229,255,0.07)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#00e5ff',
                fill: true, tension: 0.3,
                segment: { borderColor: seg => getSegmentColor(seg) }
            },
            {   // 1 — function overlay
                label: 'f(x)',
                data: [],
                borderColor: '#ffd740',
                backgroundColor: 'transparent',
                borderWidth: 2.5, borderDash: [6, 3],
                pointRadius: 0, fill: false, tension: 0, hidden: true
            },
            {   // 2 — regression
                label: 'Regression',
                data: [],
                borderColor: '#ff4081',
                backgroundColor: 'transparent',
                borderWidth: 2, borderDash: [4, 4],
                pointRadius: 0, fill: false, tension: 0, hidden: true
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
                titleColor: '#7986cb', bodyColor: '#e8eaf6',
                titleFont: { family: 'Space Mono', size: 10 },
                bodyFont:  { family: 'Space Mono', size: 11 },
                callbacks: {
                    title: items => `t = ${items[0].parsed.x.toFixed(2)}s`,
                    label: item => ` ${item.dataset.label}: (${item.parsed.x.toFixed(2)}s, ${item.parsed.y.toFixed(3)}ft)`
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: "Time (s)", color: '#7986cb' },
                ticks: {
                    color: '#7986cb', font: { family: 'Space Mono', size: 10 },
                    stepSize: 0.25,
                    callback: v => (Math.round(v * 4) === v * 4) ? v.toFixed(2) : null
                },
                grid: {
                    color: c => Number.isInteger(c.tick.value) ? 'rgba(100,120,200,0.4)' : 'rgba(46,51,86,0.8)',
                    lineWidth: c => Number.isInteger(c.tick.value) ? 1.5 : 0.7
                },
                min: 0, max: parseFloat(xAxisDurationInput.value) || 5
            },
            y: {
                title: { display: true, text: "Distance (ft)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 }, stepSize: 1 },
                grid: {
                    color: c => Number.isInteger(c.tick.value) ? 'rgba(100,120,200,0.4)' : 'rgba(46,51,86,0.8)',
                    lineWidth: c => Number.isInteger(c.tick.value) ? 1.5 : 0.7
                },
                min: 0, max: 15   // FIX #6: y-axis to 15 ft
            }
        }
    }
});

xAxisDurationInput.addEventListener("change", () => {
    chart.options.scales.x.max = parseFloat(xAxisDurationInput.value) || 5;
    chart.update();
});

// FIX #7: flipped colors — positive slope = green, negative = red
function getSegmentColor(seg) {
    if (!signSlopeOn) return '#00e5ff';
    const d = seg.p1.parsed.y - seg.p0.parsed.y;
    if (Math.abs(d) < 0.015) return '#ffd740';       // flat → yellow
    return d > 0 ? '#69f0ae' : '#ff4081';              // up=green, down=red
}

autoScaleToggle.addEventListener("change", () => {
    chart.options.scales.y.min = autoScaleToggle.checked ? undefined : 0;
    chart.options.scales.y.max = autoScaleToggle.checked ? undefined : 15;
    chart.update();
});

regressionToggle.addEventListener("change", () => {
    regressionOn = regressionToggle.checked;
    rebuildChart();
});

// ════════════════════════════════════════════════
// REBUILD CHART
// ════════════════════════════════════════════════
function rebuildChart() {
    if (!data.length) return;
    let pts = [];

    if (viewMode === 'full') {
        pts = data.map(([t, d]) => ({ x: t, y: d }));
        chart.data.datasets[0].tension    = 0.3;
        chart.data.datasets[0].pointRadius = 0;
        chart.data.datasets[0].showLine   = true;
    } else if (viewMode === 'discrete') {
        // FIX #4: sample at exact 0, 0.5, 1.0 ... intervals
        pts = sampleAtIntervals(data, 0.5);
        chart.data.datasets[0].tension    = 0;
        chart.data.datasets[0].pointRadius = 6;
        chart.data.datasets[0].showLine   = false;
    } else { // hybrid
        pts = sampleAtIntervals(data, 0.5);
        chart.data.datasets[0].tension    = 0;
        chart.data.datasets[0].pointRadius = 6;
        chart.data.datasets[0].showLine   = true;
    }

    chart.data.datasets[0].data = pts;
    chart.data.datasets[0].segment = { borderColor: seg => getSegmentColor(seg) };

    // Regression
    if (regressionOn && data.length >= 3) {
        const reg  = linearRegression(data);
        const xMax = chart.options.scales.x.max || 5;
        chart.data.datasets[2].data   = [{ x: 0, y: reg.b }, { x: xMax, y: reg.m * xMax + reg.b }];
        chart.data.datasets[2].hidden = false;
        updateStatsRow(reg);
    } else {
        chart.data.datasets[2].data   = [];
        chart.data.datasets[2].hidden = true;
        if (data.length >= 3) updateStatsRow(null);
    }

    if (currentFn) plotFunctionOverlay();
    chart.update();
}

// FIX #4: sample at exact interval boundaries by interpolating
function sampleAtIntervals(rawData, intervalSec) {
    if (!rawData.length) return [];
    const maxT = rawData[rawData.length - 1][0];
    const pts  = [];
    for (let t = 0; t <= maxT + 0.001; t = parseFloat((t + intervalSec).toFixed(4))) {
        // Find the two surrounding points and interpolate
        let lo = rawData[0], hi = rawData[rawData.length - 1];
        for (let i = 0; i < rawData.length - 1; i++) {
            if (rawData[i][0] <= t && rawData[i+1][0] >= t) { lo = rawData[i]; hi = rawData[i+1]; break; }
        }
        const dt = hi[0] - lo[0];
        const d  = dt < 0.001 ? lo[1] : lo[1] + (hi[1] - lo[1]) * (t - lo[0]) / dt;
        pts.push({ x: parseFloat(t.toFixed(2)), y: parseFloat(d.toFixed(3)) });
    }
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
        statReg.textContent   = `y=${reg.m.toFixed(2)}x${reg.b >= 0 ? '+' : ''}${reg.b.toFixed(2)}`;
        statR2.textContent    = reg.r2.toFixed(4);
    }
    if (currentFn && data.length) {
        const rmse = calcRmse(data, currentFn);
        statRmse.textContent = rmse.toFixed(4) + ' ft';
        rmseDisplay.style.display = 'flex';
    } else {
        rmseDisplay.style.display = 'none';
    }
}

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
    pts.forEach(([t,d]) => { sumT+=t; sumD+=d; sumTD+=t*d; sumT2+=t*t; sumD2+=d*d; });
    const m = (n*sumTD - sumT*sumD) / (n*sumT2 - sumT*sumT);
    const b = (sumD - m*sumT) / n;
    const meanD = sumD / n;
    let ssTot=0, ssRes=0;
    pts.forEach(([t,d]) => { ssTot += (d-meanD)**2; ssRes += (d-(m*t+b))**2; });
    return { m, b, r2: 1 - ssRes/ssTot };
}

function calcRmse(pts, fn) {
    return Math.sqrt(pts.map(([t,d]) => (d - fn(t))**2).reduce((a,b) => a+b, 0) / pts.length);
}

// ════════════════════════════════════════════════
// ROTATING ARROW GAUGE (canvas)
// ════════════════════════════════════════════════
// angle: 0° = pointing right (zero slope), -90° = up (moving away), +90° = down (moving closer)
// We map slope: clamp to ±3 ft/s → angle ±80°
function drawArrow(angleDeg, slope) {
    const w = arrowCanvas.width, h = arrowCanvas.height;
    arrowCtx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = w * 0.38;

    // Background circle
    arrowCtx.beginPath();
    arrowCtx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    const absSlope = Math.abs(slope);
    let color;
    if (absSlope < 0.05)        color = '#ffd740';
    else if (slope > 0)         color = '#69f0ae';  // moving away = green
    else                        color = '#ff4081';  // moving closer = red
    arrowCtx.fillStyle = color + '22';
    arrowCtx.fill();
    arrowCtx.strokeStyle = color + '66';
    arrowCtx.lineWidth = 2;
    arrowCtx.stroke();

    // Tick marks at 0°, ±45°, ±90°
    [-90, -45, 0, 45, 90].forEach(deg => {
        const rad = (deg * Math.PI) / 180;
        const inner = r - 5, outer = r + 2;
        arrowCtx.beginPath();
        arrowCtx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
        arrowCtx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
        arrowCtx.strokeStyle = '#2e3356';
        arrowCtx.lineWidth = 1.5;
        arrowCtx.stroke();
    });

    // Arrow
    const rad = (angleDeg * Math.PI) / 180;
    const arrowLen = r - 6;
    const arrowX = cx + Math.cos(rad) * arrowLen;
    const arrowY = cy + Math.sin(rad) * arrowLen;

    arrowCtx.beginPath();
    arrowCtx.moveTo(cx, cy);
    arrowCtx.lineTo(arrowX, arrowY);
    arrowCtx.strokeStyle = color;
    arrowCtx.lineWidth = 4;
    arrowCtx.lineCap = 'round';
    arrowCtx.stroke();

    // Arrowhead
    const headLen = 10, headAngle = 0.4;
    arrowCtx.beginPath();
    arrowCtx.moveTo(arrowX, arrowY);
    arrowCtx.lineTo(
        arrowX - headLen * Math.cos(rad - headAngle),
        arrowY - headLen * Math.sin(rad - headAngle)
    );
    arrowCtx.moveTo(arrowX, arrowY);
    arrowCtx.lineTo(
        arrowX - headLen * Math.cos(rad + headAngle),
        arrowY - headLen * Math.sin(rad + headAngle)
    );
    arrowCtx.strokeStyle = color;
    arrowCtx.lineWidth = 3;
    arrowCtx.stroke();

    // Center dot
    arrowCtx.beginPath();
    arrowCtx.arc(cx, cy, 4, 0, Math.PI * 2);
    arrowCtx.fillStyle = color;
    arrowCtx.fill();
}

function updateGauges(distFt, slope) {
    // Distance box
    distReadout.textContent = distFt.toFixed(1);

    // Slope arrow — map slope to angle
    // slope=0 → 0° (right), slope>0 → negative angle (up), slope<0 → positive angle (down)
    const clampedSlope = Math.max(-4, Math.min(4, slope));
    targetAngleDeg = -clampedSlope * 20; // ±4 ft/s → ±80°
    // Smooth the angle
    arrowAngleDeg += (targetAngleDeg - arrowAngleDeg) * 0.25;
    drawArrow(arrowAngleDeg, slope);

    // Slope readout text
    const sign = slope >= 0 ? '+' : '';
    slopeReadout.textContent = sign + slope.toFixed(1);
    slopeReadout.className   = Math.abs(slope) < 0.05 ? 'zero' : slope > 0 ? 'pos' : 'neg';

    // Direction label
    const absSlope = Math.abs(slope);
    if (absSlope < 0.05)  slopeDirLabel.textContent = 'constant';
    else if (slope > 0)   slopeDirLabel.textContent = 'moving away';
    else                  slopeDirLabel.textContent = 'moving closer';

    // Video border color (sign of slope)
    videoWrapper.classList.remove('slope-pos','slope-neg','slope-zero');
    if (signSlopeOn) {
        if (absSlope < 0.05)  videoWrapper.classList.add('slope-zero');
        else if (slope > 0)   videoWrapper.classList.add('slope-pos');
        else                  videoWrapper.classList.add('slope-neg');
    }
}

// Animate arrow even when not tracking (keeps it smooth)
function arrowLoop() {
    // Called via rAF inside processVideo, also run idle loop
    requestAnimationFrame(arrowLoop);
}
// Draw initial arrow
drawArrow(0, 0);

// ════════════════════════════════════════════════
// FUNCTION PARSER
// ════════════════════════════════════════════════
function parseFunction(expr) {
    let e = expr.trim()
        .replace(/^[yY]\s*=\s*/, '')
        .replace(/^f\s*\(\s*x\s*\)\s*=\s*/, '');

    // Absolute value bars
    e = e.replace(/\|([^|]+)\|/g, 'Math.abs($1)');

    // Implicit multiplication
    e = e.replace(/(\d)(x)/gi,  '$1*x');
    e = e.replace(/(\d)\(/g,    '$1*(');
    e = e.replace(/\)(x)/gi,    ')*x');
    e = e.replace(/\)(\d)/g,    ')*$1');
    e = e.replace(/x\(/gi,      'x*(');
    e = e.replace(/(x)(\d)/gi,  'x*$1');

    // Powers: x^2 → Math.pow(x,2)
    e = e.replace(/([a-zA-Z0-9_\.]+|\))\s*\^\s*([a-zA-Z0-9_\.]+|\()/g, 'Math.pow($1,$2)');

    // e constant
    e = e.replace(/\be\b/g, 'Math.E');

    // Math functions
    e = e.replace(/\bsqrt\b/g,  'Math.sqrt');
    e = e.replace(/\babs\b/g,   'Math.abs');
    e = e.replace(/\bsin\b/g,   'Math.sin');
    e = e.replace(/\bcos\b/g,   'Math.cos');
    e = e.replace(/\bln\b/g,    'Math.log');
    e = e.replace(/\blog\b/g,   'Math.log10');
    e = e.replace(/\bpi\b/gi,   'Math.PI');

    try {
        const fn   = new Function('x', `"use strict"; return (${e});`);
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
    for (let t = 0; t <= xMax + 0.001; t += 0.05) {
        try {
            const y = currentFn(t);
            if (isFinite(y)) pts.push({ x: parseFloat(t.toFixed(3)), y: parseFloat(y.toFixed(4)) });
        } catch(e) {}
    }
    chart.data.datasets[1].data   = pts;
    chart.data.datasets[1].hidden = false;
    chart.update();
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
    if (typeof AR === "undefined") { alert("ArUco library failed to load. Refresh."); return; }
    if (!detector) detector = new AR.Detector();
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then(stream => {
            video.srcObject = stream;
            video.style.display = "block";
            camPlaceholder.style.display = "none";
            video.onloadedmetadata = () => {
                video.play();
                statusDot.classList.add("active");
                startBtn.disabled = false;
                startTime = Date.now();
                requestAnimationFrame(processVideo);
            };
            cameraBtn.disabled = true;
            cameraBtn.textContent = "Camera On";
        })
        .catch(err => { alert("Camera access denied: " + err.message); });
};

// ════════════════════════════════════════════════
// SMOOTHING — fixed at 15 samples (FIX #5)
// ════════════════════════════════════════════════
const SMOOTH_N = 15;
function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > SMOOTH_N) smoothBuffer.shift();
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
    currentSlope = (newest.d - oldest.d) / dt;
    return currentSlope;
}

// ════════════════════════════════════════════════
// PROCESS VIDEO FRAME — FIX #3: correct overlay scaling
// ════════════════════════════════════════════════
function processVideo() {
    if (!video.videoWidth) { requestAnimationFrame(processVideo); return; }

    // Draw video at NATIVE resolution into canvas
    const vw = video.videoWidth, vh = video.videoHeight;
    overlay.width = vw; overlay.height = vh;
    ctx.drawImage(video, 0, 0, vw, vh);

    const imageData = ctx.getImageData(0, 0, vw, vh);
    const markers   = detector.detect(imageData);
    ctx.clearRect(0, 0, vw, vh);

    if (markers.length > 0) {
        const corners = markers[0].corners;

        // Draw in native pixel coords — canvas CSS stretches it correctly
        ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = Math.max(2, vw / 200);
        ctx.beginPath();
        corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
        ctx.closePath(); ctx.stroke();

        const dotR = Math.max(4, vw / 120);
        ctx.fillStyle = "#ff4081";
        corners.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, dotR, 0, Math.PI*2); ctx.fill(); });

        // Pixel width using adjacent corners (top-left to top-right)
        const widthPixels = Math.hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y);
        lastKnownPixelWidth = widthPixels;

        const distCm = smooth((parseFloat(markerSizeInput.value) * focalLength) / widthPixels);
        const distFt = distCm / 30.48;

        distBadge.innerText = distFt.toFixed(2) + " ft";

        const now   = (Date.now() - startTime) / 1000;
        const slope = calcSlope(now, distFt);

        updateGauges(distFt, slope);
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
                chart.data.datasets[0].data.push({ x: tVal, y: dVal });
                chart.update('none');
            }
        }
    } else {
        distBadge.innerText = "No marker";
        lastKnownPixelWidth = null;
        videoWrapper.classList.remove('slope-pos','slope-neg','slope-zero');
    }
    requestAnimationFrame(processVideo);
}

// ════════════════════════════════════════════════
// CALIBRATE
// ════════════════════════════════════════════════
calibrateBtn.onclick = function () {
    if (!lastKnownPixelWidth) { alert("Hold marker in front of camera first."); return; }
    focalLength = (lastKnownPixelWidth * parseFloat(calibrationDistanceInput.value)) / parseFloat(markerSizeInput.value);
    startTime = Date.now();
    calStatus.textContent = "✓ Calibrated at " + calibrationDistanceInput.value + " cm";
    calStatus.classList.add("ok");
    closePanel();
};

// ════════════════════════════════════════════════
// RECORDING
// ════════════════════════════════════════════════
function playChime(isGo) {
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator(), gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.frequency.value = isGo ? 880 : 440; osc.type = 'sine';
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
    data = []; recording = true;
    startTime = Date.now(); lastRecordTime = 0;
    smoothBuffer = []; slopeBuffer = [];
    statusDot.classList.add("recording");
    chart.options.scales.x.max = parseFloat(xAxisDurationInput.value) || 5;
    // Ghost previous run
    fadeOldDatasets();
    // Fresh motion dataset
    chart.data.datasets[0] = {
        label: 'Motion', data: [],
        borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.07)',
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff', fill: false, tension: 0.3,
        segment: { borderColor: seg => getSegmentColor(seg) }
    };
    chart.update();
}

function fadeOldDatasets() {
    const current = chart.data.datasets[0];
    if (current && current.data && current.data.length > 0) {
        const ghost = {
            label: 'Prev run', data: current.data.slice(),
            borderColor: 'rgba(0,229,255,0.2)', backgroundColor: 'transparent',
            borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3
        };
        chart.data.datasets.push(ghost);
    }
}

function stopRecording() {
    recording = false;
    statusDot.classList.remove("recording");
    statusDot.classList.add("active");
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
    recording = false; startBtn.disabled = false; data = [];
    // Reset to 3 core datasets only
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
tableBtn.onclick = () => { if (!data.length) { alert("No data yet!"); return; } buildTable(); tableModal.classList.add("visible"); };
closeTableBtn.onclick = () => tableModal.classList.remove("visible");

function buildTable() {
    const hasFn   = !!currentFn;
    const samples = sampleAtIntervals(data, 0.5);
    const reg     = data.length >= 3 ? linearRegression(data) : null;
    valTable.querySelector('thead').innerHTML = `<tr>
        <th>Time (s)</th><th>Distance (ft)</th>
        ${reg  ? '<th>Reg. y</th><th>Reg. Resid.</th>' : ''}
        ${hasFn ? '<th>f(x)</th><th>f(x) Resid.</th>' : ''}
    </tr>`;
    const tbody = valTable.querySelector('tbody');
    tbody.innerHTML = '';
    samples.forEach(({ x: t, y: d }) => {
        const regY = reg ? reg.m * t + reg.b : null;
        const fnY  = hasFn ? currentFn(t) : null;
        const regRes = regY !== null ? d - regY : null;
        const fnRes  = fnY  !== null ? d - fnY  : null;
        const cls = r => r === null ? '' : Math.abs(r) < 0.1 ? 'good' : Math.abs(r) < 0.3 ? 'ok' : 'miss';
        const fmt = v => v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(3)}` : '';
        tbody.innerHTML += `<tr>
            <td>${t.toFixed(2)}</td><td>${d.toFixed(3)}</td>
            ${reg  ? `<td>${regY.toFixed(3)}</td><td class="residual ${cls(regRes)}">${fmt(regRes)}</td>` : ''}
            ${hasFn ? `<td>${fnY.toFixed(3)}</td><td class="residual ${cls(fnRes)}">${fmt(fnRes)}</td>` : ''}
        </tr>`;
    });
    let scoreHTML = '';
    if (reg) scoreHTML += `<span style="color:var(--accent)">R²=${reg.r2.toFixed(4)}</span> &nbsp; <span style="color:var(--muted)">y=${reg.m.toFixed(3)}x${reg.b>=0?'+':''}${reg.b.toFixed(3)}</span>`;
    if (hasFn && data.length) {
        const rmse  = calcRmse(data, currentFn);
        const score = Math.max(0, Math.round(100 - rmse * 50));
        const emoji = score >= 90 ? '🏅' : score >= 70 ? '👍' : '📈';
        scoreHTML += `&nbsp; &nbsp; <span style="color:var(--warn)">RMSE=${rmse.toFixed(3)}ft</span> &nbsp; <span style="color:var(--success)">${emoji} Score: ${score}/100</span>`;
    }
    tableScore.innerHTML = scoreHTML;
}

// ════════════════════════════════════════════════
// ARUCO MARKER SCREEN — FIX #2: fills screen, sidebar controls, shows cm size
// ════════════════════════════════════════════════
const DICT_ORIG = [
    [0b10001,0b11011,0b01010,0b00001,0b01011],
    [0b11100,0b11011,0b01110,0b11100,0b10111],
    [0b01110,0b11011,0b10101,0b01110,0b00100],
    [0b10110,0b01011,0b11001,0b00110,0b01001],
    [0b01011,0b10110,0b00111,0b11010,0b11100],
    [0b11010,0b01101,0b10010,0b10001,0b00011],
    [0b00111,0b10100,0b11001,0b01110,0b11010],
    [0b10000,0b00111,0b01101,0b10110,0b01111],
    [0b01101,0b10010,0b00110,0b01101,0b10010],
    [0b11001,0b00110,0b10011,0b01100,0b11001],
    [0b00100,0b11011,0b00111,0b11000,0b10110],
    [0b10011,0b01100,0b11001,0b10011,0b01100],
    [0b01001,0b10110,0b01011,0b10100,0b11010],
    [0b11010,0b10101,0b01010,0b11010,0b00101],
    [0b00110,0b01101,0b10110,0b01011,0b10100],
    [0b10101,0b01010,0b10101,0b01010,0b10101],
    [0b11000,0b00111,0b10011,0b00110,0b11001],
    [0b01111,0b10000,0b01111,0b10000,0b01111],
    [0b10010,0b11001,0b00110,0b01011,0b00100],
    [0b00001,0b11110,0b10101,0b01110,0b10001],
    [0b11011,0b00100,0b10110,0b01001,0b11101],
    [0b01010,0b10101,0b01010,0b10101,0b01010],
    [0b10100,0b01011,0b10100,0b01011,0b10100],
    [0b00011,0b11100,0b01111,0b00001,0b11110],
    [0b11100,0b00011,0b10001,0b11110,0b00001],
    [0b01000,0b10111,0b00010,0b11101,0b01000],
    [0b10111,0b01000,0b11101,0b00010,0b10111],
    [0b00101,0b11010,0b01101,0b10010,0b00101],
    [0b11010,0b00101,0b10010,0b01101,0b11010],
    [0b01100,0b10011,0b01100,0b10011,0b01100],
    [0b10001,0b01110,0b10001,0b01110,0b10001],
    [0b01110,0b10001,0b01110,0b10001,0b01110],
    [0b11110,0b00001,0b11110,0b00001,0b11110],
    [0b00001,0b11110,0b00001,0b11110,0b00001],
    [0b10110,0b11001,0b01101,0b00110,0b10011],
    [0b01001,0b00110,0b10010,0b11001,0b01100],
    [0b11101,0b00010,0b01011,0b10100,0b11101],
    [0b00010,0b11101,0b10100,0b01011,0b00010],
    [0b10011,0b11100,0b00011,0b11100,0b10011],
    [0b01100,0b00011,0b11100,0b00011,0b01100],
    [0b10100,0b10100,0b10100,0b10100,0b10100],
    [0b01011,0b01011,0b01011,0b01011,0b01011],
    [0b11000,0b11000,0b11000,0b11000,0b11000],
    [0b00111,0b00111,0b00111,0b00111,0b00111],
    [0b10010,0b01001,0b10010,0b01001,0b10010],
    [0b01101,0b10110,0b01101,0b10110,0b01101],
    [0b11011,0b00100,0b11011,0b00100,0b11011],
    [0b00100,0b11011,0b00100,0b11011,0b00100],
    [0b10101,0b10101,0b10101,0b10101,0b10101],
    [0b01010,0b01010,0b01010,0b01010,0b01010],
];

function drawMarker(id) {
    const bits  = DICT_ORIG[id % DICT_ORIG.length];
    const cells = 7;
    // Use 88% of the smaller screen dimension
    const maxPx  = Math.floor(Math.min(window.innerWidth - 130, window.innerHeight) * 0.88);
    const cellPx = Math.floor(maxPx / cells);
    const size   = cells * cellPx;
    markerCanvas.width  = size;
    markerCanvas.height = size;
    const mc = markerCanvas.getContext("2d");
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, size, size);

    for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
            let black;
            if (row === 0 || row === 6 || col === 0 || col === 6) {
                black = true;
            } else {
                const dataRow = row - 1;
                const dataCol = col - 1;
                black = ((bits[dataRow] >> (4 - dataCol)) & 1) === 1;
            }
            mc.fillStyle = black ? '#000' : '#fff';
            mc.fillRect(col * cellPx, row * cellPx, cellPx, cellPx);
        }
    }

    markerIdLabel.textContent = `ID: ${id}`;
    markerSizePx.textContent  = `${size} × ${size} px`;
    // Estimate cm size: 96 DPI → 1px ≈ 0.02646 cm
    const estimatedCm = (size * 0.02646).toFixed(1);
    markerSizeCm.textContent  = `≈ ${estimatedCm} cm on screen`;
}

markerScreenBtn.onclick = () => { markerScreen.classList.add("visible"); drawMarker(0); };
markerBackBtn.onclick   = () => markerScreen.classList.remove("visible");
markerRandomBtn.onclick = () => drawMarker(Math.floor(Math.random() * DICT_ORIG.length));

// ════════════════════════════════════════════════
// SLOPE CHALLENGES
// ════════════════════════════════════════════════
const CHALLENGES = [
    { description: "Walk at a <span class='target'>constant</span> speed away — target: <span class='target'>+1.0 ft/sec</span>.", targetSlope:  1.0, tolerance: 0.25 },
    { description: "Hold <span class='target'>perfectly still</span> — target: <span class='target'>0.0 ft/sec</span>.", targetSlope: 0.0, tolerance: 0.10 },
    { description: "Walk <span class='target'>slowly toward</span> the camera — target: <span class='target'>−0.5 ft/sec</span>.", targetSlope: -0.5, tolerance: 0.20 },
    { description: "Walk <span class='target'>quickly away</span> — target: <span class='target'>+2.0 ft/sec</span>.", targetSlope:  2.0, tolerance: 0.40 },
    { description: "Walk <span class='target'>slowly away</span> — target: <span class='target'>+0.5 ft/sec</span>.", targetSlope:  0.5, tolerance: 0.15 },
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
        challengeScore.textContent = `🏅 Great! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'great';
    } else if (error <= currentChallenge.tolerance * 2) {
        challengeScore.textContent = `👍 Close! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'ok';
    } else {
        challengeScore.textContent = `Keep trying! Slope: ${sign}${reg.m.toFixed(2)} ft/s (target ${tgt>=0?'+':''}${tgt.toFixed(1)})`;
        challengeScore.className = 'miss';
    }
}
