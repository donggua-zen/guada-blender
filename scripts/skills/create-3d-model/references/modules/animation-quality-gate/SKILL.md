---
name: animation-quality-gate
description: Validate Blender animation attempts before accepting them by rendering contact sheets, checking silhouette stability, flicker, framing, subject dominance, layer separation, export compatibility, and motion-design coherence. Use after animation renders or when the user says motion/morph/outside elements look bad.
when_to_use: Animation QA, contact-sheet review, motion critique, morph validation, texture flicker detection, storyboard checks, rejecting bad animation passes, pre-export animation acceptance gates.
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


# Animation Quality Gate

Do not accept an animation because it rendered. Accept it only after a contact sheet and failure analysis pass.

## Review dimensions

1. **Subject dominance** — the main asset remains readable and is not overwhelmed by HUD/context.
2. **Layer separation** — base subject, texture state, glow, HUD, and background are separate enough to control.
3. **Silhouette stability** — silhouette stays constant unless deliberate morph is specified.
4. **Texture coherence** — no ugly full-image crossfade, crop pop, or unregistered morph.
5. **Motion coherence** — arcs/dots have a reason, restrained speed, and coherent easing.
6. **Export truth** — the final export can reproduce the effect or limitations are explicit.
7. **Frame aesthetics** — sampled frames look good as stills.

## RALPH trigger

If a user calls an animation ugly/bad, stop rebuilding immediately. First:

- collect preview frames/contact sheet;
- identify the failed dimension(s);
- invoke `quality-refinement-autoloop` if the stack lacks a method;
- add/refine generic skills only after sanitization;
- only then rebuild the animation.

## Hard gates

- No final animation without a contact sheet.
- No GLB claim for texture swaps implemented only with Blender Python handlers.
- No decorative context elements in base avatar export unless requested.
- No morph that violates locked geometry constraints.

## Scripts

- `scripts/animation_contact_sheet.py` builds a contact sheet and frame-to-frame difference report from rendered frames.
