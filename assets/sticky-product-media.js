(function () {
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const titleH1 = document.querySelector('.product__title h1');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    // Quantity and the Add to Cart button never join the sticky scope at
    // all - but the natural CSS sticky release only lets go once the whole
    // scope (image + eyebrow + title + price + options) has scrolled past,
    // which in practice released much later than that geometry suggested it
    // should. releaseAt (passed below) pushes the wrapper up by hand once
    // this element has scrolled past instead, timed directly off its real
    // position rather than the scope's total height.
    const releaseAnchor = document.querySelector('variant-selects, .product-form__input:not(.product-form__quantity)');
    let scopeThroughEl = null;
    if (releaseAnchor) {
      let node = releaseAnchor;
      while (node.parentElement && node.parentElement !== infoContainer) {
        node = node.parentElement;
      }
      if (node.parentElement === infoContainer) scopeThroughEl = node;
    }

    // Small bit of room at the end of the sticky scope so it doesn't
    // release mid-row on the last swatch - but small enough to still let go
    // right after the options, before the quantity field starts (the two sit
    // only ~15px apart, so anything close to 4rem was dragging the release
    // point down into the quantity field itself).
    if (scopeThroughEl) {
      scopeThroughEl.style.paddingBottom = '0.5rem';
    }

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      releaseAt: releaseAnchor,
      priceMirror: {
        priceContainerSelector: '[id^="price-"]',
        title: titleH1 ? titleH1.textContent.trim() : '',
        appendTo: mediaWrapper,
      },
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
