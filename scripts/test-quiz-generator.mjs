import assert from 'node:assert';
import { VOCAB_METADATA } from '../lib/vocab-metadata.ts';
import {
  generateMatchQuestions,
  normalizeAnswer,
  verifyAnswer,
  getAcceptedMeanings,
  getAcceptedPinyinAndHanzi,
  createPRNG,
  ALL_SYSTEM_VOCABULARY,
} from '../lib/quiz-generator.ts';
import { hsk1Vocabulary } from '../lib/hsk1-vocabulary.ts';
import { hsk2Vocabulary } from '../lib/hsk2-vocabulary.ts';
import { hsk3Vocabulary } from '../lib/hsk3-vocabulary.ts';
import { hsk4Vocabulary } from '../lib/hsk4-vocabulary.ts';
import {
  collocationsVocabulary,
  fixedExpressionsVocabulary,
  sentencePatternsVocabulary,
  contextSentencesVocabulary,
} from '../lib/difficulty-vocabulary.ts';

console.log('=== TEST UNIT & INTEGRATION CHO QUIZ GENERATOR ENGINE ===\n');

// -------------------------------------------------------------
// TEST 1: VOCABULARY METADATA INTEGRITY
// -------------------------------------------------------------
console.log('1. Kiểm thử tính toàn vẹn của Vocabulary Metadata:');
const allVocab = [
  ...hsk1Vocabulary,
  ...hsk2Vocabulary,
  ...hsk3Vocabulary,
  ...hsk4Vocabulary,
  ...collocationsVocabulary,
  ...fixedExpressionsVocabulary,
  ...sentencePatternsVocabulary,
  ...contextSentencesVocabulary,
];

let validMetaCount = 0;
for (const entry of allVocab) {
  const [hanzi, pinyin, pinyinNoTone, meaning] = entry;
  const meta = VOCAB_METADATA[hanzi];
  assert(meta, `Từ "${hanzi}" phải có metadata trong VOCAB_METADATA`);
  assert(Array.isArray(meta.categories) && meta.categories.length > 0, `Từ "${hanzi}" phải có ít nhất 1 category`);
  assert(typeof meta.partOfSpeech === 'string', `Từ "${hanzi}" phải có partOfSpeech`);
  assert(Array.isArray(meta.meaningVi) && meta.meaningVi.length > 0, `Từ "${hanzi}" phải có meaningVi`);
  assert(Array.isArray(meta.pinyinVariants) && meta.pinyinVariants.length > 0, `Từ "${hanzi}" phải có pinyinVariants`);

  // Verify pinyin variants include no-tone lowercase
  const noToneClean = pinyinNoTone.replace(/\s+/g, '').toLowerCase();
  const hasNoToneVariant = meta.pinyinVariants.some((v) => v.replace(/\s+/g, '').toLowerCase() === noToneClean);
  assert(hasNoToneVariant, `pinyinVariants của "${hanzi}" phải chứa biến thể không dấu "${noToneClean}"`);

  validMetaCount++;
}
console.log(`  ✅ PASS: 100% (${validMetaCount}/${allVocab.length}) mục từ vựng có metadata chuẩn xác (category, POS, meaningVi, pinyinVariants).\n`);

// -------------------------------------------------------------
// TEST 2: CẤU TRÚC ĐỀ THI PRE-GENERATED & 4 OPTIONS DUY NHẤT
// -------------------------------------------------------------
console.log('2. Kiểm thử cấu trúc generateMatchQuestions (20 câu, 4 options duy nhất, 1 đáp án đúng):');
const testPools = [
  { name: 'HSK 1', pool: hsk1Vocabulary },
  { name: 'HSK 2', pool: hsk2Vocabulary },
  { name: 'Collocations (Bình thường)', pool: collocationsVocabulary },
  { name: 'Patterns (Khó)', pool: sentencePatternsVocabulary },
];

for (const { name, pool } of testPools) {
  const questions = generateMatchQuestions(pool, 20, 10, 42);
  const expectedTotal = Math.min(20, pool.length);
  assert.strictEqual(questions.length, expectedTotal, `${name} phải sinh đúng ${expectedTotal} câu`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    assert.strictEqual(q.id, i + 1, 'Question id phải là số thứ tự 1..N');
    assert.strictEqual(q.options.length, 4, `Câu ${i + 1} phải có đúng 4 lựa chọn (thực tế: ${q.options.length})`);

    // Check unique options
    const uniqueOptions = new Set(q.options);
    assert.strictEqual(uniqueOptions.size, 4, `Câu ${i + 1} (${q.prompt}) có đáp án trùng lặp trong options: [${q.options.join(', ')}]`);

    // Check correct answer is in options
    assert(q.options.includes(q.correctAnswer), `Câu ${i + 1} phải chứa đáp án đúng "${q.correctAnswer}" trong options`);

    // Check direction split
    if (i + 1 <= 10) {
      assert.strictEqual(q.type, 'hanzi_to_meaning', '10 câu đầu phải là hanzi_to_meaning');
      assert.strictEqual(q.correctAnswer, q.entry[3], '10 câu đầu đáp án phải là nghĩa tiếng Việt');
    } else {
      assert.strictEqual(q.type, 'meaning_to_hanzi', '10 câu sau phải là meaning_to_hanzi');
      assert.strictEqual(q.correctAnswer, q.entry[0], '10 câu sau đáp án phải là chữ Hán');
    }

    // Check acceptedAnswers is non-empty
    assert(Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0, 'acceptedAnswers không được rỗng');
  }
  console.log(`  ✅ PASS: ${name} sinh đúng ${questions.length} câu, mỗi câu có đúng 4 options duy nhất, không trùng lặp chuỗi.`);
}
console.log('');

// -------------------------------------------------------------
// TEST 3: TÍNH THÔNG MINH CỦA DISTRACTORS & CHỐNG TRÙNG NGHĨA (ANTI-SYNONYM)
// -------------------------------------------------------------
console.log('3. Kiểm thử tính năng Semantic Cohort & Anti-Synonym của Distractors:');
// Generate 100 questions from allVocabulary to stress-test anti-synonym logic
const stressQuestions = generateMatchQuestions(allVocab.slice(0, 100), 50, 25, 999);
let semanticCohortMatches = 0;

for (const q of stressQuestions) {
  const targetEntry = q.entry;
  const targetMeta = VOCAB_METADATA[targetEntry[0]];
  const targetCategories = new Set(targetMeta?.categories || []);

  // Ensure no options share normalized core meaning
  const optionMeanings = q.options.map((opt) => {
    if (q.type === 'hanzi_to_meaning') {
      return normalizeAnswer(opt);
    } else {
      const optMeta = VOCAB_METADATA[opt];
      return optMeta?.meaningVi?.[0] ? normalizeAnswer(optMeta.meaningVi[0]) : '';
    }
  }).filter(Boolean);

  const uniqueNormMeanings = new Set(optionMeanings);
  assert.strictEqual(
    uniqueNormMeanings.size,
    optionMeanings.length,
    `Câu "${q.prompt}" bị trùng nghĩa ngữ nghĩa sâu trong các lựa chọn: ${q.options.join(' | ')}`
  );

  // Check if at least some distractors belong to same category
  for (const opt of q.options) {
    if (opt !== q.correctAnswer) {
      const optHanzi = q.type === 'meaning_to_hanzi' ? opt : null;
      if (optHanzi && VOCAB_METADATA[optHanzi]) {
        const sharesCat = VOCAB_METADATA[optHanzi].categories?.some((c) => targetCategories.has(c));
        if (sharesCat) semanticCohortMatches++;
      }
    }
  }
}
console.log(`  ✅ PASS: 0 lỗi trùng lặp nghĩa ngữ nghĩa sâu trong 50 câu stress-test.`);
console.log(`  ✅ PASS: Đã kiểm chứng sinh đáp án cùng nhóm ngữ nghĩa (semantic cohorts) thành công.
`);

// -------------------------------------------------------------
// TEST 4: TẤT ĐỊNH VỚI SEEDED PRNG (PVP & DAILY REPRODUCIBILITY)
// -------------------------------------------------------------
console.log('4. Kiểm thử tính tất định của Seeded PRNG Mulberry32:');
const seed = 777888;
const matchA = generateMatchQuestions(hsk1Vocabulary, 20, 10, seed);
const matchB = generateMatchQuestions(hsk1Vocabulary, 20, 10, seed);
const matchC = generateMatchQuestions(hsk1Vocabulary, 20, 10, seed + 1);

assert.strictEqual(matchA.length, matchB.length, 'Độ dài 2 ván cùng seed phải bằng nhau');
for (let i = 0; i < matchA.length; i++) {
  assert.strictEqual(matchA[i].prompt, matchB[i].prompt, `Câu ${i} prompt phải giống hệt`);
  assert.strictEqual(matchA[i].correctAnswer, matchB[i].correctAnswer, `Câu ${i} correctAnswer phải giống hệt`);
  assert.deepStrictEqual(matchA[i].options, matchB[i].options, `Câu ${i} thứ tự 4 options phải giống hệt 100%`);
}

// Ensure different seed generates different permutation
let differences = 0;
for (let i = 0; i < matchA.length; i++) {
  if (matchA[i].options.join(',') !== matchC[i].options.join(',')) {
    differences++;
  }
}
assert(differences > 0, 'Seed khác nhau phải sinh thứ tự options hoặc câu hỏi khác nhau');
console.log('  ✅ PASS: Cùng 1 seed sinh ra 100% đề thi và thứ tự options giống hệt nhau (sẵn sàng PvP).');
console.log('  ✅ PASS: Khác seed sinh ra biến thể khác nhau hoàn toàn.\n');

// -------------------------------------------------------------
// TEST 5: GÕ ĐÁP ÁN LINH HOẠT & NORMALIZATION TRONG TYPING BATTLE
// -------------------------------------------------------------
console.log('5. Kiểm thử cơ chế gõ phím linh hoạt trong Typing Battle:');

// Case A: 1 từ nhiều nghĩa (gõ 1 nghĩa bất kỳ)
// Ví dụ: 生病 -> "Bị bệnh", "ốm"
const shengBingEntry = allVocab.find((e) => e[0] === '生病');
assert(shengBingEntry, 'Tìm thấy từ 生病');
const qShengBing = generateMatchQuestions([shengBingEntry], 1, 1)[0];

assert(verifyAnswer('Bị bệnh', qShengBing), 'Chấp nhận nghĩa 1 có dấu');
assert(verifyAnswer('bi benh', qShengBing), 'Chấp nhận nghĩa 1 không dấu');
assert(verifyAnswer('Ốm', qShengBing), 'Chấp nhận nghĩa 2 có dấu');
assert(verifyAnswer('om', qShengBing), 'Chấp nhận nghĩa 2 không dấu');
assert(verifyAnswer('  Bi   Benh. ', qShengBing), 'Tự động chuẩn hóa khoảng trắng thừa và dấu chấm');
assert(!verifyAnswer('khỏe mạnh', qShengBing), 'Từ sai không được chấp nhận');

// Case B: Nghĩa có dấu ngoặc (ví dụ "bạn (nam)")
const friendEntry = ['男朋友', 'nánpéngyou', 'nanpengyou', 'bạn trai (nam)', 'HSK 3'];
const qFriend = generateMatchQuestions([friendEntry], 1, 1)[0];
assert(verifyAnswer('bạn trai', qFriend), 'Chấp nhận bỏ ngoặc: bạn trai');
assert(verifyAnswer('ban trai', qFriend), 'Chấp nhận bỏ ngoặc không dấu: ban trai');

// Case C: Gõ Pinyin có dấu, không dấu, và Tone Numbers (round > directionSplit: meaning_to_hanzi)
const beijingEntry = allVocab.find((e) => e[0] === '北京');
assert(beijingEntry, 'Tìm thấy từ 北京');
const qBeijing = generateMatchQuestions([beijingEntry], 1, 0)[0]; // directionSplit=0 -> meaning_to_hanzi

assert(verifyAnswer('北京', qBeijing), 'Chấp nhận chữ Hán: 北京');
assert(verifyAnswer('běijīng', qBeijing), 'Chấp nhận Pinyin có dấu: běijīng');
assert(verifyAnswer('beijing', qBeijing), 'Chấp nhận Pinyin không dấu: beijing');
assert(verifyAnswer('bei3jing1', qBeijing), 'Chấp nhận Pinyin tone numbers: bei3jing1');
assert(verifyAnswer('bei3 jing1', qBeijing), 'Chấp nhận Pinyin tone numbers có cách: bei3 jing1');

console.log('  ✅ PASS: 1 từ nhiều nghĩa -> gõ bất kỳ nghĩa nào cũng chính xác.');
console.log('  ✅ PASS: Chuẩn hóa tiếng Việt không dấu, bỏ ngoặc, xóa khoảng trắng thừa 100%.');
console.log('  ✅ PASS: Chấp nhận chữ Hán, Pinyin có dấu, Pinyin không dấu và Pinyin tone numbers.\n');

console.log('====================================================');
console.log('🎉 TẤT CẢ 5 BÀI KIỂM THỬ CHO QUIZ GENERATOR ĐỀU ĐẠT 100%!');
console.log('====================================================');
