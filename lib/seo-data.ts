/**
 * SEO Content & Schema Data for Hanzi Beat
 * Tối ưu từ khóa tìm kiếm: Hanzi, Hanzii, Học tiếng Trung, Khóa học tiếng Trung, Tiếng Trung sơ cấp,
 * Cách học tiếng Trung nhanh, Phương pháp học từ vựng tiếng Trung nhớ lâu...
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SeoFeature {
  icon: string;
  title: string;
  description: string;
}

export interface SeoTagGroup {
  category: string;
  tags: string[];
}

export const SEO_FEATURES: SeoFeature[] = [
  {
    icon: '🎵',
    title: 'Phản Xạ Nhịp Điệu (Rhythm Quiz)',
    description:
      'Học từ vựng HSK 1 đến HSK 4 qua nhịp điệu âm nhạc sôi động. Phản xạ chọn mặt chữ Hán (Hanzi), nghĩa tiếng Việt và bính âm (Pinyin) trong 8s – 16s ép não bộ kích hoạt trí nhớ ngắn hạn thành dài hạn.',
  },
  {
    icon: '⌨️',
    title: 'Chiến Trận Đánh Máy (Typing Battle)',
    description:
      'Rèn luyện tốc độ gõ Pinyin, thanh điệu số (tone numbers) và thanh điệu có dấu chuẩn xác. Cơ chế đối chiếu ngữ nghĩa thông minh, hỗ trợ đa tầng nghĩa giúp bạn nhập đáp án linh hoạt mà không bị gò bó.',
  },
  {
    icon: '🏝️',
    title: 'Tiên Đảo & Xây Dựng Thành Trì 2.5D',
    description:
      'Mỗi từ vựng bạn làm chủ sẽ chuyển hóa thành gỗ, mực và tài nguyên để xây dựng Tiên Đảo, kích hoạt Hộ Thành Phù, trang trí phong cảnh tiên hiệp và giao lưu so tài cùng bạn bè.',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Hanzi Beat có hoàn toàn miễn phí không?',
    answer:
      'Có! Bạn có thể học toàn bộ kho từ vựng HSK 1, 2, 3, 4, kho thành ngữ thông dụng và tham gia thi đấu đối kháng PvP hoàn toàn miễn phí trên mọi thiết bị.',
  },
  {
    question: 'Tôi có thể chơi Hanzi Beat trên điện thoại được không?',
    answer:
      'Hanzi Beat được tối ưu mượt mà 100% trên cả iPhone (iOS Safari), điện thoại Android (Chrome) và máy tính thông qua trình duyệt web mà không cần tải hoặc cài đặt bất kỳ ứng dụng nào.',
  },
  {
    question: 'Hanzi Beat hỗ trợ những cấp độ từ vựng tiếng Trung nào?',
    answer:
      'Hệ thống hiện tích hợp hơn 1.700+ từ vựng chuẩn HSK 1, HSK 2, HSK 3, HSK 4, kèm theo cụm từ ghép cố định (collocations) và câu ví dụ ngữ cảnh thực tế, liên tục được mở rộng cho các cấp độ nâng cao.',
  },
  {
    question: 'Tại sao học chữ Hán qua Hanzi Beat lại nhớ lâu hơn 300%?',
    answer:
      'Sự kết hợp giữa nhịp điệu âm nhạc và áp lực phản xạ thời gian thực kích thích đồng thời thị giác, thính giác và vận động ngón tay. Kết hợp thuật toán lặp lại ngắt quãng (Spaced Repetition) và cơ chế thưởng phạt Gamification giúp chuyển hóa từ vựng vào trí nhớ dài hạn sâu sắc hơn 300% so với phương pháp chép tay truyền thống.',
  },
  {
    question: 'Người mới bắt đầu tự học tiếng Trung sơ cấp nên học theo phương pháp nào để nhớ từ vựng lâu nhất?',
    answer:
      'Đối với người học tiếng Trung sơ cấp và người mới bắt đầu, phương pháp học từ vựng tiếng Trung nhớ lâu hiệu quả nhất là kết hợp 3 bước: (1) Nắm chắc quy tắc bộ thủ để nhớ mặt chữ Hán (Hanzi), (2) Rèn luyện phản xạ gõ bính âm Pinyin trên bàn phím để kích hoạt trí nhớ vận động, và (3) Ứng dụng phương pháp lặp lại ngắt quãng (Spaced Repetition) cùng game nhịp điệu trên Hanzi Beat để não bộ ghi nhớ tự nhiên, không áp lực.',
  },
  {
    question: 'Chế độ Đấu Trường PvP và Xây Đảo Tiên hoạt động như thế nào?',
    answer:
      'Bạn có thể tạo phòng so tài gõ Hán tự trực tiếp theo thời gian thực với bạn bè qua mã phòng 6 số. Mỗi trận thắng và chuỗi ngày học chuyên cần giúp thu thập Gỗ, Mực và Mảnh Ngọc để nâng cấp Tiên Đảo 2.5D và thăng hạng từ Đồng lên Chiến Thần.',
  },
];

export const SEO_LEARNING_METHOD = {
  heading: 'Phương Pháp Học Tiếng Trung Đột Phá Bằng Trò Chơi (Gamification)',
  paragraphs: [
    'Bạn đang tìm cách học tiếng Trung nhanh và phương pháp học từ vựng tiếng Trung nhớ lâu thay vì ngồi học thuộc lòng bảng từ vựng khô khan? Hanzi Beat biến toàn bộ lộ trình khóa học tiếng Trung sơ cấp và luyện thi HSK thành một sàn diễn âm nhạc đầy năng lượng. Người học tương tác trực tiếp với các nốt nhạc mang hình hài Hán tự (Hanzi), luyện phản xạ gõ bính âm Pinyin tốc độ cao và thấu hiểu ngữ nghĩa chỉ trong tích tắc.',
    'Hệ thống áp dụng thuật toán lặp lại ngắt quãng (Spaced Repetition System - SRS) tự động ưu tiên đưa các từ vựng bạn hay nhầm lẫn vào những lượt chơi tiếp theo, đồng thời củng cố từ đã thuộc vào đúng thời điểm vàng trước khi não bộ bắt đầu quên. Dù bạn là người tự học tiếng Trung tại nhà hay học viên các lớp tiếng Trung sơ cấp, Hanzi Beat giúp bạn làm chủ trọn vẹn 4 kỹ năng: Nhìn mặt chữ Hán - Nhận diện Pinyin - Hiểu chuẩn nghĩa - Gõ phím thần tốc.',
  ],
};

export const SEO_TAG_GROUPS: SeoTagGroup[] = [
  {
    category: 'Phương pháp & Tốc độ',
    tags: [
      '#CáchHọcTiếngTrungNhanh',
      '#PhươngPhápHọcTừVựngTiếngTrungNhớLâu',
      '#HọcTiếngTrungNhớLâu',
      '#PhươngPhápHọcTiếngTrung',
      '#SpacedRepetitionTiếngTrung',
      '#MẹoNhớChữHán',
    ],
  },
  {
    category: 'Khóa học & Lộ trình',
    tags: [
      '#HọcTiếngTrung',
      '#KhóaHọcTiếngTrung',
      '#TiếngTrungSơCấp',
      '#TiếngTrungChoNgườiMớiBắtĐầu',
      '#TựHọcTiếngTrungTạiNhà',
      '#HọcTiếngTrungMiễnPhí',
    ],
  },
  {
    category: 'Luyện gõ & Từ vựng Hán tự',
    tags: [
      '#Hanzi',
      '#Hanzii',
      '#LuyệnGõPinyin',
      '#LuyệnGõTiếngTrung',
      '#TừVựngHSK1',
      '#TừVựngHSK2',
      '#TừVựngHSK3',
      '#TừVựngHSK4',
    ],
  },
  {
    category: 'Đấu trường & Game hóa',
    tags: [
      '#HanziBeat',
      '#GameHọcTiếngTrung',
      '#RhythmGameTiếngTrung',
      '#PvpTiếngTrung',
      '#TiênĐảoHánTự',
    ],
  },
];

/**
 * Danh sách từ khóa SEO toàn diện
 */
export const SEO_KEYWORDS: string[] = [
  'Hanzi',
  'Hanzii',
  'học tiếng trung',
  'khóa học tiếng trung',
  'tiếng trung sơ cấp',
  'cách học tiếng trung nhanh',
  'phương pháp học từ vựng tiếng trung nhớ lâu',
  'học tiếng trung nhớ lâu',
  'phương pháp học tiếng trung',
  'hanzi beat',
  'hanzii dict',
  'từ điển hanzii',
  'học hán tự hanzi',
  'chữ hán hanzi',
  'cách nhớ chữ hán siêu tốc',
  'mẹo nhớ chữ hán',
  'luyện nhớ mặt chữ hán',
  'spaced repetition tiếng trung',
  'học tiếng trung qua hình ảnh',
  'bộ thủ tiếng trung',
  'chiết tự chữ hán',
  'tiếng trung cho người mới bắt đầu',
  'tự học tiếng trung tại nhà',
  'lộ trình tự học tiếng trung',
  'tiếng trung giao tiếp cơ bản',
  'học tiếng trung online',
  'học tiếng trung miễn phí',
  'app học tiếng trung',
  'web học tiếng trung',
  'luyện gõ tiếng trung',
  'luyện gõ pinyin',
  'luyện đánh máy chữ hán',
  'gõ tiếng trung trên máy tính',
  'bàn phím tiếng trung',
  'typing test tiếng trung',
  'game luyện gõ bính âm',
  'học từ vựng HSK',
  'hsk 1',
  'hsk 2',
  'hsk 3',
  'hsk 4',
  'luyện thi hsk online',
  'đề thi hsk',
  'ngữ pháp tiếng trung sơ cấp',
  'game học tiếng Trung',
  'game nhịp điệu tiếng Trung',
  'rhythm game tiếng Trung',
  'pvp tiếng Trung',
  'đấu từ vựng tiếng trung',
  'tiên đảo hán tự',
  'learn chinese game',
  'chinese typing game',
  'pinyin typing practice',
  'hsk vocabulary game',
];

/**
 * Sinh Schema FAQPage cho Google Rich Snippets
 */
export function generateFaqSchema() {
  return {
    '@type': 'FAQPage',
    '@id': 'https://hanzibeat.online/#faq',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
