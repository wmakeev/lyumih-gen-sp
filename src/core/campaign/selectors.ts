/**
 * Тонкие чистые селекторы/правила чтения кампании (§11–12).
 *
 * Инкапсулируют тривиальные доменные вычисления, чтобы UI не повторял формулы.
 * Без мутаций, без импортов UI/React.
 */

import type { CampaignState } from '../types/campaign'

/** Хватает ли золота на цену `price` (§11 экономика). */
export function canAfford(campaign: CampaignState, price: number): boolean {
  return campaign.gold >= price
}

/**
 * Идентификаторы участников экспедиции по выбору чекбоксов (§12.5): если отмечен
 * хотя бы один слот — идут только отмеченные занятые слоты; иначе — все занятые.
 */
export function participatingSquadIds(
  squad: readonly (string | null)[],
  squadSelection: readonly boolean[],
): string[] {
  const anyChecked = squadSelection.some(Boolean)
  return squad.filter(
    (cid, i): cid is string => !!cid && (!anyChecked || !!squadSelection[i]),
  )
}
