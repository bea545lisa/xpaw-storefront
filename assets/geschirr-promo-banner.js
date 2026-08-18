(function () {
  function init() {
    document.querySelectorAll('.geschirr-promo').forEach((promo) => {
      const slides = promo.querySelectorAll('.geschirr-promo__slide');
      if (slides.length < 2) return;

      const interval = parseFloat(promo.dataset.interval) || 2.5;
      let index = Array.from(slides).findIndex((s) => s.classList.contains('geschirr-promo__slide--active'));
      if (index < 0) index = 0;

      setInterval(() => {
        slides[index].classList.remove('geschirr-promo__slide--active');
        index = (index + 1) % slides.length;
        slides[index].classList.add('geschirr-promo__slide--active');
      }, interval * 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
