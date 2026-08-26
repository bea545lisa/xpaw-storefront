// Shared sticky-preview behaviour, used by both the Geschirr configurator
// and the normal product media gallery. On mobile, moves `wrapper` (plus its
// `sentinel`) into `scope` and relies on native `position: sticky` (see
// sticky-preview.css) - no manual fixed-position/top math, so it can't drift
// out of sync with the header. Toggles `.sticky-preview--stuck` once the
// sentinel scrolls out of view, and optionally mirrors title/price there.
window.initStickyPreview = function (config) {
  const wrapper = document.querySelector(config.wrapper);
  const sentinel = document.querySelector(config.sentinel);
  // Either a plain container to move [sentinel, wrapper] into (`scope`), or
  // an existing element (`scopeThrough`) whose parent's children - from the
  // start up to and including that element, in their original order - all
  // get gathered (together with [sentinel, wrapper] prepended first) into a
  // freshly built wrapper. That makes the sticky element let go right after
  // scopeThrough instead of dragging along through everything else in a much
  // taller shared ancestor, while keeping wrapper visually first (not moved
  // down past content that came after it in the DOM).
  const scope = config.scope ? document.querySelector(config.scope) : null;
  const scopeThrough =
    config.scopeThrough instanceof Element
      ? config.scopeThrough
      : config.scopeThrough
        ? document.querySelector(config.scopeThrough)
        : null;
  if (!wrapper || !sentinel || (!scope && !scopeThrough)) return;

  wrapper.classList.add('sticky-preview');
  sentinel.classList.add('sticky-preview__sentinel');

  const desktopParent = wrapper.parentElement;
  const desktopNextSibling = wrapper.nextSibling;
  const sentinelDesktopParent = sentinel.parentElement;
  const sentinelDesktopNextSibling = sentinel.nextSibling;
  const mobileQuery = window.matchMedia('(max-width: 749px)');
  let onMobile = null;

  const scopeFrom =
    config.scopeFrom instanceof Element ? config.scopeFrom : config.scopeFrom ? document.querySelector(config.scopeFrom) : null;

  const builtScope = scopeThrough ? document.createElement('div') : null;
  if (builtScope) builtScope.className = 'sticky-preview__scope';
  const throughParent = scopeThrough ? scopeThrough.parentElement : null;
  // Everything from scopeFrom (or the start of throughParent, if not given)
  // up to and including scopeThrough, captured now (before we move anything)
  // - and whatever originally followed, so we can put it all back in the
  // right order later. Content *before* scopeFrom (e.g. the title) is never
  // touched, so it can't end up visually overlapped by the sticky wrapper.
  const throughSiblings = [];
  let restoreBeforeNode = null;
  if (scopeThrough) {
    let node = scopeFrom || throughParent.firstChild;
    while (node) {
      const next = node.nextSibling;
      throughSiblings.push(node);
      if (node === scopeThrough) {
        restoreBeforeNode = next;
        break;
      }
      node = next;
    }
  }

  function apply() {
    const shouldBeMobile = mobileQuery.matches;
    if (shouldBeMobile === onMobile) return;
    onMobile = shouldBeMobile;
    if (shouldBeMobile) {
      if (scopeThrough) {
        throughParent.insertBefore(builtScope, throughSiblings[0]);
        builtScope.appendChild(sentinel);
        builtScope.appendChild(wrapper);
        throughSiblings.forEach((node) => builtScope.appendChild(node));
      } else {
        scope.insertBefore(sentinel, scope.firstChild);
        scope.insertBefore(wrapper, sentinel.nextSibling);
      }
    } else {
      sentinelDesktopParent.insertBefore(sentinel, sentinelDesktopNextSibling);
      desktopParent.insertBefore(wrapper, desktopNextSibling);
      if (scopeThrough) {
        // Put every gathered node back exactly where it came from, in order.
        throughSiblings.forEach((node) => throughParent.insertBefore(node, restoreBeforeNode));
        builtScope.remove();
      }
    }
  }

  apply();
  // Re-check shortly after the very first paint too - on some browsers,
  // matchMedia has occasionally reported the wrong result for the first
  // apply() call right at page load (before layout has fully settled),
  // reparenting into the mobile structure on an actual desktop viewport for
  // a moment before snapping back - a visible flash. Re-running apply()
  // once things have settled corrects that even if it happened.
  requestAnimationFrame(() => requestAnimationFrame(apply));
  mobileQuery.addEventListener('change', apply);
  // Extra fallback: if the page was loaded (or a preview/testing tool set
  // its viewport) narrower than 749px and later resized wider without a
  // clean matchMedia "change" firing - e.g. a browser window resized rather
  // than an actual device rotation - the layout would otherwise stay stuck
  // in the mobile, reparented structure forever, even on a wide viewport.
  let resizeTicking = false;
  window.addEventListener(
    'resize',
    () => {
      if (resizeTicking) return;
      resizeTicking = true;
      requestAnimationFrame(() => {
        apply();
        resizeTicking = false;
      });
    },
    { passive: true }
  );

  // The stuck state is backed by an IntersectionObserver *and* a plain
  // scroll check - Safari has a known bug where IntersectionObserver
  // targets tied to a position:sticky element (the sentinel is inside the
  // same sticky-scrolled scope as wrapper) can just never fire, silently
  // leaving the class toggle stuck at its initial value forever. The scroll
  // check is what actually keeps this working there.
  let stuck = false;
  function setStuck(next) {
    if (next === stuck) return;
    stuck = next;
    wrapper.classList.toggle('sticky-preview--stuck', stuck);
  }

  // Optional: instead of trusting the *native* sticky release (which
  // depends on the whole scope's containing-block height - hard to reason
  // about precisely once title/price/eyebrow are also inside it for the
  // image-first layout, and proved to release much later than the geometry
  // suggested it should), push the wrapper up by hand the instant a given
  // element (releaseAt) would otherwise start scrolling underneath it -
  // zero overlap allowed, not just "eventually". Computed every scroll
  // frame via a transform, so it's smooth (no jump, unlike toggling
  // position: static).
  //
  // The reference point is the wrapper's own *natural* (untransformed)
  // bottom edge - stickyTop + its current offsetHeight, which correctly
  // reflects however small it currently is once shrunk, without depending
  // on releaseAt's own height/visibility (releaseAt, e.g. variant-selects,
  // must stay normally laid out and visible the whole time, unlike title/
  // price which get hidden once stuck). Deliberately not wrapper's own live
  // getBoundingClientRect() - that already includes whatever transform was
  // applied last frame, which would feed back into itself and never settle.
  let releaseAt =
    config.releaseAt instanceof Element ? config.releaseAt : config.releaseAt ? document.querySelector(config.releaseAt) : null;
  const releaseGap = config.releaseGap || 0;

  function checkRelease() {
    // Shopify's own variant-change handling (product-info.js) replaces
    // releaseAt (variant-selects) with an entirely new DOM node on every
    // variant change - releaseAt here would otherwise keep pointing at the
    // old, now-detached one forever. getBoundingClientRect() on a detached
    // element returns all zeros, which made pushback shoot up to a huge
    // value (naturalBottom - 0), flinging the image transform way off
    // screen and, combined with the huge padding-bottom trick elsewhere,
    // apparently confusing the page's own scroll math too. Bail out clean
    // instead of computing anything from a detached reference.
    //
    // The old node isn't actually removed until 500ms after the swap
    // (HTMLUpdateUtility.viewTransition in global.js just sets
    // display:none and removes it later) - isConnected alone stays true
    // for that whole window, so a click while deep in the shrink/release
    // range (image mostly pushed off-screen already) read the same
    // all-zero rect from the still-connected-but-hidden old node and
    // yanked the image further up until the 500ms timeout finally removed
    // it. offsetParent is null for a display:none element immediately, so
    // checking it catches this right away instead of waiting.
    if (releaseAt && (!releaseAt.isConnected || releaseAt.offsetParent === null)) {
      const fresh = document.querySelector('variant-selects, .product-form__input:not(.product-form__quantity)');
      if (fresh) fresh.classList.add('sticky-preview__release-anchor');
      releaseAt = fresh;
    }
    if (!releaseAt) {
      if (wrapper.style.transform) wrapper.style.transform = '';
      return;
    }
    if (!mobileQuery.matches) {
      if (wrapper.style.transform) wrapper.style.transform = '';
      return;
    }
    const stickyTop = parseFloat(getComputedStyle(wrapper).top) || 0;
    const naturalBottom = stickyTop + wrapper.offsetHeight + releaseGap;
    const rect = releaseAt.getBoundingClientRect();
    const pushback = Math.max(0, naturalBottom - rect.top);
    wrapper.style.transform = pushback > 0 ? `translateY(-${pushback}px)` : '';
  }

  // Optional: shrink shrinkTarget's width continuously as a direct function
  // of scroll position (0 to shrinkDistance px), rather than via a CSS
  // transition triggered once by the --stuck class. A CSS transition runs
  // on a fixed wall-clock timer once started - scroll fast and it either
  // keeps animating after you've stopped, or lags behind where you actually
  // are, which reads as "too fast"/janky regardless of how long the
  // transition is set to. Tying width directly to scroll position removes
  // that mismatch entirely: there's no independent timer to be in or out of
  // sync with.
  const shrinkTarget =
    config.shrinkTarget instanceof Element ? config.shrinkTarget : config.shrinkTarget ? document.querySelector(config.shrinkTarget) : null;
  const shrinkFrom = config.shrinkFrom != null ? config.shrinkFrom : 100;
  const shrinkTo = config.shrinkTo != null ? config.shrinkTo : 100;
  const shrinkDistance = config.shrinkDistance || 150;

  // Elements (e.g. eyebrow/title/price) that should collapse away in step
  // with the same shrink, read here as their natural (full) height once up
  // front, then interpolated between that and 0 every frame - driven by the
  // *exact same* progress value as shrinkTarget's width, so they can never
  // drift out of sync with it or with each other. An earlier version used
  // position: absolute to pull them out of flow and let them fade in place,
  // but browsers don't reliably preserve each element's own "static
  // position" once several siblings go absolute at once - title and price
  // ended up swapping places. Interpolating max-height instead keeps every
  // element exactly where normal flow already puts it.
  const collapseTargets = Array.isArray(config.collapseTargets) ? config.collapseTargets.filter(Boolean) : [];
  const collapseNaturalHeights = collapseTargets.map((el) => el.offsetHeight);
  // Set by initPriceMirror below (declared here so checkShrink's closure can
  // see it once it exists - checkShrink itself only ever runs later, from a
  // scroll event, by which point setup below has already run).
  let priceMirror = null;

  // Any other CSS properties (e.g. a slider's own negative-margin "peek"
  // bleed) that need to move in the exact same lockstep as the shrink -
  // {el, property, from, to, unit}. Reset instantly via a --stuck-gated CSS
  // rule before, which - like the width itself used to be - snapped to its
  // end value on the very first scroll pixel while the real shrink was
  // still barely underway, reading as a sideways jump right at the start.
  const styleInterpolations = Array.isArray(config.styleInterpolations) ? config.styleInterpolations : [];
  let smoothedLinearProgress = 0;

  // Rounds before writing, and skips the write entirely if the rounded value
  // hasn't actually changed since the last frame. Without this, every frame
  // wrote a fresh, barely-different sub-pixel value (e.g. 63.4821...% vs
  // 63.4823...%) - each one still a real style write, and each one still
  // enough to re-trigger Dawn's own slider-component ResizeObserver
  // (initPages/update in global.js), which was visible as a continuous
  // subtle wobble in the image the entire time scrolling, not just at the
  // start/end. Whole pixels for px values, one decimal for %/unitless -
  // both far below what's visually perceptible as a size change, but coarse
  // enough that most frames now genuinely have nothing new to write.
  const lastWrittenValues = new WeakMap();
  function writeInterpolatedStyle(el, property, value, unit, important) {
    const rounded = (unit === 'px' ? Math.round(value) : Math.round(value * 10) / 10) + unit;
    let byProperty = lastWrittenValues.get(el);
    if (!byProperty) {
      byProperty = new Map();
      lastWrittenValues.set(el, byProperty);
    }
    if (byProperty.get(property) === rounded) return false;
    byProperty.set(property, rounded);
    el.style.setProperty(property, rounded, important ? 'important' : '');
    return true;
  }

  // Dawn's own slider-component (global.js) tracks prev/next button
  // [[disabled]] state from its *own* measured this.slider.clientWidth,
  // recalculated only when its ResizeObserver fires - async, on its own
  // schedule. slider-component itself keeps its natural (peek-gutter)
  // width the whole time (only the ancestor media-gallery/wrapper actually
  // shrinks, see the media-gallery overflow:hidden comment below), so as
  // that ancestor narrows, slider-component's own width measurement
  // increasingly disagrees with what's actually visible - its ResizeObserver
  // still fires (it observes the same box), but seemingly not reliably
  // enough while continuously resized, so the next-button on the last image
  // was staying enabled/visible once shrunk. Forcing a synchronous
  // recalculation right after our own resize keeps it always in lockstep
  // with the true, current geometry instead of trailing behind on its own.
  // Same root cause also left the horizontal scroll position itself out of
  // sync: scrollLeft is a plain pixel value, but shrinking/growing the
  // ancestor changes each slide's actual pixel width, so a scrollLeft that
  // exactly framed a slide before no longer does after - swipe to image 2
  // while shrunk, then scroll back up (grow again), and the old pixel
  // scrollLeft now lands between two slides, showing a sliver of each.
  // Re-deriving the *slide index* from the old scrollLeft/offset before
  // resizing, then re-applying that index against the freshly recalculated
  // offset, keeps whichever slide is currently being viewed exactly framed
  // regardless of how much the container just changed size. Deliberately
  // not `.is-active` (media-gallery.js) - that class only moves on an
  // explicit thumbnail click/variant change, not on a plain swipe, so
  // snapping to it during a vertical scroll after swiping (without picking
  // a thumbnail) kept yanking the view back to whatever was last explicitly
  // selected - normally the first slide.
  const sliderComponent = config.sliderComponent instanceof Element ? config.sliderComponent : null;
  function resyncSlider() {
    if (!sliderComponent || !sliderComponent.slider) return;
    // currentPage (1-indexed) is slider-component's own tracked position,
    // already correctly accounting for its leading gutter/peek inset - more
    // reliable than re-deriving an index from scrollLeft/offset ourselves,
    // which doesn't account for that inset and left the re-snapped position
    // just slightly off. Landing a few px short of the true last-slide
    // offset was enough for isSlideVisible() (global.js) to keep judging it
    // "not fully visible", so the next-button's disabled state never
    // actually cleared on the last image.
    const slideIndex = Math.max(0, (sliderComponent.currentPage || 1) - 1);
    sliderComponent.initPages?.();
    const targetSlide = sliderComponent.sliderItemsToShow?.[slideIndex];
    if (targetSlide) sliderComponent.slider.scrollTo({ left: targetSlide.offsetLeft });
    // initPages() already called update() once above, but against the
    // scrollLeft from *before* our scrollTo just now - the real correction
    // only arrives once the browser gets around to firing its own 'scroll'
    // event for that scrollTo, which isn't guaranteed to happen before the
    // next paint. Calling it again immediately keeps the disabled state
    // (and currentPage) in sync with the position we just set, not the
    // stale one from a moment ago.
    sliderComponent.update?.();
  }

  function checkShrink() {
    if (!shrinkTarget && !collapseTargets.length && !priceMirror && !styleInterpolations.length) return true;
    if (!mobileQuery.matches) {
      if (shrinkTarget && shrinkTarget.style.width) {
        shrinkTarget.style.width = '';
        resyncSlider();
      }
      collapseTargets.forEach((el) => {
        el.style.maxHeight = '';
        el.style.opacity = '';
        el.style.overflow = '';
      });
      if (priceMirror) priceMirror.style.opacity = '';
      styleInterpolations.forEach(({ el, property }) => {
        el.style.removeProperty(property);
      });
      return true;
    }
    const targetLinearProgress = Math.min(1, Math.max(0, window.scrollY / shrinkDistance));
    // Smoothed rather than used directly - real scroll position isn't
    // perfectly stable frame to frame (momentum scrolling settling,
    // elastic/rubber-band bounce, sub-pixel jitter), and reading it 1:1
    // showed up live as a visible flicker (DevTools caught opacity
    // oscillating between 0.61 and 0.618844 while the page looked
    // stationary). Easing the tracked value toward the real one instead of
    // snapping to it irons that out, at the cost of trailing slightly
    // behind during fast scrolling - not noticeable in practice.
    smoothedLinearProgress += (targetLinearProgress - smoothedLinearProgress) * 0.3;
    if (Math.abs(smoothedLinearProgress - targetLinearProgress) < 0.0015) smoothedLinearProgress = targetLinearProgress;
    const linearProgress = smoothedLinearProgress;
    // Eased (quadratic ease-in): starts noticeably slower than a straight
    // linear ramp, picking up speed toward the end - a flat linear rate
    // felt too fast right at the first scroll pixels.
    const progress = linearProgress * linearProgress;
    if (shrinkTarget) {
      // Reverted the >=0.3-percentage-point write threshold this had -
      // meant as a defensive measure against Dawn's slider-component
      // ResizeObserver (initPages/update in global.js) firing on every
      // frame, but the ease-in curve makes progress barely move for the
      // first several scroll pixels, so the threshold delayed the very
      // first write - then applied a comparatively large jump all at once
      // when it finally fired, which read as a jump in exactly the way this
      // was meant to prevent. Writing every frame instead - but rounded (see
      // writeInterpolatedStyle below), which already skips no-op rewrites.
      const targetWidthPct = shrinkFrom + (shrinkTo - shrinkFrom) * progress;
      if (writeInterpolatedStyle(shrinkTarget, 'width', targetWidthPct, '%')) resyncSlider();
    }
    styleInterpolations.forEach(({ el, property, from, to, unit, important }) => {
      writeInterpolatedStyle(el, property, from + (to - from) * progress, unit || '', important);
    });
    // Height/position stay untouched for almost the whole fade - only
    // opacity changes, so title/price never visibly move or resize (a
    // height collapse running at the same time as the fade was described as
    // "sliding into"/overlapping the mirror and the options below). Height
    // only starts reducing in the last 30% of the shrink (progress > 0.7,
    // opacity already down to 0.3) rather than the last 8% - collapsing
    // that much height over so little scroll distance read as a quick jerk
    // right when title/price finished fading. Spread over more distance
    // instead, still while mostly faded out.
    collapseTargets.forEach((el, i) => {
      el.style.opacity = 1 - progress;
      if (progress > 0.7) {
        el.style.overflow = 'hidden';
        el.style.maxHeight = collapseNaturalHeights[i] * ((1 - progress) / 0.3) + 'px';
      } else {
        el.style.overflow = '';
        el.style.maxHeight = '';
      }
    });
    if (priceMirror) priceMirror.style.opacity = progress;
    return smoothedLinearProgress === targetLinearProgress;
  }

  // Smoothing (above) only approaches the real scroll-derived value over
  // several frames - if it just relied on new scroll events to keep ticking,
  // stopping scrolling abruptly would freeze it part-way there. This keeps
  // requesting frames on its own, independent of scroll events, until it's
  // actually caught up.
  let settling = false;
  function settleShrink() {
    if (checkShrink()) {
      settling = false;
      return;
    }
    requestAnimationFrame(settleShrink);
  }
  function checkShrinkAndSettle() {
    checkShrink();
    if (!settling) {
      settling = true;
      requestAnimationFrame(settleShrink);
    }
  }

  // stuck and release are checked together, in one rAF tick per scroll
  // event, so all the layout reads (getBoundingClientRect/offsetHeight)
  // happen before any of the style writes (classList.toggle/style.transform)
  // instead of interleaved across two separate ticks - each write in
  // between a read forces an extra synchronous layout recalculation, which
  // was making the whole scroll feel janky.
  function checkScrollState() {
    // Was rect.top < 40, meaning shrinking only started once already
    // scrolled some way in - but the wrapper's own native position: sticky
    // pinning kicks in earlier than that (as soon as its natural position
    // would go above the sticky offset), so there was a visible gap where
    // the image was already pinned at the top but not yet shrinking.
    // window.scrollY > 0 starts it right on the very first scroll pixel.
    setStuck(window.scrollY > 0);
    checkShrinkAndSettle();
    if (releaseAt) checkRelease();
  }

  const stuckObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => setStuck(!entry.isIntersecting));
    },
    { threshold: 0, rootMargin: '40px 0px 0px 0px' }
  );
  stuckObserver.observe(sentinel);
  checkScrollState();

  let scrollTicking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        checkScrollState();
        scrollTicking = false;
      });
    },
    { passive: true }
  );

  // Optional: force the wrapper to let go entirely (position: static) once a
  // given element - e.g. the Add to Cart button - is getting close to the
  // viewport, instead of waiting for it to scroll fully into view.
  const detachAt =
    config.detachAt instanceof Element ? config.detachAt : config.detachAt ? document.querySelector(config.detachAt) : null;
  if (detachAt) {
    let detached = false;
    function setDetached(next) {
      if (next === detached) return;
      detached = next;
      wrapper.classList.toggle('sticky-preview--detached', detached);
    }

    function checkScroll() {
      const rect = detachAt.getBoundingClientRect();
      // Bug: this used to compare against window.innerHeight + 150, which is
      // true for virtually any on-screen position - detaching immediately on
      // short pages before any scrolling happened at all. Only detach once
      // the button is actually nearing the *top* of the viewport.
      setDetached(rect.top < 150);
    }

    const detachObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setDetached(entry.isIntersecting));
      },
      { threshold: 0, rootMargin: '0px 0px 150px 0px' }
    );
    detachObserver.observe(detachAt);

    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          checkScroll();
          ticking = false;
        });
      },
      { passive: true }
    );
    checkScroll();
  }

  if (config.priceMirror) {
    priceMirror = initPriceMirror(wrapper, config.priceMirror);
  }
};

function initPriceMirror(wrapper, mirrorConfig) {
  const priceContainer = document.querySelector(mirrorConfig.priceContainerSelector);
  if (!priceContainer) return;

  const mirror = document.createElement('div');
  mirror.className = 'sticky-preview__price-mirror';
  mirror.innerHTML =
    '<span class="sticky-preview__price-mirror-title"></span>' +
    '<span class="sticky-preview__price-mirror-price"></span>';
  mirrorConfig.appendTo === 'wrapper' ? wrapper.appendChild(mirror) : mirrorConfig.appendTo.appendChild(mirror);

  const titleSpan = mirror.querySelector('.sticky-preview__price-mirror-title');
  const priceSpan = mirror.querySelector('.sticky-preview__price-mirror-price');
  titleSpan.textContent = mirrorConfig.title || '';

  function syncPrice() {
    const current = priceContainer.querySelector('.price-item--sale') || priceContainer.querySelector('.price-item--regular');
    priceSpan.textContent = current ? current.textContent.trim() : '';
  }

  syncPrice();
  new MutationObserver(syncPrice).observe(priceContainer, { childList: true, subtree: true, characterData: true });

  return mirror;
}
