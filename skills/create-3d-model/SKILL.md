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
| `blender_export` | 导出 GLB/GLTF、FBX、OBJ、STL、USD、PLY |

## 标准流程

1. **检查环境**：`blender_status`。若 `available=false`，先让用户在插件设置页填 Blender 路径，不要猜。
2. **看现状**：`blender_scene_info`（已有 `.blend`）或 `blender_import`（外部模型）。
3. **分小步修改**：每次 `blender_python` 只做一件事（导入、变换、材质、灯光、相机），保存成新 `.blend`。不要一次性写几百行。
4. **出视觉证据**：`blender_preview`（快速 blockout）或 `blender_render`（正式）。成功后**必须**用 `image_view` 看图，再判断是否完成。
5. **验收**：确认对象数量/包围盒/材质/相机/帧范围；必要时再 `blender_scene_info`。
6. **导出**：`blender_export` 到 GLB/GLTF/FBX 等；导出后可用 `blender_import` 回读验证。

## 硬性规则

- 所有 `*_path` 参数必须在当前会话 workspace 内；输出默认不覆盖已有文件（需要时显式 `allow_overwrite=true`）。
- 每次输出用新文件名，保留上一版便于对比/回滚。
- `blender_python` 与 `blender_run_script` 拥有与本机 Python 相同的权限：不要下载资源、访问凭据、安装包或启动无关进程。
- 渲染失败/超时先看返回的日志（stdout/stderr 已截断），不要盲目重试。
- 不要声称"已完成渲染"而没有真正调用 `image_view` 看过图。

## 复用已有脚本

如果 workspace 里已有建模脚本（例如 `blender-retarget/*.py`），优先用 `blender_run_script` 原样执行，而不是把脚本内容复制进 `blender_python`。脚本内部的读写路径由脚本自己决定，工具只校验脚本路径本身。
