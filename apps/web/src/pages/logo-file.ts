// The image types the server accepts. SVG is left out, because an SVG file can contain code.
export const LOGO_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon";
const MAX_LOGO_BYTES = 100_000;

export const LOGO_HINT = "Square, at least 64 × 64 px. 128 × 128 px looks best. PNG, JPEG, WebP, GIF or ICO, up to 100 KB.";

// Reads a chosen file as a data address, or explains why it cannot be used.
export function readLogoFile(file: File): Promise<string> {
  if (!LOGO_ACCEPT.split(",").includes(file.type)) return Promise.reject(new Error("Choose a PNG, JPEG, WebP, GIF or ICO image"));
  if (file.size > MAX_LOGO_BYTES) return Promise.reject(new Error("Choose an image of at most 100 KB"));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("That file could not be read"));
    reader.readAsDataURL(file);
  });
}
