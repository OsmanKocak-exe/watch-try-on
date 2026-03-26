// ================================================================
//  WRISTVIEW v2 — AR Saat Deneme
//  Stack: MediaPipe Holistic · Three.js r128 · Vanilla JS
//  Lisans: MIT — GitHub Pages'e direkt deploy edilir
// ================================================================

(function () {
  "use strict";

  // ================================================================
  //  SAAT KATALOĞu
  //  Kendi saatlerini buraya ekle.
  //  glb: "models/klasor/dosya.glb" şeklinde.
  //  thumb: küçük resim (opsiyonel, yoksa emoji gösterilir).
  //  rotationOffset: modelin varsayılan rotasyonu yanlışsa düzelt (radyan).
  //  scaleOverride: modele özel boyut çarpanı.
  // ================================================================
  var WATCHES = [
    {
      id: "classic-gold",
      brand: "LUXURY",
      model: "Classic Gold",
      price: "₺12.500",
      emoji: "⌚",
      thumb: null,                       // "images/thumb-classic-gold.png"
      glb: "models/classic-gold/watch.glb",
      rotationOffset: { x: 0, y: 0, z: 0 },
      scaleOverride: 1.0
    },
    {
      id: "sport-black",
      brand: "SPORT",
      model: "Pro Black",
      price: "₺8.900",
      emoji: "⌚",
      thumb: null,
      glb: "models/sport-black/watch.glb",
      rotationOffset: { x: 0, y: 0, z: 0 },
      scaleOverride: 1.0
    },
    {
      id: "vintage-silver",
      brand: "VINTAGE",
      model: "Silver Moon",
      price: "₺15.200",
      emoji: "⌚",
      thumb: null,
      glb: "models/vintage-silver/watch.glb",
      rotationOffset: { x: 0, y: 0, z: 0 },
      scaleOverride: 1.0
    }
  ];

  // ================================================================
  //  YAPILANDIRMA
  // ================================================================
  var CFG = {
    OFFSCREEN:      512,     // WebGL render çözünürlüğü (px)
    SMOOTH_POS:     0.18,    // Pozisyon smoothing (0=donuk, 1=anlık)
    SMOOTH_ROT:     0.14,    // Rotasyon smoothing
    SMOOTH_SIZE:    0.20,    // Boyut smoothing
    TILT_X:         0.20,    // Saatin ekrana dik eğimi (radyan) — bilek perspektifi
    MEDIAPIPE_CDN:  "https://cdn.jsdelivr.net/npm/@mediapipe/",
    THREE_CDN:      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/"
  };

  // ================================================================
  //  DOM
  // ================================================================
  var $ = function (id) { return document.getElementById(id); };
  var video         = $("camera");
  var canvas        = $("output");
  var ctx           = canvas.getContext("2d");
  var splashEl      = $("splash-screen");
  var topBar        = $("top-bar");
  var statusBar     = $("status-bar");
  var statusText    = $("status-text");
  var watchInfoCard = $("watch-info-card");
  var bottomPanel   = $("bottom-panel");
  var startBtn      = $("start-btn");
  var errorEl       = $("error-msg");
  var sizeUpBtn     = $("size-up");
  var sizeDownBtn   = $("size-down");
  var sizeValueEl   = $("size-value");
  var captureBtn    = $("capture-btn");
  var camSwitchBtn  = $("camera-switch-btn");
  var toastEl       = $("capture-toast");
  var galleryEl     = $("watch-gallery");

  // ================================================================
  //  UYGULAMA DURUMU
  // ================================================================
  var state = {
    running:       false,
    facing:        "environment",
    stream:        null,
    handDetected:  false,
    watchScale:    1.0,
    simpleMode:    false,
    touchX:        0,
    touchY:        0,
    activeWatch:   0,          // WATCHES dizisindeki index
    modelCache:    {}          // yüklenen GLB'leri cache'le
  };

  // Smooth (interpolated) değerler
  var smooth = {
    x: 0, y: 0,
    rotX: 0, rotY: 0, rotZ: 0,  // Three.js Euler
    size: 0,
    initialized: false
  };

  // ================================================================
  //  THREE.JS
  // ================================================================
  var three = {
    renderer:  null,
    scene:     null,
    camera:    null,
    group:     null,    // aktif model grubu
    hands:     {},      // akrep/yelkovan referansları (procedural için)
    ready:     false,
    glbLoaded: false
  };

  // ================================================================
  //  YARDIMCILAR
  // ================================================================
  function setStatus(msg, type) {
    statusText.textContent = msg;
    statusBar.className = "visible " + (type || "waiting");
  }

  function showError(html) {
    errorEl.innerHTML = html;
    errorEl.classList.add("visible");
  }

  function hideError() { errorEl.classList.remove("visible"); }

  function showMainUI() {
    splashEl.classList.add("hidden");
    topBar.classList.add("visible");
    statusBar.classList.add("visible");
    watchInfoCard.classList.add("visible");
    bottomPanel.classList.add("visible");
  }

  function showToast(msg) {
    toastEl.querySelector("span").textContent = msg;
    toastEl.classList.add("show");
    setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  function updateSizeLabel() {
    sizeValueEl.textContent = Math.round(state.watchScale * 100) + "%";
  }

  // Açı lerp — 360°/0° sarmasını doğru handle eder
  function lerpAngle(a, b, t) {
    var d = b - a;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ================================================================
  //  SAAT KATALOĞu UI
  // ================================================================
  function buildGallery() {
    galleryEl.innerHTML = "";
    WATCHES.forEach(function (w, i) {
      var card = document.createElement("div");
      card.className = "watch-card" + (i === state.activeWatch ? " active" : "");
      card.dataset.index = i;

      if (w.thumb) {
        var img = document.createElement("img");
        img.src = w.thumb;
        img.alt = w.model;
        img.className = "watch-thumb";
        card.appendChild(img);
      } else {
        var ph = document.createElement("div");
        ph.className = "watch-thumb-placeholder";
        ph.textContent = w.emoji || "⌚";
        card.appendChild(ph);
      }

      var name = document.createElement("span");
      name.className = "watch-card-name";
      name.textContent = w.brand + " " + w.model;
      card.appendChild(name);

      card.addEventListener("click", function () {
        selectWatch(parseInt(this.dataset.index));
      });

      galleryEl.appendChild(card);
    });
  }

  function selectWatch(index) {
    if (index === state.activeWatch && three.glbLoaded) return;
    state.activeWatch = index;

    // Galeri UI güncelle
    var cards = galleryEl.querySelectorAll(".watch-card");
    cards.forEach(function (c, i) {
      c.classList.toggle("active", i === index);
    });

    // Bilgi kartı güncelle
    var w = WATCHES[index];
    $("info-brand").textContent = w.brand;
    $("info-model").textContent = w.model;
    $("info-price").textContent = w.price;

    // Modeli yükle
    if (three.ready) loadWatchModel(index);
  }

  // ================================================================
  //  THREE.JS BAŞLATMA
  // ================================================================
  function initThreeJS() {
    /* global THREE */
    var S = CFG.OFFSCREEN;

    three.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      stencil: true          // oklüzyon için stencil buffer
    });
    three.renderer.setSize(S, S);
    three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    three.renderer.shadowMap.enabled    = true;
    three.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
    three.renderer.outputEncoding       = THREE.sRGBEncoding;
    three.renderer.toneMapping          = THREE.ACESFilmicToneMapping;
    three.renderer.toneMappingExposure  = 1.25;
    three.renderer.localClippingEnabled = true;

    // DOM'a gizli ekle — sadece offscreen render için
    three.renderer.domElement.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;pointer-events:none;";
    document.body.appendChild(three.renderer.domElement);

    // Sahne
    three.scene = new THREE.Scene();

    // Orthographic kamera — perspektif distorsiyonu olmadan bilek üstünde daha iyi
    var d = 5;
    three.camera = new THREE.OrthographicCamera(-d, d, d, -d, 0.01, 100);
    three.camera.position.set(0, 0, 12);
    three.camera.lookAt(0, 0, 0);

    // ---- Işıklandırma ----
    // Ambient — genel dolgu
    three.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    // Key light — ana ışık (hafif sıcak)
    var key = new THREE.DirectionalLight(0xfff5e0, 1.5);
    key.position.set(4, 7, 9);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far  = 50;
    three.scene.add(key);

    // Fill light — gölgeleri yumuşat
    var fill = new THREE.DirectionalLight(0xc5d8ff, 0.38);
    fill.position.set(-5, 2, 5);
    three.scene.add(fill);

    // Rim light — altın saatler için sıcak arka ışık
    var rim = new THREE.DirectionalLight(0xffcc66, 0.3);
    rim.position.set(1, -6, -2);
    three.scene.add(rim);

    // Environment map — metal yüzeylerde gerçekçi yansıma
    try {
      var pmrem = new THREE.PMREMGenerator(three.renderer);
      pmrem.compileEquirectangularShader();
      three.scene.environment = pmrem.fromScene(new THREE.RoomEnvironment()).texture;
      pmrem.dispose();
    } catch (e) {
      console.log("[WristView] EnvMap atlandı:", e.message);
    }

    three.ready = true;
  }

  // ================================================================
  //  GLB MODEL YÜKLEME
  // ================================================================
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error("Script yüklenemedi: " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadGLTFLoader() {
    if (typeof THREE !== "undefined" && THREE.GLTFLoader) return Promise.resolve();
    return loadScript(CFG.THREE_CDN + "loaders/GLTFLoader.js");
  }

  function loadWatchModel(index) {
    var w = WATCHES[index];

    // Cache'te varsa direkt kullan
    if (state.modelCache[w.id]) {
      swapModel(state.modelCache[w.id].clone(), w);
      return;
    }

    setStatus("Model yükleniyor...", "waiting");

    loadGLTFLoader().then(function () {
      return new Promise(function (resolve, reject) {
        new THREE.GLTFLoader().load(
          w.glb,
          function (gltf) { resolve(gltf.scene); },
          function (xhr) {
            if (xhr.total > 0) {
              setStatus("Yükleniyor: " + Math.round(xhr.loaded / xhr.total * 100) + "%", "waiting");
            }
          },
          reject
        );
      });
    }).then(function (model) {
      // Normalize: merkeze al, standart boyuta getir
      var box    = new THREE.Box3().setFromObject(model);
      var center = new THREE.Vector3();
      var size3  = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size3);
      model.position.sub(center);
      model.scale.setScalar((4.0 / Math.max(size3.x, size3.y, size3.z)) * (w.scaleOverride || 1.0));

      // Model rotasyon offset (bazı exportlar yanlış eksenle gelir)
      model.rotation.x += (w.rotationOffset && w.rotationOffset.x) || 0;
      model.rotation.y += (w.rotationOffset && w.rotationOffset.y) || 0;
      model.rotation.z += (w.rotationOffset && w.rotationOffset.z) || 0;

      // Shadow + materyal
      model.traverse(function (c) {
        if (c.isMesh) {
          c.castShadow    = true;
          c.receiveShadow = true;
          // PBR materyaller olduğu gibi korunur
        }
      });

      state.modelCache[w.id] = model;
      swapModel(model, w);
      setStatus("Hazır! Bileğinizi gösterin", "detecting");
    }).catch(function (err) {
      console.warn("[WristView] GLB yüklenemedi, procedural fallback:", err.message);
      var fallback = buildProceduralWatch();
      swapModel(fallback, w);
      setStatus("Hazır! Bileğinizi gösterin", "detecting");
    });
  }

  function swapModel(newModel, watchData) {
    // Önceki modeli sahneden kaldır
    if (three.group) {
      three.scene.remove(three.group);
      three.group = null;
      three.hands = {};
    }

    three.group    = newModel;
    three.glbLoaded = true;
    three.scene.add(three.group);

    // Smooth değerlerini sıfırla ki yeni model konuma zıplasın
    smooth.initialized = false;
  }

  // ================================================================
  //  PROCEDURAL WATCH (GLB yokken yedek)
  // ================================================================
  function buildProceduralWatch() {
    var g = new THREE.Group();

    var M = function (color, metal, rough, trans, opacity) {
      return new THREE.MeshStandardMaterial({
        color: color, metalness: metal || 0, roughness: rough != null ? rough : 0.5,
        transparent: !!trans, opacity: opacity != null ? opacity : 1
      });
    };

    var goldM  = M(0xFFD700, .96, .11);
    var dkGold = M(0xB8860B, .88, .22);
    var dialM  = M(0xFFFFF5, .04, .78);
    var glassM = M(0xbbddff, .1,  .0,  true, .16);
    var strapM = M(0x3D1800, .0,  .93);
    var handM  = M(0x111111, .72, .28);
    var secM   = M(0xCC0000, .5,  .4);

    function add(geo, mat, x, y, z, rx, ry, rz) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x||0, y||0, z||0);
      m.rotation.set(rx||0, ry||0, rz||0);
      m.castShadow = m.receiveShadow = true;
      g.add(m); return m;
    }

    // Kordon üst & alt
    [2.75, -2.75].forEach(function (yc, idx) {
      add(new THREE.BoxGeometry(1.2, 2.15, .18), strapM, 0, yc);
      var lm = M(0x5C2E00, 0, .88);
      for (var k = 0; k < 5; k++) {
        add(new THREE.BoxGeometry(1.18, .028, .19), lm, 0, yc + (k-2)*.38);
      }
      if (idx === 1) {
        // Delikler
        var hm = M(0x1A0800);
        for (var j = 0; j < 5; j++) {
          var hole = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.2,10), hm);
          hole.rotation.x = Math.PI/2;
          hole.position.set(0, yc-.48+j*.26, 0);
          g.add(hole);
        }
        // Toka
        add(new THREE.BoxGeometry(1.22,.08,.2), M(0xB8860B,.9,.14), 0, yc+.84);
      }
    });

    // Kasa
    add(new THREE.CylinderGeometry(2.0, 2.0,.50,64), dkGold, 0,0,0, Math.PI/2);
    add(new THREE.CylinderGeometry(1.87,1.87,.52,64), goldM, 0,0,0, Math.PI/2);
    add(new THREE.CylinderGeometry(1.75,1.75,.08,64), dialM, 0,0,.17, Math.PI/2);
    add(new THREE.CylinderGeometry(1.80,1.80,.05,64), glassM,0,0,.27, Math.PI/2);

    // Saat işaretleri
    for (var i = 0; i < 12; i++) {
      var a = (i/12)*Math.PI*2, big = i%3===0;
      var mk = new THREE.Mesh(
        new THREE.BoxGeometry(big?.09:.045, big?.28:.16, .03),
        big ? goldM : handM
      );
      mk.position.set(Math.sin(a)*1.50, Math.cos(a)*1.50, .19);
      mk.rotation.z = -a; g.add(mk);
    }

    // Akrep
    var hg = new THREE.Group(); hg.position.z = .21;
    var hm2 = new THREE.Mesh(new THREE.BoxGeometry(.060,.92,.038), handM);
    hm2.position.y = .46; hg.add(hm2); g.add(hg);
    three.hands.hour = hg;

    // Yelkovan
    var mg = new THREE.Group(); mg.position.z = .25;
    var mm2 = new THREE.Mesh(new THREE.BoxGeometry(.040,1.32,.038), handM);
    mm2.position.y = .66; mg.add(mm2); g.add(mg);
    three.hands.minute = mg;

    // Saniye
    var sg = new THREE.Group(); sg.position.z = .29;
    var sm = new THREE.Mesh(new THREE.BoxGeometry(.022,1.55,.022), secM);
    sm.position.y = .64; sg.add(sm);
    var st = new THREE.Mesh(new THREE.BoxGeometry(.022,.36,.022), secM);
    st.position.y = -.18; sg.add(st); g.add(sg);
    three.hands.second = sg;

    // Merkez + taç
    add(new THREE.CylinderGeometry(.10,.10,.06,16), goldM, 0,0,.30, Math.PI/2);
    add(new THREE.CylinderGeometry(.13,.10,.36,12), goldM, 2.20,0,0, 0,0,Math.PI/2);

    return g;
  }

  // ================================================================
  //  SAAT GÖSTERGELERİ (sadece procedural model için)
  // ================================================================
  function updateClockHands() {
    if (!three.hands.hour) return;
    var now = new Date();
    var h = now.getHours() % 12, m = now.getMinutes();
    var s = now.getSeconds() + now.getMilliseconds() / 1000;
    three.hands.hour.rotation.z   = -((h + m/60) / 12) * Math.PI * 2;
    three.hands.minute.rotation.z = -((m + s/60) / 60) * Math.PI * 2;
    three.hands.second.rotation.z = -(s / 60) * Math.PI * 2;
  }

  // ================================================================
  //  ANA RENDER — wrist pozisyonu ve rotasyonunu alır
  // ================================================================
  function renderWatch(wristX, wristY, wristSize, rotX, rotY, rotZ) {
    if (!three.ready || !three.group) return;

    // ---- Kalman benzeri smoothing ----
    if (!smooth.initialized) {
      smooth.x    = wristX;  smooth.y    = wristY;
      smooth.rotX = rotX;    smooth.rotY = rotY;    smooth.rotZ = rotZ;
      smooth.size = wristSize;
      smooth.initialized = true;
    } else {
      smooth.x    = lerp(smooth.x,    wristX,    CFG.SMOOTH_POS);
      smooth.y    = lerp(smooth.y,    wristY,    CFG.SMOOTH_POS);
      smooth.size = lerp(smooth.size, wristSize, CFG.SMOOTH_SIZE);
      smooth.rotX = lerpAngle(smooth.rotX, rotX, CFG.SMOOTH_ROT);
      smooth.rotY = lerpAngle(smooth.rotY, rotY, CFG.SMOOTH_ROT);
      smooth.rotZ = lerpAngle(smooth.rotZ, rotZ, CFG.SMOOTH_ROT);
    }

    // ---- Model rotasyonu uygula ----
    // rotZ: elin Z ekseni (bileğin sola/sağa yönü)
    // rotX: bilek eğimi (öne/arkaya)
    // rotY: önkol dönüşü (roll)
    three.group.rotation.set(
      smooth.rotX + CFG.TILT_X,   // hafif sabit tilt + dinamik pitch
      smooth.rotY,
      smooth.rotZ - Math.PI / 2   // -90° offset: saat bileğe dik oturur
    );

    updateClockHands();

    // ---- WebGL render ----
    three.renderer.render(three.scene, three.camera);

    // ---- 2D canvas'a composite ----
    var drawSize = smooth.size * 2.1 * state.watchScale;

    ctx.save();
    // Saat gölgesi
    ctx.shadowColor   = "rgba(0,0,0,0.55)";
    ctx.shadowBlur    = 30;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 12;

    ctx.drawImage(
      three.renderer.domElement,
      smooth.x - drawSize / 2,
      smooth.y - drawSize / 2,
      drawSize,
      drawSize
    );
    ctx.restore();
  }

  // ================================================================
  //  MEDİAPİPE HOLISTIC
  //  Holistic = Hand + Pose + Face — biz sadece Hand + Pose kullanıyoruz.
  //  Pose'dan önkol yönünü alıyoruz → çok daha doğru bilek rotasyonu.
  // ================================================================
  var holistic = null;

  function loadHolistic() {
    setStatus("El algılama yükleniyor...", "waiting");

    return loadScript(CFG.MEDIAPIPE_CDN + "holistic/holistic.js")
      .then(function () {
        return loadScript(CFG.MEDIAPIPE_CDN + "camera_utils/camera_utils.js");
      })
      .then(function () {
        return initHolistic();
      });
  }

  function initHolistic() {
    setStatus("Model yükleniyor...", "waiting");

    /* global Holistic */
    holistic = new Holistic({
      locateFile: function (f) {
        return CFG.MEDIAPIPE_CDN + "holistic/" + f;
      }
    });

    holistic.setOptions({
      modelComplexity:          1,
      smoothLandmarks:          true,    // MediaPipe kendi smoothing'i
      enableSegmentation:       false,   // performans için kapalı
      smoothSegmentation:       false,
      refineFaceLandmarks:      false,
      minDetectionConfidence:   0.65,
      minTrackingConfidence:    0.55
    });

    holistic.onResults(onHolisticResults);

    return holistic.send({ image: video }).then(function () {
      setStatus("Hazır! Bileğinizi gösterin", "detecting");
    });
  }

  // ================================================================
  //  HOLİSTİC SONUÇLARI — Burada asıl iş yapılıyor
  // ================================================================
  function onHolisticResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hand landmarks var mı?
    var handLm = results.rightHandLandmarks || results.leftHandLandmarks;
    if (!handLm) {
      if (state.handDetected) {
        state.handDetected = false;
        setStatus("Bileğinizi kameraya gösterin", "waiting");
      }
      return;
    }

    // ---- Bilek pozisyonu (landmark 0) ----
    var wrist   = handLm[0];
    var wX      = wrist.x * canvas.width;
    var wY      = wrist.y * canvas.height;

    // ---- El genişliği → saat boyutu ----
    var p5  = handLm[5];   // işaret parmağı kök
    var p17 = handLm[17];  // serçe parmak kök
    var handWidth = Math.sqrt(
      Math.pow((p5.x - p17.x) * canvas.width,  2) +
      Math.pow((p5.y - p17.y) * canvas.height, 2)
    );

    // ---- Rotasyon hesaplama ----
    // Temel: bilek→orta parmak vektöründen Z rotasyonu
    var mid    = handLm[9];
    var rotZ   = Math.atan2(
      (mid.y - wrist.y) * canvas.height,
      (mid.x - wrist.x) * canvas.width
    );

    // Pose landmarks'tan önkol yönü (daha doğru rotasyon)
    var rotX = 0, rotY = 0;
    var poseLm = results.poseLandmarks;
    if (poseLm) {
      // Sağ el: 15=sağ bilek, 13=sağ dirsek
      // Sol el: 16=sol bilek, 14=sol dirsek
      var isRight = !!results.rightHandLandmarks;
      var pWrist  = poseLm[isRight ? 15 : 16];
      var pElbow  = poseLm[isRight ? 13 : 14];

      if (pWrist && pElbow) {
        // Önkol vektörü
        var forearmX = pWrist.x - pElbow.x;
        var forearmY = pWrist.y - pElbow.y;
        var forearmZ = (pWrist.z || 0) - (pElbow.z || 0);

        // Pitch: önkolun yukarı/aşağı eğimi
        rotX = Math.atan2(-forearmY, Math.sqrt(forearmX*forearmX + forearmZ*forearmZ));
        rotX = Math.max(-0.8, Math.min(0.8, rotX)); // sınırla

        // Roll: önkolun eksen etrafında dönüşü (z depth'ten tahmin)
        rotY = Math.atan2(forearmZ, forearmX) * 0.4; // katsayı ile yumuşat
        rotY = Math.max(-0.5, Math.min(0.5, rotY));
      }
    }

    renderWatch(wX, wY, handWidth * 1.55, rotX, rotY, rotZ);

    if (!state.handDetected) {
      state.handDetected = true;
      setStatus("Saat bileğinizde! 📸", "detecting");
    }
  }

  // ================================================================
  //  FRAME DÖNGÜSÜ
  // ================================================================
  function detectFrame() {
    if (!state.running) return;

    if (state.simpleMode) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderWatch(state.touchX, state.touchY, 100, 0, 0, 0);
      requestAnimationFrame(detectFrame);
    } else {
      holistic.send({ image: video })
        .then(function () { requestAnimationFrame(detectFrame); })
        .catch(function ()  { requestAnimationFrame(detectFrame); });
    }
  }

  // ================================================================
  //  KAMERA
  // ================================================================
  function startCamera(facing) {
    setStatus("Kamera açılıyor...", "waiting");
    if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); });

    return navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing || "environment",
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    }).then(function (stream) {
      state.stream    = stream;
      video.srcObject = stream;

      return new Promise(function (resolve, reject) {
        video.onloadedmetadata = function () {
          video.play().then(function () {
            canvas.width   = video.videoWidth;
            canvas.height  = video.videoHeight;
            state.touchX   = canvas.width  / 2;
            state.touchY   = canvas.height / 2;
            smooth.initialized = false;
            setStatus("Kamera hazır", "detecting");
            resolve();
          }).catch(reject);
        };
        setTimeout(function () { reject(new Error("Kamera zaman aşımı (15s)")); }, 15000);
      });
    });
  }

  function switchCamera() {
    state.facing = state.facing === "environment" ? "user" : "environment";
    var mirror   = state.facing === "user" ? "scaleX(-1)" : "scaleX(1)";
    video.style.transform  = mirror;
    canvas.style.transform = mirror;

    state.running = false;
    startCamera(state.facing).then(function () {
      state.running = true;
      detectFrame();
    }).catch(function (e) {
      setStatus("Kamera değiştirilemedi", "waiting");
      console.error(e);
    });
  }

  // ================================================================
  //  BASİT MOD (Holistic yüklenemezse — dokunarak sürükleme)
  // ================================================================
  function setupSimpleMode() {
    state.simpleMode = true;
    setStatus("Dokunarak saati taşıyın", "detecting");

    canvas.style.pointerEvents = "auto";
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchmove",  onTouch, { passive: false });
    canvas.addEventListener("mousedown",  onMouse);
    canvas.addEventListener("mousemove",  function (e) { if (e.buttons === 1) onMouse(e); });
  }

  function onTouch(e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var t = e.touches[0];
    state.touchX = state.facing === "user"
      ? (r.width - (t.clientX - r.left)) * (canvas.width / r.width)
      : (t.clientX - r.left) * (canvas.width / r.width);
    state.touchY = (t.clientY - r.top) * (canvas.height / r.height);
  }

  function onMouse(e) {
    var r = canvas.getBoundingClientRect();
    state.touchX = state.facing === "user"
      ? (r.width - (e.clientX - r.left)) * (canvas.width / r.width)
      : (e.clientX - r.left) * (canvas.width / r.width);
    state.touchY = (e.clientY - r.top) * (canvas.height / r.height);
  }

  // ================================================================
  //  FOTOĞRAF
  // ================================================================
  function capturePhoto() {
    var c     = document.createElement("canvas");
    c.width   = canvas.width;
    c.height  = canvas.height;
    var cx    = c.getContext("2d");

    if (state.facing === "user") {
      cx.save(); cx.scale(-1, 1);
      cx.drawImage(video,  -c.width, 0, c.width, c.height);
      cx.drawImage(canvas, -c.width, 0, c.width, c.height);
      cx.restore();
    } else {
      cx.drawImage(video,  0, 0, c.width, c.height);
      cx.drawImage(canvas, 0, 0, c.width, c.height);
    }

    // Watermark
    cx.fillStyle = "rgba(255,255,255,0.45)";
    cx.font      = "bold 13px Inter, sans-serif";
    cx.fillText("WristView ⌚", 12, c.height - 14);

    var a       = document.createElement("a");
    a.download  = "wristview-" + Date.now() + ".png";
    a.href      = c.toDataURL("image/png", 0.93);
    a.click();
    showToast("✅ Fotoğraf kaydedildi!");
  }

  // ================================================================
  //  ANA BAŞLATMA — Zincir: Three.js → Kamera → Model → Holistic
  // ================================================================
  function startApp() {
    hideError();
    startBtn.disabled = true;
    startBtn.classList.add("loading");
    startBtn.querySelector(".btn-text").textContent = "Yükleniyor";
    startBtn.querySelector(".btn-arrow").textContent = "";
    video.style.transform = canvas.style.transform = "scaleX(1)";

    // Three.js HTML'de zaten yüklendi (script tag) — sadece kontrol et
    if (typeof THREE === "undefined") {
      showError("Three.js yüklenemedi. İnternet bağlantınızı kontrol edin.");
      resetStartBtn(); return;
    }

    // 1. Three.js başlat
    initThreeJS();

    // 2. Galeri oluştur ve ilk saati yükle
    buildGallery();

    // 3. Kamerayı aç
    startCamera(state.facing)
      .then(function () {
        // 4. İlk saat modelini yükle
        loadWatchModel(state.activeWatch);
        // 5. Holistic yükle
        return loadHolistic();
      })
      .then(function () {
        showMainUI();
        state.running = true;
        detectFrame();
      })
      .catch(function (err) {
        console.error("[WristView] Hata:", err);

        if (video.srcObject) {
          // Kamera var, Holistic yüklenemedi → basit mod
          console.warn("[WristView] Holistic başlatılamadı, basit moda geçiliyor");
          setupSimpleMode();
          showMainUI();
          state.running = true;
          detectFrame();
        } else {
          showError(
            "<strong>Hata:</strong> " + err.message + "<br><br>" +
            "• Kamera iznini kontrol edin<br>" +
            "• Sayfayı yenileyin (HTTPS gerekli)<br>" +
            "• Başka bir tarayıcı deneyin (Chrome / Safari)"
          );
          resetStartBtn();
        }
      });
  }

  function resetStartBtn() {
    startBtn.classList.remove("loading");
    startBtn.querySelector(".btn-text").textContent = "Tekrar Dene";
    startBtn.querySelector(".btn-arrow").textContent = "↻";
    startBtn.disabled = false;
  }

  // ================================================================
  //  EVENTLER
  // ================================================================
  startBtn.addEventListener("click", startApp);

  sizeUpBtn.addEventListener("click", function () {
    state.watchScale = Math.min(state.watchScale + 0.1, 2.5);
    updateSizeLabel();
  });
  sizeDownBtn.addEventListener("click", function () {
    state.watchScale = Math.max(state.watchScale - 0.1, 0.3);
    updateSizeLabel();
  });

  captureBtn.addEventListener("click", capturePhoto);
  camSwitchBtn.addEventListener("click", switchCamera);

  // ================================================================
  //  HTTPS KONTROLÜ
  // ================================================================
  var secure = location.protocol === "https:" ||
               location.hostname === "localhost" ||
               location.hostname === "127.0.0.1";

  if (!secure) {
    showError(
      "⚠️ <strong>HTTPS gerekli!</strong><br>" +
      "Kamera erişimi sadece HTTPS üzerinden çalışır.<br>" +
      "GitHub Pages otomatik HTTPS sağlar."
    );
    startBtn.disabled = true;
  }

})();
