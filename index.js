/**
 * Deeper (디퍼) - Interactive Storytelling Scroll Application
 * 
 * Handles viewport scaling, scroll-based navigation dot highlighting,
 * and a custom responsive volume slider.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Element Selectors ---
  const container = document.querySelector('.figma-container');
  const wrapper = document.querySelector('.page-wrapper');
  const sidebar = document.querySelector('.sidebar');
  const soundBtn = document.getElementById('sound-toggle');
  const audio = document.getElementById('ambient-audio');
  const dots = document.querySelectorAll('.dot');

  const soundbar = document.getElementById('soundbar');
  const trackActive = document.querySelector('.soundbar-track-active');
  const knob = document.querySelector('.soundbar-knob');

  // --- Constants & Configurations ---
  const designWidth = 1920;
  const designHeight = 14729;

  // Section ranges in design pixels (scroll target coordinates)
  const sections = [
    { id: 1, startY: 0, scrollTarget: 1000 },
    { id: 2, startY: 3900, scrollTarget: 3900 },
    { id: 3, startY: 5900, scrollTarget: 5900 },
    { id: 4, startY: 7500, scrollTarget: 7500 }
  ];

  // Global State
  let scale = 1;
  let isMuted = true;
  let currentVolume = 0; // Default volume (starts muted at 0)
  let fadingIcons = []; // List of fading human icons with random thresholds
  let lastProgress = -1; // Track scroll progress for optimization

  /* ==========================================================================
     1. Dynamic Page Scaling & Sidebar Alignment
     ========================================================================== */
  function adjustScale() {
    const windowWidth = window.innerWidth;
    scale = windowWidth / designWidth;

    // Scale container to fit browser window window width
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top center';

    // Match height of the outer wrapper to the scaled container height
    wrapper.style.height = `${designHeight * scale}px`;

    // Dynamically scale and position the fixed navigation sidebar to preserve alignment
    const leftOffset = (windowWidth - designWidth * scale) / 2;
    sidebar.style.left = `${leftOffset + 296 * scale}px`;
    sidebar.style.top = `${340 * scale}px`;
    sidebar.style.transform = `scale(${scale})`;
    sidebar.style.transformOrigin = 'top left';

    // Update opacity on scaling resize
    lastProgress = -1; // Force update on resize
    updateIconOpacity(window.scrollY / scale);
  }

  window.addEventListener('resize', adjustScale);
  adjustScale();

  /* ==========================================================================
     2. Volume Soundbar & Audio Drag Control
     ========================================================================== */
  audio.volume = 0; // Start silent
  audio.loop = true; // Ensure repeating loop on end

  /**
   * Adjust active slider path, position of the drag knob handle, and SVG icon states
   * @param {number} percent - Volume level between 0.0 and 1.0
   */
  function updateVolumeSlider(percent) {
    trackActive.style.width = `${percent * 100}%`;
    knob.style.left = `calc(${percent * 100}% - 20px)`; // Centered at active end minus half of knob width (40px)

    // Update inline SVG icon states based on current volume
    const waveInner = soundBtn.querySelector('.wave-inner');
    const waveOuter = soundBtn.querySelector('.wave-outer');
    const muteLine = soundBtn.querySelector('.mute-line');

    if (waveInner && waveOuter && muteLine) {
      if (percent === 0) {
        muteLine.style.display = 'block';
        waveInner.style.opacity = '0';
        waveOuter.style.opacity = '0';
      } else if (percent < 0.5) {
        muteLine.style.display = 'none';
        waveInner.style.opacity = '1';
        waveOuter.style.opacity = '0';
      } else {
        muteLine.style.display = 'none';
        waveInner.style.opacity = '1';
        waveOuter.style.opacity = '1';
      }
    }
  }

  // Set initial slider position
  updateVolumeSlider(currentVolume);

  // Sound play toggle button click handler
  soundBtn.addEventListener('click', () => {
    if (isMuted) {
      const targetVol = currentVolume > 0 ? currentVolume : 0.5;
      currentVolume = targetVol;
      audio.volume = targetVol;
      audio.play().then(() => {
        isMuted = false;
        soundBtn.classList.add('playing');
        updateVolumeSlider(targetVol);
      }).catch(err => {
        console.warn("Audio playback blocked by browser. Click page to interact first.", err);
      });
    } else {
      audio.volume = 0;
      audio.pause();
      isMuted = true;
      soundBtn.classList.remove('playing');
      updateVolumeSlider(0);
    }
  });

  // Drag Interaction State
  let isDragging = false;

  // Extract clientX offset for both mouse and touch interaction events
  const getClientX = (e) => e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;

  function handleVolumeChange(clientX) {
    const rect = soundbar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

    currentVolume = percent;

    if (percent > 0) {
      isMuted = false;
      audio.volume = percent;
      if (audio.paused) {
        audio.play().catch(() => { });
      }
      soundBtn.classList.add('playing');
    } else {
      isMuted = true;
      audio.volume = 0;
      audio.pause();
      soundBtn.classList.remove('playing');
    }

    updateVolumeSlider(percent);
  }

  // Unified Interaction Listeners
  const startDrag = (e) => {
    isDragging = true;
    handleVolumeChange(getClientX(e));
  };

  const drag = (e) => {
    if (isDragging) {
      handleVolumeChange(getClientX(e));
    }
  };

  const stopDrag = () => {
    isDragging = false;
  };

  soundbar.addEventListener('mousedown', startDrag);
  soundbar.addEventListener('touchstart', startDrag, { passive: true });

  window.addEventListener('mousemove', drag);
  window.addEventListener('touchmove', drag, { passive: true });

  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchend', stopDrag);

  /* ==========================================================================
     3. Timeline Active Dot Scrolling & Section Navigation
     ========================================================================== */

  // Cache reversed sections array once to avoid recreating it on every scroll frame
  const reversedSections = [...sections].reverse();
  let currentActiveSectionId = 1;
  let scrollTick = false;

  // Highlight navigation dots automatically based on current vertical scroll position
  window.addEventListener('scroll', () => {
    if (!scrollTick) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const designScrollY = currentScrollY / scale;

        // Dynamically retrieve active section boundary based on cached configuration
        const activeSection = reversedSections.find(s => designScrollY >= s.startY) || sections[0];

        if (activeSection.id !== currentActiveSectionId) {
          currentActiveSectionId = activeSection.id;
          dots.forEach(dot => {
            const sectionId = parseInt(dot.getAttribute('data-section'), 10);
            dot.classList.toggle('active', sectionId === activeSection.id);
          });
        }

        // Update the opacity of person icons dynamically as we scroll
        updateIconOpacity(designScrollY);
        scrollTick = false;
      });
      scrollTick = true;
    }
  });

  // Smooth scroll target alignment when sidebar dot menu is clicked
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = parseInt(dot.getAttribute('data-section'), 10);
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        window.scrollTo({
          top: section.scrollTarget * scale,
          behavior: 'smooth'
        });
      }
    });
  });

  /* ==========================================================================
     4. Dynamic SVG Human Grid & Opacity Interaction
     ========================================================================== */
  const personIcons = document.querySelectorAll('.person-icon');
  if (personIcons.length > 0) {
    // Randomly choose 20% of indices (32 indices out of 160)
    const totalIcons = personIcons.length;
    const fadeCount = Math.round(totalIcons * 0.2);
    const allIndices = Array.from({ length: totalIcons }, (_, i) => i);
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }
    const fadeIndices = new Set(allIndices.slice(0, fadeCount));

    const tempFadingIcons = [];
    personIcons.forEach((g, i) => {
      if (fadeIndices.has(i)) {
        // Stagger the fade thresholds to make them disappear organically
        const startThreshold = Math.random() * 0.55; // start fading between 0.0 and 0.55 progress
        const endThreshold = startThreshold + 0.2 + Math.random() * 0.25; // fade duration is 0.2 to 0.45 progress
        tempFadingIcons.push({
          element: g,
          start: startThreshold,
          end: Math.min(endThreshold, 1.0)
        });
      }
    });

    fadingIcons = tempFadingIcons;

    // Run initial calculation
    const currentScrollY = window.scrollY;
    const designScrollY = currentScrollY / scale;
    updateIconOpacity(designScrollY);
  }

  function updateIconOpacity(designScrollY) {
    if (fadingIcons.length === 0) return;

    // Section 2 scroll range: 3200 to 4300
    const startY = 3200;
    const endY = 4300;

    let progress = 0;
    if (designScrollY < startY) {
      progress = 0;
    } else if (designScrollY > endY) {
      progress = 1;
    } else {
      progress = (designScrollY - startY) / (endY - startY);
    }

    // Avoid layout thrashing if the progress has not changed
    if (progress === lastProgress) return;
    lastProgress = progress;

    fadingIcons.forEach(icon => {
      if (progress < icon.start) {
        icon.element.style.opacity = '1';
      } else if (progress > icon.end) {
        icon.element.style.opacity = '0.15';
      } else {
        const factor = (progress - icon.start) / (icon.end - icon.start);
        const opacity = 1.0 - factor * (1.0 - 0.15);
        icon.element.style.opacity = opacity.toFixed(3);
      }
    });
  }

  /* ==========================================================================
     5. Fullscreen Dark Overlay & Glowing Fluid Particle Simulation
     ========================================================================== */
  class Particle {
    constructor(w, h) {
      this.reset(w, h, true);
    }

    reset(w, h, initial = false) {
      this.x = Math.random() * w;
      this.y = initial ? Math.random() * h : (Math.random() > 0.5 ? 0 : h);
      this.radius = Math.random() * 2.5 + 1.5;
      this.baseSpeed = Math.random() * 0.8 + 0.4;
      this.angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(this.angle) * this.baseSpeed;
      this.vy = Math.sin(this.angle) * this.baseSpeed;
      this.alpha = Math.random() * 0.3 + 0.15;
      this.hue = 76; // matches var(--color-primary) (#e8f5bd)
      this.lightness = Math.random() * 10 + 75;
    }

    update(w, h, mx, my, repelRadius) {
      this.x += this.vx;
      this.y += this.vy;

      // Friction
      this.vx *= 0.98;
      this.vy *= 0.98;

      // Random drift
      this.vx += (Math.random() - 0.5) * 0.05;
      this.vy += (Math.random() - 0.5) * 0.05;

      // Clamped speed check: avoid Math.sqrt unless speed is below threshold
      const speedSq = this.vx * this.vx + this.vy * this.vy;
      const baseSpeedSq = this.baseSpeed * this.baseSpeed;
      if (speedSq < baseSpeedSq) {
        const speed = Math.sqrt(speedSq) || 1;
        this.vx = (this.vx / speed) * this.baseSpeed;
        this.vy = (this.vy / speed) * this.baseSpeed;
      }

      // Repulsion force: optimize distance calculations (avoid sqrt and trig functions)
      const dx = this.x - mx;
      const dy = this.y - my;
      const distSq = dx * dx + dy * dy;
      const repelRadiusSq = repelRadius * repelRadius;

      if (distSq < repelRadiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        const force = (repelRadius - dist) / repelRadius;
        const repelPower = 1.5;
        const forceRatio = (force * repelPower) / dist;
        this.vx += dx * forceRatio;
        this.vy += dy * forceRatio;
      }

      // Bounds collision
      if (this.x < 0) {
        this.x = 0;
        this.vx = Math.abs(this.vx) * 0.8;
      } else if (this.x > w) {
        this.x = w;
        this.vx = -Math.abs(this.vx) * 0.8;
      }

      if (this.y < 0) {
        this.y = 0;
        this.vy = Math.abs(this.vy) * 0.8;
      } else if (this.y > h) {
        this.y = h;
        this.vy = -Math.abs(this.vy) * 0.8;
      }
    }

    draw(ctx) {
      ctx.save();
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3);
      grad.addColorStop(0, `hsla(${this.hue}, 80%, ${this.lightness}%, ${this.alpha})`);
      grad.addColorStop(0.3, `hsla(${this.hue}, 80%, ${this.lightness}%, ${this.alpha * 0.5})`);
      grad.addColorStop(1, `hsla(${this.hue}, 80%, ${this.lightness}%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const canvas = document.getElementById('fluid-overlay-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let mouseX = width / 2;
    let mouseY = height / 2;
    const repelRadius = 225;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    });

    const particles = [];
    const maxParticles = 100;
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle(width, height));
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw 80% opacity dark overlay matching var(--color-bg-dark)
      ctx.fillStyle = 'rgba(26, 29, 38, 0.8)';
      ctx.fillRect(0, 0, width, height);

      // Cut out the flashlight transparent hole
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, repelRadius);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, repelRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Update & Draw particles
      particles.forEach(p => {
        p.update(width, height, mouseX, mouseY, repelRadius);
        p.draw(ctx);
      });

      requestAnimationFrame(animate);
    }

    animate();
  }
});