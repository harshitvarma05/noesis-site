// Mobile menu
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
if (toggle) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// Scroll to anchors with offset
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').substring(1);
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({behavior: 'smooth'});
    }
  });
});

// Animated counters (hero)
document.querySelectorAll('.metric .count').forEach((el) => {
  const target = parseInt(el.dataset.target || '0', 10);
  if (!Number.isFinite(target)) return;
  let current = 0;
  const duration = 1000;
  const start = performance.now();
  const step = (t) => {
    const p = Math.min((t - start) / duration, 1);
    current = Math.round(target * p);
    if (el.dataset.target === '2011') el.textContent = String(current);
    if (el.dataset.target === '20000000') el.textContent = `${Math.floor(current/1000000)}+ Cr`.replace('0+','2+');
    if (el.dataset.target === '320000') el.textContent = `${Math.floor(current/1000)} L`.replace('0 L','3.2 L');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

// Simple project data (can be extended or pulled from a CMS later)
const projects = [
  { title: 'Bombay Dyeing ICC', developer: 'Bombay Realty', cat: 'commercial' },
  { title: 'Fortune Florence', developer: 'Fortune Group', cat: 'residential' },
  { title: 'Paradigm Anantaara', developer: 'Paradigm Realty', cat: 'residential' },
  { title: 'Mahindra & Mahindra Colony', developer: 'Shraddha Prime Projects Ltd.', cat: 'residential' },
  { title: 'Raj Heritage', developer: 'Raj Realty', cat: 'residential' },
  { title: 'Sethia Pride', developer: 'Sethia', cat: 'residential' },
  { title: 'Auris Business Centre', developer: 'Dev Pooja Builders', cat: 'commercial' },
  { title: 'Meril Experience Centre', developer: '', cat: 'commercial' },
  { title: 'Fair Field', developer: 'S Raheja', cat: 'hotel' },
  { title: 'Vaishno Sky', developer: 'Shree Vaishno Homes', cat: 'residential' },
  { title: 'Jangid Trinity', developer: 'Jangid Group', cat: 'residential' }
];

const grid = document.getElementById('project-grid');

function render(filter = 'all') {
  grid.innerHTML = '';
  projects
    .filter(p => filter === 'all' ? true : p.cat === filter)
    .forEach(p => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <span class="pill">${p.cat}</span>
        <h3>${p.title}</h3>
        <p>${p.developer ? 'Developer: ' + p.developer : '&nbsp;'}</p>
      `;
      grid.appendChild(card);
    });
}

render('all');

document.querySelectorAll('.filters .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filters .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.filter);
  });
});

// Contact form: open email client with prefilled content
const form = document.getElementById('contact-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name');
  const email = data.get('email');
  const company = data.get('company');
  const type = data.get('type');
  const message = data.get('message');
  const subject = encodeURIComponent('New enquiry from Noesis website');
  const body = encodeURIComponent(
    `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nProject type: ${type}\n\n${message}`
  );
  window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`;
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
