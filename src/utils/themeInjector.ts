import { BrandTheme } from '../types/store';

/**
 * Dynamically loads a Google Font by name into document <head>
 */
export function loadGoogleFont(fontName: string): void {
  if (!fontName || typeof document === 'undefined') return;

  const fontId = `google-font-${fontName.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(fontId)) return;

  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

/**
 * Injects CSS variables and global rules based on the active BrandTheme
 * into document head so Tailwind classes and styled components adapt immediately.
 */
export function injectBrandThemeStyles(theme: BrandTheme): void {
  if (typeof document === 'undefined') return;

  // 1. Ensure the font is loaded
  if (theme.fontFamily) {
    loadGoogleFont(theme.fontFamily);
  }

  // 2. Inject or update CSS variables style tag
  let styleEl = document.getElementById('brand-dynamic-styles') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'brand-dynamic-styles';
    document.head.appendChild(styleEl);
  }

  const primary = theme.primaryColor || '#0B253F';
  const accent = theme.accentColor || '#0077FF';
  const secondaryAccent = theme.secondaryAccentColor || accent;
  const highlight = theme.highlightColor || '#A5F3B6';
  const bg = theme.backgroundColor || '#F8F3ED';
  const neutral = theme.neutralColor || '#E4E7EB';
  const text = theme.textColor || primary;
  const font = theme.fontFamily || 'Cairo';
  const radius = theme.borderRadius ?? 12;

  styleEl.textContent = `
    :root {
      --brand-primary: ${primary};
      --brand-accent: ${accent};
      --brand-secondary-accent: ${secondaryAccent};
      --brand-highlight: ${highlight};
      --brand-bg: ${bg};
      --brand-neutral: ${neutral};
      --brand-text: ${text};
      --brand-font: '${font}', 'Cairo', system-ui, sans-serif;
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
