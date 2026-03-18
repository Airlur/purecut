/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRIA_MODEL_BASE_URL?: string
  readonly VITE_ORT_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
