import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { preloadBackgroundRemoval, removeBackgroundWithBria } from '../lib/background'
import { BRIA_MODEL_NAME, type BackgroundStage } from '../lib/background-types'

type Status = 'idle' | 'processing' | 'done' | 'error'

type IdleWindow = Window & {
  cancelIdleCallback?: (handle: number) => void
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
}

export function useBackgroundRemoval() {
  const [status, setStatus] = useState<Status>('idle')
  const [stage, setStage] = useState<BackgroundStage | 'idle' | 'complete'>('idle')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [fileName, setFileName] = useState('result')
  const [modelName, setModelName] = useState(BRIA_MODEL_NAME)
  const [timings, setTimings] = useState({ totalMs: 0, modelMs: 0 })
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const activeRequestIdRef = useRef(0)

  const replaceObjectUrl = useCallback(
    (setter: Dispatch<SetStateAction<string | null>>, nextValue: string | null) => {
      setter((previousValue) => {
        if (previousValue) {
          URL.revokeObjectURL(previousValue)
        }
        return nextValue
      })
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl)
      }
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
      }
    }
  }, [resultUrl, sourceUrl])

  useEffect(() => {
    const idleWindow = window as IdleWindow
    const preload = () => {
      void preloadBackgroundRemoval().catch(() => {
        // Defer preload errors until the user actually submits an image.
      })
    }

    const timeoutId = window.setTimeout(preload, 1200)
    const idleCallbackId = idleWindow.requestIdleCallback?.(preload, { timeout: 2000 })

    return () => {
      window.clearTimeout(timeoutId)
      if (typeof idleCallbackId === 'number') {
        idleWindow.cancelIdleCallback?.(idleCallbackId)
      }
    }
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      const requestId = activeRequestIdRef.current + 1
      activeRequestIdRef.current = requestId

      setStatus('processing')
      setStage('loading')
      setErrorDetails(null)
      setTimings({ totalMs: 0, modelMs: 0 })
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'result')

      const nextSourceUrl = URL.createObjectURL(file)
      replaceObjectUrl(setSourceUrl, nextSourceUrl)
      replaceObjectUrl(setResultUrl, null)
      setResultBlob(null)

      try {
        const result = await removeBackgroundWithBria(file, (nextStage) => {
          if (activeRequestIdRef.current === requestId) {
            setStage(nextStage)
          }
        })

        if (activeRequestIdRef.current !== requestId) {
          return
        }

        const nextResultUrl = URL.createObjectURL(result.blob)
        replaceObjectUrl(setResultUrl, nextResultUrl)
        setResultBlob(result.blob)
        setModelName(result.modelName)
        setTimings({ totalMs: result.totalMs, modelMs: result.modelMs })
        setStage('complete')
        setStatus('done')
      } catch (error) {
        if (activeRequestIdRef.current !== requestId) {
          return
        }

        console.error(error)
        setErrorDetails(error instanceof Error ? error.message : String(error))
        setStage('idle')
        setStatus('error')
      }
    },
    [replaceObjectUrl],
  )

  const reset = useCallback(() => {
    activeRequestIdRef.current += 1
    replaceObjectUrl(setSourceUrl, null)
    replaceObjectUrl(setResultUrl, null)
    setResultBlob(null)
    setStatus('idle')
    setStage('idle')
    setErrorDetails(null)
    setTimings({ totalMs: 0, modelMs: 0 })
    setModelName(BRIA_MODEL_NAME)
  }, [replaceObjectUrl])

  return {
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
  }
}
