import React, { useState, useEffect, useMemo } from 'react';
import { Package, ShoppingBag } from 'lucide-react';
import { getImageFallbackCandidates, isLegacyWatchPlaceholder } from '../../utils/imageOptimizer';

export interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  accentColor?: string;
  primaryColor?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * High-end E-Commerce Product Image Component
 * - Smooth animated shimmer skeleton while loading
 * - Multi-endpoint automatic retry for Google Drive URLs (lh3 -> thumbnail -> uc) with referrerPolicy="no-referrer"
 * - Luxury branded typography & icon fallback card (never shows a random stock watch image)
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  category,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover object-center',
  width = 600,
  height = 450,
  size = 'md',
  accentColor = '#2563EB',
  primaryColor = '#0F172A',
  loading = 'lazy',
}) => {
  const candidates = useMemo(() => getImageFallbackCandidates(src, width), [src, width]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
    candidates.length > 0 ? 'loading' : 'error'
  );

  useEffect(() => {
    if (candidates.length > 0 && !isLegacyWatchPlaceholder(src)) {
      setCandidateIdx(0);
      setStatus('loading');
    } else {
      setStatus('error');
    }
  }, [src, candidates.length]);

  const currentUrl = candidates[candidateIdx] || '';

  const handleImageError = () => {
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx((prev) => prev + 1);
    } else {
      setStatus('error');
    }
  };

  // Extract clean monogram / first word for the luxury fallback artwork
  const cleanTitle = (alt || 'منتج').trim();
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const monogram = words.slice(0, 2).join(' ');

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      {/* 1. Shimmer Loading Skeleton */}
      {status === 'loading' && currentUrl && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-stone-200/70 to-stone-100 animate-pulse"
          aria-hidden="true"
        >
          <div className="w-8 h-8 rounded-xl bg-white/70 backdrop-blur-xs flex items-center justify-center shadow-2xs border border-stone-200/60">
            <ShoppingBag className="w-4 h-4 text-stone-400 animate-bounce" />
          </div>
        </div>
      )}

      {/* 2. Actual Product Image */}
      {status !== 'error' && currentUrl && (
        <img
          key={currentUrl}
          src={currentUrl}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus('loaded')}
          onError={handleImageError}
          className={`${imgClassName} transition-opacity duration-300 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. High-End E-Commerce Branded Fallback (Zero stock watch photos) */}
      {(status === 'error' || !currentUrl) && (
        <div
          className="w-full h-full flex flex-col items-center justify-center text-center p-2 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}08 0%, ${accentColor}12 50%, ${primaryColor}05 100%)`,
          }}
        >
          {/* Subtle decorative background circles */}
          <div
            className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 pointer-events-none"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full opacity-10 pointer-events-none"
            style={{ backgroundColor: primaryColor }}
          />

          {size === 'xs' ? (
            <Package className="w-4 h-4 opacity-50" style={{ color: primaryColor }} />
          ) : size === 'sm' ? (
            <div className="flex flex-col items-center justify-center gap-0.5 px-1">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shadow-2xs border border-white/80"
                style={{ backgroundColor: `${accentColor}18`, color: primaryColor }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <span
                className="text-[9px] font-bold leading-tight line-clamp-1 max-w-full"
                style={{ color: primaryColor }}
              >
                {words[0] || 'منتج'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-3 z-10 max-w-full">
              <div
                className={`${
                  size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-11 h-11 rounded-2xl'
                } flex items-center justify-center shadow-xs border border-white/90 bg-white/80 backdrop-blur-xs`}
                style={{ color: accentColor }}
              >
                <ShoppingBag className={size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} />
              </div>

              <div className="space-y-0.5 max-w-full">
                {category && category !== 'عام' && (
                  <span
                    className="block text-[10px] font-semibold tracking-wide opacity-75 truncate"
                    style={{ color: accentColor }}
                  >
                    {category}
                  </span>
                )}
                <span
                  className={`${
                    size === 'lg' ? 'text-sm' : 'text-xs'
                  } font-bold leading-snug line-clamp-2 block`}
                  style={{ color: primaryColor }}
                >
                  {cleanTitle}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
