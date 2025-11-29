import { removeBackground } from '@imgly/background-removal'
import { saveAs } from 'file-saver'
import {
  Copy as CopyIcon,
  Download,
  Languages,
  Loader2,
  RotateCcw,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { useDropzone } from 'react-dropzone'

type StageKey =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'inference'
  | 'mask'
  | 'encode'
  | 'complete'

type ErrorKey = 'fileType' | 'processing' | 'clipboard'
type FeedbackKey = 'copied' | 'copyFailed' | 'saved'
type Language = keyof typeof copy

const copy = {
  zh: {
    brand: {
      name: 'PureCut',
      tagline: '本地 AI 图片背景去除',
      logoAlt: 'PureCut 品牌图标',
    },
    hero: {
      title: '本地 AI 图片背景去除',
      subtitle: '',
      badge: '本地 AI 引擎',
    },
    uploader: {
      cta: '点击选择或拖拽图片',
      types: '支持 JPG / PNG / WEBP / AVIF',
      hint: '也可直接粘贴图片（Ctrl + V / Cmd + V）',
    },
    actions: {
      reset: '重新上传',
      copy: '复制 PNG',
      save: '下载 PNG',
    },
    progress: {
      idle: '等待上传',
      queued: '正在唤醒模型...',
      downloading: '正在加载模型参数（首次需缓存模型）',
      inference: 'AI 推理中 · 正在抠出前景',
      mask: '正在融合透明通道',
      encode: '正在编码 PNG 输出',
      complete: '处理完成',
    },
    processing: {
      title: '正在计算',
      tip: '首次需要缓存模型，请耐心等待',
    },
    metrics: {
      total: '总耗时',
      model: '模型耗时',
      modelLabel: '模型',
      modelName: 'RMBG-1.4 / medium',
    },
    errors: {
      fileType: '文件类型不支持，请选择 JPG / PNG / WEBP / AVIF 图片',
      processing: '处理失败，请重试或尝试更小的图片',
      clipboard: '无法从剪贴板读取图片',
    },
    feedback: {
      copied: '已复制到剪贴板',
      copyFailed: '复制失败，请改为下载 PNG',
      saved: '已下载透明 PNG',
    },
  },
  en: {
    brand: {
      name: 'PureCut',
      tagline: 'Local AI background remover',
      logoAlt: 'PureCut logo',
    },
    hero: {
      title: 'Local AI Background Remover',
      subtitle: '',
      badge: 'Local AI Engine',
    },
    uploader: {
      cta: 'Click or drop an image',
      types: 'Supports JPG / PNG / WEBP / AVIF',
      hint: 'Clipboard paste works too (Ctrl + V / Cmd + V)',
    },
    actions: {
      reset: 'Upload New',
      copy: 'Copy PNG',
      save: 'Download PNG',
    },
    progress: {
      idle: 'Waiting for an image',
      queued: 'Booting the model...',
      downloading: 'Loading weights (first load caches the model)',
      inference: 'Running inference…',
      mask: 'Blending alpha mask…',
      encode: 'Encoding PNG output…',
      complete: 'Done',
    },
    processing: {
      title: 'Processing',
      tip: 'The first request caches the model locally.',
    },
    metrics: {
      total: 'Total Time',
      model: 'Model Time',
      modelLabel: 'Model',
      modelName: 'RMBG-1.4 / medium',
    },
    errors: {
      fileType: 'Unsupported format. Please use JPG / PNG / WEBP / AVIF.',
      processing: 'Processing failed. Try again or use a smaller file.',
      clipboard: 'Could not read an image from the clipboard.',
    },
    feedback: {
      copied: 'Copied to clipboard',
      copyFailed: 'Clipboard blocked, please download instead',
      saved: 'PNG saved',
    },
  },
} as const

function App() {
  const [lang, setLang] = useState<Language>('zh')
  const t = copy[lang]
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [stage, setStage] = useState<StageKey>('idle')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [fileName, setFileName] = useState<string>('result')
  const [timings, setTimings] = useState({ totalMs: 0, modelMs: 0 })
  const [uploaderError, setUploaderError] = useState<{ key: ErrorKey; details?: string } | null>(null)
  const [feedback, setFeedback] = useState<{ key: FeedbackKey; tone: 'positive' | 'negative' } | null>(
    null,
  )

  useEffect(() => {
    if (!feedback) return
    const timeout = setTimeout(() => setFeedback(null), 2600)
    return () => clearTimeout(timeout)
  }, [feedback])

  const clearPreview = useCallback(
    (setter: Dispatch<SetStateAction<string | null>>, value: string | null) => {
      setter((prev) => {
        if (typeof prev === 'string') URL.revokeObjectURL(prev)
        return value
      })
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl, sourceUrl])

  const modelBasePath = useMemo(() => {
    if (typeof window === 'undefined') return '/models/'
    const base = import.meta.env.BASE_URL ?? '/'
    const baseUrl = new URL(base, window.location.origin)
    return new URL('models/', baseUrl).toString()
  }, [])

  const processImage = useCallback(
    async (file: File) => {
      setUploaderError(null)
      setStatus('processing')
      setStage('queued')
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'result')
      const newSourceUrl = URL.createObjectURL(file)
      clearPreview(setSourceUrl, newSourceUrl)
      clearPreview(setResultUrl, null)
      setResultBlob(null)

      const startedAt = performance.now()
      let inferenceStart = 0
      let inferenceEnd = 0

      try {
        const blob = await removeBackground(file, {
          publicPath: modelBasePath,
          model: 'isnet_fp16',
          progress: (key) => {
            if (typeof key === 'string' && key.startsWith('download')) {
              setStage('downloading')
              return
            }
            if (key === 'compute:inference') {
              inferenceStart = performance.now()
              setStage('inference')
              return
            }
            if (key === 'compute:mask') {
              inferenceEnd = performance.now()
              setStage('mask')
              return
            }
            if (key === 'compute:encode') {
              if (inferenceStart && !inferenceEnd) {
                inferenceEnd = performance.now()
              }
              setStage('encode')
              return
            }
          },
        })

        const finishedAt = performance.now()
        if (inferenceStart && !inferenceEnd) {
          inferenceEnd = finishedAt
        }
        setStage('complete')
        setStatus('done')
        setResultBlob(blob)
        const newResultUrl = URL.createObjectURL(blob)
        clearPreview(setResultUrl, newResultUrl)
        const totalMs = Math.round(finishedAt - startedAt)
        const modelMs =
          inferenceStart && inferenceEnd
            ? Math.max(0, Math.round(inferenceEnd - inferenceStart))
            : totalMs
        setTimings({
          totalMs,
          modelMs,
        })
      } catch (err) {
        console.error(err)
        setStatus('error')
        setStage('idle')
        setUploaderError({ key: 'processing' })
      }
    },
    [clearPreview, modelBasePath],
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted?.[0]) {
        processImage(accepted[0])
      }
    },
    [processImage],
  )

  const onDropRejected = useCallback(() => {
    setUploaderError({ key: 'fileType' })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/avif': ['.avif'],
    },
    multiple: false,
    maxFiles: 1,
    onDrop,
    onDropRejected,
  })

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/'),
      )
      if (!item) {
        return
      }
      const file = item.getAsFile()
      if (file) {
        processImage(file)
      } else {
        setUploaderError({ key: 'clipboard' })
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [processImage])

  const reset = useCallback(() => {
    clearPreview(setSourceUrl, null)
    clearPreview(setResultUrl, null)
    setResultBlob(null)
    setStatus('idle')
    setStage('idle')
    setUploaderError(null)
    setTimings({ totalMs: 0, modelMs: 0 })
  }, [clearPreview])

  const handleCopy = useCallback(async () => {
    if (!resultBlob) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [resultBlob.type]: resultBlob,
        }),
      ])
      setFeedback({ key: 'copied', tone: 'positive' })
    } catch (err) {
      console.warn('Clipboard copy failed', err)
      setFeedback({ key: 'copyFailed', tone: 'negative' })
    }
  }, [resultBlob])

  const handleSave = useCallback(() => {
    if (!resultBlob) return
    saveAs(resultBlob, `${fileName || 'result'}.png`)
    setFeedback({ key: 'saved', tone: 'positive' })
  }, [fileName, resultBlob])

  const stageLabel = t.progress[stage]
  const errorMessage = uploaderError ? t.errors[uploaderError.key] : null
  const feedbackMessage = feedback ? t.feedback[feedback.key] : null
  const isProcessing = status === 'processing'
  const isReady = status === 'done' && !!resultUrl && !!sourceUrl
  const nextLanguageLabel = lang === 'zh' ? 'EN' : '中文'

  const [imageRatio, setImageRatio] = useState(4 / 3)

  useEffect(() => {
    if (!sourceUrl) {
      setImageRatio(4 / 3)
      return
    }
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setImageRatio(img.naturalWidth / img.naturalHeight)
      }
    }
    img.src = sourceUrl
    return () => {
      img.onload = null
    }
  }, [sourceUrl])

  const baseViewerClass =
    'relative w-full max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/80'
  const viewerShellClass = 'flex h-full w-full items-center justify-center'
  return (
    <div className="h-screen bg-brand-gray overflow-hidden">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-0">
        <header className="flex flex-none items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt={t.brand.logoAlt} className="h-12 w-12" />
            <p className="text-2xl font-semibold text-brand-dark">{t.brand.name}</p>
          </div>
          <button
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand-blue hover:bg-brand-blue/10"
            onClick={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))}
          >
            <Languages size={16} />
            {nextLanguageLabel}
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="text-center">
            <div className="inline-flex items:center justify-center gap-2 rounded-full bg-brand-blue/10 px-4 py-1 text-sm font-medium text-brand-blue">
              <Sparkles size={16} />
              {t.hero.badge}
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-brand-dark sm:text-5xl">{t.hero.title}</h1>
          </div>

          <section className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 min-h-[340px] max-h-[calc(100vh-320px)]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 min-h-0">
                {status === 'idle' && (
                  <div className={viewerShellClass}>
                    <div
                      {...getRootProps({
                        className: `${baseViewerClass} flex w-full max-h-full cursor-pointer flex-col items-center justify-center border-dashed px-6 py-8 text-center transition hover:border-brand-blue hover:bg-brand-blue/5 ${
                          isDragActive ? 'border-brand-blue bg-brand-blue/10' : ''
                        }`,
                        style: { aspectRatio: '4 / 3' },
                      })}
                    >
                      <input {...getInputProps()} />
                      <UploadCloud size={52} className="text-brand-blue" />
                      <p className="mt-4 text-xl font-semibold text-brand-dark">{t.uploader.cta}</p>
                      <p className="text-sm text-brand-slate">{t.uploader.types}</p>
                      <p className="text-xs text-brand-slate/80">{t.uploader.hint}</p>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className={viewerShellClass}>
                    <div
                      className={`${baseViewerClass} flex w-full max-h-full flex-col items-center justify-center`}
                      style={{ aspectRatio: '4 / 3' }}
                    >
                      <Loader2 className="h-12 w-12 animate-spin text-brand-blue" />
                      <p className="mt-4 text-lg font-semibold text-brand-dark">{t.processing.title}</p>
                      <p className="text-sm text-brand-slate">{stageLabel}</p>
                      <p className="mt-2 text-xs text-brand-slate/80">{t.processing.tip}</p>
                    </div>
                  </div>
                )}

                {isReady && sourceUrl && resultUrl && (
                  <div className={`${viewerShellClass} px-0`}>
                    <div className="flex h-full max-h-full w-full items-center justify-center" style={{ maxWidth: '100%' }}>
                      <div className="h-full w-auto max-h-full max-w-full" style={{ aspectRatio: imageRatio }}>
                        <ReactCompareSlider
                          className="h-full w-full"
                          itemOne={
                            <ReactCompareSliderImage
                              src={sourceUrl}
                              alt="source"
                              style={{
                                objectFit: 'contain',
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#ffffff',
                              }}
                            />
                          }
                          itemTwo={
                            <ReactCompareSliderImage
                              src={resultUrl}
                              alt="result"
                              style={{
                                objectFit: 'contain',
                                width: '100%',
                                height: '100%',
                                backgroundImage:
                                  'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                                backgroundSize: '32px 32px',
                                backgroundPosition: '0 0, 0 16px, 16px -16px, -16px 0px',
                                backgroundColor: '#ffffff',
                              }}
                            />
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="mt-4 flex-none rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              <div className="flex-none space-y-4 pt-4">
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={reset}
                    disabled={!isReady}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand-blue hover:bg-brand-blue/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw size={18} />
                    {t.actions.reset}
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!isReady}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-blue bg-brand-blue/10 px-5 py-3 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CopyIcon size={18} />
                    {t.actions.copy}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isReady}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={18} />
                    {t.actions.save}
                  </button>
                </div>
                {feedbackMessage && (
                  <p
                    className={`text-center text-sm ${
                      feedback?.tone === 'negative' ? 'text-red-500' : 'text-brand-slate'
                    }`}
                  >
                    {feedbackMessage}
                  </p>
                )}
                <div className="grid gap-4 text-center sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.2em] text-brand-slate">{t.metrics.total}</p>
                    <p className="text-2xl font-semibold text-brand-dark">
                      {timings.totalMs ? `${timings.totalMs} ms` : '--'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.2em] text-brand-slate">{t.metrics.model}</p>
                    <p className="text-2xl font-semibold text-brand-dark">
                      {timings.modelMs ? `${timings.modelMs} ms` : '--'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.2em] text-brand-slate">{t.metrics.modelLabel}</p>
                    <p className="text-lg font-semibold text-brand-dark">{t.metrics.modelName}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
