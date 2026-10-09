/* NELDO site UI (homepage, about, contact): theme, menu, copy email, screenshots, chat demo, marquee, servings demo, #safety.
   Local only. No network calls, analytics or cookies. Theme choice is kept for this visit (sessionStorage, try/catch). */
(function () {
  'use strict';
  var root = document.documentElement;
  var t = function (key, fallback) {
    return (window.NeldoI18n && window.NeldoI18n.t(key)) || fallback;
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /* ---------- theme ---------- */
  function currentTheme() {
    var forced = root.getAttribute('data-theme');
    if (forced === 'light' || forced === 'dark') return forced;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }
  // <picture> sources follow prefers-color-scheme; when the visitor overrides the theme, point them at the chosen one.
  function syncPictures() {
    var forced = root.getAttribute('data-theme');
    document.querySelectorAll('picture source[data-dark-media], picture source[media*="prefers-color-scheme"]').forEach(function (source) {
      if (!source.hasAttribute('data-dark-media')) source.setAttribute('data-dark-media', source.getAttribute('media'));
      if (forced === 'dark') source.media = 'all';
      else if (forced === 'light') source.media = 'not all';
      else source.media = source.getAttribute('data-dark-media');
    });
  }
  var themeBtn = document.querySelector('[data-theme-toggle]');
  function syncThemeButton() {
    if (!themeBtn) return;
    var key = currentTheme() === 'dark' ? 'theme.toLight' : 'theme.toDark';
    themeBtn.setAttribute('data-i18n-attr', 'aria-label:' + key);
    themeBtn.setAttribute('aria-label', t(key, currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'));
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      if (root.hasAttribute('data-theme')) m.content = currentTheme() === 'dark' ? '#0d1813' : '#faf7ef';
    });
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { sessionStorage.setItem('neldo-theme', next); } catch (e) { /* private mode: per-page only */ }
      syncPictures();
      syncThemeButton();
    });
  }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', syncThemeButton);
  syncPictures();
  syncThemeButton();
  document.addEventListener('neldo:lang', syncThemeButton);

  /* ---------- missing screenshots: keep the frame, show the Leaf N placeholder ---------- */
  document.querySelectorAll('.phone img').forEach(function (img) {
    var mark = function () { var p = img.closest('.phone'); if (p) p.classList.add('is-missing'); };
    var clear = function () { var p = img.closest('.phone'); if (p) p.classList.remove('is-missing'); };
    img.addEventListener('error', mark);
    img.addEventListener('load', clear);
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) mark();
  });

  /* ---------- header shadow ---------- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(onScroll); // first check after layout, so it doesn't force one inside this script
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector('[data-menu-toggle]');
  var mobileNav = document.querySelector('[data-mobile-nav]');
  if (menuBtn && mobileNav) {
    mobileNav.hidden = true;
    var setMenu = function (open, returnFocus) {
      menuBtn.setAttribute('aria-expanded', String(open));
      mobileNav.hidden = !open;
      var key = open ? 'nav.close' : 'nav.open';
      menuBtn.setAttribute('data-i18n-attr', 'aria-label:' + key);
      menuBtn.setAttribute('aria-label', t(key, open ? 'Close menu' : 'Open menu'));
      if (open) { var first = mobileNav.querySelector('a'); if (first) first.focus(); }
      else if (returnFocus) menuBtn.focus();
    };
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    mobileNav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    // Tabbing out of the open menu closes it, so the focused item is never hidden under the tall sticky header.
    // Shift+Tab back to the menu button keeps it open.
    mobileNav.addEventListener('focusout', function (e) {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && e.relatedTarget && !mobileNav.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    document.addEventListener('click', function (e) {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && !mobileNav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 1080px)');
      var onWide = function (q) { if (q.matches) setMenu(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide);
      else if (wide.addListener) wide.addListener(onWide); // Safari < 14
    }
    // Language change: refresh the button's label only (never move focus).
    document.addEventListener('neldo:lang', function () {
      var k = menuBtn.getAttribute('aria-expanded') === 'true' ? 'nav.close' : 'nav.open';
      menuBtn.setAttribute('data-i18n-attr', 'aria-label:' + k);
      menuBtn.setAttribute('aria-label', t(k, k === 'nav.close' ? 'Close menu' : 'Open menu'));
    });
  }

  /* ---------- "Copy email" buttons (progressive enhancement: the address is plain, selectable text without JS) ---------- */
  function selectText(el) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing else to do: the address stays visible */ }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    var ok = false;
    try { ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  var canCopy = !!(navigator.clipboard && window.isSecureContext) ||
    !!(document.queryCommandSupported && document.queryCommandSupported('copy'));
  document.querySelectorAll('[data-copy-email]').forEach(function (btn) {
    if (!canCopy) return; // no way to copy: keep the button hidden, the address is still there to select
    btn.hidden = false;
    var label = btn.querySelector('[data-i18n]');
    var group = btn.closest('[data-copy-group]') || btn.parentElement;
    var status = group && group.querySelector('[data-copy-status]');
    var addr = group && group.querySelector('.email-addr');
    var timer = null;
    var setLabel = function (key, fallback) {
      if (!label) return;
      label.setAttribute('data-i18n', key);
      label.textContent = t(key, fallback);
    };
    var announce = function (key, fallback) {
      if (!status) return;
      status.textContent = '';
      // Clear first so the same message is announced again on a repeat click.
      setTimeout(function () { status.textContent = t(key, fallback); }, 60);
    };
    btn.addEventListener('click', function () {
      var email = btn.getAttribute('data-copy-email');
      copyText(email).then(function (ok) {
        btn.focus();
        clearTimeout(timer);
        if (ok) {
          btn.classList.add('is-copied');
          setLabel('contact.copied', 'Copied!');
          announce('contact.copied', 'Copied!');
        } else {
          if (addr) selectText(addr);
          announce('contact.copyFail', 'Couldn’t copy. The address is ' + email);
        }
        timer = setTimeout(function () {
          btn.classList.remove('is-copied');
          setLabel('contact.copy', 'Copy email');
          if (status) status.textContent = '';
        }, 2000);
      });
    });
  });

  /* ---------- #safety opens its FAQ answer ---------- */
  function openSafety() {
    if (location.hash === '#safety') {
      var d = document.getElementById('safety');
      if (d) { d.open = true; }
    }
  }
  openSafety();
  window.addEventListener('hashchange', openSafety);
  document.querySelectorAll('a[href="#safety"]').forEach(function (a) {
    a.addEventListener('click', function () { var d = document.getElementById('safety'); if (d) d.open = true; });
  });

  /* ---------- pause / play every decorative animation (marquee, plate, steam, floating cards) ---------- */
  var marquee = document.querySelector('[data-marquee]');
  var mToggle = document.querySelector('[data-marquee-toggle]');
  if (marquee && mToggle) {
    var label = mToggle.querySelector('[data-marquee-label]');
    mToggle.addEventListener('click', function () {
      var paused = marquee.classList.toggle('paused');
      root.classList.toggle('motion-paused', paused);
      var key = paused ? 'marquee.play' : 'marquee.pause';
      label.setAttribute('data-i18n', key);
      label.textContent = t(key, paused ? 'Play animations' : 'Pause animations');
    });
  }

  /* ---------- example chat: plays once when it scrolls into view ---------- */
  var demo = document.querySelector('[data-chat-demo]');
  if (demo && !reduceMotion && 'IntersectionObserver' in window) {
    demo.classList.add('will-play');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { demo.classList.add('play'); io.disconnect(); }
      });
    }, { threshold: 0.35 });
    io.observe(demo);
    // Never leave content hidden: if anything goes wrong, show it after a while.
    setTimeout(function () { if (!demo.classList.contains('play') && demo.getBoundingClientRect().top < window.innerHeight) demo.classList.add('play'); }, 4000);
  }

  /* ---------- servings demo (sample recipe, local math only) ---------- */
  var servings = document.querySelector('[data-servings]');
  if (servings) {
    var base = Number(servings.getAttribute('data-base')) || 6;
    var value = base;
    var out = servings.querySelector('[data-servings-value]');
    var minus = servings.querySelector('[data-step="-1"]');
    var plus = servings.querySelector('[data-step="1"]');
    var qtys = document.querySelectorAll('.ingredients .qty');
    var fracs = { 0: '', 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' };
    var fmt = function (n, kind) {
      if (kind === 'int') return String(Math.max(1, Math.round(n)));
      // eighths below 1 (small amounts stay close at low servings), quarters above
      var q = n < 1 ? Math.round(n * 8) / 8 : Math.round(n * 4) / 4;
      if (q <= 0) q = 0.125;
      var whole = Math.floor(q), part = q - whole;
      return (whole ? String(whole) : '') + fracs[part];
    };
    var render = function () {
      out.textContent = String(value);
      minus.disabled = value <= 1;
      plus.disabled = value >= 12;
      qtys.forEach(function (q) {
        q.textContent = fmt(Number(q.getAttribute('data-qty')) * value / base, q.getAttribute('data-kind'));
      });
    };
    servings.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        value = Math.min(12, Math.max(1, value + Number(b.getAttribute('data-step'))));
        render();
      });
    });
    render();
  }
})();
