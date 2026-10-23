import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureSeed, GenreShelfDB } from '../../src/data/db';
import { SEED_BOOK_TYPES, SEED_COUNTRIES, SEED_REGIONS, SEED_VERSION } from '../../src/data/seed';

let n = 0;
let db: GenreShelfDB;
const fresh = () => (db = new GenreShelfDB(`test-${++n}`));

afterEach(async () => {
  await db?.delete();
});

describe('ensureSeed（§4.2 预设数据的升级）', () => {
  it('首次打开写入全部预设与默认设置', async () => {
    fresh();
    const r = await ensureSeed(db);
    expect(r).toEqual({
      fresh: true,
      countries: SEED_COUNTRIES.length,
      regions: SEED_REGIONS.length,
      book_types: SEED_BOOK_TYPES.length,
    });
    expect(await db.settings.get('main')).toMatchObject({ seed_version: SEED_VERSION, scale_mode: 'rank', metric: 'count' });
  });

  it('版本未变时不做任何事', async () => {
    fresh();
    await ensureSeed(db);
    await db.countries.delete('YU');
    expect(await ensureSeed(db)).toEqual({ fresh: false, countries: 0, regions: 0, book_types: 0 });
    expect(await db.countries.get('YU')).toBeUndefined();
  });

  it('版本变大时只补充缺少的条目，不覆盖改动过或软删除的条目', async () => {
    fresh();
    await ensureSeed(db);
    const T = '2026-05-01T00:00:00.000Z';
    await db.countries.update('SU', { name_zh: '苏维埃社会主义共和国联盟', updated_at: T });
    await db.book_types.update('type-ESSY', { deleted_at: T, updated_at: T });
    await db.book_types.delete('type-LFIC');
    await db.settings.update('main', { seed_version: 0, low_color: '#000000' });

    const r = await ensureSeed(db);
    expect(r).toEqual({ fresh: false, countries: 0, regions: 0, book_types: 1 });
    expect((await db.countries.get('SU'))?.name_zh).toBe('苏维埃社会主义共和国联盟');
    expect((await db.book_types.get('type-ESSY'))?.deleted_at).toBe(T);
    expect(await db.book_types.get('type-LFIC')).toBeDefined();
    expect(await db.settings.get('main')).toMatchObject({ seed_version: SEED_VERSION, low_color: '#000000' });
  });
});
