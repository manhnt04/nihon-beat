/**
 * SEO Content & Schema Data for Hanzi Beat
 * Giai đoạn 1: On-Page SEO & Chống "Thin Content"
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

export const SEO_FEATURES: SeoFeature[] = [
  {
    icon: '🎵',
    title: 'Phản Xạ Nhịp Điệu (Rhythm Quiz)',
    description:
      'Học từ vựng HSK 1 đến HSK 4 qua nhịp điệu âm nhạc sôi động. Phản xạ chọn mặt chữ Hán, nghĩa tiếng Việt và bính âm (Pinyin) trong 8s – 16s ép não bộ kích hoạt trí nhớ ngắn hạn thành dài hạn.',
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
    question: 'Chế độ Đấu Trường PvP và Xây Đảo Tiên hoạt động như thế nào?',
    answer:
      'Bạn có thể tạo phòng so tài gõ Hán tự trực tiếp theo thời gian thực với bạn bè qua mã phòng 6 số. Mỗi trận thắng và chuỗi ngày học chuyên cần giúp thu thập Gỗ, Mực và Mảnh Ngọc để nâng cấp Tiên Đảo 2.5D và thăng hạng từ Đồng lên Chiến Thần.',
  },
];

export const SEO_LEARNING_METHOD = {
  heading: 'Phương Pháp Học Tiếng Trung Đột Phá Bằng Trò Chơi (Gamification)',
  paragraphs: [
    'Thay vì ngồi học thuộc lòng bảng từ vựng HSK khô khan hay chép phạt hàng trăm lần mặt chữ, Hanzi Beat biến toàn bộ quá trình học Hán tự thành một sàn diễn âm nhạc đầy năng lượng. Người học tương tác trực tiếp với các nốt nhạc mang hình hài Hán tự, luyện phản xạ gõ bính âm nhanh và nhận diện ngữ nghĩa trong tích tắc.',
    'Hệ thống áp dụng thuật toán lặp lại ngắt quãng (Spaced Repetition System - SRS) tự động ưu tiên đưa các từ vựng bạn hay nhầm lẫn vào những lượt chơi tiếp theo, đồng thời củng cố từ đã thuộc vào đúng thời điểm vàng trước khi não bộ bắt đầu quên. Nhờ đó, bạn làm chủ trọn vẹn 4 kỹ năng: Nhìn mặt chữ - Nhận diện Pinyin - Hiểu chuẩn nghĩa - Gõ phím tốc độ.',
  ],
};

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
