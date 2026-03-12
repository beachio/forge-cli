document.addEventListener('DOMContentLoaded', () => {
  initTimestamp();
  initFeatureCards();
  initStatusBar();
});

function initTimestamp() {
  const el = document.getElementById('deploy-time');
  if (!el) return;

  const now = new Date();
  const formatted = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  el.textContent = `Last deployed: ${formatted}`;
}

function initFeatureCards() {
  const cards = document.querySelectorAll('.feature');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(12px)';

    setTimeout(() => {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + i * 80);
  });
}

function initStatusBar() {
  const bar = document.querySelector('.status-bar');
  if (!bar) return;

  const start = performance.now();

  function update() {
    const elapsed = ((performance.now() - start) / 1000).toFixed(0);
    const span = bar.querySelector('.uptime');
    if (span) span.textContent = `${elapsed}s`;
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
