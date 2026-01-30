# GLB Model Analysis: cue-butt.glb

**File:** `./public/cue-butt.glb`
**Generated:** 2026-01-30T15:21:03.970Z

---

## Summary

- **Scenes:** 1
- **Meshes/Primitives:** 4
- **Materials:** 4
- **Textures:** 0
- **Nodes:** 3

---

## Node Hierarchy

| Node Name | Has Mesh | Mesh Name | Children |
|-----------|----------|-----------|----------|
| AI_CUE_butt_body | Yes | Cone.048 | 0 |
| AI_CUE_joint_cover | Yes | Cone.051 | 0 |
| AI_CUE_bumper | Yes | Cylinder.050 | 0 |

---

## Meshes and UV Mapping

### 1. Mesh: "Cone.048" (Primitive 0)

- **Material:** `Mat_Body`
- **Vertices:** 16007
- **Indices:** 76020
- **Has UVs:** Yes

#### UV Bounds (TEXCOORD_0)

| Property | Value |
|----------|-------|
| Min U | 0 |
| Max U | 1 |
| Min V | 0.497964 |
| Max V | 0.99 |
| **Width** | **1** |
| **Height** | **0.492036** |
| Vertex Count | 16007 |

#### Attributes

| Semantic | Count | Type |
|----------|-------|------|
| POSITION | 16007 | VEC3 |
| NORMAL | 16007 | VEC3 |
| TEXCOORD_0 | 16007 | VEC2 |

### 2. Mesh: "Cone.048" (Primitive 1)

- **Material:** `outside`
- **Vertices:** 20935
- **Indices:** 92928
- **Has UVs:** Yes

#### UV Bounds (TEXCOORD_0)

| Property | Value |
|----------|-------|
| Min U | 0 |
| Max U | 1 |
| Min V | 0 |
| Max V | 0.497964 |
| **Width** | **1** |
| **Height** | **0.497964** |
| Vertex Count | 20935 |

#### Attributes

| Semantic | Count | Type |
|----------|-------|------|
| POSITION | 20935 | VEC3 |
| NORMAL | 20935 | VEC3 |
| TEXCOORD_0 | 20935 | VEC2 |

### 3. Mesh: "Cone.051" (Primitive 0)

- **Material:** `Mat_JointCover`
- **Vertices:** 10175
- **Indices:** 41412
- **Has UVs:** Yes

#### UV Bounds (TEXCOORD_0)

| Property | Value |
|----------|-------|
| Min U | 0 |
| Max U | 1 |
| Min V | 0 |
| Max V | 1 |
| **Width** | **1** |
| **Height** | **1** |
| Vertex Count | 10175 |

#### Attributes

| Semantic | Count | Type |
|----------|-------|------|
| POSITION | 10175 | VEC3 |
| NORMAL | 10175 | VEC3 |
| TEXCOORD_0 | 10175 | VEC2 |

### 4. Mesh: "Cylinder.050" (Primitive 0)

- **Material:** `Mat_Bumper`
- **Vertices:** 1285
- **Indices:** 6132
- **Has UVs:** Yes

#### UV Bounds (TEXCOORD_0)

| Property | Value |
|----------|-------|
| Min U | 0 |
| Max U | 1 |
| Min V | 0.25 |
| Max V | 0.989993 |
| **Width** | **1** |
| **Height** | **0.739993** |
| Vertex Count | 1285 |

#### Attributes

| Semantic | Count | Type |
|----------|-------|------|
| POSITION | 1285 | VEC3 |
| NORMAL | 1285 | VEC3 |
| TEXCOORD_0 | 1285 | VEC2 |

---

## Materials

### 1. Material: "Mat_Body"

| Property | Value |
|----------|-------|
| Alpha Mode | OPAQUE |
| Double Sided | true |
| Metallic Factor | 0 |
| Roughness Factor | 0.44999998807907104 |
| Base Color Factor | [0.700, 0.700, 0.700, 1.000] |
| Has Base Color Texture | No |

### 2. Material: "outside"

| Property | Value |
|----------|-------|
| Alpha Mode | OPAQUE |
| Double Sided | true |
| Metallic Factor | 0 |
| Roughness Factor | 0.5 |
| Base Color Factor | [0.800, 0.800, 0.800, 1.000] |
| Has Base Color Texture | No |

### 3. Material: "Mat_JointCover"

| Property | Value |
|----------|-------|
| Alpha Mode | OPAQUE |
| Double Sided | true |
| Metallic Factor | 0 |
| Roughness Factor | 0.44999998807907104 |
| Base Color Factor | [0.030, 0.030, 0.030, 1.000] |
| Has Base Color Texture | No |

### 4. Material: "Mat_Bumper"

| Property | Value |
|----------|-------|
| Alpha Mode | OPAQUE |
| Double Sided | true |
| Metallic Factor | 0 |
| Roughness Factor | 0.44999998807907104 |
| Base Color Factor | [0.060, 0.060, 0.060, 1.000] |
| Has Base Color Texture | No |

---

## Textures

_No textures embedded in this model._


---

## Target Material for Customization

Based on the analysis, the following material(s) match the naming convention for customization:

### Matched Materials/Meshes

- **Mesh:** "Cone.048" with material "Mat_Body"
  - UV Range: U [0 - 1], V [0.497964 - 0.99]
  - UV Dimensions: 1 x 0.492036

- **Mesh:** "Cone.048" with material "outside"
  - UV Range: U [0 - 1], V [0 - 0.497964]
  - UV Dimensions: 1 x 0.497964


---

## Recommendations for Texture Application

Based on the UV analysis of "Cone.048":

### Texture Canvas Calculation

```javascript
const CANVAS_SIZE = 2048;

// UV bounds from model analysis
const UV_BOUNDS = {
  minU: 0,
  maxU: 1,
  minV: 0.497964,
  maxV: 0.99,
  width: 1,
  height: 0.492036
};

// Pixel coordinates for the customizable region
const REGION = {
  x: Math.floor(UV_BOUNDS.minU * CANVAS_SIZE),      // 0
  y: Math.floor((1 - UV_BOUNDS.maxV) * CANVAS_SIZE), // 20
  width: Math.ceil(UV_BOUNDS.width * CANVAS_SIZE),   // 2048
  height: Math.ceil(UV_BOUNDS.height * CANVAS_SIZE)  // 1008
};
```

### Key Observations

1. **UV Coverage:** The customizable surface uses 100.0% of U range and 49.2% of V range
2. **Aspect Ratio:** 2.032 (width/height in UV space)
3. **Recommended Texture Size:** 2048x2048 pixels (matches CANVAS_SIZE in main.js)

