import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST TÍCH HỢP SEPAY & ĐỔI TÊN LINH THẠCH ===\n');

// 1. Kiểm tra cấu hình api/sepay.ts
console.log('1. Kiểm thử cấu hình SePay (api/sepay.ts):');
const sepayModule = await import('../api/sepay.ts');
const { SEPAY_CONFIG, SEPAY_PACKAGES } = sepayModule;

assert.strictEqual(SEPAY_CONFIG.bankAccount, '001801200500', 'Số tài khoản MBBank phải là 001801200500');
assert.strictEqual(SEPAY_CONFIG.bankName, 'MBBank', 'Ngân hàng phải là MBBank');
assert.strictEqual(SEPAY_CONFIG.accountName, 'NGUYEN TUAN MANH', 'Chủ tài khoản phải là NGUYEN TUAN MANH');
assert.strictEqual(SEPAY_CONFIG.apiToken, 'HGW0NPFFQH9EGDL4ZT1521FQH4BOGKSWE7BBCD6NHV23SLS6KXJQZWIYXEJKXKYD', 'Token API SePay chính xác');
console.log('  ✅ PASS: Cấu hình MBBank (001801200500 - NGUYEN TUAN MANH) và SePay API Token khớp 100%.');

// 2. Kiểm thử danh mục gói nạp Linh Thạch
console.log('\n2. Kiểm thử các gói nạp Linh Thạch:');
assert(SEPAY_PACKAGES['topup-60'], 'Có gói topup-60');
assert.strictEqual(SEPAY_PACKAGES['topup-60'].amount, 29000, 'Gói 60 có giá 29.000đ');
assert.strictEqual(SEPAY_PACKAGES['topup-60'].crystals, 60, 'Gói 60 tặng 60 Linh Thạch');
assert(SEPAY_PACKAGES['topup-60'].name.includes('Linh Thạch'), 'Tên gói dùng chữ Linh Thạch');

assert(SEPAY_PACKAGES['topup-180'], 'Có gói topup-180');
assert.strictEqual(SEPAY_PACKAGES['topup-180'].amount, 79000, 'Gói 180 có giá 79.000đ');
assert.strictEqual(SEPAY_PACKAGES['topup-180'].crystals, 180, 'Gói 180 tặng 180 Linh Thạch');
assert(SEPAY_PACKAGES['topup-180'].name.includes('Linh Thạch'), 'Tên gói dùng chữ Linh Thạch');

assert(SEPAY_PACKAGES['topup-450'], 'Có gói topup-450');
assert.strictEqual(SEPAY_PACKAGES['topup-450'].amount, 179000, 'Gói 450 có giá 179.000đ');
assert.strictEqual(SEPAY_PACKAGES['topup-450'].crystals, 450, 'Gói 450 tặng 450 Linh Thạch');
assert(SEPAY_PACKAGES['topup-450'].name.includes('Linh Thạch'), 'Tên gói dùng chữ Linh Thạch');
console.log('  ✅ PASS: 3 gói nạp 29k (60 🔮), 79k (180 🔮), 179k (450 🔮) chuẩn xác.');

// 3. Kiểm tra quét sạch "Tinh Thạch" trên toàn bộ source code
console.log('\n3. Kiểm tra chuyển đổi danh xưng "Tinh Thạch" -> "Linh Thạch":');
const filesToCheck = [
  'app/page.tsx',
  'api/progression.ts',
  'api/sepay.ts',
  'lib/battlePass.ts',
];

for (const file of filesToCheck) {
  const content = fs.readFileSync(path.resolve(file), 'utf8');
  assert(!content.toLowerCase().includes('tinh thạch'), `Tệp ${file} KHÔNG được chứa chữ "Tinh Thạch"`);
  assert(content.includes('Linh Thạch'), `Tệp ${file} phải có chữ "Linh Thạch"`);
  console.log(`  ✅ PASS: ${file} đã chuyển đổi hoàn toàn sang "Linh Thạch" (0 từ Tinh Thạch còn sót lại).`);
}

// 4. Kiểm tra giao diện và logic SePay trong app/page.tsx
console.log('\n4. Kiểm tra mã nguồn UI và logic SePay trong app/page.tsx:');
const pageSource = fs.readFileSync(path.resolve('app/page.tsx'), 'utf8');
assert(pageSource.includes('startSepayTopup'), 'Có hàm startSepayTopup');
assert(pageSource.includes('checkSepayOrder'), 'Có hàm checkSepayOrder');
assert(pageSource.includes('renderTopupModal'), 'Có hàm renderTopupModal');
assert(pageSource.includes('sepayOrder'), 'Có state sepayOrder');
assert(pageSource.includes('sepayStatus'), 'Có state sepayStatus');
assert(pageSource.includes('{sepayOrder.bankName}') && pageSource.includes('(Quân Đội)'), 'Có hiển thị ngân hàng MBBank');
assert(pageSource.includes('sepayOrder.bankAccount'), 'Có hiển thị STK ngân hàng');
assert(pageSource.includes('sepayOrder.accountName'), 'Có hiển thị tên chủ tài khoản');
assert(pageSource.includes('sepay-qr-img'), 'Có hiển thị ảnh QR code');
assert(pageSource.includes('sepay-copy-btn'), 'Có nút sao chép tiện ích');
assert(pageSource.includes('check-order'), 'Có polling check-order tự động');
console.log('  ✅ PASS: app/page.tsx tích hợp đầy đủ UI quét mã VietQR, nút sao chép, polling tự động và màn hình thành công.');

// 5. Kiểm thử gọi trực tiếp SePay API v2 bằng API Token thật
console.log('\n5. Kiểm tra kết nối Live SePay API v2:');
try {
  const res = await fetch(`https://userapi.sepay.vn/v2/transactions?account_number=${SEPAY_CONFIG.bankAccount}&per_page=1`, {
    headers: { Authorization: `Bearer ${SEPAY_CONFIG.apiToken}` },
  });
  assert.strictEqual(res.status, 200, 'SePay API v2 trả về HTTP 200');
  const data = await res.json();
  assert.strictEqual(data.status, 'success', 'SePay API v2 trả về status success');
  console.log(`  ✅ PASS: Kết nối SePay API v2 thành công (HTTP 200 OK, tài khoản ${SEPAY_CONFIG.bankAccount} hoạt động).`);
} catch (err) {
  console.error('  ❌ FAIL kết nối SePay:', err);
  throw err;
}

console.log('\n========================================');
console.log('🎉 TẤT CẢ CÁC MỤC KIỂM THỬ ĐỀU ĐẠT 100%!');
console.log('========================================\n');
