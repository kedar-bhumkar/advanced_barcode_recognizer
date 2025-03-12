---
title: Advanced Barcode Scanner
emoji: 📷
colorFrom: blue
colorTo: indigo
sdk: static
pinned: false
license: mit
---

# Advanced Barcode Scanner

A powerful web application that uses ZXing (Zebra Crossing) to detect and decode barcodes from uploaded images, camera feed, or captured still images.

## Features

- **Multiple Input Methods**:
  - Upload images containing barcodes
  - Use live camera feed for real-time scanning
  - Capture still images from camera for enhanced processing
  
- **Advanced Detection**:
  - Image enhancement with adjustable parameters
  - Multiple binarizers for improved detection
  - Fallback mechanisms when primary detection fails
  
- **Focus Mode**:
  - Full-screen camera view for better positioning
  - Visual guides with crosshair for precise alignment
  - Optimized processing parameters for difficult barcodes
  
- **Debug Mode**:
  - Real-time processing information
  - Detailed error reporting
  - Performance insights
  
- **User Experience**:
  - Visual feedback with barcode highlighting
  - Success sound on detection
  - Responsive design for all devices

## Supported Barcode Formats

This application can recognize various barcode formats including:
- QR Code
- Data Matrix
- Aztec
- PDF 417
- EAN-13 and EAN-8
- UPC-A and UPC-E
- Code 128
- Code 39
- Code 93
- Interleaved 2 of 5 (ITF)
- Codabar

## How It Works

This application uses ZXing (Zebra Crossing), a powerful barcode scanning library, to detect and decode barcodes. The process includes:

1. **Image Acquisition**: From upload, camera feed, or captured still
2. **Image Enhancement**: Adjusting brightness, contrast, and applying thresholds
3. **Barcode Detection**: Using multiple algorithms to locate barcodes
4. **Decoding**: Reading the actual data from the barcode
5. **Result Display**: Showing the decoded information and highlighting the barcode location

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (to load the ZXing library from CDN)
- Camera access (for live scanning and image capture features)
- HTTPS connection or localhost (required for camera access)

### Running the Application

1. Clone or download this repository
2. Open the `index.html` file in your web browser
3. Choose your preferred input method:
   - Click "Upload Image with Barcode" to select an image
   - Click "Start Camera" to use live scanning
   - When camera is active, use "Capture Image" for still image processing
4. Wait for the processing to complete
5. View the recognized barcode data in the results section

Alternatively, you can use a local web server to serve the files:

```bash
# Using Python 3
python -m http.server

# Using Node.js with http-server
npx http-server
```

Then navigate to `http://localhost:8000` (or the port specified by your server).

## Usage Tips

### For Uploaded Images
- Use clear, well-lit images
- Ensure the barcode is in focus
- Position the barcode to be as straight as possible

### For Live Camera Scanning
- Hold the camera steady
- Position the barcode within the guide box
- Ensure adequate lighting
- Toggle image enhancement if detection is difficult
- Use Focus Mode for challenging barcodes

### For Captured Images
- Use when live scanning isn't detecting the barcode
- Hold the camera steady before capturing
- Position the barcode clearly in frame
- Try with and without image enhancement

### Troubleshooting
- If a barcode isn't detected, try toggling the image enhancement option
- Enable Debug Mode to see detailed processing information
- For difficult barcodes, try Focus Mode or Capture Image feature
- Ensure adequate lighting and proper positioning

## License

This project is open source and available under the MIT License.

## Acknowledgements

- [ZXing](https://github.com/zxing-js/library) - JavaScript port of the ZXing barcode scanning library
- [Hugging Face](https://huggingface.co) - For hosting and sharing this application 