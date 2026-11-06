---
name: landmark-fit-repair
description: Validate and repair source-locked Blender models using named landmarks such as leaf tips, shell corners, eyes, smile, rim thickness, aura center/radius, and view-specific depth markers. Use when bbox/IoU is insufficient and the model must align to templates at designed feature points.
when_to_use: Landmark validation, feature-point deltas, control-point repair, face/eye/smile alignment, leaf tip alignment, aura ring fitting, iterative recipe parameter updates.
allowed-tools: Read Bash Glob Grep blender_python blender_scene_info blender_scene_info
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

# Landmark Fit Repair

Bbox and IoU are too coarse for final mascot/logo matching. This skill turns named feature drift into recipe edits.

## Landmark classes

- `structural_tip`: outer part tips and extrema;
- `shell_corner`: face/shell/rim corners;
- `feature`: eyes, smile, brows, decals;
- `ring`: aura center/radius/dots;
- `depth_marker`: side/back/top thickness markers.

## Workflow

1. Define a landmark JSON for the source reference.
2. Detect or render corresponding product landmarks.
3. Compare by name and view.
4. Convert deltas into repair actions: move boundary control point, scale one component, shift feature curve, tune depth, or adjust aura radius.
5. Rebuild from recipe; do not hand-edit final geometry without updating the recipe/manifest.

## Hard gates

- No final export when named structural landmarks exceed tolerance.
- Face features must be validated separately from body silhouette.
- Aura/context landmarks must not affect base GLB acceptance.

## Script

- `scripts/landmark_fit_report.py` compares two named-landmark JSON files and emits repair deltas.


## Landmark JSON schema

```json
{
  "schema": "landmarks.v1",
  "image_size": [width, height],
  "landmarks": [
    {"view":"front", "name":"leaf_top_tip", "class":"structural_tip", "x":627, "y":130}
  ]
}
```

For part masks, generate initial landmarks from extrema: top/bottom/left/right, centroid, and contour inflection points. Then rename them to semantic names before repair.
