import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// 直接用 file:// 打开构建出的单文件（§15.3、§13 验收项 10）
const FILE_URL = pathToFileURL(resolve('dist/genre-shelf.html')).href;

/** 拦截所有非本地请求，记录下来；应用不应发出任何外部请求 */
async function blockNetwork(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.context().route('**/*', (route) => {
    const url = route.request().url();
    if (/^(file|data|blob):/.test(url)) return route.continue();
    external.push(url);
    return route.abort();
  });
  return external;
}

test('自检页：数据库可用、预设数据完整、无外部请求', async ({ page }) => {
  const external = await blockNetwork(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(FILE_URL);
  await expect(page).toHaveURL(/#\/selfcheck$/);
  await expect(page.getByTestId('summary')).toHaveAttribute('data-done', 'true');

  await expect(page.getByTestId('check-db')).toHaveAttribute('data-status', 'ok');
  await expect(page.getByTestId('check-seed')).toHaveAttribute('data-status', 'ok');
  await expect(page.getByTestId('check-seed')).toContainText('国家/地区 257 条（现代 236、历史 20、区域分组 1）');
  await expect(page.getByTestId('check-seed')).toContainText('籍贯 34 项；书籍类型 15 种；书 0 本');
  await expect(page.getByTestId('check-maps')).toHaveAttribute('data-status', 'ok');
  await expect(page.getByTestId('check-network')).toHaveAttribute('data-status', 'ok');
  await expect(page.locator('svg[aria-label="世界地图预览"] path')).toHaveCount(240);
  await expect(page.locator('svg[aria-label="大中华地区省级地图预览"] path')).toHaveCount(34);

  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('重新打开后数据仍在，预设数据不重复写入', async ({ page }) => {
  await blockNetwork(page);
  await page.goto(FILE_URL);
  await expect(page.getByTestId('check-db')).toContainText('第 1 次打开');
  await expect(page.getByTestId('check-seed')).toContainText('首次打开');

  await page.reload();
  await expect(page.getByTestId('check-db')).toContainText('第 2 次打开');
  await expect(page.getByTestId('check-seed')).toContainText('预设数据版本 1');
  await expect(page.getByTestId('check-seed')).toContainText('国家/地区 257 条');
});

test('断网时也能打开', async ({ page, context }) => {
  await blockNetwork(page);
  await context.setOffline(true);
  await page.goto(FILE_URL);
  await expect(page.getByTestId('summary')).toHaveAttribute('data-done', 'true');
  await expect(page.getByTestId('check-seed')).toHaveAttribute('data-status', 'ok');
});
