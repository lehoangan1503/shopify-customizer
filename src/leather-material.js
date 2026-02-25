/**
 * LEATHER MATERIAL MODULE
 * Module xử lý chất liệu da và cao su cho sản phẩm
 */

import * as THREE from "three";
import { LEATHER_CONFIG, RUBBER_CONFIG, TOP_CAP_CONFIG, LEATHER_TEXTURE_TYPES, LEATHER_COLOR_PALETTES } from "./leather-config.js";
import { LEATHER_FRAME } from "./leather-overlay.js";

// Re-export config để main.js có thể import
export { LEATHER_CONFIG, RUBBER_CONFIG, TOP_CAP_CONFIG, LEATHER_TEXTURE_TYPES, LEATHER_COLOR_PALETTES };

// Calculate leather boundary ratios from config
const LEATHER_START_RATIO = LEATHER_CONFIG.startPx / LEATHER_CONFIG.originalTextureHeight;
const LEATHER_END_RATIO = LEATHER_CONFIG.endPx / LEATHER_CONFIG.originalTextureHeight;

// Use LEATHER_FRAME for consistent coordinates with roughness/clearcoat maps
// LEATHER_FRAME.y = start, LEATHER_FRAME.y + LEATHER_FRAME.height = end
// Scale factor: canvas height / LEATHER_FRAME.surfaceHeight

// =====================================================
// ===== LEATHER NORMAL MAP LOADER =====
// =====================================================
let leatherNormalImage = null;
let leatherNormalLoaded = false;
let leatherNormalPromise = null;

/**
 * Load leather normal map image
 * @param {boolean} forceReload - Force reload even if already cached
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadLeatherNormal(forceReload = false) {
  if (leatherNormalPromise && !forceReload) return leatherNormalPromise;

  // Reset state if force reloading
  if (forceReload) {
    leatherNormalImage = null;
    leatherNormalLoaded = false;
    leatherNormalPromise = null;
  }

  const normalPath = LEATHER_CONFIG.normalPath + "?v=" + Date.now();
  console.log("[Leather] Loading normal map:", normalPath);

  leatherNormalPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      leatherNormalImage = img;
      leatherNormalLoaded = true;
      console.log("[Leather] ✅ Normal map loaded:", img.width, "x", img.height);
      resolve(img);
    };
    img.onerror = () => {
      console.warn("[Leather] ⚠️ Normal map not found, skipping");
      leatherNormalLoaded = true;
      resolve(null);
    };
    img.src = normalPath;
  });

  return leatherNormalPromise;
}

/**
 * Kiểm tra leather normal đã load chưa
 */
export function isLeatherNormalLoaded() {
  return leatherNormalLoaded;
}

/**
 * Lấy leather normal image
 */
export function getLeatherNormalImage() {
  return leatherNormalImage;
}

/**
 * Load tất cả normal maps (leather + rubber)
 * @returns {Promise}
 */
export async function loadAllNormalMaps() {
  await Promise.all([loadLeatherNormal(), loadRubberNormal(), loadBumperLogo(), loadTopCapLogo()]);
  console.log("[Material] ✅ All normal maps loaded");
}

// =====================================================
// ===== TẠO CÁC TEXTURE MAP CHO DA =====
// =====================================================

/**
 * Tạo roughnessMap canvas - vùng da có roughness cao, vùng khác thấp
 */
export function createRoughnessMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Mặc định: roughness thấp (bóng) cho phần thân không bọc da
  const baseR = 3;
  ctx.fillStyle = `rgb(${baseR}, ${baseR}, ${baseR})`;
  ctx.fillRect(0, 0, width, height);

  // TÍNH TỌA ĐỘ THEO TỶ LỆ
  const leatherY = LEATHER_START_RATIO * height;
  const leatherHeight = (LEATHER_END_RATIO - LEATHER_START_RATIO) * height;
  const r = LEATHER_CONFIG.roughness;
  const feather = 2; // số pixel làm mềm mép trên/dưới vùng da (ít để viền sắc hơn)

  // --- VÙNG VIỀN BÓNG (BAND) GIỮA THÂN VÀ DA ---
  if (LEATHER_CONFIG.band && LEATHER_CONFIG.band.enabled) {
    const bandStartRatio = LEATHER_CONFIG.band.startPx / LEATHER_CONFIG.originalTextureHeight;
    const bandEndRatio = LEATHER_CONFIG.band.endPx / LEATHER_CONFIG.originalTextureHeight;
    const bandY = bandStartRatio * height;
    const bandHeight = (bandEndRatio - bandStartRatio) * height;
    const br = LEATHER_CONFIG.band.roughness;

    // Vùng viền chính
    ctx.fillStyle = `rgb(${br}, ${br}, ${br})`;
    ctx.fillRect(0, bandY, width, bandHeight);
  }

  // --- VÙNG DA: roughness cao (mờ) với mép feather nhẹ để tránh lem nhem ---

  // Phần chính của vùng da (bỏ ra 2 dải feather ở mép)
  ctx.fillStyle = `rgb(${r}, ${r}, ${r})`;
  ctx.fillRect(0, leatherY + feather, width, Math.max(0, leatherHeight - 2 * feather));

  // Mép trên: gradient từ thân/band -> da
  const topGrad = ctx.createLinearGradient(0, leatherY, 0, leatherY + feather);
  topGrad.addColorStop(0, `rgb(${baseR}, ${baseR}, ${baseR})`);
  topGrad.addColorStop(1, `rgb(${r}, ${r}, ${r})`);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, leatherY, width, feather);

  // Mép dưới: da -> thân/band
  const bottomGrad = ctx.createLinearGradient(0, leatherY + leatherHeight - feather, 0, leatherY + leatherHeight);
  bottomGrad.addColorStop(0, `rgb(${r}, ${r}, ${r})`);
  bottomGrad.addColorStop(1, `rgb(${baseR}, ${baseR}, ${baseR})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, leatherY + leatherHeight - feather, width, feather);

  return canvas;
}

/**
 * Tạo clearcoatMap canvas - vùng da có clearcoat thấp, vùng khác cao
 */
export function createClearcoatMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Mặc định: clearcoat cao cho phần thân (bóng hơn)
  const baseC = 255;
  ctx.fillStyle = `rgb(${baseC}, ${baseC}, ${baseC})`;
  ctx.fillRect(0, 0, width, height);

  // TÍNH TỌA ĐỘ THEO TỶ LỆ
  const leatherY = LEATHER_START_RATIO * height;
  const leatherHeight = (LEATHER_END_RATIO - LEATHER_START_RATIO) * height;
  const c = LEATHER_CONFIG.clearcoat;
  const feather = 2; // ít feather hơn để viền clearcoat sắc hơn

  // --- VÙNG VIỀN BÓNG (BAND) GIỮA THÂN VÀ DA ---
  if (LEATHER_CONFIG.band && LEATHER_CONFIG.band.enabled) {
    const bandStartRatio = LEATHER_CONFIG.band.startPx / LEATHER_CONFIG.originalTextureHeight;
    const bandEndRatio = LEATHER_CONFIG.band.endPx / LEATHER_CONFIG.originalTextureHeight;
    const bandY = bandStartRatio * height;
    const bandHeight = (bandEndRatio - bandStartRatio) * height;
    const bc = LEATHER_CONFIG.band.clearcoat;

    // Vùng viền chính
    ctx.fillStyle = `rgb(${bc}, ${bc}, ${bc})`;
    ctx.fillRect(0, bandY, width, bandHeight);
  }

  // --- VÙNG DA: clearcoat thấp với mép feather để tránh viền gắt ---

  // Phần chính vùng da
  ctx.fillStyle = `rgb(${c}, ${c}, ${c})`;
  ctx.fillRect(0, leatherY + feather, width, Math.max(0, leatherHeight - 2 * feather));

  // Mép trên: thân/band -> da
  const topGrad = ctx.createLinearGradient(0, leatherY, 0, leatherY + feather);
  topGrad.addColorStop(0, `rgb(${baseC}, ${baseC}, ${baseC})`);
  topGrad.addColorStop(1, `rgb(${c}, ${c}, ${c})`);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, leatherY, width, feather);

  // Mép dưới: da -> thân/band
  const bottomGrad = ctx.createLinearGradient(0, leatherY + leatherHeight - feather, 0, leatherY + leatherHeight);
  bottomGrad.addColorStop(0, `rgb(${c}, ${c}, ${c})`);
  bottomGrad.addColorStop(1, `rgb(${baseC}, ${baseC}, ${baseC})`);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, leatherY + leatherHeight - feather, width, feather);

  return canvas;
}

/**
 * Tạo sheenMap canvas - vùng da có sheen cao
 */
export function createSheenMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Mặc định: sheen thấp
  ctx.fillStyle = `rgb(77, 77, 77)`;
  ctx.fillRect(0, 0, width, height);

  // Vùng da: sheen cao
  const leatherY = LEATHER_START_RATIO * height;
  const leatherHeight = (LEATHER_END_RATIO - LEATHER_START_RATIO) * height;
  const s = LEATHER_CONFIG.sheen;
  ctx.fillStyle = `rgb(${s}, ${s}, ${s})`;
  ctx.fillRect(0, leatherY, width, leatherHeight);

  return canvas;
}

/**
 * Tạo normalMap canvas - vùng da dùng FILE leather normal map thật
 * With soft feathered edges for clean cut lines
 * Uses LEATHER_FRAME coordinates for consistency with roughness/clearcoat maps
 */
export function createNormalMap(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // IMPORTANT: Reset all canvas state to ensure no color contamination from other operations
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;

  // Mặc định: flat normal (neutral blue - RGB encodes surface normal direction)
  // Normal maps use RGB channels: R=X direction, G=Y direction, B=Z direction
  // Neutral/flat normal is (128, 128, 255) = pointing straight out (Z+)
  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, width, height);

  // Vùng da: dùng leather normal map FILE nếu đã load
  if (leatherNormalImage) {
    // Use LEATHER_FRAME coordinates with proper scaling (same as roughness/clearcoat maps)
    const scaleY = height / LEATHER_FRAME.surfaceHeight;
    const scaleX = width / LEATHER_FRAME.surfaceWidth;
    const leatherY = Math.floor(LEATHER_FRAME.y * scaleY);
    const leatherHeight = Math.floor(LEATHER_FRAME.height * scaleY);
    const leatherEndY = leatherY + leatherHeight;

    // Draw leather normal 1:1 to match leather-frame.jpg exactly (no tiling)
    // The normal map should be the same size as leather-frame.jpg (1141x3464)
    const drawWidth = width; // Full canvas width
    const drawHeight = leatherHeight; // Leather region height

    console.log("[NormalMap] Drawing 1:1 at region:", 0, leatherY, "size:", drawWidth, "x", drawHeight);

    // Create a temporary canvas for the leather normal texture
    // This canvas is ONLY for the normal map - no surface colors should be here
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");

    // Reset temp canvas state to ensure clean drawing
    tempCtx.globalAlpha = 1.0;
    tempCtx.globalCompositeOperation = "source-over";
    tempCtx.filter = "none";
    tempCtx.imageSmoothingEnabled = true;

    // Fill with flat normal first (neutral blue)
    tempCtx.fillStyle = "rgb(128, 128, 255)";
    tempCtx.fillRect(0, 0, width, height);

    // Draw leather normal map image - this MUST preserve original RGB values
    // The leather-normal.jpg contains RGB-encoded normal direction data
    // These colors should NEVER be affected by surface texture colors
    tempCtx.drawImage(leatherNormalImage, 0, leatherY, drawWidth, drawHeight);

    // Create mask with soft edges for clean cut line
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext("2d");

    // Feather size for soft transition (in pixels)
    const featherSize = 8;

    // Clear to fully transparent (alpha=0) - this will hide content outside leather region
    maskCtx.clearRect(0, 0, width, height);

    // Main leather region (full opacity with alpha=1)
    maskCtx.fillStyle = "rgba(255, 255, 255, 1)";
    maskCtx.fillRect(0, leatherY + featherSize, width, leatherHeight - featherSize * 2);

    // Top edge gradient (feathered alpha)
    const topGrad = maskCtx.createLinearGradient(0, leatherY, 0, leatherY + featherSize);
    topGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    topGrad.addColorStop(1, "rgba(255, 255, 255, 1)");
    maskCtx.fillStyle = topGrad;
    maskCtx.fillRect(0, leatherY, width, featherSize);

    // Bottom edge gradient (feathered alpha)
    const bottomGrad = maskCtx.createLinearGradient(0, leatherEndY - featherSize, 0, leatherEndY);
    bottomGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
    bottomGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    maskCtx.fillStyle = bottomGrad;
    maskCtx.fillRect(0, leatherEndY - featherSize, width, featherSize);

    // Apply mask using destination-in compositing
    // This keeps only the pixels where mask has alpha > 0
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(maskCanvas, 0, 0);
    
    // Reset composite operation before final draw
    tempCtx.globalCompositeOperation = "source-over";

    // Draw the masked leather normal onto main canvas
    // source-over: new content draws over existing content
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(tempCanvas, 0, 0);

    // DEBUG: Verify normal map colors are correct (should be blue-ish, not surface colors)
    // Sample a pixel from the leather region to confirm RGB values
    const sampleY = Math.floor(leatherY + leatherHeight / 2);
    const sampleX = Math.floor(width / 2);
    const sampleData = ctx.getImageData(sampleX, sampleY, 1, 1).data;
    console.log("[NormalMap] Verification sample at (" + sampleX + "," + sampleY + "):", 
      "R=" + sampleData[0] + " G=" + sampleData[1] + " B=" + sampleData[2],
      "(Normal maps should have blue-dominant colors, e.g. R~128, G~128, B>200)");

    console.log("[NormalMap] Applied leather normal with soft edges to region:", leatherY, "-", leatherEndY);
  } else {
    console.warn("[NormalMap] Leather normal file not loaded, using flat normal");
  }

  return canvas;
}

// =====================================================
// ===== TẠO LEATHER MATERIAL =====
// =====================================================

/**
 * Tạo tất cả texture maps cho leather material
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Object chứa các texture
 */
export function createLeatherTextureMaps(width, height) {
  const roughnessCanvas = createRoughnessMap(width, height);
  const roughnessTexture = new THREE.CanvasTexture(roughnessCanvas);
  roughnessTexture.flipY = false;
  roughnessTexture.needsUpdate = true;

  const clearcoatCanvas = createClearcoatMap(width, height);
  const clearcoatTexture = new THREE.CanvasTexture(clearcoatCanvas);
  clearcoatTexture.flipY = false;
  clearcoatTexture.needsUpdate = true;

  const normalCanvas = createNormalMap(width, height);
  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  normalTexture.flipY = false;
  normalTexture.needsUpdate = true;

  return {
    roughnessTexture,
    clearcoatTexture,
    normalTexture,
  };
}

/**
 * Tạo MeshPhysicalMaterial cho sản phẩm có da
 * @param {THREE.Texture} mapTexture - Texture chính (diffuse)
 * @param {THREE.Color} color - Màu base
 * @param {Object} textureMaps - Object từ createLeatherTextureMaps()
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createLeatherMaterial(mapTexture, color, textureMaps) {
  const { roughnessTexture, clearcoatTexture, normalTexture } = textureMaps;
  const cfg = LEATHER_CONFIG.nonLeather;

  return new THREE.MeshPhysicalMaterial({
    map: mapTexture,
    color: new THREE.Color(0xffffff), // Always white to show texture at true colors
    // Roughness và clearcoat được điều khiển bởi map
    roughness: 1.0,
    roughnessMap: roughnessTexture,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatMap: clearcoatTexture,
    clearcoatRoughness: cfg.clearcoatRoughness,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(LEATHER_CONFIG.normalScaleX, LEATHER_CONFIG.normalScaleY),
    // Phần không da: dùng cfg (bóng như kính), phần da: điều khiển bởi roughnessMap/clearcoatMap
    reflectivity: cfg.reflectivity, // Bóng như kính cho phần không da
    ior: cfg.ior,
    thickness: cfg.thickness,
    specularIntensity: cfg.specularIntensity, // Bóng như kính
    specularColor: new THREE.Color(0xffffff), // Trắng cho phần không da
    sheen: LEATHER_CONFIG.sheen / 255, // Sheen cho da
    sheenRoughness: 0.7, // Mờ cho da
    sheenColor: new THREE.Color(0x775533), // Màu ấm cho da
    envMap: null,
    envMapIntensity: 0,
    transparent: false,
  });
}

/**
 * Tạo MeshPhysicalMaterial cho sản phẩm KHÔNG có da (glass-like)
 * @param {THREE.Texture} mapTexture - Texture chính (diffuse)
 * @param {THREE.Color} color - Màu base
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createStandardMaterial(mapTexture, color) {
  const cfg = LEATHER_CONFIG.nonLeather;

  return new THREE.MeshPhysicalMaterial({
    map: mapTexture,
    color: new THREE.Color(0xffffff), // Always white to show texture at true colors
    roughness: cfg.roughness,
    metalness: 0.0,
    clearcoat: cfg.clearcoat,
    clearcoatRoughness: cfg.clearcoatRoughness,
    reflectivity: cfg.reflectivity,
    ior: cfg.ior,
    thickness: cfg.thickness,
    specularIntensity: cfg.specularIntensity,
    specularColor: new THREE.Color(0xffffff),
    sheen: 0.3,
    sheenRoughness: 0.2,
    sheenColor: new THREE.Color(0xffffff),
    envMap: null,
    envMapIntensity: 0,
    transparent: false,
  });
}

// =====================================================
// ===== RUBBER MATERIAL (CHO NÚT ĐÁY/BUMPER) =====
// =====================================================

/**
 * Kiểm tra xem material/mesh có phải là rubber (bumper) không
 * @param {string} materialName - Tên material
 * @param {string} meshName - Tên mesh (optional)
 * @returns {boolean}
 */
export function isRubberMaterial(materialName, meshName = "") {
  if (!RUBBER_CONFIG.enabled) return false;

  const nameLower = (materialName || "").toLowerCase();
  const meshLower = (meshName || "").toLowerCase();

  return RUBBER_CONFIG.materialNames.some((keyword) => {
    const keyLower = keyword.toLowerCase();
    return nameLower.includes(keyLower) || meshLower.includes(keyLower);
  });
}

/**
 * Load rubber normal map - KHÔNG CẦN NỮA vì dùng procedural
 * Giữ lại để không break loadAllNormalMaps
 */
export function loadRubberNormal() {
  console.log("[Rubber] Using procedural grain texture (no file needed)");
  return Promise.resolve(null);
}

/**
 * Tạo rubber grain normal texture (texture sần cho cao su) - PROCEDURAL
 * Tạo hạt sần dày đặc như cao su thật
 */
export function createRubberNormalTexture(width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // ===== Height map pebble grain =====
  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = width;
  heightCanvas.height = height;
  const hctx = heightCanvas.getContext("2d");
  hctx.fillStyle = "rgb(0,0,0)";
  hctx.fillRect(0, 0, width, height);
  hctx.globalCompositeOperation = "lighter";

  // Layer 1: hạt rất nhỏ, dày đặc
  const tinyCount = Math.round(width * height * 0.027); // giảm mật độ thêm một chút
  for (let i = 0; i < tinyCount; i++) {
    const r = 0.6 + Math.random() * 1.0;
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = 0.14 + Math.random() * 0.1; // hạt nhỏ mịn hơn, ít sáng
    // plateau + rim để mô phỏng hạt lồi có viền hơi gắt
    const grad = hctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0.0, `rgba(255,255,255,${alpha * 0.7})`); // lõi
    grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.75})`); // plateau
    grad.addColorStop(0.92, `rgba(255,255,255,${alpha})`); // rim
    grad.addColorStop(1.0, "rgba(255,255,255,0)");
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(x, y, r, 0, Math.PI * 2);
    hctx.fill();
  }

  // Layer 2: hạt trung bình
  const midCount = Math.round(width * height * 0.0092); // giảm mật độ thêm chút
  for (let i = 0; i < midCount; i++) {
    const r = 1.2 + Math.random() * 2.0;
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = 0.18 + Math.random() * 0.14; // mờ hơn để đốm trắng mịn
    const grad = hctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0.0, `rgba(255,255,255,${alpha * 0.7})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.8})`);
    grad.addColorStop(0.92, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1.0, "rgba(255,255,255,0)");
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(x, y, r, 0, Math.PI * 2);
    hctx.fill();
  }

  // Layer 3: một ít hạt lớn
  const bigCount = Math.round(width * height * 0.00085);
  for (let i = 0; i < bigCount; i++) {
    const r = 2.2 + Math.random() * 3.0;
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = 0.16 + Math.random() * 0.12; // hạt lớn cũng mờ hơn
    const grad = hctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0.0, `rgba(255,255,255,${alpha * 0.7})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.85})`);
    grad.addColorStop(0.92, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1.0, "rgba(255,255,255,0)");
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(x, y, r, 0, Math.PI * 2);
    hctx.fill();
  }

  // Lấy height (grayscale) rồi blur nhẹ
  const heightData = hctx.getImageData(0, 0, width, height);
  const hd = heightData.data;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y * width + x] = hd[idx] / 255; // kênh R
    }
  }

  const blurOnce = (src) => {
    const out = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            sum += src[(y + oy) * width + (x + ox)];
          }
        }
        out[y * width + x] = sum / 9;
      }
    }
    return out;
  };
  const blurred = blurOnce(gray); // để viền rim rõ hơn (bề mặt cao su cứng có đỉnh sắc nhẹ)

  // Convert height -> normal bằng gradient
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const strength = 24; // tăng nhẹ lại để viền hạt tạo highlight đúng cảm giác lồi
  const clamp255 = (v) => Math.max(0, Math.min(255, v));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const hL = blurred[y * width + (x - 1)];
      const hR = blurred[y * width + (x + 1)];
      const hU = blurred[(y - 1) * width + x];
      const hD = blurred[(y + 1) * width + x];
      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;
      const nx = dx,
        ny = dy,
        nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const nxf = nx / len,
        nyf = ny / len,
        nzf = nz / len;

      const i = (y * width + x) * 4;
      // Áp biên độ chuẩn để phản ánh hạt lồi (nhưng vẫn nhân theo normalScale)
      const ampX = 127;
      const ampY = 127;
      data[i] = clamp255(128 + nxf * ampX * RUBBER_CONFIG.normalScaleX);
      data[i + 1] = clamp255(128 + nyf * ampY * RUBBER_CONFIG.normalScaleY);
      data[i + 2] = clamp255(nzf * 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // EMBOSS LOGO vào normal map nếu có
  if (bumperLogoImage && RUBBER_CONFIG.logo.enabled && RUBBER_CONFIG.logo.emboss) {
    const logoScale = RUBBER_CONFIG.logo.scale;
    const logoW = width * logoScale;
    const logoH = (bumperLogoImage.height / bumperLogoImage.width) * logoW;
    const offsetX = (RUBBER_CONFIG.logo.offsetX || 0) * width;
    const offsetY = (RUBBER_CONFIG.logo.offsetY || 0) * height;
    const logoX = (width - logoW) / 2 + offsetX;
    const logoY = (height - logoH) / 2 + offsetY;
    const embossDepth = RUBBER_CONFIG.logo.embossDepth || 40;

    // Vẽ logo lên canvas tạm để lấy alpha (có flip)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");

    if (RUBBER_CONFIG.logo.flipX || RUBBER_CONFIG.logo.flipY) {
      tempCtx.save();
      tempCtx.translate(logoX + logoW / 2, logoY + logoH / 2);
      tempCtx.scale(RUBBER_CONFIG.logo.flipX ? -1 : 1, RUBBER_CONFIG.logo.flipY ? -1 : 1);
      tempCtx.drawImage(bumperLogoImage, -logoW / 2, -logoH / 2, logoW, logoH);
      tempCtx.restore();
    } else {
      tempCtx.drawImage(bumperLogoImage, logoX, logoY, logoW, logoH);
    }

    const logoData = tempCtx.getImageData(0, 0, width, height).data;

    // Lấy lại imageData của normal map
    const normalData = ctx.getImageData(0, 0, width, height);
    const nData = normalData.data;

    // Emboss: thay đổi normal dựa trên alpha của logo
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const alpha = logoData[i + 3] / 255; // 0-1

        if (alpha > 0.1) {
          // Tính gradient để tạo hiệu ứng khắc chìm
          const leftAlpha = logoData[(y * width + (x - 1)) * 4 + 3] / 255;
          const rightAlpha = logoData[(y * width + (x + 1)) * 4 + 3] / 255;
          const topAlpha = logoData[((y - 1) * width + x) * 4 + 3] / 255;
          const bottomAlpha = logoData[((y + 1) * width + x) * 4 + 3] / 255;

          const gradX = (rightAlpha - leftAlpha) * embossDepth;
          const gradY = (bottomAlpha - topAlpha) * embossDepth;

          // Blend với normal hiện tại
          nData[i] = Math.max(0, Math.min(255, nData[i] + gradX));
          nData[i + 1] = Math.max(0, Math.min(255, nData[i + 1] + gradY));
        }
      }
    }

    ctx.putImageData(normalData, 0, 0);
    console.log("[Rubber] Embossed logo into normal map, depth:", embossDepth);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  console.log("[Rubber] Created procedural grain normal texture (dense)");
  return texture;
}

/**
 * Load logo image cho bumper
 */
let bumperLogoImage = null;
let bumperLogoPromise = null;

export function loadBumperLogo() {
  if (!RUBBER_CONFIG.logo.enabled) return Promise.resolve(null);
  if (bumperLogoPromise) return bumperLogoPromise;

  const logoPath = RUBBER_CONFIG.logo.path + "?v=" + Date.now();

  bumperLogoPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bumperLogoImage = img;
      console.log("[Rubber] ✅ Bumper logo loaded:", img.width, "x", img.height);
      resolve(img);
    };
    img.onerror = () => {
      console.warn("[Rubber] ⚠️ Bumper logo not found");
      resolve(null);
    };
    img.src = logoPath;
  });

  return bumperLogoPromise;
}

/**
 * Tạo diffuse texture cho rubber với logo (nếu có)
 */
export function createRubberDiffuseWithLogo(width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Nền đen cao su
  ctx.fillStyle = RUBBER_CONFIG.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // =====================================================
  // HẠT SẦN NHẸ PROCEDURAL (KHÔNG DÙNG ẢNH)
  // =====================================================
  // Ý tưởng: vẽ một lớp noise rất nhẹ lên diffuse để gợi cảm giác da cao su
  // không đều tuyệt đối, nhưng không "nổ cao su" như normal map mạnh.
  const grainIntensity = 0.2; // biên độ thay đổi độ sáng (0-1) – giữ rất nhỏ
  const grainDensity = 0.8; // xác suất vẽ một hạt ở mỗi bước
  const step = 1; // khoảng cách điểm (pixel) – càng nhỏ hạt càng dày
  const baseColor = new THREE.Color(RUBBER_CONFIG.backgroundColor || "#2a2a2a");

  const baseR = Math.floor(baseColor.r * 255);
  const baseG = Math.floor(baseColor.g * 255);
  const baseB = Math.floor(baseColor.b * 255);

  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (Math.random() > grainDensity) continue;
      const idx = (y * width + x) * 4;
      // random ±grainIntensity quanh màu gốc
      const delta = (Math.random() * 2 - 1) * grainIntensity;
      const factor = 1 + delta;
      d[idx] = Math.max(0, Math.min(255, baseR * factor));
      d[idx + 1] = Math.max(0, Math.min(255, baseG * factor));
      d[idx + 2] = Math.max(0, Math.min(255, baseB * factor));
      // alpha giữ nguyên
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Vẽ logo nếu có
  if (bumperLogoImage && RUBBER_CONFIG.logo.enabled) {
    const logoScale = RUBBER_CONFIG.logo.scale;
    const logoW = width * logoScale;
    const logoH = (bumperLogoImage.height / bumperLogoImage.width) * logoW;
    const offsetX = (RUBBER_CONFIG.logo.offsetX || 0) * width;
    const offsetY = (RUBBER_CONFIG.logo.offsetY || 0) * height;
    const logoX = (width - logoW) / 2 + offsetX;
    const logoY = (height - logoH) / 2 + offsetY;

    // Tạo canvas tạm để đổi màu logo sang màu laser
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = bumperLogoImage.width;
    colorCanvas.height = bumperLogoImage.height;
    const colorCtx = colorCanvas.getContext("2d");
    colorCtx.drawImage(bumperLogoImage, 0, 0);

    const logoColor = RUBBER_CONFIG.logo.color || "#cfd3d6";
    const col = new THREE.Color(logoColor);
    const imgData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      if (a > 0) {
        data[i] = Math.floor(col.r * 255);
        data[i + 1] = Math.floor(col.g * 255);
        data[i + 2] = Math.floor(col.b * 255);
        data[i + 3] = 255;
      }
    }
    colorCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.globalAlpha = RUBBER_CONFIG.logo.opacity;
    ctx.globalCompositeOperation = "screen"; // làm sáng nền cao su một chút
    // Áp dụng flip/rotate nếu cần
    const rot = ((RUBBER_CONFIG.logo.rotateDeg || 0) * Math.PI) / 180;
    ctx.translate(logoX + logoW / 2, logoY + logoH / 2);
    ctx.rotate(rot);
    ctx.scale(RUBBER_CONFIG.logo.flipX ? -1 : 1, RUBBER_CONFIG.logo.flipY ? -1 : 1);
    ctx.drawImage(colorCanvas, -logoW / 2, -logoH / 2, logoW, logoH);
    ctx.restore();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Tạo MeshPhysicalMaterial cho phần cao su (bumper/nút đáy)
 * @param {THREE.Texture} mapTexture - Texture chính (diffuse) - SẼ BỊ THAY THẾ
 * @param {THREE.Color} color - Màu base (không dùng)
 * @param {number} width - Canvas width for textures
 * @param {number} height - Canvas height for textures
 * @param {boolean} isLogoMaterial - Có phải material logo không
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createRubberMaterial(mapTexture, color, width = 1024, height = 1024, isLogoMaterial = false) {
  // Tạo texture mới với nền đen
  const finalMapTexture = createRubberDiffuseWithLogo(width, height);
  console.log("[Rubber] Created new black rubber texture, isLogo:", isLogoMaterial);

  const mat = new THREE.MeshPhysicalMaterial({
    map: finalMapTexture,
    color: new THREE.Color("#2a2a2a"),
    roughness: RUBBER_CONFIG.roughness,
    metalness: RUBBER_CONFIG.metalness,
    clearcoat: RUBBER_CONFIG.clearcoat,
    clearcoatRoughness: 0.94, // giảm nhẹ để cho highlight viền hạt xuất hiện tự nhiên
    reflectivity: RUBBER_CONFIG.reflectivity,
    ior: 1.45,
    specularIntensity: 0.19, // tăng nhẹ để mô phỏng cao su cứng có highlight nhỏ
    specularColor: new THREE.Color(0x2a2a2a),
    sheen: 0.0,
    sheenRoughness: 1.0,
    sheenColor: new THREE.Color(0x222222),
    envMap: null,
    envMapIntensity: 0,
    transparent: false,
  });

  console.log("[Rubber] Created rubber material (black, no image-based grain)");
  return mat;
}

// =====================================================
// ===== TOP CAP MATERIAL (CHO NẮP ĐẬY REN TRÊN CÙNG) =====
// =====================================================

/**
 * Kiểm tra xem material/mesh có phải là top cap không
 * @param {string} materialName - Tên material
 * @param {string} meshName - Tên mesh (optional)
 * @returns {boolean}
 */
export function isTopCapMaterial(materialName, meshName = "") {
  if (!TOP_CAP_CONFIG.enabled) return false;

  const nameLower = (materialName || "").toLowerCase();
  const meshLower = (meshName || "").toLowerCase();

  return TOP_CAP_CONFIG.materialNames.some((keyword) => {
    const keyLower = keyword.toLowerCase();
    return nameLower.includes(keyLower) || meshLower.includes(keyLower);
  });
}

/**
 * Load logo image cho top cap
 */
let topCapLogoImage = null;
let topCapLogoPromise = null;

export function loadTopCapLogo() {
  if (!TOP_CAP_CONFIG.logo.enabled) return Promise.resolve(null);
  if (topCapLogoPromise) return topCapLogoPromise;

  const logoPath = TOP_CAP_CONFIG.logo.path + "?v=" + Date.now();

  topCapLogoPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      topCapLogoImage = img;
      console.log("[TopCap] ✅ Logo loaded:", img.width, "x", img.height);
      resolve(img);
    };
    img.onerror = () => {
      console.warn("[TopCap] ⚠️ Logo not found");
      resolve(null);
    };
    img.src = logoPath;
  });

  return topCapLogoPromise;
}

/**
 * Tạo texture với logo cho top cap (giữ nguyên texture gốc, chỉ thêm logo)
 */
export function createTopCapTextureWithLogo(originalTexture, width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Vẽ texture gốc lên canvas
  if (originalTexture && originalTexture.image) {
    ctx.drawImage(originalTexture.image, 0, 0, width, height);
  } else {
    // Nền trắng nếu không có texture
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  // Vẽ logo nếu có - CHỈ VẼ Ở GIỮA (mặt trên nắp)
  if (topCapLogoImage && TOP_CAP_CONFIG.logo.enabled) {
    const logoScale = TOP_CAP_CONFIG.logo.scale;
    const logoW = width * logoScale;
    const logoH = (topCapLogoImage.height / topCapLogoImage.width) * logoW;
    // Tính vị trí logo - CHỈ Ở MẶT PHẲNG TRÊN CÙNG (flat top surface)
    const centerX = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerX || 0.5) * width;
    const centerY = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerY || 0.5) * height; // Dùng giá trị từ config
    const offsetX = (TOP_CAP_CONFIG.logo.offsetX || 0) * width;
    const offsetY = (TOP_CAP_CONFIG.logo.offsetY || 0) * height;
    const logoX = centerX - logoW / 2 + offsetX;
    const logoY = centerY - logoH / 2 + offsetY;

    console.log(`[TopCap] Logo loaded: ${topCapLogoImage.width}x${topCapLogoImage.height}`);
    console.log(`[TopCap] Logo position: centerX=${centerX}, centerY=${centerY}, logoX=${logoX}, logoY=${logoY}, logoW=${logoW}, logoH=${logoH}`);

    // Tính vùng mặt trên (nếu cần)
    const radius = TOP_CAP_CONFIG.logo.topSurfaceOnly && TOP_CAP_CONFIG.logo.topSurfaceUV ? (TOP_CAP_CONFIG.logo.topSurfaceUV.radius || 0.2) * Math.min(width, height) : null;

    console.log(`[TopCap] topSurfaceOnly=${TOP_CAP_CONFIG.logo.topSurfaceOnly}, radius=${radius}`);

    // Vẽ logo - ĐỔ MÀU VÀNG KHẮC và đảm bảo vẽ SAU texture gốc
    ctx.save();

    // Nếu chỉ vẽ trên mặt trên, clip vào vùng tròn
    if (radius !== null && TOP_CAP_CONFIG.logo.topSurfaceOnly) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
    }

    // Làm dịu các vệt tối bằng lớp sáng rất nhẹ theo radial với blend 'screen' (không đổi material)
    if (radius !== null && TOP_CAP_CONFIG.logo.topSurfaceOnly) {
      const lightenAlpha = TOP_CAP_CONFIG.logo.lightenAlpha ?? 0.06; // cực nhẹ để không thấy viền
      const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.05, centerX, centerY, radius * 0.95);
      grad.addColorStop(0, `rgba(255,255,255,${lightenAlpha})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // Đổi màu logo sang vàng khắc TRƯỚC KHI VẼ
    const logoColor = TOP_CAP_CONFIG.logo.logoColor || "#ffd700";
    const color = new THREE.Color(logoColor);

    // Tạo canvas tạm để đổi màu logo
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = topCapLogoImage.width;
    colorCanvas.height = topCapLogoImage.height;
    const colorCtx = colorCanvas.getContext("2d");
    colorCtx.drawImage(topCapLogoImage, 0, 0);

    // Đổi màu logo sang vàng khắc
    const imageData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      if (alpha > 0) {
        // Đổi màu vàng khắc
        data[i] = Math.floor(color.r * 255); // R
        data[i + 1] = Math.floor(color.g * 255); // G
        data[i + 2] = Math.floor(color.b * 255); // B
        // Giữ alpha để logo rõ
        data[i + 3] = 255; // Alpha đầy đủ
      }
    }
    colorCtx.putImageData(imageData, 0, 0);

    // Vẽ logo SAU texture gốc - dùng composite operation để logo nổi bật
    ctx.globalAlpha = TOP_CAP_CONFIG.logo.opacity || 1.0;
    // Dùng 'screen' để logo không làm tối nền và dịu vệt tối dưới
    ctx.globalCompositeOperation = "screen";

    // Áp dụng flip nếu cần
    if (TOP_CAP_CONFIG.logo.flipX || TOP_CAP_CONFIG.logo.flipY) {
      ctx.translate(logoX + logoW / 2, logoY + logoH / 2);
      ctx.scale(TOP_CAP_CONFIG.logo.flipX ? -1 : 1, TOP_CAP_CONFIG.logo.flipY ? -1 : 1);
      ctx.drawImage(colorCanvas, -logoW / 2, -logoH / 2, logoW, logoH);
    } else {
      ctx.drawImage(colorCanvas, logoX, logoY, logoW, logoH);
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";

    console.log("[TopCap] Logo drawn on TOP SURFACE ONLY:", logoX, logoY, logoW, logoH, "radius:", radius);
  } else {
    console.warn("[TopCap] Logo not drawn - enabled:", TOP_CAP_CONFIG.logo.enabled, "image:", !!topCapLogoImage);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Tạo roughnessMap cho top cap: nền nhựa mờ, vùng logo mờ hơn nhẹ
 * RoughnessMap dùng kênh R (0-255) – giá trị cao = mờ hơn.
 */
// (removed legacy createTopCapRoughnessMapWithLogo without uvRect)

/**
 * Tạo normal map với emboss logo cho top cap
 */
export function createTopCapNormalWithLogo(width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Nền normal map neutral (flat)
  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, width, height);

  // EMBOSS LOGO vào normal map nếu có - CHỈ Ở GIỮA (mặt trên)
  if (topCapLogoImage && TOP_CAP_CONFIG.logo.enabled && TOP_CAP_CONFIG.logo.emboss) {
    const logoScale = TOP_CAP_CONFIG.logo.scale;
    const logoW = width * logoScale;
    const logoH = (topCapLogoImage.height / topCapLogoImage.width) * logoW;

    // Tính vị trí logo - CHỈ Ở MẶT PHẲNG TRÊN CÙNG (flat top surface)
    const centerX = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerX || 0.5) * width;
    const centerY = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerY || 0.1) * height; // Mặc định 10% từ trên
    const offsetX = (TOP_CAP_CONFIG.logo.offsetX || 0) * width;
    const offsetY = (TOP_CAP_CONFIG.logo.offsetY || 0) * height;
    const logoX = centerX - logoW / 2 + offsetX;
    const logoY = centerY - logoH / 2 + offsetY;
    const embossDepth = TOP_CAP_CONFIG.logo.embossDepth || 40;

    // Vẽ logo lên canvas tạm để lấy alpha (có flip)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");

    if (TOP_CAP_CONFIG.logo.flipX || TOP_CAP_CONFIG.logo.flipY) {
      tempCtx.save();
      tempCtx.translate(logoX + logoW / 2, logoY + logoH / 2);
      tempCtx.scale(TOP_CAP_CONFIG.logo.flipX ? -1 : 1, TOP_CAP_CONFIG.logo.flipY ? -1 : 1);
      tempCtx.drawImage(topCapLogoImage, -logoW / 2, -logoH / 2, logoW, logoH);
      tempCtx.restore();
    } else {
      tempCtx.drawImage(topCapLogoImage, logoX, logoY, logoW, logoH);
    }

    const logoData = tempCtx.getImageData(0, 0, width, height).data;

    // Lấy lại imageData của normal map
    const normalData = ctx.getImageData(0, 0, width, height);
    const nData = normalData.data;

    // Emboss: thay đổi normal dựa trên alpha của logo - CHỈ Ở VÙNG MẶT PHẲNG TRÊN
    // Dùng lại centerX, centerY đã tính ở trên
    const radius = (TOP_CAP_CONFIG.logo.topSurfaceUV?.radius || 0.08) * Math.min(width, height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // CHỈ emboss trong vùng tròn ở giữa (mặt trên)
        if (TOP_CAP_CONFIG.logo.topSurfaceOnly) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue; // Bỏ qua nếu ngoài vùng mặt trên
        }

        const i = (y * width + x) * 4;
        const alpha = logoData[i + 3] / 255; // 0-1

        if (alpha > 0.1) {
          // Tính gradient để tạo hiệu ứng khắc chìm
          const leftAlpha = logoData[(y * width + (x - 1)) * 4 + 3] / 255;
          const rightAlpha = logoData[(y * width + (x + 1)) * 4 + 3] / 255;
          const topAlpha = logoData[((y - 1) * width + x) * 4 + 3] / 255;
          const bottomAlpha = logoData[((y + 1) * width + x) * 4 + 3] / 255;

          const gradX = (rightAlpha - leftAlpha) * embossDepth;
          const gradY = (bottomAlpha - topAlpha) * embossDepth;

          // Blend với normal hiện tại
          nData[i] = Math.max(0, Math.min(255, nData[i] + gradX));
          nData[i + 1] = Math.max(0, Math.min(255, nData[i + 1] + gradY));
        }
      }
    }

    ctx.putImageData(normalData, 0, 0);
    console.log("[TopCap] Embossed logo into normal map (TOP SURFACE ONLY), depth:", embossDepth);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * RoughnessMap cho top-cap mờ với vùng logo mờ hơn – hỗ trợ uvRect để chỉ đúng mặt trên
 */
export function createTopCapRoughnessMapWithLogo(width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const baseRough = 150; // nền nhựa mờ vừa
  ctx.fillStyle = `rgb(${baseRough}, ${baseRough}, ${baseRough})`;
  ctx.fillRect(0, 0, width, height);

  if (topCapLogoImage && TOP_CAP_CONFIG.logo.enabled) {
    const logoScale = TOP_CAP_CONFIG.logo.scale;
    const logoW = width * logoScale;
    const logoH = (topCapLogoImage.height / topCapLogoImage.width) * logoW;
    const centerX = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerX || 0.5) * width;
    const centerY = (TOP_CAP_CONFIG.logo.topSurfaceUV?.centerY || 0.5) * height;
    const offsetX = (TOP_CAP_CONFIG.logo.offsetX || 0) * width;
    const offsetY = (TOP_CAP_CONFIG.logo.offsetY || 0) * height;
    const logoX = centerX - logoW / 2 + offsetX;
    const logoY = centerY - logoH / 2 + offsetY;

    // Vẽ alpha logo lên canvas tạm để làm vùng mờ hơn
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tctx = tempCanvas.getContext("2d");
    if (TOP_CAP_CONFIG.logo.flipX || TOP_CAP_CONFIG.logo.flipY) {
      tctx.save();
      tctx.translate(logoX + logoW / 2, logoY + logoH / 2);
      tctx.scale(TOP_CAP_CONFIG.logo.flipX ? -1 : 1, TOP_CAP_CONFIG.logo.flipY ? -1 : 1);
      tctx.drawImage(topCapLogoImage, -logoW / 2, -logoH / 2, logoW, logoH);
      tctx.restore();
    } else {
      tctx.drawImage(topCapLogoImage, logoX, logoY, logoW, logoH);
    }

    const logoData = tctx.getImageData(0, 0, width, height).data;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const logoRough = 200; // mờ hơn nền

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = logoData[i + 3] / 255;
        if (alpha > 0.05) {
          data[i] = logoRough;
          data[i + 1] = logoRough;
          data[i + 2] = logoRough;
          data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}
