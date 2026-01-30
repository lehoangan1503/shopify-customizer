"""
Blender Python Script - Simplified Pool Cue Generator

Creates a pool cue model with 5 sections designed for Three.js texture customization.
The 'outside' material section is the customizable layer that Three.js targets.

Run headless:
    blender --background --python generate_cue.py

Simplified Pool Cue Specifications (tip to bumper):
    - Tip: ~3% (43mm), 12mm diameter, dark brown
    - Upper Shaft: 50% (725mm), 12-14mm diameter, maple wood
    - Ferrule: ~3% (43mm), 14mm diameter, ivory divider
    - Custom Wrap: 50% (725mm), 14-25mm diameter, 'outside' material (CUSTOMIZABLE)
    - Bumper: ~2% (29mm), 25-28mm diameter, black rubber

Total length: ~1450mm (standard cue)

CRITICAL: The custom layer uses material name 'outside' which Three.js looks for.
"""

import bpy
import bmesh
import math
from typing import List, Tuple, Optional

# Output path for the GLB file
OUTPUT_PATH = "/Users/an/Documents/shopify-customizer/public/cue.glb"


# Type definitions for section data
# Each section: (name, length_mm, radius_top_mm, radius_bottom_mm, color_hex, material_name, metallic, roughness)
SectionSpec = Tuple[str, float, float, float, str, str, float, float]


def hex_to_rgba(hex_color: str) -> Tuple[float, float, float, float]:
    """
    Convert hex color string to RGBA tuple (0-1 range).

    Args:
        hex_color: Color in hex format (e.g., '#4A3728')

    Returns:
        Tuple of (r, g, b, a) with values from 0 to 1
    """
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return (r, g, b, 1.0)


def clear_scene() -> None:
    """
    Remove all objects, materials, and meshes from the scene.
    Ensures a clean slate for model generation.
    """
    # Deselect all first
    if bpy.context.active_object:
        bpy.ops.object.mode_set(mode='OBJECT')

    # Select and delete all objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Remove orphaned materials
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)

    # Remove orphaned meshes
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

    print("[clear_scene] Scene cleared")


def create_material(
    name: str,
    color: Tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.5
) -> bpy.types.Material:
    """
    Create a Principled BSDF material with specified properties.

    Args:
        name: Material name (critical for Three.js targeting)
        color: RGBA color tuple (0-1 range)
        metallic: Metallic value (0-1)
        roughness: Roughness value (0-1)

    Returns:
        The created Blender material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get("Principled BSDF")

    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = metallic
        principled.inputs["Roughness"].default_value = roughness

    return mat


def create_tapered_cylinder(
    name: str,
    length: float,
    radius_top: float,
    radius_bottom: float,
    z_position: float,
    color: Tuple[float, float, float, float],
    material_name: str,
    metallic: float = 0.0,
    roughness: float = 0.5,
    segments: int = 32
) -> bpy.types.Object:
    """
    Create a tapered cylinder (cone) section for the pool cue.

    The cylinder is oriented along the Z-axis with the top at higher Z.
    Vertices are scaled to create the taper effect.

    Args:
        name: Object name
        length: Length of the section in scene units
        radius_top: Radius at the top (higher Z)
        radius_bottom: Radius at the bottom (lower Z)
        z_position: Z position of the bottom of the cylinder
        color: RGBA color tuple
        material_name: Name for the material (used by Three.js)
        metallic: Material metallic value
        roughness: Material roughness value
        segments: Number of vertices around the circumference

    Returns:
        The created Blender object
    """
    # Create cylinder at the correct position (center at z_position + length/2)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segments,
        radius=1.0,  # Will be scaled per-vertex
        depth=length,
        end_fill_type='NGON',
        location=(0, 0, z_position + length / 2)
    )

    obj = bpy.context.active_object
    obj.name = name

    # Enter edit mode to modify vertices for taper
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)

    # Calculate the Z bounds of the cylinder in local space
    z_min = -length / 2
    z_max = length / 2

    for v in bm.verts:
        # Normalize Z position to 0-1 range (0 = bottom, 1 = top)
        if length > 0:
            t = (v.co.z - z_min) / length
        else:
            t = 0.5
        t = max(0.0, min(1.0, t))

        # Interpolate radius from bottom to top
        target_radius = radius_bottom + (radius_top - radius_bottom) * t

        # Calculate current distance from Z-axis
        current_dist = math.sqrt(v.co.x ** 2 + v.co.y ** 2)

        # Scale vertex to target radius (avoid division by zero)
        if current_dist > 0.0001:
            scale_factor = target_radius / current_dist
            v.co.x *= scale_factor
            v.co.y *= scale_factor

    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Create and assign material
    mat = create_material(material_name, color, metallic, roughness)
    obj.data.materials.append(mat)

    return obj


def apply_cylindrical_uv_proper(obj: bpy.types.Object) -> None:
    """
    Apply proper cylindrical UV mapping to an object.

    This creates UV coordinates where:
    - U (horizontal): wraps around the circumference (0-1)
    - V (vertical): runs along the length (0-1)

    This is essential for proper texture mapping on the customizable section.

    Args:
        obj: The Blender object to UV unwrap
    """
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Get the mesh data
    mesh = obj.data

    # Ensure we have a UV layer
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")

    uv_layer = mesh.uv_layers.active.data

    # Get mesh bounds for normalization
    min_z = float('inf')
    max_z = float('-inf')

    for vertex in mesh.vertices:
        # Transform vertex to world space
        world_co = obj.matrix_world @ vertex.co
        min_z = min(min_z, world_co.z)
        max_z = max(max_z, world_co.z)

    z_range = max_z - min_z if max_z > min_z else 1.0

    # Process each polygon
    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            loop = mesh.loops[loop_idx]
            vertex = mesh.vertices[loop.vertex_index]

            # Transform vertex to world space
            world_co = obj.matrix_world @ vertex.co

            # Calculate U from angle around Z axis (0 to 1, wrapping)
            angle = math.atan2(world_co.y, world_co.x)
            u = (angle + math.pi) / (2 * math.pi)  # Normalize to 0-1

            # Calculate V from Z position (0 at bottom, 1 at top)
            v = (world_co.z - min_z) / z_range

            # Set UV coordinates
            uv_layer[loop_idx].uv = (u, v)

    obj.select_set(False)
    print(f"[apply_cylindrical_uv_proper] UV mapping applied to {obj.name}")
    print(f"  Z range: {min_z:.4f} to {max_z:.4f}")


def create_pool_cue() -> bpy.types.Object:
    """
    Create the simplified pool cue with 5 sections.

    Sections are created from tip (top, high Z) to bumper (bottom, low Z).
    The 'outside' material on the wrap section is targeted by Three.js.

    Structure:
    - Tip: ~3% - dark brown leather tip
    - Upper Shaft: 50% - maple wood (plain, no customization)
    - Ferrule: ~3% - ivory divider
    - Custom Wrap: 50% - 'outside' material (CUSTOMIZABLE by Three.js)
    - Bumper: ~2% - black rubber end cap

    Returns:
        The joined pool cue object
    """
    # Total cue length: 1450mm
    # Percentages: Tip(3%) + Shaft(50%) + Ferrule(3%) + CustomWrap(50%) + Bumper(2%) = ~108%
    # Adjusted to fit: Tip(43mm) + Shaft(653mm) + Ferrule(43mm) + Wrap(653mm) + Bumper(29mm) = 1421mm
    # Let's use more exact proportions based on 1450mm total:

    total_length = 1450  # mm

    # Calculate section lengths
    tip_length = 43  # ~3%
    shaft_length = 653  # ~45% (leaving room for other sections to hit 100%)
    ferrule_length = 43  # ~3%
    wrap_length = 653  # ~45% (matching shaft for visual balance)
    bumper_length = 29  # ~2%
    # Remaining: 29mm distributed (1450 - 43 - 653 - 43 - 653 - 29 = 29mm, add to shaft)
    shaft_length = 682  # Adjusted: 682mm
    wrap_length = 653  # Keep wrap at 653mm

    # Final check: 43 + 682 + 43 + 653 + 29 = 1450mm

    # Section specifications: (name, length_mm, radius_top_mm, radius_bottom_mm,
    #                          color_hex, material_name, metallic, roughness)
    # Tip is at TOP (high Z), Bumper at BOTTOM (low Z)
    # Listed in order from tip to butt (top to bottom)

    sections: List[SectionSpec] = [
        # Tip - dark brown leather
        # Short tip at the striking end
        ("Tip", tip_length, 12, 12, "#3D2314", "tip", 0.0, 0.8),

        # Upper Shaft - maple wood (plain, not customizable)
        # 50% of the cue - natural maple color
        ("Shaft", shaft_length, 12, 14, "#DEB887", "shaft", 0.0, 0.4),

        # Ferrule - ivory divider
        # Short decorative band separating shaft from wrap
        ("Ferrule", ferrule_length, 14, 14, "#FFFFF0", "ferrule", 0.1, 0.2),

        # Custom Wrap (CUSTOMIZABLE) - 'outside' material for Three.js
        # 50% of the cue - this is where user textures are applied
        # Gray placeholder color, Three.js will replace with user textures
        ("CustomWrap", wrap_length, 14, 25, "#808080", "outside", 0.0, 0.3),

        # Bumper - black rubber
        # End cap at the bottom of the cue
        ("Bumper", bumper_length, 25, 28, "#1A1A1A", "bumper", 0.0, 0.95),
    ]

    # Convert mm to meters for Blender units
    mm_to_units = 0.001  # 1mm = 0.001 Blender units (meters)

    # Calculate total length for verification
    total_length_mm = sum(s[1] for s in sections)
    print(f"[create_pool_cue] Total cue length: {total_length_mm}mm")

    # Print section breakdown
    print("[create_pool_cue] Section breakdown:")
    for name, length, _, _, _, mat_name, _, _ in sections:
        pct = (length / total_length_mm) * 100
        print(f"  - {name}: {length}mm ({pct:.1f}%) - material: '{mat_name}'")

    all_objects: List[bpy.types.Object] = []
    custom_layer_obj: Optional[bpy.types.Object] = None

    # Start from the top (tip) and work down
    # Z position starts at total length and decreases
    z_position = total_length_mm * mm_to_units

    for name, length_mm, r_top_mm, r_bottom_mm, color_hex, mat_name, metallic, roughness in sections:
        # Convert dimensions to scene units
        length = length_mm * mm_to_units
        r_top = r_top_mm * mm_to_units / 2  # Convert diameter to radius
        r_bottom = r_bottom_mm * mm_to_units / 2

        # Move z_position down by the length of this section
        z_position -= length

        # Convert color
        color = hex_to_rgba(color_hex)

        # Create the section
        obj = create_tapered_cylinder(
            name=name,
            length=length,
            radius_top=r_top,
            radius_bottom=r_bottom,
            z_position=z_position,
            color=color,
            material_name=mat_name,
            metallic=metallic,
            roughness=roughness
        )

        all_objects.append(obj)

        # Track the customizable layer ('outside' material) for UV mapping
        if mat_name == "outside":
            custom_layer_obj = obj
            print(f"[create_pool_cue] Custom layer section created: {name} with material 'outside'")

    # Apply proper cylindrical UV to the customizable section BEFORE joining
    if custom_layer_obj:
        apply_cylindrical_uv_proper(custom_layer_obj)
        print("[create_pool_cue] Cylindrical UV mapping applied to 'outside' material section")

    # Join all objects into a single mesh
    bpy.ops.object.select_all(action='DESELECT')
    for obj in all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = all_objects[0]
    bpy.ops.object.join()

    # Name the joined object
    cue = bpy.context.active_object
    cue.name = "PoolCue"

    # Merge vertices at seams for smooth geometry
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.00001)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Apply all transformations
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Set origin to geometry center
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    cue.location = (0, 0, 0)

    print(f"[create_pool_cue] Pool cue created: {cue.name}")
    print(f"[create_pool_cue] Materials: {[m.name for m in cue.data.materials]}")

    return cue


def export_glb(filepath: str) -> None:
    """
    Export the scene as a GLB file.

    Args:
        filepath: Full path for the output GLB file
    """
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_yup=True,  # Convert Blender Z-up to glTF Y-up
    )
    print(f"[export_glb] Exported to: {filepath}")


def main() -> None:
    """
    Main entry point for the script.
    Clears the scene, creates the pool cue, and exports to GLB.
    """
    print("\n" + "=" * 60)
    print("  Simplified Pool Cue Generator - Blender Python Script")
    print("=" * 60)
    print()

    print("[main] Step 1: Clearing scene...")
    clear_scene()

    print("[main] Step 2: Creating simplified pool cue...")
    cue = create_pool_cue()

    print("[main] Step 3: Exporting GLB...")
    export_glb(OUTPUT_PATH)

    print()
    print("=" * 60)
    print("  Pool cue generation complete!")
    print()
    print("  Simplified Structure (5 sections):")
    print("    1. Tip (~3%) - dark brown leather")
    print("    2. Shaft (~47%) - maple wood")
    print("    3. Ferrule (~3%) - ivory divider")
    print("    4. CustomWrap (~45%) - 'outside' material (CUSTOMIZABLE)")
    print("    5. Bumper (~2%) - black rubber")
    print()
    print("  CRITICAL: Custom layer uses material name 'outside'")
    print("            Three.js looks for materials containing 'outside'")
    print()
    print(f"  Output: {OUTPUT_PATH}")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
