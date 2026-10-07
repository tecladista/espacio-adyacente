/**
 * MOTOR DE AUDIO BIOACÚSTICO Y PAISAJES SONOROS DEL RÍO CTALAMOCHITA
 * Generador procedural de registros de campo para Villa María y Villa Nueva
 * Implementado sobre Web Audio API (100% nativo, offline y reactivo)
 */

class CtalamochitaAudioEngine {
    constructor() {
        this.ctx = null;
        this.isInitialized = false;
        this.masterGain = null;
        this.ambientGain = null;
        this.spotGain = null;
        this.analyser = null;

        // Capas sonoras activas
        this.waterNode = null;
        this.windNode = null;
        this.cricketNode = null;
        this.cicadaNode = null;
        this.birdInterval = null;
        this.frogInterval = null;

        this.currentHour = 12.0; // 0 a 24
        this.isPlayingAmbient = false;
        this.activeRecording = null;

        // Callbacks para la interfaz
        this.onRecordingStart = null;
        this.onRecordingStop = null;
    }

    init() {
        if (this.isInitialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Cadena principal de audio
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
        this.ambientGain.connect(this.masterGain);

        this.spotGain = this.ctx.createGain();
        this.spotGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.spotGain.connect(this.masterGain);

        // Analizador de espectro para visualizador osciloscópico QGIS
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.isInitialized = true;
        console.log("🔊 Motor de Audio del Río Ctalamochita inicializado con éxito.");
    }

    resumeContext() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            return this.ctx.resume();
        }
        return Promise.resolve();
    }

    // =========================================================================
    // GENERADORES DE RUIDO Y TEXTURAS FLUVIALES
    // =========================================================================
    createNoiseBuffer(type = 'pink') {
        const bufferSize = this.ctx.sampleRate * 4; // 4 segundos de bucle
        const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
            const whiteL = Math.random() * 2 - 1;
            const whiteR = Math.random() * 2 - 1;

            if (type === 'pink') {
                // Paul Kellet's filter method
                b0 = 0.99886 * b0 + whiteL * 0.0555179;
                b1 = 0.99332 * b1 + whiteL * 0.0750759;
                b2 = 0.96900 * b2 + whiteL * 0.1538520;
                b3 = 0.86650 * b3 + whiteL * 0.3104856;
                b4 = 0.55000 * b4 + whiteL * 0.5329522;
                b5 = -0.7616 * b5 - whiteL * 0.0168980;
                left[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteL * 0.5362) * 0.11;
                b6 = whiteL * 0.115926;

                // Canal derecho estéreo
                right[i] = (left[i] * 0.7) + (whiteR * 0.04);
            } else if (type === 'brown') {
                // Brown noise: integración para sonido de agua profunda y remolinos
                left[i] = (lastOut + (0.02 * whiteL)) / 1.02;
                lastOut = left[i];
                right[i] = lastOut + (whiteR * 0.01);
            } else {
                left[i] = whiteL * 0.1;
                right[i] = whiteR * 0.1;
            }
        }
        return buffer;
    }

    // =========================================================================
    // AGUA Y CORRENTADA DEL RÍO CTALAMOCHITA
    // =========================================================================
    startRiverSound(gainNode = this.ambientGain) {
        if (this.waterNode) return;

        const noiseBuf = this.createNoiseBuffer('pink');
        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuf;
        source.loop = true;

        // Filtro pasabanda para el cuerpo del agua
        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(480, this.ctx.currentTime);
        bandpass.Q.setValueAtTime(1.2, this.ctx.currentTime);

        // Filtro pasaaltos para el chisporroteo de la corriente y arena
        const highs = this.ctx.createBiquadFilter();
        highs.type = 'highpass';
        highs.frequency.setValueAtTime(1200, this.ctx.currentTime);

        // LFO de modulación para simular oleaje y fluctuación de corriente
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.25, this.ctx.currentTime); // Oleaje cada 4s
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(160, this.ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(bandpass.frequency);

        const riverGain = this.ctx.createGain();
        riverGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

        source.connect(bandpass);
        bandpass.connect(riverGain);
        source.connect(highs);
        highs.connect(riverGain);

        riverGain.connect(gainNode);

        source.start();
        lfo.start();

        this.waterNode = { source, lfo, riverGain, bandpass };
    }

    stopRiverSound() {
        if (this.waterNode) {
            try {
                this.waterNode.source.stop();
                this.waterNode.lfo.stop();
            } catch (e) {}
            this.waterNode = null;
        }
    }

    // =========================================================================
    // VIENTO EN LOS SAUCES CRIOLLOS
    // =========================================================================
    startWindSound(gainNode = this.ambientGain) {
        if (this.windNode) return;

        const noiseBuf = this.createNoiseBuffer('pink');
        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuf;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, this.ctx.currentTime);
        filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

        const lfo = this.ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(220, this.ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        const windGain = this.ctx.createGain();
        windGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

        source.connect(filter);
        filter.connect(windGain);
        windGain.connect(gainNode);

        source.start();
        lfo.start();

        this.windNode = { source, lfo, windGain };
    }

    stopWindSound() {
        if (this.windNode) {
            try {
                this.windNode.source.stop();
                this.windNode.lfo.stop();
            } catch (e) {}
            this.windNode = null;
        }
    }

    // =========================================================================
    // GRILLOS Y CHICHARRAS (NOCTURNOS / HORA DE LA SIESTA)
    // =========================================================================
    startCrickets(gainNode = this.ambientGain) {
        if (this.cricketNode) return;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4600, this.ctx.currentTime);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(4850, this.ctx.currentTime);

        // Modulador AM para estridulación de grillos (pulsos rápidos a 32Hz)
        const amLfo = this.ctx.createOscillator();
        amLfo.frequency.setValueAtTime(32, this.ctx.currentTime);

        const amGain = this.ctx.createGain();
        amGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        amLfo.connect(amGain.gain);

        const cGain = this.ctx.createGain();
        cGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // Controlado según la hora

        osc.connect(amGain);
        osc2.connect(amGain);
        amGain.connect(cGain);
        cGain.connect(gainNode);

        osc.start();
        osc2.start();
        amLfo.start();

        this.cricketNode = { osc, osc2, amLfo, cGain };
    }

    stopCrickets() {
        if (this.cricketNode) {
            try {
                this.cricketNode.osc.stop();
                this.cricketNode.osc2.stop();
                this.cricketNode.amLfo.stop();
            } catch (e) {}
            this.cricketNode = null;
        }
    }

    // Chicharras del verano en la siesta cordobesa (11:00 a 16:30)
    startCicadas(gainNode = this.ambientGain) {
        if (this.cicadaNode) return;

        const noiseBuf = this.createNoiseBuffer('white');
        const src = this.ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(6200, this.ctx.currentTime);
        bp.Q.setValueAtTime(6.0, this.ctx.currentTime);

        // Pulso de chicharra
        const mod = this.ctx.createOscillator();
        mod.frequency.setValueAtTime(70, this.ctx.currentTime);
        const modGain = this.ctx.createGain();
        modGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        mod.connect(modGain.gain);

        const cicGain = this.ctx.createGain();
        cicGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        src.connect(bp);
        bp.connect(modGain);
        modGain.connect(cicGain);
        cicGain.connect(gainNode);

        src.start();
        mod.start();

        this.cicadaNode = { src, mod, cicGain };
    }

    stopCicadas() {
        if (this.cicadaNode) {
            try {
                this.cicadaNode.src.stop();
                this.cicadaNode.mod.stop();
            } catch (e) {}
            this.cicadaNode = null;
        }
    }

    // =========================================================================
    // SINTETIZADOR DE AVES AUTÓCTONAS DEL CTALAMOCHITA
    // =========================================================================
    // 1. ZORZAL COLORADO (Turdus rufiventris)
    playZorzal(targetGain = this.spotGain) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [
            { f: 2150, d: 0.14, pause: 0.06 },
            { f: 2480, d: 0.22, pause: 0.08 },
            { f: 2900, d: 0.18, pause: 0.05 },
            { f: 2350, d: 0.32, pause: 0.12 },
            { f: 2600, d: 0.25, pause: 0.00 }
        ];

        let offset = now;
        notes.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';

            // Vibrato sutil
            const vib = this.ctx.createOscillator();
            vib.frequency.setValueAtTime(9.0, offset);
            const vibGain = this.ctx.createGain();
            vibGain.gain.setValueAtTime(25, offset);
            vib.connect(osc.frequency);

            osc.frequency.setValueAtTime(n.f, offset);
            osc.frequency.exponentialRampToValueAtTime(n.f * 1.1, offset + n.d * 0.7);
            osc.frequency.exponentialRampToValueAtTime(n.f * 0.95, offset + n.d);

            gain.gain.setValueAtTime(0.0001, offset);
            gain.gain.exponentialRampToValueAtTime(0.22, offset + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, offset + n.d);

            osc.connect(gain);
            gain.connect(targetGain);

            osc.start(offset);
            vib.start(offset);
            osc.stop(offset + n.d);
            vib.stop(offset + n.d);

            offset += n.d + n.pause;
        });
    }

    // 2. BENTEVEO / BICHO FEO (Pitangus sulphuratus)
    // Canto característico trifónico: ¡Bi-cho-feeee-o!
    playBenteveo(targetGain = this.spotGain) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2600, now);
        filter.Q.setValueAtTime(3.5, now);

        // Triada de tono
        osc.frequency.setValueAtTime(2200, now);
        osc.frequency.linearRampToValueAtTime(2850, now + 0.09); // ¡Bi-
        osc.frequency.linearRampToValueAtTime(2100, now + 0.16); // -cho-
        osc.frequency.linearRampToValueAtTime(3100, now + 0.28); // -feeee-
        osc.frequency.exponentialRampToValueAtTime(1700, now + 0.52); // -o!

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 0.16);
        gain.gain.linearRampToValueAtTime(0.40, now + 0.26);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(targetGain);

        osc.start(now);
        osc.stop(now + 0.56);
    }

    // 3. TERO TERU-TERU (Vanellus chilensis)
    // Alarma estridente de banco arenoso
    playTero(targetGain = this.spotGain) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const calls = [0, 0.22, 0.50];

        calls.forEach(timeOffset => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';

            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(3100, now + timeOffset);
            bp.Q.setValueAtTime(4.0, now + timeOffset);

            osc.frequency.setValueAtTime(2600, now + timeOffset);
            osc.frequency.exponentialRampToValueAtTime(3600, now + timeOffset + 0.07);
            osc.frequency.exponentialRampToValueAtTime(2400, now + timeOffset + 0.15);

            gain.gain.setValueAtTime(0.001, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.28, now + timeOffset + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.16);

            osc.connect(bp);
            bp.connect(gain);
            gain.connect(targetGain);

            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.17);
        });
    }

    // 4. RANAS Y SAPITOS DE BAÑADO (Leptodactylus / Bañados de Villa Nueva)
    playFrogs(targetGain = this.spotGain) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const croaks = [0, 0.18, 0.42, 0.65];

        croaks.forEach((t, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';

            const baseFreq = 220 + (i % 2) * 50;
            osc.frequency.setValueAtTime(baseFreq, now + t);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + t + 0.12);

            gain.gain.setValueAtTime(0.0001, now + t);
            gain.gain.exponentialRampToValueAtTime(0.3, now + t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.13);

            osc.connect(gain);
            gain.connect(targetGain);

            osc.start(now + t);
            osc.stop(now + t + 0.14);
        });
    }

    // 5. GOLONDRINAS RIBEREÑAS DEL PUENTE ALBERDI
    playSwallows(targetGain = this.spotGain) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 4; i++) {
            const t = now + i * 0.16;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';

            osc.frequency.setValueAtTime(3800 + Math.random() * 800, t);
            osc.frequency.exponentialRampToValueAtTime(5200, t + 0.05);
            osc.frequency.exponentialRampToValueAtTime(3200, t + 0.11);

            gain.gain.setValueAtTime(0.001, t);
            gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

            osc.connect(gain);
            gain.connect(targetGain);

            osc.start(t);
            osc.stop(t + 0.13);
        }
    }

    // =========================================================================
    // CONTROL DEL CICLO HORARIO (DÍA / NOCHE) EN EL AUDIO
    // =========================================================================
    updateTimeOfDay(hour) {
        this.currentHour = hour;
        if (!this.ctx) return;

        const isDay = hour >= 6.5 && hour <= 19.0;
        const isDusk = (hour >= 18.0 && hour <= 21.0);
        const isNight = hour < 6.0 || hour >= 20.5;
        const isSiesta = hour >= 11.5 && hour <= 16.5;

        // Balance de grillos (activos de noche y atardecer)
        if (this.cricketNode) {
            let cricketVol = 0.0;
            if (isNight) cricketVol = 0.35;
            else if (isDusk) cricketVol = 0.45;
            else cricketVol = 0.02;
            this.cricketNode.cGain.gain.setTargetAtTime(cricketVol, this.ctx.currentTime, 0.5);
        }

        // Balance de chicharras (activas en la siesta soleada)
        if (this.cicadaNode) {
            let cicadaVol = 0.0;
            if (isSiesta) cicadaVol = 0.32;
            else if (isDay) cicadaVol = 0.08;
            this.cicadaNode.cicGain.gain.setTargetAtTime(cicadaVol, this.ctx.currentTime, 0.5);
        }

        // Viento sutilmente más fresco y audible de noche
        if (this.windNode) {
            const windVol = isNight ? 0.38 : 0.22;
            this.windNode.windGain.gain.setTargetAtTime(windVol, this.ctx.currentTime, 0.5);
        }
    }

    // =========================================================================
    // INICIAR PAISAJE AMBIENTAL CONTINUO
    // =========================================================================
    toggleAmbientSound(active) {
        this.resumeContext().then(() => {
            this.isPlayingAmbient = active;
            if (active) {
                this.ambientGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.8);
                this.startRiverSound();
                this.startWindSound();
                this.startCrickets();
                this.startCicadas();
                this.updateTimeOfDay(this.currentHour);

                // Disparador aleatorio de bioacústica de fondo (aves o ranas cada 8-15 seg)
                if (!this.birdInterval) {
                    this.birdInterval = setInterval(() => {
                        if (!this.isPlayingAmbient) return;
                        const isDay = this.currentHour >= 6.0 && this.currentHour <= 19.5;
                        if (isDay) {
                            const r = Math.random();
                            if (r < 0.4) this.playZorzal(this.ambientGain);
                            else if (r < 0.7) this.playBenteveo(this.ambientGain);
                            else this.playTero(this.ambientGain);
                        } else {
                            // De noche, ranas o sapos en el bañado
                            if (Math.random() < 0.6) this.playFrogs(this.ambientGain);
                        }
                    }, 10000);
                }
            } else {
                this.ambientGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.8);
                if (this.birdInterval) {
                    clearInterval(this.birdInterval);
                    this.birdInterval = null;
                }
            }
        });
    }

    // =========================================================================
    // REPRODUCCIÓN DE HITOS ESPECÍFICOS DE REGISTRO DE CAMPO AL CLIKEAR 3D
    // =========================================================================
    triggerFieldRecording(recData) {
        this.resumeContext().then(() => {
            console.log(`📡 Disparando registro de campo: [${recData.id}] ${recData.name}`);
            this.activeRecording = recData;

            // Retroalimentación auditiva inmediata según tipo de registro
            switch (recData.audio_type) {
                case "river_birds":
                    this.playZorzal(this.spotGain);
                    setTimeout(() => this.playBenteveo(this.spotGain), 1600);
                    break;
                case "water_wind_tero":
                    this.playTero(this.spotGain);
                    setTimeout(() => this.playZorzal(this.spotGain), 1200);
                    break;
                case "bridge_swallows_water":
                    this.playSwallows(this.spotGain);
                    setTimeout(() => this.playSwallows(this.spotGain), 1400);
                    break;
                case "park_cicadas_benteveo":
                    this.playBenteveo(this.spotGain);
                    setTimeout(() => this.playZorzal(this.spotGain), 1500);
                    break;
                case "frogs_crickets_night":
                    this.playFrogs(this.spotGain);
                    setTimeout(() => this.playFrogs(this.spotGain), 1800);
                    break;
                case "deep_current_wind":
                    this.playTero(this.spotGain);
                    setTimeout(() => this.playSwallows(this.spotGain), 1300);
                    break;
                default:
                    this.playZorzal(this.spotGain);
            }

            if (this.onRecordingStart) {
                this.onRecordingStart(recData);
            }
        });
    }

    // Disparar sonido según ubicación arbitraria cliqueada en el terreno 3D
    triggerCoordinatesSound(point) {
        this.resumeContext().then(() => {
            const x = point.x;
            const y = point.y;
            const z = point.z;

            // Calcular distancia al meandro central del río
            const t = x / 14.0;
            const riverY = 3.2 * Math.sin(t * 2.4 - 0.3) + 1.8 * Math.sin(t * 4.8 + 1.1) - 0.8 * (t ** 2) + 0.4;
            const distRiver = Math.abs(y - riverY);

            let generatedRec = null;
            if (distRiver < 1.4) {
                // En el cauce o banco del río
                if (x < -2) {
                    generatedRec = {
                        id: "rec_live_river_w",
                        name: "Sector Oeste - Meandro Silvestre del Ctalamochita",
                        desc: "Correntada fluvial sobre banco de limo y arena. Especies: Tero Real y Sauces Criollos.",
                        audio_type: "water_wind_tero",
                        coords: `Lat -32.4112°, Long -63.2514° (Cota ${Math.round(192 + z * 3)}m s.n.m.)`
                    };
                    this.playTero(this.spotGain);
                } else if (x > 2) {
                    generatedRec = {
                        id: "rec_live_river_e",
                        name: "Sector Este - Bajada al Puente Alberdi",
                        desc: "Agua acelerada entre pilares y bandadas de golondrinas de ribera.",
                        audio_type: "bridge_swallows_water",
                        coords: `Lat -32.4085°, Long -63.2351° (Cota ${Math.round(191 + z * 3)}m s.n.m.)`
                    };
                    this.playSwallows(this.spotGain);
                } else {
                    generatedRec = {
                        id: "rec_live_river_c",
                        name: "Playas Centrales & Balneario Ctalamochita",
                        desc: "Remansos de agua clara, suelo arenoso y trinos de Zorzal Colorado en la ribera.",
                        audio_type: "river_birds",
                        coords: `Lat -32.4098°, Long -63.2423° (Cota ${Math.round(193 + z * 3)}m s.n.m.)`
                    };
                    this.playZorzal(this.spotGain);
                }
            } else if (y > riverY) {
                // Costa de Villa María (Norte)
                generatedRec = {
                    id: "rec_live_vm",
                    name: "Costanera de Villa María - Arboledas del Ctalamochita",
                    desc: "Copa de eucaliptos y sauces, brisa de verano y llamados de Benteveo en la ribera urbana.",
                    audio_type: "park_cicadas_benteveo",
                    coords: `Lat -32.4050°, Long -63.2410° (Cota ${Math.round(197 + z * 3)}m s.n.m.)`
                };
                this.playBenteveo(this.spotGain);
            } else {
                // Costa de Villa Nueva (Sur)
                generatedRec = {
                    id: "rec_live_vn",
                    name: "Villa Nueva - Parque Hipólito Yrigoyen y Bañados",
                    desc: "Pastizales inundables del espinal, grillos y coros de sapitos criollos.",
                    audio_type: "frogs_crickets_night",
                    coords: `Lat -32.4180°, Long -63.2440° (Cota ${Math.round(195 + z * 3)}m s.n.m.)`
                };
                this.playFrogs(this.spotGain);
            }

            if (this.onRecordingStart && generatedRec) {
                this.onRecordingStart(generatedRec);
            }
        });
    }

    // Datos de osciloscopio en tiempo real para el visualizador
    getByteFrequencyData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    getByteTimeDomainData() {
        if (!this.analyser) return null;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }
}

// Instancia global
window.ctalamochitaAudio = new CtalamochitaAudioEngine();
