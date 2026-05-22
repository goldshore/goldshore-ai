export function initTiltPanels() {
  const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supportsFinePointer || reduceMotion) return;

  const panels = document.querySelectorAll<HTMLElement>("[data-gs-tilt]");

  panels.forEach(panel => {
    panel.style.transformStyle = "preserve-3d";
    panel.style.transition = "transform 300ms cubic-bezier(0.2,0.8,0.2,1)";

    panel.addEventListener("pointermove", e => {
      const rect = panel.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      const rotateX = y * -10;
      const rotateY = x * 10;

      panel.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    panel.addEventListener("pointerleave", () => {
      panel.style.transform =
        "perspective(1000px) rotateX(0deg) rotateY(0deg)";
    });
  });
}
