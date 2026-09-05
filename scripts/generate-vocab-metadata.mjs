import fs from 'fs';
import path from 'path';

// Load existing vocabularies
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

const allEntries = [
  ...hsk1Vocabulary,
  ...hsk2Vocabulary,
  ...hsk3Vocabulary,
  ...hsk4Vocabulary,
  ...collocationsVocabulary,
  ...fixedExpressionsVocabulary,
  ...sentencePatternsVocabulary,
  ...contextSentencesVocabulary,
];

// Tone mark map for converting pinyin with tone mark to tone number
const TONE_MAP = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['v', 1], 'ǘ': ['v', 2], 'ǚ': ['v', 3], 'ǜ': ['v', 4], 'ü': ['v', 0],
};

const ALL_PINYIN_SYLLABLES = [
  'zhuang','shuang','chuang','zheng','zhong','zhuai','zhuan','zhang','zhao','zheng',
  'sheng','shang','shuai','shuan','shou','chuan','chang','cheng','chong',
  'liang','kuang','guang','qiang','xiang','jiang','xiong','jiong',
  'bian','piao','pian','mian','dian','tian','nian','lian','liao','xian','xiao',
  'jian','jiao','qian','qiao','duan','tuan','nuan','luan','guan','kuan','huan',
  'huang','shuang','chuang','zhuang','jiang','qiang','xiang','guang','kuang','liang',
  'zhua','zhui','zhun','zhuo','shua','shui','shun','shuo','chua','chui','chun','chuo',
  'zuan','cuan','suan','zong','cong','song','ting','ling','ning','ming','ding',
  'xing','jing','qing','ping','ying','feng','beng','peng','meng','deng','teng',
  'neng','leng','geng','keng','heng','ceng','seng','zeng','dong','tong','nong',
  'long','gong','kong','hong','yong','weng','tang','lang','mang','fang','dang',
  'yang','wang','gang','kang','hang','cang','sang','biao','diao','tiao','niao',
  'liao','miao','kuai','guai','huai','kuan','guan','huan','kui','gui','hui',
  'chai','shai','zhai','chao','shao','zhao','chan','shan','zhan','chen','shen','zhen',
  'bang','pang','mang','fang','dang','tang','nang','lang','gang','kang','hang',
  'beng','peng','meng','feng','deng','teng','neng','leng','geng','keng','heng',
  'bing','ping','ming','ding','ting','ning','ling','jing','qing','xing','ying',
  'tian','dian','xian','jian','qian','bian','pian','mian','lian','nian',
  'duan','tuan','nuan','luan','guan','kuan','huan','zhuan','chuan','shuan','zuan','cuan','suan',
  'zhui','chui','shui','zui','cui','sui','gui','kui','hui',
  'zhun','chun','shun','zun','cun','sun','gun','kun','hun','dun','tun','lun',
  'zhuo','chuo','shuo','zuo','cuo','suo','guo','kuo','huo','duo','tuo','nuo','luo',
  'zha','cha','sha','zhe','che','she','zhi','chi','shi','zhu','chu','shu',
  'bai','pai','mai','dai','tai','nai','lai','gai','kai','hai','zai','cai','sai',
  'bao','pao','mao','dao','tao','nao','lao','gao','kao','hao','zao','cao','sao',
  'bei','pei','mei','fei','dei','nei','lei','gei','hei','zei',
  'ban','pan','man','fan','dan','tan','nan','lan','gan','kan','han','zan','can','san',
  'ben','pen','men','fen','den','nen','gen','ken','hen','zen','cen','sen',
  'bin','pin','min','nin','lin','jin','qin','xin','yin',
  'bie','pie','mie','die','tie','nie','lie','jie','qie','xie','yue',
  'dia','lia','jia','qia','xia',
  'diu','niu','liu','jiu','qiu','xiu','you',
  'dou','tou','nou','lou','gou','kou','hou','zou','cou','sou','zhou','chou','shou','rou',
  'hua','huai','huan','huang','hui','hun','huo','ha','hai','han','hang','hao','he','hei','hen','heng','hong','hou','hu',
  'ba','pa','ma','fa','da','ta','na','la','ga','ka','ha','za','ca','sa','ya','wa',
  'bo','po','mo','fo','lo','wo','yo',
  'me','te','ne','le','ge','ke','he','ze','ce','se','ye',
  'bi','pi','mi','di','ti','ni','li','ji','qi','xi','yi','zi','ci','si','ri',
  'bu','pu','mu','fu','du','tu','nu','lu','gu','ku','hu','zu','cu','su','ru','wu',
  'lv','nv','ju','qu','xu','yu','lve','nve','jue','que','xue','yue','juan','quan','xuan','yuan','jun','qun','xun','yun',
  'er','ai','ao','ou','an','en','ang','eng','a','o','e'
];
ALL_PINYIN_SYLLABLES.sort((a, b) => b.length - a.length);

function pinyinToToneNumber(pinyin) {
  if (!pinyin) return [];
  const cleanApos = pinyin.replace(/’|'/g, "'").trim();
  const tokens = cleanApos.split(/\s+/);
  
  const parsedTokens = tokens.map((token) => {
    let clean = '';
    for (const ch of token) {
      if (TONE_MAP[ch]) {
        clean += TONE_MAP[ch][0];
      } else {
        clean += ch;
      }
    }
    
    let remClean = clean;
    let remOrig = token;
    const syls = [];
    
    while (remClean.length > 0) {
      let matched = false;
      for (const s of ALL_PINYIN_SYLLABLES) {
        if (remClean.startsWith(s)) {
          let sylTone = 0;
          for (let i = 0; i < s.length && i < remOrig.length; i++) {
            const c = remOrig[i];
            if (TONE_MAP[c]) {
              sylTone = TONE_MAP[c][1];
              break;
            }
          }
          syls.push({ s, tone: sylTone });
          remClean = remClean.slice(s.length);
          remOrig = remOrig.slice(s.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        syls.push({ s: remClean, tone: 0 });
        break;
      }
    }
    return syls;
  });

  const allSyls = parsedTokens.flat();
  const withTonesSpace = allSyls.map((x) => (x.tone > 0 ? `${x.s}${x.tone}` : x.s)).join(' ');
  const withTonesNoSpace = allSyls.map((x) => (x.tone > 0 ? `${x.s}${x.tone}` : x.s)).join('');
  const withoutApos = withTonesNoSpace.replace(/'/g, '');

  return Array.from(new Set([
    withTonesSpace,
    withTonesNoSpace,
    withoutApos,
  ])).filter(Boolean);
}

function splitMeanings(rawMeaning) {
  if (!rawMeaning) return [];
  // Clean punctuation, slashes, semicolons and parens
  const parts = rawMeaning
    .replace(/[;/]/g, ',')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const results = new Set();
  for (const part of parts) {
    const cleanPart = part.replace(/\s+/g, ' ').trim();
    if (cleanPart) results.add(cleanPart);

    // Also extract without parenthetical explanations: e.g. "bạn (nam)" -> "bạn", "nam"
    const withoutParens = cleanPart.replace(/\([^)]*\)/g, '').trim();
    if (withoutParens && withoutParens !== cleanPart) {
      results.add(withoutParens);
    }
    // Also extract inside parens if short and not a note
    const matchInside = cleanPart.match(/\(([^)]+)\)/);
    if (matchInside) {
      const insideText = matchInside[1].trim();
      if (insideText.length < 25 && !/^(dùng|đáp|nghĩa|ví dụ|loại|hsk|trợ|liên)/i.test(insideText)) {
        results.add(insideText);
      }
    }
  }
  return Array.from(results);
}

// Category keyword detectors
const CATEGORY_RULES = [
  {
    id: 'fruit_food_drink',
    keywords: [
      'táo', 'chuối', 'dưa', 'cam', 'quả', 'trái cây', 'ăn', 'uống', 'cơm', 'trà', 'cà phê',
      'bánh', 'thịt', 'rau', 'món', 'nước', 'bữa', 'đói', 'no', 'rượu', 'canh', 'súp', 'sữa',
      'đường', 'muối', 'ngọt', 'chua', 'cay', 'đắng', 'mặn', 'trứng', 'cá', 'bò', 'gà',
    ],
  },
  {
    id: 'animal',
    keywords: ['chó', 'mèo', 'gấu', 'chim', 'cá', 'ngựa', 'bò', 'dê', 'heo', 'lợn', 'thỏ', 'hổ', 'rồng', 'động vật'],
  },
  {
    id: 'family_people',
    keywords: [
      'bố', 'mẹ', 'cha', 'mẹ', 'anh', 'em', 'chị', 'con', 'ông', 'bà', 'vợ', 'chồng',
      'bạn', 'người', 'thầy', 'cô', 'bác sĩ', 'y tá', 'học sinh', 'sinh viên', 'giáo viên',
      'cô gái', 'chàng trai', 'tiểu thư', 'tiên sinh', 'ông/ngài', 'khách', 'hàng xóm',
    ],
  },
  {
    id: 'transport',
    keywords: ['xe', 'taxi', 'máy bay', 'tàu', 'thuyền', 'đạp', 'lái', 'sân bay', 'bến', 'trạm', 'chuyến', 'vé xe', 'vé tàu'],
  },
  {
    id: 'school_study',
    keywords: ['học', 'đọc', 'viết', 'sách', 'vở', 'bài', 'thi', 'lớp', 'trường', 'chữ', 'hán tự', 'tiếng', 'ngôn ngữ', 'bút', 'nghiên cứu', 'từ điển', 'ôn tập'],
  },
  {
    id: 'body_health',
    keywords: ['mắt', 'tai', 'mũi', 'miệng', 'tay', 'chân', 'đầu', 'tóc', 'răng', 'bụng', 'lưng', 'sức khỏe', 'bệnh', 'thuốc', 'ốm', 'đau', 'sốt', 'viện', 'khám', 'chữa'],
  },
  {
    id: 'clothing',
    keywords: ['áo', 'quần', 'váy', 'mũ', 'giày', 'tất', 'mặc', 'đeo', 'túi', 'khăn', 'quần áo'],
  },
  {
    id: 'color',
    keywords: ['đỏ', 'xanh', 'vàng', 'trắng', 'đen', 'hồng', 'tím', 'cam', 'nâu', 'xám', 'màu'],
  },
  {
    id: 'weather_nature',
    keywords: ['mưa', 'nắng', 'tuyết', 'gió', 'trời', 'mây', 'thời tiết', 'nóng', 'lạnh', 'ấm', 'mát', 'núi', 'sông', 'biển', 'hoa', 'cây', 'lá'],
  },
  {
    id: 'time_calendar',
    keywords: [
      'hôm nay', 'ngày mai', 'hôm qua', 'năm', 'tháng', 'tuần', 'ngày', 'giờ', 'phút', 'giây',
      'sáng', 'trưa', 'chiều', 'tối', 'đêm', 'bây giờ', 'khi', 'lúc', 'sớm', 'muộn', 'trễ', 'mùa',
    ],
  },
  {
    id: 'location_place',
    keywords: ['nhà', 'phòng', 'bệnh viện', 'cửa hàng', 'trường', 'công viên', 'khách sạn', 'ngân hàng', 'bắc kinh', 'trung quốc', 'nơi', 'chỗ', 'địa phương', 'quán'],
  },
  {
    id: 'direction_space',
    keywords: ['trên', 'dưới', 'trước', 'sau', 'trong', 'ngoài', 'trái', 'phải', 'đông', 'tây', 'nam', 'bắc', 'giữa', 'bên', 'gần', 'xa'],
  },
  {
    id: 'emotion_mind',
    keywords: ['vui', 'buồn', 'thích', 'yêu', 'ghét', 'sợ', 'giận', 'lo', 'hạnh phúc', 'nhớ', 'nghĩ', 'cảm thấy', 'hứng thú', 'hy vọng', 'tin'],
  },
  {
    id: 'commerce_work',
    keywords: ['tiền', 'mua', 'bán', 'giá', 'đắt', 'rẻ', 'đồng', 'công việc', 'công ty', 'làm việc', 'văn phòng', 'lương', 'hợp đồng', 'kinh doanh', 'thương mại'],
  },
  {
    id: 'communication',
    keywords: ['nói', 'nghe', 'gọi', 'hỏi', 'trả lời', 'chào', 'cảm ơn', 'xin lỗi', 'tin nhắn', 'điện thoại', 'kể', 'bảo', 'giới thiệu', 'thông báo'],
  },
  {
    id: 'sports_entertainment',
    keywords: ['bóng', 'đá bóng', 'bóng rổ', 'bơi', 'chạy bộ', 'âm nhạc', 'phim', 'bài hát', 'đàn', 'hát', 'múa', 'trò chơi', 'thể thao'],
  },
  {
    id: 'action_motion',
    keywords: ['đi', 'đến', 'về', 'vào', 'ra', 'chạy', 'nhảy', 'bơi', 'đá', 'đánh', 'mở', 'đóng', 'ngồi', 'đứng', 'ngủ', 'dậy', 'mang', 'cầm', 'lấy'],
  },
];

function inferCategories(entry) {
  const [hanzi, pinyin, pinyinNoTone, meaning, level] = entry;

  // If sentence pattern or context sentence
  if (hanzi.includes('...') || hanzi.length >= 7 || meaning.length >= 30) {
    return ['sentence_context'];
  }

  const detected = [];
  const lowerMeaning = meaning.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      const regex = new RegExp(`(^|[\\s,;/()])${kw}([\\s,;/()]|$)`, 'i');
      if (regex.test(lowerMeaning)) {
        detected.push(rule.id);
        break;
      }
    }
  }

  if (detected.length === 0) {
    // General fallback based on length or parts
    if (hanzi.length === 1) detected.push('general_character');
    else detected.push('general_vocabulary');
  }

  return detected;
}

function inferPartOfSpeech(entry) {
  const [hanzi, pinyin, pinyinNoTone, meaning, level] = entry;
  if (hanzi.includes('...') || hanzi.length >= 8 || /[.!?]$/.test(meaning)) {
    return 'sentence';
  }
  const lower = meaning.toLowerCase();
  if (/^(số\s*\d+|\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)/i.test(lower)) return 'num';
  if (/^(rất|quá|hơi|cực kỳ|đều|cũng|không|chưa|luôn|thường|lại)/i.test(lower)) return 'adv';
  if (/^(to|nhỏ|cao|thấp|đẹp|xấu|tốt|nóng|lạnh|nhanh|chậm|dài|ngắn|mới|cũ|dễ|khó|đắt|rẻ)/i.test(lower)) return 'adj';
  if (/^(đi|đến|ăn|uống|nghe|nói|đọc|viết|chạy|nhảy|làm|mua|bán|mở|đóng|xem|nhìn|học|ngủ)/i.test(lower)) return 'verb';
  if (hanzi.length >= 3 && !hanzi.includes(' ')) return 'phrase';
  return 'noun';
}

console.log('Total vocabulary items to process:', allEntries.length);

const metadataMap = {};

for (const entry of allEntries) {
  const [hanzi, pinyin, pinyinNoTone, meaning, level] = entry;
  const categories = inferCategories(entry);
  const partOfSpeech = inferPartOfSpeech(entry);
  const meaningVi = splitMeanings(meaning);
  const toneVariants = pinyinToToneNumber(pinyin);
  const pinyinNoSpaceRaw = pinyinNoTone.replace(/\s+/g, '');
  const pinyinWithV = pinyinNoTone.replace(/ü/g, 'v').replace(/’/g, "'");

  const pinyinVariants = Array.from(new Set([
    pinyin.toLowerCase(),
    pinyin.replace(/\s+/g, '').toLowerCase(),
    pinyinNoTone.toLowerCase(),
    pinyinNoSpaceRaw.toLowerCase(),
    pinyinWithV.toLowerCase(),
    pinyinWithV.replace(/\s+/g, '').toLowerCase(),
    pinyinWithV.replace(/'/g, '').toLowerCase(),
    ...toneVariants.map((t) => t.toLowerCase()),
    ...toneVariants.map((t) => t.replace(/\s+/g, '').toLowerCase()),
  ])).filter(Boolean);

  if (metadataMap[hanzi]) {
    const existing = metadataMap[hanzi];
    metadataMap[hanzi] = {
      categories: Array.from(new Set([...existing.categories, ...categories])),
      partOfSpeech: existing.partOfSpeech || partOfSpeech,
      meaningVi: Array.from(new Set([...existing.meaningVi, ...meaningVi])),
      pinyinVariants: Array.from(new Set([...existing.pinyinVariants, ...pinyinVariants])),
    };
  } else {
    metadataMap[hanzi] = {
      categories,
      partOfSpeech,
      meaningVi,
      pinyinVariants,
    };
  }
}

console.log('Successfully generated metadata for', Object.keys(metadataMap).length, 'unique Hanzi items');

// Write lib/vocab-metadata.ts
const codeContent = `/**
 * Centralized Vocabulary Metadata Registry
 * Auto-generated by scripts/generate-vocab-metadata.mjs
 * Total items: ${Object.keys(metadataMap).length}
 */

export type WordMetadata = {
  categories: string[];
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'num' | 'phrase' | 'sentence';
  meaningVi: string[];
  pinyinVariants: string[];
};

export const VOCAB_METADATA: Record<string, WordMetadata> = ${JSON.stringify(metadataMap, null, 2)};
`;

fs.writeFileSync('lib/vocab-metadata.ts', codeContent, 'utf8');
console.log('Wrote lib/vocab-metadata.ts successfully!');
