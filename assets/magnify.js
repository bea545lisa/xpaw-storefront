function getImageSrc(image) {
  if (image.tagName === 'IMG') return image.src;
  const bg = image.style.backgroundImage;
  const match = bg.match(/url\(["']?(.*?)["']?\)/);
  return match ? match[1] : '';
}

function eventPoint(event) {
  if (event.touches && event.touches.length) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (event.changedTouches && event.changedTouches.length) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

// Full-screen lightbox: shows the image large over a solid backdrop that
// covers the whole viewport, so nothing scrolls through behind it. Panning
// with mouse-drag or touch-drag moves the zoomed image within the frame.
function openZoomOverlay(image, zoomRatio) {
  const src = getImageSrc(image);
  if (!src) return;
  openZoomOverlaySrc(src, zoomRatio);
}

let zoomOverlayOpen = false;

function openZoomOverlaySrc(src, zoomRatio) {
  if (!src || zoomOverlayOpen) return;
  zoomOverlayOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'image-magnify-full-size';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Bild vergroessert');

  const frame = document.createElement('div');
  frame.className = 'image-magnify-full-size__frame';
  frame.style.backgroundImage = `url('${src}')`;
  // Placeholder size until the natural image dimensions are known (below) -
  // width-only based on the window's own dimensions (known synchronously,
  // right now) rather than a percentage of the frame's own box - a percentage
  // depends on the frame having already been laid out, which on the very
  // first open of the whole page wasn't reliably true yet and showed
  // unzoomed until closed and reopened.
  frame.style.backgroundSize = `${Math.round(window.innerWidth * zoomRatio)}px auto`;
  frame.style.backgroundPosition = '50% 50%';

  // width-only sizing above covers the frame horizontally, but for a photo
  // whose aspect ratio is wider than the viewport's, the auto-height comes
  // out shorter than the frame - leaving the dark backdrop visible as a
  // border above/below once panned to the top/bottom edge. Once the real
  // image dimensions are known, size it like background-size: cover (scaled
  // up further by zoomRatio) so it always fully fills the frame in both
  // directions, in every direction, no matter the photo's aspect ratio.
  const preload = new Image();
  preload.onload = () => {
    if (!preload.naturalWidth || !preload.naturalHeight) return;
    const coverScale = Math.max(
      window.innerWidth / preload.naturalWidth,
      window.innerHeight / preload.naturalHeight
    );
    const width = preload.naturalWidth * coverScale * zoomRatio;
    const height = preload.naturalHeight * coverScale * zoomRatio;
    frame.style.backgroundSize = `${Math.round(width)}px ${Math.round(height)}px`;
  };
  preload.src = src;
  // A zero-width space keeps this div from matching the theme's global
  // `div:empty { display: none }` rule (an empty background-image div still
  // counts as "empty" for that selector, which was collapsing it to 0x0).
  frame.appendChild(document.createTextNode('​'));
  overlay.appendChild(frame);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'image-magnify-full-size__close';
  closeButton.setAttribute('aria-label', 'Schliessen');
  closeButton.innerHTML = '&times;';
  overlay.appendChild(closeButton);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
    zoomOverlayOpen = false;
  }

  function setPosition(clientX, clientY) {
    const rect = frame.getBoundingClientRect();
    // Ungeklemmt konnte ein schneller Wisch/Zug ueber den Rahmenrand hinaus
    // (z.B. Touch-Overscroll) xPercent/yPercent unter 0 oder ueber 100
    // treiben - background-position akzeptiert das klaglos und schiebt das
    // Bild dann sichtbar ueber den Rahmenrand hinaus, sodass der dunkle
    // Hintergrund als Rand am Bildende durchscheint. Auf 0-100 begrenzen,
    // damit das Bild dort stehen bleibt, wo es endet.
    const xPercent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    frame.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
  }

  closeButton.addEventListener('click', close);

  frame.addEventListener('mousemove', (event) => setPosition(event.clientX, event.clientY));

  frame.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
      const point = eventPoint(event);
      setPosition(point.x, point.y);
    },
    { passive: false }
  );
}

// Dawn's modal-opener button has a `::after` pseudo-element stacked
// (z-index: 2) directly over the whole thumbnail to catch clicks for its own
// native gallery modal. A click there reports the BUTTON as event.target, not
// the image underneath it, so a plain `.closest('.image-magnify-hover')`
// check misses it entirely and the native modal opens unopposed on the first
// click. Resolve through the toggle button to the image sitting next to it
// in the same media container as a fallback.
function resolveMagnifyImage(target) {
  const direct = target.closest('.image-magnify-hover');
  if (direct) return direct;
  const toggle = target.closest('.product__media-toggle');
  if (!toggle) return null;
  const container = toggle.closest('.product-media-container') || toggle.parentElement;
  if (!container) return null;
  const candidates = container.querySelectorAll('.image-magnify-hover');
  for (const el of candidates) {
    const cs = getComputedStyle(el);
    if (cs.display !== 'none' && cs.visibility !== 'hidden') return el;
  }
  return candidates[0] || null;
}

function enableZoomOnHover(ratios) {
  let ignoreNextClick = false;

  function currentZoomRatio() {
    return window.matchMedia('(max-width: 749px)').matches ? ratios.mobile : ratios.desktop;
  }

  // Capture phase (fires before bubbling reaches the native Dawn
  // modal-opener wrapping the thumbnail) so we can stop the click from also
  // triggering the built-in gallery modal - without this, both open at once
  // and the native one (higher in the DOM/z-index) hides ours underneath,
  // making it look like zoom "doesn't work" until a second click closes it.
  document.addEventListener(
    'click',
    (event) => {
      const image = resolveMagnifyImage(event.target);
      if (!image) return;
      // The Geschirr configurator's canvas-composite preview also carries
      // .image-magnify-hover (for the cursor/hover styling), but it's a
      // plain <div> of <canvas> layers - neither an <img> nor a
      // background-image div, so getImageSrc() can't get anything out of
      // it. Stopping propagation unconditionally here swallowed the click
      // before it could ever reach the configurator's own click listener
      // (geschirr-configurator.js, builds the composite canvas and calls
      // window.openZoomOverlaySrc itself) - zoom silently did nothing.
      // Only intercept when there's actually a usable src; otherwise let
      // the click proceed normally so another handler can deal with it.
      const src = getImageSrc(image);
      if (!src) return;
      event.stopPropagation();
      event.preventDefault();
      if (ignoreNextClick) {
        // Already handled via touchend - this is just the synthetic click
        // that follows on real touch devices. Still block it from reaching
        // the native modal-opener, just don't open zoom a second time.
        ignoreNextClick = false;
        return;
      }
      openZoomOverlaySrc(src, currentZoomRatio());
    },
    true
  );

  // Only treat it as a zoom-tap once the finger has stayed still (not scrolled).
  // Every listener here is passive - nothing ever blocks native scrolling.
  let touchStartImage = null;
  let touchStartPoint = null;

  document.addEventListener(
    'touchstart',
    (event) => {
      const image = resolveMagnifyImage(event.target);
      // Same reasoning as the capture-phase click handler above: only
      // track it here if there's an actual usable src (plain <img> or
      // background-image element) - otherwise (e.g. the Geschirr
      // configurator's canvas-composite preview) touchend below would set
      // ignoreNextClick and silently no-op, leaving that flag stuck true
      // for whatever the next real click elsewhere happened to be.
      const hasSrc = image && !!getImageSrc(image);
      touchStartImage = hasSrc ? image : null;
      touchStartPoint = hasSrc ? eventPoint(event) : null;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!touchStartImage || !touchStartPoint) return;
      const point = eventPoint(event);
      const moved = Math.hypot(point.x - touchStartPoint.x, point.y - touchStartPoint.y);
      if (moved > 10) {
        // the finger is scrolling the page, not tapping to zoom
        touchStartImage = null;
        touchStartPoint = null;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (event) => {
      if (!touchStartImage) return;
      const image = touchStartImage;
      touchStartImage = null;
      touchStartPoint = null;
      ignoreNextClick = true;
      openZoomOverlay(image, currentZoomRatio());
    },
    { passive: true }
  );
}

window.openZoomOverlaySrc = openZoomOverlaySrc;

enableZoomOnHover({ mobile: 2.4, desktop: 1.3 });
