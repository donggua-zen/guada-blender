'use strict';

/**
 * 帧号表达式解析："1,3,5-7" → [1,3,5,6,7]
 *
 * 规则：
 * - 支持单帧、闭区间、混排；
 * - 区间反向（10-1）自动归一；
 * - 去重、升序；
 * - 单次最多 120 帧；帧号范围 1..1,000,000。
 */

const MAX_FRAMES = 120;
const MAX_FRAME_NUMBER = 1_000_000;

function parseFrames(input) {
  const text = String(input === undefined || input === null ? '' : input).trim();
  if (!text) throw new Error('frames is required, e.g. "1,3,5-7"');

  const frames = new Set();
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;

    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      let start = Number(range[1]);
      let end = Number(range[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`invalid frame range: ${part}`);
      }
      if (end < start) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      if (start < 1 || end > MAX_FRAME_NUMBER) {
        throw new Error(`frame range out of bounds (1..${MAX_FRAME_NUMBER}): ${part}`);
      }
      for (let i = start; i <= end; i++) {
        frames.add(i);
        if (frames.size > MAX_FRAMES) {
          throw new Error(`too many frames: max ${MAX_FRAMES} per call`);
        }
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new Error(`invalid frame token: ${part}`);
    }
    const frame = Number(part);
    if (frame < 1 || frame > MAX_FRAME_NUMBER) {
      throw new Error(`frame out of bounds (1..${MAX_FRAME_NUMBER}): ${part}`);
    }
    frames.add(frame);
    if (frames.size > MAX_FRAMES) {
      throw new Error(`too many frames: max ${MAX_FRAMES} per call`);
    }
  }

  if (frames.size === 0) throw new Error('no frames parsed');
  return Array.from(frames).sort((a, b) => a - b);
}

module.exports = { parseFrames, MAX_FRAMES, MAX_FRAME_NUMBER };
