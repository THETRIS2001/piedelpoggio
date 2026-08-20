/**
 * Zoom e trascinamento della foto aperta a tutto schermo, gestiti a mano.
 *
 * Perché non lo zoom nativo del browser: quello scala l'intera pagina, quindi
 * ingrandisce anche le frecce di navigazione. Contro-scalarle da JS non basta,
 * perché gli eventi di `visualViewport` arrivano dopo che il compositore ha
 * già disegnato i frame del gesto: le frecce si muovono insieme alla pagina e
 * solo a gesto finito tornano al loro posto, con l'assestamento visibile.
 *
 * Qui invece la pagina non zooma mai (touch-action spegne il pinch ovunque, il
 * meta viewport è bloccato): a trasformarsi è solo l'immagine. Tutto il resto
 * della lightbox, frecce comprese, resta DOM immobile.
 */

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const MOVE_TOLERANCE = 8;

export interface PhotoZoom {
  /** Riporta la foto a scala 1, centrata. */
  reset(): void;
  /** Stacca i listener. */
  destroy(): void;
}

/**
 * @param img     l'immagine da trasformare
 * @param surface il contenitore che riceve i gesti (tutta la lightbox, così il
 *                trascinamento continua anche se il dito esce dalla foto)
 */
export function attachPhotoZoom(
  img: HTMLImageElement,
  surface: HTMLElement,
): PhotoZoom {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let mode: "none" | "pan" | "pinch" = "none";
  let lastX = 0;
  let lastY = 0;
  let lastDist = 0;
  let lastTapAt = 0;
  // Vero quando il tocco corrente è stato un gesto e non un tap: serve a non
  // far chiudere la lightbox con il click che segue un pinch o un pan.
  let gestured = false;
  let gestureExpiry: ReturnType<typeof setTimeout> | undefined;

  // Se dopo il gesto nessun click arriva a consumare il flag, scade da solo:
  // senza scadenza resterebbe alzato e mangerebbe il tap buono successivo.
  const expireGestureSoon = () => {
    clearTimeout(gestureExpiry);
    gestureExpiry = setTimeout(() => {
      gestured = false;
    }, 400);
  };

  const apply = () => {
    img.style.transform =
      scale === 1 ? "" : `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  // Tiene i bordi della foto entro il proprio riquadro: niente immagine
  // trascinata fuori dallo schermo.
  const clampOffset = () => {
    const maxX = (img.offsetWidth * (scale - 1)) / 2;
    const maxY = (img.offsetHeight * (scale - 1)) / 2;
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };

  /**
   * Porta la scala a `next` tenendo fermo il punto (ax, ay) dello schermo:
   * è quello che fa sembrare lo zoom ancorato alle dita.
   */
  const zoomTo = (next: number, ax: number, ay: number) => {
    const target = Math.min(MAX_SCALE, Math.max(1, next));
    if (target === scale) return;

    // Centro dell'immagine non trasformata: la scala non sposta il centro,
    // quindi basta togliere la traslazione corrente dal rect attuale.
    const rect = img.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - tx;
    const cy = rect.top + rect.height / 2 - ty;
    const ux = ax - cx;
    const uy = ay - cy;
    const ratio = target / scale;

    tx = ux - ratio * (ux - tx);
    ty = uy - ratio * (uy - ty);
    scale = target;
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
    clampOffset();
    apply();
  };

  const distance = (t: TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      clearTimeout(gestureExpiry);
      gestured = false;
      mode = scale > 1 ? "pan" : "none";
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      mode = "pinch";
      gestured = true;
      lastDist = distance(e.touches);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (mode === "pinch" && e.touches.length === 2) {
      e.preventDefault();
      const d = distance(e.touches);
      if (lastDist > 0) {
        zoomTo(
          scale * (d / lastDist),
          (e.touches[0].clientX + e.touches[1].clientX) / 2,
          (e.touches[0].clientY + e.touches[1].clientY) / 2,
        );
      }
      lastDist = d;
      return;
    }

    if (mode === "pan" && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > MOVE_TOLERANCE) gestured = true;
      tx += dx;
      ty += dy;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      clampOffset();
      apply();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      // Un dito sollevato durante il pinch: si continua trascinando.
      mode = scale > 1 ? "pan" : "none";
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      return;
    }
    if (e.touches.length > 1) return;

    if (!gestured && e.changedTouches.length === 1) {
      const tap = e.changedTouches[0];
      const onPhoto = (tap.target as HTMLElement | null)?.closest?.("img") === img;

      if (scale > 1) {
        // Da ingrandita un tap rimette a posto, e serve che sia un tap solo:
        // a pieno zoom la foto copre lo schermo, quindi non c'è più uno sfondo
        // da toccare per chiudere e senza questa via d'uscita si resterebbe
        // bloccati dentro la foto.
        zoomTo(1, tap.clientX, tap.clientY);
        gestured = true;
        lastTapAt = 0;
      } else if (onPhoto && e.timeStamp - lastTapAt < DOUBLE_TAP_MS) {
        // Doppio tap sulla foto: ingrandisce.
        zoomTo(DOUBLE_TAP_SCALE, tap.clientX, tap.clientY);
        gestured = true;
        lastTapAt = 0;
      } else {
        lastTapAt = e.timeStamp;
      }
    }
    mode = "none";
    if (gestured) expireGestureSoon();
  };

  // In cattura, così arriva prima del listener che chiude la lightbox.
  const onClickCapture = (e: MouseEvent) => {
    // Le frecce devono rispondere sempre: non vanno mai soppresse.
    if ((e.target as HTMLElement | null)?.closest?.("button")) return;
    if (!gestured) return;
    clearTimeout(gestureExpiry);
    gestured = false;
    e.stopPropagation();
    e.preventDefault();
  };

  surface.addEventListener("touchstart", onTouchStart, { passive: true });
  surface.addEventListener("touchmove", onTouchMove, { passive: false });
  surface.addEventListener("touchend", onTouchEnd, { passive: true });
  surface.addEventListener("touchcancel", onTouchEnd, { passive: true });
  surface.addEventListener("click", onClickCapture, true);

  return {
    reset() {
      clearTimeout(gestureExpiry);
      scale = 1;
      tx = 0;
      ty = 0;
      mode = "none";
      gestured = false;
      apply();
    },
    destroy() {
      clearTimeout(gestureExpiry);
      surface.removeEventListener("touchstart", onTouchStart);
      surface.removeEventListener("touchmove", onTouchMove);
      surface.removeEventListener("touchend", onTouchEnd);
      surface.removeEventListener("touchcancel", onTouchEnd);
      surface.removeEventListener("click", onClickCapture, true);
      img.style.transform = "";
    },
  };
}
