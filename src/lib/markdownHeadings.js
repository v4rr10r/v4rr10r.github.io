import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'

const parser = unified().use(remarkParse).use(remarkGfm)

function nodeText(node) {
  if (node.type === 'image') return node.alt || ''
  if (typeof node.value === 'string') return node.value
  return node.children?.map(nodeText).join('') || ''
}

function slugify(text) {
  return text.normalize('NFKD').toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

export function createHeadingIndex(markdown) {
  const tree = parser.parse(markdown)
  const slugCounts = new Map()
  const usedIds = new Set()
  const headings = []
  const idsByOffset = new Map()

  for (const node of tree.children) {
    if (node.type !== 'heading' || node.depth > 4) continue
    const text = nodeText(node).trim()
    if (!text) continue
    const base = slugify(text) || `section-${headings.length + 1}`
    let count = (slugCounts.get(base) || 0) + 1
    let id = count === 1 ? base : `${base}-${count}`
    while (usedIds.has(id)) {
      count += 1
      id = `${base}-${count}`
    }
    slugCounts.set(base, count)
    usedIds.add(id)
    headings.push({ id, text, depth: node.depth })
    if (node.position?.start.offset !== undefined) idsByOffset.set(node.position.start.offset, id)
  }

  return { headings, idsByOffset }
}
