// The 2.4 presentation home uses the policy application's existing view/history flow.
export function setLandingVisible(visible) {
  document.documentElement.classList.toggle('landing-visible', visible);
  document.documentElement.classList.toggle('app-direct', !visible);
  document.getElementById('landing').hidden = !visible;
  document.querySelector('.skip-link').href = visible ? '#landing-start' : '#main';
}

export function initLanding() {
  document.querySelectorAll('#landing [data-scroll-to]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const section = document.querySelector(link.dataset.scrollTo);
      if (!section) return;
      const heading = section.querySelector('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
    });
  });
}
