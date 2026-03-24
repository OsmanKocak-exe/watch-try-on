// ============================================
//  WRISTVIEW - 3D SAAT DENEME
//  Three.js Offscreen WebGL Renderer
// ============================================

(function () {
    "use strict";

    // ========================
    //  DOM ELEMANLARI
    // ========================
    var video            = document.getElementById("camera");
    var canvas           = document.getElementById("output");
    var ctx              = canvas.getContext("2d");
    var splashEl         = document.getElementById("splash-screen");
    var topBar           = document.getElementById("top-bar");
    var statusBar        = document.getElementById("status-bar");
    var statusText       = document.getElementById("status-text");
    var watchInfo        = document.getElementById("watch-info-card");
    var bottomPanel      = document.getElementById("bottom-panel");
    var startBtn         = document.getElementById("start-btn");
    var errorEl          = document.getElementById("error-msg");
    var sizeUpBtn        = document.getElementById("size-up");
    var sizeDownBtn      = document.getElementById("size-down");
    var sizeValue        = document.getElementById("size-value");
    var captureBtn       = document.getElementById("capture-btn");
    var cameraSwitchBtn  = document.getElementById("camera-switch-btn");
    var captureToast     = document.getElementById("capture-toast");

    // ========================
    //  DURUM DEĞİŞKENLERİ
    // ========================
    var watchScale    = 1.0;
    var isRunning     = false;
    var handsInstance = null;
    var useSimpleMode = false;
    var touchX        = 0;
    var touchY        = 0;
    var currentFacing = "environment";
    var currentStream = null;
    var handDetected  = false;

    // ========================
    //  THREE.JS DEĞİŞKENLERİ
    // ========================
    var threeRenderer  = null;
    var threeScene     = null;
    var threeCamera    = null;
    var watchGroup     = null;
    var clockHands     = {};
    var threeReady     = false;
    var OFFSCREEN_SIZE = 512; // Offscreen WebGL canvas boyutu

    // ========================
    //  LOG & HATA
    // ========================
    function setStatus(msg, type) {
        console.log("[WristView]", msg);
        if (statusText) statusText.textContent = msg;
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
        if (errorEl) errorEl.classList.remove("visible");
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
        setTimeout(function () { captureToast.classList.remove("show"); }, 2000);
    }

    function updateSizeLabel() {
        sizeValue.textContent = Math.round(watchScale * 100) + "%";
    }

    // ========================
    //  THREE.JS 3D SAAT KURULUMU
    // ========================
    function loadThreeJS() {
        return new Promise(function (resolve, reject) {
            if (typeof THREE !== "undefined") { resolve(); return; }

            var script = document.createElement("script");
            // Three.js r128 — CDN
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
            script.onload  = resolve;
            script.onerror = function () { reject(new Error("Three.js yüklenemedi")); };
            document.head.appendChild(script);
        });
    }

    function initThreeJS() {
        /* global THREE */

        // --- Offscreen renderer ---
        threeRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,        // şeffaf arka plan
            preserveDrawingBuffer: true
        });
        threeRenderer.setSize(OFFSCREEN_SIZE, OFFSCREEN_SIZE);
        threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
        threeRenderer.shadowMap.enabled = true;
        threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // DOM'a ekleme — sadece offscreen kullanacağız
        threeRenderer.domElement.style.display = "none";
        document.body.appendChild(threeRenderer.domElement);

        // --- Sahne ---
        threeScene = new THREE.Scene();

        // --- Kamera (orthographic — perspektif distorsiyonunu azaltır) ---
        var aspect = 1;
        var d = 6;
        threeCamera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 100);
        threeCamera.position.set(0, 0, 10);
        threeCamera.lookAt(0, 0, 0);

        // --- Işıklandırma ---
        var ambient = new THREE.AmbientLight(0xffffff, 0.6);
        threeScene.add(ambient);

        var dirLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
        dirLight.position.set(5, 8, 10);
        dirLight.castShadow = true;
        threeScene.add(dirLight);

        var rimLight = new THREE.DirectionalLight(0xc9a84c, 0.4);
        rimLight.position.set(-4, -4, 2);
        threeScene.add(rimLight);

        var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-6, 6, 8);
        threeScene.add(fillLight);

        // --- Saat modelini oluştur ---
        watchGroup = buildWatchModel();
        threeScene.add(watchGroup);

        threeReady = true;
        console.log("[WristView] Three.js hazır");
    }

    // ========================
    //  3D SAAT MODELİ
    // ========================
    function buildWatchModel() {
        var group = new THREE.Group();

        // Materyaller
        var goldMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.95,
            roughness: 0.15,
            envMapIntensity: 1.0
        });
        var darkGoldMat = new THREE.MeshStandardMaterial({
            color: 0xB8860B,
            metalness: 0.9,
            roughness: 0.25
        });
        var dialMat = new THREE.MeshStandardMaterial({
            color: 0xFFFFF0,
            metalness: 0.05,
            roughness: 0.8
        });
        var glassMat = new THREE.MeshStandardMaterial({
            color: 0xaaddff,
            metalness: 0.1,
            roughness: 0.0,
            transparent: true,
            opacity: 0.18
        });
        var strapMat = new THREE.MeshStandardMaterial({
            color: 0x5C2E00,
            metalness: 0.0,
            roughness: 0.9
        });
        var strapHighMat = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.0,
            roughness: 0.85
        });
        var handMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.7,
            roughness: 0.3
        });
        var secondHandMat = new THREE.MeshStandardMaterial({
            color: 0xCC0000,
            metalness: 0.5,
            roughness: 0.4
        });
        var markerMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.3,
            roughness: 0.5
        });
        var crownMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            metalness: 0.9,
            roughness: 0.2
        });

        // ---- KORDON ÜST ----
        buildStrap(group, strapMat, strapHighMat, 0, 3.1, true);

        // ---- KORDON ALT ----
        buildStrap(group, strapMat, strapHighMat, 0, -3.1, false);

        // ---- KASA (Ana gövde) ----
        // Dış halka
        var caseGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.55, 64);
        var caseMesh = new THREE.Mesh(caseGeo, darkGoldMat);
        caseMesh.rotation.x = Math.PI / 2;
        caseMesh.castShadow = true;
        group.add(caseMesh);

        // İç halka (kenar parlaklık)
        var innerRimGeo = new THREE.CylinderGeometry(1.95, 1.95, 0.56, 64);
        var innerRimMesh = new THREE.Mesh(innerRimGeo, goldMat);
        innerRimMesh.rotation.x = Math.PI / 2;
        group.add(innerRimMesh);

        // Kadran tabanı
        var dialGeo = new THREE.CylinderGeometry(1.85, 1.85, 0.1, 64);
        var dialMesh = new THREE.Mesh(dialGeo, dialMat);
        dialMesh.rotation.x = Math.PI / 2;
        dialMesh.position.z = 0.15;
        dialMesh.receiveShadow = true;
        group.add(dialMesh);

        // Cam
        var glassGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.06, 64);
        var glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.rotation.x = Math.PI / 2;
        glassMesh.position.z = 0.3;
        group.add(glassMesh);

        // ---- SAAT İŞARETLEYİCİLERİ ----
        buildMarkers(group, goldMat, markerMat);

        // ---- AKREP ----
        var hourGroup = new THREE.Group();
        var hourGeo = new THREE.BoxGeometry(0.06, 1.0, 0.04);
        var hourMesh = new THREE.Mesh(hourGeo, handMat);
        hourMesh.position.y = 0.5;
        hourGroup.add(hourMesh);
        // Merkez cap
        var hourCapGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
        var hourCap = new THREE.Mesh(hourCapGeo, handMat);
        hourCap.rotation.x = Math.PI / 2;
        hourGroup.add(hourCap);
        hourGroup.position.z = 0.22;
        group.add(hourGroup);
        clockHands.hour = hourGroup;

        // ---- YELKOVan ----
        var minGroup = new THREE.Group();
        var minGeo = new THREE.BoxGeometry(0.04, 1.4, 0.04);
        var minMesh = new THREE.Mesh(minGeo, handMat);
        minMesh.position.y = 0.7;
        minGroup.add(minMesh);
        minGroup.position.z = 0.26;
        group.add(minGroup);
        clockHands.minute = minGroup;

        // ---- SANİYE ----
        var secGroup = new THREE.Group();
        var secGeo = new THREE.BoxGeometry(0.025, 1.65, 0.025);
        var secMesh = new THREE.Mesh(secGeo, secondHandMat);
        secMesh.position.y = 0.7;
        secGroup.add(secMesh);
        // Karşı kol
        var secCounterGeo = new THREE.BoxGeometry(0.025, 0.4, 0.025);
        var secCounter = new THREE.Mesh(secCounterGeo, secondHandMat);
        secCounter.position.y = -0.2;
        secGroup.add(secCounter);
        secGroup.position.z = 0.30;
        group.add(secGroup);
        clockHands.second = secGroup;

        // ---- MERKEZ NOKTASI ----
        var centerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
        var centerMesh = new THREE.Mesh(centerGeo, goldMat);
        centerMesh.rotation.x = Math.PI / 2;
        centerMesh.position.z = 0.32;
        group.add(centerMesh);

        // ---- TAÇA (CROWN) ----
        var crownGeo = new THREE.CylinderGeometry(0.15, 0.12, 0.4, 16);
        var crown = new THREE.Mesh(crownGeo, crownMat);
        crown.rotation.z = Math.PI / 2;
        crown.position.x = 2.3;
        group.add(crown);

        // ---- MARKA METNİ (daire marker ile temsil) ----
        var brandGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8);
        var brandMat2 = new THREE.MeshStandardMaterial({ color: 0xB8860B, metalness: 0.8, roughness: 0.2 });
        for (var i = 0; i < 5; i++) {
            var dot = new THREE.Mesh(brandGeo, brandMat2);
            dot.rotation.x = Math.PI / 2;
            dot.position.set(-0.3 + i * 0.15, 0.6, 0.21);
            group.add(dot);
        }

        return group;
    }

    function buildStrap(group, mat, highlightMat, x, yCenter, isTop) {
        // Ana kordon gövdesi
        var strapGeo = new THREE.BoxGeometry(1.3, 2.4, 0.22);
        var strap = new THREE.Mesh(strapGeo, mat);
        strap.position.set(x, yCenter, 0);
        strap.castShadow = true;
        strap.receiveShadow = true;
        group.add(strap);

        // Kordon çizgileri (ince şeritler)
        var lineCount = 4;
        for (var i = 0; i < lineCount; i++) {
            var lineGeo = new THREE.BoxGeometry(1.28, 0.04, 0.23);
            var line = new THREE.Mesh(lineGeo, highlightMat);
            var offset = (i - lineCount / 2 + 0.5) * 0.45;
            line.position.set(x, yCenter + offset, 0);
            group.add(line);
        }

        // Alt kordon için delikler
        if (!isTop) {
            var holeCount = 5;
            for (var j = 0; j < holeCount; j++) {
                var holeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.25, 12);
                var holeMat = new THREE.MeshStandardMaterial({ color: 0x3A1A00, metalness: 0, roughness: 1 });
                var hole = new THREE.Mesh(holeGeo, holeMat);
                hole.rotation.x = Math.PI / 2;
                hole.position.set(x, yCenter - 0.6 + j * 0.28, 0);
                group.add(hole);
            }

            // Toka
            var buckleGeo = new THREE.BoxGeometry(1.3, 0.12, 0.25);
            var buckleMat = new THREE.MeshStandardMaterial({ color: 0xB8860B, metalness: 0.9, roughness: 0.2 });
            var buckle = new THREE.Mesh(buckleGeo, buckleMat);
            buckle.position.set(x, yCenter + 0.9, 0);
            group.add(buckle);
        }
    }

    function buildMarkers(group, goldMat, markerMat) {
        // 12 saat işareti
        for (var i = 0; i < 12; i++) {
            var angle = (i / 12) * Math.PI * 2;
            var isHour = (i % 3 === 0); // 12, 3, 6, 9 daha büyük

            var w  = isHour ? 0.12 : 0.06;
            var h  = isHour ? 0.35 : 0.22;
            var r  = 1.6;

            var markerGeo = new THREE.BoxGeometry(w, h, 0.04);
            var mat = isHour ? goldMat : markerMat;
            var marker = new THREE.Mesh(markerGeo, mat);

            marker.position.set(
                Math.sin(angle) * r,
                Math.cos(angle) * r,
                0.2
            );
            marker.rotation.z = -angle;
            group.add(marker);
        }

        // Küçük dakika işaretleri (60 adet, saat olmayan konumlar)
        for (var m = 0; m < 60; m++) {
            if (m % 5 === 0) continue; // Büyük işaret var, atla
            var mAngle = (m / 60) * Math.PI * 2;
            var mGeo = new THREE.BoxGeometry(0.03, 0.1, 0.03);
            var mMesh = new THREE.Mesh(mGeo, markerMat);
            mMesh.position.set(
                Math.sin(mAngle) * 1.72,
                Math.cos(mAngle) * 1.72,
                0.19
            );
            mMesh.rotation.z = -mAngle;
            group.add(mMesh);
        }
    }

    // ========================
    //  AKREP/YELKOVAn GÜNCELLE
    // ========================
    function updateClockHands() {
        if (!threeReady || !clockHands.hour) return;

        var now = new Date();
        var hours   = now.getHours() % 12;
        var minutes = now.getMinutes();
        var seconds = now.getSeconds() + now.getMilliseconds() / 1000;

        var hourAngle   = -((hours + minutes / 60) / 12) * Math.PI * 2;
        var minuteAngle = -((minutes + seconds / 60) / 60) * Math.PI * 2;
        var secondAngle = -(seconds / 60) * Math.PI * 2;

        clockHands.hour.rotation.z   = hourAngle;
        clockHands.minute.rotation.z = minuteAngle;
        clockHands.second.rotation.z = secondAngle;
    }

    // ========================
    //  3D SAAT ÇİZ (drawWatch yerine)
    // ========================
    function render3DWatch(destX, destY, size, wristAngle) {
        if (!threeReady) return;

        // Akrepleri güncelle
        updateClockHands();

        // Bilek açısına göre grubu döndür
        // MediaPipe angle: elin yönü (radyan)
        // Saati bileğe dik yerleştir: +90 derece
        watchGroup.rotation.z = wristAngle - Math.PI / 2;

        // Hafif 3D tilt — gerçekçilik için
        watchGroup.rotation.x = 0.25;
        watchGroup.rotation.y = 0.1;

        // Render et
        threeRenderer.render(threeScene, threeCamera);

        // Offscreen canvas'tan 2D canvas'a kopyala
        var srcCanvas = threeRenderer.domElement;
        var drawSize  = size * 1.8; // 3D model daha iyi ölçeklenir

        ctx.save();
        ctx.shadowColor    = "rgba(0,0,0,0.45)";
        ctx.shadowBlur     = 24;
        ctx.shadowOffsetX  = 4;
        ctx.shadowOffsetY  = 8;

        ctx.drawImage(
            srcCanvas,
            destX - drawSize / 2,
            destY - drawSize / 2,
            drawSize,
            drawSize
        );

        ctx.restore();
    }

    // ========================
    //  KAMERA
    // ========================
    function startCamera(facing) {
        setStatus("Kamera açılıyor...", "waiting");

        if (currentStream) {
            currentStream.getTracks().forEach(function (t) { t.stop(); });
        }

        var constraints = {
            video: {
                facingMode: facing || "environment",
                width:  { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
            currentStream = stream;
            video.srcObject = stream;

            return new Promise(function (resolve, reject) {
                video.onloadedmetadata = function () {
                    video.play().then(function () {
                        canvas.width  = video.videoWidth;
                        canvas.height = video.videoHeight;
                        touchX = canvas.width  / 2;
                        touchY = canvas.height / 2;
                        setStatus("Kamera hazır", "detecting");
                        resolve();
                    }).catch(reject);
                };
                setTimeout(function () { reject(new Error("Kamera zaman aşımı")); }, 15000);
            });
        });
    }

    function switchCamera() {
        currentFacing = currentFacing === "environment" ? "user" : "environment";

        if (currentFacing === "user") {
            video.style.transform  = "scaleX(-1)";
            canvas.style.transform = "scaleX(-1)";
        } else {
            video.style.transform  = "scaleX(1)";
            canvas.style.transform = "scaleX(1)";
        }

        isRunning = false;
        startCamera(currentFacing).then(function () {
            isRunning = true;
            detectFrame();
        }).catch(function (err) {
            setStatus("Kamera değiştirilemedi", "waiting");
            console.error(err);
        });
    }

    // ========================
    //  MEDIAPIPE HANDS
    // ========================
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload  = resolve;
            s.onerror = function () { reject(new Error("Yüklenemedi: " + src)); };
            document.head.appendChild(s);
        });
    }

    function loadMediaPipe() {
        setStatus("El algılama yükleniyor...", "waiting");
        return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js")
            .then(function () { return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"); })
            .then(function () { return loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"); })
            .then(function () { return initHands(); });
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
            var landmarks    = results.multiHandLandmarks[0];
            var wrist        = landmarks[0];
            var point5       = landmarks[5];
            var point17      = landmarks[17];
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

            render3DWatch(wristX, wristY, watchSize, angle);

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
    //  FRAME DÖNGÜSÜ
    // ========================
    function detectFrame() {
        if (!isRunning) return;

        if (useSimpleMode) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            render3DWatch(touchX, touchY, 120 * watchScale, 0);
            requestAnimationFrame(detectFrame);
        } else {
            handsInstance.send({ image: video })
                .then(function () { requestAnimationFrame(detectFrame); })
                .catch(function () { requestAnimationFrame(detectFrame); });
        }
    }

    // ========================
    //  BASİT MOD (MediaPipe yoksa)
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

        canvas.addEventListener("mousedown",  function (e) { updateMouse(e); });
        canvas.addEventListener("mousemove",  function (e) { if (e.buttons === 1) updateMouse(e); });
    }

    function updateTouch(e) {
        var rect   = canvas.getBoundingClientRect();
        var scaleX = canvas.width  / rect.width;
        var scaleY = canvas.height / rect.height;
        if (currentFacing === "user") {
            touchX = (rect.width - (e.touches[0].clientX - rect.left)) * scaleX;
        } else {
            touchX = (e.touches[0].clientX - rect.left) * scaleX;
        }
        touchY = (e.touches[0].clientY - rect.top) * scaleY;
    }

    function updateMouse(e) {
        var rect   = canvas.getBoundingClientRect();
        var scaleX = canvas.width  / rect.width;
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
        var c     = document.createElement("canvas");
        c.width   = canvas.width;
        c.height  = canvas.height;
        var cCtx  = c.getContext("2d");

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
            cCtx.drawImage(video,  0, 0, c.width, c.height);
            cCtx.drawImage(canvas, 0, 0, c.width, c.height);
        }

        // Watermark
        cCtx.fillStyle = "rgba(255,255,255,0.5)";
        cCtx.font = "bold 14px Inter, sans-serif";
        cCtx.fillText("WristView ⌚", 12, c.height - 16);

        var link       = document.createElement("a");
        link.download  = "wristview-" + Date.now() + ".png";
        link.href      = c.toDataURL("image/png", 0.92);
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

        video.style.transform  = "scaleX(1)";
        canvas.style.transform = "scaleX(1)";

        // 1) Three.js yükle  2) Kamera  3) MediaPipe
        loadThreeJS()
            .then(function () {
                initThreeJS();
                return startCamera(currentFacing);
            })
            .then(function () {
                return loadMediaPipe();
            })
            .then(function () {
                showMainUI();
                isRunning = true;
                detectFrame();
            })
            .catch(function (err) {
                console.error("Hata:", err);

                if (video.srcObject) {
                    // Kamera var, MediaPipe yüklenemedi → basit mod
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