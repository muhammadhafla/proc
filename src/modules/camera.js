// Shared Camera Module
// Reusable camera functionality for capture and batch pages
import { compressImage } from './compression.js';
import { showNotification } from './app.js';

// Global blob URL tracker for memory leak prevention
const activeBlobUrls = new Set();

/**
 * Create a blob URL and track it
 * @param {Blob} blob - The blob to create URL for
 * @returns {string} - The object URL
 */
export function createBlobUrl(blob) {
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);
  return url;
}

/**
 * Revoke a specific blob URL
 * @param {string} url - The URL to revoke
 */
export function revokeBlobUrl(url) {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

/**
 * Revoke all tracked blob URLs (call on navigation)
 */
export function revokeAllBlobUrls() {
  activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
  activeBlobUrls.clear();
}

/**
 * @typedef {Object} CameraConfig
 * @property {string} [facingMode] - 'environment' or 'user'
 * @property {number} [idealWidth] - Ideal video width
 * @property {number} [idealHeight] - Ideal video height
 */

/**
 * @typedef {Object} CaptureOptions
 * @property {number} [maxWidth] - Max width for compression
 * @property {number} [quality] - JPEG quality (0-1)
 * @property {string} [format] - Output format (jpeg, png, webp)
 * @property {boolean} [drawOverlay] - Whether to draw overlay text
 * @property {string} [overlayText] - Text to overlay
 * @property {string} [timestamp] - Timestamp to display
 */

/**
 * @typedef {Object} CaptureResult
 * @property {Blob} blob - Compressed image blob
 * @property {HTMLCanvasElement} canvas - Canvas used for capture
 */

// Global camera state (module-level, not window)
let _videoStream = null;
let _currentFacingMode = 'environment';

/**
 * Get current video stream
 * @returns {MediaStream|null}
 */
export function getVideoStream() {
  return _videoStream;
}

/**
 * Initialize camera
 * @param {CameraConfig} config - Camera configuration
 * @returns {Promise<MediaStream>}
 */
export async function initCamera(config = {}) {
  const video = document.getElementById('camera-preview');
  const facingMode = config.facingMode || _currentFacingMode;
  const idealWidth = config.idealWidth || 1920;
  const idealHeight = config.idealHeight || 1080;

  try {
    _videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
      },
      audio: false,
    });

    video.srcObject = _videoStream;
    await video.play();
    
    return _videoStream;
  } catch (error) {
    console.error('Camera error:', error);
    handleCameraError(error);
    throw error;
  }
}

/**
 * Handle camera errors with user-friendly messages
 * @param {Error} error - Camera error
 */
function handleCameraError(error) {
  if (error.name === 'NotAllowedError' || error.message.includes('Permission')) {
    showNotification('Camera access denied. Please enable camera permissions in your browser settings.', 'error');
  } else if (error.name === 'NotFoundError') {
    showNotification('No camera found on this device', 'error');
  } else {
    showNotification('Failed to access camera', 'error');
  }
}

/**
 * Stop camera and release resources
 */
export function stopCamera() {
  if (_videoStream) {
    _videoStream.getTracks().forEach(track => track.stop());
    _videoStream = null;
  }
}

/**
 * Switch between front and back camera
 * @returns {Promise<MediaStream>}
 */
export async function switchCamera() {
  _currentFacingMode = _currentFacingMode === 'environment' ? 'user' : 'environment';
  return initCamera();
}

/**
 * Get current facing mode
 * @returns {string}
 */
export function getCurrentFacingMode() {
  return _currentFacingMode;
}

/**
 * Capture image from video stream
 * @param {CaptureOptions} options - Capture options
 * @returns {Promise<CaptureResult>}
 */
export async function captureImage(options = {}) {
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  
  const maxWidth = options.maxWidth || 1200;
  const quality = options.quality || 0.7;
  const format = options.format || 'jpeg';
  const drawOverlay = options.drawOverlay !== false;
  const overlayText = options.overlayText || '';
  const timestamp = options.timestamp || '';

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Validate video dimensions
  if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
    showNotification('Video not ready. Please try capturing again.', 'error');
    throw new Error('Invalid video dimensions');
  }

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  // Draw overlay if provided
  if (drawOverlay && (overlayText || timestamp)) {
    drawImageOverlay(ctx, canvas.width, canvas.height, overlayText, timestamp);
  }

  // Compress and return
  const blob = await compressImage(canvas, {
    maxWidth,
    quality,
    format,
  });

  return { blob, canvas };
}

/**
 * Draw overlay text on image
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {string} overlayText - Main text to overlay
 * @param {string} timestamp - Timestamp to display
 */
export function drawImageOverlay(ctx, width, height, overlayText, timestamp) {
  const fontSize = Math.max(24, Math.floor(width / 40));
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = fontSize / 8;

  const padding = fontSize * 1.5;
  const textY = height - padding - (timestamp ? fontSize * 1.5 : 0);

  // Text shadow/background for readability
  if (overlayText) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const textWidth = ctx.measureText(overlayText).width;
    ctx.fillRect(padding - 10, textY - fontSize, textWidth + 20, fontSize * 2.5);

    // Draw main text
    ctx.fillStyle = 'white';
    ctx.strokeText(overlayText, padding, textY);
    ctx.fillText(overlayText, padding, textY);
  }

  // Draw timestamp below
  if (timestamp) {
    ctx.font = `bold ${Math.max(16, fontSize * 0.7)}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(timestamp, padding, textY + fontSize * 1.2);
  }
}

/**
 * Create preview from blob
 * @param {Blob} blob - Image blob
 * @param {string} imageId - ID of image element
 * @param {string} containerId - ID of container element
 * @returns {string} - Object URL created
 */
export function showPreview(blob, imageId, containerId) {
  const img = document.getElementById(imageId);
  const container = containerId ? document.getElementById(containerId) : null;

  // Revoke previous URL if exists
  if (img.src && img.src.startsWith('blob:')) {
    revokeBlobUrl(img.src);
  }

  const imageUrl = createBlobUrl(blob);
  img.src = imageUrl;

  if (container) {
    container.classList.remove('hidden');
  }

  return imageUrl;
}

/**
 * Hide preview and revoke URL
 * @param {string} imageId - ID of image element
 * @param {string} containerId - ID of container element
 */
export function hidePreview(imageId, containerId) {
  const img = document.getElementById(imageId);
  const container = containerId ? document.getElementById(containerId) : null;

  if (img.src && img.src.startsWith('blob:')) {
    revokeBlobUrl(img.src);
  }

  if (container) {
    container.classList.add('hidden');
  }
}

/**
 * Clean up camera resources (call when leaving page)
 */
export function cleanupCamera() {
  stopCamera();
  revokeAllBlobUrls();
}
