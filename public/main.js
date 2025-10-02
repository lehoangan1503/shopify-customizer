// main.js
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js";
import { GLTFExporter } from "https://unpkg.com/three@0.160.0/examples/jsm/exporters/GLTFExporter.js";

const MUG_GLB_PATH = "./mug.glb";
const HANDBAG_GLB_PATH = "./handbag.glb";
const THERMOS_GLB_PATH = "./thermos.glb";
// ===== SCENE =====
const container = document.getElementById("canvas-wrap");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f8);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.8, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// lights
scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.5);
dir.position.set(3, 6, 3);
scene.add(dir);
// === Environment Map ===
const rgbeLoader = new RGBELoader();
rgbeLoader.load("./env/studio_small_03_1k.hdr", (hdrTex) => {
  hdrTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdrTex; // used for PBR reflections
  scene.environmentIntensity = 0.1;
  scene.background = new THREE.Color(0xf2f4f8); // keep flat bg instead of showing HDR image
});
// orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
// ===== GLOBALS =====
let loadedModel = null;
let originalMaterials = new Map();
let textureMode = "cover"; // you said you will use cover mode by default
let createdTextures = [];
let perMaterialBounds = new Map(); // mat.uuid -> { mat, entries: [...], baseCanvas }

const CANVAS_SIZE = 2048;

// --- multilayer image support ---
let imageLayers = []; // [{ img: HTMLImageElement, transform: {scale, offsetX, offsetY, rotation} }]
let activeLayerIndex = -1;

function getActiveLayer() {
  return activeLayerIndex >= 0 ? imageLayers[activeLayerIndex] : null;
}

const statusEl = document.getElementById("status");
function setStatus(s) {
  if (statusEl) statusEl.textContent = "Status: " + s;
}

// ===== HELPERS =====
function exportTextureCut() {
  if (!loadedModel) {
    setStatus("⚠️ No model loaded.");
    return;
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
    return;
  }

  // Step 2: get UV bounds only for "outside" material
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;

  loadedModel.traverse((child) => {
    if (!child.isMesh) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      const name = (mat?.name || "").toLowerCase();
      if (!name.includes("outside")) return; // only "outside" material

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

  if (minU === Infinity) {
    setStatus("⚠️ No 'outside' UVs found.");
    return;
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

  // Step 4: export
  cutCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_texture_cut.png";
    a.click();
    URL.revokeObjectURL(url);

    setStatus("✅ Exported custom_texture_cut.png (outside only)");
  });
}
function exportTexture() {
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

  finalCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom_texture.png";
    a.click();
    URL.revokeObjectURL(url);

    setStatus("✅ Exported custom_texture.png with transforms");
  });
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

  loadedModel.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (child.isMesh) console.log(child.name, child.material.type, child.material.name);
    const geom = child.geometry;
    const uvAttr = geom.attributes.uv;
    if (!uvAttr) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const groups = geom.groups && geom.groups.length ? geom.groups : [{ start: 0, count: geom.index ? geom.index.count : uvAttr.count, materialIndex: 0 }];

    for (const g of groups) {
      const mat = mats[g.materialIndex];
      if (!mat) continue;

      // ✅ use flexible naming rule
      const validName = (mat.name || "").toLowerCase();
      if (!validName.includes("outside") && !validName.includes("material")) continue;

      const bounds = computeBoundsFromIndices(geom, g.start, g.count);
      if (!bounds) continue;

      if (!perMaterialBounds.has(mat.uuid)) {
        // create baseCanvas once per material
        const base = document.createElement("canvas");
        base.width = CANVAS_SIZE;
        base.height = CANVAS_SIZE;
        const bctx = base.getContext("2d");

        if (mat.map && mat.map.image) {
          try {
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

        perMaterialBounds.set(mat.uuid, { mat, entries: [], baseCanvas: base });
      }

      perMaterialBounds.get(mat.uuid).entries.push(bounds);
    }
  });
}

// ===== IMAGE LAYERS (add/delete/select) =====
function addImageLayerFile(file) {
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    const transform = {
      scale: 1.0,
      offsetX: 0.0,
      offsetY: 0.0,
      rotation: img.height > img.width ? -Math.PI / 2 : 0,
    };

    imageLayers.push({
      img,
      transform,
      name: "Layer " + (imageLayers.length + 1), // default name
    });
    activeLayerIndex = imageLayers.length - 1;

    updateLayerUI();
    buildPerMaterialBounds();
    redrawImage(textureMode);

    setStatus("Image layer added.");
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
    div.draggable = true; // allow drag

    div.innerHTML = `
        <label>
          <input type="radio" name="activeImage" ${i === activeLayerIndex ? "checked" : ""} />
          <input type="text" class="layer-name" value="${layer.name}" />
        </label>
        <button class="dup" title="Duplicate layer">⧉</button>
        <button class="del" title="Delete layer">×</button>
      `;

    // --- UI wiring ---
    const radio = div.querySelector('input[type="radio"]');
    const nameInput = div.querySelector(".layer-name");
    const dupBtn = div.querySelector("button.dup");
    const delBtn = div.querySelector("button.del");

    radio.addEventListener("change", () => {
      activeLayerIndex = i;
      updateSliders();
    });

    nameInput.addEventListener("change", (e) => {
      layer.name = e.target.value.trim() || `Layer ${i + 1}`;
    });

    dupBtn.addEventListener("click", () => {
      const newTransform = { ...layer.transform };
      const newLayer = { img: layer.img, transform: newTransform, name: layer.name + " copy" };
      imageLayers.push(newLayer);
      activeLayerIndex = imageLayers.length - 1;
      updateLayerUI();
      redrawImage(textureMode);
    });

    delBtn.addEventListener("click", () => {
      imageLayers.splice(i, 1);
      if (imageLayers.length === 0) {
        activeLayerIndex = -1;
      } else if (activeLayerIndex >= imageLayers.length) {
        activeLayerIndex = imageLayers.length - 1;
      }
      updateLayerUI();
      redrawImage(textureMode);
    });

    // --- DRAG EVENTS ---
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

      if (fromIndex !== toIndex) {
        const moved = imageLayers.splice(fromIndex, 1)[0];
        imageLayers.splice(toIndex, 0, moved);

        // update active layer index
        if (activeLayerIndex === fromIndex) activeLayerIndex = toIndex;
        else if (activeLayerIndex > fromIndex && activeLayerIndex <= toIndex) activeLayerIndex--;
        else if (activeLayerIndex < fromIndex && activeLayerIndex >= toIndex) activeLayerIndex++;

        updateLayerUI();
        redrawImage(textureMode);
      }
    });

    list.appendChild(div);
  });
}

// ===== REDRAW (composite all layers on top of cached base) =====
function redrawImage(fitMode = "cover") {
  // when model not loaded or no target materials -> nothing
  if (!loadedModel || perMaterialBounds.size === 0) return;

  clearCreatedTextures();

  perMaterialBounds.forEach((info) => {
    const { mat, entries, baseCanvas } = info;

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
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.flipY = false;
      tex.needsUpdate = true;
      createdTextures.push(tex);

      loadedModel.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m && m.uuid === mat.uuid) {
            m.map = tex;
            m.transparent = false;
            m.needsUpdate = true;
          }
        });
      });
      return; // continue to next material
    }

    // For each layer, draw over each UV rect
    for (const layer of imageLayers) {
      const img = layer.img;
      const tr = layer.transform;

      entries.forEach((bounds) => {
        // compute target rect in canvas pixels
        let x, y, w, h;
        if (fitMode === "cover") {
          x = 0;
          y = 0;
          w = canvas.width;
          h = canvas.height;
        } else {
          x = bounds.minU * canvas.width;
          y = (1 - bounds.maxV) * canvas.height;
          w = bounds.width * canvas.width;
          h = bounds.height * canvas.height;
        }
        if (w <= 0 || h <= 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // compute drawW/drawH preserving aspect while ensuring full-width coverage
        const imgAspect = img.width / img.height;
        const targetAspect = w / h;
        let drawW, drawH;

        if (fitMode === "cover") {
          // you requested: keep full width and preserve aspect -> crop vertically if needed
          drawW = w;
          drawH = w / imgAspect;
          if (drawH < h) {
            // not tall enough → expand height to fill and crop left/right
            drawH = h;
            drawW = h * imgAspect;
          }
        } else {
          // contain: fit inside
          if (imgAspect > targetAspect) {
            drawW = w;
            drawH = w / imgAspect;
          } else {
            drawH = h;
            drawW = h * imgAspect;
          }
        }

        // compute draw position with per-layer offsets
        const drawX = x + (w - drawW) / 2 + tr.offsetX * w;
        const drawY = y + (h - drawH) / 2 + tr.offsetY * h;

        // apply rotation & scale around rect center
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(tr.rotation || 0);
        ctx.scale(tr.scale || 1, tr.scale || 1);
        ctx.translate(-(x + w / 2), -(y + h / 2));

        // draw the layer image
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      });
    } // end layers

    // create texture and assign to materials with this mat.uuid
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    tex.needsUpdate = true;
    createdTextures.push(tex);

    loadedModel.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m && m.uuid === mat.uuid) {
          m.map = tex;
          m.transparent = false;
          m.needsUpdate = true;
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
  document.getElementById("scale").value = t.scale;
  document.getElementById("rotation").value = (t.rotation * 180) / Math.PI;
}

// sticky/hysteresis factory (snap+release)
function makeStickyHandler(targets, snapRange = 10, releaseRange = 15, toRadians = false) {
  let lockedTarget = null;
  return function (rawVal) {
    if (lockedTarget !== null) {
      if (Math.abs(rawVal - lockedTarget) < releaseRange) {
        return toRadians ? (lockedTarget * Math.PI) / 180 : lockedTarget;
      } else {
        lockedTarget = null;
      }
    }
    for (const t of targets) {
      if (Math.abs(rawVal - t) < snapRange) {
        lockedTarget = t;
        return toRadians ? (t * Math.PI) / 180 : t;
      }
    }
    return toRadians ? (rawVal * Math.PI) / 180 : rawVal;
  };
}

function attachSliderEvents() {
  const stickyOffset = makeStickyHandler([-1, -0.5, 0, 0.5, 1], 0.05, 0.1);
  const stickyScale = makeStickyHandler([0.5, 1, 2, 3], 0.1, 0.2);
  const stickyRotation = makeStickyHandler([0, 90, 180, 270, 360], 10, 15, true);

  // Offset X
  const offXEl = document.getElementById("offsetX");
  offXEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    // use sticky handler on raw slider value (for rotation we used degrees)
    const snapped = stickyOffset(raw);
    layer.transform.offsetX = snapped;
    redrawImage(textureMode);
  });

  // Offset Y
  const offYEl = document.getElementById("offsetY");
  offYEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    const snapped = stickyOffset(raw);
    layer.transform.offsetY = snapped;
    redrawImage(textureMode);
  });

  // Scale
  const scaleEl = document.getElementById("scale");
  scaleEl.addEventListener("input", (e) => {
    const raw = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    const snapped = stickyScale(raw);
    layer.transform.scale = snapped;
    redrawImage(textureMode);
  });

  // Rotation
  const rotEl = document.getElementById("rotation");
  rotEl.addEventListener("input", (e) => {
    const rawDeg = parseFloat(e.target.value);
    const layer = getActiveLayer();
    if (!layer) return;
    const snappedDegOrRad = stickyRotation(rawDeg); // returns radians because toRadians=true
    layer.transform.rotation = snappedDegOrRad;
    redrawImage(textureMode);
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

document.getElementById("mugBtn").addEventListener("click", () => {
  resetLayers();
  loadGLBFromURL(MUG_GLB_PATH);
});

document.getElementById("handbagBtn").addEventListener("click", () => {
  resetLayers();
  loadGLBFromURL(HANDBAG_GLB_PATH);
});
document.getElementById("thermosBtn").addEventListener("click", () => {
  resetLayers();
  loadGLBFromURL(THERMOS_GLB_PATH);
});
document.getElementById("exportBtn").addEventListener("click", exportGLB);
document.getElementById("exportPngBtn").addEventListener("click", exportPNG);
document.getElementById("exportTextureBtn").addEventListener("click", exportTexture);
document.getElementById("exportTextureCutBtn").addEventListener("click", exportTextureCut);

// ===== MODEL LOADER =====
const gltfLoader = new GLTFLoader();

function loadGLBFromURL(urlOrFile) {
  setStatus("Loading model...");
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel = null;
    originalMaterials.clear();
  }

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
      }
    });

    scene.add(loadedModel);

    // build base canvases now that model is present (so mat.map.image is likely ready)
    buildPerMaterialBounds();

    // if user already uploaded some layers, redraw (otherwise model shows original materials)
    if (imageLayers.length > 0) {
      redrawImage(textureMode);
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

// initial load
loadGLBFromURL(MUG_GLB_PATH);

// ===== RENDER LOOP =====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------
// NEW: export full texture canvas (2048) + Add-to-Cart upload flow
// ------------------------------

function getFinalTextureCanvas() {
  if (!perMaterialBounds.size) return null;

  // We'll return the first material's full canvas (typical: "outside")
  let finalCanvas = null;
  perMaterialBounds.forEach((info) => {
    const { baseCanvas } = info;

    const canvas = document.createElement("canvas");
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(baseCanvas, 0, 0);

    // Vẽ tất cả các layer lên canvas base
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

    finalCanvas = canvas;
  });

  return finalCanvas;
}

async function exportFinalPNG() {
  const canvas = getFinalTextureCanvas();
  if (!canvas) {
    setStatus("⚠️ No texture canvas available.");
    return null;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

// Add to Cart flow:
// 1) exportFinalPNG() -> PNG blob
// 2) POST to /api/upload (Vercel) -> returns { url }
// 3) POST to /cart/add.js with properties including Custom Image URL
const ADD_TO_CART_BTN = document.getElementById("addToCartBtn");

// TODO: REPLACE with real Shopify variant id
const SHOPIFY_VARIANT_ID = 9999740371227;

ADD_TO_CART_BTN.addEventListener("click", async () => {
  try {
    setStatus("Preparing image...");
    const blob = await exportFinalPNG();
    if (!blob) {
      alert("Chưa có texture để upload.");
      return;
    }

    setStatus("Uploading image to server...");
    const form = new FormData();
    form.append("file", blob, "design.png");

    // NOTE: change to your Vercel domain or backend URL
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      console.error("Upload failed:", text);
      setStatus("❌ Upload failed");
      return;
    }

    const { url } = await uploadRes.json();
    if (!url) {
      setStatus("❌ Bad upload response");
      return;
    }

    setStatus("Adding item to cart...");
    // add to cart via Shopify's AJAX API
    const addRes = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: SHOPIFY_VARIANT_ID,
            quantity: 1,
            properties: {
              "Custom Image URL": url,
            },
          },
        ],
      }),
    });

    if (!addRes.ok) {
      const err = await addRes.text();
      console.error("Add to cart failed:", err);
      setStatus("❌ Add to cart failed");
      return;
    }

    setStatus("✅ Added to cart. Redirecting to /cart ...");
    window.location.href = "/cart";
  } catch (e) {
    console.error(e);
    setStatus("❌ Error: " + e.message);
  }
});
