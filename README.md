# WristView v2 — AR Saat Deneme

Sanal saat try-on uygulaması. MediaPipe Holistic + Three.js ile web tarayıcısında çalışır. Uygulama indirme gerekmez.

## Klasör Yapısı

```
wristview-v2/
├── index.html
├── style.css
├── app.js
├── models/
│   ├── classic-gold/
│   │   └── watch.glb        ← Birinci saat modeli
│   ├── sport-black/
│   │   └── watch.glb
│   └── vintage-silver/
│       └── watch.glb
└── images/
    ├── thumb-classic-gold.png   ← Galeri küçük resimleri (opsiyonel)
    ├── thumb-sport-black.png
    └── thumb-vintage-silver.png
```

## Hızlı Başlangıç

### 1. GLB Modeli Hazırlama

GLB modelini `models/klasor/watch.glb` konumuna koy.

**Model gereksinimleri:**
- Format: GLTF 2.0 / GLB (binary)
- Boyut: < 5 MB (tercihen < 2 MB — mobil için)
- Eksen: Y-up (standart Blender/Three.js ekseni)
- Materyal: PBR (metallic-roughness workflow) — Three.js bunu doğrudan destekler
- Polygon sayısı: < 50.000 (mobil performansı için)

**Blender'dan export:**
```
File → Export → glTF 2.0
Format: GLB (binary)
Include: Selected Objects
Transform: +Y Up ✓
Geometry: Apply Modifiers ✓
Materials: Export ✓
```

**Sketchfab'dan:**
Ücretsiz modeller için sketchfab.com → Download → Original format veya GLTF

### 2. Saat Kataloğunu Düzenle

`app.js` içindeki `WATCHES` dizisini düzenle:

```javascript
var WATCHES = [
  {
    id:             "benim-saatim",       // Benzersiz ID (cache için)
    brand:          "ROLEX",              // Marka adı
    model:          "Submariner",         // Model adı
    price:          "₺250.000",           // Fiyat (isteğe bağlı)
    emoji:          "⌚",                 // Galeri placeholder emojisi
    thumb:          "images/rolex.png",   // Galeri küçük resmi (null ise emoji)
    glb:            "models/rolex/watch.glb",
    rotationOffset: { x: 0, y: 0, z: 0 }, // Model yanlış dönükse düzelt (radyan)
    scaleOverride:  1.0                   // Boyut çarpanı (1.0 = varsayılan)
  }
];
```

**rotationOffset kullanımı:**
Modelini deploy edip test ettiğinde saat yan yatıyorsa:
- Yan yatmış (90°): `rotationOffset: { x: Math.PI/2, y: 0, z: 0 }`
- Ters duruyorsa: `rotationOffset: { x: Math.PI, y: 0, z: 0 }`
- Sola/sağa dönmüş: `rotationOffset: { x: 0, y: Math.PI/2, z: 0 }`

### 3. GitHub Pages'e Deploy

```bash
# Repository oluştur
git init
git add .
git commit -m "WristView v2"

# GitHub'a push
git remote add origin https://github.com/KULLANICI/wristview.git
git push -u origin main

# Settings → Pages → Source: main branch → Save
# Adres: https://KULLANICI.github.io/wristview/
```

**Önemli:** GitHub Pages büyük GLB dosyalarını otomatik olarak serve eder.
Ama 50MB+ dosyalar için Git LFS kullanman gerekebilir.

## AR Kalitesini Artırma

### Smoothing Ayarları (app.js → CFG)

```javascript
var CFG = {
  SMOOTH_POS:  0.18,  // Düşür → daha sakin, yükselt → daha hızlı tepki
  SMOOTH_ROT:  0.14,  // Rotasyon smoothing
  SMOOTH_SIZE: 0.20,  // Boyut smoothing
  TILT_X:      0.20,  // Saatin bileğe oturma açısı (radyan)
};
```

### Model Kalite İpuçları

1. **IBL Texture:** Metalik saatler için environment map kritik.
   Three.js'in `RoomEnvironment` kullanılıyor ama kendi HDR'ını ekleyebilirsin:
   ```javascript
   // app.js → initThreeJS() içine ekle
   var loader = new THREE.RGBELoader();
   loader.load('env/studio.hdr', function(texture) {
     var envMap = pmrem.fromEquirectangular(texture).texture;
     three.scene.environment = envMap;
   });
   ```

2. **Normal Maps:** GLB modelinde normal map varsa otomatik kullanılır.
   Blender'da bake et veya Sketchfab'da normal map'li model seç.

3. **Animasyon:** GLB'de animasyon (akrep/yelkovan) varsa:
   ```javascript
   // swapModel() içine ekle
   var mixer = new THREE.AnimationMixer(model);
   gltf.animations.forEach(function(clip) {
     mixer.clipAction(clip).play();
   });
   // renderWatch() içinde: mixer.update(delta);
   ```

## Performans

- Mobil: 30 FPS hedef (SMOOTH_POS düşürülürse daha az CPU)
- Masaüstü: 60 FPS
- İlk yükleme: Three.js (570KB) + MediaPipe (~8MB) — ilk açılışta yavaş, sonraki açılışlarda cache'den gelir

## Lisans

MIT — Ticari kullanım serbesttir.
