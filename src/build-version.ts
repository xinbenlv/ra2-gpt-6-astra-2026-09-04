import './build-version.css';

declare const __BUILD_INFO__: { hash: string; committedAt: string | null };

/** Lives outside #app so setup, lobby, editor and battle all keep the same visible build identity. */
export function mountBuildVersion(): void {
  document.querySelector('[data-build-version]')?.remove();
  const badge = document.createElement('aside');
  badge.className = 'build-version';
  badge.dataset.buildVersion = __BUILD_INFO__.hash;
  badge.setAttribute('aria-label', 'Running commit');
  const version = document.createElement('span'), hash = document.createElement('code');
  hash.textContent = __BUILD_INFO__.hash.slice(0, 6);
  if (__BUILD_INFO__.hash === 'unknown') hash.textContent = 'unknown';
  version.append('commit ', hash);
  const time = document.createElement('time');
  if (__BUILD_INFO__.committedAt) {
    time.dateTime = __BUILD_INFO__.committedAt;
    time.textContent = new Date(__BUILD_INFO__.committedAt).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  } else time.textContent = 'Commit time unavailable';
  badge.append(version, time);
  document.body.append(badge);
}
