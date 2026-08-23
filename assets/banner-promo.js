(function () {
  function setupArrowAnimation(promo) {
    const arrow = promo.querySelector('.banner-promo__arrow[data-animate-arrow]');
    if (!arrow) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            arrow.classList.add('banner-promo__arrow--in-view');
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(arrow);
  }

  function setup(promo) {
    setupArrowAnimation(promo);

    const slides = Array.from(promo.querySelectorAll('.banner-promo__slide'));
    if (slides.length < 2) return;

    const interval = parseFloat(promo.dataset.interval) || 2.5;
    let index = slides.findIndex((s) => s.classList.contains('banner-promo__slide--active'));
    if (index < 0) index = 0;

    let timer = null;

    function show(i) {
      slides[index].classList.remove('banner-promo__slide--active');
      index = i;
      slides[index].classList.add('banner-promo__slide--active');
    }

    function start() {
      stop();
      timer = setInterval(() => {
        show((index + 1) % slides.length);
      }, interval * 1000);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    start();

    document.addEventListener('shopify:block:select', (event) => {
      const slide = slides.find((s) => s.dataset.blockId === event.detail.blockId);
      if (!slide) return;
      stop();
      show(slides.indexOf(slide));
    });

    document.addEventListener('shopify:block:deselect', (event) => {
      const isOurs = slides.some((s) => s.dataset.blockId === event.detail.blockId);
      if (isOurs) start();
    });
  }

  function init() {
    document.querySelectorAll('.banner-promo').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
