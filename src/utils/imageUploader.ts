/**
 * Client-side Image Compression Utility
 * Resizes and compresses device/camera photos and brand logos to lightweight WebP/PNG data URLs
 * while preserving full alpha transparency for PNGs and logos.
 * Handles both 3-param (file, maxDimension, quality) and 4-param (file, maxWidth, maxHeight, quality) signatures.
 */

export async function compressImageFile(
  file: File,
  maxWidth: number = 720,
  maxHeightOrQuality: number = 720,
  qualityParam?: number
): Promise<string> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
  }

  // Interpret flexible calling signatures:
  // e.g., compressImageFile(file, 400, 0.85) vs compressImageFile(file, 720, 720, 0.8)
  let targetMaxWidth = Math.max(32, maxWidth);
  let targetMaxHeight = targetMaxWidth;
  let targetQuality = 0.85;

  if (typeof maxHeightOrQuality === 'number' && maxHeightOrQuality > 0 && maxHeightOrQuality <= 1.0) {
    // The caller provided (file, maxDimension, quality)
    targetQuality = maxHeightOrQuality;
    targetMaxHeight = targetMaxWidth;
  } else if (typeof maxHeightOrQuality === 'number' && maxHeightOrQuality > 1.0) {
    // The caller provided (file, maxWidth, maxHeight, quality?)
    targetMaxHeight = Math.max(32, maxHeightOrQuality);
    if (typeof qualityParam === 'number' && qualityParam > 0 && qualityParam <= 1.0) {
      targetQuality = qualityParam;
    }
  }

  const isPng = file.type === 'image/png';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذر معالجة الصورة المختارة. يرجى تجربة صورة أخرى.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= 0 || height <= 0) {
            reject(new Error('أبعاد الصورة غير صالحة.'));
            return;
          }

          // Calculate aspect ratio scaling
          if (width > targetMaxWidth || height > targetMaxHeight) {
            const ratio = Math.min(targetMaxWidth / width, targetMaxHeight / height);
            width = Math.max(16, Math.round(width * ratio));
            height = Math.max(16, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('تعذر تهيئة معالج الصور في المتصفح.'));
            return;
          }

          // Enable high quality bicubic interpolation
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (isPng) {
            // For PNGs (especially logos with transparent backgrounds), keep transparency intact
            ctx.clearRect(0, 0, width, height);
          } else {
            // For JPEGs and opaque photos, fill with clean white background first to avoid black artifacts
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = '';
          if (isPng) {
            // For PNGs: try WebP with alpha first; if WebP is unsupported, fall back to PNG to guarantee transparency
            dataUrl = canvas.toDataURL('image/webp', targetQuality);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/png');
            }
          } else {
            // For non-PNGs: try WebP first, fallback to JPEG
            dataUrl = canvas.toDataURL('image/webp', targetQuality);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', targetQuality);
            }
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
