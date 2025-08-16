/**** CONFIG ****/
const PAGE_COUNT   = 15;     // <-- total brochure pages
const ZERO_BASED   = true;   // true if files start at page-00.png, false if page-01.png
const USE_BLUR     = true;   // blur looks nice but is heavy; auto-off on low-power
const PARALLAX_AMT = 12;     // subtle vertical parallax in px

/**** BUILD SCENES (no extra content, just your images) ****/
const app = document.getElementById('app');
for (let i = 0; i < PAGE_COUNT; i++) {
    const n    = ZERO_BASED ? i : i + 1;
    const name = String(n).padStart(2, '0');
    const src  = `assets/pages/page-${name}.png`;

    const section = document.createElement('section');
    section.className = 'scene';
    section.dataset.idx = String(i);
    section.innerHTML = `
    <div class="sticky">
      <figure class="page-figure" data-idx="${i}">
        <img src="${src}" alt="Brochure page ${i+1}" loading="lazy" decoding="async">
      </figure>
    </div>`;
    app.appendChild(section);
}

/**** PERFORMANCE MODE DETECTION ****/
const conn = navigator.connection || {};
const lowPower =
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    ['slow-2g', '2g'].includes(conn.effectiveType) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const enableBlur = USE_BLUR && !lowPower;

/**** OBSERVE ONLY VISIBLE SCENES ****/
const scenes = [...document.querySelectorAll('.scene')];
let active = new Set();
let rafId  = null;

const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) active.add(e.target);
        else active.delete(e.target);
    });
    tick(); // ensure RAF when needed
}, { root: null, rootMargin: '40% 0px 40% 0px', threshold: 0 });

scenes.forEach(s => io.observe(s));

/**** RENDER LOOP (only when needed) ****/
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function easeInOut(t){ return t*t*(3 - 2*t); }

function render() {
    const vh = innerHeight;
    let topMostIdx = 0, topMostY = Infinity;

    active.forEach(scene => {
        const fig = scene.querySelector('.page-figure');
        if (!fig) return;

        const r = scene.getBoundingClientRect();
        const total = r.height - vh;
        const tRaw  = clamp((0 - r.top) / (total || 1), 0, 1);
        const t     = easeInOut(tRaw);

        // Apple-like in/out
        const alpha = t < 0.5 ? 0.2 + t*1.6 : 1.2 - t*0.8;   // fade in then slight out
        const scale = 1.08 - t*0.08;                         // gentle zoom out
        const y     = (1 - t) * 40 - t * 40;                 // vertical ease
        const blur  = enableBlur ? (t < 0.8 ? 0 : (t-0.8) * 20) : 0;

        // subtle alternating parallax
        const idx = Number(scene.dataset.idx || 0);
        const parallax = (idx % 2 === 0 ? 1 : -1) * (PARALLAX_AMT * (t - 0.5));

        fig.style.setProperty('--alpha', alpha.toFixed(3));
        fig.style.setProperty('--scale',  scale.toFixed(3));
        fig.style.setProperty('--y',      `${(y + parallax).toFixed(1)}px`);
        fig.style.setProperty('--blur',   `${blur.toFixed(1)}px`);

        // track centered scene for background hue shift
        if (Math.abs(r.top) < topMostY) { topMostY = Math.abs(r.top); topMostIdx = idx; }
    });

    // Set 0/1 flag for hue rotate (no CSS modulo)
    const mix = (topMostIdx % 2 === 1) ? 1 : 0;
    document.body.style.setProperty('--mix', mix);
    document.body.style.setProperty('--scene-idx', topMostIdx); // optional/debug
}

function tick(){
    if (rafId !== null) return;
    if (active.size === 0) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        render();
    });
}



addEventListener('scroll', tick, { passive: true });
addEventListener('resize', tick, { passive: true });
tick(); // initial

function applyFitModes(){
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vAspect = vh / vw; // viewport aspect

    document.querySelectorAll('.page-figure img').forEach(img => {
        const fig = img.parentElement;
        // if not loaded yet, wait; then compute
        if (!img.complete || !img.naturalWidth) {
            img.addEventListener('load', applyFitModes, { once:true });
            return;
        }
        const iAspect = img.naturalHeight / img.naturalWidth;

        // if image is "taller" than viewport, fit by height, else fit by width
        fig.classList.toggle('fit-height', iAspect > vAspect);
        fig.classList.toggle('fit-width',  iAspect <= vAspect);
    });
}

// run once after DOM is ready and again on resize/orientation
applyFitModes();
addEventListener('resize', applyFitModes, { passive:true });
addEventListener('orientationchange', applyFitModes);
