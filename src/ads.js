// Google AdSense integration with a lightweight consent banner.
// Configure in site.config.json: adsenseClient ("ca-pub-…") and adSlots ids.
// When no client is configured, labelled placeholders are shown so the layout can be previewed
// (set showAdPlaceholders:false to hide them). With a client configured placeholders never render.
//
// Performance rules: the AdSense script is only requested after the visitor's consent choice and
// once the browser is idle; each manual slot is filled only when it comes within ~400px of the viewport;
// every slot reserves its height in CSS so nothing shifts when an ad arrives.

const CONSENT_KEY = 'calc.consent';
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500));

function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}
function setConsent(v) {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* ignore */ }
}

function loadScript(client) {
  if (document.querySelector('script[data-adsense]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.dataset.adsense = '1';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

const isShown = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';

function fillSlots(cfg, slots) {
  const queue = (window.adsbygoogle = window.adsbygoogle || []);
  function push(el) {
    const slotId = cfg.adSlots?.[el.dataset.slot];
    if (!slotId || el.dataset.filled || !isShown(el)) return;
    el.dataset.filled = '1';
    // The top banner gets a fixed-height unit matching its reserved space (no layout shift);
    // other slots are responsive within their reserved min-height.
    const fixedH = el.dataset.slot === 'top' ? parseInt(getComputedStyle(el).minHeight, 10) : 0;
    el.innerHTML = fixedH
      ? `<ins class="adsbygoogle" style="display:inline-block;width:100%;height:${fixedH}px" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slotId}"></ins>`
      : `<ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slotId}" data-ad-format="${el.dataset.format || 'auto'}" data-full-width-responsive="true"></ins>`;
    try { queue.push({}); } catch { /* ad blocked */ }
  }
  if (!('IntersectionObserver' in window)) { slots.forEach(push); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      push(en.target);
    });
  }, { rootMargin: '400px 0px' });
  slots.forEach((el) => io.observe(el));
}

function showBanner(onChoice) {
  const el = document.getElementById('consent');
  if (!el) return onChoice('accept');
  el.hidden = false;
  el.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-consent]')?.dataset.consent;
    if (!choice) return;
    setConsent(choice);
    el.hidden = true;
    onChoice(choice);
  });
  return undefined;
}

export function initAds(cfg) {
  const slots = [...document.querySelectorAll('.ad-slot')];
  if (!cfg.adsenseClient) {
    if (cfg.showAdPlaceholders !== false) slots.forEach((s) => s.classList.add('ad-placeholder'));
    else slots.forEach((s) => s.remove());
    return;
  }
  // Production: never show placeholders. Slots without a manual unit id collapse right away
  // (synchronously, before ads load) and AdSense Auto ads place ads itself.
  const manual = [];
  slots.forEach((el) => {
    el.classList.remove('ad-placeholder');
    if (cfg.adSlots?.[el.dataset.slot]) { el.classList.add('ad-live'); manual.push(el); } else el.classList.add('ad-auto');
  });
  const start = (choice) => {
    window.adsbygoogle = window.adsbygoogle || [];
    // Non-personalised ads unless the visitor accepted cookies.
    window.adsbygoogle.requestNonPersonalizedAds = choice === 'accept' ? 0 : 1;
    const go = () => idle(() => { loadScript(cfg.adsenseClient); fillSlots(cfg, manual); });
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  };
  // If Google's own certified CMP (AdSense › Privacy & messaging) is enabled, it handles consent.
  if (cfg.useGoogleCMP) { start('accept'); return; }
  const c = getConsent();
  if (c) start(c);
  else showBanner(start);
}

export function resetConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  location.reload();
}
