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

    // The outer bar itself (mediaWrapper) bleeds to full viewport width once
    // stuck (width: 100vw + margin-left: calc(50% - 50vw), both !important,
    // in section-main-product.css) - but that CSS rule only has background/
    // padding/border/box-shadow in its transition list, not width or
    // margin-left, so the bleed itself snapped in instantly right as
    // scrolling started ("the wrapper gets bigger" - confirmed live via its
    // own class). Interpolated here instead, in the same scroll-linked
    // lockstep as everything else. Measured before any of this runs, so
    // naturalWidth reflects the plain grid-column width, not the bled one.
    // setProperty(..., 'important') is required - a plain (non-!important)
    // inline style can't win against the CSS rule's own !important once
    // --stuck adds it.
    const naturalWidth = mediaWrapper.getBoundingClientRect().width;
    const scopeWidth = mediaWrapper.parentElement.getBoundingClientRect().width;
    const bleedMarginLeft = scopeWidth / 2 - window.innerWidth / 2;
    const wrapperStyleInterpolations = [
      { el: mediaWrapper, property: 'width', from: naturalWidth, to: window.innerWidth, unit: 'px', important: true },
      { el: mediaWrapper, property: 'margin-left', from: 0, to: bleedMarginLeft, unit: 'px', important: true },
    ];

    // Zoom icon(s) shrink in the same lockstep as everything else instead of
    // staying a fixed 3.6rem the whole time - one exists per slide, not
    // just the active one.
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    mediaWrapper.querySelectorAll('.product__media-icon').forEach((zoomIcon) => {
      wrapperStyleInterpolations.push(
        { el: zoomIcon, property: 'width', from: 3.6 * remPx, to: 2.6 * remPx, unit: 'px', important: true },
        { el: zoomIcon, property: 'height', from: 3.6 * remPx, to: 2.6 * remPx, unit: 'px', important: true }
      );
    });

    // Slider prev/next arrows shrink the same way (base size is 44px).
    mediaWrapper.querySelectorAll('.slider-button').forEach((sliderButton) => {
      wrapperStyleInterpolations.push(
        { el: sliderButton, property: 'width', from: 44, to: 32, unit: 'px', important: true },
        { el: sliderButton, property: 'height', from: 44, to: 32, unit: 'px', important: true }
      );
    });

    // Dawn's own prev/next [disabled] logic (SliderComponent.update() in
    // global.js) is driven by its page-based math (currentPage/totalPages),
    // which has its own edge case completely independent of our sticky
    // shrinking: with exactly 2 images and the mobile "peek" gutter, the
    // slide is wider than the visible viewport, so its slidesPerPage
    // calculation floors to 0 and totalPages comes out as 3 for only 2 real
    // images - after which currentPage never actually reaches "the last
    // page" the way the disabled check expects, so the right arrow never
    // gets disabled at all, regardless of scroll/shrink state. Bypassing
    // that entirely here: hide/show each arrow from the slider's own raw
    // scroll geometry (scrollLeft/scrollWidth/clientWidth) instead, which
    // has no such edge case.
    const galleryViewerSlider = mediaWrapper.querySelector('slider-component[id^="GalleryViewer-"]');
    if (galleryViewerSlider && galleryViewerSlider.slider) {
      const scrollEl = galleryViewerSlider.slider;
      const nextArrowBtn = galleryViewerSlider.querySelector('button[name="next"]');
      const prevArrowBtn = galleryViewerSlider.querySelector('button[name="previous"]');
      const EPS = 2;
      const syncArrowVisibility = () => {
        if (prevArrowBtn) prevArrowBtn.classList.toggle('sticky-preview__arrow-hidden', scrollEl.scrollLeft <= EPS);
        if (nextArrowBtn) {
          nextArrowBtn.classList.toggle(
            'sticky-preview__arrow-hidden',
            scrollEl.scrollLeft + scrollEl.clientWidth >= scrollEl.scrollWidth - EPS
          );
        }
      };
      syncArrowVisibility();
      let arrowTicking = false;
      scrollEl.addEventListener(
        'scroll',
        () => {
          if (arrowTicking) return;
          arrowTicking = true;
          requestAnimationFrame(() => {
            syncArrowVisibility();
            arrowTicking = false;
          });
        },
        { passive: true }
      );
      new ResizeObserver(syncArrowVisibility).observe(scrollEl);
    }

    window.initStickyPreview({
      wrapper: '.product__media-wrapper',
      sentinel: '.sticky-product-media__sentinel',
      sliderComponent: galleryViewerSlider,
      scope: scopeThroughEl ? null : '.product__info-container',
      scopeThrough: scopeThroughEl,
      releaseAt: releaseAnchor,
      releaseGap: 32,
      // Back to 100 - the "grows to 100%" jump this was lowered to 94 to
      // avoid was actually the *outer bar* (mediaWrapper) bleeding to full
      // viewport width instantly, now fixed separately below
      // (wrapperStyleInterpolations). 94% was calibrated against that old,
      // narrower, un-bled bar - once the bar itself properly bleeds,
      // media-gallery needs to fill 100% of it or the zoom icon/slider
      // arrows end up sitting oddly close to a phantom inner edge.
      shrinkTarget: mediaWrapper.querySelector('media-gallery'),
      shrinkFrom: 100,
      shrinkTo: 64,
      // Shorter than before (was 150) so the whole shrink+collapse settles
      // early, well before enough has been scrolled for the release
      // mechanism (releaseAt, below) to start reacting to variant-selects
      // approaching - the two overlapping in time was adding up to a
      // "speeding up" feeling right as title/price finished collapsing.
      shrinkDistance: 90,
      collapseTargets: [eyebrowEl, titleEl, priceEl],
      styleInterpolations: wrapperStyleInterpolations,
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
