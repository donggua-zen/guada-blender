---
name: create-3d-model
description: 用 GuaDa Blender 工具完成 3D 建模、资产重建、预览、渲染与导出；先检查环境，再分小步修改，渲染后必须看图验收。
---

# 3D 建模 / 重建流程

本技能由 `guada-blender` 插件提供。所有操作启动独立的 Blender 后台进程，不依赖 BlenderMCP、不开放控制端口。

## 工具

| 工具 | 用途 |
|---|---|
| `blender_status` | 检查 Blender 路径/版本、workspace、配置；第一步必须调用 |
| `blender_scene_info` | 只读检查 `.blend`；`object_name` 可看单对象细节 |
| `blender_run_script` | 运行 workspace 内的 `.py`（等价 `blender --background --python`） |
| `blender_import` | GLB/GLTF、FBX、OBJ、STL、USD、PLY、DAE → 新的 `.blend` |
| `blender_python` | 执行小段 `bpy`/`bmesh` 代码并保存新的 `.blend` |
| `blender_preview` | 临时相机+灯光预览（不改源文件） |
| `blender_render` | 用场景相机渲染单帧 |
| `blender_render_frames` | 按帧号批量渲染（`"1,3,5-7"`，最多 120 帧） |
| `blender_export` | 导出 GLB/GLTF、FBX、OBJ、STL、USD、PLY |
| `blender_validate_scene` | 非破坏性结构审计：general / web / 3d-print / animation |
| `blender_validate_export` | 干净进程回读导出物并审计 |
| `blender_helper_catalog` | 列出确定性 helper 与依赖/可用性 |
| `blender_helper_run` | 执行白名单 helper（参数走 `arguments_json`） |

## 标准流程

1. **检查环境**：`blender_status`。若 `available=false`，先让用户在插件设置页填 Blender 路径，不要猜。
2. **看现状**：`blender_scene_info`（已有 `.blend`）或 `blender_import`（外部模型）。
3. **分小步修改**：每次 `blender_python` 只做一件事（导入、变换、材质、灯光、相机），保存成新 `.blend`。不要一次性写几百行。
4. **出视觉证据**：`blender_preview`（快速 blockout）或 `blender_render`（正式）。成功后**必须**用 `image_view` 看图，再判断是否完成。
5. **验收**：确认对象数量/包围盒/材质/相机/帧范围；必要时再 `blender_scene_info`。
6. **导出**：`blender_export` 到 GLB/GLTF/FBX 等；导出后可用 `blender_import` 回读验证。

## 验收门（导出前后）

1. **导出前**：`blender_validate_scene({ blend_path, profile })`
   - 角色/一般资产用 `general`；Web 交付用 `web`；3D 打印用 `3d-print`；带动画用 `animation`。
   - `errors` 非空时工具会标记失败：先修拓扑/材质/UV，再继续。
   - `warnings` 不阻塞，但要在交付说明里列出。
2. **导出后**：`blender_validate_export({ model_path, profile })`
   - 用干净进程回读 GLB/FBX/STL，确认导入对象数、材质、UV 与场景一致。
   - `validation.passed=false` 时不要声称"导出成功"。
3. **动画交付**：用 `blender_render_frames({ frames: "1,30,60" })` 抽代表帧，再逐张 `image_view` 检查。
   - 单次最多 120 帧；输出目录已有同名帧时默认拒绝覆盖，换目录或显式 `allow_overwrite=true`。

## 参考图分析（helper，可选）

当任务是"照着参考图重建/对齐"时，先用确定性的 helper 出证据，再改模型：

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
- 缺依赖时 `catalog` 会返回 `missing`；让用户在设置页指到已安装 numpy/opencv/Pillow 的 Python，不要猜路径或自动 `pip install`。
- helper 的 JSON 报告是"证据"，不要只贴结论；把关键指标写进交付说明。

## 硬性规则

- 所有 `*_path` 参数必须在当前会话 workspace 内；输出默认不覆盖已有文件（需要时显式 `allow_overwrite=true`）。
- 每次输出用新文件名，保留上一版便于对比/回滚。
- `blender_python` 与 `blender_run_script` 拥有与本机 Python 相同的权限：不要下载资源、访问凭据、安装包或启动无关进程。
- 渲染失败/超时先看返回的日志（stdout/stderr 已截断），不要盲目重试。
- 不要声称"已完成渲染"而没有真正调用 `image_view` 看过图。

## 复用已有脚本

如果 workspace 里已有建模脚本（例如 `blender-retarget/*.py`），优先用 `blender_run_script` 原样执行，而不是把脚本内容复制进 `blender_python`。脚本内部的读写路径由脚本自己决定，工具只校验脚本路径本身。
