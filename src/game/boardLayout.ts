import type { PlayerColor } from './types';

/**
 * 15x15 classic Ludo grid.
 * Grid (col, row) maps to 3D world (x, z) centered at (0, 0):
 *   x = (col - 7) * CELL_SIZE
 *   z = (row - 7) * CELL_SIZE
 */
export const CELL_SIZE = 1.0;
export const BOARD_HALF_SIZE = 7.5;

export interface GridCoord {
  col: number;
  row: number;
}

export const COLOR_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const COLOR_PALETTE: Record<PlayerColor, { primary: string; hex: number; light: string; dark: string; label: string }> = {
  red: { primary: '#d9383a', hex: 0xd9383a, light: '#f47274', dark: '#8c1d1f', label: 'Crimson' },
  green: { primary: '#1e9e5a', hex: 0x1e9e5a, light: '#57d48e', dark: '#106135', label: 'Emerald' },
  yellow: { primary: '#e5a91a', hex: 0xe5a91a, light: '#fcd35d', dark: '#9c6e06', label: 'Sovereign Gold' },
  blue: { primary: '#2672d9', hex: 0x2672d9, light: '#65a4f7', dark: '#134287', label: 'Royal Cobalt' },
};

/**
 * Clockwise 52-cell outer track coordinates (col, row) on 15x15 grid.
 * 0 = Red start (1,6)
 * 13 = Green start (8,1)
 * 26 = Yellow start (13,8)
 * 39 = Blue start (6,13)
 */
export const MAIN_TRACK_COORDS: GridCoord[] = [
  // Red arm top row -> moving right (0..4)
  { col: 1, row: 6 }, // 0: RED START (Safe)
  { col: 2, row: 6 }, // 1
  { col: 3, row: 6 }, // 2
  { col: 4, row: 6 }, // 3
  { col: 5, row: 6 }, // 4
  // Top arm left column -> moving up (5..10)
  { col: 6, row: 5 }, // 5
  { col: 6, row: 4 }, // 6
  { col: 6, row: 3 }, // 7
  { col: 6, row: 2 }, // 8: STAR SAFE
  { col: 6, row: 1 }, // 9
  { col: 6, row: 0 }, // 10
  // Top middle (11)
  { col: 7, row: 0 }, // 11
  // Top arm right column -> moving down (12..17)
  { col: 8, row: 0 }, // 12
  { col: 8, row: 1 }, // 13: GREEN START (Safe)
  { col: 8, row: 2 }, // 14
  { col: 8, row: 3 }, // 15
  { col: 8, row: 4 }, // 16
  { col: 8, row: 5 }, // 17
  // Right arm top row -> moving right (18..23)
  { col: 9, row: 6 }, // 18
  { col: 10, row: 6 }, // 19
  { col: 11, row: 6 }, // 20
  { col: 12, row: 6 }, // 21: STAR SAFE
  { col: 13, row: 6 }, // 22
  { col: 14, row: 6 }, // 23
  // Right middle (24)
  { col: 14, row: 7 }, // 24
  // Right arm bottom row -> moving left (25..30)
  { col: 14, row: 8 }, // 25
  { col: 13, row: 8 }, // 26: YELLOW START (Safe)
  { col: 12, row: 8 }, // 27
  { col: 11, row: 8 }, // 28
  { col: 10, row: 8 }, // 29
  { col: 9, row: 8 }, // 30
  // Bottom arm right column -> moving down (31..36)
  { col: 8, row: 9 }, // 31
  { col: 8, row: 10 }, // 32
  { col: 8, row: 11 }, // 33
  { col: 8, row: 12 }, // 34: STAR SAFE
  { col: 8, row: 13 }, // 35
  { col: 8, row: 14 }, // 36
  // Bottom middle (37)
  { col: 7, row: 14 }, // 37
  // Bottom arm left column -> moving up (38..43)
  { col: 6, row: 14 }, // 38
  { col: 6, row: 13 }, // 39: BLUE START (Safe)
  { col: 6, row: 12 }, // 40
  { col: 6, row: 11 }, // 41
  { col: 6, row: 10 }, // 42
  { col: 6, row: 9 }, // 43
  // Left arm bottom row -> moving left (44..49)
  { col: 5, row: 8 }, // 44
  { col: 4, row: 8 }, // 45
  { col: 3, row: 8 }, // 46
  { col: 2, row: 8 }, // 47: STAR SAFE
  { col: 1, row: 8 }, // 48
  { col: 0, row: 8 }, // 49
  // Left middle (50..51)
  { col: 0, row: 7 }, // 50
  { col: 0, row: 6 }, // 51
];

export const START_TRACK_INDEX: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const START_CELL_SET = new Set<number>([0, 13, 26, 39]);
export const STAR_CELL_SET = new Set<number>([8, 21, 34, 47]);

/**
 * 5-cell colored home stretch (progress 51..55) for each player.
 */
export const HOME_STRETCH_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

/**
 * Finished token resting coordinates inside each player's central finishing triangle (progress = 56).
 */
export const FINISHED_HOME_COORDS: Record<PlayerColor, GridCoord> = {
  red: { col: 6.18, row: 7 },
  green: { col: 7, row: 6.18 },
  yellow: { col: 7.82, row: 7 },
  blue: { col: 7, row: 7.82 },
};

/**
 * 4 yard socket positions per player (progress = -1).
 */
export const YARD_COORDS: Record<PlayerColor, GridCoord[]> = {
  red: [
    { col: 1.55, row: 1.55 },
    { col: 3.45, row: 1.55 },
    { col: 1.55, row: 3.45 },
    { col: 3.45, row: 3.45 },
  ],
  green: [
    { col: 10.55, row: 1.55 },
    { col: 12.45, row: 1.55 },
    { col: 10.55, row: 3.45 },
    { col: 12.45, row: 3.45 },
  ],
  yellow: [
    { col: 10.55, row: 10.55 },
    { col: 12.45, row: 10.55 },
    { col: 10.55, row: 12.45 },
    { col: 12.45, row: 12.45 },
  ],
  blue: [
    { col: 1.55, row: 10.55 },
    { col: 3.45, row: 10.55 },
    { col: 1.55, row: 12.45 },
    { col: 3.45, row: 12.45 },
  ],
};

export function toGlobalTrackIndex(color: PlayerColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (START_TRACK_INDEX[color] + progress) % 52;
}

export function isSafeTrackCell(globalIndex: number, safeStarCells: boolean): boolean {
  if (START_CELL_SET.has(globalIndex)) return true;
  if (safeStarCells && STAR_CELL_SET.has(globalIndex)) return true;
  return false;
}

export function getTokenGridCoord(color: PlayerColor, tokenIndex: number, progress: number): GridCoord {
  if (progress < 0) {
    return YARD_COORDS[color][tokenIndex];
  }
  if (progress <= 50) {
    const globalIdx = (START_TRACK_INDEX[color] + progress) % 52;
    return MAIN_TRACK_COORDS[globalIdx];
  }
  if (progress <= 55) {
    return HOME_STRETCH_COORDS[color][progress - 51];
  }
  return FINISHED_HOME_COORDS[color];
}

export function gridToWorldXZ(coord: GridCoord): { x: number; z: number } {
  return {
    x: (coord.col - 7) * CELL_SIZE,
    z: (coord.row - 7) * CELL_SIZE,
  };
}

/**
 * Generates radial sub-offsets when multiple tokens occupy the same cell so all remain clickable and visible.
 */
export function getClusterOffset(slotIndex: number, totalInCell: number): { dx: number; dz: number; scale: number } {
  if (totalInCell <= 1) return { dx: 0, dz: 0, scale: 1 };
  if (totalInCell === 2) {
    const angle = slotIndex === 0 ? -Math.PI / 4 : (3 * Math.PI) / 4;
    return { dx: Math.cos(angle) * 0.2, dz: Math.sin(angle) * 0.2, scale: 0.86 };
  }
  const angle = (slotIndex / totalInCell) * Math.PI * 2;
  const radius = totalInCell <= 4 ? 0.23 : 0.27;
  return {
    dx: Math.cos(angle) * radius,
    dz: Math.sin(angle) * radius,
    scale: totalInCell <= 4 ? 0.78 : 0.68,
  };
}

/**
 * Returns ordered active seat colors for 2, 3, or 4 players.
 * 2 players sit on opposite corners (Red & Yellow) for classic symmetry.
 */
export function getActiveColorsForCount(count: 2 | 3 | 4): PlayerColor[] {
  if (count === 2) return ['red', 'yellow'];
  if (count === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}
