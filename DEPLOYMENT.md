# 独立服务器运行

## 默认本地模式

`npm start` 默认只监听 `127.0.0.1`，端口为 `3327`。
普通本地模式不要求评委账号。服务端报告按访客会话隔离，30 分钟失效，每个会话最多保留 12 份报告；前端历史保留在访问者浏览器内。

## Docker

仓库包含 Dockerfile：

```sh
docker build -t agrimatch-ai .
docker run --rm -p 8080:8080 --env-file .env agrimatch-ai
```

镜像默认以非特权 `node` 用户运行，监听容器 `8080`，并显式启用匿名公开模式。
健康检查为 `GET /health`。本次没有构建或实际运行 Docker 镜像。

## 公网模式参数

| 变量 | 用途 |
| --- | --- |
| `DEPLOYMENT_MODE=cloud` | 启用独立服务器模式 |
| `PUBLIC_ACCESS=true` | 显式允许匿名公开访问 |
| `HOST=0.0.0.0` | 监听容器或服务器接口 |
| `PORT=8080` | HTTP 端口，可按平台调整 |
| `PUBLIC_ORIGIN` | 实际访问源，例如 `https://your-domain.example` |
| `JUDGE_USERNAME`、`JUDGE_PASSWORD` | 可选的访问账号，须成对设置 |
| `AGRIMATCH_API_KEY` 等 | 可选的本人服务端模型配置 |

不启用匿名模式的云端运行要求评委账号和至少 16 位密码；设置账号后，即使启用匿名模式变量，应用仍会校验账号。
允许使用明确配置的公网 IPv4 HTTP 地址作为演示入口，长期服务可以通过自己的 HTTPS 反向代理访问。
`PUBLIC_ORIGIN` 不包含路径、查询参数或凭据。

同源校验、访客 HttpOnly Cookie 与会话报告隔离由当前代码保留，不需要关闭这些检查来部署。
部署服务、模型用量与运行资源由使用者自己的配置决定。本仓库没有提供真实 API 密钥、评委账号密码或可用公网服务器。
