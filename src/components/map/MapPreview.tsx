import { geoConicEqualArea, geoNaturalEarth1, geoPath, type GeoProjection } from 'd3-geo';
import { useMemo } from 'react';
import type { MapFeatures } from '../../data/map';

interface Props {
  features: MapFeatures;
  projection: 'world' | 'china';
  /** 返回色块填充色 */
  fill: (code: string) => string;
  label: string;
}

const WIDTH = 960;

/** M0 地图预览：只验证底图数据能正确渲染，不含缩放、着色与交互（M2、M3 实现） */
export function MapPreview({ features, projection, fill, label }: Props) {
  const { paths, height } = useMemo(() => {
    const proj: GeoProjection =
      projection === 'world'
        ? geoNaturalEarth1()
        : geoConicEqualArea().parallels([25, 47]).rotate([-105, 0]);
    const height = projection === 'world' ? 500 : 760;
    proj.fitSize([WIDTH, height], features);
    const path = geoPath(proj);
    return {
      height,
      paths: features.features.map((f, i) => ({ key: `${f.properties.code}-${i}`, code: f.properties.code, d: path(f) ?? '' })),
    };
  }, [features, projection]);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={fill(p.code)} stroke="#ffffff" strokeWidth={0.6} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
