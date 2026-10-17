/**
 * Client-side Image Compression Utility
 * Resizes and compresses device/camera photos to lightweight WebP/JPEG data URLs (~25-45 KB)
 * so merchants can upload photos directly from their phone or computer without needing external URLs,
 * while staying well below Firestore's 1 MiB document size limit.
 */

export async function compressImageFile(
  file: File,
  maxWidth: number = 720,
  maxHeight: number = 720,
  quality: number = 0.78
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذر معالجة الصورة المختارة.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('تعذر تهيئة معالج الصور في المتصفح.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first for smallest size, fallback to JPEG
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
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
