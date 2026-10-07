/**
 * APLICACIÓN PRINCIPAL: CARTOGRAFÍA 3D & REGISTROS DE CAMPO
 * Río Ctalamochita (Villa María - Villa Nueva)
 * Three.js + Web Audio API + QGIS DEM Relief
 */

// Estaciones de monitoreo bioacústico
const FIELD_STATIONS = [
    {
        id: "rec_01",
        name: "Balneario Municipal (Villa María)",
        coords: "Lat -32.4082°, Long -63.2415°",
        elevation: "193 m s.n.m.",
        desc: "Rumor constante del río en el lecho arenoso con cantos de Zorzal Colorado y brisa en sauces criollos.",
        audio_type: "river_birds",
        species: ["Zorzal Colorado (Turdus rufiventris)", "Sauce Criollo (Salix humboldtiana)"]
    },
    {
        id: "rec_02",
        name: "Meandro Central & Playas Doradas",
        coords: "Lat -32.4105°, Long -63.2478°",
        elevation: "192 m s.n.m.",
        desc: "Correntada fluvial sobre banco de arena central, viento ribereño y gritos de alerta del Tero Real.",
        audio_type: "water_wind_tero",
        species: ["Tero (Vanellus chilensis)", "Bancos de limo y sedimentos aluviales"]
    },
    {
        id: "rec_03",
        name: "Puente Histórico Alberdi (1918)",
        coords: "Lat -32.4078°, Long -63.2340°",
        elevation: "191 m s.n.m.",
        desc: "Agua canalizada bajo los pilares históricos del puente y colonias de golondrinas ribereñas.",
        audio_type: "bridge_swallows_water",
        species: ["Golondrina Ribereña (Pygochelidon cyanoleuca)", "Pilares históricos de hormigón"]
    },
    {
        id: "rec_04",
        name: "Parque Hipólito Yrigoyen (Villa Nueva)",
        coords: "Lat -32.4135°, Long -63.2460°",
        elevation: "194 m s.n.m.",
        desc: "Monte nativo del espinal cordobés, estridente llamado del Benteveo y chicharras en la copa de árboles.",
        audio_type: "park_cicadas_benteveo",
        species: ["Benteveo (Pitangus sulphuratus)", "Chicharra de la siesta (Cicadidae)", "Algarrobo"]
    },
    {
        id: "rec_05",
        name: "Bañados y Juncales (Villa Nueva)",
        coords: "Lat -32.4168°, Long -63.2382°",
        elevation: "190 m s.n.m.",
        desc: "Humedal ribereño con coro nocturno de sapitos criollos y estridulación de grillos costeros.",
        audio_type: "frogs_crickets_night",
        species: ["Rana Criolla (Leptodactylus latrans)", "Grillos de costa (Gryllus)", "Juncales"]
    },
    {
        id: "rec_06",
        name: "Puente Negro & Bosque en Galería",
        coords: "Lat -32.4120°, Long -63.2590°",
        elevation: "195 m s.n.m.",
        desc: "Cauce caudaloso de entrada a la zona metropolitana, remolinos profundos y rumor vegetal del monte.",
        audio_type: "deep_current_wind",
        species: ["Sauces criollos añejos", "Corriente profunda", "Paseriformes del sotobosque"]
    }
];

class CtalamochitaApp {
    constructor() {
        this.container = document.getElementById('viewport-container');
        this.canvas = document.getElementById('webgl-canvas');
        this.skyOverlay = document.getElementById('sky-overlay');

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Luces
        this.sunLight = null;
        this.hemiLight = null;
        this.ambientLight = null;
        this.moonLight = null;
        this.bridgeLights = [];

        // Objetos 3D
        this.modelGroup = null;
        this.terrainMesh = null;
        this.waterMesh = null;
        this.beacons = [];
        this.starField = null;
        this.rippleMesh = null;

        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;

        // Estado de tiempo
        this.currentHour = 12.0;
        this.isCyclePlaying = false;
        this.cycleSpeed = 1.8; // Horas virtuales por segundo

        // Capas
        this.layerVisibility = {
            terrain: true,
            water: true,
            bridges: true,
            urban: true,
            vegetation: true,
            beacons: true
        };

        this.init();
    }

    init() {
        this.setupThree();
        this.setupLighting();
        this.setupStarField();
        this.setupAudioRipple();
        this.loadModel();
        this.setupEventListeners();
        this.setupOscilloscope();
        this.renderStationsList();
        this.updateTimeOfDay(12.0);

        // Bucle de animación
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupThree() {
        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b1324);
        this.scene.fog = new THREE.FogExp2(0x0b1324, 0.015);

        // Cámara
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 300);
        this.camera.position.set(0, -28, 24);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        // Controles de órbita
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 1.2);
        this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Evitar pasar por debajo del suelo
        this.controls.minDistance = 8;
        this.controls.maxDistance = 65;
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0.4;
    }

    setupLighting() {
        // Luz Hemisférica (Cielo / Terreno)
        this.hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x223820, 0.7);
        this.scene.add(this.hemiLight);

        // Luz Ambiente
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
        this.scene.add(this.ambientLight);

        // Luz Solar Direccional con sombras de relieve
        this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 80;
        const d = 22;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // Luz Lunar (Nocturna)
        this.moonLight = new THREE.DirectionalLight(0x5588cc, 0.0);
        this.moonLight.position.set(-20, 15, 25);
        this.scene.add(this.moonLight);
    }

    setupStarField() {
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1800;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.9); // Solo hemisferio superior
            const r = 140 + Math.random() * 40;

            positions[i] = r * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = r * Math.cos(phi) + 15;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.2,
            transparent: true,
            opacity: 0.0
        });

        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);
    }

    setupAudioRipple() {
        // Aro pulsante de onda sonora 3D cuando se hace clic
        const ringGeo = new THREE.RingGeometry(0.1, 0.25, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00e5a3,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0
        });
        this.rippleMesh = new THREE.Mesh(ringGeo, ringMat);
        this.rippleMesh.visible = false;
        this.scene.add(this.rippleMesh);
        this.rippleAnim = { active: false, scale: 1, maxScale: 4.5, opacity: 1 };
    }

    triggerVisualRipple(pos) {
        if (!this.rippleMesh) return;
        this.rippleMesh.position.copy(pos);
        this.rippleMesh.position.z += 0.08;
        this.rippleMesh.visible = true;
        this.rippleMesh.scale.set(1, 1, 1);
        this.rippleAnim = { active: true, scale: 1, maxScale: 5.5, opacity: 0.95 };
    }

    // =========================================================================
    // CARGA DEL MODELO BLENDER QGIS 3D
    // =========================================================================
    loadModel() {
        const loader = new THREE.GLTFLoader();
        const modelPath = './models/rio_ctalamochita_qgis.glb';

        console.log(`Cargando modelo 3D: ${modelPath}`);
        loader.load(
            modelPath,
            (gltf) => {
                this.modelGroup = gltf.scene;
                this.scene.add(this.modelGroup);
                console.log("✅ Modelo 3D del Río Ctalamochita cargado exitosamente.");

                // Procesar objetos y materiales
                this.modelGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // Terreno DEM: asegurar visualización de colores hipsométricos
                        if (child.name.includes("Terrain") || child.name.includes("Terreno")) {
                            this.terrainMesh = child;
                            if (child.material) {
                                child.material.vertexColors = true;
                                child.material.needsUpdate = true;
                            }
                        }

                        // Lámina de Agua: brillo especular y semitransparencia
                        if (child.name.includes("Agua") || child.name.includes("Water")) {
                            this.waterMesh = child;
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x187795,
                                roughness: 0.12,
                                metalness: 0.25,
                                transparent: true,
                                opacity: 0.88,
                                envMapIntensity: 1.4
                            });
                        }

                        // Balizas sonoras
                        if (child.name.startsWith("Beacon_") || child.name.startsWith("Hito_")) {
                            child.userData.isBeacon = true;
                            this.beacons.push(child);
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0xffbe3b,
                                emissive: 0xff8c00,
                                emissiveIntensity: 0.65,
                                roughness: 0.2
                            });
                        }

                        // Puentes
                        if (child.name.includes("Puente")) {
                            child.userData.isBridge = true;
                        }

                        // Vegetación
                        if (child.name.includes("Vegetacion") || child.name.includes("Sauces")) {
                            child.userData.isVegetation = true;
                        }

                        // Tramas urbanas
                        if (child.name.includes("Urbano")) {
                            child.userData.isUrban = true;
                        }
                    }
                });

                // Ocultar pantalla de carga si existiera
                const loaderEl = document.getElementById('loading-overlay');
                if (loaderEl) loaderEl.style.display = 'none';
            },
            (xhr) => {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                console.log(`Cargando modelo: ${percent}%`);
            },
            (error) => {
                console.error("Error al cargar modelo 3D GLB:", error);
            }
        );
    }

    // =========================================================================
    // CONTROL DEL TIEMPO Y CICLO SOLAR (SLIDER)
    // =========================================================================
    updateTimeOfDay(hour) {
        this.currentHour = hour;

        // Actualizar UI
        const hourInt = Math.floor(hour);
        const mins = Math.floor((hour - hourInt) * 60);
        const timeStr = `${hourInt.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} hs`;
        
        const displayEl = document.getElementById('time-display');
        if (displayEl) displayEl.textContent = timeStr;

        const phaseEl = document.getElementById('phase-tag');
        const iconEl = document.getElementById('time-icon');

        // Determinar fase del día
        let phaseName = "";
        let icon = "☀️";

        // Cálculo de posición solar en el cielo
        // El sol sale por el Este (+X), alcanza el cenit al mediodía (12h) y se pone por el Oeste (-X)
        const dayProgress = (hour - 6.0) / 12.0; // 0 a las 06:00, 1 a las 18:00
        const sunAngle = dayProgress * Math.PI;

        const sunX = Math.cos(sunAngle) * 32;
        const sunY = -8 + Math.sin(sunAngle) * 4;
        const sunZ = Math.sin(sunAngle) * 36;

        this.sunLight.position.set(sunX, sunY, Math.max(sunZ, -10));

        // Parámetros de color e intensidad según la hora
        if (hour >= 5.5 && hour < 7.2) {
            // Amanecer / Alba
            phaseName = "Amanecer / Alba";
            icon = "🌅";
            const t = (hour - 5.5) / 1.7;
            this.sunLight.color.setRGB(1.0, 0.65 + 0.2 * t, 0.45 + 0.3 * t);
            this.sunLight.intensity = 0.4 + 0.8 * t;
            this.hemiLight.color.setRGB(0.9, 0.7, 0.6);
            this.hemiLight.groundColor.setRGB(0.2, 0.25, 0.15);
            this.hemiLight.intensity = 0.5 + 0.3 * t;
            this.scene.background.setRGB(0.12 + 0.1 * t, 0.14 + 0.2 * t, 0.25 + 0.25 * t);
            this.scene.fog.color.setRGB(0.15, 0.16, 0.28);
            if (this.skyOverlay) {
                this.skyOverlay.style.background = 'radial-gradient(ellipse at 50% 100%, rgba(255,126,95,0.4) 0%, rgba(13,20,36,0.8) 70%)';
            }
            if (this.starField) this.starField.material.opacity = Math.max(0, 0.8 - t * 0.9);
            this.moonLight.intensity = 0.0;
        } else if (hour >= 7.2 && hour < 17.0) {
            // Mediodía y luz diurna plena
            phaseName = (hour >= 11.5 && hour <= 14.5) ? "Mediodía Solar" : "Luz Diurna";
            icon = "☀️";
            this.sunLight.color.setRGB(1.0, 0.97, 0.92);
            this.sunLight.intensity = 1.45;
            this.hemiLight.color.setRGB(0.85, 0.94, 1.0);
            this.hemiLight.groundColor.setRGB(0.25, 0.38, 0.22);
            this.hemiLight.intensity = 0.85;
            this.scene.background.setRGB(0.25, 0.45, 0.68);
            this.scene.fog.color.setRGB(0.25, 0.45, 0.68);
            if (this.skyOverlay) {
                this.skyOverlay.style.background = 'radial-gradient(ellipse at 50% 20%, rgba(0,198,255,0.18) 0%, transparent 70%)';
            }
            if (this.starField) this.starField.material.opacity = 0.0;
            this.moonLight.intensity = 0.0;
        } else if (hour >= 17.0 && hour < 19.8) {
            // Tarde Dorada y Puesta de Sol (Golden Hour)
            phaseName = (hour >= 18.3) ? "Ocaso / Hora Dorada" : "Atardecer";
            icon = "🌇";
            const t = (hour - 17.0) / 2.8;
            this.sunLight.color.setRGB(1.0, 0.72 - 0.35 * t, 0.32 - 0.2 * t);
            this.sunLight.intensity = 1.35 - 0.5 * t;
            this.hemiLight.color.setRGB(0.95 - 0.3 * t, 0.6 - 0.3 * t, 0.45);
            this.hemiLight.groundColor.setRGB(0.25 - 0.1 * t, 0.2, 0.15);
            this.hemiLight.intensity = 0.75 - 0.3 * t;
            this.scene.background.setRGB(0.35 - 0.25 * t, 0.22 - 0.15 * t, 0.35 - 0.15 * t);
            this.scene.fog.color.setRGB(0.32, 0.20, 0.30);
            if (this.skyOverlay) {
                this.skyOverlay.style.background = 'radial-gradient(ellipse at 50% 100%, rgba(250,112,154,0.45) 0%, rgba(254,225,64,0.2) 40%, rgba(13,20,36,0.85) 80%)';
            }
            if (this.starField) this.starField.material.opacity = t * 0.4;
            this.moonLight.intensity = 0.05 * t;
        } else {
            // Noche Estrellada (20:00 a 05:30)
            phaseName = (hour >= 23 || hour < 4) ? "Noche Cerrada" : "Madrugada";
            icon = "🌙";
            this.sunLight.intensity = 0.0;
            this.hemiLight.color.setRGB(0.08, 0.12, 0.22);
            this.hemiLight.groundColor.setRGB(0.04, 0.06, 0.09);
            this.hemiLight.intensity = 0.35;
            this.moonLight.intensity = 0.38;
            this.moonLight.color.setRGB(0.45, 0.65, 0.95);
            this.scene.background.setRGB(0.04, 0.06, 0.12);
            this.scene.fog.color.setRGB(0.04, 0.06, 0.12);
            if (this.skyOverlay) {
                this.skyOverlay.style.background = 'radial-gradient(ellipse at 50% 10%, rgba(108,92,231,0.25) 0%, rgba(5,8,17,0.92) 80%)';
            }
            if (this.starField) this.starField.material.opacity = 0.95;
        }

        if (phaseEl) phaseEl.textContent = phaseName;
        if (iconEl) iconEl.textContent = icon;

        // Actualizar balance bioacústico en el motor de audio
        if (window.ctalamochitaAudio) {
            window.ctalamochitaAudio.updateTimeOfDay(hour);
        }
    }

    // =========================================================================
    // INTERACTIVIDAD Y RAYCASTING (CLIC EN EL MODELO 3D)
    // =========================================================================
    setupEventListeners() {
        // Redimensionamiento
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Movimiento de mouse (Hover & Coordenadas)
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.checkHover();
        });

        // Clic en el modelo 3D -> Dispara sonidos de registros de campo
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            if (!this.modelGroup) return;

            const intersects = this.raycaster.intersectObjects(this.modelGroup.children, true);
            if (intersects.length > 0) {
                const hit = intersects[0];
                const hitPoint = hit.point;
                const hitObj = hit.object;

                // Generar onda visual 3D
                this.triggerVisualRipple(hitPoint);

                // Comprobar si se cliqueó en una baliza de sonido específica
                if (hitObj.userData.isBeacon || hitObj.name.startsWith("Beacon_") || hitObj.name.startsWith("Hito_")) {
                    const beaconIndex = this.beacons.indexOf(hitObj);
                    const stationData = FIELD_STATIONS[beaconIndex % FIELD_STATIONS.length];
                    if (window.ctalamochitaAudio && stationData) {
                        window.ctalamochitaAudio.triggerFieldRecording(stationData);
                        this.showCard(stationData);
                    }
                } else {
                    // Clic general sobre el río o territorio -> Calcular bioacústica geográfica
                    if (window.ctalamochitaAudio) {
                        window.ctalamochitaAudio.triggerCoordinatesSound(hitPoint);
                    }
                }
            }
        });

        // Slider de hora del día
        const slider = document.getElementById('time-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.updateTimeOfDay(val);
                this.removeActivePresets();
            });
        }

        // Presets rápidos de tiempo
        document.querySelectorAll('.preset-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const h = parseFloat(btn.dataset.hour);
                if (slider) slider.value = h;
                this.updateTimeOfDay(h);
                this.removeActivePresets();
                btn.classList.add('active');
            });
        });

        // Botón reproducir ciclo 24h
        const playCycleBtn = document.getElementById('btn-play-cycle');
        if (playCycleBtn) {
            playCycleBtn.addEventListener('click', () => {
                this.isCyclePlaying = !this.isCyclePlaying;
                playCycleBtn.textContent = this.isCyclePlaying ? '⏸️ Pausar Ciclo' : '▶️ Ciclo 24h';
                playCycleBtn.classList.toggle('active', this.isCyclePlaying);
            });
        }

        // Botón maestro de audio ambiental
        const audioMasterBtn = document.getElementById('btn-audio-master');
        if (audioMasterBtn) {
            audioMasterBtn.addEventListener('click', () => {
                const isActive = audioMasterBtn.classList.toggle('active');
                if (window.ctalamochitaAudio) {
                    window.ctalamochitaAudio.toggleAmbientSound(isActive);
                }
                audioMasterBtn.innerHTML = isActive 
                    ? '<span>🔊</span> Paisaje Fluvial Activo'
                    : '<span>🔈</span> Activar Paisaje Sonoro';
            });
        }

        // Toggles de capas QGIS
        this.setupLayerToggles();

        // Botones de cámara
        this.setupCameraPresets();

        // Callback cuando el motor de audio empieza un registro
        if (window.ctalamochitaAudio) {
            window.ctalamochitaAudio.onRecordingStart = (rec) => {
                this.showCard(rec);
            };
        }

        // Cerrar tarjeta flotante
        const closeCardBtn = document.getElementById('btn-card-close');
        if (closeCardBtn) {
            closeCardBtn.addEventListener('click', () => {
                const card = document.getElementById('click-audio-card');
                if (card) card.classList.remove('visible');
            });
        }
    }

    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        if (!this.modelGroup) return;

        const intersects = this.raycaster.intersectObjects(this.modelGroup.children, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            const pt = hit.point;

            // Actualizar HUD de coordenadas en tiempo real
            const lat = (-32.4080 - (pt.y / 22) * 0.02).toFixed(4);
            const lng = (-63.2420 + (pt.x / 28) * 0.03).toFixed(4);
            const cota = Math.round(190 + Math.max(0, pt.z) * 3.5);

            const coordsHud = document.getElementById('hud-coords');
            if (coordsHud) {
                coordsHud.innerHTML = `Coord: <strong>${lat}°S, ${lng}°W</strong> (Cota <strong>${cota}m</strong> s.n.m.)`;
            }

            // Cambiar cursor si está sobre una baliza
            if (hit.object.userData.isBeacon || hit.object.name.startsWith("Beacon_") || hit.object.name.startsWith("Hito_")) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        }
    }

    setupLayerToggles() {
        const bindToggle = (id, prop, filterFn) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.layerVisibility[prop] = e.target.checked;
                    if (this.modelGroup) {
                        this.modelGroup.traverse((child) => {
                            if (filterFn(child)) {
                                child.visible = e.target.checked;
                            }
                        });
                    }
                });
            }
        };

        bindToggle('layer-terrain', 'terrain', c => c.name.includes("Terrain") || c.name.includes("Terreno"));
        bindToggle('layer-water', 'water', c => c.name.includes("Agua") || c.name.includes("Water"));
        bindToggle('layer-bridges', 'bridges', c => c.userData.isBridge || c.name.includes("Puente"));
        bindToggle('layer-urban', 'urban', c => c.userData.isUrban || c.name.includes("Urbano"));
        bindToggle('layer-vegetation', 'vegetation', c => c.userData.isVegetation || c.name.includes("Vegetacion"));
        bindToggle('layer-beacons', 'beacons', c => c.userData.isBeacon || c.name.startsWith("Beacon_") || c.name.startsWith("Hito_"));
    }

    setupCameraPresets() {
        const presets = {
            'cam-overview': { pos: [0, -28, 24], target: [0, 0, 1.2] },
            'cam-river': { pos: [-2, -12, 6], target: [0, 0, 0.8] },
            'cam-alberdi': { pos: [4.5, -4, 4.5], target: [3.8, 1.5, 1.0] },
            'cam-top': { pos: [0, 0.01, 38], target: [0, 0, 0] }
        };

        Object.keys(presets).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    const cfg = presets[btnId];
                    gsapAnimateCamera(this.camera, this.controls, cfg.pos, cfg.target);
                });
            }
        });
    }

    removeActivePresets() {
        document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    }

    showCard(recData) {
        const card = document.getElementById('click-audio-card');
        if (!card) return;

        const titleEl = document.getElementById('card-title');
        const descEl = document.getElementById('card-desc');
        const coordsEl = document.getElementById('card-coords');

        if (titleEl) titleEl.textContent = recData.name;
        if (descEl) descEl.textContent = recData.desc;
        if (coordsEl) coordsEl.textContent = recData.coords || "Sector fluvial relevado";

        card.classList.add('visible');

        // Botón reproducir de la tarjeta
        const playBtn = document.getElementById('btn-card-replay');
        if (playBtn) {
            playBtn.onclick = () => {
                if (window.ctalamochitaAudio) {
                    window.ctalamochitaAudio.triggerFieldRecording(recData);
                }
            };
        }
    }

    renderStationsList() {
        const container = document.getElementById('field-stations-list');
        if (!container) return;

        container.innerHTML = '';
        FIELD_STATIONS.forEach((st, idx) => {
            const item = document.createElement('div');
            item.className = 'station-item';
            item.innerHTML = `
                <div class="station-info">
                    <span class="station-title">#0${idx + 1} ${st.name}</span>
                    <span class="station-meta">${st.coords} • ${st.elevation}</span>
                </div>
                <button class="station-play-btn" title="Escuchar registro">▶</button>
            `;

            item.addEventListener('click', () => {
                if (window.ctalamochitaAudio) {
                    window.ctalamochitaAudio.triggerFieldRecording(st);
                    this.showCard(st);
                }
                // Centrar cámara suavemente hacia el hito
                if (this.beacons[idx]) {
                    const bPos = this.beacons[idx].position;
                    // enfocar
                }
            });

            container.appendChild(item);
        });
    }

    setupOscilloscope() {
        const canvas = document.getElementById('oscilloscope-canvas');
        if (!canvas) return;
        const ctx2d = canvas.getContext('2d');

        const draw = () => {
            requestAnimationFrame(draw);
            const w = canvas.width;
            const h = canvas.height;

            ctx2d.fillStyle = '#06090e';
            ctx2d.fillRect(0, 0, w, h);

            if (!window.ctalamochitaAudio || !window.ctalamochitaAudio.analyser) {
                // Línea base estática sutil
                ctx2d.strokeStyle = 'rgba(0, 229, 163, 0.25)';
                ctx2d.beginPath();
                ctx2d.moveTo(0, h / 2);
                ctx2d.lineTo(w, h / 2);
                ctx2d.stroke();
                return;
            }

            const data = window.ctalamochitaAudio.getByteTimeDomainData();
            if (!data) return;

            ctx2d.lineWidth = 1.5;
            ctx2d.strokeStyle = '#00e5a3';
            ctx2d.beginPath();

            const sliceWidth = w * 1.0 / data.length;
            let x = 0;

            for (let i = 0; i < data.length; i++) {
                const v = data[i] / 128.0;
                const y = v * h / 2;

                if (i === 0) {
                    ctx2d.moveTo(x, y);
                } else {
                    ctx2d.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx2d.lineTo(w, h / 2);
            ctx2d.stroke();
        };

        draw();
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Ciclo solar automático si está activo
        if (this.isCyclePlaying) {
            this.currentHour += (this.cycleSpeed / 60);
            if (this.currentHour >= 24) this.currentHour = 0;
            const slider = document.getElementById('time-slider');
            if (slider) slider.value = this.currentHour;
            this.updateTimeOfDay(this.currentHour);
        }

        // Animación de balizas flotantes (pulsación en Z)
        const t = performance.now() * 0.003;
        this.beacons.forEach((b, i) => {
            b.position.z += Math.sin(t + i * 1.2) * 0.003;
        });

        // Animación del aro de onda sonora 3D
        if (this.rippleAnim.active && this.rippleMesh) {
            this.rippleAnim.scale += 0.08;
            this.rippleAnim.opacity -= 0.016;
            this.rippleMesh.scale.set(this.rippleAnim.scale, this.rippleAnim.scale, 1);
            this.rippleMesh.material.opacity = Math.max(0, this.rippleAnim.opacity);

            if (this.rippleAnim.opacity <= 0) {
                this.rippleAnim.active = false;
                this.rippleMesh.visible = false;
            }
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Suavizado cinemático de cámara
function gsapAnimateCamera(camera, controls, targetPos, targetLookAt) {
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...targetPos);
    const startTarget = controls.target.clone();
    const endTarget = new THREE.Vector3(...targetLookAt);

    let progress = 0;
    const duration = 1200; // ms
    const startTime = performance.now();

    function step() {
        const now = performance.now();
        progress = Math.min((now - startTime) / duration, 1);
        // Easing cúbico
        const ease = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        controls.update();

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    window.app = new CtalamochitaApp();
});
