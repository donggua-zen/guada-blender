'use strict';

/**
 * Helper 白名单目录（Phase 3）
 *
 * 只收录本机 Python 3.13 已具备依赖（numpy / opencv / Pillow）的确定性 helper。
 * 需要 scipy 的 helper（wireframe-analyzer、contour-to-mesh）暂不收录。
 */

const HELPERS = [
  {
    name: 'animation-contact-sheet',
    module: 'animation-quality-gate',
    description:
      '把动画帧拼成带标签的 contact sheet，并标记帧间视觉跳变。',
    runtime: 'python',
    dependencies: ['Pillow'],
    script: 'animation-quality-gate/scripts/animation_contact_sheet.py',
    arguments: [
      { name: 'frames', flag: '--frames', type: 'path-array', pathKind: 'input-file', required: true },
      { name: 'out_image', flag: '--out-image', type: 'path', pathKind: 'output-file', required: true },
      { name: 'out_report', flag: '--out-report', type: 'path', pathKind: 'output-file', required: true },
      { name: 'cols', flag: '--cols', type: 'integer' },
    ],
  },
  {
    name: 'reference-manifest-compiler',
    module: 'reference-analysis-validator',
    description:
      '分类参考图并编译尺寸、掩码、连通域、bbox、质心等机器可读证据。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-analysis-validator/scripts/reference_manifest_compiler.py',
    arguments: [
      { name: 'inputs', positional: true, type: 'path-array', pathKind: 'input-path', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      { name: 'min_area', flag: '--min-area', type: 'integer' },
    ],
  },
  {
    name: 'render-overlay-validator',
    module: 'reference-analysis-validator',
    description:
      '测量参考图/渲染图的重叠与误差指标，可选输出混合 overlay。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-analysis-validator/scripts/render_overlay_validator.py',
    arguments: [
      { name: 'reference', flag: '--reference', type: 'path', pathKind: 'input-file', required: true },
      { name: 'render', flag: '--render', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'overlay', flag: '--overlay', type: 'path', pathKind: 'output-file' },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      {
        name: 'reference_mode',
        flag: '--reference-mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
      {
        name: 'render_mode',
        flag: '--render-mode',
        type: 'string',
        choices: ['auto', 'alpha', 'edges', 'bright_on_dark', 'dark_on_bright'],
      },
    ],
  },
  {
    name: 'silhouette-validator',
    module: 'reference-to-3d',
    description: '比较参考图与渲染图的轮廓：overlap、bbox、像素误差。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-to-3d/scripts/silhouette_validator.py',
    arguments: [
      { name: 'reference', flag: '--reference', type: 'path', pathKind: 'input-file', required: true },
      { name: 'render', flag: '--render', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      { name: 'threshold', flag: '--threshold', type: 'integer' },
    ],
  },
  {
    name: 'template-analyzer',
    module: 'reference-to-3d',
    description:
      '从参考图提取模板掩码与排序后的连通域，保留细长线特征。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'reference-to-3d/scripts/template_analyzer.py',
    arguments: [
      { name: 'image', flag: '--image', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out', flag: '--out', type: 'path', pathKind: 'output-file', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'bright_on_dark', 'dark_on_bright', 'edges'],
      },
      { name: 'min_area_frac', flag: '--min-area-frac', type: 'number' },
      { name: 'min_score_frac', flag: '--min-score-frac', type: 'number' },
      { name: 'canny1', flag: '--canny1', type: 'integer' },
      { name: 'canny2', flag: '--canny2', type: 'integer' },
      { name: 'dilate', flag: '--dilate', type: 'integer' },
      { name: 'mask_out', flag: '--mask-out', type: 'path', pathKind: 'output-file' },
    ],
  },
  {
    name: 'segment-source-parts',
    module: 'source-part-segmentation',
    description:
      '分割参考图中的视觉部件，输出掩码与清单（可选 watershed）。',
    runtime: 'python',
    dependencies: ['opencv-python-headless', 'numpy'],
    script: 'source-part-segmentation/scripts/segment_source_parts.py',
    arguments: [
      { name: 'image', flag: '--image', type: 'path', pathKind: 'input-file', required: true },
      { name: 'out_dir', flag: '--out-dir', type: 'path', pathKind: 'output-dir', required: true },
      {
        name: 'mode',
        flag: '--mode',
        type: 'string',
        choices: ['auto', 'alpha', 'dark_lines', 'bright_on_dark'],
      },
      { name: 'min_area', flag: '--min-area', type: 'integer' },
      { name: 'watershed', flag: '--watershed', type: 'boolean' },
    ],
  },
];

const HELPER_BY_NAME = new Map(HELPERS.map((helper) => [helper.name, helper]));

function getHelper(name) {
  return HELPER_BY_NAME.get(String(name || ''));
}

function listHelpers(options = {}) {
  const { module, includeUnavailable = false, isAvailable } = options;
  return HELPERS.filter((helper) => !module || helper.module === module).filter(
    (helper) => includeUnavailable || !isAvailable || isAvailable(helper),
  );
}

module.exports = { HELPERS, HELPER_BY_NAME, getHelper, listHelpers };
