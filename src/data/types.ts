// 数据结构，对应规格书 §4.2。字段名沿用 snake_case。

/** 应用设置（只有一条） */
export interface Settings {
  id: 'main';
  low_color: string;
  high_color: string;
  mid_color?: string;
  scale_mode: 'rank' | 'log' | 'linear';
  metric: 'count' | 'words';
  /** 本机状态，不随合并导入 */
  last_backup_at?: string;
  /** 本机状态，不随合并导入 */
  seed_version: number;
  updated_at: string;
}

/** 国家/地区：现代国家、历史国家、区域分组 */
export interface Country {
  code: string;
  name_zh: string;
  name_en: string;
  kind: 'modern' | 'historical' | 'group';
  valid_from?: number;
  valid_to?: number;
  /** 在世界地图上给哪些色块着色 */
  map_codes: string[];
  /** true：世界地图上把 map_codes 合并为一个单元（§5.5 规则 A） */
  merge_display: boolean;
  /** false：不出现在录书的国家下拉里 */
  selectable: boolean;
  group_code?: string;
  sort_order: number;
  updated_at: string;
  deleted_at?: string;
}

/** 下级区域（大中华 34 个省级单位）。只读预设 */
export interface Region {
  code: string;
  group_code: string;
  name_zh: string;
  name_en: string;
  /** 对应二级底图中色块的编号 */
  map_id: string;
  sort_order: number;
}

export interface Synced {
  /** ULID；预设书籍类型用固定 ID（type-XXXX） */
  id: string;
  updated_at: string;
  /** 软删除标记，保留 90 天 */
  deleted_at?: string;
}

export interface BookType extends Synced {
  /** 四位大写字母，唯一 */
  code: string;
  name_zh: string;
  bg_color: string;
  sort_order: number;
}

export interface Author extends Synced {
  /** 唯一（忽略大小写与空白） */
  name: string;
  name_original?: string;
  country_code?: string;
  /** 籍贯，仅当归属为「大中华地区」 */
  region_code?: string;
}

export interface Book extends Synced {
  title: string;
  original_title?: string;
  /** 至少一位，有序，第一位为第一作者 */
  author_ids: string[];
  country_code: string;
  region_code?: string;
  type_id: string;
  word_count?: number;
  year_written?: number;
  year_approx: boolean;
  translators: string[];
  publisher?: string;
  /** YYYY-MM-DD */
  finished_on?: string;
  status: 'reading' | 'finished';
  rating?: 1 | 2 | 3 | 4 | 5;
  isbn?: string;
  notes?: string;
  created_at: string;
}

export interface SavedView extends Synced {
  name: string;
  config: unknown;
  position: number;
}

/** 「大中华地区」分组的代码 */
export const GREATER_CHINA = 'GC';
