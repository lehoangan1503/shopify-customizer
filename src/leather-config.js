/**
 * =====================================================
 * LEATHER & RUBBER CONFIGURATION
 * =====================================================
 * File cấu hình cho chất liệu da và cao su
 * Chỉnh sửa file này để thay đổi texture, vị trí, độ nổi...
 */

// =====================================================
// ===== CẤU HÌNH MODEL 3D =====
// =====================================================
export const MODEL_CONFIG = {
  // File GLB cho sản phẩm có da (đặt trong public/)
  // Các file có sẵn: cue-butt-leather.glb, cue_2.glb, cue-butt3.glb, 
  //                  cue-butt1.glb, cue-butt_ok.glb, cue-butt-smooth.glb
  glbPath: "./cue-butt-leather.glb",
  
  // Surface texture riêng cho leather (đặt trong public/)
  surfacePath: "./surface-leather.jpg",
  
  // Fallback nếu không tìm thấy file
  fallbackGlbPath: "./cue-butt.glb",
  fallbackSurfacePath: "./surface.jpg",
};

// =====================================================
// ===== CẤU HÌNH VÙNG BỌC DA (LEATHER) =====
// =====================================================
export const LEATHER_CONFIG = {
  // --- VỊ TRÍ VÙNG DA (tính từ đỉnh texture) ---
  originalTextureHeight: 8359,  // Chiều cao texture gốc (px)
  startPx: 3767,                // Bắt đầu từ pixel
  endPx: 7080,                  // Kết thúc ở pixel

  // --- VÙNG VIỀN BÓNG GIỮA DA VÀ THÂN ---
  // Dùng cho roughness/clearcoat map để mô phỏng lớp viền phẳng, bóng
  // Luôn cố định tương đối theo pixel; bạn có thể chỉnh lại startPx/endPx cho khớp thực tế
  band: {
    enabled: true,
    startPx: 3680,             // tạm: nằm giữa thân và vùng da, sẽ tinh chỉnh sau
    endPx: 3740,               // độ dày dải viền (~60 px trên ảnh 8k)
    roughness: 40,             // bóng hơn da nhưng không gương
    clearcoat: 230             // clearcoat cao để highlight rõ
  },
  
  // --- NORMAL MAP (texture vân da) ---
  // File có sẵn: leather-normal.jpg, Leather008_1K-JPG_NormalGL.jpg
  normalPath: "./leather-normal.jpg",
  normalScaleX: 20.0,           // Độ nổi theo X - cực nổi khối
  normalScaleY: 20.0,           // Độ nổi theo Y
  normalStrength: 20.0,         // Độ mạnh khi blend vào canvas
  
  // --- KÍCH THƯỚC VÂN DA ---
  textureScaleX: 1.1,           // Scale vân theo X (nhỏ = hạt sần nhỏ li ti)
  textureScaleY: 1.1,           // Scale vân theo Y
  
  // --- CHẤT LIỆU DA ---
  roughness: 200,               // Độ nhám (0-255) - cao để da mờ tự nhiên
  clearcoat: 20,                // Độ bóng clearcoat (0-255) - thấp để không như nhựa
  sheen: 180,                   // Sheen (0-255) - đặc trưng da
  
  // --- CHẤT LIỆU VÙNG KHÔNG DA (phần còn lại - bóng như thủy tinh) ---
  nonLeather: {
    roughness: 0.01,            // Siêu bóng như kính
    clearcoat: 1.0,
    clearcoatRoughness: 0.005,
    reflectivity: 1.0,
    ior: 1.52,
    thickness: 1.5,
    specularIntensity: 1.2,
  }
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
    "bottom", "bumper", "cap", "rubber", "butt_cap", "end_cap", 
    "logo", "badge", "emblem", "decal", "label", "sticker",
    "pad", "foot", "base", "end", "tip", "butt",
    // Tên cụ thể từ model
    "Cylinder005", "Material.003"
  ],
  
  // --- NORMAL MAP (texture hạt sần) ---
  normalPath: "./rubber-grain-normal.jpg",
  normalScaleX: 0.78,           // Giảm thêm lần nữa để hạt mỏng rõ rệt
  normalScaleY: 0.78,           // Giảm thêm để bề mặt dịu hơn
  
  // --- KÍCH THƯỚC HẠT SẦN ---
  textureScaleX: 0.15,          // Scale hạt theo X (càng nhỏ = hạt càng nhỏ)
  textureScaleY: 0.15,          // Scale hạt theo Y
    
  // --- MÀU NỀN CAO SU ---
  backgroundColor: '#2a2a2a',   // Xám đậm tự nhiên giống ảnh chụp
  
  // --- CHẤT LIỆU CAO SU ---
  roughness: 0.94,              // Mờ hơn thêm một chút
  clearcoat: 0.01,              // Clearcoat rất thấp (gần như không)
  metalness: 0,
  reflectivity: 0.025,
  
  // --- LOGO TRÊN NÚT ĐÁY ---
  logo: {
    enabled: true,              // BẬT logo laser ở nút đáy như ảnh tham chiếu
    path: "./logo.png",         // Đường dẫn đến logo (PNG, nền trong suốt, đặt trong public/)
    scale: 0.42,                // Kích thước lớn gần giống ảnh chụp
    opacity: 1.0,               // Độ đậm logo khắc
    offsetX: 0.25,               // Đặt ở giữa
    offsetY: 0.25,               // Đặt ở giữa
    flipX: false,               // Lật ngang (false = cùng chiều với logo trên thân)
    flipY: true,                // Lật dọc để hướng logo đúng khi nhìn từ dưới lên
    rotateDeg: 0,               // Xoay logo nếu cần (0-360)
    color: '#cfd3d6',           // Màu khắc laser: xám nhạt
    emboss: false,              // Khắc phẳng
    embossDepth: 0,             // Không dùng
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
    "top", "cap", "thread", "screw", "thread_cap", "top_cap", 
    "ferrule", "tip", "joint", "connector", "adapter",
    // Tên cụ thể từ model (cần kiểm tra trong console)
  ],
  
  // --- LOGO TRÊN NẮP ĐẬY REN ---
  logo: {
    enabled: true,              // Bật/tắt custom logo
    path: "./logo.png",         // Đường dẫn đến logo (PNG, nền trong suốt, đặt trong public/)
    scale: 0.5,                // Kích thước logo (nhỉnh hơn một chút để giống ảnh chụp)
    opacity: 1.0,               // Độ đậm màu logo (1.0 = đậm nhất)
    offsetX: -0.25,               // Đặt logo ở tâm mặt trên
    offsetY: 0.25,               // Đặt logo ở tâm mặt trên
    flipX: false,              // Lật ngang
    flipY: false,              // Lật dọc
    emboss: false,              // TẮT emboss - logo phẳng như khắc laser, không chìm
    embossDepth: 0,             // Không emboss
    // Chỉ vẽ logo ở giữa texture (mặt trên nắp), không vẽ trên thân
    topSurfaceOnly: true,      // CHỈ vẽ trên mặt phẳng trên cùng
    topSurfaceUV: {            // Vùng UV của mặt trên PHẲNG (flat top surface)
      centerX: 0.5,            // Tâm X (0.5 = giữa)
      centerY: 0.5,            // Tâm Y (0.5 = giữa)
      radius: 0.22,            // Bán kính vùng (~22% để giống ảnh)
    },
    // Màu khắc laser trên nhựa: xám nhạt, không bóng
    logoColor: '#cfd3d6',
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
