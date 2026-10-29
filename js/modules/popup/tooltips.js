/**
 * TOOLTIPS
 * Custom hover tip logic for .gb-info badges (Prevents native browser overlap).
 */

export function initTooltips() {
  let activeHoverTip = null;

  function showHoverTip(badge) {
    hideHoverTip();
    const text = badge.getAttribute("title") || badge.dataset.gbTip || "";
    if (!text) return;

    badge.dataset.gbTip = text;
    badge.removeAttribute("title"); 

    const tip = document.createElement("div");
    tip.className = "gb-tip";
    tip.textContent = text;
    document.body.appendChild(tip);

    const badgeBox = badge.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const margin = 6;

    let left = badgeBox.left + (badgeBox.width / 2) - (tipBox.width / 2);
    left = Math.max(margin, Math.min(left, document.documentElement.clientWidth - tipBox.width - margin));
    
    let top = badgeBox.top - tipBox.height - margin;
    if (top < margin) top = badgeBox.bottom + margin;

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    activeHoverTip = tip;
  }

  function hideHoverTip() {
    if (activeHoverTip) {
      activeHoverTip.remove();
      activeHoverTip = null;
    }
  }

  document.querySelectorAll(".gb-info").forEach((badge) => {
    badge.addEventListener("mouseenter", () => showHoverTip(badge));
    badge.addEventListener("focus", () => showHoverTip(badge));
    badge.addEventListener("mouseleave", hideHoverTip);
    badge.addEventListener("blur", hideHoverTip);
    badge.addEventListener("click", (e) => e.preventDefault());
  });

  window.addEventListener("scroll", hideHoverTip, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideHoverTip();
  });
}