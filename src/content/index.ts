import raw from './content.json'
import { validateContent } from './validate'
import type { Content, DeckCard } from './types'

export const content = raw as unknown as Content

const byId = new Map<string, DeckCard>()
for (const o of content.obstacles) byId.set(o.id, o)
for (const p of content.bossPhases) byId.set(p.id, p)

export function cardById(id: string): DeckCard {
  const card = byId.get(id)
  if (!card) throw new Error(`carta desconhecida: ${id}`)
  return card
}

export function lootById(id: string) {
  const l = content.loot.find((x) => x.id === id)
  if (!l) throw new Error(`espólio desconhecido: ${id}`)
  return l
}

export function afflictionById(id: string) {
  const a = [...content.wounds, ...content.scars].find((x) => x.id === id)
  if (!a) throw new Error(`ferimento/cicatriz desconhecido: ${id}`)
  return a
}

export function raceById(id: string) {
  const r = content.races.find((x) => x.id === id)
  if (!r) throw new Error(`raça desconhecida: ${id}`)
  return r
}

export function classById(id: string) {
  const c = content.classes.find((x) => x.id === id)
  if (!c) throw new Error(`classe desconhecida: ${id}`)
  return c
}

export function specById(id: string) {
  const s = content.specializations.find((x) => x.id === id)
  if (!s) throw new Error(`especialização desconhecida: ${id}`)
  return s
}

export function squireById(id: string) {
  const s = content.squires.find((x) => x.id === id)
  if (!s) throw new Error(`escudeiro desconhecido: ${id}`)
  return s
}

if (import.meta.env?.DEV) {
  const issues = validateContent(content)
  if (issues.length) {
    console.error(`content.json: ${issues.length} problema(s)`)
    for (const i of issues) console.error(`  ${i.path}: ${i.message}`)
  }
}

export * from './types'
