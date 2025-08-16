/**** CONFIG ****/
const PAGE_COUNT    = 15;    // total brochure pages
const ZERO_BASED    = true;  // true if page-00.png exists; false if page-01.png
const TRY_WEBP      = true;  // set true if you also upload .webp alongside .png
const PRELOAD_COUNT = 10;     // how many pages to preload for the loader progress

/* Detect WebP support (once) */
const SUPPORTS_WEBP = (() => {
    try { const c = document.createElement('canvas');
        return !!(c.getContext && c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } catch { return false; }
})();

/**** Build scenes (no extra content, just your images) ****/
const app = document.getElementById('app');
const sources = []; // per-page {png, webp}

const pad2 = n => String(n).padStart(2,'0');

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

/**** Loader (page 1 preview + progress bar) ****/
const loaderEl = document.getElementById('loader');
const loaderImg = document.getElementById('loader-img');
const loaderBarFill = document.querySelector('.loader-bar-fill');

(function initLoaderFirstPage(){
    const first = sources[0];
    if (!first) return hideLoader(0);
    const url = (TRY_WEBP && SUPPORTS_WEBP) ? first.webp : first.png;
    loaderImg.src = url;
    loaderImg.setAttribute('fetchpriority', 'high');
})();

let preloadLoaded = 0;
const preloadTotal = Math.min(PRELOAD_COUNT, PAGE_COUNT);

function updateLoaderProgress(){
    const pct = Math.round((preloadLoaded / preloadTotal) * 100);
    loaderBarFill.style.width = Math.max(10, pct) + '%';
    if (preloadLoaded >= preloadTotal) setTimeout(() => hideLoader(200), 150);
}
function hideLoader(delay=150){ setTimeout(() => loaderEl?.classList.add('hidden'), delay); }

// Preload first N (prefer WebP if supported)
(function preloadFirstN(){
    for (let i = 0; i < preloadTotal; i++) {
        const { png, webp } = sources[i];
        const url = (TRY_WEBP && SUPPORTS_WEBP) ? webp : png;
        const im = new Image();
        im.onload = im.onerror = () => { preloadLoaded++; updateLoaderProgress(); };
        im.decoding = 'async'; im.loading = 'eager'; im.src = url;
    }
})();

/**** Lazy-load when scenes approach ****/
const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;
        const img = pic.querySelector('img');
        const source = pic.querySelector('source[type="image/webp"]');

        if (source && source.getAttribute('data-srcset')) {
            source.setAttribute('srcset', source.getAttribute('data-srcset'));
            source.removeAttribute('data-srcset');
        }
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) { img.setAttribute('src', dataSrc); img.removeAttribute('data-src'); }

        // prefetch next page lightly (WebP if supported)
        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);
        prefetchNext(idx + 1);

        pictureIO.unobserve(pic);
    });
}, { root: null, rootMargin: '200% 0px 200% 0px', threshold: 0 });

document.querySelectorAll('.page-figure picture').forEach(p => pictureIO.observe(p));

function prefetchNext(i){
    if (i >= PAGE_COUNT) return;
    const { png, webp } = sources[i];
    const url = (TRY_WEBP && SUPPORTS_WEBP) ? webp : png;
    const task = () => { const im = new Image(); im.decoding = 'async'; im.src = url; };
    (window.requestIdleCallback || setTimeout)(task, 150);
}

/**** Fit-to-device (avoid cropping/letterboxing) ****/
function applyFitModes(){
    const vw = innerWidth, vh = innerHeight, vAspect = vh / vw;
    document.querySelectorAll('.page-figure img').forEach(img => {
        const fig = img.closest('.page-figure');
        if (!img.complete || !img.naturalWidth) { img.addEventListener('load', applyFitModes, { once:true }); return; }
        const iAspect = img.naturalHeight / img.naturalWidth;
        fig.classList.toggle('fit-height', iAspect > vAspect);
        fig.classList.toggle('fit-width',  iAspect <= vAspect);
    });
}
addEventListener('resize', applyFitModes, { passive:true });
addEventListener('orientationchange', applyFitModes);

/**** Opacity-only animation (no blur, no parallax, no transforms) ****/
const scenes = [...document.querySelectorAll('.scene')];
let active = new Set();
let rafId  = null;

const sceneIO = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) active.add(e.target); else active.delete(e.target); });
    tick();
}, { root: null, rootMargin: '40% 0px 40% 0px', threshold: 0 });
scenes.forEach(s => sceneIO.observe(s));

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function easeInOut(t){ return t*t*(3 - 2*t); }

function render(){
    const vh = innerHeight;
    active.forEach(scene => {
        const fig = scene.querySelector('.page-figure');
        if (!fig) return;
        const r = scene.getBoundingClientRect();
        const total = r.height - vh;
        const tRaw  = clamp((0 - r.top) / (total || 1), 0, 1);
        const t     = easeInOut(tRaw);
        /* Fade in to 1, then down slightly to 0.2 near exit (pure opacity) */
        const alpha = t < 0.1 ? (0.1+ t*0.6) : (0.8 - t*0.2);
        fig.style.opacity = alpha.toFixed(3);
    });
}
(function eagerSecondScene(){
    const sec = document.querySelector('.scene[data-idx="1"]');
    if (!sec) return;
    const pic = sec.querySelector('picture');
    const img = pic.querySelector('img');
    const source = pic.querySelector('source[type="image/webp"]');
    const { png, webp } = sources[1];

    // Prefer WebP if we’re using it and the browser supports it
    if (TRY_WEBP && SUPPORTS_WEBP && source) {
        source.setAttribute('srcset', webp);
        source.removeAttribute('data-srcset');
    }
    img.setAttribute('src', (TRY_WEBP && SUPPORTS_WEBP) ? webp : png);
    img.removeAttribute('data-src');

    // Ask browser to prioritize this above-the-fold image
    img.setAttribute('fetchpriority', 'high');
})();

function tick(){
    if (rafId !== null) return;
    if (active.size === 0) return;
    rafId = requestAnimationFrame(() => { rafId = null; render(); });
}

/* Kickoff */
applyFitModes();
tick();
addEventListener('scroll', tick, { passive:true });
