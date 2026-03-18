/// <reference lib="webworker" />

import type * as Ort from 'onnxruntime-web'
import { BRIA_MODEL_INPUT_SIZE, getBriaModelUrl, getOrtBaseUrl, getOrtModuleUrl } from '../lib/background-config'
import {
  BRIA_MODEL_NAME,
  type BackgroundBackend,
  type BackgroundPreloadResult,
  type BackgroundResult,
  type BackgroundStage,
  type BackgroundWorkerRequest,
  type BackgroundWorkerResponse,
} from '../lib/background-types'

type OrtModule = typeof import('onnxruntime-web')

type SessionState = {
  backend: BackgroundBackend
  inputName: string
  inputType: Ort.Tensor.Type
  ort: OrtModule
  outputName: string
  outputType: Ort.Tensor.Type
  session: Ort.InferenceSession
}

const workerScope = self as DedicatedWorkerGlobalScope
const modelDims = [1, 3, BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE] as const
const warmupTensorSize = modelDims[0] * modelDims[1] * modelDims[2] * modelDims[3]

let ortModulePromise: Promise<OrtModule> | null = null
let sessionPromise: Promise<SessionState> | null = null

const floatView = new Float32Array(1)
const int32View = new Uint32Array(floatView.buffer)

const postWorkerMessage = (message: BackgroundWorkerResponse) => {
  workerScope.postMessage(message)
}

const postStage = (id: string, stage: BackgroundStage) => {
  postWorkerMessage({ id, stage, type: 'stage' })
}

const loadOrtModule = async () => {
  if (!ortModulePromise) {
    ortModulePromise = import(/* @vite-ignore */ getOrtModuleUrl())
      .then((module) => module as OrtModule)
      .catch((error) => {
        ortModulePromise = null
        throw error
      })
  }

  return ortModulePromise
}

const configureOrt = (ort: OrtModule) => {
  ort.env.logLevel = 'error'
  ort.env.wasm.proxy = false
  ort.env.wasm.simd = true
  const hardwareConcurrency = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 1
  ort.env.wasm.numThreads =
    workerScope.crossOriginIsolated && hardwareConcurrency > 1
      ? Math.min(4, hardwareConcurrency)
      : 1
  ort.env.wasm.wasmPaths = getOrtBaseUrl()
}

const supportsWebGpu = () => {
  const browserNavigator = navigator as Navigator & {
    gpu?: {
      requestAdapter?: () => Promise<unknown>
    }
  }

  return typeof browserNavigator.gpu?.requestAdapter === 'function'
}

const toFloat16Bits = (value: number) => {
  floatView[0] = value
  const bits = int32View[0]
  const sign = (bits >> 16) & 0x8000
  const exponent = (bits >> 23) & 0xff
  const mantissa = (bits >> 12) & 0x07ff

  if (exponent < 103) {
    return sign
  }

  if (exponent > 142) {
    return sign | 0x7c00 | ((exponent === 255 ? 0 : 1) && bits & 0x007fffff ? 0x0200 : 0)
  }

  if (exponent < 113) {
    return sign | (((mantissa | 0x0800) >> (114 - exponent)) + ((mantissa >> (113 - exponent)) & 1))
  }

  return sign | ((exponent - 112) << 10) | ((mantissa >> 1) + (mantissa & 1))
}

const fromFloat16Bits = (value: number) => {
  const sign = (value & 0x8000) !== 0 ? -1 : 1
  const exponent = (value >> 10) & 0x1f
  const fraction = value & 0x03ff

  if (exponent === 0) {
    return fraction === 0 ? sign * 0 : sign * 2 ** -14 * (fraction / 1024)
  }

  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Infinity : Number.NaN
  }

  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

const float32ToFloat16Array = (input: Float32Array) => {
  const output = new Uint16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = toFloat16Bits(input[index])
  }
  return output
}

const float16ToFloat32Array = (input: Uint16Array) => {
  const output = new Float32Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = fromFloat16Bits(input[index])
  }
  return output
}

const createCanvas = (width: number, height: number) => {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is not available in this browser.')
  }
  return new OffscreenCanvas(width, height)
}

const getCanvasContext = (canvas: OffscreenCanvas) => {
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) {
    throw new Error('Failed to create a 2D canvas context.')
  }
  return context
}

const createInputTensor = (ort: OrtModule, input: Float32Array, tensorType: Ort.Tensor.Type) => {
  if (tensorType === 'float16') {
    return new ort.Tensor('float16', float32ToFloat16Array(input), modelDims)
  }

  if (tensorType === 'float32') {
    return new ort.Tensor('float32', input, modelDims)
  }

  throw new Error(`Unsupported BRIA input tensor type: ${tensorType}`)
}

const normalizeMask = (maskValues: Float32Array) => {
  let minValue = Number.POSITIVE_INFINITY
  let maxValue = Number.NEGATIVE_INFINITY

  for (const value of maskValues) {
    if (value < minValue) {
      minValue = value
    }
    if (value > maxValue) {
      maxValue = value
    }
  }

  const range = maxValue - minValue
  const rgba = new Uint8ClampedArray(maskValues.length * 4)

  for (let index = 0; index < maskValues.length; index += 1) {
    const normalized =
      range > Number.EPSILON
        ? (maskValues[index] - minValue) / range
        : Math.min(1, Math.max(0, maskValues[index]))
    const alpha = Math.max(0, Math.min(255, Math.round(normalized * 255)))
    const pixelOffset = index * 4
    rgba[pixelOffset] = 255
    rgba[pixelOffset + 1] = 255
    rgba[pixelOffset + 2] = 255
    rgba[pixelOffset + 3] = alpha
  }

  return rgba
}

const createInputFromBitmap = (bitmap: ImageBitmap, ort: OrtModule, tensorType: Ort.Tensor.Type) => {
  const inputCanvas = createCanvas(BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)
  const inputContext = getCanvasContext(inputCanvas)

  inputContext.clearRect(0, 0, BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)
  inputContext.drawImage(bitmap, 0, 0, BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)

  const imageData = inputContext.getImageData(0, 0, BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)
  const pixels = imageData.data
  const planeSize = BRIA_MODEL_INPUT_SIZE * BRIA_MODEL_INPUT_SIZE
  const normalized = new Float32Array(planeSize * 3)

  for (let index = 0; index < planeSize; index += 1) {
    const pixelOffset = index * 4
    normalized[index] = pixels[pixelOffset] / 255 - 0.5
    normalized[planeSize + index] = pixels[pixelOffset + 1] / 255 - 0.5
    normalized[planeSize * 2 + index] = pixels[pixelOffset + 2] / 255 - 0.5
  }

  return createInputTensor(ort, normalized, tensorType)
}

const composeResult = async (bitmap: ImageBitmap, maskValues: Float32Array) => {
  const maskCanvas = createCanvas(BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)
  const maskContext = getCanvasContext(maskCanvas)
  const maskImage = new ImageData(normalizeMask(maskValues), BRIA_MODEL_INPUT_SIZE, BRIA_MODEL_INPUT_SIZE)
  maskContext.putImageData(maskImage, 0, 0)

  const outputCanvas = createCanvas(bitmap.width, bitmap.height)
  const outputContext = getCanvasContext(outputCanvas)
  outputContext.imageSmoothingEnabled = true
  outputContext.clearRect(0, 0, bitmap.width, bitmap.height)
  outputContext.drawImage(bitmap, 0, 0)
  outputContext.globalCompositeOperation = 'destination-in'
  outputContext.drawImage(maskCanvas, 0, 0, bitmap.width, bitmap.height)
  outputContext.globalCompositeOperation = 'source-over'

  return outputCanvas.convertToBlob({ type: 'image/png' })
}

const readTensorAsFloat32 = async (tensor: Ort.Tensor, tensorType: Ort.Tensor.Type) => {
  const data = await tensor.getData()

  if (tensorType === 'float32') {
    return data as Float32Array
  }

  if (tensorType === 'float16') {
    return float16ToFloat32Array(data as Uint16Array)
  }

  throw new Error(`Unsupported BRIA output tensor type: ${tensorType}`)
}

const warmupSession = async (state: SessionState) => {
  const warmupInput = createInputTensor(state.ort, new Float32Array(warmupTensorSize), state.inputType)
  await state.session.run({ [state.inputName]: warmupInput }, [state.outputName])
}

const createSession = async (backend: BackgroundBackend): Promise<SessionState> => {
  const ort = await loadOrtModule()
  configureOrt(ort)

  const session = await ort.InferenceSession.create(getBriaModelUrl(), {
    enableGraphCapture: backend === 'webgpu',
    executionProviders: [
      backend === 'webgpu'
        ? { name: 'webgpu', preferredLayout: 'NCHW', validationMode: 'basic' }
        : { name: 'wasm' },
    ],
    graphOptimizationLevel: 'all',
    preferredOutputLocation: 'cpu',
  })

  const inputMetadata = session.inputMetadata[0]
  const outputMetadata = session.outputMetadata[0]

  if (!inputMetadata?.isTensor || !outputMetadata?.isTensor) {
    throw new Error('Unexpected BRIA model input or output metadata.')
  }

  const state: SessionState = {
    backend,
    inputName: session.inputNames[0],
    inputType: inputMetadata.type,
    ort,
    outputName: session.outputNames[0],
    outputType: outputMetadata.type,
    session,
  }

  await warmupSession(state)
  return state
}

const ensureSession = async () => {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (supportsWebGpu()) {
        try {
          return await createSession('webgpu')
        } catch (error) {
          console.warn('BRIA WebGPU session failed, falling back to WASM.', error)
        }
      }

      return createSession('wasm')
    })().catch((error) => {
      sessionPromise = null
      throw error
    })
  }

  return sessionPromise
}

const formatWorkerError = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : String(error)

  if (
    rawMessage.includes('Failed to fetch dynamically imported module') ||
    rawMessage.includes('Importing a module script failed')
  ) {
    return `Failed to load ONNX Runtime Web from ${getOrtModuleUrl()}.`
  }

  if (rawMessage.includes('Failed to fetch') || rawMessage.includes('load model')) {
    return `Failed to load the BRIA model from ${getBriaModelUrl()}.`
  }

  return rawMessage
}

const preloadModel = async (): Promise<BackgroundPreloadResult> => {
  const state = await ensureSession()
  return {
    backend: state.backend,
    modelName: BRIA_MODEL_NAME,
  }
}

const removeBackground = async (
  buffer: ArrayBuffer,
  mimeType: string,
  onBeforeComposite?: () => void,
): Promise<BackgroundResult> => {
  const startedAt = performance.now()
  const state = await ensureSession()
  const bitmap = await createImageBitmap(new Blob([buffer], { type: mimeType }))

  try {
    const inputTensor = createInputFromBitmap(bitmap, state.ort, state.inputType)
    const inferenceStartedAt = performance.now()
    const outputs = await state.session.run({ [state.inputName]: inputTensor }, [state.outputName])
    const inferenceFinishedAt = performance.now()
    const outputTensor = outputs[state.outputName] as Ort.Tensor | undefined

    if (!outputTensor) {
      throw new Error('The BRIA model did not return a mask tensor.')
    }

    const maskValues = await readTensorAsFloat32(outputTensor, state.outputType)
    onBeforeComposite?.()
    const blob = await composeResult(bitmap, maskValues)

    return {
      backend: state.backend,
      blob,
      modelMs: Math.round(inferenceFinishedAt - inferenceStartedAt),
      modelName: BRIA_MODEL_NAME,
      totalMs: Math.round(performance.now() - startedAt),
    }
  } finally {
    bitmap.close()
  }
}

const handleMessage = async (message: BackgroundWorkerRequest) => {
  try {
    if (message.type === 'preload') {
      postStage(message.id, 'loading')
      const payload = await preloadModel()
      postWorkerMessage({ id: message.id, payload, type: 'preload:success' })
      return
    }

    postStage(message.id, 'loading')
    await ensureSession()
    postStage(message.id, 'inference')
    const payload = await removeBackground(message.file.buffer, message.file.type, () => {
      postStage(message.id, 'composite')
    })
    postWorkerMessage({ id: message.id, payload, type: 'remove:success' })
  } catch (error) {
    postWorkerMessage({
      error: formatWorkerError(error),
      id: message.id,
      type: 'error',
    })
  }
}

workerScope.onmessage = (event: MessageEvent<BackgroundWorkerRequest>) => {
  void handleMessage(event.data)
}

export {}
