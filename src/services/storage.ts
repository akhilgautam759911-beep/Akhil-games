import { createDefaultProfile } from '../game/shopCatalog';
import { DEFAULT_RULES, type GameMode, type GameSettings, type PlayerProfile } from '../game/types';

const SETTINGS_KEY = 'ludo3d_settings_v1';
const CLIENT_ID_KEY = 'ludo3d_client_id_v1';
const PROFILE_CACHE_KEY = 'ludo3d_profile_cache_v1';

export function getOrCreateClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `usr-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `usr-${Date.now().toString(36)}`;
  }
}

export function loadSettings(): GameSettings {
  const defaults: GameSettings = {
    graphics: 'high',
    cameraMode: 'cinematic',
    audio: {
      masterVolume: 0.8,
      sfxVolume: 0.85,
      musicVolume: 0.3,
      muted: false,
    },
    rules: { ...DEFAULT_RULES },
    autoPassSingleMove: false,
    showMoveHints: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...defaults,
      ...parsed,
      audio: { ...defaults.audio, ...(parsed.audio ?? {}) },
      rules: { ...defaults.rules, ...(parsed.rules ?? {}) },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchProfile(clientId: string): Promise<PlayerProfile> {
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}`);
    if (res.ok) {
      const data = (await res.json()) as { profile: PlayerProfile };
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
      return data.profile;
    }
  } catch {
    // fallback to cache
  }
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) return JSON.parse(cached) as PlayerProfile;
  } catch {
    // ignore
  }
  return createDefaultProfile(clientId);
}

export async function updateProfileIdentityApi(
  clientId: string,
  updates: { username?: string; avatar?: string; authProvider?: 'guest' | 'google'; email?: string },
): Promise<PlayerProfile> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = (await res.json()) as { profile: PlayerProfile };
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data.profile;
}

export async function shopPurchaseOrEquipApi(
  clientId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string; profile: PlayerProfile }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/shop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; profile: PlayerProfile };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data;
}

export async function claimDailyRewardApi(
  clientId: string,
): Promise<{ ok: boolean; error?: string; reward?: { coins: number; xp: number; day: number }; profile: PlayerProfile }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/daily`, { method: 'POST' });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    reward?: { coins: number; xp: number; day: number };
    profile: PlayerProfile;
  };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data;
}

export async function claimMissionApi(
  clientId: string,
  missionId: string,
): Promise<{ ok: boolean; error?: string; profile: PlayerProfile }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ missionId }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; profile: PlayerProfile };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data;
}

export async function recordMatchResultApi(
  clientId: string,
  result: { mode: GameMode; won: boolean; playersCount: number; captures: number; sixesRolled: number; turns: number },
): Promise<{ profile: PlayerProfile; coinsEarned: number; xpEarned: number }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/match-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  const data = (await res.json()) as { profile: PlayerProfile; coinsEarned: number; xpEarned: number };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data;
}

export async function addFriendApi(
  clientId: string,
  username: string,
): Promise<{ ok: boolean; error?: string; profile: PlayerProfile }> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/friends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string; profile: PlayerProfile };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data;
}

export async function removeFriendApi(clientId: string, friendId: string): Promise<PlayerProfile> {
  const res = await fetch(`/api/profile/${encodeURIComponent(clientId)}/friends/${encodeURIComponent(friendId)}`, {
    method: 'DELETE',
  });
  const data = (await res.json()) as { profile: PlayerProfile };
  if (data.profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.profile));
  return data.profile;
}

export async function fetchLeaderboardApi() {
  const res = await fetch('/api/leaderboard');
  return (await res.json()) as {
    entries: Array<{
      id: string;
      username: string;
      avatar: string;
      level: number;
      elo: number;
      wins: number;
      matchesPlayed: number;
    }>;
  };
}
