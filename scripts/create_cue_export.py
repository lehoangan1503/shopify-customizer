"""
Blender Python Script - Realistic Pool Cue
- Seamless taper from thin tip to thicker butt
- Tip on TOP, bumper at BOTTOM
- Short tip & bumper, seamless wood grain throughout
Run with: blender --background --python create_cue_export.py
"""

import bpy
import bmesh
import math

OUTPUT_PATH = "/Users/an/Documents/shopify-customizer/public/cue.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

def create_material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return mat

def create_cue_section(name, length, r_start, r_end, z_start, segments=32):
    """Create a tapered cylinder section."""
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segments,
        radius=1.0,
        depth=length,
        end_fill_type='NGON',
        location=(0, 0, z_start + length/2)
    )

    obj = bpy.context.active_object
    obj.name = name

    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)

    for v in bm.verts:
        local_z = (v.co.z - z_start) / length if length > 0 else 0
        local_z = max(0, min(1, local_z))
        radius = r_start + (r_end - r_start) * local_z
        current_dist = math.sqrt(v.co.x**2 + v.co.y**2)
        if current_dist > 0.001:
            scale = radius / current_dist
            v.co.x *= scale
            v.co.y *= scale

    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj

def apply_cylindrical_uv(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cylinder_project(
        direction='ALIGN_TO_OBJECT',
        align='POLAR_ZX',
        scale_to_bounds=True
    )
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)

def create_realistic_cue():
    """
    Create realistic pool cue:
    - Total length ~1.5m (scaled to 3.0 units for visibility)
    - Tip diameter: ~13mm, Butt diameter: ~30mm
    - Seamless taper throughout
    - TIP AT TOP (high Z), BUMPER AT BOTTOM (low Z)
    """

    total_length = 3.0  # Bigger model

    # Realistic proportions (tip at TOP = high Z values)
    # Real cue: tip ~13mm diameter, butt ~29mm diameter
    tip_radius = 0.013
    butt_radius = 0.029

    # Z goes from 0 (bottom/butt) to total_length (top/tip)
    # Sections from BOTTOM to TOP:
    # - Bumper (bottom, Z=0)
    # - Custom area (lower half of wood)
    # - Shaft (upper half of wood)
    # - Tip (top)

    sections = [
        # (name, z_start_ratio, z_end_ratio, is_custom)
        # Bumper at bottom - very short
        ("Bumper", 0.0, 0.008, False),
        # Custom area - bottom 49% of wood (above bumper)
        ("CustomArea", 0.008, 0.50, True),
        # Shaft - top 49% of wood (below tip)
        ("Shaft", 0.50, 0.992, False),
        # Tip at top - very short
        ("Tip", 0.992, 1.0, False),
    ]

    # Calculate radius at any point (linear taper from butt to tip)
    def get_radius(z_ratio):
        # z_ratio 0 = bottom (butt, thick), z_ratio 1 = top (tip, thin)
        return butt_radius + (tip_radius - butt_radius) * z_ratio

    all_objects = []

    for name, start_ratio, end_ratio, is_custom in sections:
        z_start = start_ratio * total_length
        z_end = end_ratio * total_length
        length = z_end - z_start

        r_start = get_radius(start_ratio)
        r_end = get_radius(end_ratio)

        obj = create_cue_section(name, length, r_start, r_end, z_start)

        # Materials
        if name == "Tip":
            mat = create_material("Tip_mat", (0.12, 0.18, 0.42, 1.0), 0.0, 0.8)  # Dark blue leather
        elif name == "Bumper":
            mat = create_material("Bumper_mat", (0.03, 0.03, 0.03, 1.0), 0.0, 0.95)  # Black rubber
        elif is_custom:
            mat = create_material("outside", (0.88, 0.76, 0.53, 1.0), 0.0, 0.4)  # Light maple
            apply_cylindrical_uv(obj)
        else:
            mat = create_material("Shaft_mat", (0.88, 0.76, 0.53, 1.0), 0.0, 0.4)  # Same light maple

        obj.data.materials.append(mat)
        all_objects.append(obj)

    # Join all into single object
    bpy.ops.object.select_all(action='DESELECT')
    for obj in all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = all_objects[0]
    bpy.ops.object.join()

    cue = bpy.context.active_object
    cue.name = "PoolCue"

    # Merge vertices at seams
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode='OBJECT')

    # NO rotation - keep vertical with tip at top (positive Y in Three.js after export)
    # glTF uses Y-up, so our Z-up becomes Y-up automatically

    # Apply transformations
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Center
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    cue.location = (0, 0, 0)

    print("✓ Realistic cue created")
    print("  - Seamless taper: thick butt → thin tip")
    print("  - Tip at TOP, Bumper at BOTTOM")
    print("  - Short tip (0.8%) and bumper (0.8%)")
    print("  - Custom area: bottom 50% of wood")

def export_glb():
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    print(f"✓ Exported to: {OUTPUT_PATH}")

def main():
    print("\n" + "="*50)
    print("Creating Realistic Pool Cue")
    print("="*50 + "\n")
    clear_scene()
    create_realistic_cue()
    export_glb()
    print("\n" + "="*50)
    print("Done!")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
