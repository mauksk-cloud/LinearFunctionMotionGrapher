// ── Elements ──
let maxTimeInput             = document.getElementById("maxTime");
let video                    = document.getElementById("video");
let overlay                  = document.getElementById("overlay");
let ctx                      = overlay.getContext("2d", { willReadFrequently: true });
let distanceDisplay          = document.getElementById("distanceDisplay");
let markerSizeInput          = document.getElementById("markerSize");
let calibrationDistanceInput = document.getElementById("calibrationDistance");
let smoothSlider             = document.getElementById("smoothSlider");
let smoothVal                = document.getElementById("smoothVal");
let calibrateBtn             = document.getElementById("calibrateBtn");
let startBtn                 = document.getElementById("startBtn");
let stopBtn                  = document.getElementById("stopBtn");
let clearBtn                 = document.getElementById("clearBtn");
let exportBtn                = document.getElementById("exportBtn");
let cameraBtn                = document.getElementById("cameraBtn");
let autoScaleToggle          = document.getElementById("autoScaleToggle");
let speedometerToggle        = document.getElementById("speedometerToggle");
let signOfSlopeToggle        = document.getElementById("signOfSlopeToggle");
let statusDot                = document.getElementById("statusDot");
let calStatus                = document.getElementById("calStatus");
let cameraPlaceholder        = document.getElementById("cameraPlaceholder");
let videoWrapper             = document.getElementById("videoWrapper");
let speedometerBanner        = document.getElementById("speedometerBanner");
let slopeValue               = document.getElementById("slopeValue");
let slopeArrow               = document.getElementById("slopeArrow");
let slopeDirection           = document.getElementById("slopeDirection");
let newChallengeBtn          = document.getElementById("newChallengeBtn");
let judgeChallengeBtn        = document.getElementById("judgeChallengeBtn");
let challengeText            = document.getElementById("challengeText");
let challengeScore           = document.getElementById("challengeScore");

// ── State ──
let focalLength         = null;
let lastKnownPixelWidth = null;
let recording           = false;
let data                = [];
let startTime           = null;
let smoothBuffer        = [];
let lastRecordTime      = 0;
let detector            = null;
let currentSlope        = 0;
let slopeBuffer         = [];        // rolling window for slope calculation
let currentChallenge    = null;

// ── Smooth slider live label ──
smoothSlider.addEventListener("input", () => {
    smoothVal.textContent = smoothSlider.value;
});

// ── Chart ──
let chart = new Chart(document.getElementById("chart"), {
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
                // Sign-of-slope coloring: recolored per-segment when toggle is on
                borderColor: ctx2 => getSegmentColor(ctx2)
            }
        }]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#7986cb', font: { family: 'Space Mono', size: 11 } }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: "Time (s)", color: '#7986cb' },
                ticks: {
                    color: '#7986cb',
                    font: { family: 'Space Mono', size: 10 },
                    stepSize: 0.5,          // tick every 0.5 seconds
                    callback: val => Number.isInteger(val * 2) ? val.toFixed(1) : null
                },
                grid: { color: '#2e3356' },
                min: 0
            },
            y: {
                title: { display: true, text: "Distance (ft)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 } },
                grid: { color: '#2e3356' },
                min: 0,
                max: 10
            }
        }
    }
});

// Per-segment color based on slope sign (used when Sign of Slope toggle is on)
function getSegmentColor(ctx2) {
    if (!signOfSlopeToggle.checked) return '#00e5ff';
    let d = ctx2.p1.parsed.y - ctx2.p0.parsed.y;
    if (Math.abs(d) < 0.015) return '#ffd740';   // zero / flat → yellow
    return d > 0 ? '#ff4081' : '#69f0ae';          // moving away = positive slope = red; closer = green
}

// ── Y-axis scale toggle ──
autoScaleToggle.addEventListener("change", () => {
    chart.options.scales.y.min = autoScaleToggle.checked ? undefined : 0;
    chart.options.scales.y.max = autoScaleToggle.checked ? undefined : 10;
    chart.update();
});

// ── Speedometer toggle ──
speedometerToggle.addEventListener("change", () => {
    speedometerBanner.style.display = speedometerToggle.checked ? 'block' : 'none';
});

// ── Sign of Slope toggle — force chart redraw ──
signOfSlopeToggle.addEventListener("change", () => {
    chart.update();
});

// ── Camera ──
cameraBtn.onclick = function () {
    if (typeof AR === "undefined" || typeof AR.Detector === "undefined") {
        alert("ArUco library failed to load. Check your connection and refresh.");
        return;
    }
    if (!detector) detector = new AR.Detector();

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.style.display = "block";
            cameraPlaceholder.style.display = "none";
            video.onloadedmetadata = () => {
                video.play();
                statusDot.classList.add("active");
                requestAnimationFrame(processVideo);
            };
            cameraBtn.disabled = true;
            cameraBtn.textContent = "Camera On";
        })
        .catch(err => {
            alert("Camera access denied or unavailable: " + err.message);
            console.error(err);
        });
};

// ── Distance smoothing ──
function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > parseInt(smoothSlider.value))
        smoothBuffer.shift();
    return smoothBuffer.reduce((a, b) => a + b) / smoothBuffer.length;
}

// ── Slope calculation (rolling window over last ~0.5s of data) ──
function updateSlope(t, distFt) {
    slopeBuffer.push({ t, d: distFt });
    // Keep only the last 0.5 seconds worth of points
    slopeBuffer = slopeBuffer.filter(p => t - p.t <= 0.5);
    if (slopeBuffer.length < 2) return 0;
    let oldest = slopeBuffer[0];
    let newest = slopeBuffer[slopeBuffer.length - 1];
    let dt = newest.t - oldest.t;
    if (dt < 0.05) return currentSlope;   // avoid division by near-zero
    return (newest.d - oldest.d) / dt;
}

// ── Update speedometer banner ──
function updateSpeedometer(slope) {
    currentSlope = slope;
    let absSlope = Math.abs(slope);
    slopeValue.textContent = (slope >= 0 ? '+' : '') + slope.toFixed(3);

    speedometerBanner.classList.remove('pos', 'neg', 'zero');
    videoWrapper.classList.remove('slope-pos', 'slope-neg', 'slope-zero');

    if (absSlope < 0.05) {
        speedometerBanner.classList.add('zero');
        if (signOfSlopeToggle.checked) videoWrapper.classList.add('slope-zero');
        slopeDirection.textContent = 'constant';
        slopeArrow.textContent = '→';
    } else if (slope > 0) {
        speedometerBanner.classList.add('pos');
        if (signOfSlopeToggle.checked) videoWrapper.classList.add('slope-pos');
        slopeDirection.textContent = 'moving away';
        slopeArrow.textContent = '↗';
    } else {
        speedometerBanner.classList.add('neg');
        if (signOfSlopeToggle.checked) videoWrapper.classList.add('slope-neg');
        slopeDirection.textContent = 'moving closer';
        slopeArrow.textContent = '↘';
    }
}

// ── Process video frame ──
function processVideo() {
    if (!video.videoWidth) { requestAnimationFrame(processVideo); return; }

    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    let imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
    let markers   = detector.detect(imageData);
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (markers.length > 0) {
        let corners = markers[0].corners;

        // Draw outline
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth   = 3;
        ctx.beginPath();
        corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.stroke();

        // Corner dots
        ctx.fillStyle = "#ff4081";
        corners.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        let widthPixels = Math.hypot(
            corners[0].x - corners[1].x,
            corners[0].y - corners[1].y
        );
        lastKnownPixelWidth = widthPixels;

        if (focalLength) {
            let distanceCm = (parseFloat(markerSizeInput.value) * focalLength) / widthPixels;
            distanceCm     = smooth(distanceCm);
            let distanceFt = distanceCm / 30.48;

            distanceDisplay.innerText = "Distance: " + distanceFt.toFixed(3) + " ft";

            // Always compute slope for speedometer/sign-of-slope
            let now = (Date.now() - (startTime || Date.now())) / 1000;
            let slope = updateSlope(now, distanceFt);
            updateSpeedometer(slope);

            if (recording) {
                let t = (Date.now() - startTime) / 1000;
                if (t >= parseFloat(maxTimeInput.value)) {
                    recording = false;
                    statusDot.classList.remove("recording");
                    statusDot.classList.add("active");
                    alert("Recording complete!");
                } else if (t - lastRecordTime >= 0.05) {
                    lastRecordTime = t;
                    let tVal = parseFloat(t.toFixed(2));
                    let dVal = parseFloat(distanceFt.toFixed(3));
                    chart.data.labels.push(tVal);
                    chart.data.datasets[0].data.push(dVal);
                    chart.update();
                    data.push([tVal, dVal]);
                }
            }
        } else {
            distanceDisplay.innerText = "Not calibrated";
        }

    } else {
        distanceDisplay.innerText = "Marker not detected";
        lastKnownPixelWidth = null;
        // Remove sign-of-slope coloring when marker lost
        videoWrapper.classList.remove('slope-pos', 'slope-neg', 'slope-zero');
    }

    requestAnimationFrame(processVideo);
}

// ── Calibrate ──
calibrateBtn.onclick = function () {
    if (!lastKnownPixelWidth) {
        alert("Hold the marker in front of the camera first, then click Calibrate.");
        return;
    }
    let knownDistance = parseFloat(calibrationDistanceInput.value);
    let markerSize    = parseFloat(markerSizeInput.value);
    focalLength       = (lastKnownPixelWidth * knownDistance) / markerSize;
    startTime         = Date.now();   // seed so slope calc works before recording
    calStatus.textContent = "✓ Calibrated at " + knownDistance + " cm";
    calStatus.classList.add("ok");
};

// ── Start recording ──
startBtn.onclick = function () {
    if (!focalLength) { alert("Please calibrate first."); return; }
    recording      = true;
    startTime      = Date.now();
    lastRecordTime = 0;
    smoothBuffer   = [];
    slopeBuffer    = [];
    statusDot.classList.add("recording");
};

// ── Stop ──
stopBtn.onclick = function () {
    recording = false;
    smoothBuffer = []; lastRecordTime = 0; slopeBuffer = [];
    statusDot.classList.remove("recording");
    if (focalLength) statusDot.classList.add("active");
    evaluateChallenge();   // auto-judge after stopping
};

// ── Clear ──
clearBtn.onclick = function () {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
    data = []; smoothBuffer = []; lastRecordTime = 0;
    slopeBuffer = []; recording = false;
    statusDot.classList.remove("recording");
    challengeScore.textContent = '';
    challengeScore.className   = '';
};

// ── Export ──
exportBtn.onclick = function () {
    if (data.length === 0) { alert("No data to export yet!"); return; }
    let csv = "time_seconds,distance_ft\n";
    data.forEach(row => { csv += row[0] + "," + row[1] + "\n"; });
    let blob = new Blob([csv], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "motion_data.csv";
    link.click();
};

// ══════════════════════════════════════════
// ── SLOPE CHALLENGES ──
// ══════════════════════════════════════════

const CHALLENGES = [
    {
        description: "Walk at a <span class='target'>constant</span> speed away from the camera — aim for a slope of <span class='target'>+1.0 ft/sec</span>.",
        targetSlope: 1.0, tolerance: 0.25, duration: 5
    },
    {
        description: "Hold <span class='target'>perfectly still</span> — aim for a slope of <span class='target'>0.0 ft/sec</span>.",
        targetSlope: 0.0, tolerance: 0.1, duration: 5
    },
    {
        description: "Walk <span class='target'>slowly toward</span> the camera — aim for a slope of <span class='target'>−0.5 ft/sec</span>.",
        targetSlope: -0.5, tolerance: 0.2, duration: 5
    },
    {
        description: "Walk <span class='target'>quickly away</span> from the camera — aim for a slope of <span class='target'>+2.0 ft/sec</span>.",
        targetSlope: 2.0, tolerance: 0.4, duration: 5
    },
    {
        description: "Walk <span class='target'>slowly away</span> from the camera — aim for a slope of <span class='target'>+0.5 ft/sec</span>.",
        targetSlope: 0.5, tolerance: 0.15, duration: 5
    },
    {
        description: "Move <span class='target'>quickly toward</span> the camera — aim for a slope of <span class='target'>−1.5 ft/sec</span>.",
        targetSlope: -1.5, tolerance: 0.4, duration: 5
    }
];

newChallengeBtn.onclick = function () {
    let idx = Math.floor(Math.random() * CHALLENGES.length);
    currentChallenge = CHALLENGES[idx];
    challengeText.innerHTML = currentChallenge.description +
        `<br><br><em style="color:var(--muted);font-size:0.7rem">Record for ~${currentChallenge.duration}s then press Stop or Judge My Run.</em>`;
    challengeScore.textContent = '';
    challengeScore.className   = '';
};

judgeChallengeBtn.onclick = evaluateChallenge;

function evaluateChallenge() {
    if (!currentChallenge || data.length < 4) return;

    // Compute average slope over the whole recorded run using linear regression
    let n  = data.length;
    let sumT = 0, sumD = 0, sumTD = 0, sumT2 = 0;
    data.forEach(([t, d]) => { sumT += t; sumD += d; sumTD += t * d; sumT2 += t * t; });
    let avgSlope = (n * sumTD - sumT * sumD) / (n * sumT2 - sumT * sumT);

    let target    = currentChallenge.targetSlope;
    let tolerance = currentChallenge.tolerance;
    let error     = Math.abs(avgSlope - target);
    let sign      = avgSlope >= 0 ? '+' : '';

    if (error <= tolerance) {
        challengeScore.textContent = `🏅 Great! Your avg slope: ${sign}${avgSlope.toFixed(2)} ft/sec (target: ${target >= 0 ? '+' : ''}${target.toFixed(1)})`;
        challengeScore.className   = 'great';
    } else if (error <= tolerance * 2) {
        challengeScore.textContent = `👍 Close! Your avg slope: ${sign}${avgSlope.toFixed(2)} ft/sec (target: ${target >= 0 ? '+' : ''}${target.toFixed(1)})`;
        challengeScore.className   = 'ok';
    } else {
        challengeScore.textContent = `Keep trying! Your avg slope: ${sign}${avgSlope.toFixed(2)} ft/sec (target: ${target >= 0 ? '+' : ''}${target.toFixed(1)})`;
        challengeScore.className   = 'miss';
    }
}
