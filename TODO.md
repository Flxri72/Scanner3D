# TODO - Prototipo Escáner 3D para E-commerce

## Fase 1: Estructura base y archivos principales
- [x] 1.1 Crear estructura de carpetas del proyecto
- [x] 1.2 Crear style.css con estilos globales
- [x] 1.3 Crear index.html con pantalla inicial y botones

## Fase 2: Lógica del escáner (scanner.js)
- [x] 2.1 Implementar acceso a cámara con getUserMedia
- [x] 2.2 Crear marco de escaneo arrastrable y redimensionable
- [x] 2.3 Implementar captura de imagen con Canvas API
- [x] 2.4 Crear animación de escaneo simulado
- [x] 2.5 Generar modelo 3D simple con Three.js
- [x] 2.6 Implementar visualizador 3D con Three.js
- [x] 2.7 Generar ID único y URL del producto
- [x] 2.8 Generar código QR con QRCode.js

## Fase 3: Página de visualización (viewer.html y viewer.js)
- [x] 3.1 Crear viewer.html con estructura base
- [x] 3.2 Implementar lectura de parámetro ID de URL
- [x] 3.3 Cargar modelo 3D generado
- [x] 3.4 Implementar WebXR para proyección AR
- [x] 3.5 Fallback con model-viewer para dispositivos sin WebXR

## Fase 4: Pruebas y validación
- [x] 4.1 Verificar que el servidor local funcione
- [x] 4.2 Probar flujo completo de escaneo
- [x] 4.3 Validar generación de QR y enlaces

## Estructura de archivos a crear:
```
/scanner3d-demo
  ├── index.html
  ├── scanner.js
  ├── viewer.html
  ├── viewer.js
  └── style.css
```

