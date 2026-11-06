---
name: multiview-constraint-solver
description: Determine whether front/side/back/top reference templates can be satisfied by one rigid 3D Blender model, choose a canonical source policy, and emit constraints before rebuilding. Use when multiview bboxes, silhouettes, part counts, or depth ratios contradict each other.
when_to_use: Orthographic template conflict detection, canonical view policy, rigid-vs-cheat-view decision, front/side/top dimension ratios, source-of-truth negotiation before reconstruction.
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

# Multiview Constraint Solver

Use this before another rebuild when references disagree. A renderer cannot make one rigid mesh satisfy mutually incompatible orthographic dimensions unless you allow view-specific cheats.

## Workflow

1. Normalize every reference view into a common axis contract:
   - front: width X, height Z;
   - side: depth Y, height Z;
   - top: width X, depth Y;
   - back: width X, height Z.
2. Measure visible body bboxes, not labels/background/aura unless they are part of the model contract.
3. Compare shared axes:
   - front width vs top width;
   - front/back height vs side height;
   - side depth vs top depth.
4. If ratios differ beyond tolerance, write a conflict report and select a policy:
   - `front_side_canonical`: front brand read and side depth/height are authoritative;
   - `front_top_canonical`: front brand read and top footprint are authoritative;
   - `corrected_templates_required`: no rigid rebuild should claim final fit;
   - `view_specific_cheats`: separate camera/view variants allowed, not one rigid asset.
5. Feed the chosen policy into `fit-repair-optimizer` before any geometry, UV, or lighting work.

## Hard gates

- Do not restart modeling until canonical policy exists.
- Do not treat top-view aura/context as body depth.
- Do not average contradictory dimensions unless the user explicitly asks for an approximate stylized compromise.
- Record part-count disagreements separately from bbox disagreements.

## Script

- `scripts/view_constraint_report.py` reads a JSON file of per-view body bboxes and emits shared-axis compatibility and a suggested canonical policy.
