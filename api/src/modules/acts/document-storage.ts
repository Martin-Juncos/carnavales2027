import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../config/env'

export interface DocumentStorage {
  put(key: string, content: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
}

export class FileSystemDocumentStorage implements DocumentStorage {
  constructor(private readonly root = path.resolve(process.cwd(), env.ACTA_STORAGE_DIR)) {}

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.root, key)
    const relative = path.relative(this.root, resolved)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid storage key')
    return resolved
  }

  async put(key: string, content: Buffer): Promise<void> {
    const target = this.resolveKey(key)
    await mkdir(path.dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}.tmp`
    await writeFile(temporary, content, { flag: 'wx' })
    await rename(temporary, target)
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key))
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true })
  }
}
