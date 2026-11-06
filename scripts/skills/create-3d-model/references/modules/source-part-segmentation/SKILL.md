---
name: source-part-segmentation
description: Segment overlapping visual parts from source images, wireframes, texture atlases, and decals before mesh reconstruction. Use when a mascot/logo/template contains touching or overlapping components and exact structural part masks are needed before contour-to-mesh, UV fitting, or landmark repair.
when_to_use: Overlapping part extraction, component masks, marker/watershed segmentation, contour hierarchy analysis, atlas part isolation, manual seed fallback for source-locked Blender reconstruction.
allowed-tools: Read Bash Glob Grep
---

> **本技能运行在 GuaDa Blender 插件上。**
>
> 工具名映射：`blender_python` → `blender_python`；`blender_scene_info` → `blender_scene_info`；
> `blender_object_info` → `blender_scene_info({ object_name })`；`read_image` → `image_view`；
> 确定性脚本一律通过 `blender_helper_catalog` / `blender_helper_run` 调用。
>
> 原文中的 **BlenderMCP、固定 MCP 工具名、外部控制端口、Codex/Claude 专属指令**一律作废。
> 所有 `*_path` 必须在当前会话 workspace 内；输出默认不覆盖（需要时显式 `allow_overwrite=true`）。
> 渲染/预览成功后必须用 `image_view` 真的看图，再判断是否完成。


# Source Part Segmentation

Use this before `contour-to-mesh` when a source image contains overlapping or touching designed parts.
The output is not “nice masks”; it is a **source-of-truth part inventory** that downstream geometry must obey.

## Inputs

- source image, wireframe, decal, or texture atlas;
- optional manual seed manifest with named parts, polygons, seed points, rough rectangles, or HSV/color ranges;
- source manifest with structural/decorative/context classification and expected part count.

## Workflow

1. Choose the cleanest modality: alpha, edge, dark-line, bright-on-dark, color-band, or atlas region.
2. Extract contours and hierarchy to identify candidate objects, holes, nested details, and strokes.
3. If components touch, run distance-transform marker watershed first.
4. If watershed over/under-splits, switch to **seeded segmentation**:
   - create named part seeds (`bbox`, `polygon`, or `seed_point` + optional flood/HSV tolerance);
   - save one mask per named structural part;
   - mark ambiguous overlaps explicitly instead of merging them.
5. Classify masks as `structural`, `decorative`, `face_feature`, `aura_context`, or `validation_only`.
6. Pass structural masks to `contour-to-mesh`; pass feature masks/landmarks to `landmark-fit-repair`; pass atlas regions to `atlas-uv-fitting`.

## Hard rules

- Do not infer repeated parts from symmetry; segment what the source shows.
- Do not merge overlapping components if the manifest expects separate structural meshes.
- Do not proceed to final modeling when part count differs between source images; write a conflict report or canonical policy.
- If automatic segmentation is ambiguous, write an ambiguity report and require or create manual seed rectangles/points.
- Keep stroke/line masks separate from filled-part masks; wireframe strokes are guides unless explicitly used as the contour boundary.

## Seed manifest schema

```json
{
  "schema": "source_part_seed_manifest.v1",
  "image": "path/to/source.png",
  "parts": [
    {"name":"leaf_top", "class":"structural", "bbox":[x,y,w,h], "mode":"non_background"},
    {"name":"face_shell", "class":"structural", "polygon":[[x,y],[x,y],...], "mode":"polygon"}
  ]
}
```

Allowed `mode` values: `polygon`, `bbox`, `non_background`, `dark_lines`, `bright_on_dark`, `hsv_range`.

## Scripts

- `scripts/segment_source_parts.py` produces component masks and a JSON report from an image, with optional watershed.
- `scripts/seeded_part_masks.py` converts a named seed manifest into deterministic named masks and a part inventory.

## Sources distilled

- OpenCV contours/hierarchy/moments are the base measurement layer.
- OpenCV distance transform + marker watershed is the first automated split method for touching components.
- Active contour refinement can improve a rough mask boundary after segmentation.
