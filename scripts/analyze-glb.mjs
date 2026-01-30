/**
 * GLB Model Analyzer
 * Extracts detailed information about meshes, materials, and UV mappings from GLB files
 */

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as fs from 'fs';
import * as path from 'path';

const GLB_PATH = process.argv[2] || './public/cue-butt.glb';
const OUTPUT_PATH = process.argv[3] || './ANALYSIS.md';

/**
 * @typedef {Object} MeshInfo
 * @property {string} name
 * @property {string[]} materials
 * @property {Object|null} uvBounds
 * @property {number} vertexCount
 * @property {number} indexCount
 */

/**
 * @typedef {Object} MaterialInfo
 * @property {string} name
 * @property {string} type
 * @property {Object|null} baseColorTexture
 * @property {Object|null} baseColorFactor
 */

/**
 * Calculate UV bounds from accessor data
 * @param {import('@gltf-transform/core').Accessor} uvAccessor
 * @returns {Object} UV bounds
 */
function calculateUVBounds(uvAccessor) {
  if (!uvAccessor) return null;

  const uvArray = uvAccessor.getArray();
  const count = uvAccessor.getCount();

  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < count; i++) {
    const u = uvArray[i * 2];
    const v = uvArray[i * 2 + 1];

    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  return {
    minU: parseFloat(minU.toFixed(6)),
    maxU: parseFloat(maxU.toFixed(6)),
    minV: parseFloat(minV.toFixed(6)),
    maxV: parseFloat(maxV.toFixed(6)),
    width: parseFloat((maxU - minU).toFixed(6)),
    height: parseFloat((maxV - minV).toFixed(6)),
    vertexCount: count
  };
}

/**
 * Get texture info from material
 * @param {import('@gltf-transform/core').Texture|null} texture
 * @returns {Object|null}
 */
function getTextureInfo(texture) {
  if (!texture) return null;

  const image = texture.getImage();
  const size = texture.getSize();

  return {
    name: texture.getName() || '(unnamed)',
    uri: texture.getURI() || '(embedded)',
    mimeType: texture.getMimeType(),
    size: size ? { width: size[0], height: size[1] } : null,
    imageSize: image ? image.byteLength : 0
  };
}

async function analyzeGLB(glbPath) {
  console.log(`\nAnalyzing: ${glbPath}\n`);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(glbPath);
  const root = document.getRoot();

  const analysis = {
    modelPath: glbPath,
    scenes: [],
    meshes: [],
    materials: [],
    textures: [],
    nodeHierarchy: []
  };

  // Get scenes
  const scenes = root.listScenes();
  analysis.scenes = scenes.map(scene => ({
    name: scene.getName() || '(default)',
    nodeCount: scene.listChildren().length
  }));

  // Get all nodes (hierarchy)
  const nodes = root.listNodes();
  nodes.forEach(node => {
    const mesh = node.getMesh();
    const nodeInfo = {
      name: node.getName() || '(unnamed)',
      hasMesh: !!mesh,
      meshName: mesh ? (mesh.getName() || '(unnamed)') : null,
      translation: node.getTranslation(),
      rotation: node.getRotation(),
      scale: node.getScale(),
      childCount: node.listChildren().length
    };
    analysis.nodeHierarchy.push(nodeInfo);
  });

  // Get all meshes with detailed UV analysis
  const meshes = root.listMeshes();
  meshes.forEach(mesh => {
    const primitives = mesh.listPrimitives();

    primitives.forEach((primitive, primIdx) => {
      const material = primitive.getMaterial();
      const positionAccessor = primitive.getAttribute('POSITION');
      const uvAccessor = primitive.getAttribute('TEXCOORD_0');
      const indexAccessor = primitive.getIndices();

      const meshInfo = {
        meshName: mesh.getName() || '(unnamed)',
        primitiveIndex: primIdx,
        materialName: material ? (material.getName() || '(unnamed)') : '(no material)',
        vertexCount: positionAccessor ? positionAccessor.getCount() : 0,
        indexCount: indexAccessor ? indexAccessor.getCount() : 0,
        hasUV: !!uvAccessor,
        uvBounds: calculateUVBounds(uvAccessor),
        attributes: []
      };

      // List all attributes
      const semantics = primitive.listSemantics();
      semantics.forEach(semantic => {
        const accessor = primitive.getAttribute(semantic);
        meshInfo.attributes.push({
          semantic,
          count: accessor ? accessor.getCount() : 0,
          type: accessor ? accessor.getType() : 'unknown'
        });
      });

      analysis.meshes.push(meshInfo);
    });
  });

  // Get all materials
  const materials = root.listMaterials();
  materials.forEach(material => {
    const baseColorTexture = material.getBaseColorTexture();
    const baseColorFactor = material.getBaseColorFactor();

    const matInfo = {
      name: material.getName() || '(unnamed)',
      alphaMode: material.getAlphaMode(),
      doubleSided: material.getDoubleSided(),
      baseColorFactor: baseColorFactor,
      hasBaseColorTexture: !!baseColorTexture,
      baseColorTexture: getTextureInfo(baseColorTexture),
      metallicFactor: material.getMetallicFactor(),
      roughnessFactor: material.getRoughnessFactor(),
      normalTexture: getTextureInfo(material.getNormalTexture()),
      emissiveFactor: material.getEmissiveFactor()
    };

    analysis.materials.push(matInfo);
  });

  // Get all textures
  const textures = root.listTextures();
  textures.forEach(texture => {
    analysis.textures.push(getTextureInfo(texture));
  });

  return analysis;
}

/**
 * Generate markdown report
 * @param {Object} analysis
 * @returns {string}
 */
function generateMarkdown(analysis) {
  let md = `# GLB Model Analysis: cue-butt.glb

**File:** \`${analysis.modelPath}\`
**Generated:** ${new Date().toISOString()}

---

## Summary

- **Scenes:** ${analysis.scenes.length}
- **Meshes/Primitives:** ${analysis.meshes.length}
- **Materials:** ${analysis.materials.length}
- **Textures:** ${analysis.textures.length}
- **Nodes:** ${analysis.nodeHierarchy.length}

---

## Node Hierarchy

| Node Name | Has Mesh | Mesh Name | Children |
|-----------|----------|-----------|----------|
`;

  analysis.nodeHierarchy.forEach(node => {
    md += `| ${node.name} | ${node.hasMesh ? 'Yes' : 'No'} | ${node.meshName || '-'} | ${node.childCount} |\n`;
  });

  md += `
---

## Meshes and UV Mapping

`;

  analysis.meshes.forEach((mesh, idx) => {
    md += `### ${idx + 1}. Mesh: "${mesh.meshName}" (Primitive ${mesh.primitiveIndex})

- **Material:** \`${mesh.materialName}\`
- **Vertices:** ${mesh.vertexCount}
- **Indices:** ${mesh.indexCount}
- **Has UVs:** ${mesh.hasUV ? 'Yes' : 'No'}

`;

    if (mesh.uvBounds) {
      md += `#### UV Bounds (TEXCOORD_0)

| Property | Value |
|----------|-------|
| Min U | ${mesh.uvBounds.minU} |
| Max U | ${mesh.uvBounds.maxU} |
| Min V | ${mesh.uvBounds.minV} |
| Max V | ${mesh.uvBounds.maxV} |
| **Width** | **${mesh.uvBounds.width}** |
| **Height** | **${mesh.uvBounds.height}** |
| Vertex Count | ${mesh.uvBounds.vertexCount} |

`;
    }

    if (mesh.attributes.length > 0) {
      md += `#### Attributes

| Semantic | Count | Type |
|----------|-------|------|
`;
      mesh.attributes.forEach(attr => {
        md += `| ${attr.semantic} | ${attr.count} | ${attr.type} |\n`;
      });
      md += '\n';
    }
  });

  md += `---

## Materials

`;

  analysis.materials.forEach((mat, idx) => {
    md += `### ${idx + 1}. Material: "${mat.name}"

| Property | Value |
|----------|-------|
| Alpha Mode | ${mat.alphaMode} |
| Double Sided | ${mat.doubleSided} |
| Metallic Factor | ${mat.metallicFactor} |
| Roughness Factor | ${mat.roughnessFactor} |
| Base Color Factor | [${mat.baseColorFactor.map(v => v.toFixed(3)).join(', ')}] |
| Has Base Color Texture | ${mat.hasBaseColorTexture ? 'Yes' : 'No'} |

`;

    if (mat.baseColorTexture) {
      md += `#### Base Color Texture

| Property | Value |
|----------|-------|
| Name | ${mat.baseColorTexture.name} |
| URI | ${mat.baseColorTexture.uri} |
| MIME Type | ${mat.baseColorTexture.mimeType} |
| Dimensions | ${mat.baseColorTexture.size ? `${mat.baseColorTexture.size.width} x ${mat.baseColorTexture.size.height}` : 'Unknown'} |
| Image Size | ${mat.baseColorTexture.imageSize} bytes |

`;
    }

    if (mat.normalTexture) {
      md += `#### Normal Texture

| Property | Value |
|----------|-------|
| Name | ${mat.normalTexture.name} |
| MIME Type | ${mat.normalTexture.mimeType} |
| Dimensions | ${mat.normalTexture.size ? `${mat.normalTexture.size.width} x ${mat.normalTexture.size.height}` : 'Unknown'} |

`;
    }
  });

  md += `---

## Textures

`;

  if (analysis.textures.length === 0) {
    md += '_No textures embedded in this model._\n\n';
  } else {
    md += `| # | Name | MIME Type | Dimensions | Size |
|---|------|-----------|------------|------|
`;
    analysis.textures.forEach((tex, idx) => {
      const dims = tex.size ? `${tex.size.width} x ${tex.size.height}` : 'Unknown';
      md += `| ${idx + 1} | ${tex.name} | ${tex.mimeType} | ${dims} | ${tex.imageSize} bytes |\n`;
    });
  }

  md += `
---

## Target Material for Customization

Based on the analysis, the following material(s) match the naming convention for customization:

`;

  // Find target materials (containing "outside" or "butt_body")
  const targetMaterials = analysis.materials.filter(mat => {
    const name = mat.name.toLowerCase();
    return name.includes('outside') || name.includes('butt_body') || name.includes('body');
  });

  const targetMeshes = analysis.meshes.filter(mesh => {
    const meshName = mesh.meshName.toLowerCase();
    const matName = mesh.materialName.toLowerCase();
    return meshName.includes('outside') || matName.includes('outside') ||
           meshName.includes('butt_body') || matName.includes('butt_body') ||
           meshName.includes('body') || matName.includes('body');
  });

  if (targetMaterials.length > 0 || targetMeshes.length > 0) {
    md += `### Matched Materials/Meshes

`;
    targetMeshes.forEach(mesh => {
      md += `- **Mesh:** "${mesh.meshName}" with material "${mesh.materialName}"
  - UV Range: U [${mesh.uvBounds?.minU} - ${mesh.uvBounds?.maxU}], V [${mesh.uvBounds?.minV} - ${mesh.uvBounds?.maxV}]
  - UV Dimensions: ${mesh.uvBounds?.width} x ${mesh.uvBounds?.height}

`;
    });
  } else {
    md += `_No materials/meshes found matching "outside", "butt_body", or "body" naming convention._

**Fallback:** The first mesh with UV coordinates will be used.
`;
  }

  md += `
---

## Recommendations for Texture Application

`;

  // Find the best target mesh
  const primaryTarget = targetMeshes[0] || analysis.meshes.find(m => m.hasUV);

  if (primaryTarget && primaryTarget.uvBounds) {
    const bounds = primaryTarget.uvBounds;
    const canvasSize = 2048;

    md += `Based on the UV analysis of "${primaryTarget.meshName}":

### Texture Canvas Calculation

\`\`\`javascript
const CANVAS_SIZE = ${canvasSize};

// UV bounds from model analysis
const UV_BOUNDS = {
  minU: ${bounds.minU},
  maxU: ${bounds.maxU},
  minV: ${bounds.minV},
  maxV: ${bounds.maxV},
  width: ${bounds.width},
  height: ${bounds.height}
};

// Pixel coordinates for the customizable region
const REGION = {
  x: Math.floor(UV_BOUNDS.minU * CANVAS_SIZE),      // ${Math.floor(bounds.minU * canvasSize)}
  y: Math.floor((1 - UV_BOUNDS.maxV) * CANVAS_SIZE), // ${Math.floor((1 - bounds.maxV) * canvasSize)}
  width: Math.ceil(UV_BOUNDS.width * CANVAS_SIZE),   // ${Math.ceil(bounds.width * canvasSize)}
  height: Math.ceil(UV_BOUNDS.height * CANVAS_SIZE)  // ${Math.ceil(bounds.height * canvasSize)}
};
\`\`\`

### Key Observations

1. **UV Coverage:** The customizable surface uses ${(bounds.width * 100).toFixed(1)}% of U range and ${(bounds.height * 100).toFixed(1)}% of V range
2. **Aspect Ratio:** ${(bounds.width / bounds.height).toFixed(3)} (width/height in UV space)
3. **Recommended Texture Size:** ${canvasSize}x${canvasSize} pixels (matches CANVAS_SIZE in main.js)

`;
  }

  return md;
}

// Main execution
async function main() {
  try {
    const analysis = await analyzeGLB(GLB_PATH);
    const markdown = generateMarkdown(analysis);

    fs.writeFileSync(OUTPUT_PATH, markdown);
    console.log(`Analysis written to: ${OUTPUT_PATH}`);

    // Also output JSON for debugging
    const jsonPath = OUTPUT_PATH.replace('.md', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
    console.log(`JSON data written to: ${jsonPath}`);

    // Print summary to console
    console.log('\n=== Quick Summary ===');
    console.log(`Meshes: ${analysis.meshes.length}`);
    console.log(`Materials: ${analysis.materials.length}`);
    console.log(`Textures: ${analysis.textures.length}`);

    console.log('\n=== Meshes with UV ===');
    analysis.meshes.filter(m => m.hasUV).forEach(m => {
      console.log(`  ${m.meshName} (${m.materialName}): U[${m.uvBounds.minU}-${m.uvBounds.maxU}] V[${m.uvBounds.minV}-${m.uvBounds.maxV}]`);
    });

    console.log('\n=== Materials ===');
    analysis.materials.forEach(m => {
      console.log(`  ${m.name}: hasTexture=${m.hasBaseColorTexture}`);
    });

  } catch (error) {
    console.error('Error analyzing GLB:', error);
    process.exit(1);
  }
}

main();
