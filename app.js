// ============================================
// SANAL SAAT DENEME - ANA UYGULAMA
// ============================================

class WatchTryOn {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        this.loading = document.getElementById('loading');
        this.watchScale = 1.0;
        this.watchImage = new Image();
        this.isReady = false;

        this.init();
    }

    async init() {
        // Saat görselini yükle (Demo için 2D görsel kullanıyoruz)
        await this.loadWatchImage();

        // MediaPipe Hands başlat
        this.setupMediaPipe();

        // Kamerayı başlat
        await this.setupCamera();

        // Kontrolleri ayarla
        this.setupControls();
    }

    loadWatchImage() {
        return new Promise((resolve) => {
            // Demo için basit bir saat görseli kullanacağız
            // Gerçek projede 3D model veya PNG kullanılır
            this.watchImage.onload = () => resolve();
            this.watchImage.src = this.createWatchSVG();
        });
    }

    // Demo için SVG ile saat oluşturuyoruz (ücretsiz!)
    createWatchSVG() {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
            <!-- Kordon üst -->
            <rect x="65" y="0" width="70" height="100" rx="5"
                  fill="#8B4513" stroke="#5C2E00" stroke-width="2"/>
            <rect x="70" y="5" width="60" height="90" rx="3"
                  fill="#A0522D"/>

            <!-- Saat kasası -->
            <circle cx="100" cy="150" r="60"
                    fill="#FFD700" stroke="#B8860B" stroke-width="4"/>
            <circle cx="100" cy="150" r="52"
                    fill="#FFFEF0" stroke="#DAA520" stroke-width="2"/>

            <!-- Saat rakamları -->
            <text x="100" y="112" text-anchor="middle" font-size="12"
                  font-weight="bold" fill="#333">12</text>
            <text x="140" y="154" text-anchor="middle" font-size="12"
                  font-weight="bold" fill="#333">3</text>
            <text x="100" y="196" text-anchor="middle" font-size="12"
                  font-weight="bold" fill="#333">6</text>
            <text x="60" y="154" text-anchor="middle" font-size="12"
                  font-weight="bold" fill="#333">9</text>

            <!-- Akrep ve yelkovan -->
            <line x1="100" y1="150" x2="100" y2="118"
                  stroke="#333" stroke-width="3" stroke-linecap="round"/>
            <line x1="100" y1="150" x2="125" y2="140"
                  stroke="#333" stroke-width="2" stroke-linecap="round"/>
            <line x1="100" y1="150" x2="90" y2="125"
                  stroke="#FF0000" stroke-width="1" stroke-linecap="round"/>
            <circle cx="100" cy="150" r="3" fill="#333"/>

            <!-- Marka yazısı -->
            <text x="100" y="135" text-anchor="middle" font-size="8"
                  fill="#B8860B" font-style="italic">LUXURY</text>

            <!-- Taç (kurma) -->
            <rect x="156" y="145" width="12" height="10" rx="2"
                  fill="#FFD700" stroke="#B8860B" stroke-width="1"/>

            <!-- Kordon alt -->
            <rect x="65" y="200" width="70" height="100" rx="5"
                  fill="#8B4513" stroke="#5C2E00" stroke-width="2"/>
            <rect x="70" y="205" width="60" height="90" rx="3"
                  fill="#A0522D"/>

            <!-- Kordon delikleri -->
            <ellipse cx="100" cy="230" rx="4" ry="3" fill="#5C2E00"/>
            <ellipse cx="100" cy="245" rx="4" ry="3" fill="#5C2E00"/>
            <ellipse cx="100" cy="260" rx="4" ry="3" fill="#5C2E00"/>
            <ellipse cx="100" cy="275" rx="4" ry="3" fill="#5C2E00"/>
        </svg>`;

        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    setupMediaPipe() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onResults(results));
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            this.video.srcObject = stream;

            this.video.onloadedmetadata = () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.loading.classList.add('hidden');
                this.isReady = true;
                this.detectFrame();
            };
        } catch (err) {
            console.error('Kamera erişimi reddedildi:', err);
            this.loading.innerHTML = '<p>❌ Kamera erişimi gerekli!<br>Lütfen izin verin.</p>';
        }
    }

    async detectFrame() {
        if (!this.isReady) return;

        await this.hands.send({ image: this.video });
        requestAnimationFrame(() => this.detectFrame());
    }

    onResults(results) {
        // Canvas'ı temizle
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            // Bilek noktası (landmark 0 = bilek)
            const wrist = landmarks[0];

            // Bilek genişliğini hesapla (landmark 5 ve 17 arası)
            const point5 = landmarks[5];   // İşaret parmağı tabanı
            const point17 = landmarks[17]; // Serçe parmak tabanı

            // Bilek pozisyonu (piksel cinsinden)
            const wristX = wrist.x * this.canvas.width;
            const wristY = wrist.y * this.canvas.height;

            // El genişliği (saat boyutunu buna göre ayarlayacağız)
            const handWidth = Math.sqrt(
                Math.pow((point5.x - point17.x) * this.canvas.width, 2) +
                Math.pow((point5.y - point17.y) * this.canvas.height, 2)
            );

            // Saat boyutu
            const watchSize = handWidth * 1.5 * this.watchScale;

            // Bileğin açısını hesapla
            const middleFinger = landmarks[9];
            const angle = Math.atan2(
                (middleFinger.y - wrist.y) * this.canvas.height,
                (middleFinger.x - wrist.x) * this.canvas.width
            );

            // Saati çiz
            this.drawWatch(wristX, wristY, watchSize, angle);

            // El iskeletini çiz (opsiyonel - debug için)
            // this.drawHandSkeleton(landmarks);
        }
    }

    drawWatch(x, y, size, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle - Math.PI / 2);

        // Gölge efekti
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowOffsetX = 5;
        this.ctx.shadowOffsetY = 5;

        // Saati çiz
        const watchWidth = size;
        const watchHeight = size * 1.5;

        this.ctx.drawImage(
            this.watchImage,
            -watchWidth / 2,
            -watchHeight / 2,
            watchWidth,
            watchHeight
        );

        this.ctx.restore();
    }

    setupControls() {
        // Büyüt / Küçült
        document.getElementById('size-up').addEventListener('click', () => {
            this.watchScale = Math.min(this.watchScale + 0.1, 2.0);
        });

        document.getElementById('size-down').addEventListener('click', () => {
            this.watchScale = Math.max(this.watchScale - 0.1, 0.5);
        });

        // Fotoğraf çek
        document.getElementById('capture-btn').addEventListener('click', () => {
            this.capturePhoto();
        });
    }

    capturePhoto() {
        // Kamera + saat overlay birleştir
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = this.canvas.width;
        captureCanvas.height = this.canvas.height;
        const captureCtx = captureCanvas.getContext('2d');

        // Ayna efekti ile video
        captureCtx.save();
        captureCtx.scale(-1, 1);
        captureCtx.drawImage(this.video, -captureCanvas.width, 0,
                            captureCanvas.width, captureCanvas.height);
        captureCtx.restore();

        // Saat overlay
        captureCtx.save();
        captureCtx.scale(-1, 1);
        captureCtx.drawImage(this.canvas, -captureCanvas.width, 0,
                            captureCanvas.width, captureCanvas.height);
        captureCtx.restore();

        // Watermark
        captureCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        captureCtx.font = '16px Arial';
        captureCtx.fillText('⌚ Sanal Saat Deneme - Demo', 10, 30);

        // İndir
        const link = document.createElement('a');
        link.download = 'saat-deneme.png';
        link.href = captureCanvas.toDataURL('image/png');
        link.click();

        // Geri bildirim
        document.getElementById('capture-btn').textContent = '✅ Kaydedildi!';
        setTimeout(() => {
            document.getElementById('capture-btn').textContent = '📸 Fotoğraf Çek';
        }, 2000);
    }
}

// Uygulamayı başlat
window.addEventListener('load', () => {
    new WatchTryOn();
});