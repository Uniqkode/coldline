(() => {
  'use strict';
  const header = document.querySelector('.startup-header');
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#primary-navigation');
  const closeMenu = () => {
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label', 'Open menu');
    navigation?.classList.remove('open');
  };
  navigation?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('click', event => {
    if (header && !header.contains(event.target)) closeMenu();
  });
  navigation?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      menu?.focus();
    }
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealNodes = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealNodes.forEach(node => {
      node.classList.add('will-reveal');
      observer.observe(node);
    });
    reduceMotion.addEventListener('change', event => {
      if (event.matches) {
        observer.disconnect();
        revealNodes.forEach(node => node.classList.add('is-visible'));
      }
    });
  }

  const tabs = [...document.querySelectorAll('[data-journey-tab]')];
  const panels = [...document.querySelectorAll('[data-journey-panel]')];
  const activateTab = index => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      activateTab(next);
      tabs[next].focus();
    });
  });

  const faq = document.querySelector('.c-faq-list');
  faq?.addEventListener('toggle', event => {
    if (!event.target.open) return;
    faq.querySelectorAll('details[open]').forEach(item => {
      if (item !== event.target) item.open = false;
    });
  }, true);
})();
