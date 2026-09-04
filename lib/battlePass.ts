export type PassReward = {
  type: 'jade' | 'crystals' | 'xp' | 'item' | 'cosmetic' | 'collectible';
  name: string;
  amount?: number;
  id?: string;
  icon: string;
};

const freeSpecial: Record<number, PassReward> = {
  1: { type: 'cosmetic', id: 'avatar-apprentice-s1', name: 'Avatar Học Đồ', icon: '🧑‍🎓' },
  5: { type: 'item', id: 'protect-charm', amount: 1, name: 'Hộ Thân Phù ×1', icon: '🛡️' },
  10: { type: 'cosmetic', id: 'avatar-scholar-s1', name: 'Avatar Học Giả', icon: '👨‍🏫' },
  15: { type: 'item', id: 'enlightenment-pill', amount: 1, name: 'Khai Khiếu Đan ×1', icon: '📜' },
  20: { type: 'cosmetic', id: 'music-bamboo-s1', name: 'Nhạc Khúc Trúc Lâm', icon: '🎵' },
  25: { type: 'cosmetic', id: 'frame-cloud-s1', name: 'Khung Thanh Vân', icon: '☁️' },
  30: { type: 'item', id: 'diamond-guard', amount: 1, name: 'Kim Cương Tráo ×1', icon: '💠' },
  35: { type: 'cosmetic', id: 'seal-cloud-s1', name: 'Ấn Thanh Vân', icon: '🪭' },
  40: { type: 'item', id: 'revenge-order', amount: 1, name: 'Ân Oán Lệnh ×1', icon: '⚔️' },
  45: { type: 'cosmetic', id: 'title-cloud-scholar-s1', name: 'Danh hiệu Thanh Vân Học Sĩ', icon: '🏷️' },
  50: { type: 'cosmetic', id: 'seal-mythic-cloud-s1', name: 'Ấn Thanh Vân · Mythic', icon: '🌫️' },
};

const premiumSpecial: Record<number, PassReward> = {
  1: { type: 'cosmetic', id: 'avatar-longmai-s1', name: 'Avatar Long Mạch', icon: '🐲' },
  2: { type: 'cosmetic', id: 'avatar-swordsman-s1', name: 'Avatar Kiếm Khách', icon: '⚔️' },
  6: { type: 'cosmetic', id: 'music-moon-s1', name: 'Nhạc Nguyệt Hạ Trường An', icon: '🎶' },
  10: { type: 'cosmetic', id: 'effect-leaves-s1', name: 'Hiệu ứng Lá Rơi', icon: '🍂' },
  12: { type: 'cosmetic', id: 'avatar-taoist-s1', name: 'Avatar Đạo Sĩ', icon: '🧙' },
  16: { type: 'cosmetic', id: 'seal-jade-s1', name: 'Ấn Ngọc', icon: '🔰' },
  18: { type: 'cosmetic', id: 'title-longmai-s1', name: 'Danh hiệu Long Mạch Sứ Giả', icon: '🏷️' },
  22: { type: 'cosmetic', id: 'avatar-musician-s1', name: 'Avatar Nhạc Sư', icon: '🪕' },
  25: { type: 'cosmetic', id: 'effect-ice-s1', name: 'Hiệu ứng Băng Tinh', icon: '❄️' },
  30: { type: 'cosmetic', id: 'music-dragon-s1', name: 'Nhạc Long Ngâm', icon: '🎼' },
  36: { type: 'cosmetic', id: 'avatar-phoenix-s1', name: 'Avatar Phượng Sư', icon: '🦚' },
  40: { type: 'cosmetic', id: 'frame-longmai-s1', name: 'Khung Long Mạch', icon: '🐉' },
  44: { type: 'cosmetic', id: 'seal-gold-s1', name: 'Ấn Hoàng Kim', icon: '👑' },
  46: { type: 'cosmetic', id: 'avatar-dragon-s1', name: 'Avatar Long Thần', icon: '🐉' },
  49: { type: 'cosmetic', id: 'effect-dragon-aura-s1', name: 'Hiệu ứng Long Uy', icon: '🔥' },
  50: { type: 'cosmetic', id: 'relic-azure-dragon-s1', name: 'Ngọc Bội Thanh Long · Mythic', icon: '💚' },
};

const crystalTiers = new Set([4, 8, 14, 20, 28, 34, 42, 48]);

export const BATTLE_PASS_TIERS = Array.from({ length: 50 }, (_, index) => {
  const tier = index + 1;
  const free = freeSpecial[tier] ?? { type: 'jade' as const, amount: 13, name: '13 Mảnh Ngọc', icon: '💎' };
  const premium = premiumSpecial[tier] ?? (crystalTiers.has(tier)
    ? { type: 'crystals' as const, amount: 10, name: '10 Linh Thạch', icon: '🔮' }
    : { type: 'collectible' as const, id: 'longmai-medal-s1', amount: 1, name: 'Huy Chương Long Mạch', icon: '🏅' });
  return { tier, xpReq: tier * 100, free, premium };
});

