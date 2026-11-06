---
name: texture-driven-mesh-fitting
description: Reshape source-locked mesh boundaries so the geometry fits texture-atlas or decal contours 1:1 before final UV/material work. Use when textures look off because the model behind them does not match the source texture region, or when the mesh must adapt to the texture instead of stretching the texture onto an approximate mesh.
when_to_use: Texture-driven geometry fitting, mesh boundary fitting to atlas masks, UV-preserving contour correspondence, point/landmark deformation, source mask to mesh repair.
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

# Texture-Driven Mesh Fitting

This skill fixes the common failure: a texture is mapped correctly, but the mesh silhouette underneath is wrong.
The mesh adapts to the source contour; the texture is not stretched to hide a wrong mesh.

## Preconditions

- Structural parts are segmented (`source-part-segmentation`).
- Each part has a contour/mask and, if textured, an atlas region (`atlas-uv-fitting`).
- The object is source-locked in front X/Z before depth is added.
- Canonical view policy is resolved (`multiview-constraint-solver`) if views conflict.

## Workflow

1. Extract source contour from the texture/wireframe region.
2. Extract current mesh boundary in the same projected coordinate space.
3. Build ordered contour correspondence by arc length, named landmarks, or seam/control points.
4. Move boundary vertices to source contour positions.
5. Move interior vertices by smooth interpolation, piecewise-affine warp, or thin-plate-spline style deformation.
6. Preserve UV parameterization by remapping boundary-fitted local coordinates into the atlas rectangle.
7. Re-render overlay; do not proceed to look-dev until texture-region silhouette passes.

## Acceptance gates

- Per-part source/product bbox center and size within tolerance.
- Boundary maximum sample error below tolerance after normalization.
- Texture atlas region does not visibly bleed outside the fitted mesh in front view.
- Named landmarks (`leaf_tip`, `base_left`, `base_right`, `face_corner`, etc.) pass `landmark-fit-repair`.

## Hard rules

- If a texture crop has a different silhouette than the mesh, reshape the mesh first.
- Do not use global UV stretching to hide geometry mismatch.
- Boundary fitting must happen before side-depth/crown deformation.
- Do not tune material/light to compensate for geometry/UV misfit.

## Scripts

- `scripts/contour_correspondence_report.py` reports bbox, centroid, and sampled contour deltas between a source mask and a render/object mask.

## Sources distilled

- Piecewise-affine/landmark warping gives a practical mesh deformation model.
- Thin-plate-spline style deformation is appropriate for smooth mascot/logo surfaces when landmarks are sparse.
- Blender mesh vertices/UV layers can be edited directly; BMesh is useful for cleanup after deformation.
