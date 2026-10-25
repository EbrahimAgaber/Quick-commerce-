/**
 * Client-side Image Compression & Server Upload Utility
 * Resizes and compresses device/camera photos and brand logos to lightweight WebP/PNG data URLs
 * and uploads them to `/api/upload/image` so they are saved in `/public/uploads/` as clean static URLs
 * (`/uploads/<hash>.<ext>`), avoiding browser localStorage 5MB quota limits.
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

  let targetMaxWidth = Math.max(32, maxWidth);
  let targetMaxHeight = targetMaxWidth;
  let targetQuality = 0.85;

  if (typeof maxHeightOrQuality === 'number' && maxHeightOrQuality > 0 && maxHeightOrQuality <= 1.0) {
    targetQuality = maxHeightOrQuality;
    targetMaxHeight = targetMaxWidth;
  } else if (typeof maxHeightOrQuality === 'number' && maxHeightOrQuality > 1.0) {
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

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (isPng) {
            ctx.clearRect(0, 0, width, height);
          } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = '';
          if (isPng) {
            dataUrl = canvas.toDataURL('image/webp', targetQuality);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/png');
            }
          } else {
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

/**
 * Compresses an image file and uploads it to `/api/upload/image` on the local server.
 * Returns the clean static file URL (e.g. `/uploads/prod_a1b2c3d4.webp`).
 * Falls back gracefully to the compressed data URL if the server endpoint is unreachable.
 */
export async function uploadImageToServer(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number; prefix?: string }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 800;
  const maxHeight = options?.maxHeight ?? 800;
  const quality = options?.quality ?? 0.85;
  const prefix = options?.prefix ?? 'prod';

  const compressedDataUrl = await compressImageFile(file, maxWidth, maxHeight, quality);

  if (typeof fetch === 'function') {
    try {
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          image: compressedDataUrl,
          prefix,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const result = await response.json();
        if (result?.success && typeof result.url === 'string' && result.url.trim()) {
          return result.url.trim();
        }
      }
    } catch {
      // Fall back to compressedDataUrl if offline or running in unit tests without server
    }
  }

  return compressedDataUrl;
}
