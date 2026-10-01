/* Small, local-only enhancements. No API calls, analytics, forms, or storage. */
(() => {
  'use strict';
  const viewer = document.querySelector('[data-screenshot-viewer]');
  if (viewer && typeof viewer.showModal === 'function') {
    let opener;
    const close = () => viewer.close();
    document.querySelectorAll('.meal-capture, [data-tour-full]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        const preview = viewer.querySelector('[data-screenshot-image]');
        preview.src = link.href;
        preview.alt = (link.querySelector('img') || document.querySelector('[data-tour-screen]')).alt;
        viewer.showModal();
        document.documentElement.classList.add('screenshot-open');
      });
    });
    viewer.querySelector('[data-screenshot-close]').addEventListener('click', close);
    viewer.addEventListener('click', event => { if (event.target === viewer) close(); });
    viewer.addEventListener('close', () => {
      document.documentElement.classList.remove('screenshot-open');
      if (opener && opener.isConnected) opener.focus({preventScroll: true});
    });
    // Native dialog handles Escape, focus containment, and the inert background.
  }
  const menu = document.querySelector('.mobile-menu');
  const closeMenu = () => { if (menu) menu.open = false; };
  if (menu) {
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        closeMenu();
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) closeMenu();
    });
    window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
  }

  // Keep the old safety anchor useful even though the content is now a FAQ.
  const openHashTarget = () => {
    if (window.location.hash === '#safety') {
      const safety = document.getElementById('safety');
      if (safety) safety.open = true;
    }
  };
  openHashTarget();
  window.addEventListener('hashchange', openHashTarget);
  document.querySelectorAll('a[href="#safety"]').forEach(link => {
    link.addEventListener('click', () => {
      const safety = document.getElementById('safety');
      if (safety) safety.open = true;
    });
  });

  const tour = document.querySelector('[data-product-tour]');
  if (!tour) return;
  const screens = {
    chat: {counter:'01 / 04 — Start anywhere',title:'A little less deciding. A lot more doing.',body:'Breakfast, lunch, dinner, or something in between. Start with a craving, a few ingredients, or whatever energy you have.',light:'home-light',dark:'home-dark',alt:'NELDO chat home with three visible energy modes',features:['Three modes, always within reach','Your conversation comes first','Meals and snacks, all day']},
    meal: {counter:'02 / 04 — Your next meal',title:'The useful details. Right in the chat.',body:'See the estimated time, effort, servings, and ingredients together. Open the recipe when it sounds right, or save it for another day.',light:'gumbo-chat-light',dark:'gumbo-chat-dark',alt:'NELDO gumbo conversation and recipe card',features:['Meal facts at a glance','Cooking method and ingredients','Open or save the recipe']},
    recipe: {counter:'03 / 04 — Make it happen',title:'From a good idea to something on your plate.',body:'Keep the recipe close, check your ingredients, and move into cooking. Your conversation is there when you return.',light:'gumbo-recipe-light',dark:'gumbo-recipe-dark',alt:'NELDO recipe detail with ingredients and cooking actions',features:['Ingredients with amounts','Your recipe in one place','Back to the same conversation']},
    setup: {counter:'04 / 04 — Time to cook',title:'One step at a time. Your pace.',body:'Keep the current step in view, start a timer when you need one, and pick up where you left off.',light:'gumbo-cooking-light',dark:'gumbo-cooking-dark',alt:'Recorded gumbo cooking step and timer in NELDO',features:['Clear cooking steps','Timers when you need them','Resume your cooking']}
  };
  let activeScreen = 'chat';
  let activeMode = 'everyday';
  let theme = 'dark';
  const mealCaptures = [...document.querySelectorAll('.meal-capture')].map(link => ({
    link,
    image: link.querySelector('img'),
    dark: link.getAttribute('href'),
    alt: link.querySelector('img').alt
  }));
  const showMealCaptures = () => mealCaptures.forEach(capture => {
    const source = theme === 'dark' ? capture.dark : capture.dark.replace('-dark.png', '-light.png');
    capture.image.src = source;
    capture.link.href = source;
    capture.image.alt = capture.alt;
  });
  const modeInfo = {
    lowkey: {file:'lowkey',label:'Lowkey',description:'Keep it manageable. Less prep, fewer steps, and something good to eat with the energy you have.'},
    everyday: {file:'home',label:'Everyday',description:'A familiar meal at your usual pace. Enough room to cook, without making it a project.'},
    locked: {file:'locked',label:'Locked In',description:'A little more room to explore. Try a technique or a more involved dish when you feel like cooking.'}
  };
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const showMode = key => {
    activeMode = key;
    const mode = modeInfo[key];
    const shot = document.querySelector('[data-mode-screen]');
    shot.src = `assets/current/${mode.file}-${theme}.png`;
    shot.alt = `${mode.label} selected in NELDO`;
    document.querySelector('[data-mode-description]').textContent = mode.description;
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === key)));
    document.dispatchEvent(new Event('navu-content-change'));
  };
  modeButtons.forEach(button => button.addEventListener('click', () => showMode(button.dataset.mode)));
  document.querySelector('.mode-options').hidden = false;
  const buttons = [...tour.querySelectorAll('[data-tour-tab]')];
  const image = tour.querySelector('[data-tour-screen]');
  const show = key => {
    const screen = screens[key];
    if (!screen) return;
    activeScreen = key;
    const source = `assets/current/${screen[theme]}.png`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tourTab === key)));
    image.src = source;
    image.alt = screen.alt;
    tour.querySelector('[data-tour-counter]').textContent = screen.counter;
    tour.querySelector('[data-tour-title]').textContent = screen.title;
    tour.querySelector('[data-tour-body]').textContent = screen.body;
    tour.querySelector('[data-tour-caption]').textContent = `Recorded example · Sample recipe · ${theme === "dark" ? "Dark" : "Light"} appearance`;
    tour.querySelector('[data-tour-full]').href = source;
    tour.querySelector('[data-tour-features]').replaceChildren(...screen.features.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    document.dispatchEvent(new Event('navu-content-change'));
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => show(button.dataset.tourTab));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      show(buttons[next].dataset.tourTab);
    });
  });
  tour.querySelector('.tour-buttons').hidden = false;
  const themeButton = document.querySelector('[data-theme-toggle]');
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? 'Light view ☼' : 'Dark view ☾';
    themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`);
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#14211b' : '#f7f5ef';
    const hero = document.querySelector('[data-hero-screen]');
    hero.src = `assets/current/gumbo-chat-${theme}.png`;
    hero.alt = 'Recorded NELDO conversation about chicken and sausage gumbo';
    document.querySelector('[data-hero-caption]').textContent = 'Recorded example · Sample recipe';
    show(activeScreen);
    showMode(activeMode);
    showMealCaptures();
    document.dispatchEvent(new Event('navu-content-change'));
  });
  show(activeScreen);
})();
