import type { BookType } from '../types';
import { SEED_TIME } from './constants';

// §4.4 预设书籍类型。ID 固定为 type-XXXX，保证电脑与手机合并时不会重复
const TYPES: [code: string, name_zh: string, bg_color: string][] = [
  ['LFIC', '长篇小说', '#1F4E79'],
  ['MFIC', '中篇小说', '#2B6A8A'],
  ['SFIC', '短篇小说', '#2F7A6B'],
  ['POEM', '诗歌', '#7A3E9D'],
  ['EPIC', '史诗', '#8B5A2B'],
  ['DRAM', '戏剧', '#A12B3B'],
  ['HIST', '历史', '#6D5A2E'],
  ['BIOG', '传记/回忆录', '#3F6B3A'],
  ['PHIL', '哲学', '#3D3D8F'],
  ['SOCI', '社科', '#A8501A'],
  ['SCIE', '科学', '#0E7490'],
  ['LTTH', '文论', '#7B4B6A'],
  ['ARTS', '艺术', '#B0365F'],
  ['ESSY', '杂谈', '#5B6770'],
  ['SCFC', '科幻小说', '#5D4DB3'],
];

export const SEED_BOOK_TYPES: BookType[] = TYPES.map(([code, name_zh, bg_color], i) => ({
  id: `type-${code}`,
  code,
  name_zh,
  bg_color,
  sort_order: i + 1,
  updated_at: SEED_TIME,
}));
