# Texture Mapping Fix Analysis for Pool Cue Customizer

## 1. Problem Summary

The surface image (`surface.jpg`) is not displaying correctly on the pool cue 3D model due to a **fundamental aspect ratio mismatch** between the source image, the canvas texture, and the UV mapping region.

### The Core Issue

| Component | Dimensions | Aspect Ratio |
|-----------|------------|--------------|
| Surface Image (`surface.jpg`) | 1141 x 8359 px | ~1:7.33 (very tall/narrow) |
| Canvas Texture | 2048 x 2048 px | 1:1 (square) |
| `outside` Material UV Slot | U: 0-1, V: 0-0.498 | ~2:1 (wide/short) |

**What happens:**
1. The tall image (1:7.33) is drawn onto a square canvas (1:1) using "cover" mode
2. Cover mode fits the width and crops the height, showing only ~25% of the image
3. The `outside` material only uses the bottom 50% of UV space (V: 0-0.498)
4. Combined effect: Only ~12% of the original image is visible on the final texture

---

## 2. UV Mapping Explanation

### How the Model's UV Works

The `cue-butt.glb` model has a shared texture atlas approach:

```
Texture Space (0,0) to (1,1)
+---------------------------+
|                           |  V = 1.0 (top)
|    Mat_Body Material      |
|    (V: 0.5 to 0.99)       |
|    - Upper half of UV     |
|    - NOT customizable     |
|                           |
+---------------------------+  V = 0.498
|                           |
|    "outside" Material     |
|    (V: 0 to 0.498)        |
|    - Lower half of UV     |
|    - TARGET for custom    |
|      textures             |
|                           |
+---------------------------+  V = 0.0 (bottom)
U=0                       U=1
```

### UV Bounds for `outside` Material
- **U Range:** 0 to 1 (full horizontal width)
- **V Range:** 0 to ~0.498 (bottom half only)
- **UV Slot Aspect Ratio:** 1.0 / 0.498 = **~2.01:1** (wide rectangle)

This means the customizable area expects an image that is approximately **twice as wide as it is tall** in UV-normalized terms.

---

## 3. Image vs Canvas Mismatch

### Current Code Behavior (main.js)

**Line 771** forces UV bounds to full canvas:
```javascript
const uvBounds = { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };
```

This ignores the actual UV bounds calculated from the mesh geometry and maps the image to the **entire 2048x2048 canvas**.

### The Drawing Pipeline

```
Step 1: Load surface.jpg (1141 x 8359)
        Aspect ratio: 0.136:1 (very narrow)

Step 2: Draw to 2048x2048 canvas using "cover" mode
        - Canvas aspect: 1:1
        - Image is taller than canvas
        - Cover mode: fit width, crop height
        - Image scaled to: 2048 x 15025 pixels (scaled proportionally)
        - Only middle ~2048 pixels of height visible
        - Visible portion: 2048/15025 = ~13.6% of image height

Step 3: Material uses UV V: 0-0.498 (bottom half of canvas)
        - Canvas Y: 1024-2048 maps to V: 0-0.5
        - Further crops to 50% of the visible portion
        - Final visible: ~6.8% of original image

Step 4: Texture wraps around cylindrical cue geometry
        - The tiny visible strip is stretched around the cue
```

### Visual Representation of the Problem

```
Original Image (1141 x 8359):
+---+
|   |
|   |
|   | <- Only this small section
|###| <- is visible after cropping
|   |
|   |
|   |
|   |
+---+

After Cover Mode on 2048x2048:
+-------------+
|             |
|    ####     | <- Cropped horizontal band
|             |
+-------------+

After UV Mapping (V: 0-0.5):
+-------------+
|    ####     | <- This half maps to "outside" material
+-------------+
```

---

## 4. Solution Options

### Option A: Resize Image to Match UV Slot Aspect Ratio

**Approach:** Pre-process `surface.jpg` to match the aspect ratio of the `outside` UV slot (~2:1).

**Pros:**
- No code changes required
- Simple, one-time image preparation
- Predictable results

**Cons:**
- Image must be manually prepared
- Loses flexibility for different image sizes
- May distort the original design if not carefully cropped

**Implementation:**
1. Calculate target dimensions based on UV bounds
2. Resize/crop surface.jpg to approximately 2:1 aspect ratio
3. Recommended size: **2048 x 1024** or **4096 x 2048** pixels

---

### Option B: Modify Code to Map Image to Actual UV Bounds

**Approach:** Change the code to use the **actual UV bounds** from the mesh instead of forcing full 0-1 range.

**Key Changes in `redrawImage()` function:**

**Current (Line 771):**
```javascript
const uvBounds = { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };
```

**Proposed:**
```javascript
// Use actual UV bounds from mesh geometry
const actualBounds = entries[0] || { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };
const uvBounds = actualBounds;
```

**Pros:**
- Works with any image size/aspect ratio
- Automatic adaptation to model UV changes
- More flexible for future models

**Cons:**
- Code changes required
- Must handle edge cases (multiple entries, etc.)
- Cover mode may still crop tall images significantly

---

### Option C: Hybrid Approach (Recommended)

**Approach:** Combine code fixes with image guidelines:

1. **Code Change:** Use actual UV bounds in `redrawImage()`
2. **Image Preparation:** Provide recommended dimensions
3. **UI Enhancement:** Add scale adjustment for proper fit

**Implementation Steps:**

1. Modify `redrawImage()` to use actual UV bounds
2. Adjust "cover" mode logic to handle extreme aspect ratios better
3. Pre-rotate the surface image if needed (cue is cylindrical)
4. Document recommended image dimensions

---

## 5. Recommended Solution

Given that the user prefers **NOT changing the 3D model**, the recommended solution is **Option C (Hybrid)** with emphasis on:

### Primary Fix: Code Modification

Modify `main.js` to properly map images to the actual UV bounds of the `outside` material.

### Secondary: Image Dimension Guidelines

Provide clear guidelines for optimal image dimensions.

---

## 6. Required Code Changes

### Change 1: Use Actual UV Bounds (Line 768-775)

**File:** `/Users/an/Documents/shopify-customizer/src/main.js`

**Current Code (Lines 768-775):**
```javascript
// Use FULL canvas (0-1 UV range) for texture application
// The "outside" material should receive texture across its entire UV space
// The mesh's UV mapping will handle where the texture appears on the geometry
const uvBounds = { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };

console.log("[redrawImage] Using FULL UV bounds (0-1) for material:", mat.name);
console.log("[redrawImage] Actual mesh UV entries:", entries);
```

**Proposed Code:**
```javascript
// Use ACTUAL UV bounds from mesh geometry for proper texture placement
// This ensures the image is drawn only where the material expects it
const actualBounds = entries.length > 0 ? entries[0] : null;
const uvBounds = actualBounds || { minU: 0, maxU: 1, minV: 0, maxV: 1, width: 1, height: 1 };

console.log("[redrawImage] Using UV bounds for material:", mat.name, uvBounds);
```

### Change 2: Adjust Cover Mode for Extreme Aspect Ratios (Lines 794-818)

The current cover mode logic may need adjustment for extreme aspect ratio mismatches.

**Consider Adding Before Cover Mode Logic:**
```javascript
// Calculate aspect ratio mismatch factor
const imgAspect = img.width / img.height;
const rectAspect = rectW / rectH;
const aspectMismatch = Math.abs(imgAspect - rectAspect) / Math.max(imgAspect, rectAspect);

// For extreme mismatches (>50%), consider using "contain" mode or scaling differently
if (aspectMismatch > 0.5) {
  console.warn("[redrawImage] Extreme aspect ratio mismatch:", imgAspect, "vs", rectAspect);
  // Option: Auto-adjust or warn user
}
```

### Change 3: Fix Initial Scale Calculation (Lines 563-591)

The `calculateInitialScale()` function should account for the actual UV bounds properly.

**Current Issue:** The function attempts to use UV bounds but the calculation may not correctly compensate for the aspect ratio difference.

**Recommendation:** Revise to calculate scale that makes the image visible within the UV slot:

```javascript
function calculateInitialScale(imgWidth, imgHeight) {
  let uvWidth = 1.0;
  let uvHeight = 0.498; // Default for "outside" material

  if (perMaterialBounds.size > 0) {
    perMaterialBounds.forEach((info) => {
      if (info.entries && info.entries.length > 0) {
        const bounds = info.entries[0];
        uvWidth = bounds.width || 1.0;
        uvHeight = bounds.height || 0.498;
      }
    });
  }

  const imgAspect = imgWidth / imgHeight;
  const uvAspect = uvWidth / uvHeight; // ~2.01:1 for "outside"

  // Scale to fit the image within the UV slot
  // For tall images on wide UV slots, scale up to fill width
  let scale = 1.0;

  if (imgAspect < uvAspect) {
    // Image is taller than UV slot - this is our case
    // Scale based on fitting the height properly
    scale = uvAspect / imgAspect;
  }

  return Math.round(scale * 100) / 100;
}
```

---

## 7. Image Dimension Recommendations

### Optimal Dimensions for `surface.jpg`

Based on the UV slot aspect ratio (~2:1) and the canvas size (2048x2048):

| Quality Level | Dimensions | Aspect Ratio | File Size Est. |
|---------------|------------|--------------|----------------|
| Standard | 2048 x 1024 | 2:1 | ~500KB |
| High | 4096 x 2048 | 2:1 | ~2MB |
| Maximum | 4096 x 2048 | 2:1 | ~2MB |

**Note:** The canvas is 2048x2048, but only the bottom ~50% (2048x1024) is used by the `outside` material. Therefore:

- **Recommended size:** `2048 x 1024` pixels
- **Aspect ratio:** 2:1 (matching UV slot)
- **Orientation:** Horizontal (width > height)

### If Keeping the Tall Image Format

If the surface design must remain in the 1:7.33 aspect ratio (for wrapping around the cylindrical cue multiple times):

1. The code should tile/repeat the image horizontally
2. Modify `tex.wrapS` handling for cylindrical wrap
3. Consider segmenting the tall image into the visible portion only

### Image Preparation Steps

1. **Determine visible area:** Only ~14% of the tall image is currently visible
2. **Extract relevant portion:** Crop to the section meant to be visible
3. **Resize to target:** Scale to 2048x1024 or similar 2:1 ratio
4. **Test and adjust:** Load in the customizer and verify appearance

---

## Summary

| Issue | Cause | Solution |
|-------|-------|----------|
| Only ~12% of image visible | Cover mode + UV cropping | Use actual UV bounds in code |
| Aspect ratio mismatch | 1:7.33 image vs 2:1 UV slot | Resize image OR adjust scale logic |
| Hardcoded UV bounds | Line 771 forces 0-1 range | Use calculated bounds from mesh |

### Priority Actions

1. **Immediate:** Change Line 771 to use actual UV bounds from `entries`
2. **Short-term:** Resize `surface.jpg` to 2:1 aspect ratio (2048x1024)
3. **Optional:** Add user feedback for extreme aspect ratio mismatches

---

## Appendix: UV Bounds Debug Output

When loading the cue model, the console should show:
```
[Material Match] Using material: "outside" from mesh: "..."
[Material Match] UV bounds from mesh: {minU: 0, maxU: 1, minV: 0, maxV: 0.497964, width: 1, height: 0.497964}
```

This confirms the `outside` material uses only the bottom half of the texture space.
