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

    initPriceMirror(mediaWrapper);
  }

  // Mirror the title/price under the shrunken sticky image, same as the
  // Geschirr configurator - otherwise picking a variant that changes price
  // isn't visible once you've scrolled past the top of the page.
  function initPriceMirror(mediaWrapper) {
    const titleEl = document.querySelector('.product__title');
    const priceContainer = document.querySelector('[id^="price-"]');
    if (!titleEl || !priceContainer) return;

    const mirror = document.createElement('div');
    mirror.className = 'sticky-product-media__price-mirror';
    mirror.innerHTML =
      '<span class="sticky-product-media__price-mirror-title"></span>' +
      '<span class="sticky-product-media__price-mirror-price"></span>';
    mediaWrapper.appendChild(mirror);

    const titleSpan = mirror.querySelector('.sticky-product-media__price-mirror-title');
    const priceSpan = mirror.querySelector('.sticky-product-media__price-mirror-price');
    titleSpan.textContent = titleEl.textContent.trim();

    function syncPrice() {
      const current = priceContainer.querySelector('.price-item--sale') || priceContainer.querySelector('.price-item--regular');
      priceSpan.textContent = current ? current.textContent.trim() : '';
    }

    syncPrice();
    new MutationObserver(syncPrice).observe(priceContainer, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
