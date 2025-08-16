// === CONFIG ===
// Change this to how many pages you exported to assets/pages/
const PAGE_COUNT = 15; // <-- set to your number
const ZERO_BASED = true; // true if files start at page-00.png, false if page-01.png

const app = document.getElementById('app');
for (let i = 0; i < PAGE_COUNT; i++) {
  const n = ZERO_BASED ? i : i+1;
  const name = n.toString().padStart(2,'0');
  const src = `assets/pages/page-${name}.png`;
  const section = document.createElement('section');
  section.className = 'scene';
  section.innerHTML = `<div class="sticky"><figure class="page-figure"><img src="${src}" alt="Page ${n+1}" loading="lazy"></figure></div>`;
  app.appendChild(section);
}

const scenes = [...document.querySelectorAll('.scene')];
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function update(){
  const vh = innerHeight;
  scenes.forEach(scene => {
    const fig = scene.querySelector('.page-figure');
    if(!fig) return;
    const r = scene.getBoundingClientRect();
    const total = r.height - vh;
    const t = clamp((0 - r.top) / (total || 1), 0, 1);
    const ease = t => t*t*(3 - 2*t);
    const p = ease(t);
    const alpha = p < 0.5 ? 0.2 + p*1.6 : 1.2 - p*0.8;
    const scale = 1.08 - p*0.08;
    const y = (1 - p) * 40 - p * 40;
    const blur = p < 0.8 ? 0 : (p-0.8) * 20;
    fig.style.setProperty('--alpha', alpha.toFixed(3));
    fig.style.setProperty('--scale', scale.toFixed(3));
    fig.style.setProperty('--y', `${y.toFixed(1)}px`);
    fig.style.setProperty('--blur', `${blur.toFixed(1)}px`);
  });
}
update();
addEventListener('scroll', update, {passive:true});
addEventListener('resize', update);
