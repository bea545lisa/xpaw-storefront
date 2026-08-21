(function () {
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const titleH1 = document.querySelector('.product__title h1');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    // Release right after the variant selectors - quantity and the Add to
    // Cart button never join the sticky scope at all, and stickiness is
    // force-detached the moment the cart button enters the viewport.
    const releaseAnchor = document.querySelector('variant-selects, .product-form__input:not(.product-form__quantity)');
    let scopeThroughEl = null;
    if (releaseAnchor) {
      let node = releaseAnchor;
      while (node.parentElement && node.parentElement !== infoContainer) {
        node = node.parentElement;
      }
      if (node.parentElement === infoContainer) scopeThroughEl = node;
    }

    const submitButton = document.querySelector('[id^="ProductSubmitButton-"]');

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      detachAt: submitButton,
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
