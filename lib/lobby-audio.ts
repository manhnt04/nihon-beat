export type LobbyAudioTrack = {
  id: string;
  name: string;
  hanzi: string;
  artist: string;
  src: string;
  unlockLabel: string;
  source: 'free' | 'gamepass' | 'achievement' | 'event' | 'shop';
};

export const lobbyAudioTracks: LobbyAudioTrack[] = [
  {
    id: 'sword-immortal-legend',
    name: 'Kiếm Tiên Kỳ Hiệp',
    hanzi: '剑仙奇侠',
    artist: 'Nhạc sảnh Hanzi Beat',
    src: '/music/lobby/sword-immortal-legend.mp3',
    unlockLabel: 'Miễn phí cho mọi người chơi',
    source: 'free',
  },
  {
    id: 'moonlit-changan',
    name: 'Nguyệt Hạ Trường An',
    hanzi: '月下长安',
    artist: 'Nhạc sảnh Hanzi Beat',
    src: '/music/lobby/moonlit-changan.mp3',
    unlockLabel: 'Phần thưởng Game Pass',
    source: 'gamepass',
  },
  {
    id: 'bamboo-grove',
    name: 'Thanh Âm Trúc Lâm',
    hanzi: '竹林清音',
    artist: 'Nhạc sảnh Hanzi Beat',
    src: '/music/lobby/bamboo-grove.mp3',
    unlockLabel: 'Phần thưởng Game Pass',
    source: 'gamepass',
  },
  {
    id: 'dragon-nine-heavens',
    name: 'Long Ngâm Cửu Tiêu',
    hanzi: '龙吟九霄',
    artist: 'Nhạc sảnh Hanzi Beat',
    src: '/music/lobby/dragon-nine-heavens.mp3',
    unlockLabel: 'Phần thưởng Game Pass',
    source: 'gamepass',
  },
];

export const FREE_LOBBY_TRACK_IDS = lobbyAudioTracks.filter((track) => track.source === 'free').map((track) => track.id);
export const DEFAULT_LOBBY_TRACK_ID = 'sword-immortal-legend';
