import assert from 'node:assert';
import { FAQ_ITEMS, SEO_FEATURES, SEO_LEARNING_METHOD, generateFaqSchema } from '../lib/seo-data.ts';

console.log('=== TEST SEO METADATA & SCHEMA FAQPAGE ===\n');

console.log('1. Kiểm tra danh sách FAQ (Câu hỏi thường gặp):');
assert(FAQ_ITEMS.length >= 5, 'Phải có ít nhất 5 câu hỏi FAQ');
for (const item of FAQ_ITEMS) {
  assert(item.question && item.question.trim().length > 10, 'Câu hỏi FAQ phải có độ dài hợp lệ');
  assert(item.answer && item.answer.trim().length > 20, 'Câu trả lời FAQ phải có độ dài hợp lệ');
  assert(item.question.endsWith('?'), 'Câu hỏi FAQ phải kết thúc bằng dấu ?');
}
console.log(`  ✓ Đã kiểm tra ${FAQ_ITEMS.length} câu hỏi FAQ chuẩn SEO, không rỗng và kết thúc bằng dấu ?`);

console.log('\n2. Kiểm tra các trụ cột tính năng SEO:');
assert.strictEqual(SEO_FEATURES.length, 3, 'Phải có đúng 3 tính năng trụ cột');
for (const feat of SEO_FEATURES) {
  assert(feat.icon, 'Tính năng phải có icon');
  assert(feat.title.length > 5, 'Tiêu đề tính năng phải rõ ràng');
  assert(feat.description.length > 20, 'Mô tả tính năng phải chi tiết');
}
console.log(`  ✓ Đã kiểm tra 3 tính năng trụ cột (Rhythm Quiz, Typing Battle, Tiên Đảo 2.5D)`);

console.log('\n3. Kiểm tra nội dung phương pháp học tập Spaced Repetition:');
assert(SEO_LEARNING_METHOD.heading.length > 10, 'Tiêu đề phương pháp phải rõ ràng');
assert(SEO_LEARNING_METHOD.paragraphs.length >= 2, 'Phải có ít nhất 2 đoạn văn phân tích');
for (const p of SEO_LEARNING_METHOD.paragraphs) {
  assert(p.length > 50, 'Đoạn văn phải đầy đủ ngữ nghĩa');
}
console.log(`  ✓ Đã kiểm tra nội dung phương pháp Spaced Repetition & Gamification`);

console.log('\n4. Kiểm tra sinh Schema FAQPage cho JSON-LD:');
const schema = generateFaqSchema();
assert.strictEqual(schema['@type'], 'FAQPage', 'Schema @type phải là FAQPage');
assert.strictEqual(schema['@id'], 'https://hanzibeat.online/#faq', 'Schema @id phải chuẩn');
assert(Array.isArray(schema.mainEntity), 'mainEntity phải là mảng');
assert.strictEqual(schema.mainEntity.length, FAQ_ITEMS.length, 'Số câu hỏi trong Schema phải khớp với UI');

for (let i = 0; i < schema.mainEntity.length; i++) {
  const entity = schema.mainEntity[i];
  assert.strictEqual(entity['@type'], 'Question', 'Mỗi item phải có @type là Question');
  assert.strictEqual(entity.name, FAQ_ITEMS[i].question, 'Tiêu đề câu hỏi trong Schema phải khớp');
  assert.strictEqual(entity.acceptedAnswer['@type'], 'Answer', 'acceptedAnswer phải có @type là Answer');
  assert.strictEqual(entity.acceptedAnswer.text, FAQ_ITEMS[i].answer, 'Nội dung câu trả lời trong Schema phải khớp');
}
console.log(`  ✓ Schema FAQPage sinh ra hoàn toàn hợp lệ và khớp 100% với nội dung UI`);

console.log('\n5. Kiểm tra bộ Icon và Favicon chuẩn Google Search:');
import fs from 'node:fs';
import path from 'node:path';
const requiredIcons = [
  { file: 'public/favicon.ico', minSize: 1000, desc: 'Favicon đa kích thước' },
  { file: 'public/favicon-48x48.png', minSize: 500, desc: 'Favicon 48x48 chuẩn Googlebot' },
  { file: 'public/apple-touch-icon.png', minSize: 5000, desc: 'Apple Touch Icon 180x180' },
  { file: 'public/icon.png', minSize: 5000, desc: 'Web App Icon 192x192' },
  { file: 'public/icon-512.png', minSize: 10000, desc: 'PWA Icon 512x512' },
  { file: 'public/favicon.svg', minSize: 300, desc: 'Vector SVG Favicon' },
];

for (const icon of requiredIcons) {
  const fullPath = path.join(process.cwd(), icon.file);
  assert(fs.existsSync(fullPath), `Tệp ${icon.file} (${icon.desc}) phải tồn tại`);
  const stat = fs.statSync(fullPath);
  assert(stat.size >= icon.minSize, `Tệp ${icon.file} dung lượng ${stat.size}B phải >= ${icon.minSize}B`);
  assert(stat.size < 500000, `Tệp ${icon.file} không được quá nặng (< 500KB)`);
}

const svgContent = fs.readFileSync(path.join(process.cwd(), 'public/favicon.svg'), 'utf8');
assert(svgContent.includes('汉'), 'favicon.svg phải chứa Hán tự đại diện cho Hanzi Beat');
console.log(`  ✓ Toàn bộ ${requiredIcons.length} tệp Icon & Favicon chuẩn Google Search đã được xác minh`);

console.log('\n>>> TẤT CẢ CÁC BÀI TEST SEO METADATA, ICONS & SCHEMA ĐÃ ĐẠT 100% PASS! <<<\n');
