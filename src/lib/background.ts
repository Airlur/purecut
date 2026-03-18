import type {
  BackgroundPreloadResult,
  BackgroundResult,
  BackgroundStage,
  BackgroundWorkerRequest,
  BackgroundWorkerResponse,
} from './background-types'

type PendingRequest = {
  onStageChange?: (stage: BackgroundStage) => void
  reject: (reason?: unknown) => void
  resolve: (value: unknown) => void
}

let requestCounter = 0
let workerInstance: Worker | null = null
const pendingRequests = new Map<string, PendingRequest>()

const createRequestId = () => `bria-${++requestCounter}`

const resetWorker = () => {
  workerInstance?.terminate()
  workerInstance = null
}

const rejectAllPending = (reason: unknown) => {
  for (const pending of pendingRequests.values()) {
    pending.reject(reason)
  }
  pendingRequests.clear()
}

const handleWorkerMessage = (event: MessageEvent<BackgroundWorkerResponse>) => {
  const message = event.data
  const pending = pendingRequests.get(message.id)
  if (!pending) {
    return
  }

  if (message.type === 'stage') {
    pending.onStageChange?.(message.stage)
    return
  }

  pendingRequests.delete(message.id)

  if (message.type === 'error') {
    pending.reject(new Error(message.error))
    return
  }

  pending.resolve(message.payload)
}

const getWorker = () => {
  if (workerInstance) {
    return workerInstance
  }

  const worker = new Worker(new URL('../workers/bria.worker.ts', import.meta.url), { type: 'module' })

  worker.addEventListener('message', handleWorkerMessage)
  worker.addEventListener('error', (event) => {
    rejectAllPending(new Error(event.message || 'BRIA worker crashed.'))
    resetWorker()
  })

  workerInstance = worker
  return worker
}

const postRequest = <T>(
  message: BackgroundWorkerRequest,
  transfer: Transferable[] = [],
  onStageChange?: (stage: BackgroundStage) => void,
) =>
  new Promise<T>((resolve, reject) => {
    pendingRequests.set(message.id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      onStageChange,
    })

    try {
      getWorker().postMessage(message, transfer)
    } catch (error) {
      pendingRequests.delete(message.id)
      reject(error)
    }
  })

export const preloadBackgroundRemoval = () => {
  const id = createRequestId()
  return postRequest<BackgroundPreloadResult>({ id, type: 'preload' })
}

export const removeBackgroundWithBria = async (
  file: File,
  onStageChange?: (stage: BackgroundStage) => void,
) => {
  const id = createRequestId()
  const buffer = await file.arrayBuffer()

  return postRequest<BackgroundResult>(
    {
      id,
      type: 'remove',
      file: {
        buffer,
        name: file.name,
        type: file.type || 'image/png',
      },
    },
    [buffer],
    onStageChange,
  )
}
