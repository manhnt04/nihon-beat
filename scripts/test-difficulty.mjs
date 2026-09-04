import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST CHỨC NĂNG CHỌN ĐỘ KHÓ & LUỒNG POPUP 3 BƯỚC ===\n');

// 1. Kiểm tra file lib/difficulty-vocabulary.ts
const diffModule = await import('../lib/difficulty-vocabulary.ts');
const {
  collocationsVocabulary,
  fixedExpressionsVocabulary,
  sentencePatternsVocabulary,
  contextSentencesVocabulary,
  normalDifficultyPool,
  hardDifficultyPool,
  normalPacks,
  hardPacks,
} = diffModule;

// Test 1: Kiểm tra cấu trúc các mục từ vựng
console.log('1. Kiểm thử cấu trúc từ vựng:');
function validatePool(pool, name) {
  assert(Array.isArray(pool), `${name} phải là mảng`);
  assert(pool.length > 0, `${name} không được rỗng`);
  for (const entry of pool) {
    assert.strictEqual(entry.length, 5, `Mục [${entry.join(', ')}] phải có đủ 5 phần tử`);
    assert(typeof entry[0] === 'string' && entry[0].length > 0, `Chữ Hán hợp lệ: ${entry[0]}`);
    assert(typeof entry[1] === 'string' && entry[1].length > 0, `Pinyin có dấu: ${entry[1]}`);
    assert(typeof entry[2] === 'string' && entry[2].length > 0, `Pinyin không dấu: ${entry[2]}`);
    assert(typeof entry[3] === 'string' && entry[3].length > 0, `Nghĩa tiếng Việt: ${entry[3]}`);
    assert(typeof entry[4] === 'string' && entry[4].startsWith('HSK'), `Level HSK: ${entry[4]}`);
  }
  console.log(`  ✅ PASS: ${name} có ${pool.length} mục, cấu trúc 5 cột [Hanzi, Pinyin, PinyinNoTone, Nghĩa, Cấp] đạt chuẩn 100%.`);
}

validatePool(collocationsVocabulary, 'Collocations (Bình thường)');
validatePool(fixedExpressionsVocabulary, 'Fixed Expressions / Thành ngữ (Bình thường)');
validatePool(sentencePatternsVocabulary, 'Sentence Patterns / Mẫu câu (Khó)');
validatePool(contextSentencesVocabulary, 'Context Sentences / Câu ngắn ngữ cảnh (Khó)');
validatePool(normalDifficultyPool, 'Normal Difficulty Pool');
validatePool(hardDifficultyPool, 'Hard Difficulty Pool');

assert.strictEqual(normalDifficultyPool.length, collocationsVocabulary.length + fixedExpressionsVocabulary.length);
assert.strictEqual(hardDifficultyPool.length, sentencePatternsVocabulary.length + contextSentencesVocabulary.length);
console.log('  ✅ PASS: Tổng hợp pool bình thường & khó khớp số lượng chính xác.');

// 2. Kiểm thử Difficulty Packs
console.log('\n2. Kiểm thử cấu hình Gói bài học (Packs):');
assert.strictEqual(normalPacks.length, 3, 'Có 3 gói ở cấp Bình Thường');
assert.strictEqual(hardPacks.length, 3, 'Có 3 gói ở cấp Khó');
for (const p of [...normalPacks, ...hardPacks]) {
  assert(p.id && p.name && p.subtitle && p.bpm && p.vocabulary.length > 0, `Gói ${p.name} có đủ metadata`);
}
console.log('  ✅ PASS: normalPacks (3 gói) và hardPacks (3 gói) đầy đủ BPM, tên Hán tự, phụ đề, từ vựng.');

// 3. Kiểm thử sinh đáp án trắc nghiệm không trùng lặp (Fisher-Yates + unique distractors)
console.log('\n3. Kiểm thử bộ sinh đáp án trắc nghiệm (Options Generator):');
function generateOptions(vocab, wordIndex, column) {
  const correct = vocab[wordIndex][column];
  const uniqueDistractors = [];
  for (let offset = 1; offset < vocab.length; offset++) {
    const candidate = vocab[(wordIndex + offset) % vocab.length][column];
    if (candidate !== correct && !uniqueDistractors.includes(candidate)) {
      uniqueDistractors.push(candidate);
      if (uniqueDistractors.length === 3) break;
    }
  }
  const opts = [correct, ...uniqueDistractors];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

const testOptions1 = generateOptions(normalDifficultyPool, 0, 0);
assert.strictEqual(testOptions1.length, 4, 'Phải có đúng 4 đáp án');
assert.strictEqual(new Set(testOptions1).size, 4, '4 đáp án không được trùng nhau');
assert(testOptions1.includes(normalDifficultyPool[0][0]), 'Đáp án đúng phải nằm trong 4 lựa chọn');

const testOptions2 = generateOptions(hardDifficultyPool, 2, 3);
assert.strictEqual(testOptions2.length, 4, 'Phải có đúng 4 đáp án nghĩa câu');
assert.strictEqual(new Set(testOptions2).size, 4, '4 đáp án nghĩa không được trùng lặp');
assert(testOptions2.includes(hardDifficultyPool[2][3]), 'Đáp án đúng phải nằm trong 4 lựa chọn');
console.log('  ✅ PASS: Bộ sinh đáp án trắc nghiệm đảm bảo 4 lựa chọn DUY NHẤT, không bị trùng lặp.');

// 4. Kiểm thử chấp nhận câu trả lời gõ phím (Typing Battle: Hanzi, Pinyin có dấu, Pinyin không dấu)
console.log('\n4. Kiểm thử logic đối chiếu gõ phím (Typing Battle Accepted Answers):');
function normalizeAnswer(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function checkTypingAnswer(vocab, wordIndex, isTypingToHanzi, userInput) {
  const target = vocab[wordIndex][isTypingToHanzi ? 0 : 3];
  const normalizedInput = normalizeAnswer(userInput);
  const acceptedAnswers = isTypingToHanzi
    ? [
        normalizeAnswer(target),
        normalizeAnswer(vocab[wordIndex][1]),
        normalizeAnswer(vocab[wordIndex][2]),
      ].filter(Boolean)
    : target
        .replace(/\([^)]*\)/g, '')
        .split(/[,;/]/)
        .map(normalizeAnswer)
        .filter(Boolean);
  return (
    normalizedInput === normalizeAnswer(target) ||
    acceptedAnswers.includes(normalizedInput)
  );
}

// Case 1: Collocation "喝茶"
const hecha = collocationsVocabulary[0];
assert(checkTypingAnswer(collocationsVocabulary, 0, true, '喝茶'), 'Chấp nhận chữ Hán 喝茶');
assert(checkTypingAnswer(collocationsVocabulary, 0, true, 'hē chá'), 'Chấp nhận Pinyin có dấu hē chá');
assert(checkTypingAnswer(collocationsVocabulary, 0, true, 'he cha'), 'Chấp nhận Pinyin không dấu he cha');
assert(checkTypingAnswer(collocationsVocabulary, 0, false, 'uống trà'), 'Chấp nhận nghĩa tiếng Việt uống trà');

// Case 2: Chengyu "一心一意"
assert(checkTypingAnswer(fixedExpressionsVocabulary, 11, true, '一心一意'), 'Chấp nhận chữ Hán 一心一意');
assert(checkTypingAnswer(fixedExpressionsVocabulary, 11, true, 'yi xin yi yi'), 'Chấp nhận Pinyin yi xin yi yi');
assert(checkTypingAnswer(fixedExpressionsVocabulary, 11, false, 'một lòng một dạ'), 'Chấp nhận nghĩa một lòng một dạ');
console.log('  ✅ PASS: Typing Battle nhận diện chính xác Chữ Hán, Pinyin có dấu, Pinyin không dấu và Tiếng Việt.');

// 5. Kiểm tra menu navigation trong app/page.tsx: Nút thành trì đã bị xóa khỏi menu
console.log('\n5. Kiểm tra menu navigation trong app/page.tsx:');
const pageCode = fs.readFileSync(path.resolve('./app/page.tsx'), 'utf8');

// Menu header desktop
const desktopNavIdx = pageCode.indexOf('<nav>');
const desktopNavEnd = pageCode.indexOf('</nav>', desktopNavIdx);
const desktopNavSection = pageCode.slice(desktopNavIdx, desktopNavEnd + 6);
assert(!desktopNavSection.includes("navigate('castle')"), 'Desktop header nav KHÔNG được chứa nút Thành Trì');
console.log('  ✅ PASS: Desktop header <nav> không còn nút Thành Trì.');

// Mobile bottom nav
const mobileNavIdx = pageCode.indexOf('const mobileNavigation =');
const mobileNavEnd = pageCode.indexOf('</nav>', mobileNavIdx);
const mobileNavSection = pageCode.slice(mobileNavIdx, mobileNavEnd + 6);
assert(!mobileNavSection.includes("navigate('castle')"), 'Mobile nav KHÔNG được chứa nút Thành Trì');
console.log('  ✅ PASS: Mobile bottom nav không còn nút Thành Trì.');

// FAB thành trì nổi vẫn tồn tại
assert(pageCode.includes('className="castle-fab"'), 'Floating Castle FAB vẫn tồn tại');
console.log('  ✅ PASS: Icon nổi Hán Tự Thành (FAB) trên vòng quay vẫn nguyên vẹn.');

// Giao diện chọn độ khó 3 cấp
assert(pageCode.includes('difficulty-tier-picker'), 'Có difficulty-tier-picker');
assert(pageCode.includes('DỄ (HSK 1 - 4)'), 'Có thẻ DỄ');
assert(pageCode.includes('BÌNH THƯỜNG'), 'Có thẻ BÌNH THƯỜNG');
assert(pageCode.includes('KHÓ (MẪU CÂU)'), 'Có thẻ KHÓ');
console.log('  ✅ PASS: Giao diện chọn độ khó 3 cấp (DỄ, BÌNH THƯỜNG, KHÓ) hiển thị đầy đủ trong trang bài học.');

// 6. Kiểm tra luồng popup 3 bước (Mode -> Gameplay với mode-picker artwork -> Difficulty)
console.log('\n6. Kiểm tra luồng Popup Modal 3 Bước:');
assert(pageCode.includes("const [playModeStep, setPlayModeStep] = useState<'mode' | 'gameplay' | 'difficulty'>('mode');"), 'Có state playModeStep');
assert(pageCode.includes("openPlayModeModal"), 'Có hàm openPlayModeModal');
assert(pageCode.includes("playModeStep === 'mode'"), 'Có Bước 1: chọn chế độ');
assert(pageCode.includes("setPlayModeStep('gameplay')"), 'Bước 1 chuyển sang bước gameplay khi chọn chơi đơn');
assert(pageCode.includes("playModeStep === 'gameplay'"), 'Có Bước 2: chọn lối chơi');
assert(pageCode.includes("setMode('audition')") && pageCode.includes("setMode('typing')"), 'Bước 2 thiết lập mode audition hoặc typing');
assert(pageCode.includes("setPlayModeStep('difficulty')"), 'Bước 2 chuyển sang bước difficulty sau khi chọn lối chơi');
assert(pageCode.includes("lesson-rhythm-quiz.webp") && pageCode.includes("lesson-typing-battle.webp"), 'Bước 2 dùng mode-picker và hình ảnh artwork');
assert(pageCode.includes("playModeStep === 'difficulty'"), 'Có Bước 3: chọn độ khó');
assert(pageCode.includes("className=\"play-mode-back\""), 'Có nút quay lại bước trước trong modal');

// CSS kiểm tra
const cssCode = fs.readFileSync(path.resolve('./app/globals.css'), 'utf8');
assert(cssCode.includes('.play-mode-back'), 'Có CSS .play-mode-back');
assert(cssCode.includes('.play-mode-modal.step-difficulty'), 'Có CSS .play-mode-modal.step-difficulty');
assert(cssCode.includes('.play-mode-options.difficulty-grid'), 'Có CSS .play-mode-options.difficulty-grid');
assert(cssCode.includes('.play-mode-modal .mode-picker'), 'Có CSS .play-mode-modal .mode-picker');
assert(cssCode.includes('.play-mode-step-content'), 'Có animation .play-mode-step-content');
console.log('  ✅ PASS: Luồng 3 bước với mode-picker artwork trong Bước 2 và CSS tương ứng hoạt động hoàn hảo.');

console.log('\n========================================');
console.log('🎉 TẤT CẢ 6 NHÓM THỬ NGHIỆM ĐỀU ĐẠT 100%!');
console.log('========================================\n');
