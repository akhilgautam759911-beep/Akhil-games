export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type PlayerKind = 'human' | 'ai' | 'remote';

export type GameMode = 'vs_ai' | 'pass_and_play' | 'online_quick' | 'online_ranked' | 'online_private';

export type CameraMode = 'top' | 'cinematic' | 'dice' | 'follow' | 'free';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export type BoardThemeId = 'royal_walnut' | 'carrara_marble' | 'midnight_obsidian' | 'emerald_club';
export type DiceSkinId = 'ivory_classic' | 'obsidian_gold' | 'ruby_crystal' | 'brushed_titanium';
export type TokenSkinId = 'polished_ceramic' | 'brushed_gold' | 'frosted_jewel' | 'ebony_crown';

export interface RuleVariations {
  requireSixToExit: boolean;
  allowOneOrSixToExit: boolean;
  extraTurnOnSix: boolean;
  extraTurnOnCapture: boolean;
  extraTurnOnFinish: boolean;
  tripleSixPenalty: boolean;
  safeStarCells: boolean;
  safeDoubleStack: boolean;
  teamMode: boolean;
}

export const DEFAULT_RULES: RuleVariations = {
  requireSixToExit: true,
  allowOneOrSixToExit: false,
  extraTurnOnSix: true,
  extraTurnOnCapture: true,
  extraTurnOnFinish: true,
  tripleSixPenalty: true,
  safeStarCells: true,
  safeDoubleStack: false,
  teamMode: false,
};

export interface TokenState {
  index: number; // 0..3
  color: PlayerColor;
  /**
   * -1 = in yard
   * 0..50 = main 52-cell track (relative steps from player's start cell)
   * 51..55 = player's colored home stretch
   * 56 = finished in center home triangle
   */
  progress: number;
}

export interface PlayerSlot {
  seatIndex: number; // 0..3
  color: PlayerColor;
  name: string;
  avatar: string;
  kind: PlayerKind;
  aiDifficulty?: AIDifficulty;
  clientId?: string;
  connected: boolean;
  teamIndex: number; // 0 or 1 in teamMode, else seatIndex
  tokens: TokenState[];
  captures: number;
  finishedCount: number;
}

export type TurnPhase = 'waiting_roll' | 'selecting_token' | 'no_moves' | 'finished';

export interface LegalMove {
  tokenIndex: number;
  fromProgress: number;
  toProgress: number;
  isDeploy: boolean;
  isFinish: boolean;
  captures: Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }>;
  landsOnSafe: boolean;
}

export interface MatchEvent {
  id: number;
  type:
    | 'match_start'
    | 'rolled'
    | 'triple_six_forfeit'
    | 'no_moves'
    | 'deployed'
    | 'moved'
    | 'captured'
    | 'token_finished'
    | 'extra_turn'
    | 'turn_changed'
    | 'victory';
  seatIndex: number;
  color: PlayerColor;
  diceValue?: number;
  tokenIndex?: number;
  fromProgress?: number;
  toProgress?: number;
  capturedTokens?: Array<{ seatIndex: number; tokenIndex: number; color: PlayerColor }>;
  message: string;
}

export interface MatchState {
  matchId: string;
  mode: GameMode;
  rules: RuleVariations;
  players: PlayerSlot[];
  currentTurnSeat: number;
  phase: TurnPhase;
  diceValue: number | null;
  consecutiveSixes: number;
  legalMoves: LegalMove[];
  winnerSeats: number[];
  turnCount: number;
  eventSeq: number;
  lastEvent: MatchEvent | null;
  startedAt: number;
}

export interface PlayerConfigInput {
  color: PlayerColor;
  name: string;
  avatar: string;
  kind: PlayerKind;
  aiDifficulty?: AIDifficulty;
  clientId?: string;
}

export interface ShopItem {
  id: string;
  category: 'board' | 'dice' | 'token' | 'avatar';
  name: string;
  description: string;
  price: number;
  accentHex: string;
}

export interface DailyMission {
  id: string;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
}

export interface PlayerProfile {
  id: string;
  username: string;
  avatar: string;
  authProvider: 'guest' | 'google';
  email?: string;
  level: number;
  xp: number;
  coins: number;
  elo: number;
  matchesPlayed: number;
  wins: number;
  captures: number;
  sixesRolled: number;
  unlockedItems: string[];
  equippedBoard: BoardThemeId;
  equippedDice: DiceSkinId;
  equippedToken: TokenSkinId;
  dailyStreak: number;
  lastDailyClaimDate: string | null;
  missions: DailyMission[];
  friends: Array<{ id: string; username: string; avatar: string; elo: number; status: 'online' | 'in_match' | 'offline' }>;
  matchHistory: Array<{
    id: string;
    mode: GameMode;
    won: boolean;
    playersCount: number;
    captures: number;
    turns: number;
    coinsEarned: number;
    timestamp: number;
  }>;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

export interface GameSettings {
  graphics: GraphicsPreset;
  cameraMode: CameraMode;
  audio: AudioSettings;
  rules: RuleVariations;
  autoPassSingleMove: boolean;
  showMoveHints: boolean;
}
