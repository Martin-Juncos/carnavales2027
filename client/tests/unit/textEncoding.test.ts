import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = [
  'src/app',
  'src/components',
  'src/features',
  'src/hooks',
  'src/offline',
  'public',
]
const textExtensions = new Set(['.ts', '.tsx', '.html', '.json', '.webmanifest'])

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(target) : [target]
  }))
  return files.flat()
}

describe('user-facing text encoding', () => {
  it('does not contain replacement characters or question marks inside words', async () => {
    const projectRoot = process.cwd()
    const files = (await Promise.all(roots.map((root) => filesBelow(path.join(projectRoot, root)))))
      .flat()
      .filter((file) => textExtensions.has(path.extname(file)))
    files.push(path.join(projectRoot, 'README.md'))
    const invalid: string[] = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      if (/\p{L}\?\p{L}/u.test(content) || /[�ÃÂ]/u.test(content)) {
        invalid.push(path.relative(projectRoot, file))
      }
    }

    expect(invalid).toEqual([])
  })
})
