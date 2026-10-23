# Genre Shelf

记录「读过的书」的个人单文件网页：世界地图展示阅读分布，表格做筛选与分析。
需求与设计见 [`docs/SPEC.md`](docs/SPEC.md)。

当前进度：**M0 工程搭建**——打开文件看到的是「自检页」，用来确认文件能在电脑和手机上正常打开、保存数据。

---

## 给使用者：怎么打开这个文件

整个应用就是一个文件 `genre-shelf.html`，不需要联网，也不需要安装任何东西。数据保存在打开它的那个浏览器里。

### Windows 电脑

1. 把 `genre-shelf.html` 放到一个**固定的文件夹**里（比如「文档\Genre Shelf」）。以后都从这个位置打开——换了位置，浏览器会把它当成另一个网页，看到的是一份空数据。
2. 在文件上点右键 →「打开方式」→ 选 **Google Chrome** 或 **Microsoft Edge**。

### 安卓手机

1. 用微信「文件传输助手」或网盘把 `genre-shelf.html` 发到手机，下载到手机里。
2. 打开文件时，选择 **Chrome** 打开（小米手机可能默认用「小米浏览器」打开，请在「打开方式」里改选 Chrome）。
3. 同样，以后尽量从同一个位置、用同一个浏览器打开。

### 自检页上要看什么

- 顶部写「全部正常」或「基本正常」即可。
- 「持久化存储：暂未授予」在电脑上常见，不影响使用。
- 「自动写入数据文件：不可用」在手机上属正常。
- 关掉页面再打开一次，「本地数据库」那一项应显示「第 2 次打开」，说明数据能保存下来。
- 点「复制检测结果」，把复制的文字发给开发者。

---

## 给开发者

环境：Node 22。技术选型见规格书 §3。

```bash
npm ci                # 安装依赖
npm run dev           # 开发服务器，打开 http://localhost:5173/genre-shelf.html
npm run build         # 类型检查 + 构建单文件 dist/genre-shelf.html
npm test              # 单元测试（Vitest）
npm run test:e2e      # 端到端测试：用 file:// 打开构建产物，拦截全部网络请求（需先 build）
npm run build:map     # 重新生成底图数据（需要联网，平时不用运行）
```

- **底图**：`scripts/build-map.ts` 从 Natural Earth 1:50m（v5.1.2）生成 `src/data/map/*.topo.json` 与 `src/data/seed/countries-modern.json`，并做一致性检查（§15.2）。生成的文件已提交，构建时不联网。
- **数据层**：`src/data/`——`db.ts`（IndexedDB/Dexie 结构与预设数据写入）、`validate.ts`（§4.2 约束）、`seed/`（预设国家、籍贯、书籍类型）。
- **端到端测试的浏览器**：云端开发环境使用预装的 `/opt/pw-browsers/chromium`，不要运行 `playwright install`；CI 上由工作流自行安装。
- **自动构建**：`.github/workflows/build.yml`。每次推送都会构建并把 `genre-shelf.html` 存为构建产物（在 GitHub 的 Actions 页面下载）；推送 `v*` 标签时发布到 Release。
