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

  const overlay = document.createElement('div');
  overlay.className = 'image-magnify-full-size';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Bild vergroessert');

  const frame = document.createElement('div');
  frame.className = 'image-magnify-full-size__frame';
  frame.style.backgroundImage = `url('${src}')`;
  frame.style.backgroundSize = `${zoomRatio * 100}%`;
  frame.style.backgroundPosition = '50% 50%';
  overlay.appendChild(frame);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
  }

  function setPosition(clientX, clientY) {
    const rect = frame.getBoundingClientRect();
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    frame.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  frame.addEventListener('mousemove', (event) => setPosition(event.clientX, event.clientY));
  frame.addEventListener('click', close);

  frame.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
      const point = eventPoint(event);
      setPosition(point.x, point.y);
    },
    { passive: false }
  );
  frame.addEventListener('touchend', close);
}

function enableZoomOnHover(zoomRatio) {
  let ignoreNextClick = false;

  document.addEventListener('click', (event) => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    const image = event.target.closest('.image-magnify-hover');
    if (!image) return;
    openZoomOverlay(image, zoomRatio);
  });

  // Only treat it as a zoom-tap once the finger has stayed still (not scrolled).
  // Every listener here is passive - nothing ever blocks native scrolling.
  let touchStartImage = null;
  let touchStartPoint = null;

  document.addEventListener(
    'touchstart',
    (event) => {
      const image = event.target.closest('.image-magnify-hover');
      touchStartImage = image || null;
      touchStartPoint = image ? eventPoint(event) : null;
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
      openZoomOverlay(image, zoomRatio);
    },
    { passive: true }
  );
}

enableZoomOnHover(2.5);
