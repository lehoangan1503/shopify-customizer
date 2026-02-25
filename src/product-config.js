/**
 * PRODUCT CONFIGURATION
 * Cấu hình loại sản phẩm và routing
 */

import { MODEL_CONFIG, getActiveSurfacePath, SURFACE_TYPES, setActiveSurface } from "./leather-config.js";

// Re-export for main.js
export { SURFACE_TYPES, setActiveSurface, getActiveSurfacePath };

// =====================================================
// ===== LOẠI SẢN PHẨM =====
// =====================================================
export const PRODUCT_TYPES = {
  STANDARD: "standard", // Không có da - bóng như thủy tinh
  LEATHER: "leather", // Có bọc da
};

// =====================================================
// ===== DANH SÁCH SẢN PHẨM =====
// =====================================================
export const PRODUCTS = {
  // Sản phẩm KHÔNG có da
  "cue-butt": {
    type: PRODUCT_TYPES.STANDARD,
    glbPath: "./cue-butt.glb",
    name: "Cue Butt Standard",
    description: "Gậy bi-a không bọc da",
  },
  "cue-butt-smooth": {
    type: PRODUCT_TYPES.STANDARD,
    glbPath: "./cue-butt-smooth.glb",
    name: "Cue Butt Smooth",
    description: "Gậy bi-a mặt nhẵn",
  },

  // Sản phẩm CÓ da - GLB path từ leather-config.js
  "cue-leather": {
    type: PRODUCT_TYPES.LEATHER,
    glbPath: MODEL_CONFIG.glbPath, // Từ leather-config.js
    name: "Cue Butt Leather",
    description: "Gậy bi-a có bọc da",
  },
  "cue-croc": {
    type: PRODUCT_TYPES.LEATHER,
    glbPath: MODEL_CONFIG.glbPath, // Từ leather-config.js
    name: "Cue Butt Crocodile",
    description: "Gậy bi-a bọc da cá sấu",
  },
};

// =====================================================
// ===== LẤY THÔNG TIN SẢN PHẨM TỪ URL =====
// =====================================================

/**
 * Lấy product ID từ URL params
 * Ví dụ: ?product=cue-leather
 * @returns {string} Product ID hoặc 'cue-butt' (mặc định)
 */
export function getProductIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("product") || "cue-butt";
}

/**
 * Lấy product type từ URL params
 * Ví dụ: ?type=leather
 * @returns {string} Product type hoặc null
 */
export function getProductTypeFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("type") || null;
}

/**
 * Lấy thông tin sản phẩm hiện tại
 * @returns {Object} Product info
 */
export function getCurrentProduct() {
  const productId = getProductIdFromURL();
  const typeOverride = getProductTypeFromURL();

  // Lấy từ danh sách sản phẩm
  let product = PRODUCTS[productId] || PRODUCTS["cue-butt"];

  // Cho phép override type qua URL
  if (typeOverride && Object.values(PRODUCT_TYPES).includes(typeOverride)) {
    product = { ...product, type: typeOverride };

    // Nếu override thành leather, dùng GLB từ leather-config
    if (typeOverride === PRODUCT_TYPES.LEATHER) {
      product.glbPath = MODEL_CONFIG.glbPath;
    }
  }

  return {
    id: productId,
    ...product,
  };
}

/**
 * Kiểm tra sản phẩm hiện tại có da không
 * @returns {boolean}
 */
export function isLeatherProduct() {
  const product = getCurrentProduct();
  return product.type === PRODUCT_TYPES.LEATHER;
}

/**
 * Lấy đường dẫn GLB của sản phẩm hiện tại
 * @returns {string}
 */
export function getProductGLBPath() {
  const product = getCurrentProduct();
  return product.glbPath;
}

/**
 * Lấy đường dẫn Surface texture của sản phẩm hiện tại
 * @returns {string}
 */
export function getSurfacePath() {
  if (isLeatherProduct()) {
    // Leather uses dynamic surface from config
    return getActiveSurfacePath();
  }
  // Standard dùng surface mặc định
  return "./surface.jpg";
}

// =====================================================
// ===== HELPER FUNCTIONS =====
// =====================================================

/**
 * Tạo URL cho sản phẩm
 * @param {string} productId - ID sản phẩm
 * @returns {string} URL
 */
export function createProductURL(productId) {
  const url = new URL(window.location.href);
  url.searchParams.set("product", productId);
  return url.toString();
}

/**
 * Log thông tin sản phẩm hiện tại
 */
export function logCurrentProduct() {
  const product = getCurrentProduct();
  console.log("=".repeat(50));
  console.log("[Product] Current product:", product.id);
  console.log("[Product] Type:", product.type);
  console.log("[Product] Name:", product.name);
  console.log("[Product] GLB:", product.glbPath);
  console.log("[Product] Has Leather:", product.type === PRODUCT_TYPES.LEATHER);
  console.log("=".repeat(50));
}
