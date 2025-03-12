document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const imageUpload = document.getElementById('imageUpload');
    const preview = document.getElementById('preview');
    const scanCanvas = document.getElementById('scanCanvas');
    const status = document.getElementById('status');
    const result = document.getElementById('result');
    
    // Camera elements - will be created dynamically
    let videoElement;
    let cameraContainer;
    let cameraControls;
    let startCameraButton;
    let stopCameraButton;
    let switchCameraButton;
    let enhancementToggle;
    let debugModeToggle;
    let cameraStream = null;
    let activeCameraId = null;
    let availableCameras = [];
    let isScanning = false;
    let scanInterval = null;
    let useImageEnhancement = true; // Default to true
    let debugMode = false; // Default to false
    let focusModeActive = false;

    // Check if ZXing library is loaded
    if (typeof ZXing === 'undefined') {
        status.textContent = 'Error: ZXing library not loaded';
        result.textContent = 'Please check your internet connection and reload the page.';
        console.error('ZXing library not loaded');
        return;
    }

    // Initialize ZXing code reader and hints
    const codeReader = new ZXing.BrowserMultiFormatReader();
    const hints = new Map();
    const formats = [
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.DATA_MATRIX,
        ZXing.BarcodeFormat.AZTEC,
        ZXing.BarcodeFormat.PDF_417,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.CODE_93,
        ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.CODABAR
    ];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    // Initialize the app
    function init() {
        status.textContent = 'Ready to scan barcodes. Upload an image or use camera.';
        createCameraElements();
        
        // Check if we're in a secure context (HTTPS or localhost)
        if (!isSecureContext()) {
            status.textContent = 'Camera access requires HTTPS. Current connection is not secure.';
            const warningDiv = document.createElement('div');
            warningDiv.className = 'security-warning';
            warningDiv.innerHTML = '<strong>Security Warning:</strong> Camera access requires a secure connection (HTTPS). ' +
                'You are currently on an insecure connection, which may prevent camera access. ' +
                'Please access this page via HTTPS or use localhost for testing.';
            document.querySelector('.container').insertBefore(warningDiv, document.querySelector('.upload-section'));
        }
        
        checkCameraSupport();
    }
    
    // Check if we're in a secure context (HTTPS or localhost)
    function isSecureContext() {
        // Check if the context is secure using the SecureContext API
        if (window.isSecureContext === true) {
            return true;
        }
        
        // Fallback check for older browsers
        return location.protocol === 'https:' || 
               location.hostname === 'localhost' || 
               location.hostname === '127.0.0.1';
    }

    // Create camera UI elements
    function createCameraElements() {
        // Create camera container
        cameraContainer = document.createElement('div');
        cameraContainer.id = 'camera-container';
        cameraContainer.className = 'camera-container';
        cameraContainer.style.display = 'none';
        
        // Create video element
        videoElement = document.createElement('video');
        videoElement.id = 'camera-feed';
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        
        // Create camera controls
        cameraControls = document.createElement('div');
        cameraControls.className = 'camera-controls';
        
        // Create camera buttons
        startCameraButton = document.createElement('button');
        startCameraButton.id = 'start-camera';
        startCameraButton.textContent = 'Start Camera';
        startCameraButton.addEventListener('click', startCamera);
        
        stopCameraButton = document.createElement('button');
        stopCameraButton.id = 'stop-camera';
        stopCameraButton.textContent = 'Stop Camera';
        stopCameraButton.style.display = 'none';
        stopCameraButton.addEventListener('click', stopCamera);
        
        switchCameraButton = document.createElement('button');
        switchCameraButton.id = 'switch-camera';
        switchCameraButton.textContent = 'Switch Camera';
        switchCameraButton.style.display = 'none';
        switchCameraButton.addEventListener('click', switchCamera);
        
        // Create capture image button
        const captureImageButton = document.createElement('button');
        captureImageButton.id = 'capture-image';
        captureImageButton.textContent = 'Capture Image';
        captureImageButton.style.display = 'none';
        captureImageButton.addEventListener('click', captureImage);
        
        // Create focus mode button
        const focusModeButton = document.createElement('button');
        focusModeButton.id = 'focus-mode';
        focusModeButton.textContent = 'Focus Mode';
        focusModeButton.style.display = 'none';
        focusModeButton.addEventListener('click', toggleFocusMode);
        
        // Create retry button for permission issues
        const retryPermissionButton = document.createElement('button');
        retryPermissionButton.id = 'retry-permission';
        retryPermissionButton.textContent = 'Retry Camera Permission';
        retryPermissionButton.style.display = 'none';
        retryPermissionButton.addEventListener('click', () => {
            retryPermissionButton.style.display = 'none';
            status.textContent = 'Requesting camera permission...';
            checkCameraSupport();
        });
        
        // Create enhancement toggle
        const enhancementContainer = document.createElement('div');
        enhancementContainer.className = 'enhancement-toggle-container';
        
        enhancementToggle = document.createElement('input');
        enhancementToggle.type = 'checkbox';
        enhancementToggle.id = 'enhancement-toggle';
        enhancementToggle.checked = useImageEnhancement;
        enhancementToggle.addEventListener('change', (e) => {
            useImageEnhancement = e.target.checked;
            status.textContent = useImageEnhancement ? 
                'Image enhancement enabled. This may help detect barcodes in difficult lighting.' : 
                'Image enhancement disabled. Use this if barcodes are not being detected correctly.';
        });
        
        const enhancementLabel = document.createElement('label');
        enhancementLabel.htmlFor = 'enhancement-toggle';
        enhancementLabel.textContent = 'Enable image enhancement';
        
        enhancementContainer.appendChild(enhancementToggle);
        enhancementContainer.appendChild(enhancementLabel);
        
        // Create debug mode toggle
        const debugContainer = document.createElement('div');
        debugContainer.className = 'enhancement-toggle-container debug-toggle-container';
        
        debugModeToggle = document.createElement('input');
        debugModeToggle.type = 'checkbox';
        debugModeToggle.id = 'debug-toggle';
        debugModeToggle.checked = debugMode;
        debugModeToggle.addEventListener('change', (e) => {
            debugMode = e.target.checked;
            status.textContent = debugMode ? 
                'Debug mode enabled. Processing details will be shown.' : 
                'Debug mode disabled.';
                
            // Create or remove debug info element
            let debugInfo = document.getElementById('debug-info');
            if (debugMode) {
                if (!debugInfo) {
                    debugInfo = document.createElement('div');
                    debugInfo.id = 'debug-info';
                    debugInfo.className = 'debug-info';
                    result.parentNode.appendChild(debugInfo);
                }
            } else {
                if (debugInfo) {
                    debugInfo.remove();
                }
            }
        });
        
        const debugLabel = document.createElement('label');
        debugLabel.htmlFor = 'debug-toggle';
        debugLabel.textContent = 'Debug mode';
        
        debugContainer.appendChild(debugModeToggle);
        debugContainer.appendChild(debugLabel);
        
        // Append elements
        cameraControls.appendChild(startCameraButton);
        cameraControls.appendChild(stopCameraButton);
        cameraControls.appendChild(switchCameraButton);
        cameraControls.appendChild(captureImageButton);
        cameraControls.appendChild(focusModeButton);
        cameraControls.appendChild(retryPermissionButton);
        cameraControls.appendChild(enhancementContainer);
        cameraControls.appendChild(debugContainer);
        cameraContainer.appendChild(videoElement);
        
        // Insert camera elements into the DOM
        const uploadSection = document.querySelector('.upload-section');
        uploadSection.parentNode.insertBefore(cameraContainer, uploadSection.nextSibling);
        uploadSection.parentNode.insertBefore(cameraControls, uploadSection.nextSibling);
    }

    // Check if camera is supported
    function checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Camera access not supported in this browser');
            startCameraButton.disabled = true;
            startCameraButton.title = 'Camera not supported in this browser';
            status.textContent = 'Camera not supported in this browser. Try using a modern browser like Chrome, Firefox, or Edge.';
            return false;
        }
        
        // First try to access the camera to trigger permission prompt
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                // Stop the stream immediately after getting permission
                stream.getTracks().forEach(track => track.stop());
                
                // Now enumerate devices after permission is granted
                return navigator.mediaDevices.enumerateDevices();
            })
            .then(devices => {
                availableCameras = devices.filter(device => device.kind === 'videoinput');
                console.log('Available cameras:', availableCameras);
                
                if (availableCameras.length === 0) {
                    startCameraButton.disabled = true;
                    startCameraButton.title = 'No cameras detected';
                    status.textContent = 'No cameras detected on your device';
                    return;
                }
                
                // Enable camera button
                startCameraButton.disabled = false;
                startCameraButton.title = 'Start camera for barcode scanning';
                status.textContent = 'Camera permission granted. Click "Start Camera" to begin scanning.';
                
                // Show switch camera button if multiple cameras available
                if (availableCameras.length > 1) {
                    switchCameraButton.style.display = 'inline-block';
                }
            })
            .catch(error => {
                console.error('Error accessing camera:', error);
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    status.textContent = 'Camera permission denied. Please click "Retry Camera Permission" and allow camera access when prompted.';
                    startCameraButton.disabled = true;
                    startCameraButton.title = 'Camera permission denied';
                    
                    // Show retry permission button
                    const retryButton = document.getElementById('retry-permission');
                    if (retryButton) {
                        retryButton.style.display = 'inline-block';
                    }
                } else {
                    // Try to enumerate devices anyway, in case permissions were granted before
                    navigator.mediaDevices.enumerateDevices()
                        .then(devices => {
                            availableCameras = devices.filter(device => device.kind === 'videoinput');
                            console.log('Available cameras (without permission):', availableCameras);
                            
                            if (availableCameras.length === 0) {
                                startCameraButton.disabled = true;
                                startCameraButton.title = 'No cameras detected';
                                status.textContent = 'No cameras detected on your device';
                            } else {
                                startCameraButton.disabled = false;
                                startCameraButton.title = 'Start camera for barcode scanning';
                                
                                if (availableCameras.length > 1) {
                                    switchCameraButton.style.display = 'inline-block';
                                }
                            }
                        })
                        .catch(enumError => {
                            console.error('Error enumerating devices:', enumError);
                            startCameraButton.disabled = true;
                            startCameraButton.title = 'Error accessing camera information';
                            status.textContent = 'Error accessing camera. Please check if your camera is connected and working properly.';
                        });
                }
            });
        
        return true;
    }

    // Start camera
    function startCamera() {
        // Hide image preview and show camera
        preview.style.display = 'none';
        cameraContainer.style.display = 'block';
        
        // Update buttons
        startCameraButton.style.display = 'none';
        stopCameraButton.style.display = 'inline-block';
        
        // Show focus mode and capture image buttons
        const focusModeButton = document.getElementById('focus-mode');
        const captureImageButton = document.getElementById('capture-image');
        if (focusModeButton) {
            focusModeButton.style.display = 'inline-block';
        }
        if (captureImageButton) {
            captureImageButton.style.display = 'inline-block';
        }
        
        // Clear previous results
        status.textContent = 'Starting camera...';
        result.textContent = '';
        
        // Try to get cameras again if none were detected initially
        if (availableCameras.length === 0) {
            navigator.mediaDevices.enumerateDevices()
                .then(devices => {
                    availableCameras = devices.filter(device => device.kind === 'videoinput');
                    console.log('Re-checking available cameras:', availableCameras);
                    continueStartCamera();
                })
                .catch(error => {
                    console.error('Error re-enumerating devices:', error);
                    continueStartCamera();
                });
        } else {
            continueStartCamera();
        }
    }
    
    // Continue camera startup after checking for cameras
    function continueStartCamera() {
        // Select camera (use first camera by default or previously selected)
        const cameraId = activeCameraId || (availableCameras.length > 0 ? availableCameras[0].deviceId : null);
        
        if (!cameraId) {
            // Try a more generic approach if no specific camera ID is available
            const constraints = {
                video: {
                    facingMode: 'environment' // Prefer back camera
                }
            };
            
            startCameraWithConstraints(constraints);
        } else {
            // Use specific camera ID
            const constraints = {
                video: {
                    deviceId: { exact: cameraId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            startCameraWithConstraints(constraints);
        }
    }
    
    // Start camera with specific constraints
    function startCameraWithConstraints(constraints) {
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                cameraStream = stream;
                videoElement.srcObject = stream;
                
                // Get the actual device ID from the stream
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    activeCameraId = settings.deviceId;
                    console.log('Active camera ID:', activeCameraId);
                    console.log('Camera settings:', settings);
                }
                
                // Wait for video to be ready
                videoElement.onloadedmetadata = () => {
                    status.textContent = 'Camera active. Point at a barcode to scan.';
                    startBarcodeScanning();
                };
            })
            .catch(error => {
                console.error('Error starting camera with constraints:', error, constraints);
                
                // If failed with specific constraints, try generic constraints
                if (constraints.video.deviceId) {
                    console.log('Trying generic camera constraints...');
                    startCameraWithConstraints({
                        video: {
                            facingMode: 'environment'
                        }
                    });
                } else {
                    status.textContent = 'Error starting camera: ' + (error.message || 'Unknown error');
                    stopCamera();
                }
            });
    }

    // Stop camera
    function stopCamera() {
        // Stop scanning
        stopBarcodeScanning();
        
        // Stop camera stream
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        
        // Update UI
        videoElement.srcObject = null;
        cameraContainer.style.display = 'none';
        startCameraButton.style.display = 'inline-block';
        stopCameraButton.style.display = 'none';
        
        // Hide focus mode and capture image buttons
        const focusModeButton = document.getElementById('focus-mode');
        const captureImageButton = document.getElementById('capture-image');
        if (focusModeButton) {
            focusModeButton.style.display = 'none';
        }
        if (captureImageButton) {
            captureImageButton.style.display = 'none';
        }
        
        // Remove focus mode if active
        document.body.classList.remove('focus-mode-active');
        
        status.textContent = 'Camera stopped. Upload an image or restart camera.';
    }

    // Switch between available cameras
    function switchCamera() {
        if (availableCameras.length <= 1) return;
        
        // Find next camera in the list
        const currentIndex = availableCameras.findIndex(camera => camera.deviceId === activeCameraId);
        const nextIndex = (currentIndex + 1) % availableCameras.length;
        activeCameraId = availableCameras[nextIndex].deviceId;
        
        // Restart camera with new device
        if (cameraStream) {
            stopCamera();
            startCamera();
        }
    }

    // Start continuous barcode scanning
    function startBarcodeScanning() {
        if (isScanning) return;
        isScanning = true;
        
        // Add scanning indicator
        const scanIndicator = document.createElement('div');
        scanIndicator.id = 'scan-indicator';
        scanIndicator.className = 'scan-indicator';
        cameraContainer.appendChild(scanIndicator);
        
        // Process frames at regular intervals
        scanInterval = setInterval(() => {
            if (!videoElement || !cameraStream) return;
            
            // Capture current frame
            const width = videoElement.videoWidth;
            const height = videoElement.videoHeight;
            
            if (width === 0 || height === 0) return; // Skip if video dimensions aren't available yet
            
            // Set canvas dimensions to match video
            scanCanvas.width = width;
            scanCanvas.height = height;
            
            // Draw video frame on canvas
            const ctx = scanCanvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, width, height);
            
            // Add scanning guide overlay
            drawScanningGuide(ctx, width, height);
            
            // Process the frame
            processVideoFrame(ctx, width, height);
        }, 100); // Scan more frequently (every 100ms instead of 200ms)
    }

    // Stop barcode scanning
    function stopBarcodeScanning() {
        isScanning = false;
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        
        // Remove scanning indicator if it exists
        const scanIndicator = document.getElementById('scan-indicator');
        if (scanIndicator) {
            scanIndicator.remove();
        }
    }
    
    // Draw scanning guide overlay
    function drawScanningGuide(ctx, width, height) {
        // Draw a semi-transparent guide rectangle in the center
        const guideSize = Math.min(width, height) * (focusModeActive ? 0.5 : 0.7); // Smaller guide in focus mode
        const x = (width - guideSize) / 2;
        const y = (height - guideSize) / 2;
        
        // Draw outer darkened area
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw transparent center
        ctx.clearRect(x, y, guideSize, guideSize);
        
        // Draw guide border
        ctx.strokeStyle = focusModeActive ? 'rgba(231, 76, 60, 0.8)' : 'rgba(52, 152, 219, 0.8)';
        ctx.lineWidth = focusModeActive ? 6 : 4;
        ctx.strokeRect(x, y, guideSize, guideSize);
        
        // Draw corner markers
        const markerLength = guideSize * 0.1;
        ctx.lineWidth = focusModeActive ? 8 : 6;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x, y + markerLength);
        ctx.lineTo(x, y);
        ctx.lineTo(x + markerLength, y);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + guideSize - markerLength, y);
        ctx.lineTo(x + guideSize, y);
        ctx.lineTo(x + guideSize, y + markerLength);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + guideSize, y + guideSize - markerLength);
        ctx.lineTo(x + guideSize, y + guideSize);
        ctx.lineTo(x + guideSize - markerLength, y + guideSize);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x + markerLength, y + guideSize);
        ctx.lineTo(x, y + guideSize);
        ctx.lineTo(x, y + guideSize - markerLength);
        ctx.stroke();
        
        // Add text instruction
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        
        if (focusModeActive) {
            ctx.fillText('FOCUS MODE: Position barcode in the red box', width / 2, y + guideSize + 30);
            
            // Add crosshair in focus mode
            const centerX = x + guideSize / 2;
            const centerY = y + guideSize / 2;
            const crosshairSize = guideSize * 0.1;
            
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 2;
            
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(centerX - crosshairSize, centerY);
            ctx.lineTo(centerX + crosshairSize, centerY);
            ctx.stroke();
            
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - crosshairSize);
            ctx.lineTo(centerX, centerY + crosshairSize);
            ctx.stroke();
        } else {
            ctx.fillText('Position barcode within the box', width / 2, y + guideSize + 30);
        }
    }

    // Process video frame for barcode detection
    function processVideoFrame(ctx, width, height) {
        try {
            // Pulse the scan indicator to show active scanning
            const scanIndicator = document.getElementById('scan-indicator');
            if (scanIndicator) {
                scanIndicator.classList.add('pulse');
                setTimeout(() => {
                    scanIndicator.classList.remove('pulse');
                }, 50);
            }
            
            // Update debug info
            if (debugMode) {
                updateDebugInfo('Processing frame', { width, height });
            }
            
            // Store original image data for fallback
            const originalImageData = ctx.getImageData(0, 0, width, height);
            
            // Apply image enhancements to improve detection if enabled
            if (useImageEnhancement) {
                enhanceImage(ctx, width, height);
                if (debugMode) {
                    updateDebugInfo('Image enhancement applied');
                }
            }
            
            // Create a data URL from the canvas for the BrowserMultiFormatReader
            const dataUrl = scanCanvas.toDataURL('image/png');
            
            // Try direct MultiFormatReader approach first (more reliable for video)
            try {
                // Create a ZXing HTMLCanvasElementLuminanceSource
                const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(scanCanvas);
                
                // Create a MultiFormatReader with hints
                const reader = new ZXing.MultiFormatReader();
                
                // Set up hints with all supported formats and try harder flag
                const newHints = new Map();
                newHints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
                newHints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                // Add these additional hints for better video frame detection
                newHints.set(ZXing.DecodeHintType.PURE_BARCODE, false);
                newHints.set(ZXing.DecodeHintType.CHARACTER_SET, "UTF-8");
                newHints.set(ZXing.DecodeHintType.ASSUME_GS1, false);
                reader.setHints(newHints);
                
                // Try different binarizers for better detection
                const binarizers = [
                    new ZXing.HybridBinarizer(luminanceSource),
                    new ZXing.GlobalHistogramBinarizer(luminanceSource)
                ];
                
                let decodedResult = null;
                let usedBinarizer = '';
                let errorMessages = [];
                
                // Try each binarizer
                for (const binarizer of binarizers) {
                    if (decodedResult) break; // Stop if we already found a result
                    
                    const binaryBitmap = new ZXing.BinaryBitmap(binarizer);
                    usedBinarizer = binarizer instanceof ZXing.HybridBinarizer ? 'HybridBinarizer' : 'GlobalHistogramBinarizer';
                    
                    if (debugMode) {
                        updateDebugInfo(`Trying ${usedBinarizer}`);
                    }
                    
                    try {
                        // Try to decode the image using the binary bitmap
                        const result = reader.decode(binaryBitmap);
                        
                        decodedResult = {
                            text: result.getText(),
                            format: result.getBarcodeFormat(),
                            resultPoints: result.getResultPoints()
                        };
                        
                        if (debugMode) {
                            updateDebugInfo(`Success with ${usedBinarizer}`, decodedResult);
                        }
                        
                    } catch (error) {
                        // Store error for debugging
                        errorMessages.push(`${usedBinarizer}: ${error.message || 'Unknown error'}`);
                        
                        if (debugMode) {
                            updateDebugInfo(`Failed with ${usedBinarizer}`, { error: error.message || 'Unknown error' });
                        }
                    }
                }
                
                // If we got a result from the direct approach
                if (decodedResult) {
                    // Barcode detected successfully
                    status.textContent = 'Barcode recognized successfully!';
                    
                    // Format the result
                    const resultText = `Code: ${decodedResult.text}\nFormat: ${decodedResult.format}`;
                    document.getElementById('result').textContent = resultText;
                    
                    // Draw the barcode location on the canvas
                    if (decodedResult.resultPoints && decodedResult.resultPoints.length > 0) {
                        drawBarcodeLocation(ctx, decodedResult.resultPoints);
                    }
                    
                    // Play success sound
                    playSuccessBeep();
                    
                    // Pause scanning briefly after successful detection
                    stopBarcodeScanning();
                    setTimeout(startBarcodeScanning, 2000);
                    return;
                }
                
                // If direct approach failed, try with original image if we enhanced it
                if (useImageEnhancement) {
                    // Restore original image
                    ctx.putImageData(originalImageData, 0, 0);
                    
                    if (debugMode) {
                        updateDebugInfo('Trying with original (non-enhanced) image');
                    }
                    
                    // Try again with original image
                    for (const binarizer of binarizers) {
                        if (decodedResult) break; // Stop if we already found a result
                        
                        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(scanCanvas);
                        const binaryBitmap = new ZXing.BinaryBitmap(binarizer);
                        usedBinarizer = binarizer instanceof ZXing.HybridBinarizer ? 'HybridBinarizer (original)' : 'GlobalHistogramBinarizer (original)';
                        
                        try {
                            // Try to decode the image using the binary bitmap
                            const result = reader.decode(binaryBitmap);
                            
                            decodedResult = {
                                text: result.getText(),
                                format: result.getBarcodeFormat(),
                                resultPoints: result.getResultPoints()
                            };
                            
                            if (debugMode) {
                                updateDebugInfo(`Success with ${usedBinarizer}`, decodedResult);
                            }
                            
                        } catch (error) {
                            // Store error for debugging
                            errorMessages.push(`${usedBinarizer}: ${error.message || 'Unknown error'}`);
                            
                            if (debugMode) {
                                updateDebugInfo(`Failed with ${usedBinarizer}`, { error: error.message || 'Unknown error' });
                            }
                        }
                    }
                    
                    // If we got a result from the original image
                    if (decodedResult) {
                        // Barcode detected successfully
                        status.textContent = 'Barcode recognized successfully!';
                        
                        // Format the result
                        const resultText = `Code: ${decodedResult.text}\nFormat: ${decodedResult.format}`;
                        document.getElementById('result').textContent = resultText;
                        
                        // Draw the barcode location on the canvas
                        if (decodedResult.resultPoints && decodedResult.resultPoints.length > 0) {
                            drawBarcodeLocation(ctx, decodedResult.resultPoints);
                        }
                        
                        // Play success sound
                        playSuccessBeep();
                        
                        // Pause scanning briefly after successful detection
                        stopBarcodeScanning();
                        setTimeout(startBarcodeScanning, 2000);
                        return;
                    }
                }
                
                // If all direct methods failed, fall back to BrowserMultiFormatReader
                if (debugMode) {
                    updateDebugInfo('Trying BrowserMultiFormatReader fallback');
                }
                
                // Use the BrowserMultiFormatReader to decode the image
                codeReader.decodeFromImageUrl(dataUrl)
                    .then(result => {
                        if (result) {
                            // Barcode detected successfully
                            status.textContent = 'Barcode recognized successfully!';
                            
                            // Format the result
                            const resultText = `Code: ${result.text}\nFormat: ${result.format}`;
                            document.getElementById('result').textContent = resultText;
                            
                            if (debugMode) {
                                updateDebugInfo('Success with BrowserMultiFormatReader', { 
                                    text: result.text, 
                                    format: result.format 
                                });
                            }
                            
                            // Draw the barcode location on the canvas if available
                            if (result.resultPoints && result.resultPoints.length > 0) {
                                drawBarcodeLocation(ctx, result.resultPoints);
                            }
                            
                            // Play success sound
                            playSuccessBeep();
                            
                            // Pause scanning briefly after successful detection
                            stopBarcodeScanning();
                            setTimeout(startBarcodeScanning, 2000);
                        }
                    })
                    .catch((error) => {
                        // No barcode detected with any method
                        if (debugMode) {
                            updateDebugInfo('Failed with all methods', { 
                                error: error.message || 'Unknown error',
                                allErrors: errorMessages.join(', ')
                            });
                        }
                    });
                
            } catch (directError) {
                // If direct MultiFormatReader approach fails completely, fall back to BrowserMultiFormatReader
                if (debugMode) {
                    updateDebugInfo('Direct MultiFormatReader failed, trying BrowserMultiFormatReader', { 
                        error: directError.message || 'Unknown error' 
                    });
                }
                
                // Use the BrowserMultiFormatReader to decode the image
                codeReader.decodeFromImageUrl(dataUrl)
                    .then(result => {
                        if (result) {
                            // Barcode detected successfully
                            status.textContent = 'Barcode recognized successfully!';
                            
                            // Format the result
                            const resultText = `Code: ${result.text}\nFormat: ${result.format}`;
                            document.getElementById('result').textContent = resultText;
                            
                            if (debugMode) {
                                updateDebugInfo('Success with BrowserMultiFormatReader', { 
                                    text: result.text, 
                                    format: result.format 
                                });
                            }
                            
                            // Draw the barcode location on the canvas if available
                            if (result.resultPoints && result.resultPoints.length > 0) {
                                drawBarcodeLocation(ctx, result.resultPoints);
                            }
                            
                            // Play success sound
                            playSuccessBeep();
                            
                            // Pause scanning briefly after successful detection
                            stopBarcodeScanning();
                            setTimeout(startBarcodeScanning, 2000);
                        }
                    })
                    .catch((error) => {
                        // No barcode detected with any method
                        if (debugMode) {
                            updateDebugInfo('Failed with all methods', { 
                                error: error.message || 'Unknown error' 
                            });
                        }
                    });
            }
            
        } catch (error) {
            console.error('Error processing video frame:', error);
            if (debugMode) {
                updateDebugInfo('Error processing frame', { error: error.message || 'Unknown error' });
            }
        }
    }
    
    // Update debug information
    function updateDebugInfo(action, data = {}) {
        if (!debugMode) return;
        
        const debugInfo = document.getElementById('debug-info');
        if (!debugInfo) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'debug-entry';
        
        let content = `<strong>${timestamp}</strong>: ${action}`;
        
        if (Object.keys(data).length > 0) {
            content += '<ul>';
            for (const [key, value] of Object.entries(data)) {
                content += `<li><strong>${key}:</strong> ${value}</li>`;
            }
            content += '</ul>';
        }
        
        entry.innerHTML = content;
        
        // Add to the top
        if (debugInfo.firstChild) {
            debugInfo.insertBefore(entry, debugInfo.firstChild);
        } else {
            debugInfo.appendChild(entry);
        }
        
        // Limit entries to 10
        while (debugInfo.children.length > 10) {
            debugInfo.removeChild(debugInfo.lastChild);
        }
    }

    // Enhance image to improve barcode detection
    function enhanceImage(ctx, width, height) {
        try {
            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Try different enhancement approaches
            // First, store the original image data
            const originalData = new Uint8ClampedArray(data);
            
            // Image enhancement parameters - adjust based on focus mode
            const brightness = focusModeActive ? 20 : 15; // -255 to 255
            const contrast = focusModeActive ? 1.4 : 1.3;  // 0 to 2+
            const threshold = focusModeActive ? 135 : 128; // 0 to 255 (middle value for better results)
            
            // Apply brightness, contrast, and threshold
            for (let i = 0; i < data.length; i += 4) {
                // Apply brightness
                data[i] += brightness;     // R
                data[i + 1] += brightness; // G
                data[i + 2] += brightness; // B
                
                // Apply contrast
                data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast) + 128));     // R
                data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast) + 128)); // G
                data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast) + 128)); // B
                
                // Calculate grayscale value
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                
                // Apply threshold for better barcode detection
                // This creates higher contrast between dark and light areas
                if (gray < threshold) {
                    data[i] = 0;     // R
                    data[i + 1] = 0; // G
                    data[i + 2] = 0; // B
                } else {
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                }
            }
            
            // Put the modified image data back on the canvas
            ctx.putImageData(imageData, 0, 0);
            
            // Apply sharpening filter
            applySharpening(ctx, width, height);
            
            // Store this enhanced version for potential fallback
            const enhancedImageData = ctx.getImageData(0, 0, width, height);
            
            // If debug mode is on, we'll keep the enhanced image visible
            if (!debugMode) {
                // For non-debug mode, we'll try a less aggressive approach as a fallback
                // This will be used in the next scan cycle if the current one fails
                window.lastEnhancedImageData = enhancedImageData;
                window.originalImageData = originalData;
                window.lastImageDimensions = { width, height };
            }
            
        } catch (error) {
            console.error('Error enhancing image:', error);
        }
    }
    
    // Apply sharpening filter to the image
    function applySharpening(ctx, width, height) {
        try {
            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const dataBackup = new Uint8ClampedArray(data);
            
            // Sharpening kernel - less aggressive
            const kernel = [
                0, -0.5, 0,
                -0.5, 3, -0.5,
                0, -0.5, 0
            ];
            
            // Apply convolution
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const offset = (y * width + x) * 4;
                    
                    // For each color channel
                    for (let c = 0; c < 3; c++) {
                        let val = 0;
                        
                        // Apply kernel
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                                val += dataBackup[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                            }
                        }
                        
                        // Set the new value
                        data[offset + c] = Math.min(255, Math.max(0, val));
                    }
                }
            }
            
            // Put the modified image data back on the canvas
            ctx.putImageData(imageData, 0, 0);
            
        } catch (error) {
            console.error('Error applying sharpening:', error);
        }
    }

    // Play a success beep sound
    function playSuccessBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.error('Error playing success beep:', error);
        }
    }

    // Handle image upload
    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Stop camera if running
        stopCamera();

        // Check if file is an image
        if (!file.type.match('image.*')) {
            status.textContent = 'Error: Not an image file';
            result.textContent = 'Please upload an image file (JPEG, PNG, etc.)';
            return;
        }

        // Display image preview
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.src = event.target.result;
            preview.style.display = 'block';
            
            // Process the image with ZXing after it's loaded
            preview.onload = () => {
                processImage(preview);
            };
        };
        reader.onerror = () => {
            status.textContent = 'Error: Failed to read file';
            result.textContent = 'There was an error reading the file. Please try again.';
        };
        reader.readAsDataURL(file);
    });

    // Process image with ZXing
    async function processImage(imageElement) {
        status.textContent = 'Processing image...';
        result.textContent = '';

        try {
            // Get image dimensions
            const width = imageElement.naturalWidth;
            const height = imageElement.naturalHeight;

            // Set canvas dimensions to match image
            scanCanvas.width = width;
            scanCanvas.height = height;
            
            // Draw image on canvas
            const ctx = scanCanvas.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, width, height);

            // Create a ZXing HTMLCanvasElementLuminanceSource
            const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(scanCanvas);
            const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
            
            try {
                // Create a multi-format reader
                const reader = new ZXing.MultiFormatReader();
                reader.setHints(hints);
                
                // Try to decode the image using the binary bitmap
                const decodedResult = reader.decode(binaryBitmap);
                
                // Barcode detected successfully
                status.textContent = 'Barcode recognized successfully!';
                
                // Format the result
                const resultText = `Code: ${decodedResult.getText()}\nFormat: ${decodedResult.getBarcodeFormat()}`;
                document.getElementById('result').textContent = resultText;
                
                // Draw the barcode location on the canvas
                drawBarcodeLocation(ctx, decodedResult.getResultPoints());
                
            } catch (error) {
                // Try alternative method if the first one fails
                try {
                    // Use the BrowserMultiFormatReader as a fallback
                    const result = await codeReader.decodeFromImageUrl(imageElement.src);
                    
                    // Barcode detected successfully
                    status.textContent = 'Barcode recognized successfully!';
                    
                    // Format the result
                    const resultText = `Code: ${result.text}\nFormat: ${result.format}`;
                    document.getElementById('result').textContent = resultText;
                    
                    // Draw the barcode location on the canvas if available
                    if (result.resultPoints && result.resultPoints.length > 0) {
                        drawBarcodeLocation(ctx, result.resultPoints);
                    }
                    
                } catch (secondError) {
                    // Try one more approach with different binarizer
                    try {
                        const globalHistogramBinarizer = new ZXing.GlobalHistogramBinarizer(luminanceSource);
                        const secondBinaryBitmap = new ZXing.BinaryBitmap(globalHistogramBinarizer);
                        
                        const reader = new ZXing.MultiFormatReader();
                        reader.setHints(hints);
                        const thirdResult = reader.decode(secondBinaryBitmap);
                        
                        status.textContent = 'Barcode recognized successfully!';
                        const resultText = `Code: ${thirdResult.getText()}\nFormat: ${thirdResult.getBarcodeFormat()}`;
                        document.getElementById('result').textContent = resultText;
                        
                        drawBarcodeLocation(ctx, thirdResult.getResultPoints());
                    } catch (thirdError) {
                        // No barcode detected after all attempts
                        status.textContent = 'No barcode detected';
                        result.textContent = 'Could not detect a valid barcode in the image. Please try another image with a clearer barcode.';
                        console.error('ZXing errors:', error, secondError, thirdError);
                    }
                }
            }
        } catch (error) {
            // Handle any exceptions during processing
            status.textContent = 'Error processing image';
            result.textContent = error.message || 'An unexpected error occurred';
            console.error('Error in processImage:', error);
        }
    }

    // Draw barcode location on canvas
    function drawBarcodeLocation(ctx, points) {
        if (!points || points.length === 0) return;
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red color for detected barcodes
        ctx.lineWidth = 5;
        
        ctx.beginPath();
        
        // For QR codes and other 2D barcodes (usually 4 points)
        if (points.length >= 4) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.lineTo(points[2].x, points[2].y);
            ctx.lineTo(points[3].x, points[3].y);
            ctx.lineTo(points[0].x, points[0].y);
        } 
        // For 1D barcodes (usually 2 points)
        else if (points.length >= 2) {
            // Calculate the corners of a rectangle for the barcode
            const p1 = points[0];
            const p2 = points[points.length - 1];
            
            // Calculate the width of the barcode (perpendicular to the line)
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const perpAngle = angle + Math.PI / 2;
            const width = 20; // Width of the barcode rectangle
            
            // Calculate the four corners of the rectangle
            const corners = [
                { x: p1.x - width * Math.cos(perpAngle), y: p1.y - width * Math.sin(perpAngle) },
                { x: p1.x + width * Math.cos(perpAngle), y: p1.y + width * Math.sin(perpAngle) },
                { x: p2.x + width * Math.cos(perpAngle), y: p2.y + width * Math.sin(perpAngle) },
                { x: p2.x - width * Math.cos(perpAngle), y: p2.y - width * Math.sin(perpAngle) }
            ];
            
            // Draw the rectangle
            ctx.moveTo(corners[0].x, corners[0].y);
            ctx.lineTo(corners[1].x, corners[1].y);
            ctx.lineTo(corners[2].x, corners[2].y);
            ctx.lineTo(corners[3].x, corners[3].y);
            ctx.lineTo(corners[0].x, corners[0].y);
        }
        
        ctx.stroke();
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && cameraStream) {
            // Pause scanning when page is not visible
            stopBarcodeScanning();
        } else if (!document.hidden && cameraStream && !isScanning) {
            // Resume scanning when page becomes visible again
            startBarcodeScanning();
        }
    });

    // Toggle focus mode for better barcode scanning
    function toggleFocusMode() {
        focusModeActive = !focusModeActive;
        
        const focusModeButton = document.getElementById('focus-mode');
        if (focusModeButton) {
            focusModeButton.textContent = focusModeActive ? 'Exit Focus Mode' : 'Focus Mode';
            focusModeButton.classList.toggle('active', focusModeActive);
        }
        
        document.body.classList.toggle('focus-mode-active', focusModeActive);
        
        if (focusModeActive) {
            status.textContent = 'Focus Mode active. Hold barcode steady in the center of the screen.';
            
            // Pause and restart scanning to apply new settings
            if (isScanning) {
                stopBarcodeScanning();
                startBarcodeScanning();
            }
        } else {
            status.textContent = 'Focus Mode disabled. Camera active.';
            
            // Pause and restart scanning to apply new settings
            if (isScanning) {
                stopBarcodeScanning();
                startBarcodeScanning();
            }
        }
    }

    // Capture a still image from the camera feed
    function captureImage() {
        if (!videoElement || !cameraStream) {
            status.textContent = 'Camera not active. Cannot capture image.';
            return;
        }
        
        try {
            // Temporarily pause scanning
            const wasScanning = isScanning;
            if (isScanning) {
                stopBarcodeScanning();
            }
            
            // Get video dimensions
            const width = videoElement.videoWidth;
            const height = videoElement.videoHeight;
            
            if (width === 0 || height === 0) {
                status.textContent = 'Cannot capture image. Video feed not ready.';
                if (wasScanning) {
                    startBarcodeScanning();
                }
                return;
            }
            
            // Create a temporary canvas for the capture
            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = width;
            captureCanvas.height = height;
            
            // Draw the current video frame to the canvas
            const ctx = captureCanvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, width, height);
            
            // Create an image element from the canvas
            const capturedImage = new Image();
            capturedImage.onload = () => {
                // Display the captured image
                preview.src = capturedImage.src;
                preview.style.display = 'block';
                
                // Hide camera feed temporarily
                cameraContainer.style.display = 'none';
                
                // Process the captured image
                status.textContent = 'Processing captured image...';
                processImage(capturedImage, true);
            };
            
            // Convert canvas to data URL and set as image source
            capturedImage.src = captureCanvas.toDataURL('image/png');
            
            // Show a notification
            status.textContent = 'Image captured from camera. Processing...';
            
        } catch (error) {
            console.error('Error capturing image:', error);
            status.textContent = 'Error capturing image: ' + (error.message || 'Unknown error');
            
            // Resume scanning if it was active
            if (wasScanning) {
                startBarcodeScanning();
            }
        }
    }

    // Process image with ZXing
    async function processImage(imageElement, fromCamera = false) {
        status.textContent = 'Processing image...';
        result.textContent = '';

        try {
            // Get image dimensions
            const width = imageElement.naturalWidth;
            const height = imageElement.naturalHeight;

            // Set canvas dimensions to match image
            scanCanvas.width = width;
            scanCanvas.height = height;
            
            // Draw image on canvas
            const ctx = scanCanvas.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, width, height);
            
            // Apply image enhancement if enabled
            if (useImageEnhancement) {
                enhanceImage(ctx, width, height);
                if (debugMode) {
                    updateDebugInfo('Image enhancement applied to captured image');
                }
            }

            // Create a ZXing HTMLCanvasElementLuminanceSource
            const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(scanCanvas);
            
            // Try different binarizers for better detection
            const binarizers = [
                new ZXing.HybridBinarizer(luminanceSource),
                new ZXing.GlobalHistogramBinarizer(luminanceSource)
            ];
            
            let decodedResult = null;
            let usedBinarizer = '';
            let errorMessages = [];
            
            // Try each binarizer
            for (const binarizer of binarizers) {
                if (decodedResult) break; // Stop if we already found a result
                
                const binaryBitmap = new ZXing.BinaryBitmap(binarizer);
                usedBinarizer = binarizer instanceof ZXing.HybridBinarizer ? 'HybridBinarizer' : 'GlobalHistogramBinarizer';
                
                if (debugMode) {
                    updateDebugInfo(`Trying ${usedBinarizer} on captured image`);
                }
                
                try {
                    // Create a multi-format reader with hints
                    const reader = new ZXing.MultiFormatReader();
                    
                    // Set up hints with all supported formats and try harder flag
                    const newHints = new Map();
                    newHints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
                    newHints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                    newHints.set(ZXing.DecodeHintType.PURE_BARCODE, false);
                    newHints.set(ZXing.DecodeHintType.CHARACTER_SET, "UTF-8");
                    reader.setHints(newHints);
                    
                    // Try to decode the image using the binary bitmap
                    const result = reader.decode(binaryBitmap);
                    
                    decodedResult = {
                        text: result.getText(),
                        format: result.getBarcodeFormat(),
                        resultPoints: result.getResultPoints()
                    };
                    
                    if (debugMode) {
                        updateDebugInfo(`Success with ${usedBinarizer} on captured image`, decodedResult);
                    }
                    
                } catch (error) {
                    // Store error for debugging
                    errorMessages.push(`${usedBinarizer}: ${error.message || 'Unknown error'}`);
                    
                    if (debugMode) {
                        updateDebugInfo(`Failed with ${usedBinarizer} on captured image`, { error: error.message || 'Unknown error' });
                    }
                }
            }
            
            // If we got a result from the direct approach
            if (decodedResult) {
                // Barcode detected successfully
                status.textContent = 'Barcode recognized successfully!';
                
                // Format the result
                const resultText = `Code: ${decodedResult.text}\nFormat: ${decodedResult.format}`;
                document.getElementById('result').textContent = resultText;
                
                // Draw the barcode location on the canvas
                if (decodedResult.resultPoints && decodedResult.resultPoints.length > 0) {
                    drawBarcodeLocation(ctx, decodedResult.resultPoints);
                }
                
                // Play success sound
                playSuccessBeep();
                
                // If this was from a camera capture, show a button to return to camera
                if (fromCamera) {
                    showReturnToCameraButton();
                }
                
                return;
            }
            
            // If direct approach failed, try BrowserMultiFormatReader as fallback
            try {
                // Use the BrowserMultiFormatReader as a fallback
                const dataUrl = scanCanvas.toDataURL('image/png');
                const result = await codeReader.decodeFromImageUrl(dataUrl);
                
                // Barcode detected successfully
                status.textContent = 'Barcode recognized successfully!';
                
                // Format the result
                const resultText = `Code: ${result.text}\nFormat: ${result.format}`;
                document.getElementById('result').textContent = resultText;
                
                // Draw the barcode location on the canvas if available
                if (result.resultPoints && result.resultPoints.length > 0) {
                    drawBarcodeLocation(ctx, result.resultPoints);
                }
                
                // Play success sound
                playSuccessBeep();
                
                // If this was from a camera capture, show a button to return to camera
                if (fromCamera) {
                    showReturnToCameraButton();
                }
                
            } catch (error) {
                // No barcode detected after all attempts
                status.textContent = 'No barcode detected';
                result.textContent = 'Could not detect a valid barcode in the image. Please try again with a clearer image.';
                
                if (debugMode) {
                    updateDebugInfo('Failed with all methods on captured image', { 
                        error: error.message || 'Unknown error',
                        allErrors: errorMessages.join(', ')
                    });
                }
                
                // If this was from a camera capture, show a button to return to camera
                if (fromCamera) {
                    showReturnToCameraButton();
                }
            }
            
        } catch (error) {
            // Handle any exceptions during processing
            status.textContent = 'Error processing image';
            result.textContent = error.message || 'An unexpected error occurred';
            console.error('Error in processImage:', error);
            
            // If this was from a camera capture, show a button to return to camera
            if (fromCamera) {
                showReturnToCameraButton();
            }
        }
    }
    
    // Show a button to return to camera view after processing a captured image
    function showReturnToCameraButton() {
        // Check if button already exists
        let returnButton = document.getElementById('return-to-camera');
        if (returnButton) {
            returnButton.style.display = 'inline-block';
            return;
        }
        
        // Create return to camera button
        returnButton = document.createElement('button');
        returnButton.id = 'return-to-camera';
        returnButton.className = 'return-to-camera-btn';
        returnButton.textContent = 'Return to Camera';
        returnButton.addEventListener('click', () => {
            // Hide the preview and show the camera
            preview.style.display = 'none';
            cameraContainer.style.display = 'block';
            
            // Hide the return button
            returnButton.style.display = 'none';
            
            // Restart scanning
            startBarcodeScanning();
            
            status.textContent = 'Returned to camera. Point at a barcode to scan.';
        });
        
        // Add to the DOM
        const resultSection = document.getElementById('result').parentNode;
        resultSection.appendChild(returnButton);
    }

    // Initialize the app
    init();
});