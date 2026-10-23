// §4.2 约束校验。纯函数，不依赖数据库；有单元测试（tests/unit/validate.test.ts）
import { zh } from '../messages/zh';
import type { Author, Book, BookType, Country, Region } from './types';
import { GREATER_CHINA } from './types';

const m = zh.validate;

export interface Issue {
  field: string;
  message: string;
}

const live = <T extends { deleted_at?: string }>(x: T | undefined): x is T => !!x && !x.deleted_at;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const TYPE_CODE_RE = /^[A-Z]{4}$/;

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 籍贯只在归属为「大中华地区」时允许填写；填写时必须存在 */
function checkRegion(country_code: string | undefined, region_code: string | undefined, regions: Map<string, Region>): Issue[] {
  if (region_code === undefined) return [];
  if (country_code !== GREATER_CHINA) return [{ field: 'region_code', message: m.regionOnlyForGc }];
  if (!regions.has(region_code)) return [{ field: 'region_code', message: m.unknownRegion(region_code) }];
  return [];
}

export interface BookContext {
  authors: Map<string, Author>;
  countries: Map<string, Country>;
  regions: Map<string, Region>;
  bookTypes: Map<string, BookType>;
}

export function validateBook(book: Book, ctx: BookContext): Issue[] {
  const issues: Issue[] = [];
  if (!book.title?.trim()) issues.push({ field: 'title', message: m.required('书名') });

  if (!book.author_ids?.length) issues.push({ field: 'author_ids', message: m.authorRequired });
  for (const id of book.author_ids ?? []) {
    if (!live(ctx.authors.get(id))) issues.push({ field: 'author_ids', message: m.authorMissing(id) });
  }

  if (!book.country_code) issues.push({ field: 'country_code', message: m.required('国家') });
  else if (!live(ctx.countries.get(book.country_code)))
    issues.push({ field: 'country_code', message: m.unknownCountry(book.country_code) });
  issues.push(...checkRegion(book.country_code, book.region_code, ctx.regions));

  if (!book.type_id) issues.push({ field: 'type_id', message: m.required('书籍类型') });
  else if (!live(ctx.bookTypes.get(book.type_id))) issues.push({ field: 'type_id', message: m.unknownType });

  if (book.word_count !== undefined && !(Number.isInteger(book.word_count) && book.word_count >= 0))
    issues.push({ field: 'word_count', message: m.wordCount });
  if (book.year_written !== undefined && !Number.isInteger(book.year_written))
    issues.push({ field: 'year_written', message: m.yearInteger });
  if (book.finished_on !== undefined && !isValidDate(book.finished_on))
    issues.push({ field: 'finished_on', message: m.dateFormat });
  if (book.rating !== undefined && ![1, 2, 3, 4, 5].includes(book.rating))
    issues.push({ field: 'rating', message: m.ratingRange });
  return issues;
}

/** 作者名的比较键：忽略大小写与空白 */
export function normalizeAuthorName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

export interface AuthorContext {
  authors: Author[];
  countries: Map<string, Country>;
  regions: Map<string, Region>;
}

export function validateAuthor(author: Author, ctx: AuthorContext): Issue[] {
  const issues: Issue[] = [];
  if (!author.name?.trim()) issues.push({ field: 'name', message: m.required('作者') });
  else {
    const key = normalizeAuthorName(author.name);
    const dup = ctx.authors.find((a) => a.id !== author.id && live(a) && normalizeAuthorName(a.name) === key);
    if (dup) issues.push({ field: 'name', message: m.authorDuplicate(dup.name) });
  }
  if (author.country_code !== undefined && !live(ctx.countries.get(author.country_code)))
    issues.push({ field: 'country_code', message: m.unknownCountry(author.country_code) });
  issues.push(...checkRegion(author.country_code, author.region_code, ctx.regions));
  return issues;
}

/** 作者被未删除的书籍引用时，不允许删除 */
export function checkDeleteAuthor(authorId: string, books: Book[]): Issue[] {
  const n = books.filter((b) => live(b) && b.author_ids.includes(authorId)).length;
  return n ? [{ field: 'id', message: m.authorInUse(n) }] : [];
}

/** 简称在未删除的类型中唯一 */
export function validateBookType(type: BookType, types: BookType[]): Issue[] {
  const issues: Issue[] = [];
  if (!type.name_zh?.trim()) issues.push({ field: 'name_zh', message: m.required('名称') });
  if (!TYPE_CODE_RE.test(type.code)) issues.push({ field: 'code', message: m.typeCodeFormat });
  else if (types.some((t) => t.id !== type.id && live(t) && t.code === type.code))
    issues.push({ field: 'code', message: m.typeCodeDuplicate(type.code) });
  if (!COLOR_RE.test(type.bg_color)) issues.push({ field: 'bg_color', message: m.colorFormat });
  return issues;
}

/** 被书籍使用的类型不可删除（§4.4） */
export function checkDeleteBookType(typeId: string, books: Book[]): Issue[] {
  const n = books.filter((b) => live(b) && b.type_id === typeId).length;
  return n ? [{ field: 'id', message: m.typeInUse(n) }] : [];
}

/**
 * 国家条目整体校验：代码唯一、着色范围指向存在的色块、合并显示的约束（§5.5 规则 A）。
 * 合并显示条目的成员色块不得被其他条目覆盖；成员自身的现代国家条目（group_code 指向该分组，
 * 如 CN → GC）除外，它们只用于色块一致性检查（§4.6）。
 */
export function validateCountries(countries: Country[], worldCodes: Set<string>): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const c of countries) {
    if (seen.has(c.code)) issues.push({ field: c.code, message: m.codeDuplicate(c.code) });
    seen.add(c.code);
  }
  const active = countries.filter((c) => live(c));
  for (const c of active) {
    for (const code of c.map_codes) {
      if (!worldCodes.has(code)) issues.push({ field: c.code, message: m.mapCodeUnknown(code) });
    }
    if (c.merge_display && c.kind === 'historical') issues.push({ field: c.code, message: m.mergeHistorical });
  }
  for (const owner of active.filter((c) => c.merge_display)) {
    for (const other of active) {
      if (other.code === owner.code || other.group_code === owner.code) continue;
      for (const member of owner.map_codes) {
        if (other.map_codes.includes(member))
          issues.push({ field: other.code, message: m.mergeOverlap(member, owner.name_zh, other.name_zh) });
      }
    }
  }
  return issues;
}

export function validateRegions(regions: Region[]): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const r of regions) {
    if (seen.has(r.code)) issues.push({ field: r.code, message: m.codeDuplicate(r.code) });
    seen.add(r.code);
  }
  return issues;
}

/**
 * 书籍编号（界面上的「#N」）：不存储，按（created_at, id）顺序对未删除的书从 1 起编号（§4.2）。
 * 电脑与手机合并后，同一本书的编号一致。
 */
export function bookNumbers(books: Book[]): Map<string, number> {
  const sorted = books
    .filter((b) => live(b))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Map(sorted.map((b, i) => [b.id, i + 1]));
}
