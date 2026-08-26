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
  const releaseAt =
    config.releaseAt instanceof Element ? config.releaseAt : config.releaseAt ? document.querySelector(config.releaseAt) : null;
  const releaseGap = config.releaseGap || 0;

  function checkRelease() {
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

  function checkShrink() {
    if (!shrinkTarget && !collapseTargets.length && !priceMirror && !styleInterpolations.length) return;
    if (!mobileQuery.matches) {
      if (shrinkTarget && shrinkTarget.style.width) shrinkTarget.style.width = '';
      collapseTargets.forEach((el) => {
        el.style.maxHeight = '';
        el.style.opacity = '';
        el.style.overflow = '';
      });
      if (priceMirror) priceMirror.style.opacity = '';
      styleInterpolations.forEach(({ el, property }) => {
        el.style[property] = '';
      });
      return;
    }
    const linearProgress = Math.min(1, Math.max(0, window.scrollY / shrinkDistance));
    // Eased (quadratic ease-in): starts noticeably slower than a straight
    // linear ramp, picking up speed toward the end - a flat linear rate
    // felt too fast right at the first scroll pixels.
    const progress = linearProgress * linearProgress;
    if (shrinkTarget) shrinkTarget.style.width = shrinkFrom + (shrinkTo - shrinkFrom) * progress + '%';
    styleInterpolations.forEach(({ el, property, from, to, unit }) => {
      el.style[property] = from + (to - from) * progress + (unit || '');
    });
    // Height/position stay untouched for almost the whole fade - only
    // opacity changes, so title/price never visibly move or resize (a
    // height collapse running at the same time as the fade was described as
    // "sliding into"/overlapping the mirror and the options below). Height
    // is only actually removed right at the very end (progress > 0.92),
    // once opacity is already down to ~0.08 or less - by then invisible
    // enough that the one-step snap needed for correct release-scroll
    // timing doesn't read as a jump.
    collapseTargets.forEach((el, i) => {
      el.style.opacity = 1 - progress;
      if (progress > 0.92) {
        el.style.overflow = 'hidden';
        el.style.maxHeight = collapseNaturalHeights[i] * (1 - progress) * 12.5 + 'px';
      } else {
        el.style.overflow = '';
        el.style.maxHeight = '';
      }
    });
    if (priceMirror) priceMirror.style.opacity = progress;
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
    checkShrink();
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
