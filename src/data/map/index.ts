import type { FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
// 以文本形式内联，用到时才解析（§10：二级地图按需解析，不拖慢首屏）
import gcRaw from './gc.topo.json?raw';
import worldRaw from './world.topo.json?raw';

export interface MapProps {
  /** 世界底图：国家代码；二级底图：籍贯 map_id */
  code: string;
  /** 标注点 [经度, 纬度] */
  label: [number, number];
}

export type MapFeatures = FeatureCollection<Geometry, MapProps>;

function parse(raw: string, object: string): MapFeatures {
  const topo = JSON.parse(raw) as Topology<{ [k: string]: GeometryCollection<MapProps> }>;
  return feature(topo, topo.objects[object]) as MapFeatures;
}

let world: MapFeatures | undefined;
let gc: MapFeatures | undefined;

/** 世界底图：240 个色块 */
export const loadWorld = (): MapFeatures => (world ??= parse(worldRaw, 'countries'));

/** 大中华二级底图：34 个省级单位 */
export const loadGreaterChina = (): MapFeatures => (gc ??= parse(gcRaw, 'regions'));
