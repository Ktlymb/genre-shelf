import type { Country } from '../types';
import { GREATER_CHINA } from '../types';
import { SEED_TIME } from './constants';
// 由 scripts/build-map.ts 从 Natural Earth 生成：世界底图上的全部国家/地区代码与名称
import modernNames from './countries-modern.json';

/** 被「大中华地区」合并显示的色块；不可直接选择（§4.6） */
export const GREATER_CHINA_MEMBERS = ['CN', 'TW', 'HK', 'MO'];

const GROUPS: Country[] = [
  {
    code: GREATER_CHINA,
    name_zh: '大中华地区',
    name_en: 'Greater China',
    kind: 'group',
    map_codes: GREATER_CHINA_MEMBERS,
    merge_display: true,
    selectable: true,
    sort_order: 1,
    updated_at: SEED_TIME,
  },
];

// §4.5 历史国家与已消失的政权
const HISTORICAL: [code: string, name_zh: string, name_en: string, from: number, to: number, map_codes: string[]][] = [
  ['YU', '南斯拉夫联盟', 'Federal Republic of Yugoslavia', 1992, 2003, ['RS', 'ME', 'XK']],
  ['YUS', '南斯拉夫社会主义联邦共和国', 'Socialist Federal Republic of Yugoslavia', 1945, 1992, ['SI', 'HR', 'BA', 'RS', 'ME', 'XK', 'MK']],
  ['CSK', '塞尔维亚和黑山', 'Serbia and Montenegro', 2003, 2006, ['RS', 'ME', 'XK']],
  ['SU', '苏联', 'Soviet Union', 1922, 1991, ['RU', 'UA', 'BY', 'MD', 'LT', 'LV', 'EE', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'TM', 'KG', 'TJ']],
  ['CS', '捷克斯洛伐克', 'Czechoslovakia', 1918, 1992, ['CZ', 'SK']],
  ['DDR', '东德', 'East Germany', 1949, 1990, ['DE']],
  ['FRG', '西德', 'West Germany', 1949, 1990, ['DE']],
  ['AH', '奥匈帝国', 'Austria-Hungary', 1867, 1918, ['AT', 'HU', 'CZ', 'SK', 'SI', 'HR', 'BA']],
  ['AUE', '奥地利帝国', 'Austrian Empire', 1804, 1867, ['AT', 'HU', 'CZ', 'SK', 'SI', 'HR']],
  ['PLC', '波兰立陶宛联邦', 'Polish–Lithuanian Commonwealth', 1569, 1795, ['PL', 'LT', 'BY', 'UA']],
  ['HRE', '神圣罗马帝国', 'Holy Roman Empire', 962, 1806, ['DE', 'AT', 'CZ']],
  ['RUE', '俄罗斯帝国', 'Russian Empire', 1721, 1917, ['RU', 'UA', 'BY']],
  ['OTT', '奥斯曼帝国', 'Ottoman Empire', 1299, 1922, ['TR']],
  ['BYZ', '拜占庭帝国', 'Byzantine Empire', 395, 1453, ['TR', 'GR']],
  ['BRI', '英属印度', 'British India', 1858, 1947, ['IN', 'PK', 'BD']],
  ['GRC', '古希腊', 'Ancient Greece', -800, -146, ['GR']],
  ['ROM', '古罗马', 'Ancient Rome', -753, 476, ['IT']],
  ['AEG', '古埃及', 'Ancient Egypt', -3100, -30, ['EG']],
  ['PER', '古波斯', 'Ancient Persia', -550, 651, ['IR']],
  ['MES', '美索不达米亚（苏美尔、巴比伦等）', 'Mesopotamia', -3500, -539, ['IQ']],
];

const collator = new Intl.Collator('zh-Hans-CN');

const MODERN: Country[] = [...modernNames]
  .sort((a, b) => collator.compare(a.name_zh, b.name_zh))
  .map(({ code, name_zh, name_en }, i) => {
    const member = GREATER_CHINA_MEMBERS.includes(code);
    return {
      code,
      name_zh,
      name_en,
      kind: 'modern',
      map_codes: [code],
      merge_display: false,
      selectable: !member,
      ...(member ? { group_code: GREATER_CHINA } : {}),
      sort_order: 100 + i,
      updated_at: SEED_TIME,
    };
  });

export const SEED_COUNTRIES: Country[] = [
  ...GROUPS,
  ...MODERN,
  ...HISTORICAL.map(([code, name_zh, name_en, valid_from, valid_to, map_codes], i): Country => ({
    code,
    name_zh,
    name_en,
    kind: 'historical',
    valid_from,
    valid_to,
    map_codes,
    merge_display: false,
    selectable: true,
    sort_order: 1000 + i,
    updated_at: SEED_TIME,
  })),
];
