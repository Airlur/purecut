# PureCut – 本地 AI 图片背景去除工具

PureCut 是一个纯前端的本地 AI 抠图工具，基于 Vite + React + TypeScript 构建。图片处理直接在浏览器中完成，图片不会上传到服务端。

## 功能亮点

- 浏览器本地推理，兼顾隐私与易用性
- 支持拖拽、点击上传和剪贴板粘贴
- 支持 JPG / PNG / WEBP / AVIF
- 处理完成后可对比预览、复制 PNG、下载 PNG
- 首次加载模型后会缓存到浏览器，后续使用更快

## 资源准备与本地开发

本地开发和 Cloudflare 部署都需要先准备下面这些静态文件。本仓库不直接附带 BRIA 模型权重，请自行从官方来源下载。

需要的文件如下：

```text
model_fp16.onnx
ort.webgpu.min.mjs
ort-wasm-simd-threaded.asyncify.mjs
ort-wasm-simd-threaded.asyncify.wasm
ort-wasm-simd-threaded.jsep.mjs
ort-wasm-simd-threaded.jsep.wasm
ort-wasm-simd-threaded.mjs
ort-wasm-simd-threaded.wasm
```

下载地址：

- BRIA 模型
  - [模型页面](https://huggingface.co/briaai/RMBG-1.4)
  - [BRIA 许可协议](https://huggingface.co/briaai/RMBG-1.4/resolve/main/License.pdf?download=true)
  - [下载 model_fp16.onnx](https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_fp16.onnx?download=true)
- ORT 运行时（`onnxruntime-web@1.24.3`）
  - [npm 包页面](https://www.npmjs.com/package/onnxruntime-web/v/1.24.3?activeTab=code)
  - [npm 资产包](https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.24.3.tgz)
  - [下载 ort.webgpu.min.mjs](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.webgpu.min.mjs)
  - [下载 ort-wasm-simd-threaded.asyncify.mjs](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.mjs)
  - [下载 ort-wasm-simd-threaded.asyncify.wasm](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.asyncify.wasm)
  - [下载 ort-wasm-simd-threaded.jsep.mjs](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.jsep.mjs)
  - [下载 ort-wasm-simd-threaded.jsep.wasm](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.jsep.wasm)
  - [下载 ort-wasm-simd-threaded.mjs](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.mjs)
  - [下载 ort-wasm-simd-threaded.wasm](https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.wasm)

本地开发时，项目默认从 `public/` 下读取资源。请创建以下目录并放入对应文件：

```text
public/
  briaai/
    RMBG-1.4/
      onnx/
        model_fp16.onnx
  ort/
    ort.webgpu.min.mjs
    ort-wasm-simd-threaded.asyncify.mjs
    ort-wasm-simd-threaded.asyncify.wasm
    ort-wasm-simd-threaded.jsep.mjs
    ort-wasm-simd-threaded.jsep.wasm
    ort-wasm-simd-threaded.mjs
    ort-wasm-simd-threaded.wasm
```

默认读取路径如下：

```bash
VITE_BRIA_MODEL_BASE_URL=/briaai/RMBG-1.4/onnx/
VITE_ORT_BASE_URL=/ort/
```

本地开发不需要手动配置这两个环境变量。只有在下面两种情况，你才需要自己配置：
- 你不想把资源放在上面的 `public/` 默认目录
- 你想在本地直接连外部模型地址或 R2 地址测试

需要覆盖默认值时，可以创建 `.env.local`：

```bash
VITE_BRIA_MODEL_BASE_URL=https://example.com/
VITE_ORT_BASE_URL=https://example.com/
```

启动开发环境：

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

首次处理时，浏览器会先下载并初始化模型与 ORT，时间会比后续使用更长；命中缓存后会明显更快。

## Cloudflare 自定义部署

前端部署到 Cloudflare Pages，模型和 ORT 资源由你自己上传到 R2。

**部署入口**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)

**部署步骤**

1. Fork 本项目到自己的 GitHub 仓库。
2. 在 Cloudflare Pages 创建项目并连接该仓库。
3. Build 命令填写 `npm run build`，Output 目录填写 `dist`。
4. 在 Cloudflare 创建一个 R2 bucket，例如 `purecut-assets`。
5. 把上面列出的 8 个文件直接上传到 bucket 根目录。
6. 在 R2 bucket 的 `Settings -> Custom Domains` 中绑定你的资源域名，例如 `assets.example.com`。
7. 在 R2 的 `CORS 策略` 中填入以下配置：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

8. 回到 Pages 项目，添加以下环境变量，即第 6 步配置的自定义域名。

```bash
VITE_BRIA_MODEL_BASE_URL=https://assets.example.com/
VITE_ORT_BASE_URL=https://assets.example.com/
```

9. 保存并重新部署。

## 常见问题

**ORT 是什么？**  
ORT 指的是 ONNX Runtime Web。它是浏览器里执行 ONNX 模型的运行时引擎，不是模型本身。`model_fp16.onnx` 是模型，ORT 负责在浏览器中真正执行它。

**模型会上传到服务器吗？**  
不会。图片处理在浏览器本地完成，图片本身不会上传到服务端。

**部署到云端后，模型还是会下载到浏览器吗？**  
会。用户首次访问页面时，浏览器会请求模型和 ORT 资源并完成初始化，这也是首次处理更慢的原因。后续通常会命中浏览器缓存。

**为什么首次处理更慢？**  
因为浏览器第一次需要下载并初始化模型和 ORT。资源缓存后，后续体验会更快。

## 第三方模型与许可证

本仓库代码采用 Apache License 2.0。第三方模型与运行时不属于本仓库代码协议覆盖范围。

- BRIA `RMBG-1.4` 模型权重、模型卡与许可归 BRIA AI 所有。使用、部署、再分发或商用前，请先阅读其官方许可：[License.pdf](https://huggingface.co/briaai/RMBG-1.4/resolve/main/License.pdf?download=true)。
- `onnxruntime-web` 来自 Microsoft 的 ONNX Runtime 项目，采用 [MIT License](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)。

