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
import { useCallback, useEffect, useState } from 'react'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { useDropzone } from 'react-dropzone'
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval'
import { copy, type ErrorKey, type FeedbackKey, type Language } from './lib/copy'

const acceptedImageTypes = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
} as const

function App() {
  const [lang, setLang] = useState<Language>('zh')
  const [imageRatio, setImageRatio] = useState(4 / 3)
  const [uploaderError, setUploaderError] = useState<ErrorKey | null>(null)
  const [feedback, setFeedback] = useState<{ key: FeedbackKey; tone: 'positive' | 'negative' } | null>(
    null,
  )

  const t = copy[lang]
  const {
    errorDetails,
    fileName,
    modelName,
    processFile,
    reset,
    resultBlob,
    resultUrl,
    sourceUrl,
    stage,
    status,
    timings,
  } = useBackgroundRemoval()

  useEffect(() => {
    if (!feedback) {
      return
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    if (!sourceUrl) {
      return
    }

    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) {
        setImageRatio(image.naturalWidth / image.naturalHeight)
      }
    }
    image.src = sourceUrl

    return () => {
      image.onload = null
    }
  }, [sourceUrl])

  const handleProcessFile = useCallback(
    (file: File) => {
      setUploaderError(null)
      void processFile(file)
    },
    [processFile],
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const nextFile = acceptedFiles[0]
      if (nextFile) {
        handleProcessFile(nextFile)
      }
    },
    [handleProcessFile],
  )

  const onDropRejected = useCallback(() => {
    setUploaderError('fileType')
  }, [])

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: acceptedImageTypes,
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
        handleProcessFile(file)
        return
      }

      setUploaderError('clipboard')
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleProcessFile])

  const handleReset = useCallback(() => {
    setUploaderError(null)
    reset()
  }, [reset])

  const handleCopy = useCallback(async () => {
    if (!resultBlob) {
      return
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [resultBlob.type]: resultBlob,
        }),
      ])
      setFeedback({ key: 'copied', tone: 'positive' })
    } catch (error) {
      console.warn('Clipboard copy failed', error)
      setFeedback({ key: 'copyFailed', tone: 'negative' })
    }
  }, [resultBlob])

  const handleSave = useCallback(() => {
    if (!resultBlob) {
      return
    }

    saveAs(resultBlob, `${fileName || 'result'}.png`)
    setFeedback({ key: 'saved', tone: 'positive' })
  }, [fileName, resultBlob])

  const stageLabel = t.progress[stage]
  const errorKey = uploaderError ?? (status === 'error' ? 'processing' : null)
  const errorMessage = errorKey ? t.errors[errorKey] : null
  const feedbackMessage = feedback ? t.feedback[feedback.key] : null
  const isProcessing = status === 'processing'
  const isReady = status === 'done' && Boolean(sourceUrl) && Boolean(resultUrl)
  const nextLanguageLabel = lang === 'zh' ? 'EN' : '中文'

  const baseViewerClass =
    'relative w-full max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/80'
  const viewerShellClass = 'flex h-full w-full items-center justify-center'

  return (
    <div className="h-screen overflow-hidden bg-brand-gray">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-0">
        <header className="flex flex-none items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt={t.brand.logoAlt} className="h-12 w-12" />
            <p className="text-2xl font-semibold text-brand-dark">{t.brand.name}</p>
          </div>
          <button
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand-blue hover:bg-brand-blue/10"
            onClick={() => setLang((previous) => (previous === 'zh' ? 'en' : 'zh'))}
          >
            <Languages size={16} />
            {nextLanguageLabel}
          </button>
        </header>

        <main className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="text-center">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-blue/10 px-4 py-1 text-sm font-medium text-brand-blue">
              <Sparkles size={16} />
              {t.hero.badge}
            </div>
            <h1 className="mt-4 text-4xl font-semibold text-brand-dark sm:text-5xl">{t.hero.title}</h1>
          </div>

          <section className="flex min-h-[340px] max-h-[calc(100vh-320px)] flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1">
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
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                backgroundColor: '#ffffff',
                              }}
                            />
                          }
                          itemTwo={
                            <ReactCompareSliderImage
                              src={resultUrl}
                              alt="result"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
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
                  <p>{errorMessage}</p>
                  {status === 'error' && errorDetails && <p className="mt-1 break-all text-xs text-red-500">{errorDetails}</p>}
                </div>
              )}

              <div className="flex-none space-y-4 pt-4">
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleReset}
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
                    <p className="text-lg font-semibold text-brand-dark">{modelName}</p>
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
