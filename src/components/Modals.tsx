import React, { useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Gift,
  Globe,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { COLOR_PALETTE } from '../game/boardLayout';
import { DAILY_REWARD_SCHEDULE, SHOP_CATALOG, xpForLevel } from '../game/shopCatalog';
import type {
  GameSettings,
  GraphicsPreset,
  MatchState,
  PlayerProfile,
} from '../game/types';
import type { OnlineRoomSnapshot } from '../services/clientMultiplayer';
import { AvatarCrest } from './SvgIcons';

const ModalShell: React.FC<{
  title: string;
  onClose?: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ title, onClose, maxWidth = 'max-w-xl', children }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div
      className={`w-full ${maxWidth} max-h-[88vh] flex flex-col rounded-2xl border border-[#d4a853]/45 bg-[#15110d] text-[#f5efe6] shadow-2xl`}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#342a1f]">
        <h2 className="font-display text-lg font-bold tracking-wide text-[#fde68a]">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#3a2f24] bg-[#1e1812] hover:border-[#d4a853] text-[#cbbba6]"
            aria-label={`Close ${title}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-5 overflow-y-auto ludo-scroll">{children}</div>
    </div>
  </div>
);

export const PauseModal: React.FC<{
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onExitToTitle: () => void;
}> = ({ onResume, onRestart, onOpenSettings, onExitToTitle }) => (
  <ModalShell title="Match Paused" maxWidth="max-w-sm" onClose={onResume}>
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onResume}
        className="w-full rounded-xl py-3 font-bold text-sm uppercase tracking-wider bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c]"
      >
        Resume Match
      </button>
      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-xl py-2.5 font-semibold text-sm border border-[#4a3b2c] bg-[#1e1812] hover:border-[#d4a853] flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Restart Match
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="w-full rounded-xl py-2.5 font-semibold text-sm border border-[#4a3b2c] bg-[#1e1812] hover:border-[#d4a853]"
      >
        Settings & Rules
      </button>
      <button
        type="button"
        onClick={onExitToTitle}
        className="w-full rounded-xl py-2.5 font-semibold text-sm border border-[#5f2222] bg-[#241313] hover:bg-[#331919] text-[#fca5a5]"
      >
        Exit to Main Menu
      </button>
    </div>
  </ModalShell>
);

export const VictoryModal: React.FC<{
  match: MatchState;
  rewards: { coinsEarned: number; xpEarned: number } | null;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}> = ({ match, rewards, onPlayAgain, onMainMenu }) => {
  const winners = match.winnerSeats.map((s) => match.players[s]);
  const primaryWinner = winners[0] ?? match.players[0];
  const totalCaptures = match.players.reduce((acc, p) => acc + p.captures, 0);

  return (
    <ModalShell title="Victory!" maxWidth="max-w-md">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl border-2 border-[#e5a91a] bg-[#241b10] flex items-center justify-center">
          <Trophy className="w-9 h-9 text-[#facc15]" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#d4a853]">Champion</div>
          <h3 className="font-display text-2xl font-extrabold text-[#f5efe6] mt-0.5">
            {winners.map((w) => w.name).join(' & ')}
          </h3>
          <p className="text-xs text-[#cbbba6] mt-1">
            {COLOR_PALETTE[primaryWinner.color].label} conquered the board in {match.turnCount} turns.
          </p>
        </div>

        {/* 3 Mastery Stat Tiles */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-xl border border-[#3a2f24] bg-[#1d1711] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Turns</div>
            <div className="text-xl font-extrabold tabular-nums text-[#f5efe6]">{match.turnCount}</div>
          </div>
          <div className="rounded-xl border border-[#3a2f24] bg-[#1d1711] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Captures</div>
            <div className="text-xl font-extrabold tabular-nums text-[#facc15]">{totalCaptures}</div>
          </div>
          <div className="rounded-xl border border-[#3a2f24] bg-[#1d1711] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Reward</div>
            <div className="text-xl font-extrabold tabular-nums text-[#4ade80]">
              +{rewards?.coinsEarned ?? 180}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 rounded-xl py-3 font-bold text-sm uppercase tracking-wider bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c]"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="flex-1 rounded-xl py-3 font-semibold text-sm border border-[#4a3b2c] bg-[#1e1812] hover:border-[#d4a853]"
          >
            Main Menu
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export const ShopModal: React.FC<{
  profile: PlayerProfile;
  onBuyOrEquip: (itemId: string) => Promise<void>;
  onClose: () => void;
}> = ({ profile, onBuyOrEquip, onClose }) => {
  const [cat, setCat] = useState<'board' | 'dice' | 'token' | 'avatar'>('board');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const items = SHOP_CATALOG.filter((i) => i.category === cat);

  const isEquipped = (id: string) =>
    profile.equippedBoard === id ||
    profile.equippedDice === id ||
    profile.equippedToken === id ||
    profile.avatar === id;

  return (
    <ModalShell title="Grand Club Shop" maxWidth="max-w-2xl" onClose={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {(['board', 'dice', 'token', 'avatar'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border ${
                cat === c
                  ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                  : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6]'
              }`}
            >
              {c === 'board' ? 'Boards' : c === 'dice' ? 'Dice' : c === 'token' ? 'Tokens' : 'Avatars'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1812] border border-[#d4a853]/40 text-[#facc15] font-bold text-sm tabular-nums">
          <Coins className="w-4 h-4" />
          <span>{profile.coins.toLocaleString()}</span>
        </div>
      </div>

      {statusMsg && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#241c12] border border-[#d4a853]/40 text-xs text-[#fde68a]">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const owned = profile.unlockedItems.includes(item.id);
          const equipped = isEquipped(item.id);
          const canAfford = profile.coins >= item.price;
          return (
            <div
              key={item.id}
              className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-white/20 shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: item.accentHex }}
                >
                  <ShoppingBag className="w-5 h-5 text-[#14100c]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#f5efe6]">{item.name}</h3>
                  <p className="text-xs text-[#a99882] mt-0.5">{item.description}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!owned && !canAfford}
                onClick={async () => {
                  try {
                    await onBuyOrEquip(item.id);
                    setStatusMsg(owned ? `Equipped ${item.name}` : `Unlocked & equipped ${item.name}!`);
                  } catch (e) {
                    setStatusMsg((e as Error).message);
                  }
                }}
                className={`w-full rounded-lg py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                  equipped
                    ? 'bg-[#193323] border border-[#22c55e]/60 text-[#86efac]'
                    : owned
                      ? 'bg-[#2c2113] border border-[#d4a853]/60 text-[#fde68a] hover:bg-[#3a2b18]'
                      : canAfford
                        ? 'bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c]'
                        : 'bg-[#261f18] text-[#7a6b5a] cursor-not-allowed'
                }`}
              >
                {equipped ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Equipped
                  </>
                ) : owned ? (
                  'Equip'
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5" /> Unlock · {item.price}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
};

export const RewardsModal: React.FC<{
  profile: PlayerProfile;
  onClaimDaily: () => Promise<void>;
  onClaimMission: (missionId: string) => Promise<void>;
  onClose: () => void;
}> = ({ profile, onClaimDaily, onClaimMission, onClose }) => {
  const today = new Date().toISOString().slice(0, 10);
  const canClaimToday = profile.lastDailyClaimDate !== today;
  const activeDayIndex = profile.dailyStreak % DAILY_REWARD_SCHEDULE.length;

  return (
    <ModalShell title="Daily Rewards & Missions" maxWidth="max-w-2xl" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4a853]">
              7-Day Login Calendar · Streak {profile.dailyStreak}
            </h3>
            <button
              type="button"
              disabled={!canClaimToday}
              onClick={onClaimDaily}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase ${
                canClaimToday
                  ? 'bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c]'
                  : 'bg-[#261f18] text-[#7a6b5a] cursor-not-allowed'
              }`}
            >
              {canClaimToday ? 'Claim Today' : 'Claimed Today'}
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAILY_REWARD_SCHEDULE.map((r, idx) => {
              const isCurrent = idx === activeDayIndex && canClaimToday;
              const claimed = idx < activeDayIndex || (idx === activeDayIndex && !canClaimToday);
              return (
                <div
                  key={r.day}
                  className={`rounded-xl border p-2.5 text-center ${
                    isCurrent
                      ? 'border-[#facc15] bg-[#2c2113]'
                      : claimed
                        ? 'border-[#22c55e]/40 bg-[#142419]'
                        : 'border-[#3a2f24] bg-[#1b1611]'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-[#cbbba6]">{r.label}</div>
                  <Gift className="w-4 h-4 mx-auto my-1.5 text-[#facc15]" />
                  <div className="text-xs font-extrabold tabular-nums text-[#f5efe6]">{r.coins}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4a853] mb-2.5">
            Daily Missions
          </h3>
          <div className="space-y-2">
            {profile.missions.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              const ready = m.progress >= m.target && !m.claimed;
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs font-bold text-[#f5efe6]">
                      <span>{m.title}</span>
                      <span className="tabular-nums text-[#cbbba6]">
                        {m.progress}/{m.target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#2b231b] overflow-hidden">
                      <div className="h-full bg-[#e5a91a]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => onClaimMission(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums shrink-0 ${
                      m.claimed
                        ? 'bg-[#193323] text-[#86efac]'
                        : ready
                          ? 'bg-[#d4a853] text-[#14100c] hover:bg-[#e3ba66]'
                          : 'bg-[#261f18] text-[#7a6b5a]'
                    }`}
                  >
                    {m.claimed ? 'Claimed' : `+${m.rewardCoins}c`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export const LeaderboardModal: React.FC<{
  entries: Array<{ id: string; username: string; avatar: string; level: number; elo: number; wins: number; matchesPlayed: number }>;
  currentUserId: string;
  onClose: () => void;
}> = ({ entries, currentUserId, onClose }) => (
  <ModalShell title="Global Leaderboards" maxWidth="max-w-lg" onClose={onClose}>
    <div className="space-y-2">
      {entries.map((e, idx) => {
        const isMe = e.id === currentUserId;
        return (
          <div
            key={e.id}
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border ${
              isMe ? 'border-[#e5a91a] bg-[#2a2013]' : 'border-[#342a1f] bg-[#1b1611]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center font-display font-bold text-sm text-[#d4a853] tabular-nums">
                #{idx + 1}
              </span>
              <AvatarCrest avatar={e.avatar} className="w-8 h-8" />
              <div>
                <div className="text-sm font-bold text-[#f5efe6]">
                  {e.username} {isMe && <span className="text-[11px] text-[#facc15]">(You)</span>}
                </div>
                <div className="text-[11px] text-[#a99882] tabular-nums">
                  Lv.{e.level} · {e.wins} Wins / {e.matchesPlayed} Matches
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold text-[#60a5fa] tabular-nums">{e.elo}</div>
              <div className="text-[10px] uppercase text-[#a99882]">ELO</div>
            </div>
          </div>
        );
      })}
    </div>
  </ModalShell>
);

export const ProfileFriendsModal: React.FC<{
  profile: PlayerProfile;
  onUpdateIdentity: (updates: { username?: string; authProvider?: 'guest' | 'google'; email?: string }) => Promise<void>;
  onAddFriend: (username: string) => Promise<void>;
  onRemoveFriend: (friendId: string) => Promise<void>;
  onClose: () => void;
}> = ({ profile, onUpdateIdentity, onAddFriend, onRemoveFriend, onClose }) => {
  const [nameInput, setNameInput] = useState(profile.username);
  const [friendInput, setFriendInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const levelCap = xpForLevel(profile.level);

  return (
    <ModalShell title="Player Profile & Friends" maxWidth="max-w-xl" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AvatarCrest avatar={profile.avatar} className="w-12 h-12" />
              <div>
                <div className="text-xs text-[#a99882] tabular-nums">ID: {profile.id}</div>
                <div className="text-sm font-bold text-[#facc15] tabular-nums">
                  Level {profile.level} · {profile.xp}/{levelCap} XP
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const nextProvider = profile.authProvider === 'guest' ? 'google' : 'guest';
                await onUpdateIdentity({ authProvider: nextProvider });
                setFeedback(nextProvider === 'google' ? 'Account linked cleanly.' : 'Switched to Guest mode.');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#4a3b2c] bg-[#241c14] hover:border-[#d4a853]"
            >
              {profile.authProvider === 'google' ? 'Linked Account' : 'Link Account'}
            </button>
          </div>

          <div className="flex gap-2">
            <label htmlFor="profile-username" className="sr-only">
              Username
            </label>
            <input
              id="profile-username"
              type="text"
              maxLength={20}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 rounded-lg border border-[#4a3b2c] bg-[#14100c] px-3 py-2 text-sm text-[#f5efe6]"
            />
            <button
              type="button"
              onClick={async () => {
                await onUpdateIdentity({ username: nameInput });
                setFeedback('Username updated.');
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase bg-[#d4a853] text-[#14100c]"
            >
              Save
            </button>
          </div>
          {feedback && <div className="text-xs text-[#86efac]">{feedback}</div>}
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Win Rate</div>
            <div className="text-lg font-extrabold tabular-nums">
              {profile.matchesPlayed ? Math.round((profile.wins / profile.matchesPlayed) * 100) : 0}%
            </div>
          </div>
          <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Captures</div>
            <div className="text-lg font-extrabold tabular-nums text-[#facc15]">{profile.captures}</div>
          </div>
          <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a99882]">Sixes</div>
            <div className="text-lg font-extrabold tabular-nums text-[#60a5fa]">{profile.sixesRolled}</div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d4a853] mb-2">Friends List</h3>
          <div className="flex gap-2 mb-3">
            <label htmlFor="add-friend-input" className="sr-only">
              Add Friend Username
            </label>
            <input
              id="add-friend-input"
              type="text"
              placeholder="Add friend by username..."
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              className="flex-1 rounded-lg border border-[#4a3b2c] bg-[#14100c] px-3 py-2 text-xs text-[#f5efe6]"
            />
            <button
              type="button"
              onClick={async () => {
                if (!friendInput.trim()) return;
                await onAddFriend(friendInput);
                setFriendInput('');
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#2c2113] border border-[#d4a853]/60 text-[#fde68a] flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="space-y-1.5">
            {profile.friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-[#342a1f] bg-[#1b1611] px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <AvatarCrest avatar={f.avatar} className="w-7 h-7" />
                  <div>
                    <div className="text-xs font-bold text-[#f5efe6]">{f.username}</div>
                    <div className="text-[10px] text-[#a99882] uppercase">
                      {f.status.replace('_', ' ')} · {f.elo} ELO
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFriend(f.id)}
                  className="text-[11px] text-[#fca5a5] hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export const SettingsModal: React.FC<{
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}> = ({ settings, onChange, onClose }) => {
  const presets: GraphicsPreset[] = ['low', 'medium', 'high', 'ultra'];

  const toggleRule = (key: keyof GameSettings['rules']) => {
    onChange({
      ...settings,
      rules: { ...settings.rules, [key]: !settings.rules[key] },
    });
  };

  return (
    <ModalShell title="Settings & Rule Variations" maxWidth="max-w-lg" onClose={onClose}>
      <div className="space-y-5">
        {/* Graphics Quality */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#d4a853] mb-2">Graphics Quality</div>
          <div className="grid grid-cols-4 gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ ...settings, graphics: p })}
                className={`py-2 rounded-lg text-xs font-bold uppercase border ${
                  settings.graphics === p
                    ? 'border-[#e5a91a] bg-[#2c2113] text-[#fde68a]'
                    : 'border-[#3a2f24] bg-[#1b1611] text-[#cbbba6]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Audio Sliders */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#d4a853]">Audio Controls</div>
          {(
            [
              { key: 'masterVolume', label: 'Master Volume' },
              { key: 'sfxVolume', label: 'Sound Effects' },
              { key: 'musicVolume', label: 'Ambient Music' },
            ] as const
          ).map((slider) => (
            <label key={slider.key} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-[#cbbba6] w-32">{slider.label}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.audio[slider.key]}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    audio: { ...settings.audio, [slider.key]: Number(e.target.value) },
                  })
                }
                className="flex-1 accent-[#d4a853]"
              />
              <span className="w-10 text-right tabular-nums text-[#f5efe6]">
                {Math.round(settings.audio[slider.key] * 100)}%
              </span>
            </label>
          ))}
        </div>

        {/* Rule Variations */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[#d4a853]">Ludo Rule Variations</div>
          {(
            [
              { key: 'requireSixToExit', label: 'Classic: Require 6 to exit yard' },
              { key: 'extraTurnOnSix', label: 'Extra turn on rolling 6' },
              { key: 'extraTurnOnCapture', label: 'Bonus turn on opponent capture' },
              { key: 'tripleSixPenalty', label: 'Forfeit turn on three consecutive 6s' },
              { key: 'safeStarCells', label: 'Star squares protect tokens' },
              { key: 'safeDoubleStack', label: 'Stacked pairs block captures' },
            ] as const
          ).map((r) => (
            <label
              key={r.key}
              className="flex items-center justify-between rounded-lg border border-[#342a1f] bg-[#1b1611] px-3 py-2 text-xs cursor-pointer"
            >
              <span>{r.label}</span>
              <input
                type="checkbox"
                checked={settings.rules[r.key]}
                onChange={() => toggleRule(r.key)}
                className="w-4 h-4 accent-[#d4a853]"
              />
            </label>
          ))}
        </div>
      </div>
    </ModalShell>
  );
};

export const HowToPlayModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalShell title="How to Play Ludo 3D" maxWidth="max-w-lg" onClose={onClose}>
    <div className="space-y-3 text-xs leading-relaxed text-[#d9ccb9]">
      <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3.5 flex gap-3">
        <Sparkles className="w-5 h-5 text-[#facc15] shrink-0" />
        <div>
          <strong className="text-[#f5efe6] block mb-0.5">1. Deploy Your Tokens</strong>
          Roll a <strong>6</strong> (press Space or click the 3D Die) to bring a token out of your starting yard onto your colored arrow square.
        </div>
      </div>
      <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3.5 flex gap-3">
        <Shield className="w-5 h-5 text-[#60a5fa] shrink-0" />
        <div>
          <strong className="text-[#f5efe6] block mb-0.5">2. Safe Zones & Captures</strong>
          Landing on an opponent token on a normal square captures it back to its yard and awards a <strong>bonus turn</strong>. Colored start arrows and golden star cells protect all tokens.
        </div>
      </div>
      <div className="rounded-xl border border-[#3a2f24] bg-[#1b1611] p-3.5 flex gap-3">
        <Trophy className="w-5 h-5 text-[#4ade80] shrink-0" />
        <div>
          <strong className="text-[#f5efe6] block mb-0.5">3. Exact Home Entry</strong>
          Circle the board clockwise into your colored Home Stretch. You need an <strong>exact dice roll</strong> to enter the central finishing crown. First player with all 4 tokens home wins!
        </div>
      </div>
    </div>
  </ModalShell>
);

export const MultiplayerLobbyModal: React.FC<{
  room: OnlineRoomSnapshot;
  localClientId: string;
  onStartMatch: (fillWithAi: boolean) => void;
  onLeave: () => void;
}> = ({ room, localClientId, onStartMatch, onLeave }) => {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostClientId === localClientId;
  const inviteUrl = `${window.location.origin}?room=${room.code}`;

  return (
    <ModalShell title="Online Match Lobby" maxWidth="max-w-md" onClose={onLeave}>
      <div className="space-y-4">
        <div className="rounded-xl border border-[#d4a853]/45 bg-[#1e1812] p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#a99882]">Room Code</div>
            <div className="font-display text-2xl font-extrabold tracking-widest text-[#fde68a]" data-testid="room-code">
              {room.code}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(inviteUrl).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-[#2c2113] border border-[#d4a853]/50 text-[#fde68a]"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Link' : 'Invite Link'}</span>
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[#a99882] mb-2">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Players ({room.seats.length}/{room.maxPlayers})
            </span>
            <span className="flex items-center gap-1 text-[#4ade80]">
              <Globe className="w-3.5 h-3.5" /> Server Authoritative
            </span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: room.maxPlayers }).map((_, idx) => {
              const seat = room.seats[idx];
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-[#342a1f] bg-[#1b1611] px-3 py-2.5"
                >
                  {seat ? (
                    <>
                      <div className="flex items-center gap-2.5">
                        <AvatarCrest avatar={seat.avatar} className="w-7 h-7" />
                        <span className="text-xs font-bold text-[#f5efe6]">{seat.name}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-[#4ade80]">
                        {seat.clientId === room.hostClientId ? 'Host' : 'Ready'}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[#6f6152]">Waiting for opponent (or start with AI)...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          {isHost ? (
            <button
              type="button"
              onClick={() => onStartMatch(true)}
              className="flex-1 rounded-xl py-3 text-xs font-extrabold uppercase tracking-wider bg-[#d4a853] hover:bg-[#e3ba66] text-[#14100c]"
            >
              {room.seats.length >= 2 ? 'Start Match' : 'Start Now (AI Fill)'}
            </button>
          ) : (
            <div className="flex-1 text-center py-3 text-xs text-[#cbbba6] rounded-xl border border-[#342a1f] bg-[#1b1611]">
              Waiting for host to start...
            </div>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="px-4 rounded-xl py-3 text-xs font-bold border border-[#5f2222] bg-[#241313] text-[#fca5a5]"
          >
            Leave
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
