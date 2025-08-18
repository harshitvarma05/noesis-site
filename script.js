/**** CONFIG ****/
const PAGE_COUNT      = 16;   // total brochure pages
const ZERO_BASED      = true; // true if page-00.png exists; false if page-01.png
const TRY_WEBP        = true; // true if you also upload .webp files
const PRELOAD_FIRSTN  = 7;    // loader waits for pages 1..N in SEQUENCE

const pad2 = n => String(n).padStart(2,'0');

/* Detect WebP support (once) */
const SUPPORTS_WEBP = (() => {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext && c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } catch { return false; }
})();

/* Network hints */
const conn = navigator.connection || {};
const SAVE_DATA = !!conn.saveData;
const VERY_SLOW = ['slow-2g','2g'].includes(conn.effectiveType);

const app = document.getElementById('app');
const sources = []; // per-page { png, webp }

for (let i = 0; i < PAGE_COUNT; i++) {
    const n = ZERO_BASED ? i : i + 1;
    const name = pad2(n);
    const png  = `assets/pages/page-${name}.png`;
    const webp = `assets/pages/page-${name}.webp`;

    const section = document.createElement('section');
    section.className = 'scene';
    section.dataset.idx = String(i);
    section.innerHTML = `
    <div class="sticky">
      <figure class="page-figure" data-idx="${i}">
        <picture>
          ${TRY_WEBP ? `<source type="image/webp" data-srcset="${webp}">` : ``}
          <img data-src="${png}" alt="Brochure page ${i+1}" loading="lazy" decoding="async">
        </picture>
      </figure>
    </div>`;
    app.appendChild(section);

    sources.push({ png, webp, idx: i });
}

const loaderEl      = document.getElementById('loader');
const loaderImg     = document.getElementById('loader-img');
const loaderBarFill = document.querySelector('.loader-bar-fill');

function hydrateScene(idx){
    const sec = document.querySelector(`.scene[data-idx="${idx}"]`);
    if (!sec) return;
    const pic    = sec.querySelector('picture');
    const img    = pic.querySelector('img');
    const source = pic.querySelector('source[type="image/webp"]');
    const { png, webp } = sources[idx];

    // already hydrated?
    if (!img.getAttribute('data-src')) return;

    const useWebp = TRY_WEBP && SUPPORTS_WEBP && !!source;
    if (useWebp) {
        source.setAttribute('srcset', webp);
        source.removeAttribute('data-srcset');
        img.setAttribute('src', webp);
    } else {
        img.setAttribute('src', png);
    }
    img.removeAttribute('data-src');

    // Priority hint for the first couple of pages
    if (idx <= 1) img.setAttribute('fetchpriority', 'high');

    // Fit mode once dimensions known
    if (img.complete) applyFitModes();
    else img.addEventListener('load', applyFitModes, { once:true });
}

const MUST_PRELOAD = Math.min(PRELOAD_FIRSTN, PAGE_COUNT);
let currentPreload = 0;

function updateLoaderBar(){
    const pct = Math.round((currentPreload / MUST_PRELOAD) * 100);
    loaderBarFill.style.width = pct + '%';
    if (currentPreload >= MUST_PRELOAD) {
        // Hide loader immediately (no fade)
        loaderEl.style.display = 'none';
        // Start background preload of the rest
        startBackgroundPreload();
    }
}

function preloadNextInOrder(){
    if (currentPreload >= MUST_PRELOAD) return;

    const idx = currentPreload;
    const { png, webp } = sources[idx];
    const url = (TRY_WEBP && SUPPORTS_WEBP) ? webp : png;

    // Show page-1 inside the loader preview
    if (idx === 0) {
        loaderImg.src = url;
        loaderImg.setAttribute('fetchpriority', 'high');
    }

    const probe = new Image();
    probe.decoding = 'async';
    probe.loading  = 'eager';
    probe.src = url;

    const done = () => {
        hydrateScene(idx);       // make this page display-ready
        currentPreload++;
        updateLoaderBar();       // update bar, then chain next
        preloadNextInOrder();
    };

    probe.onload  = done;
    probe.onerror = done;      // count error to avoid stalling
}

preloadNextInOrder();

function startBackgroundPreload(){
    // Be gentle on very slow networks or when Save-Data is on
    if (SAVE_DATA || VERY_SLOW) return;

    let idx = MUST_PRELOAD; // start from the next page after the loader batch

    const step = () => {
        if (idx >= PAGE_COUNT) return;

        const { png, webp } = sources[idx];
        const url = (TRY_WEBP && SUPPORTS_WEBP) ? webp : png;

        const img = new Image();
        img.decoding = 'async';
        img.loading  = 'eager';
        img.src = url;

        const done = () => {
            hydrateScene(idx); // hydrate so it’s ready in DOM
            idx++;
            // Use idle time between steps to stay responsive
            (window.requestIdleCallback || setTimeout)(step, 100);
        };

        img.onload  = done;
        img.onerror = done;
    };

    // kick background chain
    (window.requestIdleCallback || setTimeout)(step, 100);
}

const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;
        const img = pic.querySelector('img');
        // If already hydrated (no data-src), skip
        if (!img.getAttribute('data-src')) { pictureIO.unobserve(pic); return; }
        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);
        hydrateScene(idx);
        pictureIO.unobserve(pic);
    });
}, { root: null, rootMargin: '200% 0px 200% 0px', threshold: 0 });

document.querySelectorAll('.page-figure picture').forEach(p => pictureIO.observe(p));

function applyFitModes(){
    const vw = innerWidth, vh = innerHeight, vAspect = vh / vw;
    document.querySelectorAll('.page-figure img').forEach(img => {
        const fig = img.closest('.page-figure');
        if (!fig) return;
        if (!img.complete || !img.naturalWidth) {
            img.addEventListener('load', applyFitModes, { once:true });
            return;
        }
        const iAspect = img.naturalHeight / img.naturalWidth;
        fig.classList.toggle('fit-height', iAspect > vAspect);
        fig.classList.toggle('fit-width',  iAspect <= vAspect);
    });
}
addEventListener('resize', applyFitModes, { passive:true });
addEventListener('orientationchange', applyFitModes);
