// Google AdSense integration with a lightweight consent banner.
// Configure in site.config.json: adsenseClient ("ca-pub-…") and adSlots ids.
// When no client is configured, labelled placeholders are shown so the layout can be previewed.

const CONSENT_KEY = 'calc.consent';

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

function fillSlots(cfg) {
  const slots = [...document.querySelectorAll('.ad-slot')];
  const visible = slots.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  const queue = (window.adsbygoogle = window.adsbygoogle || []);
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        push(en.target);
      });
    }, { rootMargin: '300px' })
    : null;

  function push(el) {
    const slotId = cfg.adSlots?.[el.dataset.slot];
    if (!slotId || el.dataset.filled) return;
    el.dataset.filled = '1';
    el.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.adsenseClient}" data-ad-slot="${slotId}" data-ad-format="${el.dataset.format || 'auto'}" data-full-width-responsive="true"></ins>`;
    try { queue.push({}); } catch { /* ad blocked */ }
  }

  visible.forEach((el) => {
    if (!cfg.adSlots?.[el.dataset.slot]) {
      // No manual slot id: leave the space to AdSense Auto ads and collapse the box.
      el.classList.add('ad-auto');
      return;
    }
    if (io) io.observe(el); else push(el);
  });
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
  const slots = document.querySelectorAll('.ad-slot');
  if (!cfg.adsenseClient) {
    if (cfg.showAdPlaceholders !== false) slots.forEach((s) => s.classList.add('ad-placeholder'));
    else slots.forEach((s) => s.remove());
    return;
  }
  const start = (choice) => {
    window.adsbygoogle = window.adsbygoogle || [];
    // Non-personalised ads unless the visitor accepted cookies.
    window.adsbygoogle.requestNonPersonalizedAds = choice === 'accept' ? 0 : 1;
    loadScript(cfg.adsenseClient);
    fillSlots(cfg);
  };
  // If Google's own certified CMP (AdSense › Privacy & messaging) is enabled, it handles consent.
  if (cfg.useGoogleCMP) return start('accept');
  const c = getConsent();
  if (c) start(c);
  else showBanner(start);
  return undefined;
}

export function resetConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  location.reload();
}
