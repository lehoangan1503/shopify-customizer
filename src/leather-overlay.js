/**
 * LEATHER SURFACE MODULE
 * Simple approach: composite leather image onto surface.jpg
 * Creates a mixed surface image for leather products.
 */

// =====================================================
// ===== 10 LEATHER PRESETS - TEST WHICH LOOKS BEST =====
// =====================================================
// Change ACTIVE_PRESET to test different configs (1-10)
export const ACTIVE_PRESET = 1;

export const LEATHER_PRESETS = {
  // Config 1: Deep Crocodile - Strong bump, very rough
  1: {
    name: "Deep Crocodile",
    roughness: 120, // 0-255, higher = more matte
    clearcoat: 5, // 0-255, lower = less shiny
    normalScale: 3.5, // Bump intensity for material
  },
};

// Get active preset
const activePreset = LEATHER_PRESETS[ACTIVE_PRESET] || LEATHER_PRESETS[1];
console.log(`[LeatherOverlay] Using preset ${ACTIVE_PRESET}: ${activePreset.name}`);

// Export for use in main.js material creation
export const LEATHER_MATERIAL_CONFIG = {
  roughness: activePreset.roughness,
  clearcoat: activePreset.clearcoat,
  normalScale: activePreset.normalScale,
};

// Leather frame coordinates (where leather image goes on surface)
// Updated: y=3600 to fit 1:1 with surface, frame is 1141×3313
export const LEATHER_FRAME = {
  x: 0,
  y: 3660,
  width: 1141,
  height: 3464,
  surfaceWidth: 1141,
  surfaceHeight: 8359,
};

// Pre-made leather images (1141×3313 - exact frame size)
const LEATHER_IMAGES = {
  default: "./leather-frame1.jpg",
  alt: "./leather-frame1.jpg",
};

/**
 * Load an image as a promise
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Create a mixed surface image with leather overlay
 * Composites leather color on top of surface.jpg at the leather region
 *
 * @param {string} surfacePath - path to base surface image
 * @param {string} leatherPath - path to leather frame image (default: leather-frame.jpg) - DEPRECATED
 * @param {string|null} leatherColorPath - DEPRECATED: use leatherColorHex instead
 * @param {string|null} leatherColorHex - hex color code (e.g., "#1A1A1A") to fill leather region
 * @returns {Promise<HTMLCanvasElement>} - canvas with composited image
 */
export async function createLeatherSurface(surfacePath, leatherPath = LEATHER_IMAGES.default, leatherColorPath = null, leatherColorHex = null) {
  // Load surface image
  const surfaceImg = await loadImage(surfacePath);

  // Create canvas at surface size
  const canvas = document.createElement("canvas");
  canvas.width = surfaceImg.width;
  canvas.height = surfaceImg.height;
  const ctx = canvas.getContext("2d");

  // Draw base surface
  ctx.drawImage(surfaceImg, 0, 0);

  // Calculate scale if canvas differs from original frame dimensions
  const scaleX = canvas.width / LEATHER_FRAME.surfaceWidth;
  const scaleY = canvas.height / LEATHER_FRAME.surfaceHeight;

  // Draw leather color at frame position (scaled)
  const drawX = LEATHER_FRAME.x * scaleX;
  const drawY = LEATHER_FRAME.y * scaleY;
  const drawW = LEATHER_FRAME.width * scaleX;
  const drawH = LEATHER_FRAME.height * scaleY;

  if (leatherColorHex) {
    // Draw solid color from palette
    ctx.fillStyle = leatherColorHex;
    ctx.fillRect(drawX, drawY, drawW, drawH);
    console.log("[LeatherSurface] Created mixed surface:", {
      surfaceSize: `${canvas.width}x${canvas.height}`,
      leatherAt: `${drawX.toFixed(0)},${drawY.toFixed(0)} ${drawW.toFixed(0)}x${drawH.toFixed(0)}`,
      colorSource: `hex: ${leatherColorHex}`,
    });
  } else if (leatherColorPath) {
    // Fallback: load image (legacy support)
    const leatherColorImg = await loadImage(leatherColorPath);
    ctx.drawImage(leatherColorImg, drawX, drawY, drawW, drawH);
    console.log("[LeatherSurface] Created mixed surface:", {
      surfaceSize: `${canvas.width}x${canvas.height}`,
      leatherAt: `${drawX.toFixed(0)},${drawY.toFixed(0)} ${drawW.toFixed(0)}x${drawH.toFixed(0)}`,
      colorSource: "leatherColorPath (legacy)",
    });
  } else {
    // Fallback: load default leather image
    const leatherImg = await loadImage(leatherPath);
    ctx.drawImage(leatherImg, drawX, drawY, drawW, drawH);
    console.log("[LeatherSurface] Created mixed surface:", {
      surfaceSize: `${canvas.width}x${canvas.height}`,
      leatherAt: `${drawX.toFixed(0)},${drawY.toFixed(0)} ${drawW.toFixed(0)}x${drawH.toFixed(0)}`,
      colorSource: "leatherPath (default)",
    });
  }

  return canvas;
}

/**
 * Create a roughness map for leather products
 * Leather region = high roughness (matte, no reflection)
 * Other regions = very low roughness (glossy, mirror-like lacquer)
 *
 * @param {number} width - canvas width
 * @param {number} height - canvas height
 * @returns {HTMLCanvasElement} - roughness map canvas
 */
export function createLeatherRoughnessMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Calculate scale
  const scaleX = width / LEATHER_FRAME.surfaceWidth;
  const scaleY = height / LEATHER_FRAME.surfaceHeight;

  // Fill entire canvas with very low roughness (glossy lacquer)
  ctx.fillStyle = "rgb(10, 10, 10)"; // Very glossy for lacquered parts
  ctx.fillRect(0, 0, width, height);

  // Fill leather region with roughness from preset
  const leatherY = LEATHER_FRAME.y * scaleY;
  const leatherH = LEATHER_FRAME.height * scaleY;
  const r = activePreset.roughness;

  ctx.fillStyle = `rgb(${r}, ${r}, ${r})`; // From preset (higher = more matte)
  ctx.fillRect(0, leatherY, width, leatherH);

  console.log(`[LeatherSurface] Created roughness map (preset ${ACTIVE_PRESET}: ${activePreset.name}, roughness=${r})`);
  return canvas;
}

/**
 * Create a clearcoat map for leather products
 * Leather region = low/no clearcoat (from preset)
 * Other regions = full clearcoat (white)
 *
 * @param {number} width - canvas width
 * @param {number} height - canvas height
 * @returns {HTMLCanvasElement} - clearcoat map canvas
 */
export function createLeatherClearcoatMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Calculate scale
  const scaleX = width / LEATHER_FRAME.surfaceWidth;
  const scaleY = height / LEATHER_FRAME.surfaceHeight;

  // Fill entire canvas with full clearcoat (white = glossy clearcoat)
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillRect(0, 0, width, height);

  // Fill leather region with clearcoat from preset
  const leatherY = LEATHER_FRAME.y * scaleY;
  const leatherH = LEATHER_FRAME.height * scaleY;
  const c = activePreset.clearcoat;

  ctx.fillStyle = `rgb(${c}, ${c}, ${c})`; // From preset (lower = less shiny)
  ctx.fillRect(0, leatherY, width, leatherH);

  console.log(`[LeatherSurface] Created clearcoat map (preset ${ACTIVE_PRESET}: ${activePreset.name}, clearcoat=${c})`);
  return canvas;
}

/**
 * Get leather surface as an Image element (for use as texture)
 */
export async function getLeatherSurfaceImage(surfacePath, leatherPath = LEATHER_IMAGES.default, leatherColorPath = null, leatherColorHex = null) {
  const canvas = await createLeatherSurface(surfacePath, leatherPath, leatherColorPath, leatherColorHex);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL("image/jpeg", 0.95);
  });
}
