import type { Country, Region } from '../data/types';

/**
 * 底图与预设数据的一致性检查（§5.1、§5.7、§15.2）。返回错误列表，空数组表示通过。
 * 构建脚本与单元测试共用。
 */
export function checkMapConsistency(
  worldCodes: Iterable<string>,
  gcMapIds: Iterable<string>,
  countries: Country[],
  regions: Region[],
): string[] {
  const errors: string[] = [];
  const world = new Set(worldCodes);
  const gc = new Set(gcMapIds);
  const live = countries.filter((c) => !c.deleted_at);
  const modern = new Set(live.filter((c) => c.kind === 'modern').map((c) => c.code));

  for (const code of world) {
    if (!modern.has(code)) errors.push(`世界底图色块 ${code} 没有对应的现代国家条目`);
  }
  for (const code of modern) {
    if (!world.has(code)) errors.push(`现代国家条目 ${code} 在世界底图上没有色块`);
  }
  for (const c of live) {
    for (const m of c.map_codes) {
      if (!world.has(m)) errors.push(`条目 ${c.code} 的着色范围 ${m} 在世界底图上不存在`);
    }
  }

  const regionMapIds = new Set(regions.map((r) => r.map_id));
  for (const id of gc) {
    if (!regionMapIds.has(id)) errors.push(`大中华二级底图色块 ${id} 没有对应的籍贯条目`);
  }
  for (const id of regionMapIds) {
    if (!gc.has(id)) errors.push(`籍贯条目 ${id} 在大中华二级底图上没有色块`);
  }
  return errors;
}
