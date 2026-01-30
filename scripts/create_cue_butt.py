# Blender Python Script: Create Cue Butt GLB
# Creates a pool cue butt with UV mapped for surface.jpg (1141 x 8359)
#
# Run in Blender: File > Import > Run Script
# Then export: File > Export > glTF 2.0 (.glb)

import bpy
import bmesh
import math

# Clear existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ============================================
# DIMENSIONS based on surface.jpg
# ============================================
# surface.jpg: 1141 x 8359 pixels (ratio ~1:7.33)
# UV should be half of texture for quality: 570.5 x 4179.5
# This means UV aspect ratio is 1:7.33

SURFACE_WIDTH = 1141
SURFACE_HEIGHT = 8359
UV_ASPECT = SURFACE_WIDTH / SURFACE_HEIGHT  # ~0.1365 (width/height)

# Cue butt physical dimensions (in Blender units)
CUE_LENGTH = 2.0          # Total length of cue butt
CUE_RADIUS = 0.035        # Main radius (~35mm diameter = pool cue size)
BUMPER_LENGTH = 0.08      # Bumper at bottom
BUMPER_RADIUS = 0.038     # Slightly wider than cue
SEGMENTS = 32             # Circumference segments for smoothness

print(f"Surface.jpg: {SURFACE_WIDTH} x {SURFACE_HEIGHT}")
print(f"UV Aspect Ratio: {UV_ASPECT:.4f} (width/height)")
print(f"For 1:1 mapping, UV height should be ~7.33x UV width")

# ============================================
# CREATE CUE BUTT MESH
# ============================================

# Create main cylinder (cue body)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=SEGMENTS,
    radius=CUE_RADIUS,
    depth=CUE_LENGTH,
    location=(0, 0, CUE_LENGTH / 2),
    end_fill_type='NGON'
)
cue_body = bpy.context.active_object
cue_body.name = "CueButt_Body"

# Create bumper cylinder
bpy.ops.mesh.primitive_cylinder_add(
    vertices=SEGMENTS,
    radius=BUMPER_RADIUS,
    depth=BUMPER_LENGTH,
    location=(0, 0, -BUMPER_LENGTH / 2),
    end_fill_type='NGON'
)
bumper = bpy.context.active_object
bumper.name = "CueButt_Bumper"

# ============================================
# CREATE MATERIALS
# ============================================

# Light Maple Wood Material (for cue body - will receive texture)
# Named "CueButt_Body_Material" to match main.js pattern (contains "body")
maple_mat = bpy.data.materials.new(name="CueButt_Body_Material")
maple_mat.use_nodes = True
nodes = maple_mat.node_tree.nodes
links = maple_mat.node_tree.links

# Clear default nodes
for node in nodes:
    nodes.remove(node)

# Create PBR nodes for maple wood
output = nodes.new('ShaderNodeOutputMaterial')
output.location = (400, 0)

bsdf = nodes.new('ShaderNodeBsdfPrincipled')
bsdf.location = (0, 0)
# Light maple wood color (will be replaced by texture)
bsdf.inputs['Base Color'].default_value = (0.85, 0.75, 0.55, 1.0)  # Light maple
bsdf.inputs['Roughness'].default_value = 0.35
bsdf.inputs['Specular IOR Level'].default_value = 0.5

links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

# Rubber Bumper Material (dark rubber, no texture)
rubber_mat = bpy.data.materials.new(name="Rubber_Bumper")
rubber_mat.use_nodes = True
r_nodes = rubber_mat.node_tree.nodes
r_links = rubber_mat.node_tree.links

for node in r_nodes:
    r_nodes.remove(node)

r_output = r_nodes.new('ShaderNodeOutputMaterial')
r_output.location = (400, 0)

r_bsdf = r_nodes.new('ShaderNodeBsdfPrincipled')
r_bsdf.location = (0, 0)
r_bsdf.inputs['Base Color'].default_value = (0.05, 0.05, 0.05, 1.0)  # Dark rubber
r_bsdf.inputs['Roughness'].default_value = 0.9
r_bsdf.inputs['Specular IOR Level'].default_value = 0.1

r_links.new(r_bsdf.outputs['BSDF'], r_output.inputs['Surface'])

# Assign materials
cue_body.data.materials.append(maple_mat)
bumper.data.materials.append(rubber_mat)

# ============================================
# UV UNWRAP - ONLY CYLINDRICAL SIDE
# ============================================

def unwrap_cylinder_side_only(obj, uv_aspect):
    """
    Create UV map for cylinder where:
    - Only the cylindrical SIDE gets UV mapped (fills 0-1 UV space)
    - Top and bottom caps get minimal/no UV (collapsed to edge)
    """

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Enter edit mode
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(obj.data)

    # Ensure UV layer exists
    if not bm.loops.layers.uv:
        bm.loops.layers.uv.new("UVMap")
    uv_layer = bm.loops.layers.uv.active

    # Identify faces: caps vs sides
    # Cap faces are horizontal (normal pointing up or down)
    # Side faces are vertical (normal pointing outward)

    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()

    # Get Z bounds for UV mapping
    z_coords = [v.co.z for v in bm.verts]
    min_z = min(z_coords)
    max_z = max(z_coords)
    z_range = max_z - min_z

    for face in bm.faces:
        normal = face.normal
        is_cap = abs(normal.z) > 0.9  # Face pointing up or down

        if is_cap:
            # Collapse cap UVs to a small area outside main texture
            # Put them at V < 0.01 so they don't show the main texture
            for loop in face.loops:
                uv = loop[uv_layer]
                # Map to tiny area at bottom of UV space
                uv.uv.x = 0.5
                uv.uv.y = 0.005  # Nearly at V=0
        else:
            # Side face - cylindrical UV projection
            for loop in face.loops:
                vert = loop.vert
                uv = loop[uv_layer]

                # U: angle around cylinder (0 to 1)
                angle = math.atan2(vert.co.y, vert.co.x)
                u = (angle + math.pi) / (2 * math.pi)  # 0 to 1

                # V: height along cylinder (0 to 1)
                # Map full height to full V range for maximum texture usage
                v = (vert.co.z - min_z) / z_range if z_range > 0 else 0.5

                uv.uv.x = u
                uv.uv.y = v

    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')

    print(f"UV unwrapped: {obj.name}")
    print(f"  Side faces: U=0-1 (around), V=0-1 (height)")
    print(f"  Cap faces: collapsed to V=0.005")

# Unwrap cue body (main textured part)
unwrap_cylinder_side_only(cue_body, UV_ASPECT)

# For bumper, just do simple unwrap (it uses solid color anyway)
bpy.context.view_layer.objects.active = bumper
bumper.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=66)
bpy.ops.object.mode_set(mode='OBJECT')

# ============================================
# JOIN OBJECTS AND EXPORT
# ============================================

# Select both objects
bpy.ops.object.select_all(action='DESELECT')
cue_body.select_set(True)
bumper.select_set(True)
bpy.context.view_layer.objects.active = cue_body

# Join into single object
bpy.ops.object.join()
final_cue = bpy.context.active_object
final_cue.name = "CueButt"

# Apply transforms
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ============================================
# EXPORT GLB
# ============================================

import os

# Export path
export_path = "/Users/an/Documents/shopify-customizer/public/cue-butt.glb"

# Ensure only our cue is selected
bpy.ops.object.select_all(action='DESELECT')
final_cue.select_set(True)

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath=export_path,
    use_selection=True,
    export_format='GLB',
    export_materials='EXPORT',
    export_texcoords=True,
    export_normals=True,
    export_apply=True
)

print("\n" + "="*50)
print("✅ EXPORT COMPLETE")
print("="*50)
print(f"File: {export_path}")
print(f"\nUV Layout:")
print(f"  - Cylindrical side: U=0-1, V=0-1 (full texture)")
print(f"  - Top/bottom caps: V=0.005 (no texture)")
print(f"\nFor surface.jpg ({SURFACE_WIDTH}x{SURFACE_HEIGHT}):")
print(f"  - Texture will wrap around cylinder")
print(f"  - Full vertical coverage")
print(f"\nMaterials:")
print(f"  - CueButt_Body_Material: Light maple, receives texture (matches 'body' pattern)")
print(f"  - Rubber_Bumper: Dark rubber, solid color")
print("="*50)
