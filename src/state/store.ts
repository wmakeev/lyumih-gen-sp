/**
 * Zustand-стор: единый store кампании + UI-флаги сессии (§2).
 * Вся игровая логика — в ядре; стор только диспатчит и сохраняет.
 */

import { create } from 'zustand'
import { CONTENT } from '../core/content'
import { getConfig, LIMITS } from '../core/config'
import { MathRng } from '../core/rng'
import type { CampaignState } from '../core/types/campaign'
import type { Cell } from '../core/types/battle'
import type { BattleContext } from '../core/battle/engine'
import { applyMove, basicAttack, useCard, endTurn } from '../core/battle/engine'
import { activeUnit } from '../core/battle/queue'
import { takeAITurn } from '../core/battle/ai'
import {
  createNewCampaign,
  loadCampaign,
  saveCampaign,
  startExpedition as coreStart,
  retryCurrentBattle,
  abandonBattle,
  toInterBattle,
  interBattleReviveAll,
  advanceToNextBattle,
  finishExpedition,
  hasNextBattle,
  currentScenario,
  finalizeBattle,
  finalizeDefeat,
  hireFromTavern,
  refreshTavern,
  buyItem,
  buyCard,
  buyPassive,
  refreshShop,
  sellChestItem,
  generateShopOffer,
  bindChestCard,
  bindChestPassive,
  equipItem,
  unequipSlot,
} from '../core/campaign'

export type HubTab = 'persona' | 'shop' | 'tavern' | 'memento' | 'codex' | 'help' | 'expedition'

const rng = new MathRng()
const registry = CONTENT
const TAVERN_COUNT = 4

function battleContext(): BattleContext {
  return { cards: registry.cards, mods: registry.cardItemMods, rng }
}

interface UIState {
  tab: HubTab
  selectedCharacterId: string | null
  selectedExpeditionMode: string
  squadSelection: boolean[] // чекбоксы участия (§12.5)
  selectedBattleUnitId: string | null
  selectedCardId: string | null
  autoBattle: boolean
  excludedNotice: string[] | null
}

interface StoreState {
  campaign: CampaignState
  ui: UIState
  rev: number
  registry: typeof registry

  // системные
  newGame: () => void
  resetSave: () => void
  setTab: (t: HubTab) => void
  dismissNotice: () => void
  dismissExcluded: () => void

  // персонаж
  selectCharacter: (id: string | null) => void
  setSquadSlot: (slot: number, characterId: string | null) => void
  equip: (characterId: string, itemId: string) => void
  unequip: (characterId: string, slot: 'weapon' | 'armor' | 'accessory') => void
  toggleLoadoutCard: (characterId: string, cardId: string) => void
  togglePassiveEquip: (characterId: string, passiveId: string) => void
  bindCard: (cardId: string, characterId: string) => void
  bindPassive: (passiveId: string, characterId: string) => void

  // магазин/таверна
  shopBuyItem: (itemId: string) => void
  shopBuyCard: () => void
  shopBuyPassive: () => void
  shopSell: (itemId: string) => void
  shopRefresh: () => void
  tavernHire: (candidateId: string) => void
  tavernRefresh: () => void

  // экспедиция
  setExpeditionMode: (id: string) => void
  toggleSquadSelection: (index: number) => void
  startExpedition: () => void

  // бой
  selectBattleUnit: (id: string | null) => void
  selectCard: (id: string | null) => void
  battleMove: (cell: Cell) => void
  battleBasic: (targetId: string) => void
  battleCard: (target: { unitId?: string; cell?: Cell }) => void
  battleEndTurn: () => void
  toggleAuto: () => void
  autoStep: () => void

  // исход
  finalizeVictory: () => void
  retry: () => void
  abandon: () => void
  reviveAll: () => void
  nextBattle: () => void

  discoverCodex: (id: string) => void
}

function persist(c: CampaignState) {
  saveCampaign(c)
}

/** Свежий UI-слайс для (пере)старта игры — иначе выбор бойца/отряда/авто-боя
 * протекает из прошлой кампании в новую. */
function freshUi(c: CampaignState): UIState {
  return {
    tab: 'persona',
    selectedCharacterId: c.characters[0]?.id ?? null,
    selectedExpeditionMode: 'campaign-main',
    squadSelection: [false, false, false, false],
    selectedBattleUnitId: null,
    selectedCardId: null,
    autoBattle: false,
    excludedNotice: null,
  }
}

export const useGame = create<StoreState>((set, get) => {
  const initial = loadCampaign() ?? createNewCampaign(registry, getConfig(), rng)

  // §16.6: при поражении один раз применяем death-rolls/worldPower и запекаем их
  // в снимок попытки (см. finalizeDefeat) — до того, как игрок выберет retry/abandon.
  const maybeFinalizeDefeat = (c: CampaignState) => {
    const b = c.battle
    if (b && b.phase === 'defeat' && !b.defeatFinalized) {
      finalizeDefeat(c, registry, getConfig(), rng)
      b.defeatFinalized = true
    }
  }

  const commit = (mutator?: () => void) => {
    if (mutator) mutator()
    const c = get().campaign
    maybeFinalizeDefeat(c)
    persist(c)
    set((s) => ({ rev: s.rev + 1 }))
  }

  return {
    campaign: initial,
    registry,
    rev: 0,
    ui: freshUi(initial),

    newGame: () => {
      const c = createNewCampaign(registry, getConfig(), rng)
      set({ campaign: c, ui: freshUi(c), rev: get().rev + 1 })
      persist(c)
    },
    resetSave: () => {
      const c = createNewCampaign(registry, getConfig(), rng)
      set({ campaign: c, ui: freshUi(c), rev: get().rev + 1 })
      persist(c)
    },
    setTab: (t) => set((s) => ({ ui: { ...s.ui, tab: t } })),
    dismissNotice: () =>
      commit(() => {
        get().campaign.pendingHubNotice = null
      }),
    dismissExcluded: () => set((s) => ({ ui: { ...s.ui, excludedNotice: null } })),

    selectCharacter: (id) => set((s) => ({ ui: { ...s.ui, selectedCharacterId: id } })),
    setSquadSlot: (slot, characterId) =>
      commit(() => {
        const c = get().campaign
        if (c.expedition) return
        // убрать из других слотов
        if (characterId) {
          for (let i = 0; i < c.squad.length; i++) if (c.squad[i] === characterId) c.squad[i] = null
        }
        c.squad[slot] = characterId
      }),
    equip: (characterId, itemId) =>
      commit(() => {
        const ch = get().campaign.characters.find((x) => x.id === characterId)
        if (ch && !get().campaign.expedition) equipItem(ch, itemId, registry)
      }),
    unequip: (characterId, slot) =>
      commit(() => {
        const ch = get().campaign.characters.find((x) => x.id === characterId)
        if (ch && !get().campaign.expedition) unequipSlot(ch, slot)
      }),
    toggleLoadoutCard: (characterId, cardId) =>
      commit(() => {
        const ch = get().campaign.characters.find((x) => x.id === characterId)
        if (!ch) return
        const i = ch.battleLoadout.indexOf(cardId)
        if (i >= 0) ch.battleLoadout.splice(i, 1)
        else if (ch.battleLoadout.length < LIMITS.baseLoadoutSize) ch.battleLoadout.push(cardId)
      }),
    togglePassiveEquip: (characterId, passiveId) =>
      commit(() => {
        const ch = get().campaign.characters.find((x) => x.id === characterId)
        if (!ch) return
        const i = ch.passiveEquip.indexOf(passiveId)
        if (i >= 0) ch.passiveEquip.splice(i, 1)
        else if (ch.passiveEquip.length < LIMITS.baseEquippedPassives) ch.passiveEquip.push(passiveId)
      }),
    bindCard: (cardId, characterId) => commit(() => bindChestCard(get().campaign, cardId, characterId)),
    bindPassive: (passiveId, characterId) =>
      commit(() => bindChestPassive(get().campaign, passiveId, characterId, LIMITS.baseOwnedPassives)),

    shopBuyItem: (itemId) => commit(() => buyItem(get().campaign, itemId)),
    shopBuyCard: () => commit(() => buyCard(get().campaign)),
    shopBuyPassive: () => commit(() => buyPassive(get().campaign)),
    shopSell: (itemId) => commit(() => sellChestItem(get().campaign, itemId, registry)),
    shopRefresh: () => commit(() => refreshShop(get().campaign, registry, getConfig(), rng)),
    tavernHire: (candidateId) => commit(() => hireFromTavern(get().campaign, candidateId, registry, rng)),
    tavernRefresh: () => commit(() => refreshTavern(get().campaign, registry, getConfig(), rng, TAVERN_COUNT)),

    setExpeditionMode: (id) => set((s) => ({ ui: { ...s.ui, selectedExpeditionMode: id } })),
    toggleSquadSelection: (index) =>
      set((s) => {
        const sel = [...s.ui.squadSelection]
        sel[index] = !sel[index]
        return { ui: { ...s.ui, squadSelection: sel } }
      }),
    startExpedition: () => {
      const c = get().campaign
      const ui = get().ui
      const occupied = c.squad.filter((x): x is string => !!x)
      const anyChecked = ui.squadSelection.some(Boolean)
      let ids = occupied
      if (anyChecked) {
        ids = c.squad.filter((x, i): x is string => !!x && !!ui.squadSelection[i])
      }
      const res = coreStart(c, {
        modeId: ui.selectedExpeditionMode,
        characterIds: ids,
        registry,
        rng,
        seed: Math.floor(rng.nextFloat() * 1e9),
      })
      if (res.ok) {
        set((s) => ({
          ui: { ...s.ui, excludedNotice: res.excluded.length ? res.excluded : null, selectedBattleUnitId: null },
          rev: s.rev + 1,
        }))
        persist(c)
      } else {
        set((s) => ({ ui: { ...s.ui, excludedNotice: [res.reason ?? 'нельзя стартовать'] } }))
      }
    },

    selectBattleUnit: (id) => set((s) => ({ ui: { ...s.ui, selectedBattleUnitId: id, selectedCardId: null } })),
    selectCard: (id) => set((s) => ({ ui: { ...s.ui, selectedCardId: id } })),
    battleMove: (cell) =>
      commit(() => {
        const b = get().campaign.battle
        const u = b && activeUnit(b)
        if (b && u && u.side === 'player') {
          applyMove(b, u.id, cell)
          endTurn(b)
        }
      }),
    battleBasic: (targetId) =>
      commit(() => {
        const b = get().campaign.battle
        const u = b && activeUnit(b)
        if (b && u && u.side === 'player') {
          basicAttack(b, u.id, targetId, battleContext())
          if (b.phase === 'ongoing') endTurn(b)
        }
      }),
    battleCard: (target) =>
      commit(() => {
        const b = get().campaign.battle
        const u = b && activeUnit(b)
        const cardId = get().ui.selectedCardId
        if (b && u && u.side === 'player' && cardId) {
          useCard(b, u.id, cardId, target, battleContext())
          if (b.phase === 'ongoing') endTurn(b)
        }
        set((s) => ({ ui: { ...s.ui, selectedCardId: null } }))
      }),
    battleEndTurn: () =>
      commit(() => {
        const b = get().campaign.battle
        if (b) endTurn(b)
      }),
    toggleAuto: () => set((s) => ({ ui: { ...s.ui, autoBattle: !s.ui.autoBattle } })),
    autoStep: () =>
      commit(() => {
        const b = get().campaign.battle
        if (!b || b.phase !== 'ongoing') return
        const u = activeUnit(b)
        if (u) takeAITurn(b, u.id, battleContext(), u.side === 'player' ? 'auto' : 'enemy')
      }),

    finalizeVictory: () => {
      const c = get().campaign
      if (!c.battle) return
      const scenario = currentScenario(c, registry)
      const gold = scenario?.goldReward ?? 50
      const result = finalizeBattle(c, registry, getConfig(), rng, gold)
      c.pendingHubNotice = result.notice
      // следующий бой или финиш
      if (c.battle.phase === 'victory') {
        if (hasNextBattle(c)) {
          toInterBattle(c)
        } else {
          finishExpedition(c)
          c.scenarioIndex += 1
        }
      }
      // обновим магазин/таверну при возврате в хаб
      if (c.phase === 'hub' && !c.expedition) {
        c.shopOffers = generateShopOffer(registry, getConfig(), rng)
      }
      set((s) => ({ rev: s.rev + 1 }))
      persist(c)
    },
    retry: () => commit(() => retryCurrentBattle(get().campaign, registry, rng)),
    abandon: () => commit(() => abandonBattle(get().campaign)),
    reviveAll: () => commit(() => interBattleReviveAll(get().campaign)),
    nextBattle: () => commit(() => advanceToNextBattle(get().campaign, registry, rng)),

    discoverCodex: (id) =>
      commit(() => {
        const c = get().campaign
        if (!c.codexDiscovered.includes(id)) c.codexDiscovered.push(id)
      }),
  }
})
