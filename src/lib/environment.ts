// 运行环境探测：浏览器、打开方式、网络请求监控、存储能力。供自检页使用（§15.4、§14 R7、§14 Q10）

export interface BrowserInfo {
  /** 中文名称，如「Chrome」「小米浏览器」 */
  name: string;
  version: string;
  os: string;
  /** 是否为本应用支持的浏览器（Chrome / Edge，§10） */
  supported: boolean;
}

const BROWSERS: [RegExp, string][] = [
  [/MicroMessenger\/([\d.]+)/, '微信内置浏览器'],
  [/MiuiBrowser\/([\d.]+)/, '小米浏览器'],
  [/HuaweiBrowser\/([\d.]+)/, '华为浏览器'],
  [/HeyTapBrowser\/([\d.]+)/, 'OPPO 浏览器'],
  [/VivoBrowser\/([\d.]+)/, 'vivo 浏览器'],
  [/SamsungBrowser\/([\d.]+)/, '三星浏览器'],
  [/UCBrowser\/([\d.]+)/, 'UC 浏览器'],
  [/MQQBrowser\/([\d.]+)|QQBrowser\/([\d.]+)/, 'QQ 浏览器'],
  [/Quark\/([\d.]+)/, '夸克浏览器'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/EdgA?\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)/, 'Opera'],
];

export function detectBrowser(ua: string = navigator.userAgent): BrowserInfo {
  const os = /Android/.test(ua)
    ? 'Android'
    : /Windows/.test(ua)
      ? 'Windows'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '未知系统';
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) {
      const version = (m[1] ?? m[2] ?? '').split('.')[0];
      return { name, version, os, supported: name === 'Edge' };
    }
  }
  const chrome = ua.match(/Chrome\/([\d.]+)/);
  if (chrome) {
    // 安卓上 App 内嵌的网页（WebView）也带 Chrome 字样，但带 "wv" 标记
    const webview = /; wv\)/.test(ua);
    return {
      name: webview ? '应用内置浏览器（WebView）' : 'Chrome',
      version: chrome[1].split('.')[0],
      os,
      supported: !webview,
    };
  }
  const safari = ua.match(/Version\/([\d.]+).*Safari/);
  if (safari) return { name: 'Safari', version: safari[1].split('.')[0], os, supported: false };
  return { name: '未知浏览器', version: '', os, supported: false };
}

/** 打开方式：本地文件 / 网址 */
export function describeOrigin(): string {
  switch (location.protocol) {
    case 'file:':
      return '本地文件（file://）';
    case 'content:':
      return '本地文件（content://，由文件管理器转交）';
    case 'http:':
    case 'https:':
      return `网址（${location.host}）`;
    default:
      return location.protocol;
  }
}

// ---------- 网络请求监控 ----------

const external = new Set<string>();
let started = false;

function isExternal(url: string): boolean {
  if (!/^(https?|wss?):/i.test(url)) return false;
  // 开发模式下页面本身来自本机开发服务器，不算外部请求
  if (import.meta.env.DEV && url.startsWith(location.origin)) return false;
  return true;
}

/** 用浏览器的资源计时记录本页面发出的所有请求 */
export function startNetworkMonitor(): void {
  if (started || typeof performance === 'undefined') return;
  started = true;
  const record = (entries: PerformanceEntryList) => {
    for (const e of entries) if (isExternal(e.name)) external.add(e.name);
  };
  record(performance.getEntriesByType('resource'));
  try {
    new PerformanceObserver((list) => record(list.getEntries())).observe({ type: 'resource', buffered: true });
  } catch {
    // 不支持 PerformanceObserver 的浏览器只能看到启动时已有的记录
  }
}

export function externalRequests(): string[] {
  return [...external];
}

// ---------- 存储 ----------

export type PersistState = 'granted' | 'denied' | 'unsupported';

/** 请求「持久化存储」，降低数据被浏览器自动清理的概率（§8.1） */
export async function requestPersistentStorage(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | undefined> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : undefined;
  } catch {
    return undefined;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// ---------- 自动写入数据文件（File System Access API，§8.2） ----------

interface SaveFilePicker {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle & { createWritable(): Promise<WritableStream & { write(data: string): Promise<void> }> }>;
}

export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/** 让用户选一个位置保存测试文件，写入后再读回比对。用户取消时返回 undefined */
export async function testFileWrite(): Promise<boolean | undefined> {
  const text = `Genre Shelf 自检写入测试\n${new Date().toISOString()}\n`;
  let handle;
  try {
    handle = await (window as unknown as SaveFilePicker).showSaveFilePicker({
      suggestedName: 'genre-shelf-自检.txt',
      types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }],
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return undefined;
    throw e;
  }
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  return (await (await handle.getFile()).text()) === text;
}
