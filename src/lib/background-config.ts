import { BRIA_MODEL_FILENAME } from './background-types'

const DEFAULT_BRIA_MODEL_BASE_URL = '/briaai/RMBG-1.4/onnx/'
const DEFAULT_ORT_BASE_URL = '/ort/'
const ORT_MODULE_FILENAME = 'ort.webgpu.min.mjs'

export const BRIA_MODEL_INPUT_SIZE = 1024

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`)

const resolveAbsoluteUrl = (value: string) => {
  const baseHref = typeof globalThis.location?.href === 'string' ? globalThis.location.href : 'http://localhost/'
  return new URL(ensureTrailingSlash(value), baseHref).toString()
}

export const getBriaModelBaseUrl = () =>
  resolveAbsoluteUrl(import.meta.env.VITE_BRIA_MODEL_BASE_URL?.trim() || DEFAULT_BRIA_MODEL_BASE_URL)

export const getBriaModelUrl = () => new URL(BRIA_MODEL_FILENAME, getBriaModelBaseUrl()).toString()

export const getOrtBaseUrl = () =>
  resolveAbsoluteUrl(import.meta.env.VITE_ORT_BASE_URL?.trim() || DEFAULT_ORT_BASE_URL)

export const getOrtModuleUrl = () => new URL(ORT_MODULE_FILENAME, getOrtBaseUrl()).toString()
