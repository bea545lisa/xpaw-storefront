(function () {
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const titleH1 = document.querySelector('.product__title h1');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    // Quantity and the Add to Cart button never join the sticky scope at
    // all - but the *natural* CSS sticky release still depends on the full
    // scope height (image + eyebrow + title + price + options all count
    // toward it, since title/price have to be inside the scope too for the
    // image-first layout), so it lets go far later than "right after the
    // options" on its own. detachAt below is what actually forces the early
    // release, independent of that scope height.
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

    // Detach right as the quantity field approaches (it sits ~15px below
    // the options), not at the Add to Cart button further down - that's
    // what actually makes the image let go right after the options instead
    // of dragging all the way down.
    const detachTarget = document.querySelector('.product-form__quantity') || document.querySelector('[id^="ProductSubmitButton-"]');

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      detachAt: detachTarget,
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
