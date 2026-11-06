---
name: texture-state-animation
description: Design and validate texture-state transitions for Blender animations without ugly whole-image crossfades, texture popping, misregistered morphs, or target-engine-incompatible Python-only swaps. Use when animating between multiple source textures, mascot/logo states, style states, lightmaps, decals, or UI skins.
when_to_use: Texture state animation, texture morphs, material state transitions, image sequence planning, masked wipes, glow reveals, texture registration, avoiding bad crossfades, GLB-compatible texture animation planning.
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

# Texture State Animation

This skill exists because “crossfade several full images” usually looks bad. Texture animation must be designed like motion graphics: registered states, constrained transition channels, and preview gates.

## Failure modes to avoid

- Whole-frame crossfades between unrelated crops/compositions.
- Python frame handlers as the only playback mechanism when export/runtime support is needed.
- Texture swaps that change silhouette, camera crop, or scale at the same time as decorative motion.
- Mixing aura/background/HUD pixels into the avatar surface texture unless that is the intent.
- Morph pulses that break accepted geometry constraints such as constant depth.

## Workflow

1. **Register states first**: crop, scale, align, and color-normalize all source states into one canvas and one semantic mask.
2. **Classify pixels/layers**:
   - avatar surface/base;
   - facial decal/features;
   - glow/emission accents;
   - background/aura/context;
   - HUD/circle elements.
3. **Choose transition type per layer**, not one global blend:
   - avatar surface: hold, shimmer, subtle value/roughness pulse, or masked dissolve;
   - face features: hold or short opacity fade;
   - glow accents: emission pulse / traveling highlight;
   - aura/HUD: independent orbit/dash/dot animation;
   - background: separate plane/compositor, never baked into avatar unless requested.
4. **Use export-compatible channels when needed**:
   - keyframed material values, opacity, UV transform, shape keys, object transforms;
   - image sequence only if target supports it;
   - avoid Blender Python handlers for final GLB unless the target runtime will recreate them.
5. Render a contact sheet and flicker report before calling the animation acceptable.

## Acceptance gates

- Each texture state is registered to the same bbox/landmarks.
- No full-canvas crossfade is used unless state registration and semantics match.
- Avatar silhouette remains stable unless the story explicitly calls for a morph.
- Context/aura elements are separate from the avatar material.
- The exported format can reproduce the animation, or limitations are documented.

## Scripts

- `scripts/texture_transition_plan.py` creates a transition plan from source states and flags risky whole-frame crossfades.
