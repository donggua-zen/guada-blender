---
name: create-3d-model
description: 用 GuaDa Blender 工具完成 3D 建模、资产重建、预览、渲染、验收与导出。先检查环境，再按模块路由选最小技能集，分小步修改，渲染后必须看图验收。
---

# 3D 建模 / 重建总编排

本技能由 `guada-blender` 插件提供，配套 29 个领域模块技能（`references/modules/*/SKILL.md`）。
所有操作启动独立的 Blender 后台进程，不依赖 BlenderMCP、不开放控制端口。

## 工具

| 工具 | 用途 |
|---|---|
| `blender_status` | 检查 Blender 路径/版本、workspace、分析 Python、helper 可用性 |
| `blender_scene_info` | 只读检查 `.blend`；`object_name` 看单对象细节 |
| `blender_run_script` | 运行 workspace 内的 `.py`（等价 `blender --background --python`） |
| `blender_import` | GLB/GLTF、FBX、OBJ、STL、USD、PLY、DAE → 新的 `.blend` |
| `blender_python` | 执行小段 `bpy`/`bmesh` 代码并保存新的 `.blend` |
| `blender_preview` | 临时相机+灯光预览（不改源文件） |
| `blender_render` | 场景相机渲染单帧 |
| `blender_render_frames` | 按帧号批量渲染（`"1,3,5-7"`，最多 120 帧） |
| `blender_export` | 导出 GLB/GLTF、FBX、OBJ、STL、USD、PLY |
| `blender_validate_scene` | 结构审计（general / web / 3d-print / animation） |
| `blender_validate_export` | 干净进程回读导出物并审计 |
| `blender_helper_catalog` | 列出确定性 helper 与依赖/可用性 |
| `blender_helper_run` | 执行白名单 helper（参数走 `arguments_json`） |

## 模块路由（只加载需要的）

| 任务 | 加载模块技能 |
|---|---|
| 从零建几何、改网格、加修改器 | `blender-modeling` |
| 材质 / PBR / 程序化纹理 | `blender-materials` |
| 打光 / 三点光 / HDRI | `blender-lighting` |
| 相机 / 构图 / 景深 / 运镜 | `blender-cameras` |
| 渲染设置 / 采样 / 色彩管理 | `blender-rendering` |
| 关键帧 / 缓动 / 形变键 / 驱动器 | `blender-animation` |
| UV 展开 / 图集 / 烘焙 / 贴花 | `blender-uv-texturing` |
| 导出格式 / 轴向 / 贴图打包 | `blender-export` |
| 照参考图重建 | `reference-to-3d` |
| 线框/技术图 → 3D | `wireframe-to-3d` |
| 轮廓 → 网格 | `contour-to-mesh` |
| 多视图配准 / 约束 | `orthographic-registration`、`multiview-constraint-solver`、`multiview-fit-loop` |
| 参考图度量 / 渲染对比 | `reference-analysis-validator`、`reference-look-calibration` |
| 部件分割 / 图集匹配 | `source-part-segmentation`、`atlas-uv-fitting`、`texture-driven-mesh-fitting`、`closed-surface-uv-coverage` |
| 动画 QA | `animation-quality-gate`、`texture-state-animation`、`orbital-hud-motion` |
| 结果反复不达标 → 修复计划 | `quality-refinement-autoloop`、`fit-repair-optimizer`、`landmark-fit-repair` |
| 多阶段生产 / 完整场景 | `blender-pro-workflow`、`blender-skill-harmonizer` |
| 吉祥物/Logo 重建 | `mascot-logo-reconstruction` |

完整选择表见 `references/capability-map.md`；工具名与路径契约见 `references/guada-integration.md`。

## 标准流程

1. **检查环境**：`blender_status`。`available=false` 时让用户在插件设置页填 Blender 路径，不要猜。
2. **看现状**：`blender_scene_info`（已有 `.blend`）或 `blender_import`（外部模型）。
3. **选模块**：按上面的路由表，只加载需要的 1–3 个模块技能。
4. **分小步修改**：每次 `blender_python` 只做一件事（导入、变换、材质、灯光、相机），保存成新 `.blend`。不要一次写几百行。
5. **出视觉证据**：`blender_preview`（快速 blockout）或 `blender_render`（正式）。成功后**必须**用 `image_view` 看图再判断。
6. **验收门**：导出前 `blender_validate_scene`；导出后 `blender_validate_export`。
7. **交付**：`blender_export` 到目标格式；保留 `.blend` 工程源。

## 验收门（导出前后）

1. **导出前**：`blender_validate_scene({ blend_path, profile })`
   - 角色/一般资产用 `general`；Web 交付用 `web`；3D 打印用 `3d-print`；带动画用 `animation`。
   - `errors` 非空时工具会标记失败：先修拓扑/材质/UV，再继续。
   - `warnings` 不阻塞，但要在交付说明里列出。
2. **导出后**：`blender_validate_export({ model_path, profile })`
   - 用干净进程回读 GLB/FBX/STL，确认导入对象数、材质、UV 与场景一致。
   - `validation.passed=false` 时不要声称"导出成功"。
3. **动画交付**：`blender_render_frames({ frames: "1,30,60" })` 抽代表帧，再逐张 `image_view`。
   - 单次最多 120 帧；输出目录已有同名帧时默认拒绝覆盖。

## 参考图分析（helper）

当任务是"照着参考图重建/对齐"时，先用确定性 helper 出证据，再改模型：

1. `blender_helper_catalog`：确认 Python 环境与依赖（numpy / opencv / Pillow）。
2. `reference-manifest-compiler`：参考图 → 尺寸/组件/bbox 清单。
3. `template-analyzer` 或 `segment-source-parts`：提取模板/部件掩码。
4. 渲染后：`render-overlay-validator` / `silhouette-validator` 对比参考图与渲染图。
5. 动画：`animation-contact-sheet` 把抽帧拼成一张图并标出跳变。

调用方式：

```json
{
  "name": "silhouette-validator",
  "arguments_json": "{\"reference\":\"ref.png\",\"render\":\"out/render.png\",\"out\":\"out/silhouette.json\"}"
}
```

规则：

- 路径参数必须在当前 workspace 内；输出默认不覆盖。
- 缺依赖时 `catalog` 会返回 `missing`；让用户在设置页指到已安装依赖的 Python，不要猜路径或自动 `pip install`。
- helper 的 JSON 报告是"证据"，不要只贴结论；把关键指标写进交付说明。

## 硬性规则

- 所有 `*_path` 参数必须在当前会话 workspace 内；输出默认不覆盖已有文件（需要时显式 `allow_overwrite=true`）。
- 每次输出用新文件名，保留上一版便于对比/回滚。
- `blender_python` 与 `blender_run_script` 拥有与本机 Python 相同的权限：不要下载资源、访问凭据、安装包或启动无关进程。
- 渲染失败/超时先看返回的日志（stdout/stderr 已截断），不要盲目重试。
- 不要声称"已完成渲染"而没有真正调用 `image_view` 看过图。

## 复用已有脚本

如果 workspace 里已有建模脚本（例如 `blender-retarget/*.py`），优先用 `blender_run_script` 原样执行，而不是把脚本内容复制进 `blender_python`。脚本内部的读写路径由脚本自己决定，工具只校验脚本路径本身。
