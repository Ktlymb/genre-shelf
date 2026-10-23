import type { Region } from '../types';
import { GREATER_CHINA } from '../types';

// §4.6 大中华 34 个省级单位，按规格书列出的顺序。显示简称，不加行政级别后缀
const REGIONS: [suffix: string, name_zh: string, name_en: string][] = [
  ['BJ', '北京', 'Beijing'],
  ['TJ', '天津', 'Tianjin'],
  ['HE', '河北', 'Hebei'],
  ['SX', '山西', 'Shanxi'],
  ['NM', '内蒙古', 'Inner Mongolia'],
  ['LN', '辽宁', 'Liaoning'],
  ['JL', '吉林', 'Jilin'],
  ['HL', '黑龙江', 'Heilongjiang'],
  ['SH', '上海', 'Shanghai'],
  ['JS', '江苏', 'Jiangsu'],
  ['ZJ', '浙江', 'Zhejiang'],
  ['AH', '安徽', 'Anhui'],
  ['FJ', '福建', 'Fujian'],
  ['JX', '江西', 'Jiangxi'],
  ['SD', '山东', 'Shandong'],
  ['HA', '河南', 'Henan'],
  ['HB', '湖北', 'Hubei'],
  ['HN', '湖南', 'Hunan'],
  ['GD', '广东', 'Guangdong'],
  ['GX', '广西', 'Guangxi'],
  ['HI', '海南', 'Hainan'],
  ['CQ', '重庆', 'Chongqing'],
  ['SC', '四川', 'Sichuan'],
  ['GZ', '贵州', 'Guizhou'],
  ['YN', '云南', 'Yunnan'],
  ['XZ', '西藏', 'Xizang'],
  ['SN', '陕西', 'Shaanxi'],
  ['GS', '甘肃', 'Gansu'],
  ['QH', '青海', 'Qinghai'],
  ['NX', '宁夏', 'Ningxia'],
  ['XJ', '新疆', 'Xinjiang'],
  ['TW', '台湾', 'Taiwan'],
  ['HK', '香港', 'Hong Kong'],
  ['MO', '澳门', 'Macao'],
];

export const SEED_REGIONS: Region[] = REGIONS.map(([suffix, name_zh, name_en], i) => ({
  code: `${GREATER_CHINA}-${suffix}`,
  group_code: GREATER_CHINA,
  name_zh,
  name_en,
  map_id: `${GREATER_CHINA}-${suffix}`,
  sort_order: i + 1,
}));
