(function () {
  // Mirrors the Geschirr configurator's sticky preview: on mobile, move the
  // product media gallery to sit right above the product info and make it
  // `position: sticky` there via CSS - native browser stickiness, no manual
  // fixed-position/top math. Shrinks (via width, not scale, so the box's own
  // height actually changes) once it has really stuck, based on a sentinel.
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer) return;

    const desktopParent = mediaWrapper.parentElement;
    const desktopNextSibling = mediaWrapper.nextSibling;
    const sentinelDesktopParent = sentinel.parentElement;
    const sentinelDesktopNextSibling = sentinel.nextSibling;
    const mobileQuery = window.matchMedia('(max-width: 749px)');
    let onMobile = null;

    function apply() {
      const shouldBeMobile = mobileQuery.matches;
      if (shouldBeMobile === onMobile) return;
      onMobile = shouldBeMobile;
      if (shouldBeMobile) {
        infoContainer.insertBefore(sentinel, infoContainer.firstChild);
        infoContainer.insertBefore(mediaWrapper, sentinel.nextSibling);
      } else {
        sentinelDesktopParent.insertBefore(sentinel, sentinelDesktopNextSibling);
        desktopParent.insertBefore(mediaWrapper, desktopNextSibling);
      }
    }

    apply();
    mobileQuery.addEventListener('change', apply);

    const stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          mediaWrapper.classList.toggle('product__media-wrapper--stuck', !entry.isIntersecting);
        });
      },
      { threshold: 0, rootMargin: '40px 0px 0px 0px' }
    );
    stuckObserver.observe(sentinel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
