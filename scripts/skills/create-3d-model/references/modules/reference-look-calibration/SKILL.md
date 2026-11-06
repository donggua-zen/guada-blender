---
name: reference-look-calibration
description: Calibrate Blender materials, lighting, camera crop, emission/glow, color management, and aura/HUD styling against supplied original/reference images using measurable color, brightness, saturation, bbox, and mask statistics. Use when a product must match the lighting/look of a source image or when audits say the product is too bright, desaturated, wrong hue, wrong glow, or wrong silhouette extent.
when_to_use: Reference-based look-dev, lighting/material/color calibration, original-image visual matching, glow/aura/HUD matching, HSV/brightness/mask fit reports, final look pass after geometry and UV are locked.
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


# Reference Look Calibration

This skill handles the final visual match after geometry and UVs are locked. It must not compensate for wrong shape, wrong UVs, or wrong camera framing.

## Inputs

- accepted geometry / UV fit reports;
- reference/original image(s);
- product preview render(s);
- optional mask overlays and multiview fit reports.

## Metrics

Use `scripts/look_fit_report.py` to compare:

- object/bright-mask IoU and bbox extent;
- configured hue-band mask IoU for glow/accent assets;
- mean/std HSV and BGR under object mask;
- brightness p95 / mean;
- saturation mean;
- hue drift.

## Calibration order

1. Camera crop / orthographic scale — object extent must match before color tuning.
2. World/background darkness.
3. Base material hue/value/saturation.
4. Emission strength and glow color.
5. Aura/HUD ring color and thickness.
6. Color management / exposure / gamma.
7. Final render overlay and metrics.

## Hard rules

- Do not tune lighting before geometry/UV fit gates pass.
- Do not change accent/glow hue away from the source reference unless the user explicitly asks.
- Do not hide mismatched geometry with bloom, fog, or overexposure.
- Write look metrics before and after calibration.

## Handoff

Consumes `validation/multiview_fit_report*.json` and product previews. Produces `validation/look_fit_report.json`, look overlays, and updated material/light/render settings.
