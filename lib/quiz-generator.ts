import { VOCAB_METADATA, type WordMetadata } from './vocab-metadata.ts';
import type { VocabularyEntry } from './hsk2-vocabulary.ts';
import { hsk1Vocabulary } from './hsk1-vocabulary.ts';
import { hsk2Vocabulary } from './hsk2-vocabulary.ts';
import { hsk3Vocabulary } from './hsk3-vocabulary.ts';
import { hsk4Vocabulary } from './hsk4-vocabulary.ts';
import {
  collocationsVocabulary,
  fixedExpressionsVocabulary,
  sentencePatternsVocabulary,
  contextSentencesVocabulary,
} from './difficulty-vocabulary.ts';

// Fallback all-vocabulary pool
export const ALL_SYSTEM_VOCABULARY: VocabularyEntry[] = [
  ...hsk1Vocabulary,
  ...hsk2Vocabulary,
  ...hsk3Vocabulary,
  ...hsk4Vocabulary,
  ...collocationsVocabulary,
  ...fixedExpressionsVocabulary,
  ...sentencePatternsVocabulary,
  ...contextSentencesVocabulary,
];

export type QuestionType = 'hanzi_to_meaning' | 'meaning_to_hanzi';

export interface MatchQuestion {
  id: number;
  entry: VocabularyEntry;
  type: QuestionType;
  prompt: string;        // Text shown in big header (Hanzi or Vietnamese meaning)
  subPrompt: string;     // Pinyin or sub-label ('Từ nào có nghĩa như trên?')
  correctAnswer: string; // The primary correct choice string
  options: string[];     // Exactly 4 unique options (1 correct + 3 smart distractors)
  acceptedAnswers: string[]; // Normalized variations for typing comparison
}

/**
 * Standard text normalization for Vietnamese & Pinyin comparison.
 * - Lowercase & NFD decomposition
 * - Strips diacritics & replaces 'đ' with 'd'
 * - Strips punctuation, quotes, parens, brackets, and extra spaces
 */
export function normalizeAnswer(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[,;:.!?()[\]{}"'“”‘’/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 * Ensures 100% deterministic question ordering and distractor generation for PvP & Daily Challenge.
 */
export function createPRNG(seed?: number): () => number {
  let s = (seed !== undefined ? seed : (Date.now() ^ (Math.random() * 0x100000000))) >>> 0;
  return function mulberry32() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates array shuffle using supplied PRNG.
 */
export function shuffleArray<T>(array: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Extract all accepted Vietnamese meaning answers for typing validation.
 */
export function getAcceptedMeanings(entry: VocabularyEntry): string[] {
  const [hanzi, , , meaning] = entry;
  const meta = VOCAB_METADATA[hanzi];
  const accepted = new Set<string>();

  // Full raw meaning
  accepted.add(meaning);
  accepted.add(normalizeAnswer(meaning));

  // Remove parenthetical descriptions (e.g. "bạn (nam)" -> "bạn")
  const withoutParens = meaning.replace(/\([^)]*\)/g, '').trim();
  if (withoutParens) {
    accepted.add(withoutParens);
    accepted.add(normalizeAnswer(withoutParens));
  }

  // Split by common delimiters (comma, semicolon, slash)
  const parts = meaning.split(/[,;/]/);
  for (const part of parts) {
    const clean = part.trim();
    if (clean) {
      accepted.add(clean);
      accepted.add(normalizeAnswer(clean));
      const partWithoutParens = clean.replace(/\([^)]*\)/g, '').trim();
      if (partWithoutParens) {
        accepted.add(partWithoutParens);
        accepted.add(normalizeAnswer(partWithoutParens));
      }
    }
  }

  // From metadata meaningVi
  if (meta?.meaningVi) {
    for (const m of meta.meaningVi) {
      accepted.add(m);
      accepted.add(normalizeAnswer(m));
    }
  }

  return Array.from(accepted).filter(Boolean);
}

/**
 * Extract all accepted Hanzi & Pinyin answers for typing validation.
 */
export function getAcceptedPinyinAndHanzi(entry: VocabularyEntry): string[] {
  const [hanzi, pinyin, pinyinNoTone] = entry;
  const meta = VOCAB_METADATA[hanzi];
  const accepted = new Set<string>();

  // Hanzi
  accepted.add(hanzi);
  accepted.add(hanzi.replace(/\s+/g, ''));

  // Pinyin with & without tones
  accepted.add(pinyin);
  accepted.add(pinyin.replace(/\s+/g, ''));
  accepted.add(pinyinNoTone);
  accepted.add(pinyinNoTone.replace(/\s+/g, ''));

  // Normalized versions
  accepted.add(normalizeAnswer(pinyin));
  accepted.add(normalizeAnswer(pinyinNoTone));
  accepted.add(normalizeAnswer(pinyin.replace(/\s+/g, '')));
  accepted.add(normalizeAnswer(pinyinNoTone.replace(/\s+/g, '')));

  // Tone number variants from metadata
  if (meta?.pinyinVariants) {
    for (const v of meta.pinyinVariants) {
      accepted.add(v);
      accepted.add(v.replace(/\s+/g, ''));
      accepted.add(normalizeAnswer(v));
      accepted.add(normalizeAnswer(v.replace(/\s+/g, '')));
    }
  }

  return Array.from(accepted).filter(Boolean);
}

/**
 * Check if candidate has semantic overlap or identical meaning with target.
 * Prevents ambiguous questions where two choices mean the same thing (e.g. 高兴 and 快乐).
 */
function hasSemanticOverlap(
  target: VocabularyEntry,
  candidate: VocabularyEntry,
): boolean {
  if (candidate[0] === target[0]) return true;

  const targetNorm = normalizeAnswer(target[3]);
  const candNorm = normalizeAnswer(candidate[3]);
  if (targetNorm === candNorm) return true;

  const targetMeta = VOCAB_METADATA[target[0]];
  const candMeta = VOCAB_METADATA[candidate[0]];

  const targetMeanings = new Set(
    (targetMeta?.meaningVi || [target[3]]).map(normalizeAnswer).filter((m) => m.length > 1),
  );
  target[3].split(/[,;/]/).forEach((p) => {
    const norm = normalizeAnswer(p);
    if (norm.length > 1) targetMeanings.add(norm);
  });

  const candMeanings = (candMeta?.meaningVi || [candidate[3]])
    .map(normalizeAnswer)
    .filter((m) => m.length > 1);
  candidate[3].split(/[,;/]/).forEach((p) => {
    const norm = normalizeAnswer(p);
    if (norm.length > 1) candMeanings.push(norm);
  });

  for (const cm of candMeanings) {
    if (targetMeanings.has(cm)) {
      return true; // Overlap detected!
    }
  }

  return false;
}

/**
 * Select 3 smart distractors matching target's semantic cohort:
 * Tier 1: Same category + Same part-of-speech (no synonyms)
 * Tier 2: Same category OR same part-of-speech / level (no synonyms)
 * Tier 3: Random fallback from pool or all-system vocabulary (no synonyms)
 */
export function getSmartDistractors(
  target: VocabularyEntry,
  pool: readonly VocabularyEntry[],
  type: QuestionType,
  count: number = 3,
  rng: () => number = Math.random,
  allVocab: readonly VocabularyEntry[] = ALL_SYSTEM_VOCABULARY,
): string[] {
  const isHanziToMeaning = type === 'hanzi_to_meaning';
  const targetHanzi = target[0];
  const targetOptionValue = isHanziToMeaning ? target[3] : target[0];
  const targetMeta = VOCAB_METADATA[targetHanzi];
  const targetCategories = new Set(targetMeta?.categories || []);
  const targetPos = targetMeta?.partOfSpeech;

  const chosenDistractorEntries: VocabularyEntry[] = [];
  const chosenValues = new Set<string>([targetOptionValue]);

  // Helper to test if an entry can be added
  function canAdd(candidate: VocabularyEntry): boolean {
    const value = isHanziToMeaning ? candidate[3] : candidate[0];
    if (chosenValues.has(value)) return false;
    if (normalizeAnswer(value) === normalizeAnswer(targetOptionValue)) return false;
    if (hasSemanticOverlap(target, candidate)) return false;
    for (const d of chosenDistractorEntries) {
      if (hasSemanticOverlap(d, candidate)) return false;
    }
    return true;
  }

  function addCandidates(candidates: readonly VocabularyEntry[]) {
    const shuffled = shuffleArray(candidates, rng);
    for (const cand of shuffled) {
      if (chosenDistractorEntries.length >= count) break;
      if (canAdd(cand)) {
        chosenDistractorEntries.push(cand);
        chosenValues.add(isHanziToMeaning ? cand[3] : cand[0]);
      }
    }
  }

  // Combine primary pool and fallback vocabulary
  const poolCombined = Array.from(
    new Map([...pool, ...allVocab].map((item) => [item[0], item])).values(),
  );

  // Tier 1: Shared category AND shared part-of-speech
  const tier1 = poolCombined.filter((c) => {
    if (c[0] === targetHanzi) return false;
    const meta = VOCAB_METADATA[c[0]];
    if (!meta) return false;
    const sharesCategory = meta.categories?.some((cat) => targetCategories.has(cat));
    const sharesPos = targetPos && meta.partOfSpeech === targetPos;
    return sharesCategory && sharesPos;
  });
  addCandidates(tier1);

  // Tier 2: Shared category OR shared part-of-speech
  if (chosenDistractorEntries.length < count) {
    const tier2 = poolCombined.filter((c) => {
      if (c[0] === targetHanzi) return false;
      const meta = VOCAB_METADATA[c[0]];
      if (!meta) return false;
      const sharesCategory = meta.categories?.some((cat) => targetCategories.has(cat));
      const sharesPos = targetPos && meta.partOfSpeech === targetPos;
      return sharesCategory || sharesPos;
    });
    addCandidates(tier2);
  }

  // Tier 3: Any from pool
  if (chosenDistractorEntries.length < count) {
    addCandidates(pool);
  }

  // Tier 4: Any from all vocabulary
  if (chosenDistractorEntries.length < count) {
    addCandidates(allVocab);
  }

  // Emergency fallback if pool is too tight to find 3 completely non-overlapping entries
  if (chosenDistractorEntries.length < count) {
    for (const cand of allVocab) {
      if (chosenDistractorEntries.length >= count) break;
      const val = isHanziToMeaning ? cand[3] : cand[0];
      if (!chosenValues.has(val)) {
        chosenDistractorEntries.push(cand);
        chosenValues.add(val);
      }
    }
  }

  return chosenDistractorEntries.map((e) => (isHanziToMeaning ? e[3] : e[0]));
}

/**
 * Generate full pre-computed match questions before the game begins.
 * - 20 questions (or pool length if smaller)
 * - Rounds 1..directionSplit: Hanzi prompt -> Choose Meaning
 * - Rounds directionSplit+1..total: Meaning prompt -> Choose Hanzi
 * - Each question has 4 unique options, shuffled via deterministic PRNG
 * - Includes comprehensive acceptedAnswers for typing validation
 */
export function generateMatchQuestions(
  pool: readonly VocabularyEntry[],
  total: number = 20,
  directionSplit: number = 10,
  seed?: number,
  allVocab: readonly VocabularyEntry[] = ALL_SYSTEM_VOCABULARY,
): MatchQuestion[] {
  if (!pool || pool.length === 0) return [];

  const rng = createPRNG(seed);
  const effectiveTotal = Math.min(total, pool.length >= total ? total : Math.max(pool.length, 1));
  const questions: MatchQuestion[] = [];

  for (let i = 0; i < effectiveTotal; i++) {
    const roundNumber = i + 1;
    const entry = pool[i % pool.length];
    const type: QuestionType =
      roundNumber <= directionSplit ? 'hanzi_to_meaning' : 'meaning_to_hanzi';

    const isHanziToMeaning = type === 'hanzi_to_meaning';
    const prompt = isHanziToMeaning ? entry[0] : entry[3];
    const subPrompt = isHanziToMeaning ? entry[1] : 'Từ nào có nghĩa như trên?';
    const correctAnswer = isHanziToMeaning ? entry[3] : entry[0];

    const distractors = getSmartDistractors(entry, pool, type, 3, rng, allVocab);
    const rawOptions = [correctAnswer, ...distractors];
    const options = shuffleArray(rawOptions, rng);

    const acceptedAnswers = isHanziToMeaning
      ? getAcceptedMeanings(entry)
      : getAcceptedPinyinAndHanzi(entry);

    questions.push({
      id: roundNumber,
      entry,
      type,
      prompt,
      subPrompt,
      correctAnswer,
      options,
      acceptedAnswers,
    });
  }

  return questions;
}

/**
 * Verify user input against accepted answers for a MatchQuestion.
 */
export function verifyAnswer(
  input: string,
  question: MatchQuestion,
): boolean {
  if (!input || !question) return false;
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return false;

  // Direct check with normalized correctAnswer
  if (normalizedInput === normalizeAnswer(question.correctAnswer)) {
    return true;
  }

  // Check against all accepted answers
  for (const accepted of question.acceptedAnswers) {
    if (normalizedInput === normalizeAnswer(accepted)) {
      return true;
    }
  }

  return false;
}
