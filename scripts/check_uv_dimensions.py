# Blender Python Script: Check UV Mesh Dimensions
# Measures ONLY the rectangular UV island (cylinder side), excludes circles (caps)

import bpy
import bmesh

def get_uv_pixel_dimensions():
    """
    Calculate UV dimensions for the rectangular side only (exclude circular caps).
    """

    obj = bpy.context.active_object

    if obj is None:
        for o in bpy.context.scene.objects:
            if o.type == 'MESH':
                obj = o
                bpy.context.view_layer.objects.active = obj
                break

    if obj is None or obj.type != 'MESH':
        return ["ERROR: No mesh object found!", "Please import cue.glb first."]

    obj.select_set(True)

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()

    uv_layer = bm.loops.layers.uv.active

    if uv_layer is None:
        bm.free()
        return ["ERROR: Mesh has no UV layers!"]

    # Collect UV data for ALL faces
    all_uvs = []
    rect_uvs = []  # Rectangle (side) UVs only
    circle_uvs = []  # Circle (cap) UVs

    for face in bm.faces:
        face_uvs = []
        for loop in face.loops:
            uv = loop[uv_layer].uv
            face_uvs.append((uv.x, uv.y))
            all_uvs.append((uv.x, uv.y))

        # Detect if face is part of rectangle or circle
        # Rectangle faces: typically quads with V values in upper half (V > 0.5)
        # Circle faces: triangles with V values in lower half (V < 0.5)

        avg_v = sum(uv[1] for uv in face_uvs) / len(face_uvs)
        is_quad = len(face_uvs) == 4

        # Rectangle is in upper portion of UV space (based on screenshot)
        # V > 0.5 appears to be the rectangle region
        if avg_v > 0.45:  # Rectangle region (upper part)
            rect_uvs.extend(face_uvs)
        else:  # Circle region (lower part - the two caps)
            circle_uvs.extend(face_uvs)

    bm.free()

    if len(rect_uvs) == 0:
        return ["ERROR: No rectangle UVs found!", "Try adjusting threshold."]

    # Calculate RECTANGLE bounds only
    rect_min_u = min(uv[0] for uv in rect_uvs)
    rect_max_u = max(uv[0] for uv in rect_uvs)
    rect_min_v = min(uv[1] for uv in rect_uvs)
    rect_max_v = max(uv[1] for uv in rect_uvs)

    rect_width = rect_max_u - rect_min_u
    rect_height = rect_max_v - rect_min_v
    rect_aspect = rect_width / rect_height if rect_height > 0 else 1.0

    # Calculate CIRCLE bounds for reference
    if circle_uvs:
        circ_min_u = min(uv[0] for uv in circle_uvs)
        circ_max_u = max(uv[0] for uv in circle_uvs)
        circ_min_v = min(uv[1] for uv in circle_uvs)
        circ_max_v = max(uv[1] for uv in circle_uvs)
    else:
        circ_min_u = circ_max_u = circ_min_v = circ_max_v = 0

    # Build results
    results = []
    results.append(f"Object: {obj.name}")
    results.append("")

    results.append("═══ RECTANGLE (Side) ═══")
    results.append(f"UV Points: {len(rect_uvs)}")
    results.append(f"U: {rect_min_u:.4f} → {rect_max_u:.4f}")
    results.append(f"V: {rect_min_v:.4f} → {rect_max_v:.4f}")
    results.append(f"Width: {rect_width:.4f}")
    results.append(f"Height: {rect_height:.4f}")
    results.append(f"Aspect: {rect_aspect:.2f}:1")
    results.append("")

    results.append("═══ CIRCLES (Caps) ═══")
    results.append(f"UV Points: {len(circle_uvs)}")
    if circle_uvs:
        results.append(f"U: {circ_min_u:.4f} → {circ_max_u:.4f}")
        results.append(f"V: {circ_min_v:.4f} → {circ_max_v:.4f}")
    results.append("")

    results.append("═══ PIXEL DIMENSIONS ═══")
    results.append("(Rectangle only, 1:1 mapping)")
    results.append("")

    for base in [512, 1024, 2048, 4096]:
        pw = int(base * rect_width)
        ph = int(base * rect_height)
        results.append(f"  {base}px → {pw} × {ph}")

    results.append("")
    results.append("═══ RECOMMENDATION ═══")
    rec_w = round(2048 * rect_width)
    rec_h = round(2048 * rect_height)
    results.append(f"surface.jpg: {rec_w} × {rec_h}")
    results.append(f"Aspect ratio: {rect_aspect:.2f}:1")

    # Store for code reference
    results.append("")
    results.append("═══ FOR main.js ═══")
    results.append(f"Rect V range: {rect_min_v:.4f} to {rect_max_v:.4f}")
    results.append("Apply texture only where V > 0.45")

    return results


class UV_OT_ShowDimensions(bpy.types.Operator):
    bl_idname = "uv.show_dimensions"
    bl_label = "UV Mesh Dimensions"
    bl_options = {'REGISTER'}

    def execute(self, context):
        return {'FINISHED'}

    def invoke(self, context, event):
        self.results = get_uv_pixel_dimensions()
        return context.window_manager.invoke_props_dialog(self, width=350)

    def draw(self, context):
        layout = self.layout
        for line in self.results:
            if line == "":
                layout.separator()
            elif line.startswith("═"):
                box = layout.box()
                box.label(text=line.replace("═", "").strip(), icon='UV')
            elif line.startswith("ERROR"):
                layout.label(text=line, icon='ERROR')
            elif "→" in line or "×" in line:
                layout.label(text=line, icon='BLANK1')
            else:
                layout.label(text=line)


def register():
    try:
        bpy.utils.unregister_class(UV_OT_ShowDimensions)
    except:
        pass
    bpy.utils.register_class(UV_OT_ShowDimensions)

register()
bpy.ops.uv.show_dimensions('INVOKE_DEFAULT')
