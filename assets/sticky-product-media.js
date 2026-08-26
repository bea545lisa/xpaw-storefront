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

    // The mobile slider's own "peek next slide" bleed (negative margins,
    // extra padding) used to reset instantly via a --stuck-gated CSS rule -
    // fine when the shrink itself was also instant/CSS-driven, but once
    // width became scroll-linked (see shrinkTarget below) that reset still
    // snapped to its end value on the very first scroll pixel while the
    // real shrink had barely started, reading as a sideways jump. Interpolated
    // here in the same lockstep instead, in rem-derived px (this theme uses
    // 1rem = 10px, not the browser default 16px).
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const mediaList = mediaWrapper.querySelector('.product__media-list');
    const sliderComponent = mediaWrapper.querySelector('slider-component:not(.thumbnail-slider--no-slide)');
    const mediaItems = Array.from(mediaWrapper.querySelectorAll('.product__media-item'));
    const styleInterpolations = [];
    if (mediaList) styleInterpolations.push({ el: mediaList, property: 'marginLeft', from: -2.5 * remPx, to: 0, unit: 'px' });
    if (sliderComponent) {
      styleInterpolations.push({ el: sliderComponent, property: 'marginLeft', from: -1.5 * remPx, to: 0, unit: 'px' });
      styleInterpolations.push({ el: sliderComponent, property: 'marginRight', from: -1.5 * remPx, to: 0, unit: 'px' });
    }
    mediaItems.forEach((item) => {
      styleInterpolations.push({ el: item, property: 'paddingLeft', from: 2.5 * remPx, to: 0, unit: 'px' });
      styleInterpolations.push({ el: item, property: 'paddingRight', from: 1.5 * remPx, to: 0, unit: 'px' });
    });

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      releaseAt: releaseAnchor,
      releaseGap: 32,
      shrinkTarget: mediaWrapper.querySelector('media-gallery'),
      shrinkFrom: 100,
      shrinkTo: 64,
      shrinkDistance: 150,
      collapseTargets: [eyebrowEl, titleEl, priceEl],
      styleInterpolations,
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
