(function () {
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const titleH1 = document.querySelector('.product__title h1');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    // Release right after the Add to Cart button instead of dragging along
    // through the description etc. further down - find the button and use
    // whichever of its ancestors is a direct child of .product__info-container.
    const submitButton = document.querySelector('[id^="ProductSubmitButton-"]');
    let scopeWithEl = infoContainer;
    if (submitButton) {
      let node = submitButton;
      while (node.parentElement && node.parentElement !== infoContainer) {
        node = node.parentElement;
      }
      if (node.parentElement === infoContainer) scopeWithEl = node;
    }

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeWithEl === infoContainer ? '.product__info-container' : null,
      scopeWith: scopeWithEl === infoContainer ? null : scopeWithEl,
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
