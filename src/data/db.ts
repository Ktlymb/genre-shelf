import Dexie, { type EntityTable, type Table } from 'dexie';
import { DEFAULT_SETTINGS, SEED_BOOK_TYPES, SEED_COUNTRIES, SEED_REGIONS, SEED_VERSION } from './seed';
import type { Author, Book, BookType, Country, Region, SavedView, Settings } from './types';

export const DB_NAME = 'genre-shelf';

export class GenreShelfDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  countries!: EntityTable<Country, 'code'>;
  regions!: EntityTable<Region, 'code'>;
  book_types!: EntityTable<BookType, 'id'>;
  authors!: EntityTable<Author, 'id'>;
  books!: EntityTable<Book, 'id'>;
  saved_views!: EntityTable<SavedView, 'id'>;

  constructor(name = DB_NAME) {
    super(name);
    // 约束由 validate.ts 校验，不依赖数据库的唯一索引（§4.2）
    this.version(1).stores({
      settings: 'id',
      countries: 'code',
      regions: 'code',
      book_types: 'id',
      authors: 'id',
      books: 'id, country_code, region_code, finished_on, updated_at',
      saved_views: 'id',
    });
  }
}

let instance: GenreShelfDB | undefined;

export function getDb(): GenreShelfDB {
  return (instance ??= new GenreShelfDB());
}

export interface SeedResult {
  /** 是否为首次写入（本机之前没有数据） */
  fresh: boolean;
  countries: number;
  regions: number;
  book_types: number;
}

/**
 * 写入或升级预设数据（§4.2）。
 * 首次打开写入全部预设；之后只在 seed_version 变大时**补充**本机缺少的条目，
 * 不覆盖用户改过或软删除的条目（软删除的条目仍在库里，因此不会被补回）。
 */
export async function ensureSeed(db: GenreShelfDB = getDb()): Promise<SeedResult> {
  return db.transaction('rw', [db.settings, db.countries, db.regions, db.book_types], async () => {
    const settings = await db.settings.get('main');
    const result: SeedResult = { fresh: !settings, countries: 0, regions: 0, book_types: 0 };
    if (settings && settings.seed_version >= SEED_VERSION) return result;

    result.countries = await addMissing<Country>(db.countries, SEED_COUNTRIES, (c) => c.code);
    result.regions = await addMissing<Region>(db.regions, SEED_REGIONS, (r) => r.code);
    result.book_types = await addMissing<BookType>(db.book_types, SEED_BOOK_TYPES, (t) => t.id);

    if (settings) {
      // seed_version 是本机状态，不改 updated_at
      await db.settings.update('main', { seed_version: SEED_VERSION });
    } else {
      await db.settings.add({ ...DEFAULT_SETTINGS, seed_version: SEED_VERSION });
    }
    return result;
  });
}

// 第三个类型参数是插入类型；这里只写入完整的条目
async function addMissing<T>(table: Table<T, string, any>, seed: T[], key: (item: T) => string): Promise<number> {
  const existing = await table.bulkGet(seed.map(key));
  const missing = seed.filter((_, i) => existing[i] === undefined);
  if (missing.length) await table.bulkAdd(missing);
  return missing.length;
}
