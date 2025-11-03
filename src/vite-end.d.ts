/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface SparkUser {
  id: string
  login: string
  avatarUrl: string
  email?: string
  isOwner: boolean
}

interface SparkKV {
  keys: () => Promise<string[]>
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
}

interface SparkAPI {
  llmPrompt: (strings: TemplateStringsArray, ...values: any[]) => string
  llm: (prompt: string, modelName?: string, jsonMode?: boolean) => Promise<string>
  user: () => Promise<SparkUser>
  kv: SparkKV
}

interface Window {
  spark: SparkAPI
}

declare const spark: SparkAPI