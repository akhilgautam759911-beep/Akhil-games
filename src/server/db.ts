import fs from 'node:fs';
import path from 'node:path';
import {
  DAILY_REWARD_SCHEDULE,
  SHOP_CATALOG,
  createDefaultMissions,
  createDefaultProfile,
  xpForLevel,
} from '../game/shopCatalog';
import type { BoardThemeId, DiceSkinId, GameMode, PlayerProfile, TokenSkinId } from '../game/types';

interface PersistedDatabase {
  profiles: Record<string, PlayerProfile>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'ludo-db.json');

const SEED_LEADERBOARD: Array<{
  id: string;
  username: string;
  avatar: string;
  level: number;
  elo: number;
  wins: number;
  matchesPlayed: number;
}> = [
  { id: 'seed-1', username: 'Vikram_Sovereign', avatar: 'diamond', level: 24, elo: 1840, wins: 142, matchesPlayed: 196 },
  { id: 'seed-2', username: 'AriaVanguard', avatar: 'phoenix', level: 21, elo: 1765, wins: 118, matchesPlayed: 170 },
  { id: 'seed-3', username: 'MarcusK', avatar: 'diamond', level: 19, elo: 1625, wins: 94, matchesPlayed: 141 },
  { id: 'seed-4', username: 'Arjun_Pro', avatar: 'knight', level: 16, elo: 1480, wins: 71, matchesPlayed: 112 },
  { id: 'seed-5', username: 'ElenaV', avatar: 'phoenix', level: 14, elo: 1390, wins: 58, matchesPlayed: 95 },
];

export class GameDatabase {
  private data: PersistedDatabase = { profiles: {} };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedDatabase;
        if (parsed && typeof parsed.profiles === 'object') {
          this.data = parsed;
        }
      }
    } catch {
      this.data = { profiles: {} };
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${DB_PATH}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_PATH);
    } catch {
      // Ignore disk permission issues in read-only environments
    }
  }

  public getOrCreateProfile(id: string, username?: string): PlayerProfile {
    if (!this.data.profiles[id]) {
      this.data.profiles[id] = createDefaultProfile(id, username || `Player_${id.slice(-4).toUpperCase()}`);
      this.save();
    }
    return this.data.profiles[id];
  }

  public updateProfileIdentity(
    id: string,
    updates: { username?: string; avatar?: string; authProvider?: 'guest' | 'google'; email?: string },
  ): PlayerProfile {
    const profile = this.getOrCreateProfile(id);
    if (updates.username && updates.username.trim().length >= 2) {
      profile.username = updates.username.trim().slice(0, 20);
    }
    if (updates.avatar && profile.unlockedItems.includes(updates.avatar)) {
      profile.avatar = updates.avatar;
    }
    if (updates.authProvider) {
      profile.authProvider = updates.authProvider;
    }
    if (updates.email) {
      profile.email = updates.email;
    }
    this.save();
    return profile;
  }

  public grantXpAndCoins(profile: PlayerProfile, coinsDelta: number, xpDelta: number): void {
    profile.coins = Math.max(0, profile.coins + coinsDelta);
    profile.xp += Math.max(0, xpDelta);
    while (profile.xp >= xpForLevel(profile.level)) {
      profile.xp -= xpForLevel(profile.level);
      profile.level += 1;
    }
  }

  public purchaseOrEquip(id: string, itemId: string): { ok: boolean; error?: string; profile: PlayerProfile } {
    const profile = this.getOrCreateProfile(id);
    const item = SHOP_CATALOG.find((s) => s.id === itemId);
    if (!item) {
      return { ok: false, error: 'Item not found', profile };
    }

    if (!profile.unlockedItems.includes(item.id)) {
      if (profile.coins < item.price) {
        return { ok: false, error: 'Insufficient coins', profile };
      }
      profile.coins -= item.price;
      profile.unlockedItems.push(item.id);
    }

    if (item.category === 'board') profile.equippedBoard = item.id as BoardThemeId;
    if (item.category === 'dice') profile.equippedDice = item.id as DiceSkinId;
    if (item.category === 'token') profile.equippedToken = item.id as TokenSkinId;
    if (item.category === 'avatar') profile.avatar = item.id;

    this.save();
    return { ok: true, profile };
  }

  public claimDailyReward(id: string): { ok: boolean; error?: string; reward?: { coins: number; xp: number; day: number }; profile: PlayerProfile } {
    const profile = this.getOrCreateProfile(id);
    const today = new Date().toISOString().slice(0, 10);
    if (profile.lastDailyClaimDate === today) {
      return { ok: false, error: 'Daily reward already claimed today', profile };
    }

    const dayIndex = profile.dailyStreak % DAILY_REWARD_SCHEDULE.length;
    const reward = DAILY_REWARD_SCHEDULE[dayIndex];
    profile.dailyStreak += 1;
    profile.lastDailyClaimDate = today;
    this.grantXpAndCoins(profile, reward.coins, reward.xp);
    this.save();
    return { ok: true, reward: { coins: reward.coins, xp: reward.xp, day: reward.day }, profile };
  }

  public claimMission(id: string, missionId: string): { ok: boolean; error?: string; profile: PlayerProfile } {
    const profile = this.getOrCreateProfile(id);
    const mission = profile.missions.find((m) => m.id === missionId);
    if (!mission) return { ok: false, error: 'Mission not found', profile };
    if (mission.claimed) return { ok: false, error: 'Already claimed', profile };
    if (mission.progress < mission.target) return { ok: false, error: 'Mission incomplete', profile };

    mission.claimed = true;
    this.grantXpAndCoins(profile, mission.rewardCoins, mission.rewardXp);
    this.save();
    return { ok: true, profile };
  }

  public recordMatchResult(
    id: string,
    result: {
      mode: GameMode;
      won: boolean;
      playersCount: number;
      captures: number;
      sixesRolled: number;
      turns: number;
    },
  ): { profile: PlayerProfile; coinsEarned: number; xpEarned: number } {
    const profile = this.getOrCreateProfile(id);
    profile.matchesPlayed += 1;
    if (result.won) profile.wins += 1;
    profile.captures += result.captures;
    profile.sixesRolled += result.sixesRolled;

    const isRanked = result.mode === 'online_ranked';
    if (result.won) {
      profile.elo += isRanked ? 28 : 12;
    } else if (isRanked) {
      profile.elo = Math.max(800, profile.elo - 16);
    }

    const coinsEarned = (result.won ? 180 : 55) + result.captures * 20;
    const xpEarned = (result.won ? 120 : 45) + result.captures * 15;
    this.grantXpAndCoins(profile, coinsEarned, xpEarned);

    // Advance daily missions
    if (!profile.missions || profile.missions.length === 0) {
      profile.missions = createDefaultMissions();
    }
    for (const m of profile.missions) {
      if (m.id === 'm_play') m.progress = Math.min(m.target, m.progress + 1);
      if (m.id === 'm_capture') m.progress = Math.min(m.target, m.progress + result.captures);
      if (m.id === 'm_sixes') m.progress = Math.min(m.target, m.progress + result.sixesRolled);
      if (m.id === 'm_win' && result.won) m.progress = Math.min(m.target, m.progress + 1);
    }

    profile.matchHistory.unshift({
      id: `m-${Date.now()}`,
      mode: result.mode,
      won: result.won,
      playersCount: result.playersCount,
      captures: result.captures,
      turns: result.turns,
      coinsEarned,
      timestamp: Date.now(),
    });
    profile.matchHistory = profile.matchHistory.slice(0, 20);

    this.save();
    return { profile, coinsEarned, xpEarned };
  }

  public addFriend(id: string, friendUsername: string): { ok: boolean; error?: string; profile: PlayerProfile } {
    const profile = this.getOrCreateProfile(id);
    const trimmed = friendUsername.trim();
    if (trimmed.length < 2) return { ok: false, error: 'Enter a valid username', profile };
    if (profile.friends.some((f) => f.username.toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false, error: 'Already in friends list', profile };
    }
    profile.friends.unshift({
      id: `fr-${Date.now()}`,
      username: trimmed.slice(0, 20),
      avatar: 'knight',
      elo: 1200 + Math.floor(Math.random() * 400),
      status: 'online',
    });
    this.save();
    return { ok: true, profile };
  }

  public removeFriend(id: string, friendId: string): PlayerProfile {
    const profile = this.getOrCreateProfile(id);
    profile.friends = profile.friends.filter((f) => f.id !== friendId);
    this.save();
    return profile;
  }

  public getLeaderboard() {
    const real = Object.values(this.data.profiles).map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      level: p.level,
      elo: p.elo,
      wins: p.wins,
      matchesPlayed: p.matchesPlayed,
    }));
    const combined = [...real, ...SEED_LEADERBOARD];
    combined.sort((a, b) => b.elo - a.elo);
    return combined.slice(0, 25);
  }
}
