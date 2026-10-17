import { BrandTheme } from '../types/store';

const SAFE_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|hsla?\([^)]+\)|[a-zA-Z]{3,20})$/;
const SAFE_FONT_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

function sanitizeCssColor(value: string | undefined, fallback: string): string {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return SAFE_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

function sanitizeFontFamily(value: string | undefined, fallback = 'Cairo'): string {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, 60);
  return SAFE_FONT_REGEX.test(trimmed) ? trimmed : fallback;
}

/**
 * Dynamically loads a Google Font by name into document <head>
 */
export function loadGoogleFont(fontName: string): void {
  if (!fontName || typeof document === 'undefined') return;
  const safeFont = sanitizeFontFamily(fontName, '');
  if (!safeFont) return;

  const fontId = `google-font-${safeFont.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(fontId)) return;

  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeFont)}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

/**
 * Injects CSS variables and global rules based on the active BrandTheme
 * into document head so Tailwind classes and styled components adapt immediately.
 */
export function injectBrandThemeStyles(theme: BrandTheme): void {
  if (typeof document === 'undefined') return;

  const safeFont = sanitizeFontFamily(theme.fontFamily, 'Cairo');

  // 1. Ensure the font is loaded
  if (safeFont) {
    loadGoogleFont(safeFont);
  }

  // 2. Inject or update CSS variables style tag
  let styleEl = document.getElementById('brand-dynamic-styles') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'brand-dynamic-styles';
    document.head.appendChild(styleEl);
  }

  const primary = sanitizeCssColor(theme.primaryColor, '#0B253F');
  const accent = sanitizeCssColor(theme.accentColor, '#0077FF');
  const secondaryAccent = sanitizeCssColor(theme.secondaryAccentColor, accent);
  const highlight = sanitizeCssColor(theme.highlightColor, '#A5F3B6');
  const bg = sanitizeCssColor(theme.backgroundColor, '#F8FAFC');
  const neutral = sanitizeCssColor(theme.neutralColor, '#E4E7EB');
  const text = sanitizeCssColor(theme.textColor, primary);
  const rawRadius = Number(theme.borderRadius ?? 12);
  const radius = Number.isFinite(rawRadius) ? Math.min(Math.max(rawRadius, 0), 48) : 12;

  styleEl.textContent = `
    :root {
      --brand-primary: ${primary};
      --brand-accent: ${accent};
      --brand-secondary-accent: ${secondaryAccent};
      --brand-highlight: ${highlight};
      --brand-bg: ${bg};
      --brand-neutral: ${neutral};
      --brand-text: ${text};
      --brand-font: '${safeFont}', 'Cairo', system-ui, sans-serif;
      --brand-radius: ${radius}px;
    }

    body {
      background-color: var(--brand-bg) !important;
      color: var(--brand-text) !important;
      font-family: var(--brand-font) !important;
    }

    /* Dynamic Brand Utility Classes for Tailwind interoperability */
    .brand-theme-font {
      font-family: var(--brand-font) !important;
    }

    .brand-bg-primary {
      background-color: var(--brand-primary) !important;
    }

    .brand-bg-accent {
      background-color: var(--brand-accent) !important;
    }

    .brand-bg-secondary {
      background-color: var(--brand-secondary-accent) !important;
    }

    .brand-bg-highlight {
      background-color: var(--brand-highlight) !important;
    }

    .brand-bg-page {
      background-color: var(--brand-bg) !important;
    }

    .brand-text-primary {
      color: var(--brand-primary) !important;
    }

    .brand-text-accent {
      color: var(--brand-accent) !important;
    }

    .brand-text-secondary {
      color: var(--brand-secondary-accent) !important;
    }

    .brand-text-highlight {
      color: var(--brand-highlight) !important;
    }

    .brand-border {
      border-color: var(--brand-neutral) !important;
    }

    .brand-btn-action {
      background-color: var(--brand-accent) !important;
      color: #ffffff !important;
      border-radius: var(--brand-radius) !important;
      transition: all 0.2s ease-in-out;
    }

    .brand-btn-action:hover {
      filter: brightness(0.92);
      transform: translateY(-1px);
    }
  `;
}
