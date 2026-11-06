---
name: fit-repair-optimizer
description: Turn multiview fit reports into a sequential or parallel repair queue for aligning Blender products to source-of-truth templates. Use after validation shows disalignment, when the agent must iteratively fix wireframe, texture, lighting, or projection mismatches, and when skill gaps should trigger self-refinement before another rebuild.
when_to_use: Iterative source-of-truth alignment repair, choosing sequential vs parallel correction order, generating fit repair queues, stopping on contradictory templates, or coordinating geometry/UV/lighting fixes from validation reports.
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

# Fit Repair Optimizer

This skill converts validation failures into an executable repair queue. The source templates are the contract; the current model is disposable.

## Decision: sequential or parallel?

Use **sequential repair** when failures are coupled:

1. Canonical view / source conflict unresolved.
2. Front silhouette or part count fails.
3. Geometry dimensions fail before UVs can be trusted.
4. Texture region boundaries depend on geometry changes.
5. Lighting/look depends on final material placement.

Use **parallel repair** only for independent tracks with disjoint write scopes:

- geometry recipe/placement tuning;
- atlas-region classification;
- material/look calibration;
- validation tooling improvements.

Do not parallelize two tasks that both edit the same Blender recipe, object transforms, or UV assignment file.

## Mandatory repair order

```
0 source-conflict / multiview-rigidity gate
1 structural part count
2 front silhouette and landmarks
3 side/back/top depth and projection
4 UV/texture region fit
5 material/light/look calibration
6 export and final validation
```

If an earlier stage fails, later stages may be analyzed but must not be finalized.

## Source-conflict gate

Before repair, use `multiview-constraint-solver` to check whether templates are mutually satisfiable. If the same physical axis receives incompatible ratios across views, write a conflict report and require a canonical policy:

- front+side canonical;
- front+top canonical;
- corrected template sheet;
- view-specific cheat renders only, not a rigid 3D model.

## Repair queue schema

Each repair item must include:

- `id`
- `stage`
- `view_scope`
- `failure`
- `measured_delta`
- `proposed_action`
- `write_scope`
- `parallel_group`
- `blocked_by`
- `acceptance_gate`

## Skill-gap rule

If the same failure recurs twice, stop and invoke `quality-refinement-autoloop` before another rebuild. The autoloop must capture evidence, diagnose the missing method, sanitize the lesson into generic publishable guidance, patch the relevant skill(s), validate the skill stack, then return here with a new repair queue. Common routing:

- geometry mismatch → `contour-to-mesh`, `orthographic-registration`, or this skill;
- UV/texture mismatch → `atlas-uv-fitting`;
- lighting mismatch → add/look-calibrate guidance to `blender-lighting` or a look-calibration skill;
- validation mismatch → `multiview-fit-loop` / `reference-analysis-validator`.

## Output

Write a project repair plan such as `ALIGNMENT_REPAIR_QUEUE.json` and a human-readable `ALIGNMENT_REPAIR_METHOD.md`.
