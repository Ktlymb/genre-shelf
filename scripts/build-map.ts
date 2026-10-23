/**
 * 生成世界底图与大中华二级底图（TopoJSON），以及现代国家名称表，并做一致性检查。
 * 数据源：Natural Earth 1:50m（公有领域），见规格书 §15.2。
 *
 * 用法：npm run build:map
 * 源文件下载后缓存在 scripts/.cache/（不提交）；生成的文件提交到仓库，平时构建不需要联网。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { checkMapConsistency } from '../src/lib/map-check';

const NE_VERSION = 'v5.1.2';
const NE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, 'scripts/.cache');
const mapDir = join(root, 'src/data/map');
const seedDir = join(root, 'src/data/seed');

// 仍无代码的条目（§15.2）：按 ADM0_A3 处理
const MERGE_INTO: Record<string, string> = { SOL: 'SO', CYN: 'CY' };
const SKIP = new Set(['KAS', 'ATA']); // Siachen Glacier、Antarctica 不绘制

// 需要人工覆盖的中文名（§15.2、§4.6）
const NAME_ZH_OVERRIDES: Record<string, string> = {
  KP: '朝鲜',
  KR: '韩国',
  CD: '刚果（金）',
  CG: '刚果（布）',
  MN: '蒙古',
  AX: '奥兰群岛',
  GG: '根西岛',
  JE: '泽西岛',
  SZ: '埃斯瓦蒂尼',
  AU: '澳大利亚',
  CN: '中国大陆',
  TW: '台湾',
  HK: '香港',
  MO: '澳门',
};
const NAME_EN_OVERRIDES: Record<string, string> = {
  CN: 'Mainland China',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  MO: 'Macao',
};

type Props = Record<string, string | number | null>;

/**
 * 每个色块的属性：code 为国家代码（世界底图）或籍贯 map_id（二级底图）；
 * label 为 Natural Earth 给出的标注点 [经度, 纬度]。微型国家简化后可能没有面积，M2 用它放置圆点标记
 */
interface MapProps {
  code: string;
  label: [number, number];
}

const round = (n: unknown) => Math.round(Number(n) * 1000) / 1000;

async function load(name: string): Promise<FeatureCollection<Geometry, Props>> {
  const file = join(cacheDir, `${name}.geojson`);
  if (!existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    const url = `${NE_BASE}/${name}.geojson`;
    console.log(`下载 ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败：${res.status} ${url}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * d3-geo 按球面理解多边形，要求外环顺时针；Natural Earth 的 GeoJSON 部分要素是逆时针，
 * d3 会把它当成「整个地球减去这个国家」。面积超过半个球面的多边形，把各环反转
 */
function rewind(geometry: Geometry): Geometry {
  const fix = (rings: number[][][]) => {
    const area = geoArea({ type: 'Polygon', coordinates: rings });
    return area > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
  };
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: fix(geometry.coordinates) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map(fix) };
  return geometry;
}

/**
 * 比量化网格还小的岛屿，量化后可能翻转成「整个地球」。去掉这样的多边形；
 * 整个色块都没了的，保留空几何与标注点（M2 以微型标记显示）
 */
function dropInverted(topo: Topology<{ [k: string]: GeometryCollection<MapProps> }>, name: string) {
  const inverted = (arcs: number[][]) => geoArea(feature(topo, { type: 'Polygon', arcs } as never) as never) > 2 * Math.PI;
  topo.objects[name].geometries = topo.objects[name].geometries.map((g) => {
    if (g.type === 'Polygon' && inverted(g.arcs)) {
      console.log(`  去掉翻转的多边形：${g.properties!.code}`);
      return { type: null, properties: g.properties } as never;
    }
    if (g.type === 'MultiPolygon') {
      const arcs = g.arcs.filter((p) => !inverted(p));
      if (arcs.length < g.arcs.length) console.log(`  去掉翻转的多边形：${g.properties!.code}`);
      return arcs.length ? { ...g, arcs } : ({ type: null, properties: g.properties } as never);
    }
    return g;
  });
}

function countPoints(topo: Topology): number {
  return topo.arcs.reduce((n, arc) => n + arc.length, 0);
}

/** 量化 → 预简化 → 只保留 keep 比例的点 */
function build(name: string, features: Feature<Geometry, MapProps>[], quantization: number, keep: number) {
  const fc: FeatureCollection<Geometry, MapProps> = {
    type: 'FeatureCollection',
    features: features.map((f) => ({ ...f, geometry: rewind(f.geometry) })),
  };
  const raw = topology({ [name]: fc } as Record<string, GeoJSON.GeoJsonObject>, quantization) as Topology;
  const before = countPoints(raw);
  const pre = presimplify(raw as Parameters<typeof presimplify>[0], sphericalTriangleArea);
  // 小岛、微型国家常常是一条自成闭环的弧，简化后只剩端点就消失了。
  // 每条闭环弧至少保留权重最高的 3 个中间点，保证它仍是一个多边形（§5.1 微型国家需要可见、可点击）
  for (const arc of pre.arcs as unknown as number[][][]) {
    const first = arc[0];
    const last = arc[arc.length - 1];
    if (arc.length < 5 || first[0] !== last[0] || first[1] !== last[1]) continue;
    arc
      .slice(1, -1)
      .sort((a, b) => b[2] - a[2])
      .slice(0, 3)
      .forEach((p) => (p[2] = Infinity));
  }
  // quantile 按权重降序取分位数：权重不低于它的点约占 keep
  const topo = quantize(simplify(pre, quantile(pre, keep)), quantization);
  dropInverted(topo as Topology<{ [k: string]: GeometryCollection<MapProps> }>, name);
  const json = JSON.stringify(topo);
  return { topo: topo as Topology<{ [k: string]: GeometryCollection<MapProps> }>, json, before };
}

function reportTiny(name: string, topo: Topology<{ [k: string]: GeometryCollection<MapProps> }>) {
  const fc = feature(topo, topo.objects[name]) as FeatureCollection<Geometry, MapProps>;
  const tiny = fc.features.filter((f) => !f.geometry || geoArea(f) === 0).map((f) => f.properties.code);
  if (tiny.length) console.log(`  简化后面积为 0 的色块（M2 以微型标记显示）：${tiny.join('、')}`);
}

async function main() {
  // ---------- 世界底图 ----------
  const admin0 = await load('ne_50m_admin_0_countries');
  console.log(`admin-0 要素：${admin0.features.length}`);

  const worldFeatures: Feature<Geometry, MapProps>[] = [];
  const names = new Map<string, { name_zh: string; name_en: string; primary: boolean }>();
  for (const f of admin0.features) {
    const p = f.properties;
    const a3 = String(p.ADM0_A3);
    if (SKIP.has(a3)) continue;
    const code = MERGE_INTO[a3] ?? String(p.ISO_A2_EH);
    if (!/^[A-Z]{2}$/.test(code)) throw new Error(`要素 ${p.NAME}（${a3}）没有可用的国家代码：${code}`);
    worldFeatures.push({
      type: 'Feature',
      properties: { code, label: [round(p.LABEL_X), round(p.LABEL_Y)] },
      geometry: f.geometry,
    });
    if (MERGE_INTO[a3]) continue;
    // 同一代码有多个要素时（如澳大利亚），取主体那一个的名称
    const primary = a3 === p.ISO_A3_EH;
    const prev = names.get(code);
    if (!prev || (primary && !prev.primary)) {
      names.set(code, { name_zh: String(p.NAME_ZH), name_en: String(p.NAME_EN), primary });
    }
  }

  const world = build('countries', worldFeatures, 3e4, 0.25);
  const worldCodes = new Set(worldFeatures.map((f) => f.properties.code));
  console.log(
    `世界底图：${worldFeatures.length} 个色块、${worldCodes.size} 个代码；` +
      `点数 ${world.before} → ${countPoints(world.topo)}；${(world.json.length / 1024).toFixed(0)} KB`,
  );
  reportTiny('countries', world.topo);

  const modern = [...names.entries()]
    .map(([code, n]) => ({
      code,
      name_zh: NAME_ZH_OVERRIDES[code] ?? n.name_zh,
      name_en: NAME_EN_OVERRIDES[code] ?? n.name_en,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  // ---------- 大中华二级底图 ----------
  const admin1 = await load('ne_50m_admin_1_states_provinces');
  const gcFeatures: Feature<Geometry, MapProps>[] = [];
  for (const f of admin1.features) {
    if (f.properties.adm0_a3 !== 'CHN') continue;
    const iso = String(f.properties.iso_3166_2);
    if (!/^CN-[A-Z]{2}$/.test(iso)) throw new Error(`省级单位代码格式不对：${iso}`);
    gcFeatures.push({
      type: 'Feature',
      properties: { code: `GC-${iso.slice(3)}`, label: [round(f.properties.longitude), round(f.properties.latitude)] },
      geometry: f.geometry,
    });
  }
  const fromAdmin1 = gcFeatures.length;
  // 台湾、香港、澳门不在 50m 的 admin-1 里，从 admin-0 取
  for (const code of ['TW', 'HK', 'MO']) {
    const f = admin0.features.find((x) => x.properties.ISO_A2_EH === code);
    if (!f) throw new Error(`admin-0 里找不到 ${code}`);
    gcFeatures.push({
      type: 'Feature',
      properties: { code: `GC-${code}`, label: [round(f.properties.LABEL_X), round(f.properties.LABEL_Y)] },
      geometry: f.geometry,
    });
  }
  const gc = build('regions', gcFeatures, 1e5, 0.6);
  console.log(
    `大中华二级底图：${gcFeatures.length} 个单位（admin-1 ${fromAdmin1} + admin-0 3）；` +
      `点数 ${gc.before} → ${countPoints(gc.topo)}；${(gc.json.length / 1024).toFixed(0)} KB`,
  );
  reportTiny('regions', gc.topo);

  // ---------- 写出 ----------
  mkdirSync(mapDir, { recursive: true });
  writeFileSync(join(mapDir, 'world.topo.json'), world.json);
  writeFileSync(join(mapDir, 'gc.topo.json'), gc.json);
  writeFileSync(join(seedDir, 'countries-modern.json'), '[\n' + modern.map((m) => '  ' + JSON.stringify(m)).join(',\n') + '\n]\n');

  // ---------- 一致性检查（读取刚写出的名称表）----------
  const { SEED_COUNTRIES, SEED_REGIONS } = await import('../src/data/seed/index');
  const errors = checkMapConsistency(
    worldCodes,
    gcFeatures.map((f) => f.properties.code),
    SEED_COUNTRIES,
    SEED_REGIONS,
  );
  if (errors.length) {
    console.error('一致性检查失败：\n' + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }
  console.log('一致性检查通过。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
