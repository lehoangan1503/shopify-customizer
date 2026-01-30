#!/usr/bin/env python3
"""
Add a customizable mesh layer to the cue.glb model.

This script creates a cylinder mesh covering the bottom half of the cue
with proper UV mapping and material naming for the Shopify 3D customizer.

Requirements:
    pip install pygltflib numpy

Usage:
    python add_cue_customizable_layer.py
"""

import struct
import numpy as np
from pygltflib import GLTF2, Mesh, Primitive, Accessor, BufferView, Buffer, Node, Material

# Configuration
INPUT_FILE = "/Users/an/Downloads/cue.glb"
OUTPUT_FILE = "/Users/an/Documents/shopify-customizer/public/cue.glb"

# Cylinder parameters for customizable layer
# Based on original cue mesh analysis:
# - Mesh radius: ~2.1 units (X/Z range)
# - Mesh height: 0 to 0.73 units (Y range)
# - Node scale: [0.00723, 1.009, 0.00723]
SEGMENTS = 32  # Number of segments around the cylinder
RADIUS = 2.15  # Slightly larger than mesh radius (2.1) to wrap outside
HEIGHT_START = 0.0  # Bottom of customizable area (0 = bottom of cue)
HEIGHT_END = 0.365  # Top of customizable area (~half of 0.73 = middle of cue)


def create_cylinder_mesh_data(segments, radius, height_start, height_end):
    """
    Create vertex data for a cylinder (sides only, no caps).

    Returns:
        positions: numpy array of vertex positions (vec3)
        normals: numpy array of vertex normals (vec3)
        uvs: numpy array of texture coordinates (vec2)
        indices: numpy array of triangle indices (uint16)
    """
    positions = []
    normals = []
    uvs = []
    indices = []

    # Create vertices for each segment
    for i in range(segments + 1):
        angle = (i / segments) * 2 * np.pi
        x = np.cos(angle) * radius
        z = np.sin(angle) * radius

        # Normal pointing outward
        nx = np.cos(angle)
        nz = np.sin(angle)

        # UV coordinate (u wraps around, v goes from bottom to top)
        u = i / segments

        # Bottom vertex
        positions.append([x, height_start, z])
        normals.append([nx, 0, nz])
        uvs.append([u, 0])

        # Top vertex
        positions.append([x, height_end, z])
        normals.append([nx, 0, nz])
        uvs.append([u, 1])

    # Create triangle indices
    for i in range(segments):
        base = i * 2
        # First triangle
        indices.extend([base, base + 1, base + 2])
        # Second triangle
        indices.extend([base + 1, base + 3, base + 2])

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(uvs, dtype=np.float32),
        np.array(indices, dtype=np.uint16)
    )


def main():
    print(f"Loading {INPUT_FILE}...")
    gltf = GLTF2().load(INPUT_FILE)

    # Get the existing buffer
    existing_buffer = gltf.buffers[0]
    existing_data = gltf.get_data_from_buffer_uri(existing_buffer.uri) if existing_buffer.uri else gltf.binary_blob()

    # Create cylinder mesh data
    print("Creating customizable cylinder mesh...")
    positions, normals, uvs, indices = create_cylinder_mesh_data(
        SEGMENTS, RADIUS, HEIGHT_START, HEIGHT_END
    )

    print(f"  Vertices: {len(positions)}")
    print(f"  Triangles: {len(indices) // 3}")

    # Convert to bytes
    positions_bytes = positions.tobytes()
    normals_bytes = normals.tobytes()
    uvs_bytes = uvs.tobytes()
    indices_bytes = indices.tobytes()

    # Calculate byte lengths
    positions_length = len(positions_bytes)
    normals_length = len(normals_bytes)
    uvs_length = len(uvs_bytes)
    indices_length = len(indices_bytes)

    # Pad to 4-byte alignment
    def pad_to_4(length):
        return (4 - (length % 4)) % 4

    # Calculate offsets in new buffer section
    new_data_start = len(existing_data)

    positions_offset = new_data_start
    normals_offset = positions_offset + positions_length + pad_to_4(positions_length)
    uvs_offset = normals_offset + normals_length + pad_to_4(normals_length)
    indices_offset = uvs_offset + uvs_length + pad_to_4(uvs_length)

    # Build new buffer data
    new_buffer_data = bytearray(existing_data)

    # Add positions
    new_buffer_data.extend(positions_bytes)
    new_buffer_data.extend(b'\x00' * pad_to_4(positions_length))

    # Add normals
    new_buffer_data.extend(normals_bytes)
    new_buffer_data.extend(b'\x00' * pad_to_4(normals_length))

    # Add UVs
    new_buffer_data.extend(uvs_bytes)
    new_buffer_data.extend(b'\x00' * pad_to_4(uvs_length))

    # Add indices
    new_buffer_data.extend(indices_bytes)
    new_buffer_data.extend(b'\x00' * pad_to_4(indices_length))

    # Update buffer size
    existing_buffer.byteLength = len(new_buffer_data)

    # Create buffer views for new mesh
    positions_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(
        buffer=0,
        byteOffset=positions_offset,
        byteLength=positions_length,
        target=34962  # ARRAY_BUFFER
    ))

    normals_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(
        buffer=0,
        byteOffset=normals_offset,
        byteLength=normals_length,
        target=34962  # ARRAY_BUFFER
    ))

    uvs_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(
        buffer=0,
        byteOffset=uvs_offset,
        byteLength=uvs_length,
        target=34962  # ARRAY_BUFFER
    ))

    indices_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(
        buffer=0,
        byteOffset=indices_offset,
        byteLength=indices_length,
        target=34963  # ELEMENT_ARRAY_BUFFER
    ))

    # Create accessors
    vertex_count = len(positions)
    index_count = len(indices)

    # Position accessor
    positions_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=positions_bv_idx,
        componentType=5126,  # FLOAT
        count=vertex_count,
        type="VEC3",
        max=positions.max(axis=0).tolist(),
        min=positions.min(axis=0).tolist()
    ))

    # Normal accessor
    normals_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=normals_bv_idx,
        componentType=5126,  # FLOAT
        count=vertex_count,
        type="VEC3"
    ))

    # UV accessor
    uvs_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=uvs_bv_idx,
        componentType=5126,  # FLOAT
        count=vertex_count,
        type="VEC2"
    ))

    # Index accessor
    indices_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=indices_bv_idx,
        componentType=5123,  # UNSIGNED_SHORT
        count=index_count,
        type="SCALAR"
    ))

    # Create material with name containing "outside" for customization
    material_idx = len(gltf.materials) if gltf.materials else 0
    if not gltf.materials:
        gltf.materials = []

    gltf.materials.append(Material(
        name="outside",  # This name triggers customization in main.js
        pbrMetallicRoughness={
            "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
            "metallicFactor": 0.0,
            "roughnessFactor": 0.5
        }
    ))

    print(f"  Created material 'outside' at index {material_idx}")

    # Create mesh primitive
    primitive = Primitive(
        attributes={
            "POSITION": positions_acc_idx,
            "NORMAL": normals_acc_idx,
            "TEXCOORD_0": uvs_acc_idx
        },
        indices=indices_acc_idx,
        material=material_idx
    )

    # Create mesh
    mesh_idx = len(gltf.meshes)
    gltf.meshes.append(Mesh(
        name="CustomizableLayer",
        primitives=[primitive]
    ))

    print(f"  Created mesh 'CustomizableLayer' at index {mesh_idx}")

    # Get the existing node's scale (for the cue)
    existing_node = gltf.nodes[0]
    node_scale = existing_node.scale if existing_node.scale else [1, 1, 1]

    # Create node for new mesh with same scale as original cue
    node_idx = len(gltf.nodes)
    gltf.nodes.append(Node(
        mesh=mesh_idx,
        name="CustomizableLayerNode",
        scale=node_scale  # Match the cue's scale
    ))

    # Add new node to scene
    gltf.scenes[0].nodes.append(node_idx)

    print(f"  Created node 'CustomizableLayerNode' at index {node_idx}")

    # Update binary blob
    gltf.set_binary_blob(bytes(new_buffer_data))

    # Save
    print(f"Saving to {OUTPUT_FILE}...")
    gltf.save(OUTPUT_FILE)

    print("Done! The cue model now has a customizable layer.")
    print("\nThe customizable area covers the bottom half of the cue.")
    print("Material name 'outside' will be detected by main.js for texture customization.")


if __name__ == "__main__":
    main()
