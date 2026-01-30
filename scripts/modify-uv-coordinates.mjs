#!/usr/bin/env node

/**
 * Modify UV Coordinates for cue-butt.glb
 *
 * This script rescales the U coordinates of the RECTANGLE (Side) mesh
 * to achieve 1:1 pixel mapping with surface.jpg (1141 x 8359 pixels).
 *
 * Current UV state:
 *   U: 0.0000 -> 0.0700 (Width: 0.0700)
 *   V: 0.0000 -> 1.0000 (Height: 1.0000)
 *   Aspect: 0.07:1
 *
 * Target UV state:
 *   U: 0.0000 -> 0.1365 (Width: 1141/8359)
 *   V: 0.0000 -> 1.0000 (Height: 1.0000)
 *   Aspect: 0.1365:1
 *
 * Usage:
 *   node scripts/modify-uv-coordinates.mjs
 *
 * Requirements:
 *   npm install @gltf-transform/core @gltf-transform/extensions --save-dev
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEXTURE_WIDTH = 1141;
const TEXTURE_HEIGHT = 8359;
const TARGET_ASPECT = TEXTURE_WIDTH / TEXTURE_HEIGHT; // ~0.1365

const CURRENT_U_MIN = 0.0;
const CURRENT_U_MAX = 0.07;
const CURRENT_U_WIDTH = CURRENT_U_MAX - CURRENT_U_MIN;

const TARGET_U_WIDTH = TARGET_ASPECT; // ~0.1365
const SCALE_FACTOR = TARGET_U_WIDTH / CURRENT_U_WIDTH; // ~1.95

// File paths
const INPUT_FILE = join(__dirname, '..', 'public', 'cue-butt.glb');
const OUTPUT_FILE = join(__dirname, '..', 'public', 'cue-butt-fixed-uv.glb');

/**
 * @typedef {Object} UVStats
 * @property {number} minU - Minimum U coordinate
 * @property {number} maxU - Maximum U coordinate
 * @property {number} minV - Minimum V coordinate
 * @property {number} maxV - Maximum V coordinate
 * @property {number} count - Number of UV coordinates
 */

/**
 * Analyze UV coordinates in a mesh
 * @param {Float32Array} uvArray - The UV coordinate array
 * @returns {UVStats} Statistics about the UV coordinates
 */
function analyzeUVs(uvArray) {
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < uvArray.length; i += 2) {
    const u = uvArray[i];
    const v = uvArray[i + 1];

    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  return {
    minU,
    maxU,
    minV,
    maxV,
    count: uvArray.length / 2
  };
}

/**
 * Rescale U coordinates to match target aspect ratio
 * @param {Float32Array} uvArray - The UV coordinate array (modified in place)
 * @param {number} scaleFactor - The factor to scale U coordinates by
 */
function rescaleUCoordinates(uvArray, scaleFactor) {
  for (let i = 0; i < uvArray.length; i += 2) {
    // Scale U coordinate (index i)
    // V coordinate (index i+1) remains unchanged
    uvArray[i] = uvArray[i] * scaleFactor;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('UV Coordinate Modifier for cue-butt.glb');
  console.log('='.repeat(60));
  console.log('');
  console.log('Texture: surface.jpg');
  console.log(`  Dimensions: ${TEXTURE_WIDTH} x ${TEXTURE_HEIGHT} pixels`);
  console.log(`  Target aspect ratio: ${TARGET_ASPECT.toFixed(4)}:1`);
  console.log('');
  console.log('Current UV (RECTANGLE/Side mesh):');
  console.log(`  U range: ${CURRENT_U_MIN} -> ${CURRENT_U_MAX} (width: ${CURRENT_U_WIDTH})`);
  console.log(`  Aspect: ${CURRENT_U_WIDTH}:1`);
  console.log('');
  console.log('Target UV:');
  console.log(`  U range: 0 -> ${TARGET_U_WIDTH.toFixed(4)} (width: ${TARGET_U_WIDTH.toFixed(4)})`);
  console.log(`  Scale factor: ${SCALE_FACTOR.toFixed(4)}x`);
  console.log('');

  // Initialize glTF-Transform
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  // Read the GLB file
  console.log(`Loading: ${INPUT_FILE}`);
  const document = await io.read(INPUT_FILE);

  const root = document.getRoot();
  const meshes = root.listMeshes();

  console.log(`Found ${meshes.length} mesh(es)`);
  console.log('');

  let modifiedCount = 0;

  for (const mesh of meshes) {
    const meshName = mesh.getName() || 'Unnamed';
    console.log(`Processing mesh: ${meshName}`);

    const primitives = mesh.listPrimitives();

    for (let primIndex = 0; primIndex < primitives.length; primIndex++) {
      const primitive = primitives[primIndex];
      const texcoordAccessor = primitive.getAttribute('TEXCOORD_0');

      if (!texcoordAccessor) {
        console.log(`  Primitive ${primIndex}: No TEXCOORD_0 attribute, skipping`);
        continue;
      }

      // Get the UV array
      const uvArray = texcoordAccessor.getArray();

      if (!uvArray || uvArray.length === 0) {
        console.log(`  Primitive ${primIndex}: Empty UV array, skipping`);
        continue;
      }

      // Analyze before modification
      const beforeStats = analyzeUVs(uvArray);
      console.log(`  Primitive ${primIndex} BEFORE:`);
      console.log(`    U: ${beforeStats.minU.toFixed(4)} -> ${beforeStats.maxU.toFixed(4)} (width: ${(beforeStats.maxU - beforeStats.minU).toFixed(4)})`);
      console.log(`    V: ${beforeStats.minV.toFixed(4)} -> ${beforeStats.maxV.toFixed(4)} (height: ${(beforeStats.maxV - beforeStats.minV).toFixed(4)})`);
      console.log(`    UV count: ${beforeStats.count}`);

      // Check if this looks like the side mesh (V range should be 0-1 approximately)
      const vHeight = beforeStats.maxV - beforeStats.minV;
      const uWidth = beforeStats.maxU - beforeStats.minU;

      if (vHeight > 0.9 && uWidth < 0.2) {
        console.log(`    -> Detected as RECTANGLE (Side) mesh, applying UV rescale...`);

        // Create a new Float32Array with modified values
        const newUvArray = new Float32Array(uvArray.length);
        for (let i = 0; i < uvArray.length; i += 2) {
          newUvArray[i] = uvArray[i] * SCALE_FACTOR;
          newUvArray[i + 1] = uvArray[i + 1];
        }

        // Set the modified UV array back
        texcoordAccessor.setArray(newUvArray);

        // Analyze after modification
        const afterStats = analyzeUVs(newUvArray);
        console.log(`  Primitive ${primIndex} AFTER:`);
        console.log(`    U: ${afterStats.minU.toFixed(4)} -> ${afterStats.maxU.toFixed(4)} (width: ${(afterStats.maxU - afterStats.minU).toFixed(4)})`);
        console.log(`    V: ${afterStats.minV.toFixed(4)} -> ${afterStats.maxV.toFixed(4)} (height: ${(afterStats.maxV - afterStats.minV).toFixed(4)})`);

        modifiedCount++;
      } else {
        console.log(`    -> Not the RECTANGLE mesh (V height: ${vHeight.toFixed(2)}, U width: ${uWidth.toFixed(2)}), skipping`);
      }
    }
  }

  console.log('');

  if (modifiedCount > 0) {
    // Write the modified GLB
    console.log(`Saving modified GLB to: ${OUTPUT_FILE}`);
    await io.write(OUTPUT_FILE, document);

    console.log('');
    console.log('='.repeat(60));
    console.log('SUCCESS!');
    console.log('='.repeat(60));
    console.log(`Modified ${modifiedCount} primitive(s)`);
    console.log(`Output file: ${OUTPUT_FILE}`);
    console.log('');
    console.log('To use the fixed model, either:');
    console.log('  1. Rename cue-butt-fixed-uv.glb to cue-butt.glb');
    console.log('  2. Or update main.js to load cue-butt-fixed-uv.glb');
  } else {
    console.log('WARNING: No primitives were modified!');
    console.log('The RECTANGLE mesh might have different UV characteristics than expected.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
