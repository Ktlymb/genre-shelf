import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { loadGreaterChina, loadWorld } from '../../src/data/map';
import { SEED_BOOK_TYPES, SEED_COUNTRIES, SEED_REGIONS, SEED_TIME } from '../../src/data/seed';
import { validateBookType, validateCountries, validateRegions } from '../../src/data/validate';
import { checkMapConsistency } from '../../src/lib/map-check';

const world = loadWorld();
const gc = loadGreaterChina();
const worldCodes = new Set(world.features.map((f) => f.properties.code));

describe('地图数据（§15.2）', () => {
  it('世界底图 240 个色块、236 个代码；大中华 34 个单位', () => {
    expect(world.features).toHaveLength(240);
    expect(worldCodes.size).toBe(236);
    expect(gc.features).toHaveLength(34);
  });

  it('没有翻转成「整个地球」的多边形', () => {
    for (const f of [...world.features, ...gc.features]) {
      if (f.geometry) expect(geoArea(f), f.properties.code).toBeLessThan(2 * Math.PI);
    }
  });

  it('每个色块都有标注点', () => {
    for (const f of [...world.features, ...gc.features]) {
      expect(f.properties.label.every(Number.isFinite), f.properties.code).toBe(true);
    }
  });

  it('与预设数据一致', () => {
    const errors = checkMapConsistency(
      worldCodes,
      gc.features.map((f) => f.properties.code),
      SEED_COUNTRIES,
      SEED_REGIONS,
    );
    expect(errors).toEqual([]);
  });

  it('一致性检查能发现缺失', () => {
    const errors = checkMapConsistency(
      [...worldCodes].filter((c) => c !== 'RS'),
      gc.features.map((f) => f.properties.code).slice(1),
      SEED_COUNTRIES,
      SEED_REGIONS,
    );
    expect(errors.some((e) => e.includes('RS'))).toBe(true);
    expect(errors.some((e) => e.includes('籍贯条目'))).toBe(true);
  });
});

describe('预设国家（§4.5、§4.6、§15.2）', () => {
  const byCode = new Map(SEED_COUNTRIES.map((c) => [c.code, c]));

  it('现代 236、历史 20、区域分组 1', () => {
    const count = (k: string) => SEED_COUNTRIES.filter((c) => c.kind === k).length;
    expect([count('modern'), count('historical'), count('group')]).toEqual([236, 20, 1]);
  });

  it('通过国家条目校验（代码唯一、着色范围存在、合并显示约束）', () => {
    expect(validateCountries(SEED_COUNTRIES, worldCodes)).toEqual([]);
  });

  it('大中华地区：合并显示，四个成员不可选、指向 GC，名称按规格书', () => {
    expect(byCode.get('GC')).toMatchObject({ merge_display: true, selectable: true, map_codes: ['CN', 'TW', 'HK', 'MO'] });
    const names = { CN: '中国大陆', TW: '台湾', HK: '香港', MO: '澳门' };
    for (const [code, name] of Object.entries(names)) {
      expect(byCode.get(code)).toMatchObject({ name_zh: name, selectable: false, group_code: 'GC' });
    }
    expect(SEED_COUNTRIES.filter((c) => c.selectable && ['CN', 'TW', 'HK', 'MO'].includes(c.code))).toEqual([]);
  });

  it('人工覆盖的中文名', () => {
    const names = { KP: '朝鲜', KR: '韩国', CD: '刚果（金）', CG: '刚果（布）', MN: '蒙古', AX: '奥兰群岛', GG: '根西岛', JE: '泽西岛' };
    for (const [code, name] of Object.entries(names)) expect(byCode.get(code)?.name_zh).toBe(name);
  });

  it('历史国家：YU 与 YUS 都启用，不开启合并显示', () => {
    expect(byCode.get('YU')).toMatchObject({ kind: 'historical', selectable: true, map_codes: ['RS', 'ME', 'XK'] });
    expect(byCode.get('YUS')?.selectable).toBe(true);
    expect(SEED_COUNTRIES.filter((c) => c.kind === 'historical' && c.merge_display)).toEqual([]);
  });

  it('预设条目用固定的早期时间', () => {
    expect(new Set(SEED_COUNTRIES.map((c) => c.updated_at))).toEqual(new Set([SEED_TIME]));
  });
});

describe('预设籍贯与书籍类型（§4.4、§4.6、§15.3）', () => {
  it('籍贯 34 项，代码唯一', () => {
    expect(SEED_REGIONS).toHaveLength(34);
    expect(validateRegions(SEED_REGIONS)).toEqual([]);
    expect(SEED_REGIONS.find((r) => r.code === 'GC-TW')?.name_zh).toBe('台湾');
  });

  it('类型 ID 固定为 type-XXXX，且通过校验', () => {
    expect(SEED_BOOK_TYPES).toHaveLength(15);
    for (const t of SEED_BOOK_TYPES) {
      expect(t.id).toBe(`type-${t.code}`);
      expect(validateBookType(t, SEED_BOOK_TYPES)).toEqual([]);
    }
  });

  it('白字对比度 ≥ 4.5:1', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const t of SEED_BOOK_TYPES) {
      const ratio = 1.05 / (lum(t.bg_color) + 0.05);
      expect(ratio, `${t.code} ${t.bg_color}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
