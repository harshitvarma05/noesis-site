/**** CONFIG ****/
const PAGE_COUNT      = 15;   // total brochure pages
const ZERO_BASED      = true; // true if page-00.png exists; false if page-01.png
const TRY_WEBP        = true; // true if you also upload .webp alongside .png
const PRELOAD_FIRSTN  = 7;    // loader waits for pages 1..N in SEQUENCE

/**** UTIL ****/
const pad2 = n => String(n).padStart(2,'0');

/* Detect WebP support (once) */
const SUPPORTS_WEBP = (() => {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext && c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } catch { return false; }
})();

/**** Build scenes (no extra content, just your images) ****/
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

/**** Loader elements ****/
const loaderEl      = document.getElementById('loader');
const loaderImg     = document.getElementById('loader-img');
const loaderBarFill = document.querySelector('.loader-bar-fill');

/**** Hydrate a scene (set real src/srcset into its <picture>) ****/
function hydrateScene(idx){
    const sec = document.querySelector(`.scene[data-idx="${idx}"]`);
    if (!sec) return;
    const pic    = sec.querySelector('picture');
    const img    = pic.querySelector('img');
    const source = pic.querySelector('source[type="image/webp"]');
    const { png, webp } = sources[idx];

    const useWebp = TRY_WEBP && SUPPORTS_WEBP && !!source;
    if (useWebp) {
        source.setAttribute('srcset', webp);
        source.removeAttribute('data-srcset');
        img.setAttribute('src', webp);
    } else {
        img.setAttribute('src', png);
    }
    img.removeAttribute('data-src');

    // Priority hint for above-the-fold images
    if (idx <= 1) img.setAttribute('fetchpriority', 'high');

    // Ensure fit mode adjusts once the image dimensions are known
    if (img.complete) applyFitModes();
    else img.addEventListener('load', applyFitModes, { once:true });
}

/**** Sequential preload for the first N pages (in order) ****/
const MUST_PRELOAD = Math.min(PRELOAD_FIRSTN, PAGE_COUNT);
let currentPreload = 0;

function updateLoaderBar(){
    const pct = Math.round((currentPreload / MUST_PRELOAD) * 100);
    loaderBarFill.style.width = pct + '%';
    if (currentPreload >= MUST_PRELOAD) {
        // Hide loader immediately (no fade)
        loaderEl.style.display = 'none';
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

// Kick off the sequential chain
preloadNextInOrder();

/**** Lazy-load remaining scenes when they approach (skip already hydrated) ****/
const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;
        const img = pic.querySelector('img');
        const source = pic.querySelector('source[type="image/webp"]');
        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);

        // If already hydrated by the loader step, skip
        if (!img.getAttribute('data-src')) { pictureIO.unobserve(pic); return; }

        const { png, webp } = sources[idx];
        const useWebp = TRY_WEBP && SUPPORTS_WEBP && !!source;

        if (useWebp) {
            source.setAttribute('srcset', webp);
            source.removeAttribute('data-srcset');
            img.setAttribute('src', webp);
        } else {
            img.setAttribute('src', png);
        }
        img.removeAttribute('data-src');

        pictureIO.unobserve(pic);
    });
}, { root: null, rootMargin: '200% 0px 200% 0px', threshold: 0 });

document.querySelectorAll('.page-figure picture').forEach(p => pictureIO.observe(p));

/**** Fit-to-device (avoid cropping/letterboxing) ****/
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

/* No scroll animations anymore (no fade/parallax/blur) */
