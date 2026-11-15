// Writes index.json files listing what actually exists in public/audio and public/images/cards.
// The game reads these indexes so that missing files are never requested (no 404 noise in the console).
// Runs automatically via npm predev / prebuild. Run manually after adding files: node tools/public_index.mjs
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

function build(dir, exts, skip = []) {
  const base = join(root, dir)
  const files = walk(base)
    .map((p) => relative(base, p).split('\\').join('/'))
    .filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)))
    .filter((f) => !skip.some((d) => f.startsWith(d)))
    .sort()
  writeFileSync(join(base, 'index.json'), JSON.stringify({ files }, null, 2) + '\n')
  console.log(`[public_index] ${dir}: ${files.length} file(s)`)
}

// sfx/candidates/ = listening-test files for public/sound-lab.html, never part of the game
build('audio', ['.mp3', '.ogg', '.wav', '.m4a'], ['sfx/candidates/'])
build('images/cards', ['.webp', '.png', '.jpg', '.jpeg'])
