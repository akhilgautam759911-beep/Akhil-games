import type { DailyMission, PlayerProfile, ShopItem } from './types';

export const SHOP_CATALOG: ShopItem[] = [
  // Board themes
  {
    id: 'royal_walnut',
    category: 'board',
    name: 'Royal Walnut & Brass',
    description: 'Hand-rubbed walnut cabinetry with brushed brass inlays.',
    price: 0,
    accentHex: '#c89b3c',
  },
  {
    id: 'carrara_marble',
    category: 'board',
    name: 'Carrara Marble & Gold',
    description: 'Italian veined white marble slab with 24k gold trim.',
    price: 450,
    accentHex: '#e6d6a8',
  },
  {
    id: 'midnight_obsidian',
    category: 'board',
    name: 'Midnight Obsidian',
    description: 'Volcanic dark slate board with brushed platinum channels.',
    price: 750,
    accentHex: '#94a3b8',
  },
  {
    id: 'emerald_club',
    category: 'board',
    name: 'Emerald Grand Club',
    description: 'Tournament baize velvet inlays set in deep mahogany.',
    price: 900,
    accentHex: '#22c55e',
  },

  // Dice skins
  {
    id: 'ivory_classic',
    category: 'dice',
    name: 'Ivory Classic',
    description: 'Traditional warm bone ivory with recessed ebony pips.',
    price: 0,
    accentHex: '#f5efe6',
  },
  {
    id: 'obsidian_gold',
    category: 'dice',
    name: 'Obsidian & Gold',
    description: 'Matte black lacquer die inlaid with gleaming gold pips.',
    price: 300,
    accentHex: '#eab308',
  },
  {
    id: 'ruby_crystal',
    category: 'dice',
    name: 'Crimson Glass',
    description: 'Translucent ruby-tinted casino die with silver pips.',
    price: 550,
    accentHex: '#ef4444',
  },
  {
    id: 'brushed_titanium',
    category: 'dice',
    name: 'Brushed Titanium',
    description: 'Machined aerospace alloy die with precision bevels.',
    price: 650,
    accentHex: '#cbd5e1',
  },

  // Token finishes
  {
    id: 'polished_ceramic',
    category: 'token',
    name: 'Polished Ceramic',
    description: 'Glazed porcelain pawns with warm satin metallic collars.',
    price: 0,
    accentHex: '#d97706',
  },
  {
    id: 'brushed_gold',
    category: 'token',
    name: 'Gilded Sovereign',
    description: 'Anisotropic brushed gold and enamel tournament pieces.',
    price: 500,
    accentHex: '#fbbf24',
  },
  {
    id: 'frosted_jewel',
    category: 'token',
    name: 'Crystal Crown',
    description: 'Cut optical-glass pawns with luminous faceted finials.',
    price: 800,
    accentHex: '#38bdf8',
  },
  {
    id: 'ebony_crown',
    category: 'token',
    name: 'Ebony & Platinum',
    description: 'Weighted dark hardwood pawns crowned in solid platinum.',
    price: 950,
    accentHex: '#e2e8f0',
  },

  // Avatars
  { id: 'crown', category: 'avatar', name: 'Sovereign Crown', description: 'Royal champion crest.', price: 0, accentHex: '#eab308' },
  { id: 'phoenix', category: 'avatar', name: 'Solar Phoenix', description: 'Rising flame emblem.', price: 250, accentHex: '#f97316' },
  { id: 'knight', category: 'avatar', name: 'Grandmaster Knight', description: 'Tactical strategist crest.', price: 350, accentHex: '#60a5fa' },
  { id: 'diamond', category: 'avatar', name: 'Apex Diamond', description: 'Elite ranked insignia.', price: 600, accentHex: '#2dd4bf' },
];

export const DAILY_REWARD_SCHEDULE = [
  { day: 1, coins: 150, xp: 50, label: 'Day 1' },
  { day: 2, coins: 225, xp: 75, label: 'Day 2' },
  { day: 3, coins: 300, xp: 100, label: 'Day 3' },
  { day: 4, coins: 400, xp: 125, label: 'Day 4' },
  { day: 5, coins: 550, xp: 150, label: 'Day 5' },
  { day: 6, coins: 750, xp: 200, label: 'Day 6' },
  { day: 7, coins: 1200, xp: 350, label: 'Jackpot' },
];

export function createDefaultMissions(): DailyMission[] {
  return [
    { id: 'm_play', title: 'Play 2 Matches', target: 2, progress: 0, rewardCoins: 180, rewardXp: 80, claimed: false },
    { id: 'm_capture', title: 'Capture 3 Opponent Tokens', target: 3, progress: 0, rewardCoins: 240, rewardXp: 110, claimed: false },
    { id: 'm_sixes', title: 'Roll 5 Sixes', target: 5, progress: 0, rewardCoins: 200, rewardXp: 90, claimed: false },
    { id: 'm_win', title: 'Win 1 Match', target: 1, progress: 0, rewardCoins: 350, rewardXp: 160, claimed: false },
  ];
}

export function xpForLevel(level: number): number {
  return 200 + (level - 1) * 150;
}

export function createDefaultProfile(id: string, username = 'Grandmaster'): PlayerProfile {
  return {
    id,
    username,
    avatar: 'crown',
    authProvider: 'guest',
    level: 1,
    xp: 40,
    coins: 650,
    elo: 1200,
    matchesPlayed: 0,
    wins: 0,
    captures: 0,
    sixesRolled: 0,
    unlockedItems: ['royal_walnut', 'ivory_classic', 'polished_ceramic', 'crown'],
    equippedBoard: 'royal_walnut',
    equippedDice: 'ivory_classic',
    equippedToken: 'polished_ceramic',
    dailyStreak: 0,
    lastDailyClaimDate: null,
    missions: createDefaultMissions(),
    friends: [
      { id: 'npc-arjun', username: 'Arjun_Pro', avatar: 'knight', elo: 1480, status: 'online' },
      { id: 'npc-elena', username: 'ElenaV', avatar: 'phoenix', elo: 1390, status: 'in_match' },
      { id: 'npc-marcus', username: 'MarcusK', avatar: 'diamond', elo: 1625, status: 'online' },
    ],
    matchHistory: [],
  };
}
