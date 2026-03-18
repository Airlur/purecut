import { BRIA_MODEL_NAME } from './background-types'

export type ErrorKey = 'clipboard' | 'fileType' | 'processing'
export type FeedbackKey = 'copied' | 'copyFailed' | 'saved'

export const copy = {
  zh: {
    brand: {
      logoAlt: 'PureCut 品牌图标',
      name: 'PureCut',
    },
    hero: {
      badge: 'BRIA 本地引擎',
      title: '本地 AI 图片背景去除',
    },
    uploader: {
      cta: '点击选择或拖拽图片',
      hint: '也可直接粘贴图片（Ctrl + V / Cmd + V）',
      types: '支持 JPG / PNG / WEBP / AVIF',
    },
    actions: {
      copy: '复制 PNG',
      reset: '重新上传',
      save: '下载 PNG',
    },
    progress: {
      complete: '处理完成',
      composite: '正在贴回原图并生成透明 PNG',
      idle: '等待上传',
      inference: 'BRIA 推理中',
      loading: '正在加载 BRIA 模型',
    },
    processing: {
      tip: '首次会先缓存本地模型与运行时资源，请稍等。',
      title: '正在计算',
    },
    metrics: {
      model: '模型耗时',
      modelLabel: '模型',
      modelName: BRIA_MODEL_NAME,
      total: '总耗时',
    },
    errors: {
      clipboard: '无法从剪贴板读取图片',
      fileType: '文件类型不支持，请选择 JPG / PNG / WEBP / AVIF 图片',
      processing: '处理失败，请确认本地模型文件存在，或稍后重试。',
    },
    feedback: {
      copied: '已复制到剪贴板',
      copyFailed: '复制失败，请改为下载 PNG',
      saved: '已下载透明 PNG',
    },
  },
  en: {
    brand: {
      logoAlt: 'PureCut logo',
      name: 'PureCut',
    },
    hero: {
      badge: 'BRIA Local Engine',
      title: 'Local AI Background Remover',
    },
    uploader: {
      cta: 'Click or drop an image',
      hint: 'Clipboard paste works too (Ctrl + V / Cmd + V)',
      types: 'Supports JPG / PNG / WEBP / AVIF',
    },
    actions: {
      copy: 'Copy PNG',
      reset: 'Upload New',
      save: 'Download PNG',
    },
    progress: {
      complete: 'Done',
      composite: 'Compositing the alpha mask back to the original image',
      idle: 'Waiting for an image',
      inference: 'Running BRIA inference',
      loading: 'Loading the BRIA model',
    },
    processing: {
      tip: 'The first request caches the local model and runtime assets.',
      title: 'Processing',
    },
    metrics: {
      model: 'Model Time',
      modelLabel: 'Model',
      modelName: BRIA_MODEL_NAME,
      total: 'Total Time',
    },
    errors: {
      clipboard: 'Could not read an image from the clipboard.',
      fileType: 'Unsupported format. Please use JPG / PNG / WEBP / AVIF.',
      processing: 'Processing failed. Make sure the local model exists, or try again.',
    },
    feedback: {
      copied: 'Copied to clipboard',
      copyFailed: 'Clipboard blocked, please download instead',
      saved: 'PNG saved',
    },
  },
} as const

export type Language = keyof typeof copy
