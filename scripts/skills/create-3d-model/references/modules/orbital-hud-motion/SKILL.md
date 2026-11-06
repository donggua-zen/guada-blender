---
name: orbital-hud-motion
description: Create tasteful circular/orbital HUD and aura animations around a Blender subject using source-derived arcs, dots, dashes, opacity, parallax, and restrained motion. Use when decorative circles, halos, orbit markers, scanner rings, or HUD effects must correlate with a logo/mascot rather than looking like random oversized rings.
when_to_use: Animated circular HUD elements, aura rings, orbit arcs, dots, dashed circles, halo effects, mascot/logo motion graphics, source-derived decorative elements, avoiding bad outside-element animation.
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


# Orbital HUD Motion

Decorative circles are design elements, not filler. They must be derived from the reference composition and support the subject.

## Design rules

- Keep the avatar/subject dominant; rings should frame, not trap or overpower it.
- Derive radii, arc breaks, marker positions, and dash density from the reference image when possible.
- Separate layers:
  - far/background aura: faint, slow, soft;
  - mid orbit: thin arcs/dashes;
  - markers/dots: sparse and synchronized;
  - foreground accents: rare and short-lived.
- Prefer opacity/emission/dash phase over large rotation/scale changes.
- Never animate all rings in the same direction/speed; use subtle counter-motion/parallax.
- Do not include context rings in the base avatar mesh/export unless explicitly requested.

## Animation recipe

1. Create an `HUD_CONTEXT` collection separate from `AVATAR_BASE`.
2. Build arcs/dots from a manifest of normalized radii and angles.
3. Keyframe:
   - dash offset or arc reveal;
   - emission strength pulse;
   - subtle rotation (1–12 degrees per loop, not full spin unless requested);
   - marker opacity/scale blips at beats.
4. Render a contact sheet with subject-only and with-HUD views.
5. Reject if rings obscure the face/silhouette or dominate the frame.

## Hard rules

- No random full circles when the reference has broken arcs/dashed guides.
- No oversized markers unless the source has them.
- No HUD animation until static avatar baseline is locked.
- For GLB, use object transforms/material keyframes or document runtime requirements.

## Scripts

- `scripts/orbit_layout_manifest.py` creates a source-independent orbit manifest from simple radii/angle parameters.
