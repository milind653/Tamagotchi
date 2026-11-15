import { openSheet } from './sheet.js';

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(installState()));

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// 'installed' | 'prompt' (native prompt ready) | 'ios' (manual steps) | 'unavailable' (browser menu)
export function installState() {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  return 'unavailable';
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  localStorage.setItem('tama_installed', '1');
  notify();
});

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M12 3l-4 4M12 3l4 4M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function step(n, html) {
  const li = document.createElement('li');
  li.innerHTML = `<span class="step-num">${n}</span><span>${html}</span>`;
  return li;
}

export function showInstallHelp() {
  const wrap = document.createElement('div');
  wrap.className = 'install-help';
  const ol = document.createElement('ol');
  ol.className = 'install-steps';
  if (isIOS()) {
    ol.append(
      step(1, `Tap the <b>Share</b> button <span class="inline-ico">${SHARE_ICON}</span> in Safari's toolbar.`),
      step(2, 'Scroll down and tap <b>Add to Home Screen</b>.'),
      step(3, 'Tap <b>Add</b>. Your pet now lives on your home screen!'),
    );
  } else {
    ol.append(
      step(1, 'Open your browser menu (<b>⋮</b> or <b>⋯</b>).'),
      step(2, 'Choose <b>Install app</b> or <b>Add to Home screen</b>.'),
      step(3, 'Confirm. Tamagotchi opens full-screen, just like an app.'),
    );
  }
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn-primary block';
  done.textContent = 'Got it';
  wrap.append(ol, done);
  const sheet = openSheet({ title: 'Install Tamagotchi', jp: 'インストール', content: wrap });
  done.addEventListener('click', sheet.close);
}

export async function install() {
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome;
  }
  showInstallHelp();
  return 'help';
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
registerServiceWorker();
