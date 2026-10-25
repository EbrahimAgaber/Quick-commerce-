/**
 * Image CDN, Static Asset Resolution, Google Drive Multi-Endpoint Fallback & Responsive Optimization Utility
 * 
 * Transforms image URLs to self-hosted static CDN paths (`/uploads/products/...`) when available so
 * images load identically across every browser engine (Chrome, Edge, Safari, Firefox, Incognito, Mobile)
 * without requiring a Google Drive login session, and falls back to multi-endpoint Google Drive URLs
 * (`lh3` -> `thumbnail` -> `uc`) when unmapped.
 */

export interface OptimizedImageProps {
  src: string;
  width?: number;
  quality?: number;
}

/**
 * Legacy Unsplash watch photo ID that was previously used as a hardcoded default placeholder.
 * Stripped automatically so real products never display a wristwatch when their image is missing or loading.
 */
export const LEGACY_WATCH_PLACEHOLDER_ID = 'photo-1523275335684-37898b6baf30';

export function isLegacyWatchPlaceholder(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes(LEGACY_WATCH_PLACEHOLDER_ID);
}

/**
 * Built-in static asset map for Google Drive file IDs imported from merchant catalogs.
 * Maps restricted Google Drive file IDs directly to first-party `/uploads/products/...` assets
 * served from Firebase Hosting / local server so every browser engine (Chrome, Edge, Safari, Mobile)
 * renders the exact same high-resolution studio product photos with zero auth dependencies.
 */
export const STATIC_GOOGLE_DRIVE_ASSET_MAP: Record<string, string> = {
  // alula_palms_products_updated CSV file IDs (1..46)
  '1jigaom0QJw7YDzKpZymyQZ_zigK9761v': '/uploads/products/alula_prod_01.jpg',
  '1XXHrHsnl-YmjBcVaX_9iwUsy0r1z30sx': '/uploads/products/alula_prod_02.jpg',
  '1OpG-KpFqH52ySLTn-T_SHB09d5xDJjMz': '/uploads/products/alula_prod_03.jpg',
  '1qOOojVFbHIe0-Zb6D8t-PN1U6QeKAbmV': '/uploads/products/alula_prod_04.jpg',
  '1T3Ww5u595rYsqfVbqt2ZD5MhLSfNF_vc': '/uploads/products/alula_prod_05.jpg',
  '1EjCTgh_Lk2x7e6npHGTyMuNVQ1aDnElg': '/uploads/products/alula_prod_06.jpg',
  '1kBqs79172tKj03pelwOJZkZdCjkWS-By': '/uploads/products/alula_prod_07.jpg',
  '19bFvzuOVpKppIFMkscoUqVNX7RKyr0-I': '/uploads/products/alula_prod_08.jpg',
  '19lgxRi8Zrr25tE190qu0u9wQQXq3uoAc': '/uploads/products/alula_prod_09.jpg',
  '1ydVsy9T_pxqzHoLRJf2HtPPVJiMQ1i5t': '/uploads/products/alula_prod_10.jpg',
  '1q3RrfcNpqPAT7Jmg7jyXvO29x6117JAI': '/uploads/products/alula_prod_11.jpg',
  '1h1IaCJodE2-s-5L8RFwH_X-oTKjQ-_1A': '/uploads/products/alula_prod_12.jpg',
  '1Y-axkcBgJE56K3Zsxl4-fcelIk4AUiax': '/uploads/products/alula_prod_13.jpg',
  '1QXlHbGcYDmhbR9KdA_Xlf3CaSsUi2GbQ': '/uploads/products/alula_prod_14.jpg',
  '1qwxpnTyZNZFixDlMRWAEFtLFJ4YXiYrt': '/uploads/products/alula_prod_15.jpg',
  '1h99U1EUFa9dBwjsFgLl1ofcu-hxdp7Hz': '/uploads/products/alula_prod_16.jpg',
  '1nbYE2L_MyWFFbTXe_tMH-BhM8nkc47U3': '/uploads/products/alula_prod_17.jpg',
  '1Arq4deZku0Lm1g_Mh2azrbW0gdw1A5Aa': '/uploads/products/alula_prod_18.jpg',
  '1lsJKkfjRc700rIPNFlNQyoyOIfgbPDrC': '/uploads/products/alula_prod_19.jpg',
  '1LxpM9h9JR3errh8GlxZvLDrngPJPb3eB': '/uploads/products/alula_prod_20.jpg',
  '1H6Tm_7EDXgK7o15ITN01nidB_x9BIctj': '/uploads/products/alula_prod_21.jpg',
  '14hdBcj5PeAwask94d7-1qBHW9YN5VbD3': '/uploads/products/alula_prod_22.jpg',
  '1dtj2dZpRR233U2FZK6B-5FObNlIrmtW2': '/uploads/products/alula_prod_23.jpg',
  '1Ku9f6EtgRsMF95ZIJHXuFcE5bT6HFRha': '/uploads/products/alula_prod_24.jpg',
  '1Aj6prVqx8yPm_OLn1h8fACvn6rmgqJj6': '/uploads/products/alula_prod_25.jpg',
  '1FfvE3Nu9KVU4I0DheOf3B8JGvE9RiZrL': '/uploads/products/alula_prod_26.jpg',
  '1Zo4B2mPdCaofn9rPB2BhpmbLAM8WcQOf': '/uploads/products/alula_prod_27.jpg',
  '1BCl6K7P5b_dRcm_6chxvEelyEyqysC59': '/uploads/products/alula_prod_28.jpg',
  '1JPdCbci3HpyFJfnF7IVXc8Tp3iykwpU4': '/uploads/products/alula_prod_29.jpg',
  '18TY13Yymx6iy8699YIZddZo-W0_0SENY': '/uploads/products/alula_prod_30.jpg',
  '1nPMLuhCLsFZ3YG92epcclQYDc9pDCluK': '/uploads/products/alula_prod_31.jpg',
  '1IzdrycltmwSb5WmA0d7e0eHUtgq6I9eP': '/uploads/products/alula_prod_32.jpg',
  '1aeeONPOBB8GHn52tkz7Jfz6Ev5r_zpMG': '/uploads/products/alula_prod_33.jpg',
  '1rAaSmvxnjtZu9pl-OWQsUkYdLDcC5TQL': '/uploads/products/alula_prod_34.jpg',
  '1usc34TAdh5KMZ38Xo6EwBFBkI5PbmxrI': '/uploads/products/alula_prod_35.jpg',
  '1f-rzSzke8_7sihpcUshJC-GPfS9wPZa_': '/uploads/products/alula_prod_36.jpg',
  '1OIv7qMctSMfiZstBci_DpM2Rik0Z-oiv': '/uploads/products/alula_prod_37.jpg',
  '1KfQwdBPyjAuMDo8DYQ-jiTxwDWIRqSUV': '/uploads/products/alula_prod_38.jpg',
  '1HaOvnU4QsRA_r5fSGKoOnv2hcWzFPxwO': '/uploads/products/alula_prod_39.jpg',
  '1swR8xCrnf0s78Z7iwFoaAOl80ORL8Xtp': '/uploads/products/alula_prod_40.jpg',
  '1QnVUJt-RhdCuPvZtougbinyIJ_K4524v': '/uploads/products/alula_prod_41.jpg',
  '1V9T79YYmYPW5ui5r1mDBD8az4RikGjtv': '/uploads/products/alula_prod_42.jpg',
  '1BTrNusNayKvljCRzC0gaWokfPJcGhOAA': '/uploads/products/alula_prod_43.jpg',
  '14gTeJZ9_nSSvtdE8ANrpL3zhdWGfyLFl': '/uploads/products/alula_prod_44.jpg',
  '1DCOl7GZC_6EcmDr6Ef4VG_sNJ_Cc97sL': '/uploads/products/alula_prod_45.jpg',
  '1moWNDpNbiHb5NkLTWRhsVzpaAS4x0ybB': '/uploads/products/alula_prod_46.jpg',
  // alula_palms_products_studio CSV file IDs (1..46)
  '1wV2zu9oLHTaw5K1l6F77WM-0ZAOfhmn1': '/uploads/products/alula_prod_01.jpg',
  '1t-dN7ry1tnucjfZlyGB5NUCtXwBEz8FA': '/uploads/products/alula_prod_02.jpg',
  '1a6nAx1cYFcMvXzIzhiXytWNuY05dY9Od': '/uploads/products/alula_prod_03.jpg',
  '1dyU9JFlXyruH5u54dlr0SHDtEPeqI2BW': '/uploads/products/alula_prod_04.jpg',
  '18tAo1-ezjXj22YtOK5G4U83KUsjwhNtq': '/uploads/products/alula_prod_05.jpg',
  '1lxxzKgyDXOdbFKPlb6VI4-d0LK6ngpHY': '/uploads/products/alula_prod_06.jpg',
  '1wjJnzwm8Tm8S_XHKLyluPXbRKiUEU79n': '/uploads/products/alula_prod_07.jpg',
  '1XS5vD1DPGWj7KqZG7UELZUExMsY4Cidb': '/uploads/products/alula_prod_08.jpg',
  '1Ck3nAMhrxEDbfrc0b1pPI52v1fqMRoZa': '/uploads/products/alula_prod_09.jpg',
  '1S4Oot9Z1BvRbmG1_widMzp1uD767J6LG': '/uploads/products/alula_prod_10.jpg',
  '1r5bjlyf6v-KEL7V_MGT6sbzZpz0hML_J': '/uploads/products/alula_prod_11.jpg',
  '1kADUxMAlvxd98yUbzSKnGD1hAD7TBQQt': '/uploads/products/alula_prod_12.jpg',
  '1stlmZdjS-BfBipxXv9eX3Yx8oHYqsTjQ': '/uploads/products/alula_prod_13.jpg',
  '1r8RXb-Ew1tZpSMzqBgGtLqcvQ3J5Z9d2': '/uploads/products/alula_prod_14.jpg',
  '1Jftf1NfSiGgHjQ4BiFy08pSyMfX4snXL': '/uploads/products/alula_prod_15.jpg',
  '1aKu6oHbgPIuYqfHTpVOrRed4sXpIfrXU': '/uploads/products/alula_prod_16.jpg',
  '14J4EDa7jWSK_DBrg9PHeCIee062rlAjR': '/uploads/products/alula_prod_17.jpg',
  '1A-GMq0SwRtIeZMPS41jES5mm8G5UwiOu': '/uploads/products/alula_prod_18.jpg',
  '1UviObY9t_sLRUBEJmHQmmFnxt01PT3L0': '/uploads/products/alula_prod_19.jpg',
  '1Nw8XbFEsulIlvDGtU3UfBt32-LyJxs0O': '/uploads/products/alula_prod_20.jpg',
  '1JflWTb2ISZD5nfZ8XuqD21ZTtZHf6V5L': '/uploads/products/alula_prod_21.jpg',
  '1W_gXgP2RI4lJBJayyTIeA_wRSKx3_wfw': '/uploads/products/alula_prod_22.jpg',
  '1giFYKI-wlR9PUQK6bSldjxMkbRQDlRy1': '/uploads/products/alula_prod_23.jpg',
  '1NG__Ic7MoeBslYgJvlKmofGg-ohWupkY': '/uploads/products/alula_prod_24.jpg',
  '110KHg_wWVb8sTi40lzBdEOQr0dc6D39n': '/uploads/products/alula_prod_25.jpg',
  '1rhOeTRyBDCqwMg-ulgG3L4wyEZI6_UiQ': '/uploads/products/alula_prod_26.jpg',
  '1uO8kJUPv6HlblfJFPYKL2toBGfiVw9lY': '/uploads/products/alula_prod_27.jpg',
  '1zYgHKThsh0cwEKNaFJWbdqmsu37k_1we': '/uploads/products/alula_prod_28.jpg',
  '1LLQ0_q2BAYRlc3HNzkHJW4Z2fEAZtYnI': '/uploads/products/alula_prod_29.jpg',
  '10ovO9DqGxEzS1IVP0H0w-TDu9c40KEQq': '/uploads/products/alula_prod_30.jpg',
  '169wOB6MVqKk5SW5FIXWmoomSBSH0Hvx8': '/uploads/products/alula_prod_31.jpg',
  '1Wsez3n5YxtA7PON8ie4FR6AgQZayD9P8': '/uploads/products/alula_prod_32.jpg',
  '1DMIzZSzbPrldncESNEVG_XJt__qyT3dU': '/uploads/products/alula_prod_33.jpg',
  '1yPQLIIj0ijtXrQVQWFkyzcy4YoDZ8cvX': '/uploads/products/alula_prod_34.jpg',
  '1zLskOJCE9YyOK8dYi3pkL26JZ6VctXVG': '/uploads/products/alula_prod_35.jpg',
  '1E5oi4mMkuPipTwoQiAZ0Ew5phBf-508K': '/uploads/products/alula_prod_36.jpg',
  '1rCt3ikN9CkL_1wfO8DxP8MliVbW3Svz5': '/uploads/products/alula_prod_37.jpg',
  '1x5UywLEiQnHAj0trwU3xrNUgHQAXDTHC': '/uploads/products/alula_prod_38.jpg',
  '1jJpGkvCnqBZwWWtJ5oIOw3gcuvJuS5uZ': '/uploads/products/alula_prod_39.jpg',
  '1us1mH8O0AKWptIBy3zFqLl7K-wyclS5G': '/uploads/products/alula_prod_40.jpg',
  '1FtS8NQfZ8aFI9cCSI2XS2KtMM7ysSlzR': '/uploads/products/alula_prod_41.jpg',
  '1kLQdUUAUGxJG2CG8cKPH106UOUMoiasb': '/uploads/products/alula_prod_42.jpg',
  '1KCJQrhslte3kRBB_Qd_XTAsOjI597EI5': '/uploads/products/alula_prod_43.jpg',
  '1pbISsDiAcl9deHnkFNhzjkUcxeDDr1VL': '/uploads/products/alula_prod_44.jpg',
  '1CHQmizqeWjFh5IcvVLCjheAAcl6WGCVK': '/uploads/products/alula_prod_45.jpg',
  '1kXWd_tt3Izel6QEgXfCeCOeQ5a5O8fEv': '/uploads/products/alula_prod_46.jpg',
  // Historical order item reference for product 6
  '147y7-QGlzyFkOKmGb1J8VVb1LbxayXAs': '/uploads/products/alula_prod_06.jpg',
};

/**
 * Extracts a Google Drive file ID from any Google Drive / Google User Content URL format:
 * - https://drive.google.com/file/d/<FILE_ID>/view?usp=drivesdk
 * - https://drive.google.com/uc?export=view&id=<FILE_ID>
 * - https://drive.google.com/open?id=<FILE_ID>
 * - https://drive.google.com/thumbnail?id=<FILE_ID>&sz=w1000
 * - https://lh3.googleusercontent.com/d/<FILE_ID>=w1000
 * - https://drive.usercontent.google.com/download?id=<FILE_ID>&export=view
 */
export function extractGoogleDriveFileId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const filePathMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/i);
  if (filePathMatch?.[1]) return filePathMatch[1];

  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})/i);
  if (lh3Match?.[1]) return lh3Match[1];

  const queryIdMatch = trimmed.match(
    /(?:drive\.google\.com\/(?:uc|open|thumbnail)|drive\.usercontent\.google\.com\/download)\?[^#]*[?&]id=([a-zA-Z0-9_-]{10,})/i
  );
  if (queryIdMatch?.[1]) return queryIdMatch[1];

  return null;
}

/**
 * Resolves a raw image URL to a self-hosted static path if its Google Drive file ID is known
 * in `STATIC_GOOGLE_DRIVE_ASSET_MAP`.
 */
export function resolveStaticGoogleDriveAsset(rawUrl?: string | null): string | null {
  const driveId = extractGoogleDriveFileId(rawUrl);
  if (driveId && STATIC_GOOGLE_DRIVE_ASSET_MAP[driveId]) {
    return STATIC_GOOGLE_DRIVE_ASSET_MAP[driveId];
  }
  return null;
}

/**
 * Builds an ordered list of candidate image URLs to try for a given source URL.
 * 1. If the URL matches a known Google Drive asset in `STATIC_GOOGLE_DRIVE_ASSET_MAP`,
 *    places the self-hosted `/uploads/products/...` path FIRST so it loads with 100% reliability
 *    across Chrome, Edge, Safari, Firefox, and mobile browsers regardless of Google login state.
 * 2. Appends the 3 Google Drive endpoints (`lh3` -> `thumbnail` -> `uc`) as secondary fallbacks.
 */
export function getImageFallbackCandidates(rawUrl?: string | null, width: number = 800): string[] {
  if (!rawUrl || typeof rawUrl !== 'string') return [];
  const trimmed = rawUrl.trim();
  if (!trimmed || isLegacyWatchPlaceholder(trimmed)) return [];

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    const staticAsset = STATIC_GOOGLE_DRIVE_ASSET_MAP[driveId];
    const driveEndpoints = [
      `https://lh3.googleusercontent.com/d/${driveId}=w${width}`,
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`,
      `https://drive.google.com/uc?export=view&id=${driveId}`,
    ];
    return staticAsset ? [staticAsset, ...driveEndpoints] : driveEndpoints;
  }

  return [getOptimizedImageUrl(trimmed, width, 80)];
}

/**
 * Optimizes an image URL via static asset resolution, Unsplash, Google Drive, or Cloudflare Image Resizing parameters
 */
export function getOptimizedImageUrl(src: string, width: number = 400, quality: number = 80): string {
  if (!src || typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (!trimmed) return '';

  // 1. Google Drive links -> self-hosted static asset if available, else fast CDN endpoint
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    if (STATIC_GOOGLE_DRIVE_ASSET_MAP[driveId]) {
      return STATIC_GOOGLE_DRIVE_ASSET_MAP[driveId];
    }
    return `https://lh3.googleusercontent.com/d/${driveId}=w${Math.max(400, width)}`;
  }

  // 2. Unsplash dynamic format & width parameters
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const url = new URL(trimmed);
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', quality.toString());
      return url.toString();
    } catch {
      return trimmed;
    }
  }

  // 3. Cloudflare Images or custom image worker CDN
  if (trimmed.includes('/cdn-cgi/image/')) {
    return trimmed;
  }

  return trimmed;
}
