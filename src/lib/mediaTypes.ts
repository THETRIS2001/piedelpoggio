/**
 * Elenco unico dei formati media accettati.
 *
 * Prima queste estensioni erano ripetute in sei punti — API, pagina galleria,
 * pagina cartella, masonry, due route di servizio dei file — e aggiungerne una
 * significava ricordarsi di toccarli tutti. È così che i .mov degli iPhone
 * erano rimasti fuori. Chi deve conoscere i formati importa da qui.
 */

export const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

// .mov è il formato con cui registrano gli iPhone: senza, i video girati da
// telefono venivano rifiutati al caricamento.
export const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];

export function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isVideoName(name: string): boolean {
  return VIDEO_EXTS.includes(getExt(name));
}

export function isImageName(name: string): boolean {
  return IMAGE_EXTS.includes(getExt(name));
}

export function isAllowedMedia(name: string): boolean {
  const ext = getExt(name);
  return IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext);
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
};

export function contentTypeForName(name: string): string {
  return CONTENT_TYPES[getExt(name)] || "application/octet-stream";
}
