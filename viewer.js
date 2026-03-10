/**
 * =============================================================================
 * VISOR 3D AVANZADO - viewer.js
 * =============================================================================
 * Visualizador de modelos 3D con soporte para puntos y colores detectados
 */

let scene = null;
let camera = null;
let renderer = null;
let model = null;
let animationId = null;

let xrSession = null;
let xrRefSpace = null;
let xrHitTestSource = null;
let xrViewerSpace = null;

let productId = '';
let isARSupported = false;
let isARActive = false;

let canvas = null;
let videoElement = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando Visor 3D Avanzado...');
    
    canvas = document.getElementById('arScene');
    videoElement = document.getElementById('arVideo');
    
    productId = getProductIdFromURL();
    document.getElementById('productId').textContent = 'ID: ' + productId;
    
    setupEventListeners();
    await checkXRSupport();
    loadModel();
});

function getProductIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || 'desconocido';
}

function setupEventListeners() {
    document.getElementById('btnAR').addEventListener('click', startAR);
    document.getElementById('btnBack').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

async function checkXRSupport() {
    const btnAR = document.getElementById('btnAR');
    
    if (!navigator.xr) {
        console.log('WebXR no disponible');
        btnAR.textContent = 'AR no disponible';
        btnAR.disabled = true;
        isARSupported = false;
        return;
    }
    
    try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        
        if (supported) {
            console.log('WebXR AR disponible');
            isARSupported = true;
            btnAR.disabled = false;
            btnAR.textContent = 'Ver en AR';
        } else {
            console.log('WebXR AR no soportado');
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

function loadModel() {
    console.log('Cargando modelo:', productId);
    
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
        console.log('Modelo no encontrado, generando modelo demo');
    }
    
    init3DViewer(modelData);
}

function init3DViewer(modelData) {
    const container = document.getElementById('viewerContainer');
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1f35);
    
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const canvasContainer = document.getElementById('arScene').parentElement;
    if (canvasContainer) {
        canvasContainer.insertBefore(renderer.domElement, document.getElementById('arScene'));
        document.getElementById('arScene').style.display = 'none';
    }
    
    addLighting();
    
    model = generateDemoModel(modelData);
    model.position.y = 0;
    scene.add(model);
    
    addFloor();
    
    animate();
    
    setupControls();
    
    window.addEventListener('resize', onWindowResize);
}

function addLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadowMapSize.height = 2048;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

function generateDemoModel(modelData) {
    const hash = productId.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    let color;
    let geometry;
    
    // Usar colores guardados
    if (modelData && modelData.colors && modelData.colors.length > 0) {
        const dominantColor = modelData.colors[0];
        color = (dominantColor.r << 16) | (dominantColor.g << 8) | dominantColor.b;
    } else {
        const modelType = Math.abs(hash) % 4;
        switch (modelType) {
            case 0: color = 0x3498db; break;
            case 1: color = 0xe74c3c; break;
            case 2: color = 0x2ecc71; break;
            case 3: color = 0xf39c12; break;
        }
    }
    
    // Usar dimensiones guardadas
    let aspectRatio = 1;
    if (modelData && modelData.frameDimensions) {
        aspectRatio = modelData.frameDimensions.width / modelData.frameDimensions.height;
    } else {
        const modelType = Math.abs(hash) % 4;
        aspectRatio = modelType === 0 ? 1.5 : (modelType === 2 ? 0.6 : 1);
    }
    
    // Crear geometría basada en las proporciones
    if (aspectRatio > 1.3) {
        geometry = new THREE.BoxGeometry(1.5 * aspectRatio, 1.5, 1.2);
    } else if (aspectRatio < 0.7) {
        geometry = new THREE.CylinderGeometry(0.5, 0.7, 2, 32);
    } else {
        geometry = new THREE.SphereGeometry(1, 32, 32);
    }
    
    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
}

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
    
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    gridHelper.position.y = -0.99;
    scene.add(gridHelper);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (model) {
        model.rotation.y += 0.005;
    }
    
    if (renderer.xr.isPresenting) {
        return;
    }
    
    renderer.render(scene, camera);
}

function setupControls() {
    let isMouseDown = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const container = document.getElementById('viewerContainer');
    
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

function rotateCamera(deltaX, deltaY) {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);
    
    spherical.theta -= deltaX * 0.01;
    spherical.phi -= deltaY * 0.01;
    
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
}

function onWindowResize() {
    const container = document.getElementById('viewerContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

// =============================================================================
// REALIDAD AUMENTADA
// =============================================================================

async function startAR() {
    if (!isARSupported) {
        alert('AR no está disponible en este dispositivo');
        return;
    }
    
    console.log('Iniciando AR...');
    
    try {
        xrSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test', 'local-floor'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.getElementById('viewerContainer') }
        });
        
        xrSession.addEventListener('end', onARSessionEnded);
        
        renderer.xr.enabled = true;
        await renderer.xr.setSession(xrSession);
        
        xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
        
        xrViewerSpace = await xrSession.requestReferenceSpace('viewer');
        xrHitTestSource = await xrSession.requestHitTestSource({
            space: xrViewerSpace
        });
        
        isARActive = true;
        videoElement.style.display = 'block';
        canvas.style.display = 'none';
        
        document.getElementById('arIndicator').classList.add('active');
        
        document.getElementById('btnAR').textContent = 'Salir de AR';
        
        arAnimate();
        
        console.log('Sesión AR iniciada');
    } catch (error) {
        console.error('Error al iniciar AR:', error);
        alert('No se pudo iniciar AR: ' + error.message);
    }
}

function arAnimate() {
    if (!isARActive) return;
    
    animationId = requestAnimationFrame(arAnimate);
    
    renderer.render(scene, camera);
}

function onARSessionEnded() {
    console.log('Sesión AR finalizada');
    
    isARActive = false;
    xrSession = null;
    xrHitTestSource = null;
    
    videoElement.style.display = 'none';
    canvas.style.display = 'block';
    
    document.getElementById('arIndicator').classList.remove('active');
    
    document.getElementById('btnAR').textContent = 'Ver en AR';
    
    renderer.xr.enabled = false;
    
    animate();
}

window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada:', event.reason);
});

console.log('Viewer.js cargado correctamente');

