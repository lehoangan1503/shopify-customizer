/**
 * =====================================================
 * LEATHER & RUBBER CONFIGURATION
 * =====================================================
 * File cấu hình cho chất liệu da và cao su
 * Chỉnh sửa file này để thay đổi texture, vị trí, độ nổi...
 */

// =====================================================
// ===== 10 LEATHER PRESETS - TEST WHICH LOOKS BEST =====
// =====================================================
// Change ACTIVE_LEATHER_PRESET to test different configs (1-10)
export const ACTIVE_LEATHER_PRESET = 1;

export const LEATHER_PRESETS = {
  // Config 1: Deep Crocodile - Strong bump, large scales
  1: {
    name: "Deep Crocodile",
    normalScaleX: 1,
    normalScaleY: 3.5,
    normalStrength: 3.0,
    textureScaleX: 0.6, // Bigger scales (was 0.6)
    textureScaleY: 0.6, // Bigger scales (was 0.6)
    roughness: 245,
    clearcoat: 5,
    sheen: 80,
  },
};

// Get active preset
const activePreset = LEATHER_PRESETS[ACTIVE_LEATHER_PRESET] || LEATHER_PRESETS[1];
console.log(`[LeatherConfig] Using preset ${ACTIVE_LEATHER_PRESET}: ${activePreset.name}`);

// =====================================================
// ===== CẤU HÌNH MODEL 3D =====
// =====================================================
export const MODEL_CONFIG = {
  // File GLB cho sản phẩm có da (đặt trong public/)
  // Các file có sẵn: cue-butt-leather.glb, cue_2.glb, cue-butt3.glb,
  //                  cue-butt1.glb, cue-butt_ok.glb, cue-butt-smooth.glb
  glbPath: "./cue-butt-leather.glb",

  // Fallback nếu không tìm thấy file
  fallbackGlbPath: "./cue-butt.glb",
  fallbackSurfacePath: "./surface.jpg",
};

// =====================================================
// ===== SURFACE TYPES =====
// =====================================================
export const SURFACE_TYPES = {
  leather: { name: "Leather", path: "./surface/leather-surface/surface-leather.jpg" },
  leather1: { name: "Leather 1", path: "./surface/leather-surface/surface-leather1.jpg" },
  leather6: { name: "Leather 6", path: "./surface/leather-surface/surface-leather6.jpg" },
  leather9: { name: "Leather 9", path: "./surface/leather-surface/surface-leather9.jpg" },
};

// Active surface selection
export let activeSurface = "leather6";

/**
 * Get current surface path based on activeSurface
 * @returns {string}
 */
export function getActiveSurfacePath() {
  return SURFACE_TYPES[activeSurface]?.path || SURFACE_TYPES.leather6.path;
}

/**
 * Set active surface
 * @param {string} key - Surface key from SURFACE_TYPES
 */
export function setActiveSurface(key) {
  if (SURFACE_TYPES[key]) {
    activeSurface = key;
  }
}

// =====================================================
// ===== LEATHER TEXTURE TYPES =====
// =====================================================
export const LEATHER_TEXTURE_TYPES = {
  type1: {
    name: "Crocodile",
    path: "./leathers/type1/leather-texture.webp",
  },
  type2: {
    name: "Snake",
    path: "./leathers/type2/leather-texture.webp",
  },
};

// =====================================================
// ===== LEATHER COLOR PALETTES =====
// =====================================================
export const LEATHER_COLOR_PALETTES = {
  chestnut: { name: "Chestnut", hex: "#954535" },
  chocolate: { name: "Chocolate", hex: "#3D1C02" },
  darkBrown: { name: "Dark Brown", hex: "#2C1608" },
  whiskey: { name: "Whiskey", hex: "#B5651D" },
  tan: { name: "Tan", hex: "#D2B48C" },
  black: { name: "Black", hex: "#1A1A1A" },
};

// =====================================================
// ===== CẤU HÌNH VÙNG BỌC DA (LEATHER) =====
// =====================================================
export const LEATHER_CONFIG = {
  // --- LEATHER COLOR ---
  // Use hex color from LEATHER_COLOR_PALETTES instead of image path
  // Set activeColor key: "chestnut", "chocolate", "darkBrown", "whiskey", "tan", "black"
  activeColor: "black",

  // --- LEATHER TEXTURE TYPE ---
  // Set activeTexture key: "type1" or "type2"
  activeTexture: "type1",

  // --- NORMAL MAP (texture vân da) ---
  // Dynamically resolved from activeTexture
  get normalPath() {
    return LEATHER_TEXTURE_TYPES[this.activeTexture]?.path || LEATHER_TEXTURE_TYPES.type1.path;
  },

  // --- COMPUTED: Get active color hex ---
  get leatherColorHex() {
    return LEATHER_COLOR_PALETTES[this.activeColor]?.hex || LEATHER_COLOR_PALETTES.black.hex;
  },
  normalScaleX: activePreset.normalScaleX, // From preset
  normalScaleY: activePreset.normalScaleY, // From preset
  normalStrength: activePreset.normalStrength, // From preset

  // --- KÍCH THƯỚC VÂN DA ---
  // Not used when 1:1 mapping - kept for compatibility
  textureScaleX: activePreset.textureScaleX, // From preset
  textureScaleY: activePreset.textureScaleY, // From preset

  // --- CHẤT LIỆU DA ---
  roughness: activePreset.roughness, // From preset (0-255)
  clearcoat: activePreset.clearcoat, // From preset (0-255)
  sheen: activePreset.sheen, // From preset (0-255)

  // --- CHẤT LIỆU VÙNG KHÔNG DA (phần còn lại - bóng như thủy tinh) ---
  nonLeather: {
    roughness: 0.01, // Siêu bóng như kính
    clearcoat: 1.0,
    clearcoatRoughness: 0.005,
    reflectivity: 1.0,
    ior: 1.52,
    thickness: 1.5,
    specularIntensity: 1.2,
  },
};

// =====================================================
// ===== CẤU HÌNH PHẦN ĐÁY CAO SU (RUBBER BUMPER) =====
// =====================================================
export const RUBBER_CONFIG = {
  // --- BẬT/TẮT ---
  enabled: true,

  // --- MATERIAL/MESH NAMES để detect nút đáy ---
  // Code sẽ tìm mesh/material có tên chứa các từ này
  materialNames: [
    "bottom",
    "bumper",
    "cap",
    "rubber",
    "butt_cap",
    "end_cap",
    "logo",
    "badge",
    "emblem",
    "decal",
    "label",
    "sticker",
    "pad",
    "foot",
    "base",
    "end",
    "tip",
    "butt",
    // Tên cụ thể từ model
    "Cylinder005",
    "Material.003",
  ],

  // --- NORMAL MAP (texture hạt sần) ---
  normalPath: "./rubber-grain-normal.jpg",
  normalScaleX: 0.78, // Giảm thêm lần nữa để hạt mỏng rõ rệt
  normalScaleY: 0.78, // Giảm thêm để bề mặt dịu hơn

  // --- KÍCH THƯỚC HẠT SẦN ---
  textureScaleX: 0.15, // Scale hạt theo X (càng nhỏ = hạt càng nhỏ)
  textureScaleY: 0.15, // Scale hạt theo Y

  // --- MÀU NỀN CAO SU ---
  backgroundColor: "#2a2a2a", // Xám đậm tự nhiên giống ảnh chụp

  // --- CHẤT LIỆU CAO SU ---
  roughness: 0.94, // Mờ hơn thêm một chút
  clearcoat: 0.01, // Clearcoat rất thấp (gần như không)
  metalness: 0,
  reflectivity: 0.025,

  // --- LOGO TRÊN NÚT ĐÁY ---
  logo: {
    enabled: true, // BẬT logo laser ở nút đáy như ảnh tham chiếu
    path: "./logo.png", // Đường dẫn đến logo (PNG, nền trong suốt, đặt trong public/)
    scale: 0.42, // Kích thước lớn gần giống ảnh chụp
    opacity: 1.0, // Độ đậm logo khắc
    offsetX: 0.25, // Đặt ở giữa
    offsetY: 0.25, // Đặt ở giữa
    flipX: false, // Lật ngang (false = cùng chiều với logo trên thân)
    flipY: true, // Lật dọc để hướng logo đúng khi nhìn từ dưới lên
    rotateDeg: 0, // Xoay logo nếu cần (0-360)
    color: "#cfd3d6", // Màu khắc laser: xám nhạt
    emboss: false, // Khắc phẳng
    embossDepth: 0, // Không dùng
  },
};

// =====================================================
// ===== CẤU HÌNH NẮP ĐẬY REN TRÊN CÙNG (TOP CAP) =====
// =====================================================
export const TOP_CAP_CONFIG = {
  // --- BẬT/TẮT ---
  enabled: true,

  // --- MATERIAL/MESH NAMES để detect nắp đậy ren trên cùng ---
  // Code sẽ tìm mesh/material có tên chứa các từ này
  materialNames: [
    "top",
    "cap",
    "thread",
    "screw",
    "thread_cap",
    "top_cap",
    "ferrule",
    "tip",
    "joint",
    "connector",
    "adapter",
    // Tên cụ thể từ model (cần kiểm tra trong console)
  ],

  // --- LOGO TRÊN NẮP ĐẬY REN ---
  logo: {
    enabled: true, // Bật/tắt custom logo
    path: "./logo.png", // Đường dẫn đến logo (PNG, nền trong suốt, đặt trong public/)
    scale: 0.5, // Kích thước logo (nhỉnh hơn một chút để giống ảnh chụp)
    opacity: 1.0, // Độ đậm màu logo (1.0 = đậm nhất)
    offsetX: -0.25, // Đặt logo ở tâm mặt trên
    offsetY: 0.25, // Đặt logo ở tâm mặt trên
    flipX: false, // Lật ngang
    flipY: false, // Lật dọc
    emboss: false, // TẮT emboss - logo phẳng như khắc laser, không chìm
    embossDepth: 0, // Không emboss
    // Chỉ vẽ logo ở giữa texture (mặt trên nắp), không vẽ trên thân
    topSurfaceOnly: true, // CHỈ vẽ trên mặt phẳng trên cùng
    topSurfaceUV: {
      // Vùng UV của mặt trên PHẲNG (flat top surface)
      centerX: 0.5, // Tâm X (0.5 = giữa)
      centerY: 0.5, // Tâm Y (0.5 = giữa)
      radius: 0.22, // Bán kính vùng (~22% để giống ảnh)
    },
    // Màu khắc laser trên nhựa: xám nhạt, không bóng
    logoColor: "#cfd3d6",
  },
};

// =====================================================
// ===== HELPER FUNCTIONS =====
// =====================================================

/**
 * Lấy tỷ lệ vùng da
 */
export function getLeatherRatios() {
  return {
    start: LEATHER_CONFIG.startPx / LEATHER_CONFIG.originalTextureHeight,
    end: LEATHER_CONFIG.endPx / LEATHER_CONFIG.originalTextureHeight,
  };
}

/**
 * Log config hiện tại
 */
export function logConfig() {
  console.log("=".repeat(50));
  console.log("[Config] LEATHER:");
  console.log("  - Position:", LEATHER_CONFIG.startPx, "-", LEATHER_CONFIG.endPx, "px");
  console.log("  - Normal scale:", LEATHER_CONFIG.normalScaleX, "x", LEATHER_CONFIG.normalScaleY);
  console.log("  - Texture scale:", LEATHER_CONFIG.textureScaleX, "x", LEATHER_CONFIG.textureScaleY);
  console.log("[Config] RUBBER:");
  console.log("  - Enabled:", RUBBER_CONFIG.enabled);
  console.log("  - Normal scale:", RUBBER_CONFIG.normalScaleX, "x", RUBBER_CONFIG.normalScaleY);
  console.log("  - Logo enabled:", RUBBER_CONFIG.logo.enabled);
  console.log("=".repeat(50));
}
