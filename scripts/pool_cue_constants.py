"""
Pool Cue 3D Model Specifications for Blender (bpy)
===================================================
Realistic pool cue dimensions and materials for GLB export.
Total length: 1470mm (58 inches standard)

Usage:
    from pool_cue_constants import SEGMENTS, DECORATIVE_RINGS, EXPORT_SETTINGS
"""

from typing import TypedDict, List, Optional
from dataclasses import dataclass
from enum import Enum


class SegmentShape(Enum):
    """Shape types for cue segments."""
    CYLINDER = "cylinder"
    TAPERED_CYLINDER = "tapered_cylinder"
    CYLINDER_ROUNDED_TOP = "cylinder_rounded_top"
    CYLINDER_ROUNDED_BOTTOM = "cylinder_rounded_bottom"


@dataclass
class Material:
    """Material specification for Blender BSDF shader."""
    name: str
    base_color_hex: str
    roughness: float
    metallic: float
    specular: float = 0.5
    subsurface: float = 0.0

    @property
    def base_color_rgb(self) -> tuple:
        """Convert hex to RGB tuple (0-1 range)."""
        hex_color = self.base_color_hex.lstrip('#')
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b, 1.0)


@dataclass
class Segment:
    """Pool cue segment specification."""
    name: str
    order: int
    description: str
    length_mm: float
    diameter_start_mm: float
    diameter_end_mm: float
    shape: SegmentShape
    material: Material
    subdivisions: int
    is_customizable: bool = False
    notes: str = ""


@dataclass
class DecorativeRing:
    """Decorative ring specification."""
    name: str
    position_after_segment: str
    offset_mm: float
    length_mm: float
    diameter_mm: float
    material: Material


# =============================================================================
# MATERIAL DEFINITIONS
# =============================================================================

MATERIALS = {
    "tip_leather": Material(
        name="tip_leather",
        base_color_hex="#3D2314",
        roughness=0.85,
        metallic=0.0,
        subsurface=0.1
    ),
    "ferrule_plastic": Material(
        name="ferrule_plastic",
        base_color_hex="#FFFEF0",
        roughness=0.25,
        metallic=0.0,
        specular=0.5
    ),
    "shaft_maple": Material(
        name="shaft_maple",
        base_color_hex="#E8D4B8",
        roughness=0.45,
        metallic=0.0,
        subsurface=0.05
    ),
    "joint_brass": Material(
        name="joint_brass",
        base_color_hex="#B5A642",
        roughness=0.2,
        metallic=0.95,
        specular=0.8
    ),
    "forearm_wood": Material(
        name="forearm_wood",
        base_color_hex="#8B4513",
        roughness=0.4,
        metallic=0.0,
        subsurface=0.05
    ),
    "outside": Material(
        name="outside",
        base_color_hex="#1A1A1A",
        roughness=0.6,
        metallic=0.0
    ),
    "butt_wood": Material(
        name="butt_wood",
        base_color_hex="#2F1810",
        roughness=0.35,
        metallic=0.0,
        subsurface=0.05
    ),
    "bumper_rubber": Material(
        name="bumper_rubber",
        base_color_hex="#0A0A0A",
        roughness=0.9,
        metallic=0.0
    ),
    "ring_gold": Material(
        name="ring_gold",
        base_color_hex="#D4AF37",
        roughness=0.15,
        metallic=0.95
    )
}

# =============================================================================
# SEGMENT DEFINITIONS (tip to butt order)
# =============================================================================

SEGMENTS: List[Segment] = [
    Segment(
        name="tip",
        order=1,
        description="Leather tip - striking surface",
        length_mm=5.0,
        diameter_start_mm=12.0,
        diameter_end_mm=12.0,
        shape=SegmentShape.CYLINDER_ROUNDED_TOP,
        material=MATERIALS["tip_leather"],
        subdivisions=16,
        notes="Dome/hemisphere on top for realistic tip shape"
    ),
    Segment(
        name="ferrule",
        order=2,
        description="Protective plastic collar below tip",
        length_mm=25.0,
        diameter_start_mm=12.0,
        diameter_end_mm=12.5,
        shape=SegmentShape.CYLINDER,
        material=MATERIALS["ferrule_plastic"],
        subdivisions=24,
        notes="Ivory/off-white color, smooth plastic appearance"
    ),
    Segment(
        name="shaft",
        order=3,
        description="Main playing shaft - maple wood with taper",
        length_mm=730.0,
        diameter_start_mm=12.5,
        diameter_end_mm=14.0,
        shape=SegmentShape.TAPERED_CYLINDER,
        material=MATERIALS["shaft_maple"],
        subdivisions=32,
        notes="Gradual taper from tip toward joint, natural maple grain"
    ),
    Segment(
        name="joint_collar",
        order=4,
        description="Metal joint ring connecting shaft to butt",
        length_mm=15.0,
        diameter_start_mm=14.0,
        diameter_end_mm=14.0,
        shape=SegmentShape.CYLINDER,
        material=MATERIALS["joint_brass"],
        subdivisions=32,
        notes="Polished brass/gold appearance with metallic sheen"
    ),
    Segment(
        name="forearm",
        order=5,
        description="Decorative wood section with taper",
        length_mm=200.0,
        diameter_start_mm=14.0,
        diameter_end_mm=20.0,
        shape=SegmentShape.TAPERED_CYLINDER,
        material=MATERIALS["forearm_wood"],
        subdivisions=32,
        notes="Darker decorative wood, gradual taper to grip"
    ),
    Segment(
        name="wrap",
        order=6,
        description="CUSTOM LAYER AREA - Grip wrap for texture customization",
        length_mm=300.0,
        diameter_start_mm=20.0,
        diameter_end_mm=24.0,
        shape=SegmentShape.TAPERED_CYLINDER,
        material=MATERIALS["outside"],
        subdivisions=48,
        is_customizable=True,
        notes="PRIMARY CUSTOMIZATION ZONE - Material named 'outside' for Three.js"
    ),
    Segment(
        name="butt_sleeve",
        order=7,
        description="Decorative butt sleeve with taper",
        length_mm=150.0,
        diameter_start_mm=24.0,
        diameter_end_mm=28.0,
        shape=SegmentShape.TAPERED_CYLINDER,
        material=MATERIALS["butt_wood"],
        subdivisions=32,
        notes="Dark hardwood, ebony-like appearance"
    ),
    Segment(
        name="bumper",
        order=8,
        description="Rubber end cap for protection",
        length_mm=10.0,
        diameter_start_mm=28.0,
        diameter_end_mm=29.0,
        shape=SegmentShape.CYLINDER_ROUNDED_BOTTOM,
        material=MATERIALS["bumper_rubber"],
        subdivisions=24,
        notes="Black rubber with matte finish, slight dome on bottom"
    )
]

# =============================================================================
# DECORATIVE RINGS
# =============================================================================

DECORATIVE_RINGS: List[DecorativeRing] = [
    DecorativeRing(
        name="ring_forearm_end",
        position_after_segment="forearm",
        offset_mm=-5.0,
        length_mm=3.0,
        diameter_mm=20.5,
        material=MATERIALS["ring_gold"]
    ),
    DecorativeRing(
        name="ring_wrap_end",
        position_after_segment="wrap",
        offset_mm=5.0,
        length_mm=3.0,
        diameter_mm=24.5,
        material=MATERIALS["ring_gold"]
    )
]

# =============================================================================
# EXPORT SETTINGS
# =============================================================================

EXPORT_SETTINGS = {
    "format": "GLB",
    "output_path": "../public/cue.glb",
    "scale_factor": 0.001,  # mm to meters for Three.js
    "apply_modifiers": True,
    "export_materials": True,
    "use_draco": False
}

# =============================================================================
# DIMENSIONAL CONSTANTS
# =============================================================================

TOTAL_LENGTH_MM = 1435.0  # Calculated from segments (56.5 inches)
ORIENTATION_AXIS = "Y"
TIP_DIRECTION = "+Y"
CENTER_AT_ORIGIN = True

# UV mapping for customizable wrap segment
UV_WRAP_CONFIG = {
    "type": "cylindrical",
    "seam_angle_deg": 180,
    "u_range": (0.0, 1.0),
    "v_range": (0.0, 1.0)
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_segment_by_name(name: str) -> Optional[Segment]:
    """Get segment by name."""
    for seg in SEGMENTS:
        if seg.name == name:
            return seg
    return None


def get_customizable_segment() -> Optional[Segment]:
    """Get the segment marked as customizable."""
    for seg in SEGMENTS:
        if seg.is_customizable:
            return seg
    return None


def calculate_total_length() -> float:
    """Calculate total length from all segments."""
    return sum(seg.length_mm for seg in SEGMENTS)


def get_segment_positions() -> dict:
    """Calculate Y position for each segment (bottom of segment)."""
    positions = {}
    current_y = -TOTAL_LENGTH_MM / 2  # Start from bottom (bumper)

    # Reverse order since we build from bumper up to tip
    for seg in reversed(SEGMENTS):
        positions[seg.name] = current_y
        current_y += seg.length_mm

    return positions


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple (0-1 range)."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return (r, g, b, 1.0)


# =============================================================================
# QUICK REFERENCE (print when run directly)
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("POOL CUE SPECIFICATIONS")
    print("=" * 60)
    print(f"\nTotal Length: {TOTAL_LENGTH_MM}mm ({TOTAL_LENGTH_MM/25.4:.1f} inches)")
    print(f"Calculated Length: {calculate_total_length()}mm")
    print(f"\nOrientation: {ORIENTATION_AXIS} axis, tip at {TIP_DIRECTION}")
    print("\nSegments (tip to butt):")
    print("-" * 60)

    for seg in SEGMENTS:
        custom_mark = " [CUSTOMIZABLE]" if seg.is_customizable else ""
        print(f"  {seg.order}. {seg.name:15} | {seg.length_mm:6.0f}mm | "
              f"D: {seg.diameter_start_mm:.1f}-{seg.diameter_end_mm:.1f}mm | "
              f"{seg.material.name}{custom_mark}")

    print("\nDecorative Rings:")
    print("-" * 60)
    for ring in DECORATIVE_RINGS:
        print(f"  - {ring.name}: after {ring.position_after_segment}, "
              f"D={ring.diameter_mm}mm, L={ring.length_mm}mm")

    print("\nMaterial Colors:")
    print("-" * 60)
    for name, mat in MATERIALS.items():
        print(f"  {name:20} | {mat.base_color_hex} | "
              f"R={mat.roughness:.2f} M={mat.metallic:.2f}")
