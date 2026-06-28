/**
 * Типы боевого состояния (§6).
 */

import type { StatBlock } from './stats'
import type { CardKind } from './cards'
import type { ModSlotState } from './memento'

export type Side = 'player' | 'enemy'

export interface ActiveStatusEffect {
  id: string
  specId: string
  remainingTurns: number
  statMods?: Partial<StatBlock>
  tickAmount?: number
  damageTag?: string
  /** Источник (для атрибуции лога). */
  sourceUnitId?: string
}

/** Снимок умения в бою (с учётом cooldown и L носителя). */
export interface BattleCard {
  /** id инстанса карты (или 'strike' для базовой атаки). */
  instanceId: string
  templateId: string
  kind: CardKind
  /**
   * L носителя — живой во время боя (растёт по §16.3). Для strike это itemLevel
   * оружия (или 0 для «кулаков»); прогресс синкается на оружие после боя.
   */
  level: number
  /** Счётчик применений за бой (для синка uses_count после боя). */
  uses: number
  /** Бонус к уровню расчёта урона от экипировки (§6.6 cardLevelBonus). */
  damageLevelBonus: number
  /** Оставшийся cooldown в ходах (0 = готова). */
  cooldownLeft: number
  /** Эффективный cooldown шаблона (база ×2, кроме strike — §7.4). */
  cooldownTurns: number
  /**
   * Mod-слоты носителя действия (карты; для strike — оружия). Read-only в бою:
   * lm растёт только при победе (§16.7).
   */
  modSlots: ModSlotState[]
  /** Теги носителя (для будущих эффектов). */
  carrierTags: string[]
  /** Является ли базовой атакой (strike/shot/magic_bolt). */
  isBasic: boolean
  /** Для strike: id инстанса оружия, на которое идёт прогресс (если есть). */
  weaponInstanceId?: string
}

export interface BattleUnit {
  id: string
  side: Side
  /** Для player — characterId; для enemy — undefined. */
  characterId?: string
  x: number
  y: number
  hp: number
  maxHp: number
  unitLevel: number
  initiativeBase: number
  /** База статов (снимок для tooltip §6.2) — уже effective + экипировка. */
  stats: StatBlock
  /** Снимок «голой» базы для tooltip. */
  baseStats: StatBlock
  archetypeId?: string
  raceId?: string
  classId?: string
  displayName: string
  iconEmoji: string
  iconAccent?: string
  statusEffects: ActiveStatusEffect[]
  /** Доступные в бою умения (включая strike). */
  cards: BattleCard[]
  /** Базовая атака врага: strike | shot | magic_bolt. */
  baseAttackId?: string
  /** Действовал ли юнит в текущем раунде. */
  hasActedThisRound: boolean
  /** Сколько раз юнит получил урон (для прокачки брони/аксессуара §16.5). */
  hitsTaken: number
  isBoss?: boolean
  /** Приоритеты умений для AI (templateId по убыванию). */
  skillPriorities?: string[]
  /**
   * Mod-слоты брони/аксессуара для защитных проков (reflect_on_hit,
   * self_heal_on_damaged — §16.12 п.4). Пассивные стат-моды экипировки уже
   * запечены в stats при спавне.
   */
  defensiveMods?: ModSlotState[]
  /** Склонность lucky_skill: один retry на внутрибоевом росте L умений (§16.15). */
  luckyCard?: boolean
  /** Склонность lucky_item: один retry на росте L оружия при атаке (§16.15). */
  luckyItem?: boolean
}

export type Terrain = 'floor' | 'wall'

export interface BattleField {
  width: number
  height: number
  /** Плоский массив width*height; индекс = y*width + x. */
  terrain: Terrain[]
}

export type BattlePhase = 'ongoing' | 'victory' | 'defeat'

export interface BattleLogEntry {
  round: number
  text: string
  kind:
    | 'attack'
    | 'heal'
    | 'death'
    | 'crit'
    | 'mod_proc'
    | 'status'
    | 'move'
    | 'info'
}

export interface BattleState {
  field: BattleField
  units: BattleUnit[]
  round: number
  phase: BattlePhase
  /** Порядок очереди текущего раунда: id юнитов. */
  turnOrder: string[]
  /** Индекс активного юнита в turnOrder. */
  activeIndex: number
  log: BattleLogEntry[]
  /** worldPower на момент боя (для scaling и подсчёта прироста). */
  worldPower: number
  /** Накоплено убийств врагов за бой (для worldPower += за kill). */
  enemyKills: number
  /** Метаданные сценария/попытки. */
  scenarioSlotIndex?: number
  /** Поражение уже финализировано (death-rolls/worldPower запечены) — защита от
   * повторного применения (повторный рендер, перезагрузка). */
  defeatFinalized?: boolean
}

/** Координата клетки. */
export interface Cell {
  x: number
  y: number
}
