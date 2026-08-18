class GeschirrConfigurator extends HTMLElement {
  connectedCallback() {
    this.canvases = {};
    this.querySelectorAll('.geschirr-configurator__layer').forEach((canvas) => {
      this.canvases[canvas.dataset.layer] = canvas;
    });

    this.maskImages = {};
    const maskEls = this.querySelectorAll('.geschirr-configurator__mask-source');
    const loadPromises = Array.from(maskEls).map((img) => {
      return this.loadImage(img.src).then((loaded) => {
        this.maskImages[img.dataset.mask] = loaded;
      });
    });

    Promise.all(loadPromises).then(() => {
      this.querySelectorAll('fieldset[data-layer]').forEach((fieldset) => {
        const layer = fieldset.dataset.layer;
        const checked = fieldset.querySelector('input:checked');
        if (checked) this.applyInput(layer, checked);
      });
    });

    this.addEventListener('change', (event) => {
      const input = event.target;
      if (input.tagName !== 'INPUT') return;

      const fieldset = input.closest('fieldset');
      const layer = fieldset.dataset.layer;

      this.applyInput(layer, input);

      const hidden = this.querySelector(`input[data-hidden-for="${layer}"]`);
      if (hidden) hidden.value = input.value;
    });
  }

  applyInput(layer, input) {
    if (input.dataset.pattern) {
      this.loadImage(input.dataset.pattern).then((tile) => {
        this.paintLayer(layer, tile, true);
      });
    } else {
      this.paintLayer(layer, input.dataset.color, false);
    }
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  paintLayer(layer, fill, isPattern) {
    const canvas = this.canvases[layer];
    const mask = this.maskImages[layer];
    if (!canvas || !mask) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = isPattern ? ctx.createPattern(fill, 'repeat') : fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';
  }
}

customElements.define('geschirr-configurator', GeschirrConfigurator);
