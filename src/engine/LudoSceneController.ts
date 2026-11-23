import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  COLOR_PALETTE,
  getClusterOffset,
  getTokenGridCoord,
  gridToWorldXZ,
  type GridCoord,
} from '../game/boardLayout';
import type {
  BoardThemeId,
  CameraMode,
  DiceSkinId,
  GraphicsPreset,
  MatchState,
  PlayerColor,
  TokenSkinId,
} from '../game/types';
import { AudioManager } from './audioManager';
import {
  BOARD_TOP_Y,
  ConfettiPool,
  DICE_FACE_ROTATIONS,
  buildDice,
  buildTableAndBoard,
  buildTokenPawn,
  type BuiltBoardScene,
  type BuiltDice,
  type TokenVisual,
} from './meshes';
import { createContactShadowTexture } from './proceduralTextures';

interface TokenAnimation {
  seatIndex: number;
  tokenIndex: number;
  waypoints: Array<{ x: number; z: number }>;
  stepIndex: number;
  stepElapsed: number;
  stepDuration: number;
  startX: number;
  startZ: number;
  captures: Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }>;
  isFinish: boolean;
  onComplete: () => void;
}

interface CaptureReturnAnim {
  seatIndex: number;
  tokenIndex: number;
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  elapsed: number;
  duration: number;
}

interface DiceAnimation {
  elapsed: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  targetValue: number;
  onComplete: () => void;
}

export interface SceneCallbacks {
  onDiceClicked: () => void;
  onTokenClicked: (seatIndex: number, tokenIndex: number) => void;
  onCameraUserInteracted: () => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class LudoSceneController {
  private readonly container: HTMLElement;
  private readonly audio: AudioManager;
  private readonly callbacks: SceneCallbacks;
  public readonly isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private keyLight: THREE.DirectionalLight;
  private contactTex: THREE.CanvasTexture;
  private confetti: ConfettiPool;

  private boardScene: BuiltBoardScene | null = null;
  private diceObj: BuiltDice | null = null;
  private tokens: Map<string, TokenVisual> = new Map();
  private interactables: THREE.Object3D[] = [];

  private currentBoardTheme: BoardThemeId = 'royal_walnut';
  private currentDiceSkin: DiceSkinId = 'ivory_classic';
  private currentTokenSkin: TokenSkinId = 'polished_ceramic';
  private currentGraphics: GraphicsPreset = 'high';

  private cameraMode: CameraMode = 'cinematic';
  private isTitleScreen = true;
  private titleAngle = 0.55;
  private desiredCamPos = new THREE.Vector3(0, 18.5, 13.5);
  private desiredLookAt = new THREE.Vector3(0, 0.3, 0);
  private cameraTransitionActive = false;

  private diceAnim: DiceAnimation | null = null;
  private tokenAnim: TokenAnimation | null = null;
  private captureAnims: CaptureReturnAnim[] = [];
  private legalTokenKeys = new Set<string>();
  private diceClickable = false;

  private trauma = 0;
  private lastTickMs = 0;
  private elapsedSec = 0;
  private frameId = 0;
  private isLoopRunning = false;
  private renderBusy = false;
  private renderDirty = false;
  private disposed = false;

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver;

  private lastMatchState: MatchState | null = null;

  constructor(
    container: HTMLElement,
    audio: AudioManager,
    callbacks: SceneCallbacks,
    initialCosmetics: {
      board: BoardThemeId;
      dice: DiceSkinId;
      token: TokenSkinId;
      graphics: GraphicsPreset;
    },
  ) {
    this.container = container;
    this.audio = audio;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();
    this.currentBoardTheme = initialCosmetics.board;
    this.currentDiceSkin = initialCosmetics.dice;
    this.currentTokenSkin = initialCosmetics.token;
    this.currentGraphics = initialCosmetics.graphics;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setSize(width, height);
    this.applyGraphicsPreset(this.currentGraphics);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x110e0b);
    this.scene.fog = new THREE.FogExp2(0x110e0b, 0.0065);

    // Procedural Studio IBL (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 140);
    this.camera.position.set(10, 17, 15);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8.5;
    this.controls.maxDistance = 70;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minPolarAngle = 0.08;
    this.controls.target.set(0, 0.3, 0);
    this.controls.addEventListener('start', () => {
      this.cameraTransitionActive = false;
      if (!this.isTitleScreen && this.cameraMode !== 'free') {
        this.cameraMode = 'free';
        this.callbacks.onCameraUserInteracted();
      }
      this.requestRender();
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    // 3-Point Warm/Cool Studio Lighting
    const hemi = new THREE.HemisphereLight(0xc7dcff, 0x2d1f14, 0.9);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.15);
    this.keyLight.position.set(9, 19, 10);
    this.keyLight.castShadow = !this.isSoftwareGl && this.currentGraphics !== 'low';
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 4;
    this.keyLight.shadow.camera.far = 42;
    this.keyLight.shadow.camera.left = -11;
    this.keyLight.shadow.camera.right = 11;
    this.keyLight.shadow.camera.top = 11;
    this.keyLight.shadow.camera.bottom = -11;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    rimLight.position.set(-12, 10, -11);
    this.scene.add(rimLight);

    this.contactTex = createContactShadowTexture();
    this.confetti = new ConfettiPool(this.scene);

    this.rebuildBoard(this.currentBoardTheme);
    this.rebuildDice(this.currentDiceSkin);

    // Pre-warm shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();

    this.updateCameraPreset('cinematic', true);
    this.requestRender();
  }

  public applyGraphicsPreset(preset: GraphicsPreset): void {
    this.currentGraphics = preset;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const pixelCap = preset === 'low' ? 1 : preset === 'medium' ? 1.25 : preset === 'high' ? 1.75 : 2;
    this.renderer.setPixelRatio(Math.min(dpr, pixelCap));

    const shadows = preset !== 'low';
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.keyLight) {
      this.keyLight.castShadow = shadows;
      const mapSize = preset === 'ultra' ? 2048 : 1024;
      if (this.keyLight.shadow.mapSize.width !== mapSize) {
        this.keyLight.shadow.mapSize.set(mapSize, mapSize);
        this.keyLight.shadow.map?.dispose();
        this.keyLight.shadow.map = null;
      }
    }
    this.requestRender();
  }

  public setCosmetics(board: BoardThemeId, dice: DiceSkinId, token: TokenSkinId): void {
    if (board !== this.currentBoardTheme) {
      this.currentBoardTheme = board;
      this.rebuildBoard(board);
    }
    if (dice !== this.currentDiceSkin) {
      this.currentDiceSkin = dice;
      this.rebuildDice(dice);
    }
    if (token !== this.currentTokenSkin) {
      this.currentTokenSkin = token;
      if (this.lastMatchState) {
        this.syncMatchState(this.lastMatchState, true);
      }
    }
    this.requestRender();
  }

  private rebuildBoard(themeId: BoardThemeId): void {
    if (this.boardScene) {
      this.scene.remove(this.boardScene.tableGroup);
      this.scene.remove(this.boardScene.boardGroup);
      this.boardScene.dispose();
    }
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const castShadows = !this.isSoftwareGl && this.currentGraphics !== 'low';
    this.boardScene = buildTableAndBoard(themeId, maxAniso, castShadows);
    this.scene.add(this.boardScene.tableGroup);
    this.scene.add(this.boardScene.boardGroup);
  }

  private rebuildDice(skinId: DiceSkinId): void {
    const prevPos = this.diceObj ? this.diceObj.group.position.clone() : new THREE.Vector3(0, BOARD_TOP_Y + 0.58, 0);
    const prevQuat = this.diceObj ? this.diceObj.group.quaternion.clone() : new THREE.Quaternion();
    if (this.diceObj) {
      this.scene.remove(this.diceObj.group);
      this.scene.remove(this.diceObj.shadowDisc);
      this.diceObj.dispose();
    }
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const castShadows = !this.isSoftwareGl && this.currentGraphics !== 'low';
    this.diceObj = buildDice(skinId, this.contactTex, maxAniso, castShadows);
    this.diceObj.group.position.copy(prevPos);
    this.diceObj.group.quaternion.copy(prevQuat);
    this.diceObj.shadowDisc.position.set(prevPos.x, BOARD_TOP_Y + 0.022, prevPos.z);
    this.scene.add(this.diceObj.group);
    this.scene.add(this.diceObj.shadowDisc);
    this.rebuildInteractables();
  }

  private rebuildInteractables(): void {
    this.interactables = [];
    if (this.diceObj) {
      this.interactables.push(this.diceObj.hitProxy);
    }
    for (const tv of this.tokens.values()) {
      this.interactables.push(tv.hitProxy);
    }
  }

  public setTitleMode(isTitle: boolean): void {
    this.isTitleScreen = isTitle;
    if (isTitle) {
      this.controls.enabled = false;
      this.legalTokenKeys.clear();
      this.diceClickable = false;
      this.ensureShowcaseTokens();
      this.ensureLoop();
    } else {
      this.controls.enabled = true;
      this.updateCameraPreset(this.cameraMode === 'free' ? 'cinematic' : this.cameraMode, false);
    }
    this.requestRender();
  }

  private ensureShowcaseTokens(): void {
    if (this.tokens.size > 0) return;
    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    const castShadows = !this.isSoftwareGl && this.currentGraphics !== 'low';
    colors.forEach((color, seatIndex) => {
      for (let t = 0; t < 4; t++) {
        const key = `${seatIndex}-${t}`;
        const tv = buildTokenPawn(seatIndex, t, color, this.currentTokenSkin, this.contactTex, castShadows);
        const progress = t === 0 ? 4 + seatIndex * 3 : -1;
        const coord = getTokenGridCoord(color, t, progress);
        const xz = gridToWorldXZ(coord);
        tv.group.position.set(xz.x, BOARD_TOP_Y + 0.015, xz.z);
        this.scene.add(tv.group);
        this.tokens.set(key, tv);
      }
    });
    this.rebuildInteractables();
  }

  public syncMatchState(state: MatchState, forceRebuildTokens = false): void {
    this.lastMatchState = state;
    const castShadows = !this.isSoftwareGl && this.currentGraphics !== 'low';

    // Determine if we need to rebuild token pawns (e.g., player count or skin changed)
    const expectedCount = state.players.length * 4;
    if (forceRebuildTokens || this.tokens.size !== expectedCount) {
      for (const tv of this.tokens.values()) {
        this.scene.remove(tv.group);
        tv.dispose();
      }
      this.tokens.clear();

      for (const player of state.players) {
        for (const tok of player.tokens) {
          const key = `${player.seatIndex}-${tok.index}`;
          const tv = buildTokenPawn(
            player.seatIndex,
            tok.index,
            player.color,
            this.currentTokenSkin,
            this.contactTex,
            castShadows,
          );
          this.scene.add(tv.group);
          this.tokens.set(key, tv);
        }
      }
      this.rebuildInteractables();
    }

    // Group tokens by logical cell key to apply cluster sub-offsets cleanly
    const cellGroups = new Map<string, Array<{ seatIndex: number; tokenIndex: number; coord: GridCoord }>>();
    for (const player of state.players) {
      for (const tok of player.tokens) {
        const coord = getTokenGridCoord(player.color, tok.index, tok.progress);
        const cellKey = tok.progress < 0 ? `yard-${player.color}-${tok.index}` : `${coord.col.toFixed(2)},${coord.row.toFixed(2)}`;
        const arr = cellGroups.get(cellKey) ?? [];
        arr.push({ seatIndex: player.seatIndex, tokenIndex: tok.index, coord });
        cellGroups.set(cellKey, arr);
      }
    }

    for (const group of cellGroups.values()) {
      group.forEach((item, slotIdx) => {
        const key = `${item.seatIndex}-${item.tokenIndex}`;
        // Skip updating position of currently hopping or returning token
        if (this.tokenAnim && this.tokenAnim.seatIndex === item.seatIndex && this.tokenAnim.tokenIndex === item.tokenIndex) {
          return;
        }
        if (this.captureAnims.some((c) => c.seatIndex === item.seatIndex && c.tokenIndex === item.tokenIndex)) {
          return;
        }
        const tv = this.tokens.get(key);
        if (!tv) return;
        const xz = gridToWorldXZ(item.coord);
        const cluster = getClusterOffset(slotIdx, group.length);
        tv.group.position.set(xz.x + cluster.dx, BOARD_TOP_Y + 0.015, xz.z + cluster.dz);
        tv.group.scale.setScalar(cluster.scale);
      });
    }

    // Highlight legal tokens if local human is selecting
    this.legalTokenKeys.clear();
    const activePlayer = state.players[state.currentTurnSeat];
    const isLocalTurn = activePlayer && activePlayer.kind === 'human';
    this.diceClickable = state.phase === 'waiting_roll' && isLocalTurn;

    if (state.phase === 'selecting_token' && isLocalTurn) {
      for (const m of state.legalMoves) {
        this.legalTokenKeys.add(`${state.currentTurnSeat}-${m.tokenIndex}`);
      }
    }

    for (const [key, tv] of this.tokens.entries()) {
      const selectable = this.legalTokenKeys.has(key);
      tv.haloMesh.visible = selectable;
      if (selectable) {
        tv.haloMat.opacity = 0.9;
      }
    }

    if (this.legalTokenKeys.size > 0 || state.phase === 'finished') {
      this.ensureLoop();
    } else {
      this.requestRender();
    }
  }

  public updateCameraPreset(mode: CameraMode, instant = false): void {
    this.cameraMode = mode;
    if (mode === 'free') return;

    const aspect = Math.max(0.4, this.camera.aspect);
    const portraitScale = aspect < 1 ? Math.max(1.0, 1.15 / aspect) : 1.0;

    if (mode === 'top') {
      this.desiredCamPos.set(0, 23.5 * portraitScale, 0.01);
      this.desiredLookAt.set(0, 0.3, 0);
    } else if (mode === 'cinematic') {
      this.desiredCamPos.set(0, 18.5 * portraitScale, 13.5 * portraitScale);
      this.desiredLookAt.set(0, 0.3, 0.4);
    } else if (mode === 'dice') {
      const dp = this.diceObj ? this.diceObj.group.position : _vec3A.set(0, BOARD_TOP_Y + 0.58, 0);
      this.desiredCamPos.set(dp.x + 3.2 * portraitScale, 6.2 * portraitScale, dp.z + 4.4 * portraitScale);
      this.desiredLookAt.set(dp.x, BOARD_TOP_Y + 0.4, dp.z);
    } else if (mode === 'follow') {
      if (this.tokenAnim) {
        const key = `${this.tokenAnim.seatIndex}-${this.tokenAnim.tokenIndex}`;
        const tv = this.tokens.get(key);
        if (tv) {
          this.desiredCamPos.set(
            tv.group.position.x * 0.65,
            11.5 * portraitScale,
            tv.group.position.z * 0.65 + 9.0 * portraitScale,
          );
          this.desiredLookAt.set(tv.group.position.x, BOARD_TOP_Y + 0.6, tv.group.position.z);
        }
      } else {
        this.desiredCamPos.set(0, 16.5 * portraitScale, 12.0 * portraitScale);
        this.desiredLookAt.set(0, 0.3, 0);
      }
    }

    if (instant) {
      this.camera.position.copy(this.desiredCamPos);
      this.controls.target.copy(this.desiredLookAt);
      this.controls.update();
      this.cameraTransitionActive = false;
      this.requestRender();
    } else {
      this.cameraTransitionActive = true;
      this.ensureLoop();
    }
  }

  public animateDiceRoll(
    targetValue: number,
    rollerColor: PlayerColor,
    onComplete: () => void,
  ): void {
    if (!this.diceObj) {
      onComplete();
      return;
    }

    this.audio.playDiceRoll();

    // Place landing spot slightly offset toward center-table
    const offsets: Record<PlayerColor, [number, number]> = {
      red: [-1.1, -0.8],
      green: [1.1, -0.8],
      yellow: [1.1, 0.8],
      blue: [-1.1, 0.8],
    };
    const [ox, oz] = offsets[rollerColor];

    const startPos = new THREE.Vector3(ox * 2.4, BOARD_TOP_Y + 3.2, oz * 2.4);
    const endPos = new THREE.Vector3(ox * 0.65, BOARD_TOP_Y + 0.58, oz * 0.65);

    const endQuat = new THREE.Quaternion().setFromEuler(DICE_FACE_ROTATIONS[targetValue]);
    // Apply an arbitrary multiples-of-90-deg yaw around Y so it looks natural each roll
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.25,
    );
    endQuat.premultiply(yawQuat);

    this.diceAnim = {
      elapsed: 0,
      duration: 0.72,
      startPos,
      endPos,
      startQuat: this.diceObj.group.quaternion.clone(),
      endQuat,
      spinAxis: new THREE.Vector3(1.4, 0.9, 1.1).normalize(),
      targetValue,
      onComplete,
    };

    if (this.cameraMode === 'dice') {
      this.desiredCamPos.set(endPos.x + 3.0, 6.0, endPos.z + 4.2);
      this.desiredLookAt.set(endPos.x, BOARD_TOP_Y + 0.4, endPos.z);
      this.cameraTransitionActive = true;
    }

    this.ensureLoop();
  }

  public animateTokenMove(
    seatIndex: number,
    tokenIndex: number,
    waypointsGrid: GridCoord[],
    captures: Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }>,
    isFinish: boolean,
    onComplete: () => void,
  ): void {
    const key = `${seatIndex}-${tokenIndex}`;
    const tv = this.tokens.get(key);
    if (!tv || waypointsGrid.length === 0) {
      onComplete();
      return;
    }

    const waypoints = waypointsGrid.map((c) => gridToWorldXZ(c));
    this.tokenAnim = {
      seatIndex,
      tokenIndex,
      waypoints,
      stepIndex: 0,
      stepElapsed: 0,
      stepDuration: waypoints.length === 1 ? 0.26 : 0.14,
      startX: tv.group.position.x,
      startZ: tv.group.position.z,
      captures,
      isFinish,
      onComplete,
    };

    this.audio.playTokenHop(0);
    this.ensureLoop();
  }

  public triggerVictoryCelebration(winnerColor: PlayerColor): void {
    const hex = COLOR_PALETTE[winnerColor].hex;
    this.confetti.burst(0, BOARD_TOP_Y + 1.4, 0, 110, [hex, 0xfbbf24, 0xffffff, 0x38bdf8]);
    this.confetti.burst(-3, BOARD_TOP_Y + 1.0, -3, 55, [hex, 0xf59e0b, 0xfef08a]);
    this.confetti.burst(3, BOARD_TOP_Y + 1.0, 3, 55, [hex, 0xf59e0b, 0xfef08a]);
    this.trauma = 0.55;
    this.audio.playVictory();
    this.ensureLoop();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (!this.isTitleScreen && this.cameraMode !== 'free') {
      this.updateCameraPreset(this.cameraMode, true);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointermove', this.onPointerMove);
  }

  private updatePointerNDC(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.isTitleScreen) return;
    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    let hoverInteractive = false;
    for (const hit of hits) {
      const ud = hit.object.userData;
      if (ud.kind === 'dice' && this.diceClickable) {
        hoverInteractive = true;
        break;
      }
      if (ud.kind === 'token' && this.legalTokenKeys.has(`${ud.seatIndex}-${ud.tokenIndex}`)) {
        hoverInteractive = true;
        break;
      }
    }
    this.renderer.domElement.style.cursor = hoverInteractive ? 'pointer' : 'grab';
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.isTitleScreen) return;
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 100) return; // Dragged to orbit

    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    for (const hit of hits) {
      const ud = hit.object.userData;
      if (ud.kind === 'token' && this.legalTokenKeys.has(`${ud.seatIndex}-${ud.tokenIndex}`)) {
        this.callbacks.onTokenClicked(ud.seatIndex, ud.tokenIndex);
        return;
      }
      if (ud.kind === 'dice' && this.diceClickable) {
        this.callbacks.onDiceClicked();
        return;
      }
    }
  };

  private ensureLoop(): void {
    if (this.isLoopRunning || this.disposed) return;
    this.isLoopRunning = true;
    this.lastTickMs = performance.now();
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed && this.isLoopRunning) {
          this.tick();
        }
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (this.disposed) return;
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(cb, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
        return;
      }
    } catch {
      // Fallback if fenceSync unavailable
    }
    this.frameId = window.setTimeout(cb, 80);
  }

  public requestRender(): void {
    if (this.disposed || this.isLoopRunning) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty) this.requestRender();
      };
      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  private tick(): void {
    if (this.disposed) return;
    const nowMs = performance.now();
    const rawDt = Math.max(0.001, (nowMs - (this.lastTickMs || nowMs)) / 1000);
    this.lastTickMs = nowMs;
    const dt = Math.min(rawDt, 0.05);
    const animDt = this.isSoftwareGl ? Math.min(rawDt, 0.16) : dt;
    this.elapsedSec += animDt;
    const nowSec = this.elapsedSec;
    let keepRunning = false;

    // 1. Title screen turntable showcase
    if (this.isTitleScreen) {
      this.titleAngle += animDt * 0.16;
      const aspect = Math.max(0.4, this.camera.aspect);
      const radius = aspect < 1 ? 26 : 18.5;
      const height = aspect < 1 ? 22 : 13.8;
      this.camera.position.set(
        Math.cos(this.titleAngle) * radius,
        height,
        Math.sin(this.titleAngle) * radius,
      );
      this.camera.lookAt(aspect < 1 ? 0 : -2.2, 0.3, 0);
      keepRunning = true;
    }

    // 2. Smoothly damped camera preset transitions
    if (!this.isTitleScreen && this.cameraTransitionActive) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.desiredCamPos.x, 6.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.desiredCamPos.y, 6.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.desiredCamPos.z, 6.5, dt);
      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.desiredLookAt.x, 7.5, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.desiredLookAt.y, 7.5, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.desiredLookAt.z, 7.5, dt);

      if (
        this.camera.position.distanceTo(this.desiredCamPos) < 0.04 &&
        this.controls.target.distanceTo(this.desiredLookAt) < 0.04
      ) {
        this.cameraTransitionActive = false;
      } else {
        keepRunning = true;
      }
    }

    // 3. Dice Roll Physics Arc
    if (this.diceAnim && this.diceObj) {
      keepRunning = true;
      this.diceAnim.elapsed += animDt;
      const t = Math.min(1, this.diceAnim.elapsed / this.diceAnim.duration);
      const ease = 1 - Math.pow(1 - t, 3);

      _vec3A.lerpVectors(this.diceAnim.startPos, this.diceAnim.endPos, ease);
      // Two bounces
      const bounce = t < 0.62 ? Math.abs(Math.sin((t / 0.62) * Math.PI)) * 2.1 : Math.abs(Math.sin(((t - 0.62) / 0.38) * Math.PI)) * 0.55;
      _vec3A.y = BOARD_TOP_Y + 0.58 + bounce;
      this.diceObj.group.position.copy(_vec3A);
      this.diceObj.shadowDisc.position.set(_vec3A.x, BOARD_TOP_Y + 0.022, _vec3A.z);
      const shadowScale = Math.max(0.55, 1 - bounce * 0.18);
      this.diceObj.shadowDisc.scale.setScalar(shadowScale);

      // Spin fast early, lock cleanly onto endQuat at landing
      if (t < 0.78) {
        const spinAngle = (1 - t / 0.78) * Math.PI * 6;
        _quatA.setFromAxisAngle(this.diceAnim.spinAxis, spinAngle);
        _quatB.copy(this.diceAnim.endQuat).multiply(_quatA);
        this.diceObj.group.quaternion.copy(_quatB);
      } else {
        const settleT = (t - 0.78) / 0.22;
        this.diceObj.group.quaternion.slerpQuaternions(this.diceObj.group.quaternion, this.diceAnim.endQuat, settleT);
      }

      if (t >= 1) {
        this.diceObj.group.position.copy(this.diceAnim.endPos);
        this.diceObj.group.quaternion.copy(this.diceAnim.endQuat);
        this.diceObj.shadowDisc.scale.setScalar(1);
        this.audio.playDiceLand(this.diceAnim.targetValue);
        if (this.diceAnim.targetValue === 6) {
          this.trauma = Math.max(this.trauma, 0.22);
        }
        const cb = this.diceAnim.onComplete;
        this.diceAnim = null;
        cb();
      }
    }

    // 4. Token Step-by-Step Hop Animation
    if (this.tokenAnim) {
      keepRunning = true;
      const anim = this.tokenAnim;
      const key = `${anim.seatIndex}-${anim.tokenIndex}`;
      const tv = this.tokens.get(key);
      if (tv) {
        anim.stepElapsed += animDt;
        const stepT = Math.min(1, anim.stepElapsed / anim.stepDuration);
        const wp = anim.waypoints[anim.stepIndex];
        const x = THREE.MathUtils.lerp(anim.startX, wp.x, stepT);
        const z = THREE.MathUtils.lerp(anim.startZ, wp.z, stepT);
        const arc = Math.sin(stepT * Math.PI) * 0.58;
        tv.group.position.set(x, BOARD_TOP_Y + 0.015 + arc, z);

        // Squash-and-stretch on hop
        const stretch = 1 + Math.sin(stepT * Math.PI) * 0.14;
        const squash = 1 / Math.sqrt(stretch);
        tv.group.scale.set(squash, stretch, squash);

        if (this.cameraMode === 'follow') {
          this.desiredCamPos.set(x * 0.65, 11.5, z * 0.65 + 9.0);
          this.desiredLookAt.set(x, BOARD_TOP_Y + 0.5, z);
          this.cameraTransitionActive = true;
        }

        if (stepT >= 1) {
          tv.group.scale.setScalar(1);
          anim.stepIndex += 1;
          if (anim.stepIndex < anim.waypoints.length) {
            anim.startX = wp.x;
            anim.startZ = wp.z;
            anim.stepElapsed = 0;
            this.audio.playTokenHop(anim.stepIndex);
          } else {
            // Arrived at destination!
            if (anim.captures.length > 0) {
              this.audio.playCapture();
              this.trauma = Math.max(this.trauma, 0.45);
              this.confetti.burst(wp.x, BOARD_TOP_Y + 0.7, wp.z, 36, [0xfbbf24, 0xffffff, COLOR_PALETTE[tv.color].hex]);
              for (const cap of anim.captures) {
                const capKey = `${cap.seatIndex}-${cap.tokenIndex}`;
                const capTv = this.tokens.get(capKey);
                const yardCoord = getTokenGridCoord(cap.color, cap.tokenIndex, -1);
                const yardXZ = gridToWorldXZ(yardCoord);
                if (capTv) {
                  this.captureAnims.push({
                    seatIndex: cap.seatIndex,
                    tokenIndex: cap.tokenIndex,
                    startX: capTv.group.position.x,
                    startZ: capTv.group.position.z,
                    targetX: yardXZ.x,
                    targetZ: yardXZ.z,
                    elapsed: 0,
                    duration: 0.48,
                  });
                }
              }
            } else if (anim.isFinish) {
              this.audio.playFinish();
              this.confetti.burst(wp.x, BOARD_TOP_Y + 0.8, wp.z, 48, [COLOR_PALETTE[tv.color].hex, 0xfbbf24, 0xffffff]);
            }

            const cb = anim.onComplete;
            this.tokenAnim = null;
            cb();
          }
        }
      } else {
        const cb = anim.onComplete;
        this.tokenAnim = null;
        cb();
      }
    }

    // 5. Captured Token Knockback Arc back to Yard
    if (this.captureAnims.length > 0) {
      keepRunning = true;
      for (let i = this.captureAnims.length - 1; i >= 0; i--) {
        const ca = this.captureAnims[i];
        ca.elapsed += animDt;
        const t = Math.min(1, ca.elapsed / ca.duration);
        const tv = this.tokens.get(`${ca.seatIndex}-${ca.tokenIndex}`);
        if (tv) {
          const x = THREE.MathUtils.lerp(ca.startX, ca.targetX, t);
          const z = THREE.MathUtils.lerp(ca.startZ, ca.targetZ, t);
          const y = BOARD_TOP_Y + 0.015 + Math.sin(t * Math.PI) * 2.3;
          tv.group.position.set(x, y, z);
          tv.group.rotation.y += dt * 12;
        }
        if (t >= 1) {
          if (tv) {
            tv.group.position.set(ca.targetX, BOARD_TOP_Y + 0.015, ca.targetZ);
            tv.group.rotation.y = 0;
          }
          this.captureAnims.splice(i, 1);
        }
      }
    }

    // 6. Legal Selectable Token Halo Pulse
    if (this.legalTokenKeys.size > 0 && !this.isTitleScreen) {
      keepRunning = true;
      const pulse = 1 + Math.sin(nowSec * 6.5) * 0.14;
      for (const key of this.legalTokenKeys) {
        const tv = this.tokens.get(key);
        if (tv) {
          tv.haloMesh.scale.setScalar(pulse);
        }
      }
    }

    // 7. Confetti Pool
    if (this.confetti.update(dt)) {
      keepRunning = true;
    }

    // 8. Decaying Camera Shake
    if (!this.isTitleScreen) {
      this.controls.update();
    }
    if (this.trauma > 0.005) {
      keepRunning = true;
      const shake = this.trauma * this.trauma * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    }

    this.renderer.render(this.scene, this.camera);

    if (keepRunning) {
      this.scheduleNextTick();
    } else {
      this.isLoopRunning = false;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.isLoopRunning = false;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointermove', this.onPointerMove);

    this.controls.dispose();
    this.boardScene?.dispose();
    this.diceObj?.dispose();
    for (const tv of this.tokens.values()) {
      tv.dispose();
    }
    this.tokens.clear();
    this.confetti.dispose();
    this.contactTex.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
