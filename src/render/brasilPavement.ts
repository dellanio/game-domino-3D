import * as THREE from 'three';

/** One seamless 16m square: small hand-laid stones inside broad wave bands. */
export function brasilPavement(): { map: THREE.DataTexture; bumpMap: THREE.DataTexture } {
  const size = 1024, cells = 64, cell = size / cells;
  const color = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(color.length);
  const hash = (x: number, y: number) => {
    let h = Math.imul((x + cells) % cells + 37, 374761393) ^ Math.imul((y + cells) % cells + 71, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
  };
  const centers = new Map<number, [number, number]>();
  for (let cy = -1; cy <= cells; cy++) for (let cx = -1; cx <= cells; cx++) {
    centers.set((cy + 1) * (cells + 2) + cx + 1, [
      (cx + 0.5 + ((cy + cells) % 2) * 0.5 + (hash(cx, cy) - 0.5) * 0.4) * cell,
      (cy + 0.5 + (hash(cx + 17, cy + 9) - 0.5) * 0.4) * cell,
    ]);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / cell);
    const columnGuess = Math.floor(x / cell);
    let nearest = Infinity, next = Infinity, column = 0, stoneRow = 0, centerX = 0, centerY = 0;
    // Jittered, staggered Voronoi cells make irregular small stones, not bricks.
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cy = row + dy, cx = columnGuess + dx;
      const [px, py] = centers.get((cy + 1) * (cells + 2) + cx + 1)!;
      const distance = (x - px) ** 2 + (y - py) ** 2;
      if (distance < nearest) {
        next = nearest; nearest = distance;
        column = cx; stoneRow = cy; centerX = px / size; centerY = py / size;
      } else if (distance < next) next = distance;
    }
    const stone = hash(column, stoneRow);
    const edge = (Math.sqrt(next) - Math.sqrt(nearest)) * 0.5;
    const grain = hash(x, y) - 0.5;
    const joint = edge < 0.65 + grain * 0.35;
    // Classify whole stones, so the wave boundary follows their edges.
    const phase = centerX * 2 + 0.45 * Math.sin(centerY * Math.PI * 2);
    const dark = Math.sin(phase * Math.PI * 2) > 0;
    const wear = stone * 15 + grain * 9;
    const base = joint ? 107 + grain * 7 : (dark ? 31 : 213) + wear;
    const i = (y * size + x) * 4;
    color.set([base + (dark || joint ? 0 : 8), base + (dark || joint ? 0 : 4), base, 255], i);
    // Equal stone heights for both colors; color contrast is not a trench.
    const height = joint ? 66 : 180 + stone * 12 + grain * 14 - (edge < 1.7 ? 22 : 0);
    relief.set([height, height, height, 255], i);
  }
  const texture = (data: Uint8Array, colorSpace: THREE.ColorSpace) => {
    const result = new THREE.DataTexture(data, size, size);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(12.5, 12.5); // 200m floor / 16m tile; stones are 25cm.
    result.colorSpace = colorSpace;
    result.magFilter = THREE.LinearFilter;
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true;
    result.anisotropy = 8;
    result.needsUpdate = true;
    return result;
  };
  return { map: texture(color, THREE.SRGBColorSpace), bumpMap: texture(relief, THREE.NoColorSpace) };
}
