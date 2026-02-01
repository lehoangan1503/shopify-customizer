"""
Blender script to smooth a GLB model while preserving appearance.
Run with: /Applications/Blender.app/Contents/MacOS/Blender --background --python smooth_cue.py

This script:
1. Imports the original GLB
2. Applies smooth shading with weighted normals
3. Exports a new smoothed version
"""

import bpy
import sys
import os
import math

# Configuration
INPUT_PATH = "/Users/an/Documents/shopify-customizer/public/cue-butt.glb"
OUTPUT_PATH = "/Users/an/Documents/shopify-customizer/public/cue-butt-smooth.glb"
SMOOTH_ANGLE = 60  # degrees - edges sharper than this stay sharp
USE_SUBDIVISION = False  # Set True for more geometry (larger file)
SUBDIVISION_LEVELS = 1

def clear_scene():
    """Remove all objects from the scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)

def import_glb(filepath):
    """Import GLB file"""
    print(f"Importing: {filepath}")
    bpy.ops.import_scene.gltf(filepath=filepath)
    print(f"Imported {len(bpy.context.selected_objects)} objects")

def apply_smooth_shading():
    """Apply smooth shading to all mesh objects using Blender 4.5 compatible methods"""

    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue

        print(f"Processing mesh: {obj.name}")

        # Select and make active
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        # Get mesh data
        mesh = obj.data

        # Apply smooth shading to all faces
        bpy.ops.object.shade_smooth()

        # In Blender 4.5+, smooth normals are handled differently
        # We use the EDGE_SPLIT modifier to mark sharp edges, then WEIGHTED_NORMAL
        blender_version = bpy.app.version
        print(f"  Blender version: {blender_version[0]}.{blender_version[1]}.{blender_version[2]}")

        # Method 1: Use Edge Split modifier to control sharp edges
        # This preserves sharp edges while smoothing the rest
        edge_split = obj.modifiers.new(name="EdgeSplit", type='EDGE_SPLIT')
        edge_split.split_angle = math.radians(SMOOTH_ANGLE)
        edge_split.use_edge_sharp = True
        edge_split.use_edge_angle = True
        print(f"  Added Edge Split modifier (angle: {SMOOTH_ANGLE}°)")

        # Method 2: Add Weighted Normal modifier for better shading on curved surfaces
        weighted_normal = obj.modifiers.new(name="WeightedNormal", type='WEIGHTED_NORMAL')
        weighted_normal.mode = 'FACE_AREA'  # Weight by face area - good for cylindrical shapes
        weighted_normal.weight = 50  # Strength of the effect
        weighted_normal.keep_sharp = True  # Respect sharp edges
        print(f"  Added Weighted Normal modifier")

        # Optionally add subdivision for smoother geometry
        if USE_SUBDIVISION:
            print(f"  Adding subdivision (level {SUBDIVISION_LEVELS})")
            subdiv = obj.modifiers.new(name="Subdivision", type='SUBSURF')
            subdiv.levels = SUBDIVISION_LEVELS
            subdiv.render_levels = SUBDIVISION_LEVELS
            subdiv.subdivision_type = 'CATMULL_CLARK'

        obj.select_set(False)

def apply_modifiers():
    """Apply all modifiers to meshes (bakes them into geometry)"""
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue

        print(f"Applying modifiers for: {obj.name}")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        # Apply modifiers in order
        for mod in obj.modifiers[:]:  # Copy list since we're modifying it
            try:
                print(f"  Applying: {mod.name}")
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as e:
                print(f"  Warning: Could not apply {mod.name}: {e}")

        obj.select_set(False)

def export_glb(filepath):
    """Export scene as GLB"""
    print(f"Exporting to: {filepath}")

    # Select all mesh objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            obj.select_set(True)

    # Export with optimal settings - Blender 4.5 compatible
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,  # Export all
        export_apply=True,    # Apply modifiers
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )

    # Get file size
    size = os.path.getsize(filepath)
    print(f"Export complete! File size: {size:,} bytes")

def main():
    print("=" * 60)
    print("Smoothing GLB Model for Pool Cue")
    print("=" * 60)

    # Clear existing scene
    clear_scene()

    # Import the model
    import_glb(INPUT_PATH)

    # Apply smooth shading
    apply_smooth_shading()

    # Apply modifiers to bake into geometry
    apply_modifiers()

    # Export the smoothed model
    export_glb(OUTPUT_PATH)

    # Also get original file size for comparison
    orig_size = os.path.getsize(INPUT_PATH)
    new_size = os.path.getsize(OUTPUT_PATH)

    print("=" * 60)
    print("Done!")
    print(f"Original: {INPUT_PATH} ({orig_size:,} bytes)")
    print(f"Smoothed: {OUTPUT_PATH} ({new_size:,} bytes)")
    print("=" * 60)

if __name__ == "__main__":
    main()
