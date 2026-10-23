import type { Settings } from '../types';
import { SEED_TIME, SEED_VERSION } from './constants';

export { SEED_TIME, SEED_VERSION } from './constants';
export { SEED_BOOK_TYPES } from './book-types';
export { SEED_COUNTRIES, GREATER_CHINA_MEMBERS } from './countries';
export { SEED_REGIONS } from './regions';

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  low_color: '#3B6FB6',
  high_color: '#C8372D',
  scale_mode: 'rank',
  metric: 'count',
  seed_version: SEED_VERSION,
  updated_at: SEED_TIME,
};
