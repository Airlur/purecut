export const BRIA_MODEL_FILENAME = 'model_fp16.onnx'
export const BRIA_MODEL_NAME = 'BRIA RMBG-1.4 / fp16'

export type BackgroundBackend = 'webgpu' | 'wasm'
export type BackgroundStage = 'loading' | 'inference' | 'composite'

export interface BackgroundResult {
  backend: BackgroundBackend
  blob: Blob
  modelMs: number
  modelName: string
  totalMs: number
}

export interface BackgroundPreloadResult {
  backend: BackgroundBackend
  modelName: string
}

export type BackgroundWorkerRequest =
  | {
      id: string
      type: 'preload'
    }
  | {
      file: {
        buffer: ArrayBuffer
        name: string
        type: string
      }
      id: string
      type: 'remove'
    }

export type BackgroundWorkerResponse =
  | {
      id: string
      stage: BackgroundStage
      type: 'stage'
    }
  | {
      id: string
      payload: BackgroundPreloadResult
      type: 'preload:success'
    }
  | {
      id: string
      payload: BackgroundResult
      type: 'remove:success'
    }
  | {
      error: string
      id: string
      type: 'error'
    }
