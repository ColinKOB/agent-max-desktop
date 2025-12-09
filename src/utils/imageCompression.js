/**
 * Image Compression Utility
 * Compresses and resizes images before sending to reduce upload time.
 * Uses Canvas API for browser-compatible image processing.
 */

/**
 * Compress and resize an image to reduce file size
 * @param {string} dataUrl - Base64 data URL of the image
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 1920)
 * @param {number} options.maxHeight - Maximum height (default: 1080)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.8)
 * @returns {Promise<{dataUrl: string, originalSize: number, compressedSize: number, reduction: number}>}
 */
export async function compressImage(dataUrl, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate original size (approximate from base64)
        const originalSize = Math.round((dataUrl.length * 3) / 4);

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = Math.round(width / aspectRatio);
          } else {
            height = Math.min(height, maxHeight);
            width = Math.round(height * aspectRatio);
          }

          // Ensure we don't exceed either dimension
          if (width > maxWidth) {
            width = maxWidth;
            height = Math.round(width / aspectRatio);
          }
          if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * aspectRatio);
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Use better quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for better compression (unless it's a PNG with transparency)
        const isPng = dataUrl.startsWith('data:image/png');
        const outputFormat = isPng ? 'image/png' : 'image/jpeg';
        const outputQuality = isPng ? undefined : quality;

        const compressedDataUrl = canvas.toDataURL(outputFormat, outputQuality);
        const compressedSize = Math.round((compressedDataUrl.length * 3) / 4);

        const reduction = Math.round((1 - compressedSize / originalSize) * 100);

        console.log(`[ImageCompression] ${img.naturalWidth}x${img.naturalHeight} -> ${width}x${height}, ` +
          `${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${reduction}% reduction)`);

        resolve({
          dataUrl: compressedDataUrl,
          originalSize,
          compressedSize,
          reduction,
          originalDimensions: { width: img.naturalWidth, height: img.naturalHeight },
          newDimensions: { width, height },
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = dataUrl;
  });
}

/**
 * Process a file and return compressed image data if it's an image
 * @param {File} file - The file to process
 * @param {Object} options - Compression options (passed to compressImage)
 * @returns {Promise<{preview: string, type: string, file: File, compressionInfo?: Object}>}
 */
export async function processImageFile(file, options = {}) {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');

    if (!isImage) {
      // For non-images, read as text
      const textReader = new FileReader();
      textReader.onload = (ev) => {
        resolve({
          file,
          preview: null,
          type: 'file',
          content: ev.target.result,
        });
      };
      textReader.onerror = reject;
      textReader.readAsText(file);
      return;
    }

    // For images, read and compress
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const originalDataUrl = ev.target.result;
        const result = await compressImage(originalDataUrl, options);

        resolve({
          file,
          preview: result.dataUrl,
          type: 'image',
          compressionInfo: {
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            reduction: result.reduction,
          },
        });
      } catch (err) {
        console.error('[ImageCompression] Failed to compress, using original:', err);
        // Fallback to original if compression fails
        resolve({
          file,
          preview: ev.target.result,
          type: 'image',
        });
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default { compressImage, processImageFile };
