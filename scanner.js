/**
 * =============================================================================
 * ESCÁNER 3D AVANZADO - scanner.js
 * =============================================================================
 * Marco 3D con controles CAD, detección de puntos y generación de modelo 3D
 */

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

let videoElement = null;
let scanFrame = null;
let canvasElement = null;
let ctx = null;
let stream = null;
let isDragging = false;
let isResizing = false;
let dragStartX = 0;
let dragStartY = 0;
let frameStartX = 0;
let frameStartY = 0;
let frameStartWidth = 0;
let frameStartHeight = 0;

// Three.js variables
let scene = null;
let camera = null;
let renderer = null;
let model = null;
let animationId = null;

// Marco 3D
let threeScene = null;
let threeCamera = null;
let threeRenderer = null;
let frameBox3D = null;
let frameLines3D = null;
let cornerControls = [];
let edgeLines = [];

// Datos
let extractedColors = [];
let detectedPoints = [];
let currentProductId = '';

// Modo de vista actual
let currentViewMode = 'perspective';

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando Escáner 3D Avanzado...');
    
    videoElement = document.getElementById('cameraFeed');
    scanFrame = document.getElementById('scanFrame');
    canvasElement = document.getElementById('captureCanvas');
    ctx = canvasElement.getContext('2d');
    
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btnStartScan').addEventListener('click', startScanner);
    document.getElementById('btnCancelScan').addEventListener('click', cancelScanner);
    document.getElementById('btnCapture').addEventListener('click', captureObject);
    document.getElementById('btnNewScan').addEventListener('click', resetScanner);
    document.getElementById('btnCopyLink').addEventListener('click', copyLink);
    
    setupScanFrame();
    setupResizeHandle();
    setupCornerControls();
}

// =============================================================================
// FUNCIONES DE LA CÁMARA
// =============================================================================

async function startScanner() {
    console.log('Solicitando acceso a la cámara...');
    
    const getUserMediaFn = navigator.mediaDevices?.getUserMedia || navigator.getUserMedia;
    
    if (!navigator.mediaDevices || !getUserMediaFn) {
        alert('Tu navegador no soporta acceso a la cámara.');
        return;
    }
    
    try {
        const constraints = {
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        showScreen('scanner');
        
        setTimeout(() => {
            initThreeFrame();
            init3DViewer();
        }, 100);
        
        console.log('Cámara iniciada correctamente');
    } catch (error) {
        console.error('Error al acceder a la cámara:', error);
        alert('No se pudo acceder a la cámara: ' + error.message);
    }
}

function cancelScanner() {
    disposeThreeFrame();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    videoElement.srcObject = null;
    showScreen('start');
}

function resetScanner() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    document.getElementById('modelViewer').innerHTML = '';
    document.getElementById('qrcode').innerHTML = '';
    document.getElementById('productLink').value = '';
    cancelScanner();
}

// =============================================================================
// MARCO DE ESCANEO 2D
// =============================================================================

function setupScanFrame() {
    scanFrame.addEventListener('mousedown', startDrag);
    scanFrame.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

function startDrag(e) {
    if (isResizing) return;
    e.preventDefault();
    isDragging = true;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    dragStartX = clientX;
    dragStartY = clientY;
    const rect = scanFrame.getBoundingClientRect();
    frameStartX = rect.left;
    frameStartY = rect.top;
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    let newX = frameStartX + deltaX;
    let newY = frameStartY + deltaY;
    const container = document.querySelector('.camera-container');
    const containerRect = container.getBoundingClientRect();
    const frameRect = scanFrame.getBoundingClientRect();
    newX = Math.max(containerRect.left, Math.min(newX, containerRect.right - frameRect.width));
    newY = Math.max(containerRect.top, Math.min(newY, containerRect.bottom - frameRect.height));
    scanFrame.style.left = (newX - containerRect.left) + 'px';
    scanFrame.style.top = (newY - containerRect.top) + 'px';
    scanFrame.style.transform = 'none';
    updateThreeFrame();
}

function endDrag() {
    isDragging = false;
}

function setupResizeHandle() {
    const resizeHandle = document.querySelector('.resize-handle-se');
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, { passive: false });
}

function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    dragStartX = clientX;
    dragStartY = clientY;
    frameStartWidth = scanFrame.offsetWidth;
    frameStartHeight = scanFrame.offsetHeight;
    document.addEventListener('mousemove', resize);
    document.addEventListener('touchmove', resize, { passive: false });
    document.addEventListener('mouseup', endResize);
    document.addEventListener('touchend', endResize);
}

function resize(e) {
    if (!isResizing) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    const newWidth = Math.max(100, frameStartWidth + deltaX);
    const newHeight = Math.max(100, frameStartHeight + deltaY);
    scanFrame.style.width = newWidth + 'px';
    scanFrame.style.height = newHeight + 'px';
    updateThreeFrame();
}

function endResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('touchmove', resize);
    document.removeEventListener('mouseup', endResize);
    document.removeEventListener('touchend', endResize);
}

// =============================================================================
// CONTROLES DE ESQUINA TIPO CAD
// =============================================================================

function setupCornerControls() {
    const corners = ['tl', 'tr', 'bl', 'br'];
    corners.forEach(pos => {
        const corner = document.querySelector(`.corner-${pos}`);
        if (corner) {
            corner.addEventListener('mousedown', (e) => startCornerDrag(e, pos));
            corner.addEventListener('touchstart', (e) => startCornerDrag(e, pos), { passive: false });
        }
    });
}

function startCornerDrag(e, position) {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    dragStartX = clientX;
    dragStartY = clientY;
    frameStartWidth = scanFrame.offsetWidth;
    frameStartHeight = scanFrame.offsetHeight;
    const rect = scanFrame.getBoundingClientRect();
    frameStartX = rect.left;
    frameStartY = rect.top;
    
    const moveHandler = (ev) => cornerDrag(ev, position);
    const upHandler = () => {
        isResizing = false;
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        document.removeEventListener('touchend', upHandler);
        updateThreeFrame();
    };
    
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchend', upHandler);
}

function cornerDrag(e, position) {
    if (!isResizing) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const deltaX = clientX - dragStartX;
    const deltaY = clientY - dragStartY;
    
    let newWidth = frameStartWidth;
    let newHeight = frameStartHeight;
    let newX = frameStartX;
    let newY = frameStartY;
    
    if (position.includes('r')) newWidth = Math.max(100, frameStartWidth + deltaX);
    else { newWidth = Math.max(100, frameStartWidth - deltaX); newX = frameStartX + deltaX; }
    
    if (position.includes('b')) newHeight = Math.max(100, frameStartHeight + deltaY);
    else { newHeight = Math.max(100, frameStartHeight - deltaY); newY = frameStartY + deltaY; }
    
    const container = document.querySelector('.camera-container');
    const containerRect = container.getBoundingClientRect();
    newX = Math.max(containerRect.left, Math.min(newX, containerRect.right - newWidth));
    newY = Math.max(containerRect.top, Math.min(newY, containerRect.bottom - newHeight));
    
    scanFrame.style.width = newWidth + 'px';
    scanFrame.style.height = newHeight + 'px';
    scanFrame.style.left = (newX - containerRect.left) + 'px';
    scanFrame.style.top = (newY - containerRect.top) + 'px';
    scanFrame.style.transform = 'none';
}

// =============================================================================
// MARCO 3D CON THREE.JS
// =============================================================================

function initThreeFrame() {
    const canvas = document.getElementById('threeCanvas');
    const container = document.querySelector('.camera-container');
    if (!canvas || !container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    threeScene = new THREE.Scene();
    
    threeCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    threeCamera.position.set(0, 0, 500);
    
    threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    threeRenderer.setSize(width, height);
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    
    create3DFrame();
    animateThreeFrame();
}

function create3DFrame() {
    const frameRect = scanFrame.getBoundingClientRect();
    const containerRect = document.querySelector('.camera-container').getBoundingClientRect();
    const frameWidth = frameRect.width;
    const frameHeight = frameRect.height;
    
    // Caja 3D wireframe
    const geometry = new THREE.BoxGeometry(frameWidth, frameHeight, 50);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
    frameBox3D = new THREE.LineSegments(edges, material);
    
    // Líneas de las aristas
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
    const edgeGeometry = new THREE.BufferGeometry();
    const edgePoints = [
        // Cara frontal
        -frameWidth/2, -frameHeight/2, 25, frameWidth/2, -frameHeight/2, 25,
        frameWidth/2, -frameHeight/2, 25, frameWidth/2, frameHeight/2, 25,
        frameWidth/2, frameHeight/2, 25, -frameWidth/2, frameHeight/2, 25,
        -frameWidth/2, frameHeight/2, 25, -frameWidth/2, -frameHeight/2, 25,
        // Cara trasera
        -frameWidth/2, -frameHeight/2, -25, frameWidth/2, -frameHeight/2, -25,
        frameWidth/2, -frameHeight/2, -25, frameWidth/2, frameHeight/2, -25,
        frameWidth/2, frameHeight/2, -25, -frameWidth/2, frameHeight/2, -25,
        -frameWidth/2, frameHeight/2, -25, -frameWidth/2, -frameHeight/2, -25,
        // Conexiones
        -frameWidth/2, -frameHeight/2, 25, -frameWidth/2, -frameHeight/2, -25,
        frameWidth/2, -frameHeight/2, 25, frameWidth/2, -frameHeight/2, -25,
        frameWidth/2, frameHeight/2, 25, frameWidth/2, frameHeight/2, -25,
        -frameWidth/2, frameHeight/2, 25, -frameWidth/2, frameHeight/2, -25
    ];
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePoints, 3));
    frameLines3D = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    
    threeScene.add(frameBox3D);
    threeScene.add(frameLines3D);
    
    // Agregar controles de vista
    createViewControls();
}

function createViewControls() {
    //Axis helper
    const axesHelper = new THREE.AxesHelper(80);
    threeScene.add(axesHelper);
}

function updateThreeFrame() {
    if (!frameBox3D || !frameLines3D) return;
    
    const frameRect = scanFrame.getBoundingClientRect();
    const containerRect = document.querySelector('.camera-container').getBoundingClientRect();
    const frameWidth = frameRect.width;
    const frameHeight = frameRect.height;
    
    // Actualizar escala
    frameBox3D.scale.set(frameWidth / 200, frameHeight / 200, 0.25);
    frameLines3D.scale.set(frameWidth / 200, frameHeight / 200, 0.25);
    
    // Actualizar posición
    const centerX = (frameRect.left - containerRect.left) + frameWidth / 2;
    const centerY = containerRect.height - ((frameRect.top - containerRect.top) + frameHeight / 2);
    
    frameBox3D.position.set(centerX - containerRect.width / 2, centerY - containerRect.height / 2, 0);
    frameLines3D.position.copy(frameBox3D.position);
}

function animateThreeFrame() {
    const animId = requestAnimationFrame(animateThreeFrame);
    
    if (frameBox3D) {
        const time = Date.now() * 0.002;
        const pulse = Math.sin(time) * 0.1 + 1;
        frameBox3D.material.opacity = pulse;
        frameLines3D.material.opacity = pulse * 0.6;
    }
    
    if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
    }
}

function disposeThreeFrame() {
    if (threeRenderer) {
        threeRenderer.dispose();
        threeRenderer = null;
    }
    threeScene = null;
    threeCamera = null;
    frameBox3D = null;
    frameLines3D = null;
}

// =============================================================================
// CAPTURA Y PROCESAMIENTO
// =============================================================================

async function captureObject() {
    console.log('Capturando objeto...');
    showScanningAnimation();
    await simulateProcessing();
    captureImageFromFrame();
    generate3DModel();
    hideScanningAnimation();
    showResults();
    console.log('Captura completada');
}

function captureImageFromFrame() {
    const frameRect = scanFrame.getBoundingClientRect();
    const containerRect = document.querySelector('.camera-container').getBoundingClientRect();
    const x = frameRect.left - containerRect.left;
    const y = frameRect.top - containerRect.top;
    const width = frameRect.width;
    const height = frameRect.height;
    
    canvasElement.width = width;
    canvasElement.height = height;
    
    const scaleX = videoElement.videoWidth / containerRect.width;
    const scaleY = videoElement.videoHeight / containerRect.height;
    
    ctx.drawImage(videoElement, x * scaleX, y * scaleY, width * scaleX, height * scaleY, 0, 0, width, height);
    
    console.log('Imagen capturada');
    
    // Extraer colores
    extractColorsFromImage();
    
    // Detectar puntos del objeto
    detectedPoints = detectObjectPoints();
    
    return canvasElement.toDataURL('image/png');
}

function simulateProcessing() {
    return new Promise(resolve => setTimeout(resolve, 2000));
}

function showScanningAnimation() {
    document.getElementById('scanningOverlay').classList.add('active');
}

function hideScanningAnimation() {
    document.getElementById('scanningOverlay').classList.remove('active');
}

// =============================================================================
// EXTRACCIÓN DE COLORES
// =============================================================================

function extractColorsFromImage() {
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = imageData.data;
    const colorMap = {};
    
    for (let i = 0; i < data.length; i += 40) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i + 1] / 32) * 32;
        const b = Math.round(data[i + 2] / 32) * 32;
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 225) continue;
        
        const key = `${r},${g},${b}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }
    
    const sortedColors = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number);
            return { r, g, b };
        });
    
    extractedColors = sortedColors;
    console.log('Colores extraídos:', extractedColors.length);
    return extractedColors;
}

function rgbToHex(r, g, b) {
    return (r << 16) | (g << 8) | b;
}

// =============================================================================
// DETECCIÓN DE PUNTOS DEL OBJETO
// =============================================================================

function detectObjectPoints() {
    const width = canvasElement.width;
    const height = canvasElement.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const points = [];
    const gridSize = 10;
    
    // Detectar puntos de interés usando algoritmo de diferencias
    for (let y = gridSize; y < height - gridSize; y += gridSize) {
        for (let x = gridSize; x < width - gridSize; x += gridSize) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Comparar con vecinos
            const neighbors = [
                ((y - gridSize) * width + x) * 4,
                ((y + gridSize) * width + x) * 4,
                (y * width + x - gridSize) * 4,
                (y * width + x + gridSize) * 4
            ];
            
            let diff = 0;
            for (const nIdx of neighbors) {
                diff += Math.abs(data[nIdx] - r) + Math.abs(data[nIdx + 1] - g) + Math.abs(data[nIdx + 2] - b);
            }
            
            // Si hay suficiente diferencia, es un punto de borde
            if (diff > 100) {
                points.push({
                    x: (x / width) * 2 - 1,
                    y: -(y / height) * 2 + 1,
                    z: 0,
                    color: { r, g, b },
                    intensity: diff / 400
                });
            }
        }
    }
    
    console.log('Puntos detectados:', points.length);
    
    // Agrupar puntos en clusters
    const clusters = clusterPoints(points, 5);
    console.log('Clusters:', clusters.length);
    
    return { points, clusters, width, height };
}

function clusterPoints(points, threshold) {
    const clusters = [];
    const used = new Set();
    
    for (let i = 0; i < points.length; i++) {
        if (used.has(i)) continue;
        
        const cluster = [points[i]];
        used.add(i);
        
        for (let j = i + 1; j < points.length; j++) {
            if (used.has(j)) continue;
            
            const dx = points[i].x - points[j].x;
            const dy = points[i].y - points[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < threshold / 100) {
                cluster.push(points[j]);
                used.add(j);
            }
        }
        
        if (cluster.length > 3) {
            clusters.push(cluster);
        }
    }
    
    return clusters;
}

// =============================================================================
// GENERACIÓN DEL MODELO 3D
// =============================================================================

function init3DViewer() {
    const container = document.getElementById('modelViewer');
    container.innerHTML = '';
    
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1f35);
    
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    addLighting();
    addFloor();
    setupMouseControls();
    
    window.addEventListener('resize', onWindowResize);
}

function generate3DModel() {
    console.log('Generando modelo 3D...');
    
    if (model) {
        scene.remove(model);
        model.geometry.dispose();
        model.material.dispose();
    }
    
    // Usar colores extraídos
    let color = 0x3498db;
    if (extractedColors.length > 0) {
        const dominantColor = extractedColors[0];
        color = rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b);
    }
    
    // Crear geometría basada en los puntos detectados
    let geometry;
    
    if (detectedPoints && detectedPoints.clusters && detectedPoints.clusters.length > 0) {
        geometry = createGeometryFromPoints();
    } else {
        // Fallback: usar dimensiones del marco
        const frameRect = scanFrame.getBoundingClientRect();
        const aspectRatio = frameRect.width / frameRect.height;
        
        if (aspectRatio > 1.3) {
            geometry = new THREE.BoxGeometry(1.5 * aspectRatio, 1.5, 1.5);
        } else if (aspectRatio < 0.7) {
            geometry = new THREE.CylinderGeometry(0.6, 0.8, 2, 32);
        } else {
            geometry = new THREE.SphereGeometry(1, 32, 32);
        }
    }
    
    // Crear material con los colores
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.3
    });
    
    model = new THREE.Mesh(geometry, material);
    model.castShadow = true;
    model.receiveShadow = true;
    scene.add(model);
    
    animateModel();
    console.log('Modelo 3D generado');
}

function createGeometryFromPoints() {
    const clusters = detectedPoints.clusters;
    
    // Encontrar el cluster más grande
    let largestCluster = clusters[0];
    for (const cluster of clusters) {
        if (cluster.length > largestCluster.length) {
            largestCluster = cluster;
        }
    }
    
    // Calcular bounding box del cluster
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const point of largestCluster) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / (height || 1);
    
    let geometry;
    
    // Crear forma basada en los puntos
    if (aspectRatio > 1.3) {
        geometry = new THREE.BoxGeometry(1.5 * aspectRatio, 1.5, 1.2);
    } else if (aspectRatio < 0.7) {
        geometry = new THREE.CylinderGeometry(0.5, 0.7, 2, 32);
    } else {
        geometry = new THREE.SphereGeometry(1, 32, 32);
    }
    
    return geometry;
}

function addLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

function addFloor() {
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);
    
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    gridHelper.position.y = -0.99;
    scene.add(gridHelper);
}

function animateModel() {
    animationId = requestAnimationFrame(animateModel);
    if (model) model.rotation.y += 0.005;
    if (renderer && scene && camera) renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('modelViewer');
    if (!container || !camera || !renderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// =============================================================================
// CONTROLES DEL VISOR
// =============================================================================

function setupMouseControls() {
    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };
    const container = document.getElementById('modelViewer');
    
    container.addEventListener('mousedown', (e) => { isMouseDown = true; previousMousePosition = { x: e.clientX, y: e.clientY }; });
    container.addEventListener('mousemove', (e) => {
        if (!isMouseDown || !camera) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        rotateCamera(deltaX, deltaY);
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('mouseup', () => isMouseDown = false);
    container.addEventListener('mouseleave', () => isMouseDown = false);
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.002;
        const direction = camera.position.clone().normalize();
        camera.position.addScaledVector(direction, -e.deltaY * zoomSpeed);
    }, { passive: false });
    
    // Touch controls
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
    container.addEventListener('touchend', () => isMouseDown = false);
}

function rotateCamera(deltaX, deltaY) {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);
    spherical.theta -= deltaX * 0.01;
    spherical.phi -= deltaY * 0.01;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
}

// =============================================================================
// RESULTADOS
// =============================================================================

function showResults() {
    currentProductId = generateProductId();
    const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
    const productUrl = `${baseUrl}viewer.html?id=${currentProductId}`;
    
    document.getElementById('productLink').value = productUrl;
    generateQRCode(productUrl);
    saveModelData();
    showScreen('result');
}

function generateProductId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `producto_${timestamp}_${random}`;
}

function generateQRCode(url) {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function saveModelData() {
    const modelData = {
        id: currentProductId,
        type: 'color-based',
        timestamp: Date.now(),
        colors: extractedColors,
        points: detectedPoints.points ? detectedPoints.points.slice(0, 50) : [],
        frameDimensions: {
            width: scanFrame.offsetWidth,
            height: scanFrame.offsetHeight
        }
    };
    
    try {
        localStorage.setItem('model_' + currentProductId, JSON.stringify(modelData));
        console.log('Modelo guardado en localStorage');
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
    }
}

function copyLink() {
    const linkInput = document.getElementById('productLink');
    const copyButton = document.getElementById('btnCopyLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value).then(() => {
        copyButton.textContent = 'Copiado!';
        copyButton.classList.add('copied');
        setTimeout(() => {
            copyButton.textContent = 'Copiar';
            copyButton.classList.remove('copied');
        }, 2000);
    }).catch(err => console.error('Error al copiar:', err));
}

// =============================================================================
// NAVEGACIÓN
// =============================================================================

function showScreen(screen) {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('scannerScreen').classList.remove('active');
    document.getElementById('resultScreen').classList.remove('active');
    
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

window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
});

console.log('Scanner.js cargado correctamente');

