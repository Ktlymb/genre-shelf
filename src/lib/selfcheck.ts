// 自检项目（§15.4）：每一项给出状态、结果与说明，供自检页显示，也可复制成文字发给开发者
import Dexie, { type EntityTable } from 'dexie';
import { ensureSeed, getDb } from '../data/db';
import { loadGreaterChina, loadWorld } from '../data/map';
import { SEED_BOOK_TYPES, SEED_COUNTRIES, SEED_REGIONS, SEED_VERSION } from '../data/seed';
import {
  describeOrigin,
  detectBrowser,
  externalRequests,
  formatBytes,
  hasFileSystemAccess,
  requestPersistentStorage,
  storageEstimate,
} from './environment';

export type Status = 'ok' | 'warn' | 'fail' | 'info';

export interface CheckItem {
  key: string;
  title: string;
  status: Status;
  value: string;
  note?: string;
}

/** 单独的小数据库：做读写测试，并记录打开次数（用来确认关掉再打开后数据还在） */
class ProbeDB extends Dexie {
  kv!: EntityTable<{ key: string; value: number }, 'key'>;
  constructor() {
    super('genre-shelf-selfcheck');
    this.version(1).stores({ kv: 'key' });
  }
}

export function checkVersion(): CheckItem {
  const b = __BUILD_INFO__;
  const time = new Date(b.time).toLocaleString('zh-CN', { hour12: false });
  return { key: 'version', title: '版本', status: 'info', value: `${b.version}（${b.commit}）`, note: `构建时间：${time}` };
}

export function checkBrowser(): CheckItem {
  const b = detectBrowser();
  const value = `${b.name}${b.version ? ' ' + b.version : ''} · ${b.os}`;
  return b.supported
    ? { key: 'browser', title: '浏览器', status: 'ok', value, note: describeOrigin() }
    : {
        key: 'browser',
        title: '浏览器',
        status: 'warn',
        value,
        note: `${describeOrigin()}。本应用以 Chrome（电脑上也可用 Edge）为准，请改用 Chrome 打开这个文件`,
      };
}

export async function checkDatabase(): Promise<CheckItem> {
  if (typeof indexedDB === 'undefined') {
    return { key: 'db', title: '本地数据库', status: 'fail', value: '不可用', note: '这个浏览器不支持 IndexedDB' };
  }
  try {
    const probe = new ProbeDB();
    const opens = ((await probe.kv.get('opens'))?.value ?? 0) + 1;
    await probe.kv.put({ key: 'opens', value: opens });
    const readBack = (await probe.kv.get('opens'))?.value;
    probe.close();
    if (readBack !== opens) throw new Error('写入后读回的值不一致');
    return {
      key: 'db',
      title: '本地数据库',
      status: 'ok',
      value: '可读写',
      note:
        opens === 1
          ? '这是第 1 次打开。关掉页面再打开，这里应显示「第 2 次」，说明数据能保存下来'
          : `这是第 ${opens} 次打开，上次的数据还在`,
    };
  } catch (e) {
    return { key: 'db', title: '本地数据库', status: 'fail', value: '不可用', note: String(e) };
  }
}

export async function checkSeed(): Promise<CheckItem> {
  try {
    const result = await ensureSeed();
    const db = getDb();
    const countries = await db.countries.toArray();
    const by = (k: string) => countries.filter((c) => c.kind === k).length;
    const regions = await db.regions.count();
    const types = await db.book_types.count();
    const books = await db.books.count();
    const settings = await db.settings.get('main');
    const value =
      `国家/地区 ${countries.length} 条（现代 ${by('modern')}、历史 ${by('historical')}、区域分组 ${by('group')}）；` +
      `籍贯 ${regions} 项；书籍类型 ${types} 种；书 ${books} 本`;
    const complete =
      countries.length >= SEED_COUNTRIES.length && regions >= SEED_REGIONS.length && types >= SEED_BOOK_TYPES.length;
    return {
      key: 'seed',
      title: '预设数据',
      status: complete && settings?.seed_version === SEED_VERSION ? 'ok' : 'fail',
      value,
      note: result.fresh ? `首次打开，已写入预设数据（版本 ${SEED_VERSION}）` : `预设数据版本 ${settings?.seed_version}`,
    };
  } catch (e) {
    return { key: 'seed', title: '预设数据', status: 'fail', value: '写入失败', note: String(e) };
  }
}

export async function checkPersistence(): Promise<CheckItem> {
  const state = await requestPersistentStorage();
  const est = await storageEstimate();
  const usage = est ? `已用 ${formatBytes(est.usage)}，可用上限约 ${formatBytes(est.quota)}` : undefined;
  if (state === 'granted') return { key: 'persist', title: '持久化存储', status: 'ok', value: '已授予', note: usage };
  return {
    key: 'persist',
    title: '持久化存储',
    status: 'warn',
    value: state === 'denied' ? '暂未授予' : '不支持',
    note:
      '数据仍然保存在本机，只是浏览器在空间紧张时可能清理它。正式使用后请定期导出备份' + (usage ? `。${usage}` : ''),
  };
}

export function checkFileAccess(): CheckItem {
  if (hasFileSystemAccess()) {
    return {
      key: 'fsa',
      title: '自动写入数据文件',
      status: 'ok',
      value: '可用',
      note: '可以点下面的按钮实测一次：选一个位置保存测试文件',
    };
  }
  const mobile = /Android|iPhone|iPad/.test(navigator.userAgent);
  return {
    key: 'fsa',
    title: '自动写入数据文件',
    status: mobile ? 'info' : 'warn',
    value: '不可用',
    note: mobile ? '手机浏览器不支持，属正常情况；手机上用「导出/导入备份」同步' : '请用电脑上的 Chrome 或 Edge 打开',
  };
}

export function checkMaps(): CheckItem {
  try {
    const t0 = performance.now();
    const world = loadWorld();
    const gc = loadGreaterChina();
    const ms = Math.round(performance.now() - t0);
    const ok = world.features.length === 240 && gc.features.length === 34;
    return {
      key: 'maps',
      title: '地图数据',
      status: ok ? 'ok' : 'fail',
      value: `世界 ${world.features.length} 个色块；大中华 ${gc.features.length} 个省级单位`,
      note: `解析用时 ${ms} 毫秒`,
    };
  } catch (e) {
    return { key: 'maps', title: '地图数据', status: 'fail', value: '解析失败', note: String(e) };
  }
}

export function checkNetwork(): CheckItem {
  const list = externalRequests();
  return list.length === 0
    ? { key: 'network', title: '外部网络请求', status: 'ok', value: '0 个', note: '应用不连接任何服务器' }
    : { key: 'network', title: '外部网络请求', status: 'fail', value: `${list.length} 个`, note: list.join('\n') };
}

const STATUS_TEXT: Record<Status, string> = { ok: '正常', warn: '注意', fail: '失败', info: '信息' };

export function reportText(items: CheckItem[]): string {
  const lines = items.map((i) => `【${STATUS_TEXT[i.status]}】${i.title}：${i.value}${i.note ? `\n    ${i.note}` : ''}`);
  return ['Genre Shelf 自检结果', new Date().toLocaleString('zh-CN', { hour12: false }), ...lines, `UA：${navigator.userAgent}`].join(
    '\n',
  );
}
