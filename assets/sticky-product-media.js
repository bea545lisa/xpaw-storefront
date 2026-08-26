(function () {
  function init() {
    const mediaWrapper = document.querySelector('.product__media-wrapper');
    const sentinel = document.querySelector('.sticky-product-media__sentinel');
    const titleH1 = document.querySelector('.product__title h1');
    const infoContainer = document.querySelector('.product__info-container');
    if (!mediaWrapper || !sentinel || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    // Unlike the Geschirr configurator (which has a long, multi-fieldset
    // options list that genuinely needs to stay attached to the image while
    // scrolling through it), a normal product's options are short - no
    // reason to keep the image pinned through them at all, so it's pushed
    // up (releaseAt below) the instant the options would otherwise start
    // scrolling underneath it. releaseAt must be something that stays
    // visible and normally positioned the whole time (unlike title/price,
    // hidden once stuck) - variant-selects.
    const releaseAnchor = document.querySelector('variant-selects, .product-form__input:not(.product-form__quantity)');
    let scopeThroughEl = null;
    if (releaseAnchor) {
      let node = releaseAnchor;
      while (node.parentElement && node.parentElement !== infoContainer) {
        node = node.parentElement;
      }
      if (node.parentElement === infoContainer) scopeThroughEl = node;
    }

    // releaseAt (below) is what actually controls when the image lets go
    // now, not the scope's own height - but the *native* CSS sticky release
    // was still happening too, later on, once scrolled past the scope's own
    // (smaller, real) height, adding its own movement on top of the
    // transform releaseAt already applies. Together that looked like the
    // image accelerating right at the end of its exit. A large padding
    // keeps the scope tall enough that native release never actually
    // triggers on any realistic page length, leaving releaseAt as the only
    // thing moving it.
    if (scopeThroughEl) scopeThroughEl.classList.add('sticky-preview__release-anchor');

    const eyebrowEl = document.querySelector('.product__info-container .product__text');
    const titleEl = document.querySelector('.product__info-container .product__title');
    const priceEl = document.querySelector('.product__info-container [id^="price-"]');

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      releaseAt: releaseAnchor,
      releaseGap: 32,
      // shrinkFrom used to be 100 (full width) - explicitly setting that via
      // JS was itself the cause of a brief "grows to 100% width" jump right
      // as scrolling started (before that JS wrote anything, the element
      // was already narrower - ~94% of the column - just from its own
      // layout). Starting the shrink already at that same ~94% instead
      // keeps it at the narrower look throughout, matching what looked
      // better anyway.
      shrinkTarget: mediaWrapper.querySelector('media-gallery'),
      shrinkFrom: 94,
      shrinkTo: 64,
      // Shorter than before (was 150) so the whole shrink+collapse settles
      // early, well before enough has been scrolled for the release
      // mechanism (releaseAt, below) to start reacting to variant-selects
      // approaching - the two overlapping in time was adding up to a
      // "speeding up" feeling right as title/price finished collapsing.
      shrinkDistance: 90,
      collapseTargets: [eyebrowEl, titleEl, priceEl],
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
