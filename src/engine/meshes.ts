import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  COLOR_ORDER,
  COLOR_PALETTE,
  HOME_STRETCH_COORDS,
  MAIN_TRACK_COORDS,
  STAR_CELL_SET,
  START_TRACK_INDEX,
  YARD_COORDS,
  gridToWorldXZ,
} from '../game/boardLayout';
import type { BoardThemeId, DiceSkinId, PlayerColor, TokenSkinId } from '../game/types';
import {
  createContactShadowTexture,
  createDiceFaceTexture,
  createMarbleTextures,
  createStarTileTexture,
  createStartArrowTexture,
  createWoodTextures,
} from './proceduralTextures';

export const BOARD_TOP_Y = 0.42;

export interface BoardThemeSpec {
  frameColor: string;
  frameGrain: string;
  frameRoughness: number;
  frameMetalness: number;
  trimColor: number;
  tileLight: string;
  tileDark: string;
  yardInner: string;
  tableTop: string;
  tableGrain: string;
  useMarble?: boolean;
}

const BOARD_THEMES: Record<BoardThemeId, BoardThemeSpec> = {
  royal_walnut: {
    frameColor: '#4e311d',
    frameGrain: '#2b190c',
    frameRoughness: 0.42,
    frameMetalness: 0.05,
    trimColor: 0xd4a853,
    tileLight: '#f3ead9',
    tileDark: '#e4d6be',
    yardInner: '#faf5ec',
    tableTop: '#241812',
    tableGrain: '#160d09',
  },
  carrara_marble: {
    frameColor: '#ede8df',
    frameGrain: '#b8b1a6',
    frameRoughness: 0.18,
    frameMetalness: 0.04,
    trimColor: 0xe3ba66,
    tileLight: '#f7f5f0',
    tileDark: '#e6e1d8',
    yardInner: '#ffffff',
    tableTop: '#2a2725',
    tableGrain: '#1a1816',
    useMarble: true,
  },
  midnight_obsidian: {
    frameColor: '#191b22',
    frameGrain: '#0b0c10',
    frameRoughness: 0.25,
    frameMetalness: 0.18,
    trimColor: 0xcbd5e1,
    tileLight: '#282d38',
    tileDark: '#1f232c',
    yardInner: '#1c2029',
    tableTop: '#101218',
    tableGrain: '#08090c',
    useMarble: true,
  },
  emerald_club: {
    frameColor: '#3d1b14',
    frameGrain: '#220d08',
    frameRoughness: 0.35,
    frameMetalness: 0.05,
    trimColor: 0xd9ad57,
    tileLight: '#f2ecdf',
    tileDark: '#e0d6c2',
    yardInner: '#f7f3ea',
    tableTop: '#133a27',
    tableGrain: '#0b2417',
  },
};

export interface BuiltBoardScene {
  tableGroup: THREE.Group;
  boardGroup: THREE.Group;
  dispose: () => void;
}

export function buildTableAndBoard(
  themeId: BoardThemeId,
  maxAnisotropy: number,
  castShadows: boolean,
): BuiltBoardScene {
  const theme = BOARD_THEMES[themeId];
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- 1. Gaming Table (Composite 4-part Group) ---
  const tableGroup = new THREE.Group();
  const tableTex = theme.useMarble
    ? createMarbleTextures(theme.tableTop, theme.tableGrain, maxAnisotropy)
    : createWoodTextures(theme.tableTop, theme.tableGrain, maxAnisotropy);
  tableTex.map.repeat.set(3, 3);
  tableTex.bumpMap.repeat.set(3, 3);
  track(tableTex.map);
  track(tableTex.bumpMap);

  const tableMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tableTex.map,
      bumpMap: tableTex.bumpMap,
      bumpScale: 0.018,
      roughness: 0.62,
      metalness: 0.05,
    }),
  );

  const brassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: theme.trimColor,
      metalness: 0.92,
      roughness: 0.22,
      anisotropy: 0.75,
      clearcoat: 0.35,
    }),
  );

  // Table slab (top at y = 0)
  const tableGeo = track(new THREE.CylinderGeometry(16.5, 16.0, 0.7, 32));
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = -0.35;
  tableMesh.receiveShadow = castShadows;
  tableGroup.add(tableMesh);

  // Outer brass inlay rim around table
  const tableRimGeo = track(new THREE.TorusGeometry(16.25, 0.12, 12, 64));
  tableRimGeo.rotateX(Math.PI / 2);
  const tableRim = new THREE.Mesh(tableRimGeo, brassMat);
  tableRim.position.y = -0.02;
  tableGroup.add(tableRim);

  // Center pedestal column beneath table
  const pedestalGeo = track(new THREE.CylinderGeometry(3.8, 5.4, 8, 24));
  const pedestalMat = track(new THREE.MeshStandardMaterial({ color: 0x16120e, roughness: 0.75, metalness: 0.1 }));
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = -4.7;
  tableGroup.add(pedestal);

  // --- 2. Ludo Board Assembly ---
  const boardGroup = new THREE.Group();

  const frameTex = theme.useMarble
    ? createMarbleTextures(theme.frameColor, theme.frameGrain, maxAnisotropy)
    : createWoodTextures(theme.frameColor, theme.frameGrain, maxAnisotropy);
  frameTex.map.repeat.set(2, 2);
  frameTex.bumpMap.repeat.set(2, 2);
  track(frameTex.map);
  track(frameTex.bumpMap);

  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: frameTex.map,
      bumpMap: frameTex.bumpMap,
      bumpScale: 0.015,
      roughness: theme.frameRoughness,
      metalness: theme.frameMetalness,
    }),
  );

  // Contact shadow disc under the board itself
  const contactTex = track(createContactShadowTexture());
  const boardShadowMat = track(
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  const boardShadowGeo = track(new THREE.PlaneGeometry(18.8, 18.8));
  boardShadowGeo.rotateX(-Math.PI / 2);
  const boardShadow = new THREE.Mesh(boardShadowGeo, boardShadowMat);
  boardShadow.position.y = 0.01;
  boardGroup.add(boardShadow);

  // Outer mitered chassis (16.8 x 0.36 x 16.8, bottom at y = 0.02 -> top at y = 0.38)
  const chassisGeo = track(new RoundedBoxGeometry(16.8, 0.36, 16.8, 3, 0.09));
  const chassis = new THREE.Mesh(chassisGeo, frameMat);
  chassis.position.y = 0.2;
  chassis.castShadow = castShadows;
  chassis.receiveShadow = castShadows;
  boardGroup.add(chassis);

  // Metallic inset border ring framing the 15x15 grid
  const trimRingShape = new THREE.Shape();
  trimRingShape.moveTo(-7.76, -7.76);
  trimRingShape.lineTo(7.76, -7.76);
  trimRingShape.lineTo(7.76, 7.76);
  trimRingShape.lineTo(-7.76, 7.76);
  trimRingShape.closePath();

  const innerHole = new THREE.Path();
  innerHole.moveTo(-7.56, -7.56);
  innerHole.lineTo(-7.56, 7.56);
  innerHole.lineTo(7.56, 7.56);
  innerHole.lineTo(7.56, -7.56);
  innerHole.closePath();
  trimRingShape.holes.push(innerHole);

  const trimGeo = track(
    new THREE.ExtrudeGeometry(trimRingShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
    }),
  );
  trimGeo.rotateX(-Math.PI / 2);
  const trimMesh = new THREE.Mesh(trimGeo, brassMat);
  trimMesh.position.y = 0.38;
  boardGroup.add(trimMesh);

  // 4 Corner brass medallion plates
  const cornerGeo = track(new THREE.CylinderGeometry(0.28, 0.32, 0.04, 16));
  for (const sx of [-7.95, 7.95]) {
    for (const sz of [-7.95, 7.95]) {
      const cap = new THREE.Mesh(cornerGeo, brassMat);
      cap.position.set(sx, 0.39, sz);
      boardGroup.add(cap);
    }
  }

  // Board inner bed plate (15.1 x 15.1 at y = 0.36)
  const bedGeo = track(new THREE.BoxGeometry(15.12, 0.04, 15.12));
  const bedMat = track(new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 0.8, metalness: 0.05 }));
  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.position.y = 0.36;
  bedMesh.receiveShadow = castShadows;
  boardGroup.add(bedMesh);

  // --- 3. 52 Track Tiles (Individual beveled tiles at y = 0.40 top surface) ---
  const tileGeo = track(new RoundedBoxGeometry(0.94, 0.05, 0.94, 2, 0.025));
  const lightTileMat = track(
    new THREE.MeshStandardMaterial({ color: theme.tileLight, roughness: 0.32, metalness: 0.02 }),
  );
  const darkTileMat = track(
    new THREE.MeshStandardMaterial({ color: theme.tileDark, roughness: 0.38, metalness: 0.02 }),
  );

  // Prebuild Start Arrow & Star textures
  const startCellToColor = new Map<number, PlayerColor>();
  for (const c of COLOR_ORDER) {
    startCellToColor.set(START_TRACK_INDEX[c], c);
  }
  const startAngles: Record<PlayerColor, number> = {
    red: 0, // pointing right (+X)
    green: Math.PI / 2, // pointing down (+Z)
    yellow: Math.PI, // pointing left (-X)
    blue: -Math.PI / 2, // pointing up (-Z)
  };

  const starTex = track(createStarTileTexture(theme.tileLight, '#d4a853', '#b8862d', maxAnisotropy));
  const starMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: starTex,
      roughness: 0.28,
      metalness: 0.08,
    }),
  );

  const colorTileMaterials: Record<PlayerColor, THREE.MeshStandardMaterial> = {
    red: track(new THREE.MeshStandardMaterial({ color: COLOR_PALETTE.red.hex, roughness: 0.28, metalness: 0.06 })),
    green: track(new THREE.MeshStandardMaterial({ color: COLOR_PALETTE.green.hex, roughness: 0.28, metalness: 0.06 })),
    yellow: track(new THREE.MeshStandardMaterial({ color: COLOR_PALETTE.yellow.hex, roughness: 0.28, metalness: 0.06 })),
    blue: track(new THREE.MeshStandardMaterial({ color: COLOR_PALETTE.blue.hex, roughness: 0.28, metalness: 0.06 })),
  };

  MAIN_TRACK_COORDS.forEach((coord, idx) => {
    const { x, z } = gridToWorldXZ(coord);
    const startColor = startCellToColor.get(idx);
    let mat: THREE.Material;

    if (startColor) {
      const arrowTex = track(
        createStartArrowTexture(COLOR_PALETTE[startColor].primary, '#fff8eb', startAngles[startColor], maxAnisotropy),
      );
      mat = track(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: arrowTex,
          roughness: 0.26,
          metalness: 0.05,
        }),
      );
    } else if (STAR_CELL_SET.has(idx)) {
      mat = starMat;
    } else {
      mat = idx % 2 === 0 ? lightTileMat : darkTileMat;
    }

    const tile = new THREE.Mesh(tileGeo, mat);
    tile.position.set(x, BOARD_TOP_Y - 0.025, z);
    tile.receiveShadow = castShadows;
    boardGroup.add(tile);
  });

  // --- 4. 20 Colored Home Stretch Tiles ---
  for (const color of COLOR_ORDER) {
    const mat = colorTileMaterials[color];
    for (const coord of HOME_STRETCH_COORDS[color]) {
      const { x, z } = gridToWorldXZ(coord);
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(x, BOARD_TOP_Y - 0.025, z);
      tile.receiveShadow = castShadows;
      boardGroup.add(tile);
    }
  }

  // --- 5. Four 6x6 Player Yards ---
  const yardOuterGeo = track(new RoundedBoxGeometry(5.92, 0.06, 5.92, 2, 0.06));
  const yardInnerGeo = track(new RoundedBoxGeometry(4.42, 0.06, 4.42, 2, 0.08));
  const yardInnerMat = track(
    new THREE.MeshStandardMaterial({ color: theme.yardInner, roughness: 0.26, metalness: 0.04 }),
  );
  const socketRingGeo = track(new THREE.TorusGeometry(0.45, 0.05, 12, 28));
  socketRingGeo.rotateX(Math.PI / 2);
  const socketDiscGeo = track(new THREE.CylinderGeometry(0.42, 0.44, 0.03, 24));

  const yardCenters: Record<PlayerColor, { col: number; row: number }> = {
    red: { col: 2.5, row: 2.5 },
    green: { col: 11.5, row: 2.5 },
    yellow: { col: 11.5, row: 11.5 },
    blue: { col: 2.5, row: 11.5 },
  };

  for (const color of COLOR_ORDER) {
    const centerXZ = gridToWorldXZ(yardCenters[color]);

    const outerYard = new THREE.Mesh(yardOuterGeo, colorTileMaterials[color]);
    outerYard.position.set(centerXZ.x, BOARD_TOP_Y - 0.03, centerXZ.z);
    outerYard.receiveShadow = castShadows;
    boardGroup.add(outerYard);

    const innerYard = new THREE.Mesh(yardInnerGeo, yardInnerMat);
    innerYard.position.set(centerXZ.x, BOARD_TOP_Y - 0.005, centerXZ.z);
    innerYard.receiveShadow = castShadows;
    boardGroup.add(innerYard);

    // 4 Token dock sockets inside yard
    for (const sockCoord of YARD_COORDS[color]) {
      const sockXZ = gridToWorldXZ(sockCoord);
      const disc = new THREE.Mesh(socketDiscGeo, colorTileMaterials[color]);
      disc.position.set(sockXZ.x, BOARD_TOP_Y + 0.01, sockXZ.z);
      disc.receiveShadow = castShadows;
      boardGroup.add(disc);

      const ring = new THREE.Mesh(socketRingGeo, brassMat);
      ring.position.set(sockXZ.x, BOARD_TOP_Y + 0.025, sockXZ.z);
      boardGroup.add(ring);
    }
  }

  // --- 6. Central 3x3 Finishing Sanctuary (4 Colored Triangular Wedges + Golden Medallion) ---
  const wedgeConfigs: Array<{ color: PlayerColor; pts: Array<[number, number]> }> = [
    { color: 'red', pts: [[-1.46, -1.46], [0, 0], [-1.46, 1.46]] },
    { color: 'green', pts: [[-1.46, -1.46], [1.46, -1.46], [0, 0]] },
    { color: 'yellow', pts: [[1.46, -1.46], [1.46, 1.46], [0, 0]] },
    { color: 'blue', pts: [[-1.46, 1.46], [0, 0], [1.46, 1.46]] },
  ];

  for (const w of wedgeConfigs) {
    const shape = new THREE.Shape();
    shape.moveTo(w.pts[0][0], -w.pts[0][1]);
    shape.lineTo(w.pts[1][0], -w.pts[1][1]);
    shape.lineTo(w.pts[2][0], -w.pts[2][1]);
    shape.closePath();

    const wedgeGeo = track(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.055,
        bevelEnabled: true,
        bevelSize: 0.015,
        bevelThickness: 0.015,
        bevelSegments: 2,
      }),
    );
    wedgeGeo.rotateX(-Math.PI / 2);
    const wedge = new THREE.Mesh(wedgeGeo, colorTileMaterials[w.color]);
    wedge.position.y = BOARD_TOP_Y - 0.04;
    wedge.receiveShadow = castShadows;
    boardGroup.add(wedge);
  }

  // Central golden victory medallion
  const centerCrownGeo = track(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 24));
  const centerCrown = new THREE.Mesh(centerCrownGeo, brassMat);
  centerCrown.position.y = BOARD_TOP_Y + 0.02;
  centerCrown.castShadow = castShadows;
  boardGroup.add(centerCrown);

  const crownRingGeo = track(new THREE.TorusGeometry(0.32, 0.035, 10, 24));
  crownRingGeo.rotateX(Math.PI / 2);
  const crownRing = new THREE.Mesh(crownRingGeo, brassMat);
  crownRing.position.y = BOARD_TOP_Y + 0.065;
  boardGroup.add(crownRing);

  return {
    tableGroup,
    boardGroup,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export interface TokenVisual {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  seatIndex: number;
  tokenIndex: number;
  color: PlayerColor;
  dispose: () => void;
}

export function buildTokenPawn(
  seatIndex: number,
  tokenIndex: number,
  color: PlayerColor,
  skin: TokenSkinId,
  contactTex: THREE.CanvasTexture,
  castShadows: boolean,
): TokenVisual {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const palette = COLOR_PALETTE[color];
  const group = new THREE.Group();
  group.userData = { seatIndex, tokenIndex, color };

  // Material calibration per skin (vary roughness >= 0.25 between body & collar)
  const bodyProps: THREE.MeshPhysicalMaterialParameters =
    skin === 'brushed_gold'
      ? { color: palette.hex, metalness: 0.72, roughness: 0.22, clearcoat: 0.85, clearcoatRoughness: 0.1 }
      : skin === 'frosted_jewel'
        ? { color: palette.hex, metalness: 0.15, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0.4 }
        : skin === 'ebony_crown'
          ? { color: palette.dark, metalness: 0.25, roughness: 0.42, clearcoat: 0.5 }
          : { color: palette.hex, metalness: 0.08, roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.08 };

  const bodyMat = track(new THREE.MeshPhysicalMaterial(bodyProps));
  const collarMat = track(
    new THREE.MeshPhysicalMaterial({
      color: skin === 'ebony_crown' ? 0xe2e8f0 : 0xf1d07a,
      metalness: 0.94,
      roughness: 0.22,
      anisotropy: 0.8,
    }),
  );
  const gemMat = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.light,
      emissive: palette.dark,
      emissiveIntensity: 0.28,
      metalness: 0.2,
      roughness: 0.1,
      clearcoat: 1.0,
    }),
  );

  // 1. Contact shadow disc at bottom (y = 0.015)
  const shadowGeo = track(new THREE.CircleGeometry(0.42, 24));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.012;
  group.add(shadowDisc);

  // 2. Lathe-turned luxury pawn silhouette (bottom at y = 0)
  const lathePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.36, 0.08),
    new THREE.Vector2(0.3, 0.14),
    new THREE.Vector2(0.26, 0.22),
    new THREE.Vector2(0.15, 0.48),
    new THREE.Vector2(0.12, 0.66),
    new THREE.Vector2(0.21, 0.72),
    new THREE.Vector2(0.25, 0.86),
    new THREE.Vector2(0.18, 0.98),
    new THREE.Vector2(0.0, 1.03),
  ];
  const bodyGeo = track(new THREE.LatheGeometry(lathePts, 24));
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = castShadows;
  bodyMesh.receiveShadow = castShadows;
  group.add(bodyMesh);

  // 3. Stepped metallic collar ring
  const collarGeo = track(new THREE.TorusGeometry(0.21, 0.036, 10, 24));
  collarGeo.rotateX(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.y = 0.67;
  collarMesh.castShadow = castShadows;
  group.add(collarMesh);

  // 4. Faceted crown jewel cap
  const crownGeo = track(new THREE.OctahedronGeometry(0.12, 0));
  const crownMesh = new THREE.Mesh(crownGeo, gemMat);
  crownMesh.position.y = 1.07;
  crownMesh.castShadow = castShadows;
  group.add(crownMesh);

  // 5. Selectable glow halo ring at base
  const haloGeo = track(new THREE.RingGeometry(0.38, 0.5, 32));
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.024;
  haloMesh.visible = false;
  group.add(haloMesh);

  // 6. Invisible cylinder hit proxy for snappy touch/mouse raycasting
  const hitGeo = track(new THREE.CylinderGeometry(0.45, 0.45, 1.25, 12));
  const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.position.y = 0.62;
  hitProxy.userData = { kind: 'token', seatIndex, tokenIndex, color };
  group.add(hitProxy);

  return {
    group,
    hitProxy,
    haloMesh,
    haloMat,
    seatIndex,
    tokenIndex,
    color,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export interface BuiltDice {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  dispose: () => void;
}

/**
 * Exact orientation Euler angles that place face `n` (1..6) pointing straight up (+Y).
 */
export const DICE_FACE_ROTATIONS: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
};

export function buildDice(
  skin: DiceSkinId,
  contactTex: THREE.CanvasTexture,
  maxAnisotropy: number,
  castShadows: boolean,
): BuiltDice {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const group = new THREE.Group();

  const bodyColors: Record<DiceSkinId, { color: number; roughness: number; metalness: number }> = {
    ivory_classic: { color: 0xf4ede0, roughness: 0.24, metalness: 0.04 },
    obsidian_gold: { color: 0x17171c, roughness: 0.22, metalness: 0.15 },
    ruby_crystal: { color: 0x8a121b, roughness: 0.14, metalness: 0.1 },
    brushed_titanium: { color: 0x94a3b8, roughness: 0.28, metalness: 0.85 },
  };
  const bodyCfg = bodyColors[skin];

  const bodyGeo = track(new RoundedBoxGeometry(1.16, 1.16, 1.16, 4, 0.15));
  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({
      color: bodyCfg.color,
      roughness: bodyCfg.roughness,
      metalness: bodyCfg.metalness,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    }),
  );
  const coreMesh = new THREE.Mesh(bodyGeo, bodyMat);
  coreMesh.castShadow = castShadows;
  coreMesh.receiveShadow = castShadows;
  group.add(coreMesh);

  // 6 flush face plates matching DICE_FACE_ROTATIONS
  const faceConfigs: Array<{ val: 1 | 2 | 3 | 4 | 5 | 6; pos: [number, number, number]; rot: [number, number, number] }> = [
    { val: 1, pos: [0, 0.583, 0], rot: [-Math.PI / 2, 0, 0] }, // +Y
    { val: 6, pos: [0, -0.583, 0], rot: [Math.PI / 2, 0, 0] }, // -Y
    { val: 2, pos: [0, 0, 0.583], rot: [0, 0, 0] }, // +Z
    { val: 5, pos: [0, 0, -0.583], rot: [0, Math.PI, 0] }, // -Z
    { val: 3, pos: [0.583, 0, 0], rot: [0, Math.PI / 2, 0] }, // +X
    { val: 4, pos: [-0.583, 0, 0], rot: [0, -Math.PI / 2, 0] }, // -X
  ];

  const plateGeo = track(new THREE.PlaneGeometry(0.92, 0.92));
  for (const f of faceConfigs) {
    const tex = createDiceFaceTexture(f.val, skin, maxAnisotropy);
    track(tex.map);
    track(tex.bumpMap);
    const faceMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bumpMap,
        bumpScale: 0.03,
        roughness: bodyCfg.roughness,
        metalness: bodyCfg.metalness * 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const plate = new THREE.Mesh(plateGeo, faceMat);
    plate.position.set(f.pos[0], f.pos[1], f.pos[2]);
    plate.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
    group.add(plate);
  }

  // Click hit proxy
  const hitGeo = track(new THREE.BoxGeometry(1.45, 1.45, 1.45));
  const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.userData = { kind: 'dice' };
  group.add(hitProxy);

  // Separate shadow disc that stays on the board under the die
  const shadowGeo = track(new THREE.CircleGeometry(0.85, 24));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);

  return {
    group,
    hitProxy,
    shadowDisc,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/**
 * Zero-GC pooled 3D confetti & firework burst system using InstancedMesh.
 */
interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  scale: number;
}

export class ConfettiPool {
  public readonly mesh: THREE.InstancedMesh;
  private readonly capacity = 220;
  private readonly slots: ParticleSlot[] = [];
  private cursor = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.Material;
  public activeCount = 0;

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BoxGeometry(0.16, 0.04, 0.24);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.3,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.capacity; i++) {
      this.slots.push({
        active: false,
        life: 0,
        maxLife: 1,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        scale: 0,
      });
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tmpColor.setHex(0xfbbf24));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  public burst(x: number, y: number, z: number, count: number, paletteHexes: number[]): void {
    for (let n = 0; n < count; n++) {
      const slot = this.slots[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.5;
      slot.active = true;
      slot.life = 0;
      slot.maxLife = 1.2 + Math.random() * 1.1;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = 3.5 + Math.random() * 5.2;
      slot.vz = Math.sin(angle) * speed;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.vrx = (Math.random() - 0.5) * 10;
      slot.vry = (Math.random() - 0.5) * 10;
      slot.scale = 0.8 + Math.random() * 0.7;

      const hex = paletteHexes[n % paletteHexes.length];
      this.mesh.setColorAt(this.cursor === 0 ? this.capacity - 1 : this.cursor - 1, this.tmpColor.setHex(hex));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number): boolean {
    let anyActive = false;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.maxLife || s.y < BOARD_TOP_Y) {
        s.active = false;
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      anyActive = true;
      s.vy -= 9.8 * dt;
      s.vx *= 1 - 1.2 * dt;
      s.vz *= 1 - 1.2 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.rx += s.vrx * dt;
      s.ry += s.vry * dt;

      const fade = 1 - s.life / s.maxLife;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.rotation.set(s.rx, s.ry, s.rz);
      this.dummy.scale.setScalar(s.scale * Math.min(1, fade * 2));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.activeCount = anyActive ? 1 : 0;
    if (anyActive) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    return anyActive;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
