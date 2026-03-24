// ============================================
//  SANAL SAAT DENEME - APP.JS
// ============================================

(function () {
    "use strict";

    // --- DOM Elemanları ---
    var video = document.getElementById("camera");
    var canvas = document.getElementById("output");
    var ctx = canvas.getContext("2d");
    var debugEl = document.getElementById("debug");
    var errorEl = document.getElementById("error-msg");
    var loadingEl = document.getElementById("loading");
    var controlsEl = document.getElementById("controls");
    var startBtn = document.getElementById("start-btn");
    var sizeUpBtn = document.getElementById("size-up");
    var sizeDownBtn = document.getElementById("size-down");
    var captureBtn = document.getElementById("capture-btn");

    // --- Değişkenler ---
    var watchScale = 1.0;
    var watchImage = new Image();
    var isRunning = false;
    var handsInstance = null;
    var useSimpleMode = false;
    var touchX = 0;
    var touchY = 0;

    // ============================================
    //  YARDIMCI FONKSİYONLAR
    // ============================================

    function log(msg) {
        console.log("[WatchApp]", msg);
        if (debugEl) {
            debugEl.textContent = msg;
        }
    }

    function showError(msg) {
        if (errorEl) {
            errorEl.innerHTML = msg;
        }
    }

    // ============================================
    //  SVG SAAT GÖRSELİ OLUŞTUR
    // ============================================

    function createWatchDataURL() {
        var svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">',
            '<rect x="65" y="0" width="70" height="100" rx="5" fill="#8B4513" stroke="#5C2E00" stroke-width="2"/>',
            '<rect x="70" y="5" width="60" height="90" rx="3" fill="#A0522D"/>',
            '<circle cx="100" cy="150" r="60" fill="#FFD700" stroke="#B8860B" stroke-width="4"/>',
            '<circle cx="100" cy="150" r="52" fill="#FFFEF0" stroke="#DAA520" stroke-width="2"/>',
            '<text x="100" y="112" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">12</text>',
            '<text x="140" y="154" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">3</text>',
            '<text x="100" y="196" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">6</text>',
            '<text x="60" y="154" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">9</text>',
            '<line x1="100" y1="150" x2="100" y2="118" stroke="#333" stroke-width="3" stroke-linecap="round"/>',
            '<line x1="100" y1="150" x2="125" y2="140" stroke="#333" stroke-width="2" stroke-linecap="round"/>',
            '<line x1="100" y1="150" x2="90" y2="125" stroke="#FF0000" stroke-width="1" stroke-linecap="round"/>',
            '<circle cx="100" cy="150" r="3" fill="#333"/>',
            '<text x="100" y="135" text-anchor="middle" font-size="8" fill="#B8860B" font-style="italic">LUXURY</text>',
            '<rect x="156" y="145" width="12" height="10" rx="2" fill="#FFD700" stroke="#B8860B" stroke-width="1"/>',
            '<rect x="65" y="200" width="70" height="100" rx="5" fill="#8B4513" stroke="#5C2E00" stroke-width="2"/>',
            '<rect x="70" y="205" width="60" height="90" rx="3" fill="#A0522D"/>',
            '<ellipse cx="100" cy="230" rx="4" ry="3" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="245" rx="4" ry="3" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="260" rx="4" ry="3" fill="#5C2E00"/>',
            '<ellipse cx="100" cy="275" rx="4" ry="3" fill="#5C2E00"/>',
            '</svg>'
        ].join("");

        return "data:image/svg+xml;base64," + btoa(svg);
    }

    // ============================================
    //  KAMERA BAŞLAT
    // ============================================

    function startCamera() {
        log("2/3 Kamera açılıyor...");

        return navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            })
            .then(function (stream) {
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
                                log("✅ Kamera açıldı! (" + video.videoWidth + "x" + video.videoHeight + ")");
                                resolve();
                            })
                            .catch(reject);
                    };

                    setTimeout(function () {
                        reject(new Error("Video zaman aşımı"));
                    }, 15000);
                });
            });
    }

    // ============================================
    //  MEDIAPIPE HANDS YÜKLE
    // ============================================

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error("Script yüklenemedi: " + src));
            };
            document.head.appendChild(script);
        });
    }

    function loadMediaPipe() {
        log("3/3 El algılama yükleniyor...");

        return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js")
            .then(function () {
                log("📦 hands.js yüklendi");
                return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
            })
            .then(function () {
                log("📦 camera_utils.js yüklendi");
                return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
            })
            .then(function () {
                log("📦 drawing_utils.js yüklendi");
                return initHands();
            });
    }

    function initHands() {
        log("🤖 El algılama modeli başlatılıyor...");

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

        // İlk frame gönder (modeli yüklemesi için)
        return handsInstance.send({ image: video }).then(function () {
            log("✅ El algılama hazır!");
        });
    }

    // ============================================
    //  EL ALGILAMA SONUÇLARI
    // ============================================

    function onHandResults(results) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (
            results.multiHandLandmarks &&
            results.multiHandLandmarks.length > 0
        ) {
            var landmarks = results.multiHandLandmarks[0];

            var wrist = landmarks[0];
            var point5 = landmarks[5];
            var point17 = landmarks[17];
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
            log("✅ El algılandı! ✋ Saati bileğinde gör");
        } else {
            log("👀 Elini kameraya göster...");
        }
    }

    // ============================================
    //  SAAT ÇİZİMİ
    // ============================================

    function drawWatch(x, y, size, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle - Math.PI / 2);

        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        var w = size;
        var h = size * 1.5;

        ctx.drawImage(watchImage, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // ============================================
    //  FRAME DÖNGÜSÜ
    // ============================================

    function detectFrame() {
        if (!isRunning) return;

        if (useSimpleMode) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawWatch(touchX, touchY, 100 * watchScale, 0);
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

    // ============================================
    //  BASİT MOD (Dokunmatik)
    // ============================================

    function setupSimpleMode() {
        useSimpleMode = true;
        log("📍 Basit mod: Ekrana dokunarak saati taşı");

        canvas.addEventListener("touchstart", function (e) {
            e.preventDefault();
            updateTouchPosition(e);
        }, { passive: false });

        canvas.addEventListener("touchmove", function (e) {
            e.preventDefault();
            updateTouchPosition(e);
        }, { passive: false });

        canvas.addEventListener("mousedown", function (e) {
            updateMousePosition(e);
        });

        canvas.addEventListener("mousemove", function (e) {
            if (e.buttons === 1) {
                updateMousePosition(e);
            }
        });
    }

    function updateTouchPosition(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        touchX = (rect.width - (e.touches[0].clientX - rect.left)) * scaleX;
        touchY = (e.touches[0].clientY - rect.top) * scaleY;
    }

    function updateMousePosition(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        touchX = (rect.width - (e.clientX - rect.left)) * scaleX;
        touchY = (e.clientY - rect.top) * scaleY;
    }

    // ============================================
    //  FOTOĞRAF ÇEK
    // ============================================

    function capturePhoto() {
        var captureCanvas = document.createElement("canvas");
        captureCanvas.width = canvas.width;
        captureCanvas.height = canvas.height;
        var captureCtx = captureCanvas.getContext("2d");

        // Video (ayna)
        captureCtx.save();
        captureCtx.scale(-1, 1);
        captureCtx.drawImage(video, -captureCanvas.width, 0, captureCanvas.width, captureCanvas.height);
        captureCtx.restore();

        // Saat overlay (ayna)
        captureCtx.save();
        captureCtx.scale(-1, 1);
        captureCtx.drawImage(canvas, -captureCanvas.width, 0, captureCanvas.width, captureCanvas.height);
        captureCtx.restore();

        // Watermark
        captureCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
        captureCtx.font = "16px Arial";
        captureCtx.fillText("⌚ Sanal Saat Deneme", 10, 30);

        // İndir
        var link = document.createElement("a");
        link.download = "saat-deneme.png";
        link.href = captureCanvas.toDataURL("image/png");
        link.click();

        captureBtn.textContent = "✅ Kaydedildi!";
        setTimeout(function () {
            captureBtn.textContent = "📸 Fotoğraf Çek";
        }, 2000);
    }

    // ============================================
    //  ANA BAŞLATMA
    // ============================================

    function startApp() {
        log("⏳ Başlatılıyor...");
        startBtn.textContent = "⏳ Yükleniyor...";
        startBtn.disabled = true;
        showError("");

        // 1) Saat görselini yükle
        log("1/3 Saat görseli yükleniyor...");
        watchImage.src = createWatchDataURL();

        watchImage.onload = function () {
            log("✅ Saat görseli hazır");

            // 2) Kamerayı başlat
            startCamera()
                .then(function () {
                    // 3) MediaPipe yükle
                    return loadMediaPipe();
                })
                .then(function () {
                    // Her şey hazır - AR modda başla
                    loadingEl.classList.add("hidden");
                    controlsEl.classList.add("visible");
                    isRunning = true;
                    log("✅ Hazır! Elini kameraya göster ✋");
                    detectFrame();
                })
                .catch(function (err) {
                    console.error("Hata:", err);

                    // Kamera açıldı mı kontrol et
                    if (video.srcObject) {
                        // Kamera var ama MediaPipe yüklenemedi -> basit mod
                        log("⚠️ El algılama yüklenemedi. Basit mod aktif.");
                        setupSimpleMode();
                        loadingEl.classList.add("hidden");
                        controlsEl.classList.add("visible");
                        isRunning = true;
                        detectFrame();
                    } else {
                        // Kamera da açılamadı
                        log("❌ Hata oluştu!");
                        showError(
                            "<strong>Hata:</strong> " + err.message + "<br><br>" +
                            "<strong>Çözüm:</strong><br>" +
                            "• Tarayıcıda kamera iznini kontrol edin<br>" +
                            "• HTTPS kullandığınızdan emin olun<br>" +
                            "• Başka uygulamanın kamerayı kullanmadığından emin olun<br>" +
                            "• Sayfayı yenileyip tekrar deneyin"
                        );
                        startBtn.textContent = "🔄 Tekrar Dene";
                        startBtn.disabled = false;
                    }
                });
        };

        watchImage.onerror = function () {
            log("❌ Saat görseli yüklenemedi");
            startBtn.textContent = "🔄 Tekrar Dene";
            startBtn.disabled = false;
        };
    }

    // ============================================
    //  EVENT LISTENER'LAR
    // ============================================

    startBtn.addEventListener("click", function () {
        startApp();
    });

    sizeUpBtn.addEventListener("click", function () {
        watchScale = Math.min(watchScale + 0.15, 2.5);
    });

    sizeDownBtn.addEventListener("click", function () {
        watchScale = Math.max(watchScale - 0.15, 0.3);
    });

    captureBtn.addEventListener("click", function () {
        capturePhoto();
    });

    // ============================================
    //  SAYFA YÜKLEME KONTROLÜ
    // ============================================

    var isSecure =
        location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

    if (!isSecure) {
        showError(
            "⚠️ <strong>HTTPS gerekli!</strong><br><br>" +
            "Kamera erişimi için site HTTPS üzerinde olmalı.<br>" +
            "GitHub Pages veya Netlify kullanın."
        );
        startBtn.disabled = true;
    }

    log("📋 Sayfa yüklendi. BAŞLAT butonuna bas.");

})();