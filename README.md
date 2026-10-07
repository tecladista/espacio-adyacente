# Río Ctalamochita 3D — Relevamiento Territorial QGIS y Paisaje Sonoro
### Villa María – Villa Nueva (Córdoba, Argentina)

Visualización tridimensional interactiva y mapa sensible del **Río Ctalamochita (Tercero)** en el tramo comprendido entre las ciudades de **Villa María** (margen noreste) y **Villa Nueva** (margen sudoeste), modelado con estética cartográfica de curvas de nivel e isolíneas **DEM de QGIS**, simulación de **ciclo solar día/noche** y **registros de campo bioacústicos** sintetizados mediante la Web Audio API.

---

## 🌟 Características Principales

1. **Modelo 3D Topográfico (Blender 4.3 + Three.js)**:
   - Malla de elevación con escalonamiento de cotas altimétricas (curvas de nivel cada 1 metro).
   - Rampa de color hipsométrica inspirada en cartografía temática de QGIS: arenas doradas, vegetación aluvial ribereña, llanura de inundación y mesetas urbanas.
   - Morfología fluvial con meandros, ensanches de balneario, playas e islas de sedimentación.
   - Puentes interurbanos: **Puente Histórico Alberdi (1918)**, **Puente Juan Domingo Perón**, **Puente Vélez Sarsfield** y **Puente Negro Ferroviario**.
   - Trazas urbanas y bosque en galería con sauces criollos (*Salix humboldtiana*).
   - Podio geológico con flecha norte 3D y cotas georreferenciadas (`Lat -32.4080°S, Long -63.2420°W`).

2. **Control Interactivo de Giro y Cámara**:
   - `THREE.OrbitControls` para rotar, inclinar y hacer zoom sobre el territorio con el mouse o gestos táctiles.
   - Encuadres rápidos: Perspectiva General, Meandro Fluvial, Puente Alberdi y Vista Cenital Nadir.

3. **Slider de Ciclo Solar (Hora del Día y Luz)**:
   - Control continuo de 24 horas (`00:00` a `24:00 hs`).
   - Trayectoria solar dinámica en arco con cálculo de sombras proyectadas y temperatura de color.
   - Transición de cielos: **Alba (06:30)**, **Mediodía Solar (12:00)**, **Hora Dorada / Atardecer (18:45)** y **Noche Estrellada (23:00)** con luz lunar y cielo estrellado.
   - Modo de reproducción automática del ciclo de 24 horas (`▶️ Ciclo 24h`).

4. **Paisaje Sonoro y Registros de Campo (Bioacústica Fluvial)**:
   - **Disparo por clic en el modelo 3D**: Al cliquear sobre el agua, las riberas o las balizas doradas, se emite una onda sonora visual 3D y se dispara el registro correspondiente:
     * *Correntada fluvial y rumor de agua sobre arena*.
     * *Zorzal Colorado (Turdus rufiventris)* y *Golondrinas ribereñas*.
     * *Benteveo / Bicho Feo (Pitangus sulphuratus)* y *Calandrias*.
     * *Tero Real (Vanellus chilensis)* en bancos de arena.
     * *Chicharras (Cicadidae)* en la siesta cordobesa.
     * *Ranas Criollas (Leptodactylus)* y *sapitos* en los bañados de Villa Nueva.
     * *Grillos nocturnos de costa* y *viento en los sauces*.
   - Botón maestro de **Paisaje Sonoro Continuo**.
   - **Osciloscopio en tiempo real** que analiza las frecuencias de audio emitidas.

---

## 📁 Estructura del Proyecto

```text
espacio-adyacente/
├── index.html                     # Interfaz web principal y visor WebGL
├── style.css                      # Estilos cartográficos, modo oscuro y glassmorphism
├── app.js                         # Lógica 3D Three.js, OrbitControls y ciclo solar
├── audio-engine.js                # Motor de audio bioacústico Web Audio API
├── generate_ctalamochita_model.py # Script de automatización bpy para Blender 4.3
├── assets/
│   └── emblem.jpg                 # Emblema cartográfico del río Ctalamochita
├── models/
│   └── rio_ctalamochita_qgis.glb  # Modelo 3D exportado en formato glTF/GLB
├── vendor/
│   ├── three.min.js               # Librería Three.js (r128)
│   ├── OrbitControls.js           # Controles orbitales de cámara
│   └── GLTFLoader.js              # Cargador glTF/GLB
└── sketch-p5/                     # Proyecto p5.js histórico preservado
```

---

## 🚀 Cómo Ejecutar Localmente

Al utilizar modelos 3D `.glb` y Web Audio API, se recomienda servir la carpeta a través de un servidor HTTP local:

### Con Python:
```bash
python -m http.server 8080
```
Abrí tu navegador en: [http://localhost:8080](http://localhost:8080)

### Con Node.js / npx:
```bash
npx serve .
```

---

## 🛠️ Generación del Modelo 3D con Blender

Si deseás regenerar o personalizar el modelo 3D utilizando Blender 4.3 en modo headless:

```bash
& "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe" --background --python generate_ctalamochita_model.py
```
El script generará el archivo `rio_ctalamochita_qgis.blend` y exportará `rio_ctalamochita_qgis.glb` optimizado para Three.js.
