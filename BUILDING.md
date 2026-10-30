# 运行与开发

本开源版本以 `2.7.0-policy.9` 的独立服务器版本为基准，包含完整前端、政策检索与分类评价后端。
七个前端资源和主要业务模块与同版本公网适配版一致；保留独立版的来源校验、访客会话和报告缓存隔离。
这次发布不修改业务算法、页面或内置依据内容。

## 本地启动

安装 Node.js 22.13 或更新版本，在项目根目录运行：

```sh
npm start
```

打开 <http://127.0.0.1:3327>。运行和测试只使用 Node.js 内置模块，无需安装 npm 第三方依赖。
Windows 也可运行 `launch.ps1`；`-NoBrowser` 参数禁止自动打开浏览器，`-Port` 可以指定端口。

## 可选模型配置

将 `.env.example` 复制为本地 `.env`，填入你自己的服务端配置：

```dotenv
AGRIMATCH_API_KEY=
AGRIMATCH_API_BASE=https://api.deepseek.com
AGRIMATCH_MODEL=deepseek-flash
PORT=3327
```

模型名称应按本人服务商账号实际支持的名称填写；保留的原配置不代表所有账号都可使用该模型。
密钥仅由服务端读取，`.env` 不提交到仓库。也支持通过 `DEEPSEEK_API_KEY` 提供密钥。

没有模型密钥时仍可查看既有依据、执行检索流程并生成可用的条件与下一步资料说明；模型整理能力不可用时会明确回退。
需要联网的检索、统计和模型调用取决于对应服务的可用状态，离线测试通过不代表真实服务调用已经通过。

## 功能结构

- `public/`：查询、记录、分类评价和界面资源。
- `catalog.mjs`、`country-*.mjs`、`provinces.mjs`：国家、产品与地区目录。
- `policy-engine.mjs`、`policy-research.mjs`、`policy-sources.mjs`：检索、来源核对和政策结果组织。
- `policy-brief.mjs`、`policy-frameworks.mjs`、`policy-cases.mjs`：模块简报与条件讨论。
- `evaluation-agent.mjs`、`evaluation-cases.mjs`：统计证据及五维条件评价。
- `verified-evidence.mjs`、`data/verified-trade-snapshots.json`：注明来源和日期的保存依据。
- `deployment.mjs`、`server.mjs`：HTTP、访问方式、同源和访客隔离。
- `tests/`：原有自动化检查。

目录包含 92 个国家入口、六类政策模块与五个评价维度；目录覆盖不表示已取得所有国家和所有产品的专项依据。
原始数据、计算和条件判断的边界见 [SOURCES.md](SOURCES.md)。

## 检查

```sh
npm run check
npm test
```

自动测试使用样例响应、模拟网络与独立本机 HTTP 服务，不需要真实模型密钥。
测试中出现的 `test-only`、示例评委密码和 `example` 域名都是测试夹具。
发布时未进行真实政策逐条复核、真实模型付费调用或云服务器上线验证。

公网运行方式见 [DEPLOYMENT.md](DEPLOYMENT.md)。这次 GitHub 发布的是源码，不会自动创建或购买云资源。
