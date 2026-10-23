import { describe, expect, it } from 'vitest';
import { SEED_BOOK_TYPES, SEED_COUNTRIES, SEED_REGIONS, SEED_TIME } from '../../src/data/seed';
import type { Author, Book, Country } from '../../src/data/types';
import {
  bookNumbers,
  checkDeleteAuthor,
  checkDeleteBookType,
  normalizeAuthorName,
  validateAuthor,
  validateBook,
  validateBookType,
  validateCountries,
} from '../../src/data/validate';

const T = '2026-01-01T00:00:00.000Z';
const homer: Author = { id: 'A1', name: '荷马', country_code: 'GRC', updated_at: T };
const luxun: Author = { id: 'A2', name: '鲁迅', country_code: 'GC', region_code: 'GC-ZJ', updated_at: T };
const gone: Author = { id: 'A3', name: '已删除', updated_at: T, deleted_at: T };

const ctx = {
  authors: new Map([homer, luxun, gone].map((a) => [a.id, a])),
  countries: new Map(SEED_COUNTRIES.map((c) => [c.code, c])),
  regions: new Map(SEED_REGIONS.map((r) => [r.code, r])),
  bookTypes: new Map(SEED_BOOK_TYPES.map((t) => [t.id, t])),
};

function book(over: Partial<Book> = {}): Book {
  return {
    id: 'B1',
    title: '奥德赛',
    author_ids: ['A1'],
    country_code: 'GRC',
    type_id: 'type-EPIC',
    year_approx: true,
    year_written: -700,
    translators: [],
    status: 'finished',
    created_at: T,
    updated_at: T,
    ...over,
  };
}

const fields = (issues: { field: string }[]) => issues.map((i) => i.field);

describe('书籍校验', () => {
  it('合法的书没有问题', () => {
    expect(validateBook(book(), ctx)).toEqual([]);
    expect(validateBook(book({ author_ids: ['A2'], country_code: 'GC', region_code: 'GC-ZJ', type_id: 'type-SFIC' }), ctx)).toEqual([]);
  });

  it('必填项：书名、作者、国家、类型', () => {
    expect(fields(validateBook(book({ title: '  ', author_ids: [], country_code: '', type_id: '' }), ctx))).toEqual([
      'title',
      'author_ids',
      'country_code',
      'type_id',
    ]);
  });

  it('作者必须存在且未删除', () => {
    expect(fields(validateBook(book({ author_ids: ['A1', 'A3'] }), ctx))).toEqual(['author_ids']);
    expect(fields(validateBook(book({ author_ids: ['nope'] }), ctx))).toEqual(['author_ids']);
  });

  it('籍贯只在国家为大中华地区时允许', () => {
    expect(fields(validateBook(book({ region_code: 'GC-ZJ' }), ctx))).toEqual(['region_code']);
    expect(fields(validateBook(book({ country_code: 'GC', region_code: 'GC-XX' }), ctx))).toEqual(['region_code']);
  });

  it('国家、类型必须存在', () => {
    expect(fields(validateBook(book({ country_code: 'ZZ' }), ctx))).toEqual(['country_code']);
    expect(fields(validateBook(book({ type_id: 'type-NONE' }), ctx))).toEqual(['type_id']);
  });

  it('字数、日期、评分的格式', () => {
    expect(fields(validateBook(book({ word_count: -1 }), ctx))).toEqual(['word_count']);
    expect(fields(validateBook(book({ finished_on: '2026-02-30' }), ctx))).toEqual(['finished_on']);
    expect(fields(validateBook(book({ finished_on: '2026/01/01' }), ctx))).toEqual(['finished_on']);
    expect(validateBook(book({ finished_on: '2024-02-29' }), ctx)).toEqual([]);
    expect(fields(validateBook(book({ rating: 6 as never }), ctx))).toEqual(['rating']);
  });
});

describe('作者校验', () => {
  const actx = { authors: [homer, luxun, gone], countries: ctx.countries, regions: ctx.regions };

  it('名字唯一（忽略大小写与空白），已删除的不算', () => {
    expect(normalizeAuthorName(' Franz  Kafka ')).toBe('franzkafka');
    expect(fields(validateAuthor({ id: 'X', name: ' 鲁 迅', updated_at: T }, actx))).toEqual(['name']);
    expect(validateAuthor({ id: 'X', name: '已删除', updated_at: T }, actx)).toEqual([]);
    expect(validateAuthor(luxun, actx)).toEqual([]);
  });

  it('籍贯只在归属为大中华地区时允许', () => {
    expect(fields(validateAuthor({ ...homer, region_code: 'GC-AH' }, actx))).toEqual(['region_code']);
  });

  it('被未删除的书引用时不能删除', () => {
    expect(checkDeleteAuthor('A1', [book()])).toHaveLength(1);
    expect(checkDeleteAuthor('A1', [book({ deleted_at: T })])).toEqual([]);
  });
});

describe('书籍类型校验', () => {
  const t = { id: 'X', code: 'NOVL', name_zh: '小说', bg_color: '#123456', sort_order: 99, updated_at: T };

  it('简称 4 位大写字母且唯一，颜色为 #RRGGBB', () => {
    expect(validateBookType(t, SEED_BOOK_TYPES)).toEqual([]);
    expect(fields(validateBookType({ ...t, code: 'nov' }, SEED_BOOK_TYPES))).toEqual(['code']);
    expect(fields(validateBookType({ ...t, code: 'LFIC' }, SEED_BOOK_TYPES))).toEqual(['code']);
    expect(fields(validateBookType({ ...t, bg_color: 'red' }, SEED_BOOK_TYPES))).toEqual(['bg_color']);
  });

  it('被书籍使用的类型不能删除', () => {
    expect(checkDeleteBookType('type-EPIC', [book()])).toHaveLength(1);
    expect(checkDeleteBookType('type-LFIC', [book()])).toEqual([]);
  });
});

describe('国家条目校验（§5.5 规则 A）', () => {
  const codes = new Set(SEED_COUNTRIES.flatMap((c) => c.map_codes));
  const extra = (over: Partial<Country>): Country => ({
    code: 'XX',
    name_zh: '测试',
    name_en: 'Test',
    kind: 'historical',
    map_codes: ['RS'],
    merge_display: false,
    selectable: true,
    sort_order: 9999,
    updated_at: SEED_TIME,
    ...over,
  });

  it('合并显示的成员色块不得被其他条目覆盖', () => {
    const issues = validateCountries([...SEED_COUNTRIES, extra({ map_codes: ['MN', 'TW'] })], codes);
    expect(issues.map((i) => i.field)).toEqual(['XX']);
  });

  it('已删除的条目不参与检查', () => {
    expect(validateCountries([...SEED_COUNTRIES, extra({ map_codes: ['TW'], deleted_at: T })], codes)).toEqual([]);
  });

  it('代码重复、着色范围不存在、历史国家开启合并显示都会报错', () => {
    expect(validateCountries([...SEED_COUNTRIES, extra({ code: 'YU' })], codes)).toHaveLength(1);
    expect(validateCountries([...SEED_COUNTRIES, extra({ map_codes: ['QQ'] })], codes)).toHaveLength(1);
    const merged = validateCountries([...SEED_COUNTRIES, extra({ merge_display: true, map_codes: ['ZW'] })], codes);
    // 既不允许历史国家合并显示，也会与现代国家 ZW 的色块重叠
    expect(merged.map((i) => i.message)).toEqual([expect.stringContaining('历史国家'), expect.stringContaining('ZW')]);
  });
});

describe('书籍编号（§4.2）', () => {
  it('按 created_at、id 排序，跳过已删除的书', () => {
    const books = [
      book({ id: 'C', created_at: '2026-01-02T00:00:00.000Z' }),
      book({ id: 'B', created_at: '2026-01-01T00:00:00.000Z' }),
      book({ id: 'A', created_at: '2026-01-02T00:00:00.000Z' }),
      book({ id: 'D', created_at: '2026-01-01T12:00:00.000Z', deleted_at: T }),
    ];
    expect([...bookNumbers(books)]).toEqual([
      ['B', 1],
      ['A', 2],
      ['C', 3],
    ]);
  });

  it('两台设备上输入顺序不同，编号一致', () => {
    const a = [book({ id: 'X', created_at: T }), book({ id: 'Y', created_at: '2026-03-01T00:00:00.000Z' })];
    expect(bookNumbers(a)).toEqual(bookNumbers([...a].reverse()));
  });
});
