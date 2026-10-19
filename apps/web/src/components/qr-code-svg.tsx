"use client";

import { useMemo } from "react";

// Standard ISO/IEC 18004 QR Code Generator (Byte mode, Error Correction Level M)
// Pure TypeScript implementation for crisp zero-dependency vector SVG rendering.

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  GF256_EXP[i] = x;
  GF256_EXP[i + 255] = x;
  GF256_LOG[x] = i;
  x = (x << 1) ^ (x & 128 ? 0x11d : 0);
}

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  const logX = GF256_LOG[x] ?? 0;
  const logY = GF256_LOG[y] ?? 0;
  return GF256_EXP[logX + logY] ?? 0;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next: number[] = new Array(poly.length + 1).fill(0);
    const alpha = GF256_EXP[i] ?? 0;
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ gfMul(p, alpha);
      next[j + 1] = (next[j + 1] ?? 0) ^ p;
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const remainder: number[] = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = (data[i] ?? 0) ^ (remainder[0] ?? 0);
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        const r = remainder[j] ?? 0;
        const g = gen[j] ?? 0;
        remainder[j] = r ^ gfMul(g, factor);
      }
    }
  }
  return remainder;
}

interface VersionSpec {
  v: number;
  total: number;
  ec: number;
  blocks: [number, number][];
}

const VERSION_TABLE_M: readonly VersionSpec[] = [
  { v: 1, total: 26, ec: 10, blocks: [[1, 16]] },
  { v: 2, total: 44, ec: 16, blocks: [[1, 28]] },
  { v: 3, total: 70, ec: 26, blocks: [[1, 44]] },
  { v: 4, total: 100, ec: 36, blocks: [[2, 32]] },
  { v: 5, total: 134, ec: 48, blocks: [[2, 43]] },
  { v: 6, total: 172, ec: 64, blocks: [[4, 27]] },
  { v: 7, total: 196, ec: 72, blocks: [[4, 31]] },
  {
    v: 8,
    total: 242,
    ec: 88,
    blocks: [
      [2, 38],
      [2, 39],
    ],
  },
  {
    v: 9,
    total: 292,
    ec: 110,
    blocks: [
      [3, 36],
      [2, 37],
    ],
  },
  {
    v: 10,
    total: 346,
    ec: 130,
    blocks: [
      [4, 43],
      [1, 44],
    ],
  },
];

const ALIGNMENT_PATTERN_POS: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const FORMAT_INFO_M: readonly number[] = [
  0b101010000010010, // Mask 0
  0b101000100100101, // Mask 1
  0b101111001111100, // Mask 2
  0b101101101001011, // Mask 3
  0b100010111011111, // Mask 4
  0b100000011101000, // Mask 5
  0b100111110110001, // Mask 6
  0b100101010000110, // Mask 7
];

export function buildQrMatrix(text: string): { size: number; matrix: number[][] } {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);

  let versionIdx = 0;
  while (versionIdx < VERSION_TABLE_M.length) {
    const info = VERSION_TABLE_M[versionIdx] ??
      VERSION_TABLE_M[0] ?? { v: 1, total: 26, ec: 10, blocks: [[1, 16]] };
    const totalData = info.blocks.reduce((sum, [cnt, data]) => sum + cnt * data, 0);
    const headerBytes = info.v < 10 ? 2 : 3;
    if (textBytes.length + headerBytes <= totalData) {
      break;
    }
    versionIdx++;
  }
  if (versionIdx >= VERSION_TABLE_M.length) {
    versionIdx = VERSION_TABLE_M.length - 1;
  }

  const vInfo = VERSION_TABLE_M[versionIdx] ??
    VERSION_TABLE_M[0] ?? { v: 1, total: 26, ec: 10, blocks: [[1, 16]] };
  const version = vInfo.v;
  const totalDataBytes = vInfo.blocks.reduce((sum, [cnt, data]) => sum + cnt * data, 0);

  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(textBytes.length, version < 10 ? 8 : 16);
  for (let i = 0; i < textBytes.length; i++) {
    pushBits(textBytes[i] ?? 0, 8);
  }
  const maxBits = totalDataBytes * 8;
  const termLen = Math.min(4, Math.max(0, maxBits - bits.length));
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ?? 0);
    bytes.push(b);
  }
  const padBytes = [0xec, 0x11] as const;
  let padIdx = 0;
  while (bytes.length < totalDataBytes) {
    bytes.push(padBytes[padIdx % 2] ?? 0xec);
    padIdx++;
  }

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let byteOffset = 0;
  const totalBlockCount = vInfo.blocks.reduce((s, [c]) => s + c, 0);
  const ecPerBlock = Math.floor(vInfo.ec / totalBlockCount);

  for (const [count, dataLen] of vInfo.blocks) {
    for (let b = 0; b < count; b++) {
      const blockData = bytes.slice(byteOffset, byteOffset + dataLen);
      byteOffset += dataLen;
      dataBlocks.push(blockData);
      ecBlocks.push(rsEncode(blockData, ecPerBlock));
    }
  }

  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((d) => d.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of dataBlocks) {
      if (i < b.length) {
        finalCodewords.push(b[i] ?? 0);
      }
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const b of ecBlocks) {
      finalCodewords.push(b[i] ?? 0);
    }
  }

  const size = version * 4 + 17;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(r: number, c: number, isDark: boolean) {
    if (matrix[r] && isFunction[r]) {
      matrix[r][c] = isDark ? 1 : -1;
      isFunction[r][c] = true;
    }
  }

  function addFinder(topRow: number, leftCol: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topRow + r;
        const col = leftCol + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          if (isBorder) {
            setModule(row, col, false);
          } else {
            const isDark =
              r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setModule(row, col, isDark);
          }
        }
      }
    }
  }

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6]?.[i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i]?.[6]) setModule(i, 6, i % 2 === 0);
  }

  const alignPos = ALIGNMENT_PATTERN_POS[version] ?? [];
  for (let r = 0; r < alignPos.length; r++) {
    for (let c = 0; c < alignPos.length; c++) {
      const row = alignPos[r];
      const col = alignPos[c];
      if (row === undefined || col === undefined) continue;
      if ((row < 9 && col < 9) || (row < 9 && col >= size - 9) || (row >= size - 9 && col < 9)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setModule(row + dr, col + dc, isDark);
        }
      }
    }
  }

  setModule(size - 8, 8, true); // Dark module

  for (let i = 0; i < 9; i++) {
    const f8 = isFunction[8];
    const fi = isFunction[i];
    if (f8 && !f8[i]) f8[i] = true;
    if (fi && !fi[8]) fi[8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    const f8 = isFunction[8];
    const fi = isFunction[i];
    if (f8 && !f8[i]) f8[i] = true;
    if (fi && !fi[8]) fi[8] = true;
  }

  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((cw >> i) & 1);
    }
  }

  let bitIdx = 0;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const upward = ((size - 1 - right) / 2) % 2 === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const c = right - colOffset;
        if (!isFunction[r]?.[c] && matrix[r]) {
          const bit = bitIdx < finalBits.length ? (finalBits[bitIdx++] ?? 0) : 0;
          matrix[r][c] = bit ? 1 : -1;
        }
      }
    }
  }

  const mask = 0;
  for (let r = 0; r < size; r++) {
    const row = matrix[r];
    const funcRow = isFunction[r];
    if (!row || !funcRow) continue;
    for (let c = 0; c < size; c++) {
      if (!funcRow[c]) {
        if ((r + c) % 2 === 0) {
          row[c] = row[c] === 1 ? -1 : 1;
        }
      }
    }
  }

  const formatInfo = FORMAT_INFO_M[mask] ?? 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = (formatInfo >> (14 - i)) & 1;
    let r1: number;
    let c1: number;
    if (i < 6) {
      r1 = 8;
      c1 = i;
    } else if (i === 6) {
      r1 = 8;
      c1 = 7;
    } else if (i === 7) {
      r1 = 8;
      c1 = 8;
    } else if (i === 8) {
      r1 = 7;
      c1 = 8;
    } else {
      r1 = 14 - i;
      c1 = 8;
    }
    const row1 = matrix[r1];
    if (row1) row1[c1] = bit ? 1 : -1;

    let r2: number;
    let c2: number;
    if (i < 8) {
      r2 = size - 1 - i;
      c2 = 8;
    } else {
      r2 = 8;
      c2 = size - 8 + (i - 8);
    }
    const row2 = matrix[r2];
    if (row2) row2[c2] = bit ? 1 : -1;
  }

  return { size, matrix };
}

interface QrCodeSvgProps {
  value: string;
  size?: number;
  quietZone?: number;
  fgColor?: string;
  bgColor?: string;
  ariaLabel?: string;
  title?: string;
}

export function QrCodeSvg({
  value,
  size = 200,
  quietZone = 4,
  fgColor = "#0f172a",
  bgColor = "#ffffff",
  ariaLabel = "QR Code",
  title,
}: QrCodeSvgProps) {
  const { viewBox, path } = useMemo(() => {
    if (!value) {
      return { viewBox: "0 0 100 100", path: "" };
    }
    const { size: qrSize, matrix } = buildQrMatrix(value);
    const totalDim = qrSize + quietZone * 2;
    let pathD = "";

    for (let r = 0; r < qrSize; r++) {
      const row = matrix[r];
      if (!row) continue;
      for (let c = 0; c < qrSize; c++) {
        if (row[c] === 1) {
          const x = c + quietZone;
          const y = r + quietZone;
          pathD += `M${x},${y}h1v1h-1z `;
        }
      }
    }

    return {
      viewBox: `0 0 ${totalDim} ${totalDim}`,
      path: pathD,
    };
  }, [value, quietZone]);

  if (!value) return null;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={viewBox}
      width={size}
      height={size}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        background: bgColor,
      }}
    >
      {title && <title>{title}</title>}
      <rect width="100%" height="100%" fill={bgColor} />
      <path d={path} fill={fgColor} shapeRendering="crispEdges" />
    </svg>
  );
}
