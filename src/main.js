import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const CUE_GLB_PATH = "./cue-butt.glb";
// ===== SCENE =====
const container = document.getElementById("canvas-wrap");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.8, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // High-DPI support, capped at 2 for performance
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Get max anisotropy for texture filtering
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

// lights
scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.5);
dir.position.set(3, 6, 3);
scene.add(dir);
// === Environment Map ===
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  "/env/studio_small_03_1k.hdr",
  (hdrTex) => {
    console.log("✅ HDR loaded:", hdrTex);
    hdrTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdrTex; // dùng cho PBR reflections
    scene.environmentIntensity = 1.2; // Increased for mirror-like reflections
    scene.background = new THREE.Color(0x2a2a2a);
  },
  (xhr) => {
    console.log(`HDR loading... ${((xhr.loaded / xhr.total) * 100).toFixed(2)}%`);
  },
  (error) => {
    console.error("❌ Failed to load HDR:", error);
  }
);
// orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true; // Allow panning/moving the view
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.8;

// Background colors
const DARK_BG = 0x2a2a2a;
const LIGHT_BG = 0xf2f4f8;

// Listen for background toggle from UI
window.addEventListener('toggle-background', (e) => {
  const isDark = e.detail.dark;
  scene.background = new THREE.Color(isDark ? DARK_BG : LIGHT_BG);
});
// ===== GLOBALS =====
let loadedModel = null;
let originalMaterials = new Map();
// Note: Texture fitMode is now per-layer (see imageLayers below)
// - "stretch": 1:1 UV mapping (matches Blender layout exactly, for pre-designed textures)
// - "cover": fill UV area, preserve aspect ratio, may crop
// - "contain": fit inside UV area, preserve aspect ratio, may have gaps (for custom overlays)
let createdTextures = [];
let perMaterialBounds = new Map(); // mat.uuid -> { mat, entries: [...], baseCanvas, origTexWidth, origTexHeight }

const CANVAS_SIZE = 4096;

// Store original texture dimensions for aspect ratio correction
// This is needed because the baseCanvas is square but original texture may not be
let originalTextureDimensions = { width: CANVAS_SIZE, height: CANVAS_SIZE };

// UV bounds will be calculated dynamically from mesh geometry
// No longer using hardcoded CUE_UV_RECT - actual UV bounds from mesh are used instead

// --- multilayer image support ---
// Each layer has: img, transform, name, fitMode
// fitMode: "stretch" = 1:1 UV mapping (for base textures), "contain" = preserve aspect ratio (for overlays)
// transform now supports scaleX/scaleY for non-uniform scaling (backwards compatible with single 'scale')
let imageLayers = []; // [{ img: HTMLImageElement, transform: {...}, name: string, fitMode: "stretch"|"contain" }]
let activeLayerIndex = -1;

/**
 * Check if a layer is the Surface layer (first layer, non-editable)
 * @param {number} index - Layer index
 * @returns {boolean} - True if this is the Surface layer
 */
function isSurfaceLayer(index) {
  return index === 0 && imageLayers.length > 0 && imageLayers[0].name === "Surface";
}

function getActiveLayer() {
  return activeLayerIndex >= 0 ? imageLayers[activeLayerIndex] : null;
}

/**
 * Check if the active layer is editable (not the Surface layer)
 * @returns {boolean} - True if active layer can be edited
 */
function isActiveLayerEditable() {
  return activeLayerIndex > 0 || (activeLayerIndex === 0 && !isSurfaceLayer(0));
}

const statusEl = document.getElementById("status");
function setStatus(s) {
  if (statusEl) statusEl.textContent = "Status: " + s;
}

// ===== HELPERS =====
//
async function exportTextureCut() {
  if (!loadedModel) {
    setStatus("⚠️ No model loaded.");
    return null;
  }

  // Step 1: regenerate composited texture
  let fullCanvas = null;
  perMaterialBounds.forEach((info) => {
    const { baseCanvas } = info;
    const canvas = document.createElement("canvas");
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(baseCanvas, 0, 0);

    // draw all design layers
    for (const layer of imageLayers) {
      const img = layer.img;
      const tr = layer.transform;
      const w = canvas.width;
      const h = canvas.height;
      const imgAspect = img.width / img.height;
      const targetAspect = w / h;
      let drawW, drawH;

      if (imgAspect > targetAspect) {
        drawW = w;
        drawH = w / imgAspect;
      } else {
        drawH = h;
        drawW = h * imgAspect;
      }

      const drawX = (w - drawW) / 2 + tr.offsetX * w;
      const drawY = (h - drawH) / 2 + tr.offsetY * h;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tr.rotation || 0);
      ctx.scale(tr.scale || 1, tr.scale || 1);
      ctx.translate(-w / 2, -h / 2);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    fullCanvas = canvas;
  });

  if (!fullCanvas) {
    setStatus("⚠️ No final composited texture.");
    return null;
  }

  // Step 2: find UV bounds for target material (uses same matching logic as buildPerMaterialBounds)
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;

  loadedModel.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];

    // Check if this mesh or material contains "outside" in the name
    const meshName = (child.name || "").toLowerCase();

    mats.forEach((mat) => {
      const matName = (mat?.name || "").toLowerCase();
      // Target material/mesh with "outside" or "butt_body" in the name
      const isTargetMaterial = meshName.includes("outside") || matName.includes("outside") || meshName.includes("butt_body") || matName.includes("butt_body");
      if (!isTargetMaterial) return;

      const geom = child.geometry;
      if (!geom?.attributes?.uv) return;
      const uv = geom.attributes.uv;

      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        minU = Math.min(minU, u);
        minV = Math.min(minV, v);
        maxU = Math.max(maxU, u);
        maxV = Math.max(maxV, v);
      }
    });
  });

  // Fallback: if no match, use first mesh with UVs
  if (minU === Infinity) {
    loadedModel.traverse((child) => {
      if (minU !== Infinity) return; // already found
      if (!child.isMesh) return;
      const geom = child.geometry;
      if (!geom?.attributes?.uv) return;
      const uv = geom.attributes.uv;

      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        minU = Math.min(minU, u);
        minV = Math.min(minV, v);
        maxU = Math.max(maxU, u);
        maxV = Math.max(maxV, v);
      }
    });
  }

  if (minU === Infinity) {
    setStatus("⚠️ No target material UVs found.");
    return null;
  }

  const cutX = minU * fullCanvas.width;
  const cutY = (1 - maxV) * fullCanvas.height;
  const cutW = (maxU - minU) * fullCanvas.width;
  const cutH = (maxV - minV) * fullCanvas.height;

  // Step 3: crop only outside area
  const cutCanvas = document.createElement("canvas");
  cutCanvas.width = cutW;
  cutCanvas.height = cutH;
  const cutCtx = cutCanvas.getContext("2d");
  cutCtx.drawImage(fullCanvas, cutX, cutY, cutW, cutH, 0, 0, cutW, cutH);

  // ✅ Step 4: return the result canvas
  return cutCanvas;
}

async function exportTexture() {
  if (!perMaterialBounds.size) {
    setStatus("⚠️ No texture to export.");
    return;
  }

  // We need to re-run the redraw process and grab the result canvas
  let finalCanvas = null;

  perMaterialBounds.forEach((info) => {
    const { baseCanvas } = info;

    // Make a working copy of baseCanvas
    const canvas = document.createElement("canvas");
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(baseCanvas, 0, 0);

    // Apply image layers with transform (same logic as redrawImage)
    for (const layer of imageLayers) {
      const img = layer.img;
      const tr = layer.transform;

      // Cover mode (like in your redrawImage)
      const w = canvas.width;
      const h = canvas.height;
      const imgAspect = img.width / img.height;
      const targetAspect = w / h;
      let drawW, drawH;

      if (imgAspect > targetAspect) {
        drawW = w;
        drawH = w / imgAspect;
      } else {
        drawH = h;
        drawW = h * imgAspect;
      }

      const drawX = (w - drawW) / 2 + tr.offsetX * w;
      const drawY = (h - drawH) / 2 + tr.offsetY * h;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tr.rotation || 0);
      ctx.scale(tr.scale || 1, tr.scale || 1);
      ctx.translate(-w / 2, -h / 2);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    finalCanvas = canvas; // we just use the first one
  });

  if (!finalCanvas) {
    setStatus("⚠️ No final canvas available.");
    return;
  }
  return finalCanvas;
  // finalCanvas.toBlob((blob) => {
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = "custom_texture.png";
  //   a.click();
  //   URL.revokeObjectURL(url);

  //   setStatus("✅ Exported custom_texture.png with transforms");
  // });
}

/**
 * Export composited texture cropped to "outside" material UV bounds
 * with correct aspect ratio for print production.
 *
 * The original surface texture (e.g., surface.jpg ~1141x8359) is a tall rectangle.
 * The "outside" material UV region typically spans a portion of this texture.
 * This function crops to that UV region and outputs at the correct aspect ratio
 * for high-quality printing.
 *
 * @returns {Promise<HTMLCanvasElement|null>} - Canvas with UV-cropped texture at correct aspect ratio
 */
async function exportForPrint() {
  if (!loadedModel) {
    setStatus("⚠️ No model loaded.");
    return null;
  }

  if (!perMaterialBounds.size) {
    setStatus("⚠️ No texture bounds available.");
    return null;
  }

  // Step 1: Get the full composited texture canvas
  const fullCanvas = await exportTexture();
  if (!fullCanvas) {
    setStatus("⚠️ Could not generate composited texture.");
    return null;
  }

  // Step 2: Find UV bounds for "outside" material
  // First try to get from perMaterialBounds (preferred - already calculated)
  /** @type {{minU: number, minV: number, maxU: number, maxV: number}|null} */
  let uvBounds = null;
  /** @type {{origTexWidth: number, origTexHeight: number}|null} */
  let textureDimensions = null;

  // First, try to find the "outside" material by traversing the model
  // This ensures we check both mesh name and material name consistently
  loadedModel.traverse((child) => {
    if (uvBounds) return; // Already found
    if (!child.isMesh) return;

    const meshName = (child.name || "").toLowerCase();
    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (uvBounds) return; // Already found
      const matName = (mat?.name || "").toLowerCase();

      // Check both mesh name AND material name (consistent with buildPerMaterialBounds)
      const isTargetMaterial = meshName.includes("outside") || matName.includes("outside") ||
                               meshName.includes("butt_body") || matName.includes("butt_body");

      if (isTargetMaterial && perMaterialBounds.has(mat.uuid)) {
        const info = perMaterialBounds.get(mat.uuid);
        const { entries, origTexWidth, origTexHeight } = info;

        if (entries && entries.length > 0) {
          const bounds = entries[0];
          uvBounds = {
            minU: bounds.minU,
            minV: bounds.minV,
            maxU: bounds.maxU,
            maxV: bounds.maxV
          };
          textureDimensions = { origTexWidth, origTexHeight };
          console.log("[exportForPrint] Found UV bounds for mesh:", child.name, "material:", mat.name);
          console.log("[exportForPrint] UV bounds:", uvBounds);
          console.log("[exportForPrint] Original texture dimensions:", textureDimensions);
        }
      }
    });
  });

  // Fallback: if not found in perMaterialBounds, calculate from mesh geometry
  if (!uvBounds) {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;

    loadedModel.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const meshName = (child.name || "").toLowerCase();

      mats.forEach((mat) => {
        const matName = (mat?.name || "").toLowerCase();
        const isTargetMaterial = meshName.includes("outside") || matName.includes("outside") ||
                                 meshName.includes("butt_body") || matName.includes("butt_body");
        if (!isTargetMaterial) return;

        const geom = child.geometry;
        if (!geom?.attributes?.uv) return;
        const uv = geom.attributes.uv;

        for (let i = 0; i < uv.count; i++) {
          const u = uv.getX(i);
          const v = uv.getY(i);
          minU = Math.min(minU, u);
          minV = Math.min(minV, v);
          maxU = Math.max(maxU, u);
          maxV = Math.max(maxV, v);
        }
      });
    });

    if (minU !== Infinity) {
      uvBounds = { minU, minV, maxU, maxV };
      console.log("[exportForPrint] Calculated UV bounds from geometry:", uvBounds);
    }
  }

  // Final fallback: use first available material with UVs
  if (!uvBounds) {
    perMaterialBounds.forEach((info) => {
      if (uvBounds) return; // Already found
      const { entries, origTexWidth, origTexHeight } = info;
      if (entries && entries.length > 0) {
        const bounds = entries[0];
        uvBounds = {
          minU: bounds.minU,
          minV: bounds.minV,
          maxU: bounds.maxU,
          maxV: bounds.maxV
        };
        textureDimensions = { origTexWidth, origTexHeight };
        console.log("[exportForPrint] Using fallback UV bounds:", uvBounds);
      }
    });
  }

  if (!uvBounds) {
    setStatus("⚠️ Could not determine UV bounds for export.");
    return null;
  }

  // Step 3: Calculate crop region in pixel coordinates on the square canvas
  // UV coordinate system: U goes 0->1 left to right, V goes 0->1 bottom to top
  // Canvas coordinate system: X goes 0->width left to right, Y goes 0->height top to bottom
  // So V needs to be flipped: canvasY = (1 - V) * canvasHeight
  const cropX = uvBounds.minU * fullCanvas.width;
  const cropY = (1 - uvBounds.maxV) * fullCanvas.height; // V is flipped
  const cropW = (uvBounds.maxU - uvBounds.minU) * fullCanvas.width;
  const cropH = (uvBounds.maxV - uvBounds.minV) * fullCanvas.height;

  console.log("[exportForPrint] Crop region (canvas pixels):", {
    cropX: cropX.toFixed(0),
    cropY: cropY.toFixed(0),
    cropW: cropW.toFixed(0),
    cropH: cropH.toFixed(0)
  });

  // Step 4: Calculate output dimensions with CORRECT aspect ratio
  // The square canvas distorts the original texture. We need to restore
  // the correct aspect ratio based on the original texture dimensions.
  //
  // Original texture aspect = origTexWidth / origTexHeight
  // UV region aspect in original space = uvWidth * origTexWidth / (uvHeight * origTexHeight)
  //
  // For a tall texture (e.g., 1141x8359), the UV region that appears as
  // cropW x cropH on the square canvas actually has a different true aspect ratio.

  // Get original texture dimensions (fallback to stored global or canvas size)
  const origTexWidth = textureDimensions?.origTexWidth ||
                       originalTextureDimensions?.width ||
                       CANVAS_SIZE;
  const origTexHeight = textureDimensions?.origTexHeight ||
                        originalTextureDimensions?.height ||
                        CANVAS_SIZE;

  // Warn if using fallback dimensions - this might indicate the surface.jpg dimensions weren't captured
  if (!textureDimensions && origTexWidth === CANVAS_SIZE && origTexHeight === CANVAS_SIZE) {
    console.warn("[exportForPrint] WARNING: Using fallback CANVAS_SIZE dimensions. Surface.jpg dimensions may not have been captured.");
    console.warn("[exportForPrint] originalTextureDimensions:", originalTextureDimensions);
  } else if (origTexWidth === origTexHeight && origTexWidth === CANVAS_SIZE) {
    console.warn("[exportForPrint] WARNING: Texture dimensions are square and equal to CANVAS_SIZE. Check if surface.jpg loaded correctly.");
  }

  // Calculate the UV region dimensions in original texture pixels
  const uvWidth = uvBounds.maxU - uvBounds.minU;
  const uvHeight = uvBounds.maxV - uvBounds.minV;
  const originalRegionWidth = uvWidth * origTexWidth;
  const originalRegionHeight = uvHeight * origTexHeight;

  console.log("[exportForPrint] Original texture:", origTexWidth, "x", origTexHeight);
  console.log("[exportForPrint] UV region in original pixels:", {
    width: originalRegionWidth.toFixed(0),
    height: originalRegionHeight.toFixed(0),
    aspectRatio: (originalRegionWidth / originalRegionHeight).toFixed(4)
  });

  // Step 5: Create output canvas with EXACT original texture dimensions
  // Use the original region dimensions directly - no upscaling, only downscale if needed
  // This ensures the exported texture matches the original surface.jpg exactly

  let outputWidth = Math.round(originalRegionWidth);
  let outputHeight = Math.round(originalRegionHeight);

  console.log("[exportForPrint] Target output (before capping):", outputWidth, "x", outputHeight);

  // Only cap if exceeding browser canvas limits (use 16384 which most browsers support)
  // This preserves exact dimensions for typical print textures
  const MAX_DIMENSION = 16384;
  if (outputWidth > MAX_DIMENSION || outputHeight > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / outputWidth, MAX_DIMENSION / outputHeight);
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
    console.log("[exportForPrint] Scaled down due to canvas limits, scale:", scale.toFixed(4));
  }

  console.log("[exportForPrint] Output dimensions:", outputWidth, "x", outputHeight,
              "aspect:", (outputWidth / outputHeight).toFixed(4));

  // Step 6: Create output canvas and draw cropped region
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext("2d");

  // Draw the cropped region from the square canvas, scaled to output dimensions
  // This effectively "un-stretches" the texture back to correct proportions
  outputCtx.drawImage(
    fullCanvas,
    cropX, cropY, cropW, cropH,  // Source rectangle (from square canvas)
    0, 0, outputWidth, outputHeight  // Destination (output canvas with correct aspect)
  );

  console.log("[exportForPrint] Export complete - canvas ready for print production");
  setStatus("Print-ready texture exported.");

  return outputCanvas;
}

async function prepareTexturesForExport(object) {
  const promises = [];

  object.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (mat.map && mat.map.image instanceof HTMLCanvasElement) {
          const canvas = mat.map.image;

          // convert canvas -> bitmap
          const p = createImageBitmap(canvas).then((bitmap) => {
            mat.map.image = bitmap; // replace canvas with bitmap
            mat.map.needsUpdate = true;
          });

          promises.push(p);
        }
      });
    }
  });

  return Promise.all(promises);
}
async function exportGLB() {
  if (!loadedModel) {
    setStatus("⚠️ No model to export.");
    return;
  }

  await prepareTexturesForExport(loadedModel);

  const exporter = new GLTFExporter();
  const sceneToExport = new THREE.Scene();
  sceneToExport.add(loadedModel.clone(true));

  exporter.parse(
    sceneToExport,
    (glb) => {
      if (!(glb instanceof ArrayBuffer)) {
        console.error("Got JSON instead of ArrayBuffer:", glb);
        setStatus("❌ Still JSON – check argument order");
        return;
      }

      const blob = new Blob([glb], { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "custom_model.glb";
      a.click();

      URL.revokeObjectURL(url);
      setStatus("✅ Exported custom_model.glb with embedded textures");
    },
    (error) => {
      console.error("Export failed:", error);
      setStatus("❌ Export failed, see console");
    },
    { binary: true, embedImages: true }
  );
}
function exportPNG() {
  renderer.render(scene, camera); // make sure it's up to date

  renderer.domElement.toBlob((blob) => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_design.png"; // filename
    a.click();

    URL.revokeObjectURL(url);
    setStatus("✅ Exported custom_design.png");
  }, "image/png");
}

function resetLayers() {
  imageLayers = [];
  activeLayerIndex = -1;
  updateLayerUI();

  // reset sliders to defaults
  document.getElementById("offsetX").value = 0;
  document.getElementById("offsetY").value = 0;
  document.getElementById("scale").value = 1;
  document.getElementById("rotation").value = 0;

  // reset file input so user can re-upload the same file again
  const imgInput = document.getElementById("imgInput");
  if (imgInput) imgInput.value = "";
}
function computeBoundsFromIndices(geometry, start, count) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) return null;
  const idx = geometry.index ? geometry.index.array : null;
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;

  for (let i = start; i < start + count; i++) {
    const vi = idx ? idx[i] : i;
    if (vi >= uvAttr.count) continue;
    const u = uvAttr.getX(vi);
    const v = uvAttr.getY(vi);
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }
  if (minU === Infinity) return null;
  return { minU, minV, maxU, maxV, width: maxU - minU, height: maxV - minV };
}

function clearCreatedTextures() {
  for (const t of createdTextures) {
    try {
      t.dispose && t.dispose();
    } catch {}
  }
  createdTextures.length = 0;
}

function resetMaterials() {
  if (!loadedModel) return;
  clearCreatedTextures();
  loadedModel.traverse((child) => {
    if (child.isMesh && originalMaterials.has(child.uuid)) {
      child.material = originalMaterials.get(child.uuid).clone();
      child.material.needsUpdate = true;
    }
  });
  perMaterialBounds.clear();
  setStatus("Materials reset.");
}

// Build per-material entries and cache baseCanvas for each target material
function buildPerMaterialBounds() {
  perMaterialBounds.clear();
  if (!loadedModel) return;

  // First pass: log all materials found in the model for debugging
  console.log("=== Materials found in model ===");
  /** @type {Array<{mesh: THREE.Mesh, mat: THREE.Material, geom: THREE.BufferGeometry}>} */
  const allMeshMaterials = [];

  loadedModel.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (mat) {
        console.log(`  Mesh: "${child.name}" | Material: "${mat.name}" | Type: ${mat.type}`);
        allMeshMaterials.push({ mesh: child, mat, geom: child.geometry });
      }
    });
  });
  console.log("================================");

  // Second pass: find matching materials
  let foundMatch = false;

  loadedModel.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geom = child.geometry;
    const uvAttr = geom.attributes.uv;
    if (!uvAttr) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const groups = geom.groups && geom.groups.length ? geom.groups : [{ start: 0, count: geom.index ? geom.index.count : uvAttr.count, materialIndex: 0 }];

    // Check if this mesh or material contains "outside" in the name
    const meshName = (child.name || "").toLowerCase();

    for (const g of groups) {
      const mat = mats[g.materialIndex];
      if (!mat) continue;

      // Target material/mesh with "outside" or "butt_body" in the name
      const matName = (mat.name || "").toLowerCase();
      const isTargetMaterial = meshName.includes("outside") || matName.includes("outside") || meshName.includes("butt_body") || matName.includes("butt_body");

      if (!isTargetMaterial) continue;

      const bounds = computeBoundsFromIndices(geom, g.start, g.count);
      if (!bounds) continue;

      foundMatch = true;
      console.log(`[Material Match] Using material: "${mat.name}" from mesh: "${child.name}" (matched "outside")`);
      console.log(`[Material Match] UV bounds from mesh:`, bounds);

      if (!perMaterialBounds.has(mat.uuid)) {
        // create baseCanvas once per material
        const base = document.createElement("canvas");
        base.width = CANVAS_SIZE;
        base.height = CANVAS_SIZE;
        const bctx = base.getContext("2d");

        // Store original texture dimensions for aspect ratio correction
        let origTexWidth = CANVAS_SIZE;
        let origTexHeight = CANVAS_SIZE;

        if (mat.map && mat.map.image) {
          try {
            // Capture original texture dimensions before stretching to square canvas
            origTexWidth = mat.map.image.width || CANVAS_SIZE;
            origTexHeight = mat.map.image.height || CANVAS_SIZE;
            bctx.drawImage(mat.map.image, 0, 0, base.width, base.height);
          } catch (e) {
            // fallback to color if image isn't ready
            let baseColor = "#ffffff";
            if (mat.color && typeof mat.color.getHexString === "function") baseColor = "#" + mat.color.getHexString();
            bctx.fillStyle = baseColor;
            bctx.fillRect(0, 0, base.width, base.height);
          }
        } else {
          let baseColor = "#ffffff";
          if (mat.color && typeof mat.color.getHexString === "function") baseColor = "#" + mat.color.getHexString();
          bctx.fillStyle = baseColor;
          bctx.fillRect(0, 0, base.width, base.height);
        }

        perMaterialBounds.set(mat.uuid, { mat, entries: [], baseCanvas: base, origTexWidth, origTexHeight });
      }

      perMaterialBounds.get(mat.uuid).entries.push(bounds);
    }
  });

  // Fallback: if no material matched, use the first mesh material with UVs
  if (!foundMatch && allMeshMaterials.length > 0) {
    console.warn("[Fallback] No material matched naming rules. Using first available mesh material.");

    for (const { mesh, mat, geom } of allMeshMaterials) {
      const uvAttr = geom.attributes.uv;
      if (!uvAttr) continue;

      const groups = geom.groups && geom.groups.length ? geom.groups : [{ start: 0, count: geom.index ? geom.index.count : uvAttr.count, materialIndex: 0 }];

      for (const g of groups) {
        const bounds = computeBoundsFromIndices(geom, g.start, g.count);
        if (!bounds) continue;

        console.warn(`[Fallback] Using material: "${mat.name}" from mesh: "${mesh.name}"`);

        if (!perMaterialBounds.has(mat.uuid)) {
          const base = document.createElement("canvas");
          base.width = CANVAS_SIZE;
          base.height = CANVAS_SIZE;
          const bctx = base.getContext("2d");

          // Store original texture dimensions for aspect ratio correction
          let origTexWidth = CANVAS_SIZE;
          let origTexHeight = CANVAS_SIZE;

          if (mat.map && mat.map.image) {
            try {
              origTexWidth = mat.map.image.width || CANVAS_SIZE;
              origTexHeight = mat.map.image.height || CANVAS_SIZE;
              bctx.drawImage(mat.map.image, 0, 0, base.width, base.height);
            } catch (e) {
              let baseColor = "#ffffff";
              if (mat.color && typeof mat.color.getHexString === "function") baseColor = "#" + mat.color.getHexString();
              bctx.fillStyle = baseColor;
              bctx.fillRect(0, 0, base.width, base.height);
            }
          } else {
            let baseColor = "#ffffff";
            if (mat.color && typeof mat.color.getHexString === "function") baseColor = "#" + mat.color.getHexString();
            bctx.fillStyle = baseColor;
            bctx.fillRect(0, 0, base.width, base.height);
          }

          perMaterialBounds.set(mat.uuid, { mat, entries: [], baseCanvas: base, origTexWidth, origTexHeight });
        }

        perMaterialBounds.get(mat.uuid).entries.push(bounds);
        return; // Use only the first valid material as fallback
      }
    }
  }
}

// ===== IMAGE LAYERS (add/delete/select) =====
/**
 * Calculate initial scale for cover mode to properly fill the UV slot
 * Uses dynamic UV bounds from perMaterialBounds if available
 *
 * For a tall image (e.g., 1:7.33 aspect ratio) going into a wide UV slot (e.g., 2:1),
 * we need to scale UP so the image width fills the UV width.
 *
 * However, extreme scale values (e.g., 14.7x) can push the image out of view,
 * so we cap the scale to a reasonable maximum.
 *
 * @param {number} imgWidth - Image width in pixels
 * @param {number} imgHeight - Image height in pixels
 * @returns {number} - Scale value for cover mode fit
 */
function calculateInitialScale(imgWidth, imgHeight) {
  // Maximum scale to prevent images from being too zoomed in
  const MAX_SCALE = 3.0;

  // Default UV bounds - will be overridden by actual mesh UV bounds
  let uvWidth = 1.0;
  let uvHeight = 0.498; // Default for "outside" material based on analysis

  // Try to get actual UV bounds from perMaterialBounds
  if (perMaterialBounds.size > 0) {
    perMaterialBounds.forEach((info) => {
      if (info.entries && info.entries.length > 0) {
        // Use the first entry's bounds
        const bounds = info.entries[0];
        uvWidth = bounds.width || 1.0;
        uvHeight = bounds.height || 0.498;
        console.log("[calculateInitialScale] UV bounds from mesh:", { uvWidth, uvHeight });
      }
    });
  }

  const imgAspect = imgWidth / imgHeight;
  const uvAspect = uvWidth / uvHeight;

  console.log("[calculateInitialScale] imgAspect:", imgAspect.toFixed(3), "uvAspect:", uvAspect.toFixed(3));

  // For cover mode: calculate scale to fill the UV slot
  // The image needs to cover the entire UV region without leaving gaps
  let scale = 1.0;
  if (imgAspect < uvAspect) {
    // Image is taller (narrower) than UV slot
    // Example: image 0.136 aspect vs UV 2.01 aspect
    // Scale up so image width fills UV width
    scale = uvAspect / imgAspect;
    console.log("[calculateInitialScale] Raw scale (tall image):", scale.toFixed(2));
  }
  // If image is wider than UV slot, default scale of 1.0 works
  // (cover mode in redrawImage will fit height, cropping width)

  // Cap scale to prevent extreme zoom that pushes image out of view
  if (scale > MAX_SCALE) {
    console.log("[calculateInitialScale] Capping scale from", scale.toFixed(2), "to", MAX_SCALE);
    scale = MAX_SCALE;
  }

  // Round to 2 decimal places
  return Math.round(scale * 100) / 100;
}

/**
 * Add an image layer from a file upload
 * Custom overlay images (logos, decorations) use "contain" mode to preserve aspect ratio.
 * They are centered within the UV bounds and scaled to fit nicely.
 *
 * @param {File} file - The image file to add as a layer
 */
function addImageLayerFile(file) {
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    // Custom overlays use "contain" mode to preserve aspect ratio
    // Start with a reasonable scale (0.5) so the image is visible and centered
    const transform = {
      scale: 0.5,
      scaleX: 0.5,
      scaleY: 0.5,
      offsetX: 0.0,
      offsetY: 0.0,
      rotation: 0,
    };

    imageLayers.push({
      img,
      transform,
      name: file.name || "Layer " + (imageLayers.length + 1),
      fitMode: "contain", // Preserve aspect ratio for custom overlays
    });
    activeLayerIndex = imageLayers.length - 1;

    updateLayerUI();
    updateSliders();
    buildPerMaterialBounds();
    redrawImage(); // Per-layer fitMode is used
    if (typeof updateEditOverlay === "function") {
      updateEditOverlay();
    }

    setStatus("Image layer added (aspect ratio preserved).");
  };

  img.src = url;
}

function updateLayerUI() {
  const list = document.getElementById("imageList");
  if (!list) return;
  list.innerHTML = "";

  imageLayers.forEach((layer, i) => {
    const div = document.createElement("div");
    div.className = "image-item";

    // Check if this is the Surface layer (first layer named "Surface")
    const isSurface = isSurfaceLayer(i);

    // Add selected class if this is the active layer
    if (i === activeLayerIndex && !isSurface) {
      div.classList.add("selected");
    }

    if (isSurface) {
      div.classList.add("disabled");
      div.draggable = false;
    } else {
      div.draggable = true; // allow drag for non-Surface layers
    }

    div.innerHTML = `
        <label>
          <input type="radio" name="activeImage" ${i === activeLayerIndex ? "checked" : ""} ${isSurface ? "disabled" : ""} />
          <input type="text" class="layer-name" value="${layer.name}" ${isSurface ? "readonly" : ""} />
        </label>
        <button class="layer-btn dup" title="Duplicate layer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="layer-btn del" title="Delete layer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

    // --- UI wiring ---
    const radio = div.querySelector('input[type="radio"]');
    const nameInput = div.querySelector(".layer-name");
    const dupBtn = div.querySelector(".layer-btn.dup");
    const delBtn = div.querySelector(".layer-btn.del");

    /**
     * Select this layer and update UI
     * Works for both initial selection and re-clicking an already active layer
     */
    function selectLayer() {
      if (isSurface) return;
      activeLayerIndex = i;
      radio.checked = true;
      // Re-render to ensure selected styling is applied (handles re-click case)
      updateLayerUI();
      updateSliders();
      updateEditOverlay();
    }

    // Make entire container clickable to select layer
    div.addEventListener("click", (e) => {
      // Don't select if clicking on buttons or name input (let those handle their own events)
      if (e.target.closest(".layer-btn") || e.target.classList.contains("layer-name")) {
        return;
      }
      selectLayer();
    });

    // Radio change also selects (for keyboard accessibility)
    radio.addEventListener("change", () => {
      selectLayer();
    });

    // Prevent clicking on disabled radio from doing anything
    if (isSurface) {
      div.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    nameInput.addEventListener("change", (e) => {
      if (!isSurface) {
        layer.name = e.target.value.trim() || `Layer ${i + 1}`;
      }
    });

    // Stop propagation on name input click to prevent container click
    nameInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    dupBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent container click
      if (isSurface) return;
      const newTransform = { ...layer.transform };
      const newLayer = { img: layer.img, transform: newTransform, name: layer.name + " copy", fitMode: layer.fitMode || "contain" };
      imageLayers.push(newLayer);
      activeLayerIndex = imageLayers.length - 1;
      updateLayerUI();
      updateEditOverlay();
      redrawImage();
    });

    delBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent container click
      if (isSurface) return;
      imageLayers.splice(i, 1);
      if (imageLayers.length === 0) {
        activeLayerIndex = -1;
      } else if (activeLayerIndex >= imageLayers.length) {
        activeLayerIndex = imageLayers.length - 1;
      }
      // If we deleted and now only Surface remains, deselect
      if (imageLayers.length === 1 && isSurfaceLayer(0)) {
        activeLayerIndex = -1;
      }
      updateLayerUI();
      updateEditOverlay();
      redrawImage();
    });

    // --- DRAG EVENTS (only for non-Surface layers) ---
    if (!isSurface) {
      div.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", i); // store dragged index
        div.classList.add("dragging");
      });

      div.addEventListener("dragend", () => {
        div.classList.remove("dragging");
      });

      div.addEventListener("dragover", (e) => {
        e.preventDefault();
        div.classList.add("drag-over");
      });

      div.addEventListener("dragleave", () => {
        div.classList.remove("drag-over");
      });

      div.addEventListener("drop", (e) => {
        e.preventDefault();
        div.classList.remove("drag-over");

        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const toIndex = i;

        // Prevent dropping onto Surface layer position (index 0)
        if (toIndex === 0 && isSurfaceLayer(0)) return;
        if (fromIndex === 0 && isSurfaceLayer(0)) return;

        if (fromIndex !== toIndex) {
          const moved = imageLayers.splice(fromIndex, 1)[0];
          imageLayers.splice(toIndex, 0, moved);

          // update active layer index
          if (activeLayerIndex === fromIndex) activeLayerIndex = toIndex;
          else if (activeLayerIndex > fromIndex && activeLayerIndex <= toIndex) activeLayerIndex--;
          else if (activeLayerIndex < fromIndex && activeLayerIndex >= toIndex) activeLayerIndex++;

          updateLayerUI();
          updateEditOverlay();
          redrawImage();
        }
      });
    }

    list.appendChild(div);
  });

  // Update edit overlay when layer list changes
  updateEditOverlay();
}

// ===== REDRAW (composite all layers on top of cached base) =====
// Each layer has its own fitMode: "stretch" for base textures, "contain" for overlays
function redrawImage() {
  // when model not loaded or no target materials -> nothing
  if (!loadedModel || perMaterialBounds.size === 0) {
    console.log("[redrawImage] Skipping - loadedModel:", !!loadedModel, "perMaterialBounds.size:", perMaterialBounds.size);
    return;
  }
  console.log("[redrawImage] Starting redraw with", imageLayers.length, "layers (per-layer fitMode)");

  clearCreatedTextures();

  perMaterialBounds.forEach((info) => {
    const { mat, entries, baseCanvas, origTexWidth, origTexHeight } = info;

    // make working canvas from cached base
    const canvas = document.createElement("canvas");
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(baseCanvas, 0, 0);

    // if no layers, just assign base canvas to material and continue
    if (!imageLayers || imageLayers.length === 0) {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.flipY = false;
      // High-quality texture filtering
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = maxAnisotropy;
      tex.needsUpdate = true;
      createdTextures.push(tex);

      loadedModel.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m, idx) => {
          if (m && m.name === mat.name) {
            // Convert to MeshPhysicalMaterial for clearcoat support
            const physMat = new THREE.MeshPhysicalMaterial({
              map: tex,
              color: m.color,
              roughness: 0.08,
              metalness: 0.0,
              clearcoat: 1.0,
              clearcoatRoughness: 0.03,
              envMap: scene.environment,
              envMapIntensity: 1.5,
              transparent: false,
            });
            physMat.name = m.name; // Keep the name
            // Replace material on child
            if (Array.isArray(child.material)) {
              child.material[idx] = physMat;
            } else {
              child.material = physMat;
            }
          }
        });
      });
      return; // continue to next material
    }

    // Use ACTUAL UV bounds from mesh geometry for the "outside" material
    // The "outside" material UV: V [0 - 0.497964], so image should only fill that region
    const actualBounds = entries.length > 0 ? entries[0] : null;
    const uvBounds = actualBounds || { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };

    console.log("[redrawImage] Using UV bounds for material:", mat.name, uvBounds);

    // For each layer, draw on the UV region calculated from mesh geometry
    for (const layer of imageLayers) {
      const img = layer.img;
      const tr = layer.transform;
      // Each layer has its own fitMode: "stretch" for base textures, "contain" for overlays
      const layerFitMode = layer.fitMode || "contain";

      // Calculate rectangle region in canvas pixels from actual UV bounds
      // In canvas coordinates, V is flipped: V=1 is at top (y=0), V=0 is at bottom (y=height)
      const rectX = uvBounds.minU * canvas.width;
      const rectY = (1 - uvBounds.maxV) * canvas.height; // V=1.0 -> y=0
      const rectW = uvBounds.width * canvas.width;
      const rectH = uvBounds.height * canvas.height;

      console.log("[redrawImage] Layer:", layer.name, "fitMode:", layerFitMode, "drawing region - rectX:", rectX.toFixed(0), "rectY:", rectY.toFixed(0), "rectW:", rectW.toFixed(0), "rectH:", rectH.toFixed(0));
      console.log("[redrawImage] Layer transform - scale:", tr.scale, "offsetX:", tr.offsetX, "offsetY:", tr.offsetY, "rotation:", tr.rotation);

      ctx.save();
      ctx.beginPath();
      ctx.rect(rectX, rectY, rectW, rectH);
      ctx.clip();

      // Texture fills based on per-layer fitMode
      const imgAspect = img.width / img.height;

      // IMPORTANT: The canvas is square (4096x4096) but the UV region may map to
      // a different aspect ratio on the actual 3D surface. The UV bounds tell us
      // the proportions in UV space, but when mapped to the square canvas, we need
      // to account for the fact that the base texture was stretched.
      //
      // For example: If base texture is 1141x8359 (aspect ~0.136) and UV region
      // is width=1.0, height=0.5 in UV space, on the original texture that would be
      // 1141 x 4180 pixels (aspect ~0.27). But on the square canvas, it becomes
      // 4096 x 2048 (aspect 2.0). This distortion affects overlay placement.
      //
      // To correctly preserve overlay aspect ratio, we calculate the "true" rect
      // aspect ratio as if the base texture wasn't stretched to a square canvas.

      // Get base texture dimensions to compute the distortion factor
      // Use the stored original texture dimensions (captured when model was loaded)
      // This is crucial because mat.map.image gets overwritten with our canvas texture
      const baseTexWidth = origTexWidth || CANVAS_SIZE;
      const baseTexHeight = origTexHeight || CANVAS_SIZE;

      // Calculate the aspect ratio correction factor
      // This accounts for the stretching from original texture to square canvas
      const baseTexAspect = baseTexWidth / baseTexHeight;
      const canvasAspect = canvas.width / canvas.height; // Always 1.0 for square
      const distortionFactor = baseTexAspect / canvasAspect;

      // The "true" rect aspect on the original (non-stretched) texture
      // rectW/rectH is the aspect on the square canvas
      // Multiply by distortionFactor to get the true aspect
      const trueRectAspect = (rectW / rectH) * distortionFactor;

      console.log("[redrawImage] Original texture:", baseTexWidth, "x", baseTexHeight, "aspect:", baseTexAspect.toFixed(3));
      console.log("[redrawImage] Aspect ratios - img:", imgAspect.toFixed(3),
        "rectOnCanvas:", (rectW/rectH).toFixed(3),
        "distortionFactor:", distortionFactor.toFixed(3),
        "trueRectAspect:", trueRectAspect.toFixed(3));

      let drawW, drawH;

      if (layerFitMode === "stretch") {
        // Stretch mode: 1:1 UV mapping, image fills exact UV bounds
        // This matches Blender's UV layout exactly - no aspect ratio preservation
        // Used for base surface textures designed to match UV layout
        drawW = rectW;
        drawH = rectH;
      } else if (layerFitMode === "cover") {
        // Cover mode: fill entire rect, may crop
        // Use true rect aspect for correct proportions
        if (imgAspect > trueRectAspect) {
          // Image wider than true rect - fit height, crop width
          // But we draw on the distorted canvas, so scale accordingly
          drawH = rectH;
          drawW = rectH * imgAspect / distortionFactor;
        } else {
          // Image taller than true rect - fit width, crop height
          drawW = rectW;
          drawH = (rectW / imgAspect) * distortionFactor;
        }
      } else {
        // Contain mode: fit entire image within bounds, preserves aspect ratio
        // Used for custom overlays (logos, decorations) - no stretching
        //
        // KEY INSIGHT: We draw on a square canvas (4096x4096), but this canvas
        // gets mapped to a tall narrow UV space (e.g., 1141x8359 for surface.jpg).
        // To make a square image APPEAR square on the final 3D model, we must
        // PRE-DISTORT it in the OPPOSITE direction on the canvas.
        //
        // If the final texture is tall (aspect < 1), we need to draw the image
        // WIDER on the square canvas so it compresses to correct proportions.
        //
        // distortionFactor = baseTexAspect (e.g., 0.136 for tall texture)
        // To counter the vertical stretch, we multiply drawW by 1/distortionFactor

        // Calculate draw dimensions preserving aspect ratio on the FINAL surface
        // First, calculate what the image dimensions should be in "true" UV space
        // Then convert to canvas pixels with distortion compensation

        // The image should fit within the true rect (accounting for distortion)
        // True rect aspect tells us the shape of the region on the actual 3D surface

        if (imgAspect > trueRectAspect) {
          // Image is wider than true rect - constrained by width in true space
          // On canvas: draw narrower to compensate for horizontal compression
          drawW = rectW;
          drawH = rectW / imgAspect / distortionFactor;
        } else {
          // Image is taller/equal - constrained by height in true space
          // On canvas: draw wider to compensate for vertical stretch
          drawH = rectH;
          drawW = rectH * imgAspect / distortionFactor;
        }

        // Clamp to rect bounds (in case compensation pushes outside)
        if (drawW > rectW) {
          const scale = rectW / drawW;
          drawW = rectW;
          drawH *= scale;
        }
        if (drawH > rectH) {
          const scale = rectH / drawH;
          drawH = rectH;
          drawW *= scale;
        }
      }

      console.log("[redrawImage] Draw dimensions - drawW:", drawW.toFixed(0), "drawH:", drawH.toFixed(0));

      // Compute draw position with per-layer offsets (relative to rectangle)
      // Center the image within the rect, then apply offsets
      const baseX = rectX + (rectW - drawW) / 2;
      const baseY = rectY + (rectH - drawH) / 2;
      const drawX = baseX + tr.offsetX * rectW;
      const drawY = baseY + tr.offsetY * rectH;

      // Apply rotation & scale around rectangle center
      // Support both uniform scale and non-uniform scaleX/scaleY
      const scaleX = tr.scaleX !== undefined ? tr.scaleX : (tr.scale || 1);
      const scaleY = tr.scaleY !== undefined ? tr.scaleY : (tr.scale || 1);
      ctx.translate(rectX + rectW / 2, rectY + rectH / 2);
      ctx.rotate(tr.rotation || 0);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-(rectX + rectW / 2), -(rectY + rectH / 2));

      // Draw the layer image
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } // end layers

    // create texture and assign to materials with this mat.uuid
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Use RepeatWrapping for proper cylindrical wrap around the cue
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    // High-quality texture filtering
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    createdTextures.push(tex);

    console.log("[redrawImage] Created texture for material:", mat.name, "canvas size:", canvas.width, "x", canvas.height);

    loadedModel.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m, idx) => {
        if (m && m.name === mat.name) {
          // Convert to MeshPhysicalMaterial for clearcoat support
          const physMat = new THREE.MeshPhysicalMaterial({
            map: tex,
            color: m.color,
            roughness: 0.08,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMap: scene.environment,
            envMapIntensity: 1.5,
            transparent: false,
          });
          physMat.name = m.name; // Keep the name
          // Replace material on child
          if (Array.isArray(child.material)) {
            child.material[idx] = physMat;
          } else {
            child.material = physMat;
          }
        }
      });
    });
  }); // end perMaterialBounds.forEach
}

// ===== UI SLIDERS & STICKY HANDLERS =====
function updateSliders() {
  const layer = getActiveLayer();
  if (!layer) {
    // set defaults if no layer
    document.getElementById("offsetX").value = 0;
    document.getElementById("offsetY").value = 0;
    document.getElementById("scale").value = 1;
    document.getElementById("rotation").value = 0;
    return;
  }
  const t = layer.transform;
  document.getElementById("offsetX").value = t.offsetX;
  document.getElementById("offsetY").value = t.offsetY;
  // Use uniform scale if scaleX/scaleY not set, or average of both
  const scaleValue = t.scaleX !== undefined && t.scaleY !== undefined
    ? (t.scaleX + t.scaleY) / 2
    : (t.scale || 1);
  document.getElementById("scale").value = scaleValue;
  document.getElementById("rotation").value = (t.rotation * 180) / Math.PI;

  // Update edit overlay when sliders change
  if (typeof updateEditOverlay === "function") {
    updateEditOverlay();
  }
}

// Direct value handler - no snapping, returns raw value
// toRadians flag converts degrees to radians if true
function makeDirectHandler(toRadians = false) {
  return function (rawVal) {
    return toRadians ? (rawVal * Math.PI) / 180 : rawVal;
  };
}

function attachSliderEvents() {
  // Direct handlers - no snapping, free adjustment
  const directOffset = makeDirectHandler(false);
  const directScale = makeDirectHandler(false);
  const directRotation = makeDirectHandler(true); // converts degrees to radians

  // Offset X
  const offXEl = document.getElementById("offsetX");
  offXEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    layer.transform.offsetX = directOffset(raw);
    redrawImage();
  });

  // Offset Y
  const offYEl = document.getElementById("offsetY");
  offYEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    layer.transform.offsetY = directOffset(raw);
    redrawImage();
  });

  // Scale
  const scaleEl = document.getElementById("scale");
  scaleEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    layer.transform.scale = directScale(raw);
    // Also update scaleX/scaleY to stay in sync
    layer.transform.scaleX = layer.transform.scale;
    layer.transform.scaleY = layer.transform.scale;
    redrawImage();
  });

  // Rotation
  const rotEl = document.getElementById("rotation");
  rotEl.addEventListener("input", (e) => {
    const rawDeg = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    layer.transform.rotation = directRotation(rawDeg);
    redrawImage();
  });
}
attachSliderEvents();

// ===== FILE HANDLERS =====
document.getElementById("imgInput").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  addImageLayerFile(f);
});

// document.getElementById("glbInput").addEventListener("change", (e) => {
//   const f = e.target.files[0];
//   if (f) loadGLBFromURL(f);
// });

// Model buttons removed - cue.glb is now the only model
// document.getElementById("exportBtn").addEventListener("click", exportGLB);
// document.getElementById("exportPngBtn").addEventListener("click", exportPNG);
// document.getElementById("exportTextureBtn").addEventListener("click", exportTexture);
// document.getElementById("exportTextureCutBtn").addEventListener("click", exportTextureCut);

// ===== MODEL LOADER =====
const gltfLoader = new GLTFLoader();

function loadGLBFromURL(urlOrFile) {
  setStatus("Loading model...");
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
    originalMaterials.clear();
  }

  // Detect if loading cue model
  const isCueModel = typeof urlOrFile === "string" && urlOrFile.includes("cue");

  const onLoaded = (gltf) => {
    loadedModel = gltf.scene;

    const box = new THREE.Box3().setFromObject(loadedModel);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.0 / Math.max(size.x, size.y, size.z);
    loadedModel.scale.setScalar(scale);

    box.setFromObject(loadedModel);
    const center = box.getCenter(new THREE.Vector3());
    loadedModel.position.sub(center);
    loadedModel.position.y -= 0.5;

    loadedModel.traverse((child) => {
      if (child.isMesh && child.material) {
        originalMaterials.set(child.uuid, child.material.clone());

        // Upgrade existing material properties for mirror-like lacquer finish
        // Keep the SAME material object (preserves uuid for redrawImage matching)
        const mat = child.material;
        mat.envMap = scene.environment;
        mat.envMapIntensity = 1.5;      // Strong reflections
        mat.roughness = 0.08;           // Very smooth for mirror reflections
        mat.metalness = 0.0;            // Non-metallic

        // Add clearcoat if material supports it (MeshPhysicalMaterial)
        // If it's MeshStandardMaterial, these properties still work but clearcoat won't
        if (mat.isMeshStandardMaterial) {
          mat.clearcoat = 1.0;            // Full clearcoat layer (lacquer)
          mat.clearcoatRoughness = 0.03;  // Ultra-smooth clearcoat
          mat.reflectivity = 1.0;
        }
        mat.needsUpdate = true;
      }
    });

    scene.add(loadedModel);

    // Adjust camera for cue model - focus on customizable area (bottom half)
    if (isCueModel) {
      // Cue is VERTICAL: tip at top, bumper at bottom
      // Custom area is lower half, so focus camera there
      camera.position.set(1.2, -0.3, 1.2); // Side view, slightly below center
      controls.target.set(0, -0.3, 0); // Focus on lower/custom section
      controls.update();
    } else {
      // Default camera for other models
      camera.position.set(0, 1.8, 4);
      controls.target.set(0, 0, 0);
      controls.update();
    }

    // build base canvases now that model is present (so mat.map.image is likely ready)
    buildPerMaterialBounds();

    // if user already uploaded some layers, redraw (otherwise model shows original materials)
    if (imageLayers.length > 0) {
      redrawImage();
    }

    setStatus("Model loaded.");
  };

  if (typeof urlOrFile === "string") {
    gltfLoader.load(urlOrFile, onLoaded);
  } else {
    const objectURL = URL.createObjectURL(urlOrFile);
    gltfLoader.load(objectURL, (gltf) => {
      onLoaded(gltf);
      URL.revokeObjectURL(objectURL);
    });
  }
}

// Track loading states for proper synchronization
let modelLoaded = false;
let surfaceImageLoaded = false;
let surfaceImage = null;

// Function to apply texture when both model and image are ready
function applyTextureWhenReady() {
  if (!modelLoaded || !surfaceImageLoaded || !surfaceImage) {
    console.log("[Texture] Waiting... modelLoaded:", modelLoaded, "surfaceImageLoaded:", surfaceImageLoaded);
    return;
  }

  console.log("[Texture] Both model and surface image ready, applying texture...");
  console.log("[Texture] Image dimensions:", surfaceImage.width, "x", surfaceImage.height);

  // For 1:1 UV mapping (matching Blender), we use scale=1, no rotation, no offset
  // The surface.jpg is pre-designed to fit the UV layout exactly
  const transform = {
    scale: 1.0,
    scaleX: 1.0,
    scaleY: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    rotation: 0,
  };

  imageLayers.push({
    img: surfaceImage,
    transform,
    name: "Surface",
    fitMode: "stretch", // Surface texture uses 1:1 UV mapping (stretch to fill)
  });
  // Surface layer is not selectable, so set activeLayerIndex to -1
  // User must add a custom layer to edit
  activeLayerIndex = -1;

  // Store the surface image dimensions as the "original" texture dimensions
  // This is the reference aspect ratio for correct overlay placement
  originalTextureDimensions = {
    width: surfaceImage.width,
    height: surfaceImage.height
  };
  console.log("[Texture] Set original texture dimensions from surface.jpg:", originalTextureDimensions);

  updateLayerUI();
  updateSliders();
  buildPerMaterialBounds();

  // Update perMaterialBounds with the correct texture dimensions from surface.jpg
  // This ensures overlays use the correct aspect ratio
  perMaterialBounds.forEach((info, uuid) => {
    info.origTexWidth = surfaceImage.width;
    info.origTexHeight = surfaceImage.height;
  });

  console.log("[Texture] perMaterialBounds size:", perMaterialBounds.size);

  // Per-layer fitMode is now used (surface = "stretch")
  redrawImage();
  setStatus("Default surface loaded.");
}

// Get URL parameters for dynamic configuration
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    variantId: params.get("variant"),
    surfaceUrl: params.get("surface"),
    // Add more params as needed
  };
}

// Load surface texture - either from Shopify metafield URL or default fallback
// Surface texture is designed to map 1:1 with the UV layout in Blender
// No rotation or scaling needed - it should fill the UV space exactly
function loadDefaultSurface() {
  const { surfaceUrl } = getUrlParams();

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    console.log("[Texture] Surface image loaded:", img.width, "x", img.height);
    surfaceImage = img;
    surfaceImageLoaded = true;
    applyTextureWhenReady();
  };
  img.onerror = (e) => {
    console.error("[Texture] Failed to load surface texture:", e);
    // If custom surface fails, try fallback to default
    if (surfaceUrl && img.src !== "./surface.jpg") {
      console.log("[Texture] Trying fallback to default surface.jpg");
      img.src = "./surface.jpg";
    } else {
      setStatus("Error loading surface texture.");
    }
  };

  // Use Shopify metafield URL if provided, otherwise use default
  if (surfaceUrl) {
    console.log("[Texture] Loading surface from Shopify:", surfaceUrl);
    img.src = surfaceUrl;
  } else {
    console.log("[Texture] No surface URL provided, using default surface.jpg");
    img.src = "./surface.jpg";
  }
}

// Load model and signal when ready
function loadModelAndSurface() {
  setStatus("Loading model...");

  gltfLoader.load(
    CUE_GLB_PATH,
    (gltf) => {
      loadedModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(loadedModel);
      const size = box.getSize(new THREE.Vector3());
      const scale = 2.0 / Math.max(size.x, size.y, size.z);
      loadedModel.scale.setScalar(scale);

      box.setFromObject(loadedModel);
      const center = box.getCenter(new THREE.Vector3());
      loadedModel.position.sub(center);
      loadedModel.position.y -= 0.5;

      loadedModel.traverse((child) => {
        if (child.isMesh && child.material) {
          originalMaterials.set(child.uuid, child.material.clone());

          // Upgrade existing material properties for mirror-like lacquer finish
          // Keep the SAME material object (preserves uuid for redrawImage matching)
          const mat = child.material;
          mat.envMap = scene.environment;
          mat.envMapIntensity = 1.5;      // Strong reflections
          mat.roughness = 0.08;           // Very smooth for mirror reflections
          mat.metalness = 0.0;            // Non-metallic

          // Add clearcoat if material supports it (MeshPhysicalMaterial)
          // If it's MeshStandardMaterial, these properties still work but clearcoat won't
          if (mat.isMeshStandardMaterial) {
            mat.clearcoat = 1.0;            // Full clearcoat layer (lacquer)
            mat.clearcoatRoughness = 0.03;  // Ultra-smooth clearcoat
            mat.reflectivity = 1.0;
          }
          mat.needsUpdate = true;
        }
      });

      scene.add(loadedModel);

      // Adjust camera for cue model - focus on customizable area
      camera.position.set(1.2, -0.3, 1.2);
      controls.target.set(0, -0.3, 0);
      controls.update();

      console.log("[Model] Loaded successfully");
      modelLoaded = true;
      setStatus("Model loaded.");

      applyTextureWhenReady();
    },
    (xhr) => {
      console.log(`[Model] Loading... ${((xhr.loaded / xhr.total) * 100).toFixed(2)}%`);
    },
    (error) => {
      console.error("[Model] Failed to load:", error);
      setStatus("Error loading model.");
    }
  );
}

// Start loading both in parallel
loadDefaultSurface();
loadModelAndSurface();

// ===== EDIT FRAME OVERLAY =====
// Interactive 2D overlay for transforming layers directly on the 3D canvas

/** @type {HTMLCanvasElement|null} */
const editOverlay = document.getElementById("editOverlay");
/** @type {CanvasRenderingContext2D|null} */
const overlayCtx = editOverlay ? editOverlay.getContext("2d") : null;

// Edit frame state
/** @typedef {'none'|'move'|'scale-nw'|'scale-ne'|'scale-sw'|'scale-se'|'scale-n'|'scale-s'|'scale-e'|'scale-w'|'rotate'} DragMode */
/** @type {DragMode} */
let editDragMode = "none";
let editDragStartX = 0;
let editDragStartY = 0;
let editDragStartTransform = null;

// Frame dimensions (in screen pixels, centered on canvas)
const FRAME_PADDING = 50; // Padding from canvas edges
const HANDLE_SIZE = 10;
const ROTATION_HANDLE_DISTANCE = 30;

/**
 * Get the edit frame bounds in screen coordinates
 * This represents where the layer appears on the 3D canvas
 * @returns {{x: number, y: number, width: number, height: number, centerX: number, centerY: number}}
 */
function getEditFrameBounds() {
  if (!editOverlay) return { x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0 };

  const canvasRect = renderer.domElement.getBoundingClientRect();
  const layer = getActiveLayer();

  if (!layer || !isActiveLayerEditable()) {
    return { x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  // Calculate frame size based on canvas size with padding
  // The frame represents the editable area on the 3D surface
  const frameWidth = Math.min(300, canvasRect.width - FRAME_PADDING * 2);
  const frameHeight = Math.min(200, canvasRect.height - FRAME_PADDING * 2);

  // Center the frame in the canvas area (accounting for sidebar)
  const sidebarWidth = 320;
  const availableWidth = canvasRect.width;
  const centerX = sidebarWidth + (availableWidth - sidebarWidth) / 2;
  const centerY = canvasRect.height / 2;

  // Apply layer transform to frame position
  const tr = layer.transform;
  const scaleX = tr.scaleX !== undefined ? tr.scaleX : (tr.scale || 1);
  const scaleY = tr.scaleY !== undefined ? tr.scaleY : (tr.scale || 1);

  // Frame moves at 0.5x speed relative to layer movement on 3D model
  // This gives users more control range - frame stays in view while layer can move further
  const FRAME_SPEED = 0.5;
  const offsetPixelsX = tr.offsetX * frameWidth * FRAME_SPEED;
  const offsetPixelsY = tr.offsetY * frameHeight * FRAME_SPEED;

  return {
    x: centerX - (frameWidth * scaleX) / 2 + offsetPixelsX,
    y: centerY - (frameHeight * scaleY) / 2 + offsetPixelsY,
    width: frameWidth * scaleX,
    height: frameHeight * scaleY,
    centerX: centerX + offsetPixelsX,
    centerY: centerY + offsetPixelsY,
    rotation: tr.rotation || 0,
    baseWidth: frameWidth,
    baseHeight: frameHeight
  };
}

/**
 * Draw the edit frame overlay
 */
function drawEditFrame() {
  if (!editOverlay || !overlayCtx) return;

  // Resize overlay to match canvas
  const canvasRect = renderer.domElement.getBoundingClientRect();
  if (editOverlay.width !== canvasRect.width || editOverlay.height !== canvasRect.height) {
    editOverlay.width = canvasRect.width;
    editOverlay.height = canvasRect.height;
  }

  // Clear the overlay
  overlayCtx.clearRect(0, 0, editOverlay.width, editOverlay.height);

  // Only draw if we have an editable layer selected
  if (!isActiveLayerEditable()) {
    editOverlay.classList.remove("active");
    editOverlay.style.pointerEvents = "none";
    return;
  }

  editOverlay.classList.add("active");
  editOverlay.style.pointerEvents = "auto";

  const bounds = getEditFrameBounds();
  if (bounds.width === 0 || bounds.height === 0) return;

  overlayCtx.save();

  // Apply rotation around center
  overlayCtx.translate(bounds.centerX, bounds.centerY);
  overlayCtx.rotate(bounds.rotation);
  overlayCtx.translate(-bounds.centerX, -bounds.centerY);

  // Draw frame border (green)
  overlayCtx.strokeStyle = "#22c55e";
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([]);
  overlayCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

  // Draw dashed inner guide
  overlayCtx.strokeStyle = "rgba(34, 197, 94, 0.4)";
  overlayCtx.lineWidth = 1;
  overlayCtx.setLineDash([4, 4]);
  const inset = 10;
  overlayCtx.strokeRect(bounds.x + inset, bounds.y + inset, bounds.width - inset * 2, bounds.height - inset * 2);
  overlayCtx.setLineDash([]);

  // Draw corner handles (for uniform scaling)
  overlayCtx.fillStyle = "#22c55e";
  const corners = [
    { x: bounds.x, y: bounds.y }, // NW
    { x: bounds.x + bounds.width, y: bounds.y }, // NE
    { x: bounds.x, y: bounds.y + bounds.height }, // SW
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height } // SE
  ];
  corners.forEach((corner) => {
    overlayCtx.fillRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  });

  // Draw edge handles (for non-uniform scaling)
  overlayCtx.fillStyle = "#16a34a";
  const edges = [
    { x: bounds.x + bounds.width / 2, y: bounds.y }, // N
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, // S
    { x: bounds.x, y: bounds.y + bounds.height / 2 }, // W
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 } // E
  ];
  edges.forEach((edge) => {
    overlayCtx.beginPath();
    overlayCtx.arc(edge.x, edge.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
    overlayCtx.fill();
  });

  // Draw rotation handle (circle above the frame)
  const rotHandleY = bounds.y - ROTATION_HANDLE_DISTANCE;
  overlayCtx.fillStyle = "#22c55e";
  overlayCtx.beginPath();
  overlayCtx.arc(bounds.centerX, rotHandleY, HANDLE_SIZE / 2 + 2, 0, Math.PI * 2);
  overlayCtx.fill();

  // Draw line connecting rotation handle to frame
  overlayCtx.strokeStyle = "#22c55e";
  overlayCtx.lineWidth = 1;
  overlayCtx.beginPath();
  overlayCtx.moveTo(bounds.centerX, bounds.y);
  overlayCtx.lineTo(bounds.centerX, rotHandleY + HANDLE_SIZE / 2 + 2);
  overlayCtx.stroke();

  overlayCtx.restore();
}

/**
 * Determine which part of the edit frame is under the cursor
 * @param {number} x - Mouse X in canvas coordinates
 * @param {number} y - Mouse Y in canvas coordinates
 * @returns {DragMode}
 */
function hitTestEditFrame(x, y) {
  if (!isActiveLayerEditable()) return "none";

  const bounds = getEditFrameBounds();
  if (bounds.width === 0) return "none";

  // Transform mouse coordinates to account for frame rotation
  const cos = Math.cos(-bounds.rotation);
  const sin = Math.sin(-bounds.rotation);
  const dx = x - bounds.centerX;
  const dy = y - bounds.centerY;
  const rotX = dx * cos - dy * sin + bounds.centerX;
  const rotY = dx * sin + dy * cos + bounds.centerY;

  const hitRadius = HANDLE_SIZE + 5;

  // Check rotation handle first
  const rotHandleY = bounds.y - ROTATION_HANDLE_DISTANCE;
  if (Math.hypot(rotX - bounds.centerX, rotY - rotHandleY) < hitRadius) {
    return "rotate";
  }

  // Check corner handles
  const corners = [
    { x: bounds.x, y: bounds.y, mode: "scale-nw" },
    { x: bounds.x + bounds.width, y: bounds.y, mode: "scale-ne" },
    { x: bounds.x, y: bounds.y + bounds.height, mode: "scale-sw" },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height, mode: "scale-se" }
  ];
  for (const corner of corners) {
    if (Math.hypot(rotX - corner.x, rotY - corner.y) < hitRadius) {
      return corner.mode;
    }
  }

  // Check edge handles
  const edges = [
    { x: bounds.x + bounds.width / 2, y: bounds.y, mode: "scale-n" },
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, mode: "scale-s" },
    { x: bounds.x, y: bounds.y + bounds.height / 2, mode: "scale-w" },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, mode: "scale-e" }
  ];
  for (const edge of edges) {
    if (Math.hypot(rotX - edge.x, rotY - edge.y) < hitRadius) {
      return edge.mode;
    }
  }

  // Check if inside frame (for move)
  if (rotX >= bounds.x && rotX <= bounds.x + bounds.width && rotY >= bounds.y && rotY <= bounds.y + bounds.height) {
    return "move";
  }

  return "none";
}

/**
 * Update cursor based on drag mode
 * @param {DragMode} mode
 */
function updateCursor(mode) {
  if (!editOverlay) return;

  const cursors = {
    none: "default",
    move: "move",
    "scale-nw": "nwse-resize",
    "scale-se": "nwse-resize",
    "scale-ne": "nesw-resize",
    "scale-sw": "nesw-resize",
    "scale-n": "ns-resize",
    "scale-s": "ns-resize",
    "scale-e": "ew-resize",
    "scale-w": "ew-resize",
    rotate: "grab"
  };
  editOverlay.style.cursor = cursors[mode] || "default";
}

/**
 * Handle mouse down on edit overlay
 * @param {MouseEvent} e
 */
function onEditOverlayMouseDown(e) {
  const rect = editOverlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mode = hitTestEditFrame(x, y);

  // If clicking outside the frame, unfocus the layer
  if (mode === "none") {
    // Unfocus the active layer (if any editable layer is selected)
    if (activeLayerIndex > 0 || (activeLayerIndex === 0 && !isSurfaceLayer(0))) {
      activeLayerIndex = -1;
      updateLayerUI();
      updateEditOverlay();
    }
    // Set overlay to pass-through mode so orbit controls work
    editOverlay.style.pointerEvents = "none";
    // Re-enable after a short delay to allow orbit controls to capture the event
    setTimeout(() => {
      editOverlay.style.pointerEvents = isActiveLayerEditable() ? "auto" : "none";
    }, 10);
    return;
  }

  // Only proceed if we have an editable layer
  if (!isActiveLayerEditable()) return;

  editDragMode = mode;
  editDragStartX = x;
  editDragStartY = y;

  const layer = getActiveLayer();
  if (layer) {
    editDragStartTransform = { ...layer.transform };
  }

  // Disable orbit controls while dragging the frame
  controls.enabled = false;

  e.preventDefault();
  e.stopPropagation();
}

/**
 * Handle mouse move on edit overlay
 * @param {MouseEvent} e
 */
function onEditOverlayMouseMove(e) {
  // If no editable layer, don't process
  if (!isActiveLayerEditable()) return;

  const rect = editOverlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (editDragMode === "none") {
    // Just update cursor based on what's under the mouse
    const mode = hitTestEditFrame(x, y);
    updateCursor(mode);
    return;
  }

  const layer = getActiveLayer();
  if (!layer || !editDragStartTransform) return;

  const bounds = getEditFrameBounds();
  const dx = x - editDragStartX;
  const dy = y - editDragStartY;

  // Apply rotation to delta for move operations
  const cos = Math.cos(-bounds.rotation);
  const sin = Math.sin(-bounds.rotation);
  const rotDx = dx * cos - dy * sin;
  const rotDy = dx * sin + dy * cos;

  // Layer movement multiplier - layer on 3D model moves 2x relative to green frame
  // This means for every 1px the frame moves, the layer moves 2px worth on the texture
  const LAYER_MOVE_MULTIPLIER = 2.0;

  switch (editDragMode) {
    case "move":
      // Move: update offsetX/offsetY
      // Convert pixel movement to offset units (relative to frame size)
      // Layer moves 2x faster than the frame appears to move
      layer.transform.offsetX = editDragStartTransform.offsetX + (rotDx / bounds.baseWidth) * LAYER_MOVE_MULTIPLIER;
      layer.transform.offsetY = editDragStartTransform.offsetY + (rotDy / bounds.baseHeight) * LAYER_MOVE_MULTIPLIER;
      break;

    case "scale-nw":
    case "scale-ne":
    case "scale-sw":
    case "scale-se":
      // Corner handles: uniform scaling (scales both X and Y proportionally)
      // IMPORTANT: Scale from current scaleX/scaleY values, not reset to uniform
      {
        const startDist = Math.hypot(editDragStartX - bounds.centerX, editDragStartY - bounds.centerY);
        const currentDist = Math.hypot(x - bounds.centerX, y - bounds.centerY);
        const scaleFactor = currentDist / Math.max(startDist, 1);

        // Get the starting scaleX and scaleY (preserve individual values)
        const baseScaleX = editDragStartTransform.scaleX !== undefined ? editDragStartTransform.scaleX : (editDragStartTransform.scale || 1);
        const baseScaleY = editDragStartTransform.scaleY !== undefined ? editDragStartTransform.scaleY : (editDragStartTransform.scale || 1);

        // Apply same scale factor to both, preserving the ratio between them
        layer.transform.scaleX = Math.max(0.1, Math.min(5, baseScaleX * scaleFactor));
        layer.transform.scaleY = Math.max(0.1, Math.min(5, baseScaleY * scaleFactor));
        // Update uniform scale to average for compatibility
        layer.transform.scale = (layer.transform.scaleX + layer.transform.scaleY) / 2;
      }
      break;

    case "scale-n":
    case "scale-s":
      // Vertical edge: scale Y only (preserves scaleX)
      {
        const startDist = Math.abs(editDragStartY - bounds.centerY);
        const currentDist = Math.abs(y - bounds.centerY);
        const scaleFactor = currentDist / Math.max(startDist, 1);
        const baseScaleY = editDragStartTransform.scaleY !== undefined ? editDragStartTransform.scaleY : (editDragStartTransform.scale || 1);
        layer.transform.scaleY = Math.max(0.1, Math.min(5, baseScaleY * scaleFactor));
      }
      break;

    case "scale-e":
    case "scale-w":
      // Horizontal edge: scale X only (preserves scaleY)
      {
        const startDist = Math.abs(editDragStartX - bounds.centerX);
        const currentDist = Math.abs(x - bounds.centerX);
        const scaleFactor = currentDist / Math.max(startDist, 1);
        const baseScaleX = editDragStartTransform.scaleX !== undefined ? editDragStartTransform.scaleX : (editDragStartTransform.scale || 1);
        layer.transform.scaleX = Math.max(0.1, Math.min(5, baseScaleX * scaleFactor));
      }
      break;

    case "rotate":
      // Rotation handle: update rotation
      {
        const startAngle = Math.atan2(editDragStartY - bounds.centerY, editDragStartX - bounds.centerX);
        const currentAngle = Math.atan2(y - bounds.centerY, x - bounds.centerX);
        const deltaAngle = currentAngle - startAngle;
        layer.transform.rotation = (editDragStartTransform.rotation || 0) + deltaAngle;
      }
      break;
  }

  // Redraw texture and overlay
  redrawImage();
  drawEditFrame();
}

/**
 * Handle mouse up on edit overlay
 * @param {MouseEvent} e
 */
function onEditOverlayMouseUp(e) {
  if (editDragMode !== "none") {
    editDragMode = "none";
    editDragStartTransform = null;
    controls.enabled = true;

    // Update sliders to reflect new values
    updateSliders();
  }
}

/**
 * Update the edit overlay (call when layer changes)
 */
function updateEditOverlay() {
  drawEditFrame();
}

// Attach edit overlay event listeners
if (editOverlay) {
  editOverlay.addEventListener("mousedown", onEditOverlayMouseDown);
  editOverlay.addEventListener("mousemove", onEditOverlayMouseMove);
  editOverlay.addEventListener("mouseup", onEditOverlayMouseUp);
  editOverlay.addEventListener("mouseleave", onEditOverlayMouseUp);
}

// ===== RENDER LOOP =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  // Update edit overlay each frame to stay in sync
  drawEditFrame();
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
// ------------------------------
// NEW: export full texture canvas (2048) + Add-to-Cart upload flow
// ------------------------------

/**
 * Compress an image blob to reduce file size before upload
 * Reduces quality (JPEG compression) WITHOUT resizing dimensions
 * This preserves full resolution for better rendering on the 3D model
 *
 * @param {Blob} blob - Original image blob
 * @param {number} quality - JPEG quality (0-1), default 0.82 for good balance
 * @returns {Promise<Blob>} - Compressed blob at original resolution
 */
async function compressImageBlob(blob, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      // Keep original dimensions - no resizing
      const width = img.width;
      const height = img.height;

      // Create canvas at full resolution
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      // Convert to JPEG with quality compression (no dimension change)
      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            const originalKB = (blob.size / 1024).toFixed(1);
            const compressedKB = (compressedBlob.size / 1024).toFixed(1);
            const reduction = (((blob.size - compressedBlob.size) / blob.size) * 100).toFixed(0);
            console.log(`[Compress] ${originalKB}KB -> ${compressedKB}KB (${reduction}% reduction, ${width}x${height} preserved)`);
            resolve(compressedBlob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}

/**
 * Upload image via secure backend API
 * Uses signed Cloudinary uploads through our serverless function
 * Subject to Vercel 4.5MB payload limit - images are compressed before upload
 *
 * @param {Blob} blob - Image blob to upload
 * @returns {Promise<string>} - Cloudinary secure URL
 */
async function uploadToBackend(blob) {
  const formData = new FormData();
  formData.append("file", blob, "design.jpg");

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    // Parse error response for better messaging
    let errorMessage = "Upload failed";
    try {
      const errorData = await response.json();
      if (response.status === 413) {
        errorMessage = `Image too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller image or reduce quality.`;
      } else {
        errorMessage = errorData.message || errorData.error || errorMessage;
      }
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.url;
}

async function orderNow() {
  try {
    setStatus("Preparing print-ready texture...");

    // Use exportForPrint() for UV-cropped output with correct aspect ratio
    // This produces a high-resolution texture suitable for print production
    const printCanvas = await exportForPrint();
    if (!printCanvas) {
      alert("Cannot export texture. Please ensure the model is loaded.");
      window.stopOrderLoading?.();
      return;
    }

    console.log("[orderNow] Print canvas dimensions:", printCanvas.width, "x", printCanvas.height);

    // Convert canvas to blob (PNG for initial quality)
    const pngBlob = await new Promise((r) => printCanvas.toBlob(r, "image/png"));

    // Compress to JPEG at 82% quality (preserves full resolution)
    // This reduces file size for upload while keeping all pixels
    setStatus("Compressing image...");
    const compressedBlob = await compressImageBlob(pngBlob, 0.82);

    // Check if compressed size is still too large (> 3.5MB to leave headroom)
    const maxSizeMB = 3.5;
    if (compressedBlob.size > maxSizeMB * 1024 * 1024) {
      // Try more aggressive compression
      console.log(`[Upload] Image still large (${(compressedBlob.size / 1024 / 1024).toFixed(1)}MB), applying stronger compression...`);
      setStatus("Applying stronger compression...");
      const moreCompressed = await compressImageBlob(pngBlob, 0.70);

      if (moreCompressed.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`Image is too large (${(moreCompressed.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${maxSizeMB}MB. Try using fewer or smaller overlay images.`);
      }

      // Use the more compressed version
      setStatus("Uploading design...");
      const url = await uploadToBackend(moreCompressed);
      console.log("[Upload] Success with stronger compression:", url);
      finishOrder(url);
      return;
    }

    // Upload via secure backend API
    setStatus("Uploading design...");
    const url = await uploadToBackend(compressedBlob);

    if (!url) throw new Error("Upload failed: No URL returned");

    console.log("[Upload] Success:", url);
    finishOrder(url);

  } catch (e) {
    console.error("Order error:", e);
    alert("Error processing order:\n" + e.message);
    setStatus("Error: " + e.message);
    window.stopOrderLoading?.();
  }
}

/**
 * Complete the order by sending add-to-cart message to Shopify
 * @param {string} url - Cloudinary URL of the uploaded design
 */
function finishOrder(url) {
  // Send message to parent Shopify page (iframe communication)
  setStatus("Sending add-to-cart request to Shopify...");
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("variant");
  window.parent.postMessage(
    {
      type: "ADD_TO_CART",
      payload: {
        id: productId,
        quantity: 1,
        properties: { "Custom Design URL": url },
      },
    },
    "*"
  );

  setStatus("Request sent to Shopify.");
  window.stopOrderLoading?.();
}

document.getElementById("orderNowBtn").addEventListener("click", orderNow);
