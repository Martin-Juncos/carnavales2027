import { db } from './db'

function createUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export async function getDeviceId(): Promise<string> {
  const existing = await db.device.get('default')
  if (existing) return existing.deviceId
  const device = { id: 'default', deviceId: createUuid(), createdAt: new Date().toISOString() }
  await db.device.put(device)
  return device.deviceId
}

export function newOperationId(): string {
  return createUuid()
}
