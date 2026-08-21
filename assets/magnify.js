function getImageSrc(image) {
  if (image.tagName === 'IMG') return image.src;
  const bg = image.style.backgroundImage;
  const match = bg.match(/url\(["']?(.*?)["']?\)/);
  return match ? match[1] : '';
}

// create a container and set the full-size image as its background
function createOverlay(image) {
  const src = getImageSrc(image);
  const overlayImage = document.createElement('img');
  overlayImage.setAttribute('src', src);
  overlay = document.createElement('div');
  prepareOverlay(overlay, overlayImage);

  image.style.opacity = '50%';
  toggleLoadingSpinner(image);

  overlayImage.onload = () => {
    toggleLoadingSpinner(image);
    image.parentElement.insertBefore(overlay, image);
    image.style.opacity = '100%';
  };

  return overlay;
}

function prepareOverlay(container, image) {
  container.setAttribute('class', 'image-magnify-full-size');
  container.setAttribute('aria-hidden', 'true');
  container.style.backgroundImage = `url('${image.src}')`;
  container.style.backgroundColor = 'var(--gradient-background)';
}

function toggleLoadingSpinner(image) {
  const loadingSpinner = image.parentElement.parentElement.querySelector(`.loading__spinner`);
  loadingSpinner.classList.toggle('hidden');
}

function eventPoint(event) {
  if (event.touches && event.touches.length) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function moveWithHover(image, event, zoomRatio) {
  // calculate pointer position
  const width = image.tagName === 'IMG' ? image.width : image.offsetWidth;
  const height = image.tagName === 'IMG' ? image.height : image.offsetHeight;
  const ratio = height / width;
  const container = image.getBoundingClientRect();
  const point = eventPoint(event);
  const xPosition = point.x - container.left;
  const yPosition = point.y - container.top;
  const xPercent = `${xPosition / (image.clientWidth / 100)}%`;
  const yPercent = `${yPosition / ((image.clientWidth * ratio) / 100)}%`;

  // determine what to show in the frame
  overlay.style.backgroundPosition = `${xPercent} ${yPercent}`;
  overlay.style.backgroundSize = `${width * zoomRatio}px`;
}

function magnify(image, zoomRatio) {
  const overlay = createOverlay(image);
  overlay.onclick = () => overlay.remove();
  overlay.onmousemove = (event) => moveWithHover(image, event, zoomRatio);
  overlay.onmouseleave = () => overlay.remove();
  overlay.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
      moveWithHover(image, event, zoomRatio);
    },
    { passive: false }
  );
  overlay.addEventListener('touchend', () => overlay.remove());
}

function enableZoomOnHover(zoomRatio) {
  const images = document.querySelectorAll('.image-magnify-hover');
  images.forEach((image) => {
    image.onclick = (event) => {
      magnify(image, zoomRatio);
      moveWithHover(image, event, zoomRatio);
    };
    image.addEventListener(
      'touchstart',
      (event) => {
        event.preventDefault();
        magnify(image, zoomRatio);
        moveWithHover(image, event, zoomRatio);
      },
      { passive: false }
    );
  });
}

enableZoomOnHover(2);
