/**
 * home.js · portada del Módulo A.
 * Inicializa la UI compartida y revela las tarjetas al entrar en pantalla.
 */

import { initUI } from "../core/ui.js";
import { prefersReducedMotion, qsa } from "../core/dom.js";

initUI();

const revealItems = qsa(".route-card, .exercise-card");

if (!prefersReducedMotion() && "IntersectionObserver" in window) {
  revealItems.forEach((item) => item.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));

  // Red de seguridad: si el observer no dispara (capturas, navegación por anclas
  // o navegadores sin soporte), el contenido queda visible de todos modos.
  setTimeout(() => {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }, 900);
}
