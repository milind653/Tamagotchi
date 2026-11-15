let current = null;

export function closeSheet() {
  current?.close();
}

// Opens an accessible bottom sheet. `content` is a DOM node. Returns { el, close }.
export function openSheet({ title, jp, content, dismissible = true, onClose } = {}) {
  closeSheet();
  const opener = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  if (title) sheet.setAttribute('aria-label', title);

  const grab = document.createElement('div');
  grab.className = 'sheet-grab';
  grab.innerHTML = '<span></span>';
  sheet.append(grab);
  if (title) {
    const h = document.createElement('h2');
    h.className = 'sheet-title';
    h.textContent = title;
    if (jp) {
      const j = document.createElement('span');
      j.className = 'jp';
      j.textContent = ` ${jp}`;
      h.append(j);
    }
    sheet.append(h);
  }
  sheet.append(content);
  backdrop.append(sheet);
  document.body.append(backdrop);
  document.documentElement.classList.add('sheet-open');
  requestAnimationFrame(() => backdrop.classList.add('in'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    current = null;
    backdrop.classList.remove('in');
    document.documentElement.classList.remove('sheet-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => backdrop.remove(), 250);
    opener?.focus?.({ preventScroll: true });
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) close();
    if (e.key === 'Tab') {
      const items = [...sheet.querySelectorAll('button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  if (dismissible) {
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
    let startY = null;
    grab.addEventListener('pointerdown', (e) => { startY = e.clientY; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => {
      if (startY === null) return;
      sheet.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
    });
    const end = (e) => {
      if (startY === null) return;
      const dy = e.clientY - startY;
      startY = null;
      sheet.style.transform = '';
      if (dy > 80) close();
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }
  setTimeout(() => (sheet.querySelector('[data-autofocus]') ?? sheet.querySelector('button, a[href]'))?.focus({ preventScroll: true }), 60);
  current = { close };
  return { el: sheet, close };
}
