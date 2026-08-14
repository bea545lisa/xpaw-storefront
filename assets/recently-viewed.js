const RECENTLY_VIEWED_STORAGE_KEY = 'rexpaw:recently-viewed';
const MAX_STORED = 12;

function getStoredHandles() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function recordProductView(handle) {
  if (!handle) return;

  const handles = getStoredHandles().filter((existing) => existing !== handle);
  handles.unshift(handle);

  try {
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(handles.slice(0, MAX_STORED)));
  } catch (error) {
    // localStorage unavailable (private browsing quota etc.) - fail silently
  }
}

function formatMoney(cents, currency, locale) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

async function fetchProduct(handle) {
  // Eigenes JSON-Template statt /products/{handle}.js - das Standard-AJAX-JSON
  // liefert keine Metafields, wir brauchen aber die Dark-Mode-Bild-Zuordnung
  // (siehe templates/product.recently-viewed-json.liquid).
  const response = await fetch(`/products/${handle}?view=recently-viewed-json`);
  if (!response.ok) return null;
  return response.json();
}

function renderCard(product, currency, locale) {
  const image = product.dark_image
    ? `<img class="recently-viewed__image--light" src="${product.featured_image}" alt="${product.title}" loading="lazy" width="200" height="200">
       <img class="recently-viewed__image--dark" src="${product.dark_image}" alt="${product.title}" loading="lazy" width="200" height="200">`
    : `<img src="${product.featured_image}" alt="${product.title}" loading="lazy" width="200" height="200">`;
  const price = formatMoney(product.price, currency, locale);

  const card = document.createElement('a');
  card.className = 'recently-viewed__card';
  card.href = product.url;

  card.innerHTML = `
    ${product.featured_image ? image : ''}
    <span class="recently-viewed__title">${product.title}</span>
    <span class="recently-viewed__price">${price}</span>
  `;

  return card;
}

async function renderRecentlyViewed(container) {
  const currentHandle = container.dataset.currentHandle;
  const currency = container.dataset.currency;
  const locale = document.documentElement.lang || 'en';
  const limit = parseInt(container.dataset.limit, 10) || 4;

  const handles = getStoredHandles()
    .filter((handle) => handle !== currentHandle)
    .slice(0, limit);

  if (handles.length === 0) {
    container.closest('.recently-viewed')?.remove();
    return;
  }

  const products = (await Promise.all(handles.map(fetchProduct))).filter(Boolean);

  if (products.length === 0) {
    container.closest('.recently-viewed')?.remove();
    return;
  }

  products.forEach((product) => {
    container.appendChild(renderCard(product, currency, locale));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const recorder = document.querySelector('[data-record-recently-viewed]');
  if (recorder) {
    recordProductView(recorder.dataset.recordRecentlyViewed);
  }

  const container = document.querySelector('[data-recently-viewed-list]');
  if (container) {
    renderRecentlyViewed(container);
  }
});
