import { APP_VERSION } from '../appVersion.js';
import { appUpdateMessage, isRemoteVersionNewer } from '../../domain/appVersion.js';

const BANNER_ID = 'app-update-banner';

export function getRunningAppVersion() {
  return APP_VERSION;
}

export async function fetchRemoteAppVersion() {
  try {
    const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    const version = Number(payload?.version);
    return Number.isFinite(version) ? version : null;
  } catch {
    return null;
  }
}

export function shouldShowAppUpdateBanner(localVersion, remoteVersion) {
  return isRemoteVersionNewer(localVersion, remoteVersion);
}

function renderBanner() {
  if (document.getElementById(BANNER_ID)) return;
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'app-update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <p class="app-update-banner__text">${appUpdateMessage()}</p>
  `;
  document.body.prepend(banner);
  document.body.classList.add('has-app-update-banner');
}

export async function checkAppUpdateBanner() {
  const remoteVersion = await fetchRemoteAppVersion();
  if (!shouldShowAppUpdateBanner(getRunningAppVersion(), remoteVersion)) return false;
  renderBanner();
  return true;
}

export function bindAppUpdateChecks() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAppUpdateBanner().catch(console.error);
    }
  });
}
