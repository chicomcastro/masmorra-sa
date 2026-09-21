import { EFFECT_KINDS, SUITS } from './types'
import type { Content, Effect } from './types'

export interface ValidationIssue {
  path: string
  message: string
}

const BODY_SLOTS = ['mao', 'maos', 'corpo', 'cabeca', 'cinto', 'pernas', 'colo']

function checkEffects(effects: Effect[] | undefined, path: string, out: ValidationIssue[]): boolean {
  let hasCrit = false
  for (const [i, e] of (effects ?? []).entries()) {
    if (!e || typeof e !== 'object' || !('kind' in e)) {
      out.push({ path: `${path}[${i}]`, message: 'efeito sem kind' })
      continue
    }
    if (!(EFFECT_KINDS as readonly string[]).includes(e.kind)) {
      out.push({ path: `${path}[${i}]`, message: `kind desconhecido: ${e.kind}` })
    }
    if (e.kind === 'onCrit') hasCrit = true
    if (e.kind === 'manual' && !e.text) {
      out.push({ path: `${path}[${i}]`, message: 'manual sem texto' })
    }
    if (e.kind === 'thresholdDelta' && e.suit !== null && !SUITS.includes(e.suit)) {
      out.push({ path: `${path}[${i}]`, message: `naipe inválido: ${e.suit}` })
    }
  }
  return hasCrit
}

/**
 * Runs at boot in development. Every id unique; every effect of a known kind;
 * at least 5 obstacles per floor; every boss with 3 phases; bodySlot coherent
 * with handsUsed; every onCrit card marked needsCritInput.
 */
export function validateContent(content: Content): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, string>()

  const collections: [string, { id: string }[]][] = [
    ['obstacles', content.obstacles],
    ['bosses', content.bosses],
    ['bossPhases', content.bossPhases],
    ['squires', content.squires],
    ['loot', content.loot],
    ['wounds', content.wounds],
    ['scars', content.scars],
    ['races', content.races],
    ['classes', content.classes],
    ['specializations', content.specializations],
  ]

  for (const [name, list] of collections) {
    for (const [i, item] of list.entries()) {
      if (!item.id) {
        issues.push({ path: `${name}[${i}]`, message: 'id ausente' })
        continue
      }
      const prev = seen.get(item.id)
      if (prev) issues.push({ path: `${name}[${i}]`, message: `id duplicado com ${prev}: ${item.id}` })
      else seen.set(item.id, `${name}[${i}]`)
    }
  }

  for (const [i, o] of content.obstacles.entries()) {
    const p = `obstacles[${i}] ${o.id}`
    const hasCrit = checkEffects(o.effects, `${p}.effects`, issues)
    if (hasCrit && !o.needsCritInput) issues.push({ path: p, message: 'tem onCrit mas needsCritInput é false' })
    if (![1, 2, 3].includes(o.floor)) issues.push({ path: p, message: `andar inválido: ${o.floor}` })
    if (o.slots < 1) issues.push({ path: p, message: 'slots deve ser >= 1' })
    if (o.target < 1) issues.push({ path: p, message: 'target deve ser >= 1' })
    if (o.slots >= 3 && !o.duoExcluded) issues.push({ path: p, message: 'carta de 3 vagas precisa de duoExcluded: true' })
  }

  for (const floor of [1, 2, 3] as const) {
    const all = content.obstacles.filter((o) => o.floor === floor)
    if (all.length < 5) issues.push({ path: `andar ${floor}`, message: `precisa de ao menos 5 obstáculos, tem ${all.length}` })
    const duo = all.filter((o) => !o.duoExcluded)
    const needed = floor === 3 ? 4 : 5
    if (duo.length < needed) {
      issues.push({ path: `andar ${floor} (duo)`, message: `precisa de ao menos ${needed} obstáculos não-duoExcluded, tem ${duo.length}` })
    }
  }

  for (const boss of content.bosses) {
    const phases = content.bossPhases.filter((p) => p.bossId === boss.id)
    if (phases.length !== 3) {
      issues.push({ path: `bosses ${boss.id}`, message: `precisa de 3 fases, tem ${phases.length}` })
    }
    for (const n of [1, 2, 3]) {
      if (!phases.some((p) => p.phase === n)) {
        issues.push({ path: `bosses ${boss.id}`, message: `fase ${n} ausente` })
      }
    }
    if (phases.some((p) => p.duoVariant !== boss.duo)) {
      issues.push({ path: `bosses ${boss.id}`, message: 'duoVariant das fases não bate com boss.duo' })
    }
  }

  for (const [i, ph] of content.bossPhases.entries()) {
    const p = `bossPhases[${i}] ${ph.id}`
    const hasCrit = checkEffects(ph.effects, `${p}.effects`, issues)
    if (hasCrit && !ph.needsCritInput) issues.push({ path: p, message: 'tem onCrit mas needsCritInput é false' })
    if (ph.phase === 3 && ph.slots !== 'all') issues.push({ path: p, message: 'Fase III deve ter slots "all"' })
    if (ph.phase === 3 && ph.suit !== null) issues.push({ path: p, message: 'Fase III não tem naipe' })
    if (!content.bosses.some((b) => b.id === ph.bossId)) issues.push({ path: p, message: `bossId inexistente: ${ph.bossId}` })
  }

  const squireSuits = new Set(content.squires.map((s) => s.suit))
  for (const suit of SUITS) {
    if (!squireSuits.has(suit)) issues.push({ path: 'squires', message: `falta Escudeiro de ${suit}` })
  }

  for (const [i, l] of content.loot.entries()) {
    const p = `loot[${i}] ${l.id}`
    checkEffects(l.effects, `${p}.effects`, issues)
    checkEffects(l.drawback, `${p}.drawback`, issues)
    if (l.bodySlot !== null && !BODY_SLOTS.includes(l.bodySlot)) {
      issues.push({ path: p, message: `bodySlot inválido: ${l.bodySlot}` })
    }
    if (l.handsUsed > 0 && l.bodySlot !== 'mao') {
      issues.push({ path: p, message: 'handsUsed > 0 exige bodySlot "mao"' })
    }
    if (l.bodySlot === 'mao' && l.handsUsed === 0) {
      issues.push({ path: p, message: 'bodySlot "mao" exige handsUsed 1 ou 2' })
    }
    if (l.lootType === 'equip' && l.bodySlot === null) {
      issues.push({ path: p, message: 'equipamento precisa de bodySlot' })
    }
    if (l.lootType === 'consumable' && l.bodySlot !== null) {
      issues.push({ path: p, message: 'consumível não ocupa slot' })
    }
  }

  for (const list of [content.wounds, content.scars]) {
    for (const [i, a] of list.entries()) {
      const p = `${a.kind}s[${i}] ${a.id}`
      checkEffects(a.effects, `${p}.effects`, issues)
      if (a.kind === 'scar' && !a.permanent) issues.push({ path: p, message: 'Cicatriz precisa ser permanente' })
      if (a.kind === 'wound' && a.permanent) issues.push({ path: p, message: 'Ferimento não é permanente' })
    }
  }

  for (const [i, r] of content.races.entries()) {
    checkEffects(r.effects, `races[${i}].effects`, issues)
    if (r.vigor < 1) issues.push({ path: `races[${i}] ${r.id}`, message: 'vigor inválido' })
  }

  const specIds = new Set(content.specializations.map((s) => s.id))
  for (const [i, c] of content.classes.entries()) {
    const p = `classes[${i}] ${c.id}`
    checkEffects(c.effects, `${p}.effects`, issues)
    if (c.specializations.length !== 3) issues.push({ path: p, message: 'classe precisa de exatamente 3 Especializações' })
    for (const s of c.specializations) {
      if (!specIds.has(s)) issues.push({ path: p, message: `Especialização inexistente: ${s}` })
    }
  }

  const classIds = new Set(content.classes.map((c) => c.id))
  for (const [i, s] of content.specializations.entries()) {
    const p = `specializations[${i}] ${s.id}`
    checkEffects(s.effects, `${p}.effects`, issues)
    if (!classIds.has(s.classId)) issues.push({ path: p, message: `classId inexistente: ${s.classId}` })
  }

  return issues
}
