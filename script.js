/**** CONFIG ****/
const PAGE_COUNT   = 15;     // total brochure pages
const ZERO_BASED   = true;   // true if page-00.png exists, else false for page-01.png
const USE_BLUR     = true;   // blur looks nice but is heavy; auto-off on low-power
const PARALLAX_AMT = 12;     // subtle vertical parallax in px
const TRY_WEBP     = true;   // set true IF you also upload .webp alongside .png
const PRELOAD_COUNT = 3;     // how many pages to preload for the loader progress

/**** Helpers ****/
const pad2 = n => String(n).padStart(2,'0');

/**** Build scenes (no extra content, just your images) ****/
const app = document.getElementById('app');
const sources = []; // per-page URL refs (png/webp)

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

/**** Device/connection heuristics ****/
const conn = navigator.connection || {};
const lowPower =
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    ['slow-2g','2g'].includes(conn.effectiveType) ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
const enableBlur = USE_BLUR && !lowPower;

/**** Loader: show page 1 and a progress bar until a few pages are warm ****/
const loaderEl = document.getElementById('loader');
const loaderImg = document.getElementById('loader-img');
const loaderPic = document.getElementById('loader-picture');
const loaderBarFill = document.querySelector('.loader-bar-fill');

(function initLoaderFirstPage(){
    const first = sources[0];
    if (!first) return hideLoader(0);

    // Prefer webp if TRY_WEBP; set <picture> srcs immediately
    if (TRY_WEBP) {
        const s = document.createElement('source');
        s.type = 'image/webp';
        s.srcset = first.webp;
        loaderPic.prepend(s);
    }
    loaderImg.src = first.png;
    loaderImg.setAttribute('fetchpriority', 'high');
})();

// Preload first N pages to drive the progress bar
let preloadLoaded = 0;
const preloadTotal = Math.min(PRELOAD_COUNT, PAGE_COUNT);

function updateLoaderProgress(){
    const pct = Math.round((preloadLoaded / preloadTotal) * 100);
    loaderBarFill.style.width = Math.max(5, pct) + '%'; // always show some movement
    if (preloadLoaded >= preloadTotal) {
        // let it breathe for a tick so users see 100%
        setTimeout(() => hideLoader(200), 150);
    }
}
function hideLoader(delay=150){
    setTimeout(() => loaderEl?.classList.add('hidden'), delay);
}

// Start preloading first N pages (cached for later scenes)
(function preloadFirstN(){
    for (let i = 0; i < preloadTotal; i++) {
        const { png, webp } = sources[i];
        const im = new Image();
        im.onload = im.onerror = () => { preloadLoaded++; updateLoaderProgress(); };
        // Use PNG for the actual network warm-up (universal)
        im.src = png;
    }
})();

/**** Viewport-based loading for the rest ****/
const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;
        const img = pic.querySelector('img');
        const source = pic.querySelector('source[type="image/webp"]');

        // upgrade to real URLs once near viewport
        if (source && source.getAttribute('data-srcset')) {
            source.setAttribute('srcset', source.getAttribute('data-srcset'));
            source.removeAttribute('data-srcset');
        }
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
            img.setAttribute('src', dataSrc);
            img.removeAttribute('data-src');
        }

        // prefetch the next page lightly
        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);
        prefetchNext(idx + 1);

        pictureIO.unobserve(pic);
    });
}, { root: null, rootMargin: '120% 0px 120% 0px', threshold: 0 });

document.querySelectorAll('.page-figure picture').forEach(p => pictureIO.observe(p));

function prefetchNext(i){
    if (i >= PAGE_COUNT) return;
    const { png } = sources[i];
    const task = () => {
        const im = new Image();
        im.decoding = 'async';
        im.loading = 'eager';
        im.src = png;
    };
    (window.requestIdleCallback || setTimeout)(task, 150);
}

/**** Fit-mode to prevent cropping/letterboxing ****/
function applyFitModes(){
    const vw = innerWidth, vh = innerHeight, vAspect = vh / vw;
    document.querySelectorAll('.page-figure img').forEach(img => {
        const fig = img.closest('.page-figure');
        if (!img.complete || !img.naturalWidth) {
            img.addEventListener('load', applyFitModes, { once:true });
            return;
        }
        const iAspect = img.naturalHeight / img.naturalWidth;
        fig.classList.toggle('fit-height', iAspect > vAspect);
        fig.classList.toggle('fit-width',  iAspect <= vAspect);
    });
}

/**** Animate only visible scenes ****/
const scenes = [...document.querySelectorAll('.scene')];
let active = new Set();
let rafId  = null;

const sceneIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) active.add(e.target);
        else active.delete(e.target);
    });
    tick();
}, { root: null, rootMargin: '40% 0px 40% 0px', threshold: 0 });
scenes.forEach(s => sceneIO.observe(s));

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function easeInOut(t){ return t*t*(3 - 2*t); }

function render(){
    const vh = innerHeight;
    let topMostIdx = 0, topMostY = Infinity;

    active.forEach(scene => {
        const fig = scene.querySelector('.page-figure');
        if (!fig) return;

        const r = scene.getBoundingClientRect();
        const total = r.height - vh;
        const tRaw  = clamp((0 - r.top) / (total || 1), 0, 1);
        const t     = easeInOut(tRaw);

        const alpha = t < 0.5 ? 0.2 + t*1.6 : 1.2 - t*0.8;
        const scale = 1.08 - t*0.08;
        const y     = (1 - t) * 40 - t * 40;
        const blur  = (USE_BLUR && !lowPower) ? (t < 0.8 ? 0 : (t-0.8)*20) : 0;

        const idx = Number(scene.dataset.idx || 0);
        const parallax = (idx % 2 === 0 ? 1 : -1) * (PARALLAX_AMT * (t - 0.5));

        fig.style.setProperty('--alpha', alpha.toFixed(3));
        fig.style.setProperty('--scale',  scale.toFixed(3));
        fig.style.setProperty('--y',      `${(y + parallax).toFixed(1)}px`);
        fig.style.setProperty('--blur',   `${blur.toFixed(1)}px`);

        if (Math.abs(r.top) < topMostY) { topMostY = Math.abs(r.top); topMostIdx = idx; }
    });

    document.body.style.setProperty('--mix', (topMostIdx % 2 ? 1 : 0));
    document.body.style.setProperty('--scene-idx', topMostIdx);
}

function tick(){
    if (rafId !== null) return;
    if (active.size === 0) return;
    rafId = requestAnimationFrame(() => { rafId = null; render(); });
}

/**** Kickoff ****/
applyFitModes();
tick();
addEventListener('scroll', tick, { passive:true });
addEventListener('resize', () => { applyFitModes(); tick(); }, { passive:true });
addEventListener('orientationchange', () => { applyFitModes(); tick(); });

/* Also hide loader once the first image itself has fully painted (safety) */
loaderImg?.addEventListener('load', () => {
    // ensure the bar advances at least a bit on fast connections
    loaderBarFill.style.width = Math.max(parseInt(loaderBarFill.style.width)||0, 30) + '%';
});
