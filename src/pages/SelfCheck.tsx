import { useEffect, useMemo, useState } from 'react';
import { MapPreview } from '../components/map/MapPreview';
import { loadGreaterChina, loadWorld } from '../data/map';
import { DEFAULT_SETTINGS, GREATER_CHINA_MEMBERS } from '../data/seed';
import { hasFileSystemAccess, testFileWrite } from '../lib/environment';
import {
  checkBrowser,
  checkDatabase,
  checkFileAccess,
  checkMaps,
  checkNetwork,
  checkPersistence,
  checkSeed,
  checkVersion,
  reportText,
  type CheckItem,
  type Status,
} from '../lib/selfcheck';

const STATUS_STYLE: Record<Status, { icon: string; className: string; text: string }> = {
  ok: { icon: '✓', className: 'bg-emerald-600', text: '正常' },
  warn: { icon: '!', className: 'bg-amber-500', text: '注意' },
  fail: { icon: '✕', className: 'bg-red-600', text: '失败' },
  info: { icon: 'i', className: 'bg-stone-500', text: '信息' },
};

const NO_BOOK = '#E4E4E4';

export function SelfCheck() {
  const [items, setItems] = useState<CheckItem[]>(() => [checkVersion(), checkBrowser()]);
  const [done, setDone] = useState(false);
  const [fileTest, setFileTest] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await checkDatabase();
      const seed = await checkSeed();
      const persist = await checkPersistence();
      const rest = [checkFileAccess(), checkMaps()];
      // 等页面完全加载后再统计网络请求
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      setItems((prev) => [...prev, db, seed, persist, ...rest, checkNetwork()]);
      setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const world = useMemo(loadWorld, []);
  const gc = useMemo(loadGreaterChina, []);

  const summary = useMemo(() => {
    const fails = items.filter((i) => i.status === 'fail').length;
    const warns = items.filter((i) => i.status === 'warn').length;
    if (!done) return { className: 'bg-stone-200 text-stone-700', text: '正在检测……' };
    if (fails) return { className: 'bg-red-100 text-red-900', text: `有 ${fails} 项失败，请把检测结果发给开发者` };
    if (warns) return { className: 'bg-amber-100 text-amber-900', text: `基本正常，有 ${warns} 项需要注意` };
    return { className: 'bg-emerald-100 text-emerald-900', text: '全部正常' };
  }, [items, done]);

  async function runFileTest() {
    setFileTest('请在弹出的窗口里选一个位置保存……');
    try {
      const ok = await testFileWrite();
      setFileTest(ok === undefined ? '已取消' : ok ? '✓ 写入并读回成功，自动存档可用' : '✕ 写入后读回的内容不一致');
    } catch (e) {
      setFileTest(`✕ 失败：${String(e)}`);
    }
  }

  async function copyReport() {
    const text = reportText([...items, ...(fileTest ? [{ key: 'fsa-test', title: '写入文件实测', status: 'info' as const, value: fileTest }] : [])]);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-bold">Genre Shelf 自检</h1>
      <p className="mt-2 text-stone-600">这是第一阶段（M0）的测试页面，用来确认这个文件能在你的设备上正常打开和保存数据。</p>

      <div data-testid="summary" data-done={done} className={`mt-5 rounded-xl px-4 py-3 text-xl font-semibold ${summary.className}`}>
        {summary.text}
      </div>

      <ul className="mt-5 space-y-3">
        {items.map((item) => {
          const s = STATUS_STYLE[item.status];
          return (
            <li key={item.key} data-testid={`check-${item.key}`} data-status={item.status} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm">
              <span
                aria-label={s.text}
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${s.className}`}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{item.title}</div>
                <div className="break-words">{item.value}</div>
                {item.note && <div className="mt-1 whitespace-pre-line break-words text-base text-stone-500">{item.note}</div>}
                {item.key === 'fsa' && hasFileSystemAccess() && (
                  <div className="mt-2">
                    <button onClick={runFileTest} className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-2 text-base active:bg-stone-200">
                      测试写入文件
                    </button>
                    {fileTest && <div className="mt-2 text-base">{fileTest}</div>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={copyReport}
        disabled={!done}
        className="mt-5 w-full rounded-xl bg-[#1F4E79] px-4 py-4 text-xl font-semibold text-white disabled:opacity-50 active:opacity-80"
      >
        {copied ? '已复制，可以直接粘贴发给开发者' : '复制检测结果'}
      </button>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">地图预览</h2>
        <p className="mt-1 text-base text-stone-500">只用来确认地图数据完整；缩放、着色和点选在后续阶段实现。</p>
        <div className="mt-3 rounded-xl bg-white p-2 shadow-sm">
          <MapPreview
            features={world}
            projection="world"
            label="世界地图预览"
            fill={(code) => (GREATER_CHINA_MEMBERS.includes(code) ? DEFAULT_SETTINGS.low_color : NO_BOOK)}
          />
          <p className="px-2 pb-1 text-base text-stone-500">蓝色为合并显示的「大中华地区」，灰色为其他国家和地区。</p>
        </div>
        <div className="mt-3 rounded-xl bg-white p-2 shadow-sm">
          <MapPreview features={gc} projection="china" label="大中华地区省级地图预览" fill={() => '#9DB4D3'} />
          <p className="px-2 pb-1 text-base text-stone-500">大中华地区 34 个省级单位。</p>
        </div>
      </section>
    </main>
  );
}
