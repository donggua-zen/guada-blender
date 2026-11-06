---
name: orthographic-registration
description: Register front, side, back, and top orthographic reference views into a shared Blender coordinate contract. Use when a 3D model must match multi-view wireframes/templates, when side/back/top silhouettes are off, or before adding depth to a front-locked contour model.
when_to_use: Multi-view mascot/object reconstruction, depth fitting from side/back/top views, orthographic blueprint alignment, reference planes/cameras with shared scale and centerline.
allowed-tools: Read Bash Glob Grep blender_python blender_scene_info
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

# Orthographic Registration

This skill prevents the common failure where the front view looks plausible but the side/back/top views are wrong.

## Coordinate contract

- Front view defines `X/Z` silhouette.
- Side view defines `Y/Z` depth envelope.
- Top view defines `X/Y` spread.
- Back view defines rear silhouette/material only; it must not rewrite the front silhouette.

## Workflow

1. Run `scripts/register_views.py` on the available view images.
2. Create orthographic reference planes/image empties with a single shared scale.
3. Align centerline and bbox centers before modeling.
4. Lock front X/Z boundary vertices.
5. Add Y depth from side/top envelopes using modifiers/displacement or vertex groups.
6. Validate all four cameras before export.

## Failure policy

If views disagree, front brand read wins. Document the conflict in `registration_report.json`.


## Front-plane rotation rule

In this Blender coordinate convention, the front camera looks along the Y axis and the reference silhouette lives in the X/Z plane. Therefore 2D rotations inside the front view are rotations around the **Y axis**, not around Z. Use `rotation_euler = (0, angle, 0)` for 2D component orientation in the front projection. Z rotation spins objects into/out of screen-space incorrectly for X/Z-plane meshes.

## Sources distilled

- Blender Image Empty/reference image controls for orthographic blueprints.
- OpenCV homography/alignment and geometric transforms for view registration.
