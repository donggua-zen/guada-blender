# GuaDa Blender

GuaDa 的**三方插件**：把 Blender 3D 建模、场景检查、预览、渲染与导出接进 GuaDa。

> 参考 `CheshireJCat/blender`（dsh-blender）的能力形态，首期实现 **8 个工具 + 1 个编排技能**。
> 不依赖 BlenderMCP、不开放控制端口：每次操作启动独立的 `blender --background` 进程。

## 工具

| 工具 | 用途 |
|---|---|
| `blender_status` | 检查 Blender 路径/版本、workspace、配置 |
| `blender_scene_info` | 只读检查 `.blend`（可指定对象） |
| `blender_run_script` | 运行 workspace 内的 `.py`（等价 `--python`） |
| `blender_import` | GLB/GLTF、FBX、OBJ、STL、USD、PLY、DAE → `.blend` |
| `blender_python` | 执行小段 `bpy`/`bmesh` 并保存新 `.blend` |
| `blender_preview` | 临时相机+灯光预览（不改源文件） |
| `blender_render` | 场景相机渲染单帧 |
| `blender_export` | 导出 GLB/GLTF、FBX、OBJ、STL、USD、PLY |

技能：`create-3d-model`（编排流程 + 质量门）。

## 安装

开发期（本地目录）：

```
local:D:/AI/work/guada-blender
```

发布后：

```
github:donggua-zen/guada-blender#main
```

安装后在插件页启用；设置页（设置 → GuaDa Blender）可配置 Blender 路径。

## 依赖

- GuaDa（PluginApi v2）
- Blender 4.x/5.x（本机验证 4.5）
- 无需 Python 第三方包（helper 分析能力不在本期范围）

## 配置

| Key | 默认 | 说明 |
|---|---|---|
| `blenderExecutable` | 自动探测 | 绝对路径或 PATH 命令名 |
| `timeoutMs` | 180000 | 单次 Blender 调用超时 |
| `maxOutputChars` | 20000 | 返回日志上限 |
| `restrictToWorkspace` | true | 工具参数限制在会话 workspace 内 |
| `enablePython` | true | 允许 `blender_python` / `blender_run_script` |

## 安全边界

- 所有 `*_path` 参数在插件侧做 workspace 守卫（realpath、防越界、默认不覆盖）。
- `blender_python` / `blender_run_script` 拥有与本机 Python 相同的权限；只应运行可信代码。
- `blender_run_script` 只校验脚本路径；脚本内部的读写由脚本自己决定。
- 每次调用使用独立临时目录，结束后清理。

## 开发

```bash
npm run check
npm test
npm run build     # 生成 frontend/dist/SettingsPage.js
```

## 许可证

MIT。Blender 侧 driver 移植自 `CheshireJCat/blender`（MIT），见 `NOTICE`。
