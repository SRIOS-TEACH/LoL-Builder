// Keep the current tool visible in the shared horizontal navigation on smaller screens.
const nav = document.querySelector('.site-nav');
function revealCurrentPage() {
  const active = nav?.querySelector('[aria-current="page"]');
  if (!active || nav.scrollWidth <= nav.clientWidth) return;
  const link = active.getBoundingClientRect();
  const track = nav.getBoundingClientRect();
  nav.scrollLeft += link.left - track.left - (nav.clientWidth - link.width) / 2;
}
revealCurrentPage();
window.addEventListener('resize', revealCurrentPage);
