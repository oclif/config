export interface IESModule<T> {
  __esModule: true
  default: T
}

export function undefault<T>(obj: T | IESModule<T>): T {
  if ((obj as any).__esModule === true) return (obj as any).default
  return obj as any
}
