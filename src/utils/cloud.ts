type CloudObject = Record<string, (payload?: unknown) => Promise<unknown>>

let cachedObject: CloudObject | undefined

function getShopObject() {
  if (cachedObject) return cachedObject
  // uni-app exposes uniCloud as a runtime global. It is not guaranteed to be
  // attached to globalThis in the WeChat sandbox.
  const runtime = typeof uniCloud !== 'undefined' ? uniCloud : null
  if (typeof runtime?.importObject !== 'function') {
    console.error('[uniCloud] uniCloud.importObject is unavailable. Check that this is running in the WeChat developer tool and that the project has a uniCloud service space.')
    return null
  }
  try {
    cachedObject = runtime.importObject('shop')
    console.info('[uniCloud] shop cloud object imported')
  } catch (error) {
    console.error('[uniCloud] failed to import shop cloud object', error)
    return null
  }
  return cachedObject
}

export class CloudCallError extends Error {
  constructor(message: string, public readonly method: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'CloudCallError'
  }
}

export async function callCloud<T>(method: string, payload?: unknown): Promise<T> {
  const cloudObject = getShopObject()
  const action = cloudObject?.[method]
  if (!action) {
    const message = `[uniCloud] shop.${method} is unavailable. Upload the shop cloud object to service space abc123.`
    console.error(message)
    throw new CloudCallError(message, method)
  }
  try {
    console.info(`[uniCloud] calling shop.${method}`)
    return await action(payload) as T
  } catch (error) {
    console.error(`[uniCloud] shop.${method} failed`, error)
    const message = error instanceof Error ? error.message : `shop.${method} failed`
    throw new CloudCallError(message, method, error)
  }
}

export function cloudAvailable() {
  return Boolean(getShopObject())
}
