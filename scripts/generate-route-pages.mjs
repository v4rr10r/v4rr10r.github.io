import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDirectory = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = resolve(projectDirectory, 'dist')
const html = await readFile(join(outputDirectory, 'index.html'))

async function findArticleSlugs(directory, filename) {
  let entries
  try {
    entries = await readdir(join(projectDirectory, directory), { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const slugs = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      await access(join(projectDirectory, directory, entry.name, filename))
      return entry.name
    } catch {
      return null
    }
  }))

  return slugs.filter(Boolean)
}

const writeupSlugs = await findArticleSlugs('content/writeups', 'writeup.md')
const blogSlugs = [
  ...await findArticleSlugs('content/extra', 'post.md'),
  ...await findArticleSlugs('content/labs', 'post.md'),
]
const routes = new Set([
  'writeups',
  'blogs',
  'extra',
  ...writeupSlugs.map((slug) => `writeups/${slug}`),
  ...blogSlugs.map((slug) => `blogs/${slug}`),
  ...blogSlugs.map((slug) => `extra/${slug}`),
])

for (const route of routes) {
  const destination = resolve(outputDirectory, route, 'index.html')
  if (!destination.startsWith(`${outputDirectory}${sep}`)) throw new Error(`Invalid route: ${route}`)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, html)
}

await writeFile(join(outputDirectory, '404.html'), html)
console.log(`Generated ${routes.size} clean route entry pages and 404.html`)
