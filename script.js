/**** CONFIG ****/
const PAGE_COUNT      = 15;   // total brochure pages
const ZERO_BASED      = true; // true if page-00.png exists; false if page-01.png
const TRY_WEBP        = true; // set true if you also upload .webp alongside .png
const PRELOAD_FIRSTN  = 7;    // loader waits for pages 1 to N in SEQUENCE

/**** UTIL ****/
const pad2 = n => String(n).padStart(2,'0');

/* Detect WebP support (once) */
const SUPPORTS_WEBP = (() => {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext && c.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } catch { return false; }
})();

/**** Build scene DOM (no extra content, just your images) ****/
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

function hideLoader(delay=200){
    setTimeout(() => loaderEl?.classList.add('hidden'), delay);
}

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

    // Higher priority for first couple of pages
    if (idx <= 1) img.setAttribute('fetchpriority', 'high');
}

/**** Sequential preload for the first N pages ****/
const MUST_PRELOAD = Math.min(PRELOAD_FIRSTN, PAGE_COUNT);
let currentPreload = 0;

function updateLoaderBar(){
    const pct = Math.round((currentPreload / MUST_PRELOAD) * 100);
    loaderBarFill.style.width = pct + '%';
    if (currentPreload >= MUST_PRELOAD) {
        hideLoader(250);
    }
}

function preloadNextInOrder(){
    if (currentPreload >= MUST_PRELOAD) return;

    const idx = currentPreload;
    const { png, webp } = sources[idx];
    const url = (TRY_WEBP && SUPPORTS_WEBP) ? webp : png;

    // For the loader preview (page 1)
    if (idx === 0) {
        loaderImg.src = url;
        loaderImg.setAttribute('fetchpriority', 'high');
    }

    const probe = new Image();
    probe.decoding = 'async';
    probe.loading  = 'eager';
    probe.src = url;

    const done = () => {
        // Hydrate this page in the DOM so it’s display-ready
        hydrateScene(idx);
        // Update fit mode once the real <img> in the scene completes
        const img = document.querySelector(`.scene[data-idx="${idx}"] img`);
        if (img) {
            if (img.complete) applyFitModes();
            else img.addEventListener('load', applyFitModes, { once:true });
        }
        currentPreload++;
        updateLoaderBar();
        preloadNextInOrder(); // chain to the next page
    };

    probe.onload = done;
    probe.onerror = done; // count as done to avoid stalling the loader forever
}

// Kick off the sequential chain
preloadNextInOrder();

/**** Lazy-load remaining scenes when they approach (skips already hydrated ones) ****/
const pictureIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const pic = e.target;
        const img = pic.querySelector('img');
        const source = pic.querySelector('source[type="image/webp"]');

        // If this scene was already hydrated by the loader step, skip
        if (!img.getAttribute('data-src')) { pictureIO.unobserve(pic); return; }

        const idx = Number(pic.closest('.scene')?.dataset.idx || 0);
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

/**** Opacity-only “cross-fade” while scrolling (no blur/parallax) ****/
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
        const alpha = t < 0.2 ? (0.1 + t*0.6) : (0.6 - t*0.4); // No idea how this works, but it controls the fade input
        fig.style.opacity = alpha.toFixed(3);
    });
}

function tick(){
    if (rafId !== null) return;
    if (active.size === 0) return;
    rafId = requestAnimationFrame(() => { rafId = null; render(); });
}

/* Kickoff */
applyFitModes();
tick();
addEventListener('scroll', tick, { passive:true });
