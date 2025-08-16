/**** CONFIG ****/
const PAGE_COUNT   = 15;     // total brochure pages
const ZERO_BASED   = true;   // true if page-00.png exists, else false for page-01.png
const USE_BLUR     = true;
const PARALLAX_AMT = 12;
const TRY_WEBP     = true;   // set to true if you ALSO upload .webp copies alongside pngs

/**** BUILD SCENES (no extra content, just images) ****/
const app = document.getElementById('app');
const sources = []; // one per page (we fill when intersecting)
for (let i = 0; i < PAGE_COUNT; i++) {
    const n    = ZERO_BASED ? i : i + 1;
    const name = String(n).padStart(2,'0');

    // We DO NOT set src yet; we set data-src and lazy-load via IO below.
    const png  = `assets/pages/page-${name}.png`;
    const webp = `assets/pages/page-${name}.webp`; // optional; loaded if present + supported

    const section = document.createElement('section');
    section.className = 'scene';
    section.dataset.idx = String(i);

    // picture element for optional webp; we use data-srcset/src and fill later
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

/**** PERFORMANCE MODE DETECTION ****/
const conn = navigator.connection || {};
const lowPower =
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    ['slow-2g','2g'].includes(conn.effectiveType) ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
const enableBlur = USE_BLUR && !lowPower;

/**** VIEWPORT-BASED LOADING ****/
const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;                   // <picture>
        const img = pic.querySelector('img');
        const src = img.getAttribute('data-src');
        const source = pic.querySelector('source[type="image/webp"]');

        // upgrade to real URLs once near viewport
        if (source && source.getAttribute('data-srcset')) {
            source.setAttribute('srcset', source.getAttribute('data-srcset'));
            source.removeAttribute('data-srcset');
        }
        if (src) {
            img.setAttribute('src', src);
            img.removeAttribute('data-src');
        }

        // priority hint for the first page only
        if (pic.closest('.scene')?.dataset.idx === '0') {
            img.setAttribute('fetchpriority', 'high');
        }

        // prefetch the next page (warm the pipeline)
        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);
        prefetchNext(idx + 1);

        pictureIO.unobserve(pic);
    });
}, { root: null, rootMargin: '120% 0px 120% 0px', threshold: 0 });

document.querySelectorAll('.page-figure picture').forEach(p => pictureIO.observe(p));

function prefetchNext(i){
    if (i >= PAGE_COUNT) return;
    const { png, webp } = sources[i];
    // use requestIdleCallback where available to avoid main-thread contention
    const task = () => {
        // preconnect-ish warmup: create an Image that doesn't attach to DOM
        const im = new Image();
        if (TRY_WEBP && 'type' in HTMLSourceElement.prototype) {
            // browser will choose based on <picture>, but for prefetch just pick png
            im.src = png;
        } else {
            im.src = png;
        }
    };
    (window.requestIdleCallback || setTimeout)(task, 100);
}

/**** FIT-MODE (avoid cropping/letterboxing) ****/
function applyFitModes(){
    const vw = innerWidth;
    const vh = innerHeight;
    const vAspect = vh / vw;

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
addEventListener('resize', applyFitModes, { passive:true });
addEventListener('orientationchange', applyFitModes);

/**** ANIMATION: only animate visible scenes ****/
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
        const blur  = enableBlur ? (t < 0.8 ? 0 : (t-0.8)*20) : 0;

        const idx = Number(scene.dataset.idx || 0);
        const parallax = (idx % 2 === 0 ? 1 : -1) * (12 * (t - 0.5));

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

// kick off after DOM ready
applyFitModes();
tick();
addEventListener('scroll', tick, { passive:true });
