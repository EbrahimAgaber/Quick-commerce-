/**
 * Image CDN and Responsive Optimization Utility
 * 
 * Transforms image URLs to modern formats (AVIF / WebP) with explicit dimensions
 * and cache policies to eliminate Cumulative Layout Shift (CLS) and accelerate LCP.
 */

export interface OptimizedImageProps {
  src: string;
  width?: number;
  quality?: number;
}

/**
 * Optimizes an image URL via Unsplash or Cloudflare Image Resizing parameters
 */
export function getOptimizedImageUrl(src: string, width: number = 400, quality: number = 80): string {
  if (!src || typeof src !== 'string') return '';

  // 1. Unsplash dynamic format & width parameters
  if (src.includes('images.unsplash.com')) {
    const url = new URL(src);
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('w', width.toString());
    url.searchParams.set('q', quality.toString());
    return url.toString();
  }

  // 2. Cloudflare Images or custom image worker CDN
  if (src.includes('/cdn-cgi/image/')) {
    return src;
  }

  return src;
}
