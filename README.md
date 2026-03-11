# PureCut – 本地 AI 图片背景去除工具

纯前端的本地 AI 抠图工具，基于 Vite + React + TypeScript 构建。所有推理直接在浏览器里完成，`public/models` 中的 RMBG-1.4 模型和 ONNX Runtime Web 运行时会按需下载缓存，图片不会上传到服务端。

## 功能亮点

- ✨ 浏览器侧执行 RMBG-1.4 模型，保障隐私
- 🖼️ 支持拖拽、点击及剪贴板粘贴图片，支持 JPG / PNG / WEBP / AVIF
- 🎯 处理完成后提供重新上传、复制 PNG、下载 PNG
- 📈 显示总耗时 / 模型耗时以及当前模型信息
- 🌐 中英文双语切换

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产包
npm run build
```

> 首次运行时浏览器需要加载模型和 ONNX Runtime 文件，时间会稍长；随后会被缓存。

## 部署指南

下面以 Cloudflare Pages 与 Vercel 为例，分别提供“手动部署”和“一键部署”两种方式。

### Cloudflare Pages

**手动部署**
1. Fork 本项目到自己的仓库中；
2. 在 Cloudflare Pages 新建项目并选择该仓库；
3. Build 命令填 `npm run build`，Output 目录为 `dist`；
4. 保存即可完成部署。

**一键部署**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)

### Vercel

**手动部署**
1. Fork 本项目到自己的仓库中；
2. 在 Vercel 导入该仓库，Build 命令 `npm run build`、Output 目录 `dist`；
3. 提交后即可获得生产环境。

**一键部署**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Airlur/purecut)

## 模型文件说明

- `public/models/*`：RMBG-1.4 模型权重及拆分文件，命名为哈希值以便缓存验证。
- `public/models/onnxruntime-web/*`：ONNX Runtime Web (WASM/WebGPU/WebGL 等) 的运行时代码。ImgLy SDK 依赖这些文件实现浏览器内推理。

部署到云端后，这些文件会作为静态资源，由访问者浏览器在首次使用时下载到本地缓存；推理过程仍在用户浏览器中完成，无需服务器算力。

