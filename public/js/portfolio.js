(function(){
  const cfg = (window.PORTFOLIO_CONFIG || {});
  const API_BASE = (cfg.API_BASE_URL || '').replace(/\/$/, '');
  const ADMIN_URL = cfg.ADMIN_PORTAL_URL || '';

  const THEME = {
    cardBg: '#ffffff',
    cardBgAlt: '#fff7fa',
    border: 'rgba(231,84,128,.25)',
    text: '#4A4A4A',
    muted: 'rgba(74,74,74,.78)',
    primary: '#E75480',
    primarySoft: 'rgba(231,84,128,.14)',
    progressTrack: 'rgba(231,84,128,.18)'
  };

  function apiUrl(path){
    if (!API_BASE) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return API_BASE + path;
  }

  const adminLink = document.getElementById('admin-link');
  if (adminLink && ADMIN_URL) {
    const base = ADMIN_URL.replace(/\/+$/, '');
    adminLink.href = base + '/login.html';
  }

  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const navDots = document.querySelectorAll('.nav-dot');
  const totalSlides = slides.length;

  async function downloadFile(url, fallbackFilename) {
    const response = await fetch(apiUrl(url), { cache: 'no-store' });
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const json = await response.json();
        if (json && json.error) message = json.error;
      } catch (e) {}
      throw new Error(message);
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const headerFilename = filenameMatch ? decodeURIComponent(filenameMatch[1] || filenameMatch[2] || '') : '';
    const filename = (headerFilename || fallbackFilename || 'resume.pdf').toString();

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function bindResumeDownload(el) {
    if (!el) return;
    if (el.dataset && el.dataset.resumeBound === 'true') return;
    if (el.dataset) el.dataset.resumeBound = 'true';

    el.addEventListener('click', async (e) => {
      if (el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled')) {
        e.preventDefault();
        const message = el.getAttribute('title') || 'My resume isn’t available right now. Please upload one from the Admin Dashboard to enable downloads.';
        alert(message);
        return;
      }

      e.preventDefault();
      const preferredName = el.getAttribute('download') || (el.dataset ? el.dataset.downloadName : '') || 'resume.pdf';
      try {
        await downloadFile('/api/resume/download', preferredName);
      } catch (err) {
        console.error(err);
        alert(err && err.message ? err.message : 'Sorry—something went wrong while downloading the resume. Please try again.');
      }
    });
  }

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'prev');
      if (i < index) {
        slide.classList.add('prev');
      }
    });

    if (slides[index]) slides[index].classList.add('active');

    navDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    currentSlide = index;
  }

  function nextSlide() {
    const next = (currentSlide + 1) % totalSlides;
    showSlide(next);
  }

  function prevSlide() {
    const prev = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(prev);
  }

  const nextBtn = document.getElementById('next-btn');
  const prevBtn = document.getElementById('prev-btn');

  if (nextBtn) nextBtn.addEventListener('click', nextSlide);
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);

  navDots.forEach((dot, index) => {
    dot.addEventListener('click', () => showSlide(index));
  });

  document.querySelectorAll('[data-jump-slide]').forEach((el) => {
    el.addEventListener('click', () => {
      const raw = el.getAttribute('data-jump-slide');
      const index = Number.parseInt(raw, 10);
      if (!Number.isNaN(index)) {
        showSlide(index);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      prevSlide();
    }
  });

  let wheelLock = false;
  let wheelAccumulator = 0;

  function findScrollContainer(target) {
    if (!target) return null;
    if (target.closest) {
      return target.closest('.slide-content');
    }
    return null;
  }

  function canScroll(container, deltaY) {
    if (!container) return false;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    if (maxScrollTop <= 0) return false;

    if (deltaY > 0) {
      return container.scrollTop < maxScrollTop;
    }
    return container.scrollTop > 0;
  }

  document.addEventListener('wheel', (e) => {
    const deltaY = e.deltaY;
    if (!deltaY) return;

    const container = findScrollContainer(e.target);
    if (canScroll(container, deltaY)) {
      return;
    }

    e.preventDefault();

    if (wheelLock) return;

    wheelAccumulator += deltaY;
    const threshold = 60;

    if (Math.abs(wheelAccumulator) < threshold) return;

    if (wheelAccumulator > 0) {
      nextSlide();
    } else {
      prevSlide();
    }

    wheelAccumulator = 0;
    wheelLock = true;
    setTimeout(() => {
      wheelLock = false;
    }, 650);
  }, { passive: false });

  async function loadPortfolio() {
    try {
      const res = await fetch(apiUrl('/api/portfolio'));
      const data = await res.json();
      if (!res.ok) return;

      const profile = data.profile || {};
      const skills = Array.isArray(data.skills) ? data.skills : [];
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const experience = Array.isArray(data.experience) ? data.experience : [];
      const blogs = Array.isArray(data.blogs) ? data.blogs : [];
      const education = Array.isArray(data.education) ? data.education : [];

      const byId = (id) => document.getElementById(id);

      if (byId('profile-name')) byId('profile-name').textContent = profile.name || '';
      if (byId('profile-role')) byId('profile-role').textContent = profile.role || '';
      if (byId('about-bio')) byId('about-bio').textContent = profile.bio || '';

      const img = profile.image || '';
      if (byId('profile-image')) byId('profile-image').src = img ? apiUrl(img) : '';
      if (byId('about-image')) byId('about-image').src = img ? apiUrl(img) : '';

      const resumeLinks = [byId('resume-download'), byId('resume-download-education')];
      resumeLinks.forEach((el) => {
        if (!el) return;
        bindResumeDownload(el);
        if (!profile.resume) {
          el.setAttribute('aria-disabled','true');
          el.classList.add('disabled');
          el.title = 'Resume not available yet.';
        }
      });

      const socialLinks = byId('social-links');
      if (socialLinks) {
        const links = [];
        if (profile.github) links.push({ label: 'GitHub', href: profile.github });
        if (profile.linkedin) links.push({ label: 'LinkedIn', href: profile.linkedin });
        socialLinks.innerHTML = links.map(l => `<a class="profile-cta" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('');
      }

      const skillsContainer = byId('skills-container');
      if (skillsContainer) {
        skillsContainer.innerHTML = skills.map(s => `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};padding:14px;border-radius:12px"><div style="font-weight:700;color:#1F1F1F">${s.name || ''}</div><div style="color:${THEME.muted}">${s.category || ''}</div><div style="margin-top:8px;height:8px;background:${THEME.progressTrack};border-radius:999px;overflow:hidden"><div style="width:${Number(s.level)||0}%;height:100%;background:${THEME.primary}"></div></div></div>`).join('');
      }

      const projectsContainer = byId('projects-container');
      if (projectsContainer) {
        projectsContainer.innerHTML = projects.map(p => {
          const tech = Array.isArray(p.techStack) ? p.techStack : [];
          return `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};padding:14px;border-radius:12px;display:grid;gap:10px"><div style="font-weight:700;color:#1F1F1F">${p.title||''}</div><div style="color:${THEME.muted}">${p.description||''}</div><div style="display:flex;flex-wrap:wrap;gap:8px">${tech.map(t=>`<span style=\"font-size:12px;background:${THEME.primarySoft};border:1px solid ${THEME.border};padding:4px 8px;border-radius:999px;color:#1F1F1F\">${t}</span>`).join('')}</div></div>`;
        }).join('');
      }

      const expContainer = byId('experience-container');
      if (expContainer) {
        expContainer.innerHTML = experience.map(e => `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};padding:14px;border-radius:12px"><div style="font-weight:700;color:#1F1F1F">${e.title||''}</div><div style="color:${THEME.muted}">${e.company||''}${e.location?` • ${e.location}`:''}</div><div style="color:${THEME.muted};margin-top:6px">${e.description||''}</div></div>`).join('');
      }

      const blogsContainer = byId('blogs-container');
      if (blogsContainer) {
        blogsContainer.innerHTML = blogs.map(b => {
          const tags = Array.isArray(b.tags) ? b.tags : [];
          return `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};padding:14px;border-radius:12px;display:grid;gap:10px"><div style="font-weight:700;color:#1F1F1F">${b.title||''}</div><div style="color:${THEME.muted}">${b.excerpt||''}</div><div style="display:flex;flex-wrap:wrap;gap:8px">${tags.map(t=>`<span style=\"font-size:12px;background:${THEME.primarySoft};border:1px solid ${THEME.border};padding:4px 8px;border-radius:999px;color:#1F1F1F\">${t}</span>`).join('')}</div></div>`;
        }).join('');
      }

      const eduContainer = byId('education-container');
      if (eduContainer) {
        eduContainer.innerHTML = education.map(e => `<div style="background:${THEME.cardBg};border:1px solid ${THEME.border};padding:14px;border-radius:12px"><div style="font-weight:700;color:#1F1F1F">${e.degree||''}${e.field?` - ${e.field}`:''}</div><div style="color:${THEME.muted}">${e.institution||''}</div><div style="color:${THEME.muted};margin-top:6px">${e.startDate||''}${e.endDate?` - ${e.endDate}`:''}</div></div>`).join('');
      }

      const contactMethods = byId('contact-methods');
      if (contactMethods) {
        const items = [];
        if (profile.email) items.push({ label: 'Email', value: profile.email });
        if (profile.phone) items.push({ label: 'Phone', value: profile.phone });
        if (profile.location) items.push({ label: 'Location', value: profile.location });
        contactMethods.innerHTML = items.map(i => `<div style="background:${THEME.cardBgAlt};border:1px solid ${THEME.border};padding:14px;border-radius:12px"><div style="font-weight:700;color:#1F1F1F">${i.label}</div><div style="color:${THEME.muted}">${i.value}</div></div>`).join('');
      }

    } catch (e) {
      console.error(e);
    }
  }

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('contact-form-status');

      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());

      if (statusEl) statusEl.textContent = 'Sending your message…';

      try {
        const response = await fetch(apiUrl('/api/contact'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          contactForm.reset();
          if (statusEl) statusEl.textContent = 'Thanks! Your message has been sent.';
        } else {
          if (statusEl) statusEl.textContent = data.error || 'Sorry—your message couldn’t be sent. Please try again.';
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Network issue—please check your connection and try again.';
      }
    });
  }

  if (totalSlides > 0) showSlide(0);
  loadPortfolio();
})();
