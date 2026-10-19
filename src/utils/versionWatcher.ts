/**
 * Version Watcher & Stale Chunk Auto-Recovery
 * Ensures that whenever a new build is deployed to Firebase/Vercel:
 * 1. Outdated dynamic chunks reload automatically instead of breaking the UI.
 * 2. When the user returns to an existing tab, it detects new deployments and updates instantly.
 * 3. Prevents reload loops with session storage debouncing.
 */

declare const __APP_BUILD_TIME__: number;

const CURRENT_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();
const RELOAD_DEBOUNCE_KEY = 'storelink_last_chunk_reload';
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // Check every 3 minutes in background

/**
 * Auto-reloads the page safely when a new deployment renders old chunks invalid
 */
function handleStaleChunkDetected(source: string) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastReload = sessionStorage.getItem(RELOAD_DEBOUNCE_KEY);

  // Prevent infinite loop if something else is breaking network calls
  if (lastReload && now - Number(lastReload) < 12000) {
    console.warn(`[VersionWatcher] Chunk error from ${source}, but reloaded recently. Suppressing.`);
    return;
  }

  sessionStorage.setItem(RELOAD_DEBOUNCE_KEY, String(now));
  console.info(`[VersionWatcher] New version detected via ${source}. Refreshing to latest build...`);
  window.location.reload();
}

/**
 * Checks if the remote server has a newer version.json than current bundle
 */
export async function checkForAppUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.fetch) return false;

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data && typeof data.buildTime === 'number') {
      if (data.buildTime > CURRENT_BUILD_TIME) {
        console.info(`[VersionWatcher] Server build (${data.buildTime}) > Client build (${CURRENT_BUILD_TIME})`);
        return true;
      }
    }
  } catch (err) {
    // Silent ignore on offline/network errors
  }
  return false;
}

/**
 * Initializes automatic version detection and chunk recovery
 */
export function initVersionWatcher(): void {
  if (typeof window === 'undefined') return;

  // 1. Vite Native Preload Error Hook (official Vite chunk failure hook)
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    handleStaleChunkDetected('vite:preloadError');
  });

  // 2. Global Dynamic Import / Script Error Fallback
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed')
    ) {
      handleStaleChunkDetected('window:error:chunk_mismatch');
    }
  });

  // 3. Tab Visibility Change (User switches back to their store tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate().then((hasUpdate) => {
        if (hasUpdate) {
          handleStaleChunkDetected('visibility_change_check');
        }
      });
    }
  });

  // 4. Background Timer
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate().then((hasUpdate) => {
        if (hasUpdate) {
          handleStaleChunkDetected('periodic_interval_check');
        }
      });
    }
  }, CHECK_INTERVAL_MS);
}
