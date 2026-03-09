/**
 * =============================================================================
 * LÓGICA DEL VISOR - viewer.js
 * =============================================================================
 * Este archivo contiene la funcionalidad para visualizar el modelo 3D:
 * - Lectura del parámetro ID de la URL
 * - Carga del modelo desde localStorage
 * - Visualización con Three.js
 * - Proyección AR con WebXR (si está disponible)
 * - Fallback con model-viewer
 * 
 * Autor: Demo Prototipo
 * Versión: 1.0
 */

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

// Escena Three.js
let scene = null;
let camera = null;
let renderer = null;
let model = null;
let animationId = null;

// Variables de WebXR
let xrSession = null;
let xrRefSpace = null;
let xrHitTestSource = null;
let xrViewerSpace = null;

// Variables de AR
let productId = '';
let isARSupported = false;
let isARActive = false;

// Elementos del DOM
let canvas = null;
let videoElement = null;

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando Visor 3D...');
    
    // Obtener referencias a elementos del DOM
    canvas = document.getElementById('arScene');
    videoElement = document.getElementById('arVideo');
    
    // Obtener ID del producto de la URL
    productId = getProductIdFromURL();
    
    // Mostrar ID del producto
    document.getElementById('productId').textContent = 'ID: ' + productId;
    
    // Configurar event listeners
    setupEventListeners();
    
    // Verificar soporte WebXR
    await checkXRSupport();
    
    // Cargar modelo
    loadModel();
});

/**
 * Obtiene el ID del producto de los parámetros de la URL
 */
function getProductIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || 'desconocido';
}

/**
 * Configura los event listeners
 */
function setupEventListeners() {
    // Botón AR
    document.getElementById('btnAR').addEventListener('click', startAR);
    
    // Botón volver
    document.getElementById('btnBack').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// =============================================================================
// VERIFICACIÓN DE SOPORTE WEBXR
// =============================================================================

/**
 * Verifica si el dispositivo soporta WebXR
 */
async function checkXRSupport() {
    const btnAR = document.getElementById('btnAR');
    
    // Verificar si navigator.xr está disponible
    if (!navigator.xr) {
        console.log('WebXR no disponible en este navegador');
        btnAR.textContent = 'AR no disponible';
        btnAR.disabled = true;
        isARSupported = false;
        return;
    }
    
    try {
        // Verificar soporte de AR inmersivo
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        
        if (supported) {
            console.log('WebXR AR disponible');
            isARSupported = true;
            btnAR.disabled = false;
            btnAR.textContent = 'Ver en AR';
        } else {
            console.log('WebXR AR no soportado en este dispositivo');
            btnAR.textContent = 'AR no disponible';
            btnAR.disabled = true;
            isARSupported = false;
        }
    } catch (error) {
        console.error('Error al verificar WebXR:', error);
        btnAR.textContent = 'AR no disponible';
        btnAR.disabled = true;
        isARSupported = false;
    }
}

// =============================================================================
// CARGA DEL MODELO
// =============================================================================

/**
 * Carga el modelo 3D desde localStorage
 */
function loadModel() {
    console.log('Cargando modelo:', productId);
    
    // Intentar obtener datos del modelo
    let modelData = null;
    
    try {
        const storedData = localStorage.getItem('model_' + productId);
        if (storedData) {
            modelData = JSON.parse(storedData);
        }
    } catch (e) {
        console.warn('No se pudo leer de localStorage:', e);
    }
    
    if (modelData) {
        console.log('Modelo encontrado:', modelData);
    } else {
        console.log('Modelo no encontrado en localStorage, generando modelo demo');
    }
    
    // Inicializar visualizador 3D
    init3DViewer();
}

/**
 * Inicializa el visualizador 3D con Three.js
 */
function init3DViewer() {
    const container = document.getElementById('viewerContainer');
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1f35);
    
    // Crear cámara
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    
    // Crear renderer - crear canvas si no existe
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Agregar el canvas al contenedor
    const canvasContainer = document.getElementById('arScene').parentElement;
    if (canvasContainer) {
        canvasContainer.insertBefore(renderer.domElement, document.getElementById('arScene'));
        document.getElementById('arScene').style.display = 'none';
    }
    
    // Agregar iluminación
    addLighting();
    
    // Generar modelo
    model = generateDemoModel();
    model.position.y = 0;
    scene.add(model);
    
    // Agregar suelo
    addFloor();
    
    // Iniciar animación
    animate();
    
    // Configurar controles
    setupControls();
    
    // Manejar redimensionamiento
    window.addEventListener('resize', onWindowResize);
}

/**
 * Agrega iluminación a la escena
 */
function addLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Luz direccional
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Luz de relleno
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

/**
 * Genera un modelo demo aleatorio
 */
function generateDemoModel() {
    // Usar el ID para generar un modelo consistente
    const hash = productId.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Intentar obtener colores del localStorage
    let modelData = null;
    try {
        const storedData = localStorage.getItem('model_' + productId);
        if (storedData) {
            modelData = JSON.parse(storedData);
        }
    } catch (e) {
        console.warn('No se pudo leer de localStorage:', e);
    }
    
    let color;
    let geometry;
    
    // Si tenemos colores guardados, usarlos
    if (modelData && modelData.colors && modelData.colors.length > 0) {
        const dominantColor = modelData.colors[0];
        color = (dominantColor.r << 16) | (dominantColor.g << 8) | dominantColor.b;
    } else {
        // Usar color aleatorio basado en el hash
        const modelType = Math.abs(hash) % 4;
        switch (modelType) {
            case 0:
                color = 0x3498db;
                break;
            case 1:
                color = 0xe74c3c;
                break;
            case 2:
                color = 0x2ecc71;
                break;
            case 3:
                color = 0xf39c12;
                break;
        }
    }
    
    // Usar dimensiones guardadas si están disponibles
    let aspectRatio = 1;
    if (modelData && modelData.frameDimensions) {
        aspectRatio = modelData.frameDimensions.width / modelData.frameDimensions.height;
    } else {
        const modelType = Math.abs(hash) % 4;
        aspectRatio = modelType === 0 ? 1.5 : (modelType === 2 ? 0.6 : 1);
    }
    
    // Crear geometría basada en la proporción
    if (aspectRatio > 1.2) {
        geometry = new THREE.BoxGeometry(1.5 * aspectRatio, 1.5, 1.5);
    } else if (aspectRatio < 0.8) {
        geometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 32);
    } else {
        geometry = new THREE.SphereGeometry(1, 32, 32);
    }
    
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.5,
        metalness: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
}

/**
 * Agrega un plano de suelo
 */
function addFloor() {
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    gridHelper.position.y = -0.99;
    scene.add(gridHelper);
}

/**
 * Animación del modelo
 */
function animate() {
    animationId = requestAnimationFrame(animate);
    
    // Rotar modelo
    if (model) {
        model.rotation.y += 0.005;
    }
    
    // Renderizar
    if (renderer.xr.isPresenting) {
        // En modo XR, el renderer lo maneja automáticamente
        return;
    }
    
    renderer.render(scene, camera);
}

/**
 * Configura controles interactivos
 */
function setupControls() {
    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const container = document.getElementById('viewerContainer');
    
    // Mouse events
    container.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isMouseDown || !camera) return;
        
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        rotateCamera(deltaX, deltaY);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    container.addEventListener('mouseleave', () => {
        isMouseDown = false;
    });
    
    // Zoom con wheel
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const zoomSpeed = 0.002;
        const direction = camera.position.clone().normalize();
        camera.position.addScaledVector(direction, -e.deltaY * zoomSpeed);
    }, { passive: false });
    
    // Touch events
    let touchStartDistance = 0;
    
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isMouseDown = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });
    
    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        if (e.touches.length === 1 && isMouseDown && camera) {
            const deltaX = e.touches[0].clientX - previousMousePosition.x;
            const deltaY = e.touches[0].clientY - previousMousePosition.y;
            
            rotateCamera(deltaX, deltaY);
            
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const delta = touchStartDistance - distance;
            const direction = camera.position.clone().normalize();
            camera.position.addScaledVector(direction, delta * 0.01);
            
            touchStartDistance = distance;
        }
    }, { passive: false });
    
    container.addEventListener('touchend', () => {
        isMouseDown = false;
    });
}

/**
 * Rota la cámara alrededor del centro
 */
function rotateCamera(deltaX, deltaY) {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);
    
    spherical.theta -= deltaX * 0.01;
    spherical.phi -= deltaY * 0.01;
    
    // Limitar phi
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
}

/**
 * Maneja el redimensionamiento de la ventana
 */
function onWindowResize() {
    const container = document.getElementById('viewerContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

// =============================================================================
// FUNCIONES DE REALIDAD AUMENTADA
// =============================================================================

/**
 * Inicia la sesión de AR
 */
async function startAR() {
    if (!isARSupported) {
        alert('AR no está disponible en este dispositivo');
        return;
    }
    
    console.log('Iniciando AR...');
    
    try {
        // Solicitar sesión de AR
        xrSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test', 'local-floor'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.getElementById('viewerContainer') }
        });
        
        // Configurar la sesión
        xrSession.addEventListener('end', onARSessionEnded);
        
        // Configurar renderer para XR
        renderer.xr.enabled = true;
        await renderer.xr.setSession(xrSession);
        
        // Obtener espacio de referencia
        xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
        
        // Configurar hit testing para detección de superficies
        xrViewerSpace = await xrSession.requestReferenceSpace('viewer');
        xrHitTestSource = await xrSession.requestHitTestSource({
            space: xrViewerSpace
        });
        
        // Ocultar modelo normal y mostrar video
        isARActive = true;
        videoElement.style.display = 'block';
        canvas.style.display = 'none';
        
        // Mostrar indicador AR
        document.getElementById('arIndicator').classList.add('active');
        
        // Ocultar botón AR
        document.getElementById('btnAR').textContent = 'Salir de AR';
        
        // Iniciar loop de AR
        arAnimate();
        
        console.log('Sesión AR iniciada');
    } catch (error) {
        console.error('Error al iniciar AR:', error);
        alert('No se pudo iniciar AR: ' + error.message);
    }
}

/**
 * Loop de animación para AR
 */
function arAnimate() {
    if (!isARActive) return;
    
    animationId = requestAnimationFrame(arAnimate);
    
    // Renderizar con XR
    renderer.render(scene, camera);
}

/**
 * Finaliza la sesión de AR
 */
function onARSessionEnded() {
    console.log('Sesión AR finalizada');
    
    isARActive = false;
    xrSession = null;
    xrHitTestSource = null;
    
    // Restaurar visualización normal
    videoElement.style.display = 'none';
    canvas.style.display = 'block';
    
    // Ocultar indicador
    document.getElementById('arIndicator').classList.remove('active');
    
    // Restaurar botón
    document.getElementById('btnAR').textContent = 'Ver en AR';
    
    // Restaurar renderer
    renderer.xr.enabled = false;
    
    // Reiniciar animación normal
    animate();
}

// =============================================================================
// MANEJO DE ERRORES
// =============================================================================

window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
});

console.log('Viewer.js cargado correctamente');

