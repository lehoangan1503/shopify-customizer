"""
Blender Python Script - Cue Stick 3D Model Generator
Creates a beautiful cue stick with a customizable material zone on the lower half.

Run this script in Blender:
1. Open Blender
2. Go to Scripting workspace
3. Open this file and click "Run Script"
4. Export as GLB: File > Export > glTF 2.0 (.glb)
"""

import bpy
import bmesh
import math

def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear all materials
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)

    # Clear all meshes
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

def create_cue_stick():
    """Create a realistic cue stick with proper segments."""

    # Cue stick dimensions (in meters, scaled for Three.js)
    total_length = 1.5  # Total cue length

    # Segment definitions: (length, radius_start, radius_end, name, is_customizable)
    segments = [
        # Tip and ferrule (top)
        (0.01, 0.006, 0.006, "Tip", False),
        (0.025, 0.006, 0.007, "Ferrule", False),

        # Shaft (upper section - tapered)
        (0.35, 0.007, 0.010, "Shaft", False),

        # Joint/collar
        (0.02, 0.012, 0.012, "Joint", False),

        # Forearm (transition to butt)
        (0.25, 0.012, 0.014, "Forearm", False),

        # === CUSTOMIZABLE SECTION (lower half) ===
        (0.45, 0.014, 0.015, "CustomWrap", True),  # Main wrap area

        # Butt sleeve
        (0.15, 0.015, 0.016, "ButtSleeve", False),

        # Bumper (bottom)
        (0.025, 0.016, 0.014, "Bumper", False),
    ]

    z_offset = 0
    all_objects = []
    customizable_objects = []

    for length, r_start, r_end, name, is_custom in segments:
        # Create cylinder for this segment
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=32,
            radius=r_start,
            depth=length,
            location=(0, 0, z_offset + length/2)
        )

        obj = bpy.context.active_object
        obj.name = name

        # Taper the cylinder if radii are different
        if r_start != r_end:
            bpy.ops.object.mode_set(mode='EDIT')
            bm = bmesh.from_edit_mesh(obj.data)

            # Select top vertices and scale them
            for v in bm.verts:
                if v.co.z > 0:  # Top half
                    scale_factor = r_end / r_start
                    v.co.x *= scale_factor
                    v.co.y *= scale_factor

            bmesh.update_edit_mesh(obj.data)
            bpy.ops.object.mode_set(mode='OBJECT')

        # Create and assign material
        mat = bpy.data.materials.new(name=f"{name}_Material")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        principled = nodes.get("Principled BSDF")

        if is_custom:
            # Customizable material - white base for texture overlay
            principled.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
            principled.inputs["Metallic"].default_value = 0.0
            principled.inputs["Roughness"].default_value = 0.3
            mat.name = "CustomizableLayer"  # Important: matches Three.js material search
            customizable_objects.append(obj)
        else:
            # Non-customizable sections - wood/metal colors
            if name == "Tip":
                principled.inputs["Base Color"].default_value = (0.1, 0.15, 0.3, 1.0)  # Blue tip
                principled.inputs["Roughness"].default_value = 0.8
            elif name == "Ferrule":
                principled.inputs["Base Color"].default_value = (0.95, 0.95, 0.9, 1.0)  # Ivory
                principled.inputs["Metallic"].default_value = 0.1
                principled.inputs["Roughness"].default_value = 0.2
            elif name == "Joint":
                principled.inputs["Base Color"].default_value = (0.8, 0.7, 0.2, 1.0)  # Brass
                principled.inputs["Metallic"].default_value = 0.9
                principled.inputs["Roughness"].default_value = 0.3
            elif name == "Bumper":
                principled.inputs["Base Color"].default_value = (0.1, 0.1, 0.1, 1.0)  # Black rubber
                principled.inputs["Roughness"].default_value = 0.9
            else:
                # Wood sections
                principled.inputs["Base Color"].default_value = (0.4, 0.25, 0.1, 1.0)  # Wood brown
                principled.inputs["Metallic"].default_value = 0.0
                principled.inputs["Roughness"].default_value = 0.5

        obj.data.materials.append(mat)
        all_objects.append(obj)
        z_offset += length

    # UV unwrap the customizable section properly for texture mapping
    for obj in customizable_objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')

        # Cylindrical UV projection - unwraps around the cylinder
        bpy.ops.uv.cylinder_project(
            direction='ALIGN_TO_OBJECT',
            align='POLAR_ZX',
            scale_to_bounds=True
        )

        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)

    # Join all segments into one object for cleaner export
    # But keep customizable section separate for material targeting

    # Select non-customizable objects and join them
    non_custom = [o for o in all_objects if o not in customizable_objects]
    if non_custom:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in non_custom:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = non_custom[0]
        bpy.ops.object.join()
        main_cue = bpy.context.active_object
        main_cue.name = "CueStick"

    # Rename customizable object
    if customizable_objects:
        customizable_objects[0].name = "CustomizableSection"

    # Center the entire model
    bpy.ops.object.select_all(action='SELECT')

    # Rotate to lay horizontally (typical cue orientation)
    for obj in bpy.context.selected_objects:
        obj.rotation_euler[0] = math.radians(-90)  # Rotate to horizontal

    # Apply transforms
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    print("✓ Cue stick created successfully!")
    print("  - Main body: 'CueStick'")
    print("  - Customizable wrap area: 'CustomizableSection'")
    print("\nTo export:")
    print("  File > Export > glTF 2.0 (.glb)")
    print("  Enable: 'Apply Modifiers', 'UVs', 'Normals', 'Materials'")

def main():
    clear_scene()
    create_cue_stick()

if __name__ == "__main__":
    main()
