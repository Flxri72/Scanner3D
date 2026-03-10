/**
 * =============================================================================
 * LÓGICA DEL ESCÁNER - scanner.js
 * =============================================================================
 * Este archivo contiene toda la funcionalidad del sistema de escaneo 3D:
 * - Acceso a la cámara
 * - Marco de escaneo interactivo
 * - Captura de imagen
 * - Generación de modelo 3D
 * - Visualizador 3D
 * - Generación de QR
 * 
 * Autor: Demo Prototipo
 * Versión: 1.0
 */

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

// Elementos del DOM
let videoElement = null;
let scanFrame = null;
let canvasElement = null;
let ctx = null;

// Variables de estado
let stream = null;
let isDragging = false;
let isResizing = false;
let dragStartX = 0;
let dragStartY = 0;
let frameStartX = 0;
let frameStartY = 0;
let frameStartWidth = 0;
let frameStartHeight = 0;

// Escena Three.js para el visualizador
let scene = null;
let camera = null;
let renderer = null;
let model = null;
let animationId = null;

// ID único del producto
let currentProductId = '';

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando Escáner 3D...');
    
    // Obtener referencias a elementos del DOM
    videoElement = document.getElementById('cameraFeed');
    scanFrame = document.getElementById('scanFrame');
    canvasElement = document.getElementById('captureCanvas');
    ctx = canvasElement.getContext('2d');
    
    // Configurar event listeners
    setupEventListeners();
});

/**
 * Configura todos los event listeners de la aplicación
 */
function setupEventListeners() {
    // Botón iniciar escaneo
    document.getElementById('btnStartScan').addEventListener('click', startScanner);
    
    // Botón cancelar
    document.getElementById('btnCancelScan').addEventListener('click', cancelScanner);
    
    // Botón capturar/escanear
    document.getElementById('btnCapture').addEventListener('click', captureObject);
    
    // Botón nuevo escaneo
    document.getElementById('btnNewScan').addEventListener('click', resetScanner);
    
    // Botón copiar enlace
    document.getElementById('btnCopyLink').addEventListener('click', copyLink);
    
    // Configurar drag del marco de escaneo
    setupScanFrame();
    
    // Configurar resize del marco
    setupResizeHandle();
}

// =============================================================================
// FUNCIONES DE LA CÁMARA
// =============================================================================

/**
 * Inicia el escáner solicitando acceso a la cámara
 */
async function startScanner() {
    console.log('Solicitando acceso a la cámara...');
    
    // Verificar si navigator.mediaDevices y getUserMedia están disponibles
    // También verificamos la versión legacy por compatibilidad
    const getUserMediaFn = navigator.mediaDevices?.getUserMedia || navigator.getUserMedia;
    
    if (!navigator.mediaDevices || !getUserMediaFn) {
        // Verificar si es problema de HTTPS
        const isSecure = window.location.protocol === 'https:' || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
        
        if (!isSecure) {
            alert('La cámara requiere conexión HTTPS.\n\n' +
                  'Para acceder desde otro dispositivo:\n' +
                  '1. Usa ngrok con HTTPS\n' +
                  '2. O despliega en un servidor con HTTPS (Vercel, Netlify, etc.)\n\n' +
                  'URL actual: ' + window.location.href);
        } else {
            alert('Tu navegador no soporta acceso a la cámara.\n\n' +
                  'Asegúrate de:\n' +
                  '1. Usar Chrome, Firefox o Safari moderno\n' +
                  '2. Permitir acceso a la cámara en configuración\n' +
                  '3. No estar en modo incógnito/restringido');
        }
        return;
    }
    
    try {
        // Solicitar acceso a la cámara
        const constraints = {
            video: {
                facingMode: 'environment', // Usar cámara trasera en móviles
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        // Intentar obtener permiso
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Asignar stream al elemento video
        videoElement.srcObject = stream;
        
        // Mostrar pantalla de escaneo
        showScreen('scanner');
        
        console.log('Cámara iniciada correctamente');
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        
        let message = 'No se pudo acceder a la cámara. ';
        if (error.name === 'NotAllowedError') {
            message += 'Por favor, permite el acceso a la cámara en la configuración del navegador.';
        } else if (error.name === 'NotFoundError') {
            message += 'No se encontró ninguna cámara en el dispositivo.';
        } else {
            message += 'Error: ' + error.message;
        }
        
        alert(message);
    }
}

/**
 * Detiene la cámara y vuelve a la pantalla inicial
 */
function cancelScanner() {
    console.log('Cancelando escaneo...');
    
    // Detener stream de la cámara
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Ocultar video
    videoElement.srcObject = null;
    
    // Volver a pantalla inicial
    showScreen('start');
}

/**
 * Reinicia el escáner para un nuevo escaneo
 */
function resetScanner() {
    // Detener animaciones del visualizador
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Limpiar visualizador
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    
    document.getElementById('modelViewer').innerHTML = '';
    document.getElementById('qrcode').innerHTML = '';
    document.getElementById('productLink').value = '';
    
    // Volver a pantalla de escaneo
    cancelScanner();
}

// =============================================================================
// MARCO DE ESCANEO - FUNCIONES DE DRAG Y RESIZE
// =============================================================================

/**
 * Configura la funcionalidad de arrastrar el marco de escaneo
 */
function setupScanFrame() {
    // Event listeners para arrastrar
    scanFrame.addEventListener('mousedown', startDrag);
    scanFrame.addEventListener('touchstart', startDrag, { passive: false });
    
    // Event listeners globales para mover
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    
    // Event listeners para terminar arrastre
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

/**
 * Inicia el arrastre del marco
 */
function startDrag(e) {
    // No iniciar drag si se está redimensionando
    if (isResizing) return;
    
    e.preventDefault();
    isDragging = true;
    
    // Obtener posición del mouse/touch
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    dragStartX = clientX;
    dragStartY = clientY;
    
    // Obtener posición actual del marco
    const rect = scanFrame.getBoundingClientRect();
    frameStartX = rect.left;
    frameStartY = rect.top;
}

/**
 * Ejecuta el arrastre del marco
 */
function drag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Obtener posición actual del mouse/touch
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    // Calcular desplazamiento
    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    
    // Calcular nuevas posiciones
    let newX = frameStartX + deltaX;
    let newY = frameStartY + deltaY;
    
    // Obtener límites del contenedor
    const container = document.querySelector('.camera-container');
    const containerRect = container.getBoundingClientRect();
    const frameRect = scanFrame.getBoundingClientRect();
    
    // Limitar dentro del contenedor
    newX = Math.max(containerRect.left, Math.min(newX, containerRect.right - frameRect.width));
    newY = Math.max(containerRect.top, Math.min(newY, containerRect.bottom - frameRect.height));
    
    // Aplicar nueva posición
    scanFrame.style.left = (newX - containerRect.left) + 'px';
    scanFrame.style.top = (newY - containerRect.top) + 'px';
    scanFrame.style.transform = 'none';
}

/**
 * Finaliza el arrastre
 */
function endDrag() {
    isDragging = false;
}

/**
 * Configura el handle de redimensión
 */
function setupResizeHandle() {
    const resizeHandle = document.querySelector('.resize-handle-se');
    
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, { passive: false });
}

/**
 * Inicia la redimensión del marco
 */
function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    
    // Obtener posición del mouse/touch
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    dragStartX = clientX;
    dragStartY = clientY;
    
    // Obtener dimensiones actuales
    frameStartWidth = scanFrame.offsetWidth;
    frameStartHeight = scanFrame.offsetHeight;
    
    // Event listeners para redimensionar
    document.addEventListener('mousemove', resize);
    document.addEventListener('touchmove', resize, { passive: false });
    document.addEventListener('mouseup', endResize);
    document.addEventListener('touchend', endResize);
}

/**
 * Ejecuta la redimensión del marco
 */
function resize(e) {
    if (!isResizing) return;
    
    e.preventDefault();
    
    // Obtener posición actual del mouse/touch
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    
    // Calcular nuevas dimensiones
    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    
    // Nuevas dimensiones (mínimo 100x100)
    const newWidth = Math.max(100, frameStartWidth + deltaX);
    const newHeight = Math.max(100, frameStartHeight + deltaY);
    
    // Aplicar nuevas dimensiones
    scanFrame.style.width = newWidth + 'px';
    scanFrame.style.height = newHeight + 'px';
}

/**
 * Finaliza la redimensión
 */
function endResize() {
    isResizing = false;
    
    // Remover event listeners
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('touchmove', resize);
    document.removeEventListener('mouseup', endResize);
    document.removeEventListener('touchend', endResize);
}

// =============================================================================
// CAPTURA Y PROCESAMIENTO DE IMAGEN
// =============================================================================

/**
 * Captura el objeto dentro del marco de escaneo
 */
async function captureObject() {
    console.log('Capturando objeto...');
    
    // Mostrar animación de escaneo
    showScanningAnimation();
    
    // Simular procesamiento (en un sistema real, esto enviaría la imagen a un servidor)
    await simulateProcessing();
    
    // Capturar imagen del área seleccionada
    const imageData = captureImageFromFrame();
    
    // Generar modelo 3D
    generate3DModel();
    
    // Ocultar animación
    hideScanningAnimation();
    
    // Mostrar resultados
    showResults();
    
    console.log('Captura completada');
}

/**
 * Captura la imagen del área del marco de escaneo
 */
function captureImageFromFrame() {
    // Obtener dimensiones del marco
    const frameRect = scanFrame.getBoundingClientRect();
    const containerRect = document.querySelector('.camera-container').getBoundingClientRect();
    
    // Calcular posición relativa del marco
    const x = frameRect.left - containerRect.left;
    const y = frameRect.top - containerRect.top;
    const width = frameRect.width;
    const height = frameRect.height;
    
    // Configurar canvas
    canvasElement.width = width;
    canvasElement.height = height;
    
    // Dibujar frame del video en el canvas
    const scaleX = videoElement.videoWidth / containerRect.width;
    const scaleY = videoElement.videoHeight / containerRect.height;
    
    ctx.drawImage(
        videoElement,
        x * scaleX,
        y * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        width,
        height
    );
    
    // Obtener datos de la imagen
    const imageData = canvasElement.toDataURL('image/png');
    
    console.log('Imagen capturada:', imageData.substring(0, 50) + '...');
    
    return imageData;
}

/**
 * Simula el procesamiento del escaneo
 */
function simulateProcessing() {
    return new Promise(resolve => {
        // Simular tiempo de procesamiento
        setTimeout(resolve, 2000);
    });
}

/**
 * Muestra la animación de escaneo
 */
function showScanningAnimation() {
    document.getElementById('scanningOverlay').classList.add('active');
}

/**
 * Oculta la animación de escaneo
 */
function hideScanningAnimation() {
    document.getElementById('scanningOverlay').classList.remove('active');
}

// =============================================================================
// GENERACIÓN DEL MODELO 3D CON THREE.JS
// =============================================================================

/**
 * Genera un modelo 3D simulado usando Three.js
 */
function generate3DModel() {
    console.log('Generando modelo 3D...');
    
    const container = document.getElementById('modelViewer');
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Obtener dimensiones del contenedor
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1f35);
    
    // Crear cámara - ajustada para ver el pedestal
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.5, 4);
    camera.lookAt(0, -0.5, 0);
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Agregar iluminación
    addLighting();
    
    // Generar modelo geométrico aleatorio
    model = generateRandomModel();
    scene.add(model);
    
    // Agregar plano de suelo
    addFloor();
    
    // Iniciar animación
    animateModel();
    
    // Configurar controles simples con mouse
    setupMouseControls();
    
    console.log('Modelo 3D generado');
}

/**
 * Agrega iluminación a la escena
 */
function addLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Luz direccional (simula luz del sol)
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
 * Genera un modelo aleatorio simple
 * En un sistema real, esto procesaría la imagen capturada
 */
function generateRandomModel() {
    // Seleccionar tipo de modelo aleatorio
    const modelType = Math.floor(Math.random() * 4);
    let geometry;
    let color;
    
    switch (modelType) {
        case 0: // Cubo
            geometry = new THREE.BoxGeometry(1, 1, 1);
            color = 0x3498db;
            break;
        case 1: // Esfera
            geometry = new THREE.SphereGeometry(0.6, 32, 32);
            color = 0xe74c3c;
            break;
        case 2: // Cilindro
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
            color = 0x2ecc71;
            break;
        case 3: // Torus (dona)
            geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
            color = 0xf39c12;
            break;
    }
    
    // Crear material con apariencia más realista
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.2,
        envMapIntensity: 1
    });
    
    // Crear mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Posicionar el modelo sobre el pedestal
    mesh.position.y = -0.7;
    
    return mesh;
}

/**
 * Agrega un plano de suelo con pedestal visible
 */
function addFloor() {
    // Suelo principal (superficie de la mesa)
    const floorGeometry = new THREE.CylinderGeometry(3, 3, 0.1, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.3,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Pedestal elevado (donde se coloca el objeto)
    const pedestalGeometry = new THREE.CylinderGeometry(0.8, 1, 0.15, 32);
    const pedestalMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d2d44,
        roughness: 0.2,
        metalness: 0.3
    });
    const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
    pedestal.position.y = -1.42;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    scene.add(pedestal);
    
    // Anillo decorativo en el pedestal
    const ringGeometry = new THREE.TorusGeometry(0.85, 0.02, 16, 64);
    const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5,
        roughness: 0.1,
        metalness: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.34;
    scene.add(ring);
    
    // Círculo iluminado debajo del objeto
    const glowGeometry = new THREE.CircleGeometry(0.7, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.33;
    scene.add(glow);
    
    // Grid helper sutil
    const gridHelper = new THREE.GridHelper(6, 12, 0x333355, 0x222233);
    gridHelper.position.y = -1.49;
    scene.add(gridHelper);
}

/**
 * Anima el modelo 3D
 */
function animateModel() {
    animationId = requestAnimationFrame(animateModel);
    
    // Rotar modelo lentamente
    if (model) {
        model.rotation.y += 0.005;
    }
    
    // Renderizar
    renderer.render(scene, camera);
}

/**
 * Configura controles del mouse para rotar la vista
 */
function setupMouseControls() {
    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const container = document.getElementById('modelViewer');
    
    container.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isMouseDown || !camera) return;
        
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        // Rotar cámara alrededor del centro
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        
        spherical.theta -= deltaX * 0.01;
        spherical.phi -= deltaY * 0.01;
        
        // Limitar phi
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);
        
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
        
        const zoomSpeed = 0.001;
        const direction = camera.position.clone().normalize();
        camera.position.addScaledVector(direction, -e.deltaY * zoomSpeed);
    });
    
    // Touch controls
    let touchStartDistance = 0;
    
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isMouseDown = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            // Zoom con pinch
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
            
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(camera.position);
            
            spherical.theta -= deltaX * 0.01;
            spherical.phi -= deltaY * 0.01;
            
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            
            camera.position.setFromSpherical(spherical);
            camera.lookAt(0, 0, 0);
            
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            // Zoom pinch
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const delta = touchStartDistance - distance;
            const direction = camera.position.clone().normalize();
            camera.position.addScaledVector(direction, delta * 0.01);
            
            touchStartDistance = distance;
        }
    });
    
    container.addEventListener('touchend', () => {
        isMouseDown = false;
    });
}

// =============================================================================
// GENERACIÓN DE ENLACE Y QR
// =============================================================================

/**
 * Muestra los resultados con enlace y QR
 */
function showResults() {
    // Generar ID único
    currentProductId = generateProductId();
    
    // Generar URL
    const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
    const productUrl = `${baseUrl}viewer.html?id=${currentProductId}`;
    
    // Mostrar enlace
    document.getElementById('productLink').value = productUrl;
    
    // Generar QR
    generateQRCode(productUrl);
    
    // Guardar modelo en localStorage para la página viewer
    saveModelData();
    
    // Mostrar pantalla de resultados
    showScreen('result');
}

/**
 * Genera un ID único para el producto
 */
function generateProductId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `producto_${timestamp}_${random}`;
}

/**
 * Genera el código QR
 */
function generateQRCode(url) {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    // Crear QR
    new QRCode(qrContainer, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    
    console.log('QR generado');
}

/**
 * Guarda los datos del modelo en localStorage
 */
function saveModelData() {
    // Generar datos del modelo (en un sistema real, esto se guardaría en servidor)
    const modelData = {
        id: currentProductId,
        type: 'random', // Indica que es un modelo generado aleatoriamente
        timestamp: Date.now()
    };
    
    // Guardar en localStorage (simula base de datos)
    try {
        localStorage.setItem('model_' + currentProductId, JSON.stringify(modelData));
        console.log('Modelo guardado en localStorage');
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
    }
}

/**
 * Copia el enlace al portapapeles
 */
function copyLink() {
    const linkInput = document.getElementById('productLink');
    const copyButton = document.getElementById('btnCopyLink');
    
    // Seleccionar texto
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    // Copiar
    navigator.clipboard.writeText(linkInput.value).then(() => {
        // Cambiar texto del botón
        copyButton.textContent = 'Copiado!';
        copyButton.classList.add('copied');
        
        // Restaurar después de 2 segundos
        setTimeout(() => {
            copyButton.textContent = 'Copiar';
            copyButton.classList.remove('copied');
        }, 2000);
        
        console.log('Enlace copiado al portapapeles');
    }).catch(err => {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar el enlace');
    });
}

// =============================================================================
// NAVEGACIÓN ENTRE PANTALLAS
// =============================================================================

/**
 * Muestra una pantalla específica
 * @param {string} screen - Nombre de la pantalla: 'start', 'scanner', 'result'
 */
function showScreen(screen) {
    // Ocultar todas las pantallas
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('scannerScreen').classList.remove('active');
    document.getElementById('resultScreen').classList.remove('active');
    
    // Mostrar pantalla seleccionada
    switch (screen) {
        case 'start':
            document.getElementById('startScreen').style.display = 'block';
            break;
        case 'scanner':
            document.getElementById('scannerScreen').classList.add('active');
            break;
        case 'result':
            document.getElementById('resultScreen').classList.add('active');
            break;
    }
}

// =============================================================================
// MANEJO DE ERRORES
// =============================================================================

/**
 * Maneja errores globales
 */
window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
});

/**
 * Maneja rechazos de promesas no manejados
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
});

console.log('Scanner.js cargado correctamente');

