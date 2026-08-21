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

  const builtScope = scopeThrough ? document.createElement('div') : null;
  const throughParent = scopeThrough ? scopeThrough.parentElement : null;
  // Everything from the start of throughParent up to and including
  // scopeThrough, captured now (before we move anything) - and whatever
  // originally followed, so we can put it all back in the right order later.
  const throughSiblings = [];
  let restoreBeforeNode = null;
  if (scopeThrough) {
    let node = throughParent.firstChild;
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
  mobileQuery.addEventListener('change', apply);

  const stuckObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        wrapper.classList.toggle('sticky-preview--stuck', !entry.isIntersecting);
      });
    },
    { threshold: 0, rootMargin: '40px 0px 0px 0px' }
  );
  stuckObserver.observe(sentinel);

  if (config.priceMirror) {
    initPriceMirror(wrapper, config.priceMirror);
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
}
