// ============================================
//  WRISTVIEW - SANAL SAAT DENEME
//  Profesyonel Versiyon
// ============================================

(function () {
    "use strict";

    // ========================
    //  DOM ELEMANLARI
    // ========================
    var video       = document.getElementById("camera");
    var canvas      = document.getElementById("output");
    var ctx         = canvas.getContext("2d");
    var splashEl    = document.getElementById("splash-screen");
    var topBar      = document.getElementById("top-bar");
    var statusBar   = document.getElementById("status-bar");
    var statusText  = document.getElementById("status-text");
    var watchInfo   = document.getElementById("watch-info-card");
    var bottomPanel = document.getElementById("bottom-panel");
    var startBtn    = document.getElementById("start-btn");
    var errorEl     = document.getElementById("error-msg");
    var sizeUpBtn   = document.getElementById("size-up");
    var sizeDownBtn = document.getElementById("size-down");
    var sizeValue   = document.getElementById("size-value");
    var captureBtn  = document.getElementById("capture-btn");
    var cameraSwitchBtn = document.getElementById("camera-switch-btn");
    var captureToast = document.getElementById("capture-toast");

    // ========================
    //  DEĞİŞKENLER
    // ========================
    var watchScale    = 1.0;
    var watchImage    = new Image();
    var isRunning     = false;
    var handsInstance = null;
    var useSimpleMode = false;
    var touchX        = 0;
    var touchY        = 0;
    var currentFacing = "environment"; // ARKA KAMERA DEFAULT
    var currentStream = null;
    var handDetected  = false;

    // ========================
    //  LOG & HATA
    // ========================
    function setStatus(msg, type) {
        console.log("[WristView]", msg);
        if (statusText) {
            statusText.textContent = msg;
        }
        if (type === "detecting") {
            statusBar.className = "visible detecting";
        } else if (type === "waiting") {
            statusBar.className = "visible waiting";
        }
    }

    function showError(msg) {
        if (errorEl) {
            errorEl.innerHTML = msg;
            errorEl.classList.add("visible");
        }
    }

    function hideError() {
        if (errorEl) {
            errorEl.classList.remove("visible");
        }
    }

    // ========================
    //  UI GÖSTERİM
    // ========================
    function showMainUI() {
        splashEl.classList.add("hidden");
        topBar.classList.add("visible");
        statusBar.classList.add("visible");
        watchInfo.classList.add("visible");
        bottomPanel.classList.add("visible");
    }

    function showToast(msg) {
        captureToast.querySelector("span").textContent = msg;
        captureToast.classList.add("show");
        setTimeout(function () {
            captureToast.classList.remove("show");
        }, 2000);
    }

    function updateSizeLabel() {
        var percent = Math.round(watchScale * 100);
        sizeValue.textContent = percent + "%";
    }

    // ========================
    //  SVG SAAT GÖRSELİ
    // ========================
    function createWatchDataURL() {
        var svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">',

            // Kordon üst
            '<defs>',
            '<linearGradient id="strap" x1="0" y1="0" x2="1" y2="0">',
            '<stop offset="0%" stop-color="#5C2E00"/>',
            '<stop offset="30%" stop-color="#8B4513"/>',
            '<stop offset="70%" stop-color="#A0522D"/>',
            '<stop offset="100%" stop-color="#6B3410"/>',
            '</linearGradient>',
            '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">',
            '<stop offset="0%" stop-color="#FFE55C"/>',
            '<stop offset="50%" stop-color="#FFD700"/>',
            '<stop offset="100%" stop-color="#C5A028"/>',
            '</linearGradient>',
            '<radialGradient id="face" cx="50%" cy="50%" r="50%">',
            '<stop offset="0%" stop-color="#FFFFF5"/>',
            '<stop offset="90%" stop-color="#F5F0DC"/>',
            '<stop offset="100%" stop-color="#E8E0C8"/>',
            '</radialGradient>',
            '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">',
            '<feDropShadow dx="2" dy="3" stdDeviation="3" flood-opacity="0.3"/>',
            '</filter>',
            '</defs>',

            // Kordon üst
            '<rect x="62" y="0" width="76" height="105" rx="6" fill="url(#strap)" filter="url(#shadow)"/>',
            '<rect x="68" y="4" width="64" height="96" rx="4" fill="#8B4513" opacity="0.6"/>',
            '<line x1="75" y1="20" x2="125" y2="20" stroke="#5C2E00" stroke-width="0.5" opacity="0.5"/>',
            '<line x1="75" y1="35" x2="125" y2="35" stroke="#5C2E00" stroke-width="0.5" opacity="0.5"/>',
            '<line x1="75" y1="50" x2="125" y2="50" stroke="#5C2E00" stroke-width="0.5" opacity="0.5"/>',

            // Kasa
            '<circle cx="100" cy="150" r="62" fill="url(#gold)" filter="url(#shadow)"/>',
            '<circle cx="100" cy="150" r="58" fill="#B8860B"/>',
            '<circle cx="100" cy="150" r="55" fill="url(#gold)"/>',
            '<circle cx="100" cy="150" r="52" fill="url(#face)"/>',

            // Kadran işaretleri
            '<line x1="100" y1="100" x2="100" y2="106" stroke="#333" stroke-width="2"/>',
            '<line x1="100" y1="194" x2="100" y2="200" stroke="#333" stroke-width="2"/>',
            '<line x1="150" y1="150" x2="144" y2="150" stroke="#333" stroke-width="2"/>',
            '<line x1="50" y1="150" x2="56" y2="150" stroke="#333" stroke-width="2"/>',

            // Küçük işaretler
            '<line x1="125" y1="107" x2="121" y2="111" stroke="#666" stroke-width="1"/>',
            '<line x1="143" y1="125" x2="139" y2="129" stroke="#666" stroke-width="1"/>',
            '<line x1="143" y1="175" x2="139" y2="171" stroke="#666" stroke-width="1"/>',
            '<line x1="125" y1="193" x2="121" y2="189" stroke="#666" stroke-width="1"/>',
            '<line x1="75" y1="193" x2="79" y2="189" stroke="#666" stroke-width="1"/>',
            '<line x1="57" y1="175" x2="61" y2="171" stroke="#666" stroke-width="1"/>',
            '<line x1="57" y1="125" x2="61" y2="129" stroke="#666" stroke-width="1"/>',
            '<line x1="75" y1="107" x2="79" y2="111" stroke="#666" stroke-width="1"/>',

            // Rakamlar
            '<text x="100" y="115" text-anchor="middle" font-size="11" font-weight="bold" fill="#333" font-family="serif">12</text>',
            '<text x="139" y="154" text-anchor="middle" font-size="11" font-weight="bold" fill="#333" font-family="serif">3</text>',
            '<text x="100" y="193" text-anchor="middle" font-size="11" font-weight="bold" fill="#333" font-family="serif">6</text>',
            '<text x="61" y="154" text-anchor="middle" font-size="11" font-weight="bold" fill="#333" font-family="serif">9</text>',

            // Marka
            '<text x="100" y="132" text-anchor="middle" font-size="7" fill="#B8860B" font-family="serif" letter-spacing="2">LUXURY</text>',
            '<text x="100" y="140" text-anchor="middle" font-size="5" fill="#999" font-family="sans-serif">SWISS MADE</text>',

            // Akrep ve Yelkovan
            '<line x1="100" y1="150" x2="100" y2="115" stroke="#222" stroke-width="3" stroke-linecap="round"/>',
            '<line x1="100" y1="150" x2="128" y2="138" stroke="#222" stroke-width="2" stroke-linecap="round"/>',
            '<line x1="100" y1="150" x2="85" y2="120" stroke="#CC0000" stroke-width="0.8" stroke-linecap="round"/>',
            '<circle cx="100" cy="150" r="3" fill="#222"/>',
            '<circle cx="100" cy="150" r="1.5" fill="#FFD700"/>',

            // Alt kadran (saniye)
            '<circle cx="100" cy="170" r="10" fill="none" stroke="#ccc" stroke-width="0.5"/>',

            // Taç
            '<rect x="158" y="144" width="10" height="12" rx="2" fill="url(#gold)" stroke="#B8860B" stroke-width="0.5"/>',

            // Kordon alt
            '<rect x="62" y="195" width="76" height="105" rx="6" fill="url(#strap)" filter="url(#shadow)"/>',
            '<rect x="68" y="200" width="64" height="96" rx="4" fill="#8B4513" opacity="0.6"/>',

            // Kordon delikleri
            '<ellipse cx="100" cy="225" rx="4" ry="2.5" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="240" rx="4" ry="2.5" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="255" rx="4" ry="2.5" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="270" rx="4" ry="2.5" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="285" rx="4" ry="2.5" fill="#5C2E00"/>',

            // Toka
            '<rect x="70" y="208" width="60" height="4" rx="1" fill="#B8860B"/>',

            '</svg>'
        ].join("");

        return "data:image/svg+xml;base64," + btoa(svg);
    }

    // ========================
    //  KAMERA
    // ========================
    function startCamera(facing) {
        setStatus("Kamera açılıyor...", "waiting");

        // Önceki stream'i kapat
        if (currentStream) {
            currentStream.getTracks().forEach(function (track) {
                track.stop();
            });
        }

        var constraints = {
            video: {
                facingMode: facing || "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        return navigator.mediaDevices
            .getUserMedia(constraints)
            .then(function (stream) {
                currentStream = stream;
                video.srcObject = stream;

                return new Promise(function (resolve, reject) {
                    video.onloadedmetadata = function () {
                        video
                            .play()
                            .then(function () {
                                canvas.width = video.videoWidth;
                                canvas.height = video.videoHeight;
                                touchX = canvas.width / 2;
                                touchY = canvas.height / 2;
                                setStatus("Kamera hazır", "detecting");
                                resolve();
                            })
                            .catch(reject);
                    };

                    setTimeout(function () {
                        reject(new Error("Kamera zaman aşımı"));
                    }, 15000);
                });
            });
    }

    function switchCamera() {
        currentFacing = currentFacing === "environment" ? "user" : "environment";

        // Ayna efekti: ön kamerada ayna, arka kamerada normal
        if (currentFacing === "user") {
            video.style.transform = "scaleX(-1)";
            canvas.style.transform = "scaleX(-1)";
        } else {
            video.style.transform = "scaleX(1)";
            canvas.style.transform = "scaleX(1)";
        }

        isRunning = false;

        startCamera(currentFacing)
            .then(function () {
                isRunning = true;
                detectFrame();
            })
            .catch(function (err) {
                setStatus("Kamera değiştirilemedi", "waiting");
                console.error(err);
            });
    }

    // ========================
    //  MEDIAPIPE HANDS
    // ========================
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error("Yüklenemedi: " + src));
            };
            document.head.appendChild(script);
        });
    }

    function loadMediaPipe() {
        setStatus("El algılama yükleniyor...", "waiting");

        return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js")
            .then(function () {
                return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
            })
            .then(function () {
                return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
            })
            .then(function () {
                return initHands();
            });
    }

    function initHands() {
        setStatus("Model yükleniyor...", "waiting");

        /* global Hands */
        handsInstance = new Hands({
            locateFile: function (file) {
                return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file;
            }
        });

        handsInstance.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        handsInstance.onResults(onHandResults);

        return handsInstance.send({ image: video }).then(function () {
            setStatus("Hazır! Bileğinizi gösterin", "detecting");
        });
    }

    // ========================
    //  EL ALGILAMA SONUÇLARI
    // ========================
    function onHandResults(results) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            var landmarks = results.multiHandLandmarks[0];

            var wrist       = landmarks[0];
            var point5      = landmarks[5];
            var point17     = landmarks[17];
            var middleFinger = landmarks[9];

            var wristX = wrist.x * canvas.width;
            var wristY = wrist.y * canvas.height;

            var handWidth = Math.sqrt(
                Math.pow((point5.x - point17.x) * canvas.width, 2) +
                Math.pow((point5.y - point17.y) * canvas.height, 2)
            );

            var watchSize = handWidth * 1.5 * watchScale;

            var angle = Math.atan2(
                (middleFinger.y - wrist.y) * canvas.height,
                (middleFinger.x - wrist.x) * canvas.width
            );

            drawWatch(wristX, wristY, watchSize, angle);

            if (!handDetected) {
                handDetected = true;
                setStatus("Saat bileğinizde! 📸", "detecting");
            }
        } else {
            handDetected = false;
            setStatus("Bileğinizi kameraya gösterin", "waiting");
        }
    }

    // ========================
    //  SAAT ÇİZİMİ
    // ========================
    function drawWatch(x, y, size, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle - Math.PI / 2);

        // Gölge
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;

        var w = size;
        var h = size * 1.5;

        ctx.drawImage(watchImage, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // ========================
    //  FRAME DÖNGÜSÜ
    // ========================
    function detectFrame() {
        if (!isRunning) return;

        if (useSimpleMode) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawWatch(touchX, touchY, 120 * watchScale, 0);
            requestAnimationFrame(detectFrame);
        } else {
            handsInstance
                .send({ image: video })
                .then(function () {
                    requestAnimationFrame(detectFrame);
                })
                .catch(function () {
                    requestAnimationFrame(detectFrame);
                });
        }
    }

    // ========================
    //  BASİT MOD
    // ========================
    function setupSimpleMode() {
        useSimpleMode = true;
        setStatus("Dokunarak saati taşıyın", "detecting");

        canvas.addEventListener("touchstart", function (e) {
            e.preventDefault();
            updateTouch(e);
        }, { passive: false });

        canvas.addEventListener("touchmove", function (e) {
            e.preventDefault();
            updateTouch(e);
        }, { passive: false });

        canvas.addEventListener("mousedown", function (e) {
            updateMouse(e);
        });

        canvas.addEventListener("mousemove", function (e) {
            if (e.buttons === 1) updateMouse(e);
        });
    }

    function updateTouch(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;

        if (currentFacing === "user") {
            touchX = (rect.width - (e.touches[0].clientX - rect.left)) * scaleX;
        } else {
            touchX = (e.touches[0].clientX - rect.left) * scaleX;
        }
        touchY = (e.touches[0].clientY - rect.top) * scaleY;
    }

    function updateMouse(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;

        if (currentFacing === "user") {
            touchX = (rect.width - (e.clientX - rect.left)) * scaleX;
        } else {
            touchX = (e.clientX - rect.left) * scaleX;
        }
        touchY = (e.clientY - rect.top) * scaleY;
    }

    // ========================
    //  FOTOĞRAF ÇEK
    // ========================
    function capturePhoto() {
        var c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = canvas.height;
        var cCtx = c.getContext("2d");

        if (currentFacing === "user") {
            cCtx.save();
            cCtx.scale(-1, 1);
            cCtx.drawImage(video, -c.width, 0, c.width, c.height);
            cCtx.restore();

            cCtx.save();
            cCtx.scale(-1, 1);
            cCtx.drawImage(canvas, -c.width, 0, c.width, c.height);
            cCtx.restore();
        } else {
            cCtx.drawImage(video, 0, 0, c.width, c.height);
            cCtx.drawImage(canvas, 0, 0, c.width, c.height);
        }

        // Watermark
        cCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
        cCtx.font = "bold 14px Inter, sans-serif";
        cCtx.fillText("WristView ⌚", 12, c.height - 16);

        var link = document.createElement("a");
        link.download = "wristview-" + Date.now() + ".png";
        link.href = c.toDataURL("image/png", 0.92);
        link.click();

        showToast("✅ Fotoğraf kaydedildi!");
    }

    // ========================
    //  ANA BAŞLATMA
    // ========================
    function startApp() {
        hideError();
        startBtn.classList.add("loading");
        startBtn.querySelector(".btn-text").textContent = "Yükleniyor";
        startBtn.querySelector(".btn-arrow").textContent = "";
        startBtn.disabled = true;

        // Saat görseli
        watchImage.src = createWatchDataURL();

        watchImage.onload = function () {

            // Arka kamera default - transform yok
            video.style.transform = "scaleX(1)";
            canvas.style.transform = "scaleX(1)";

            startCamera(currentFacing)
                .then(function () {
                    return loadMediaPipe();
                })
                .then(function () {
                    // AR mod
                    showMainUI();
                    isRunning = true;
                    detectFrame();
                })
                .catch(function (err) {
                    console.error("Hata:", err);

                    if (video.srcObject) {
                        // Kamera var, MediaPipe yok → basit mod
                        setupSimpleMode();
                        showMainUI();
                        isRunning = true;
                        detectFrame();
                    } else {
                        showError(
                            "<strong>Hata:</strong> " + err.message + "<br><br>" +
                            "<strong>Çözüm Önerileri:</strong><br>" +
                            "• Kamera iznini kontrol edin<br>" +
                            "• Sayfayı yenileyip tekrar deneyin<br>" +
                            "• Başka bir tarayıcı deneyin"
                        );
                        startBtn.classList.remove("loading");
                        startBtn.querySelector(".btn-text").textContent = "Tekrar Dene";
                        startBtn.querySelector(".btn-arrow").textContent = "↻";
                        startBtn.disabled = false;
                    }
                });
        };

        watchImage.onerror = function () {
            showError("Saat görseli yüklenemedi. Sayfayı yenileyin.");
            startBtn.classList.remove("loading");
            startBtn.disabled = false;
        };
    }

    // ========================
    //  EVENT LISTENER'LAR
    // ========================
    startBtn.addEventListener("click", startApp);

    sizeUpBtn.addEventListener("click", function () {
        watchScale = Math.min(watchScale + 0.1, 2.5);
        updateSizeLabel();
    });

    sizeDownBtn.addEventListener("click", function () {
        watchScale = Math.max(watchScale - 0.1, 0.3);
        updateSizeLabel();
    });

    captureBtn.addEventListener("click", capturePhoto);

    cameraSwitchBtn.addEventListener("click", switchCamera);

    // ========================
    //  PROTOKOL KONTROLÜ
    // ========================
    var isSecure =
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

    if (!isSecure) {
        showError(
            "⚠️ <strong>HTTPS gerekli!</strong><br>" +
            "Kamera erişimi için HTTPS zorunludur."
        );
        startBtn.disabled = true;
    }

})();