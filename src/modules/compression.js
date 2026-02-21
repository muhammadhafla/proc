// Image Compression Module
import { config } from './config.js';

/**
 * Compress an image from canvas or image element
 */
export async function compressImage(source, options = {}) {
  const {
    maxWidth = config.upload.maxImageSize,
    quality = config.upload.jpegQuality,
    format = 'jpeg',
  } = options;
  
  // Get dimensions from source
  let width = source.width || source.videoWidth;
  let height = source.height || source.videoHeight;
  
  // Validate source has valid dimensions
  if (!width || !height || width <= 0 || height <= 0) {
    console.error('Invalid source dimensions:', { width, height, sourceType: source.tagName });
    throw new Error('Invalid source image: dimensions are zero or undefined');
  }
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  
  // Draw scaled image
  ctx.drawImage(source, 0, 0, width, height);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Resize image to fit within max dimensions
 */
export async function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = async () => {
      let width = img.width;
      let height = img.height;
      
      // Validate image has valid dimensions
      if (!width || !height || width <= 0 || height <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image: dimensions are zero or undefined'));
        return;
      }
      
      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        'image/jpeg',
        0.8
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      if (!img.width || !img.height || img.width <= 0 || img.height <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image: dimensions are zero or undefined'));
        return;
      }
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(objectUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    
    img.src = objectUrl;
  });
}
