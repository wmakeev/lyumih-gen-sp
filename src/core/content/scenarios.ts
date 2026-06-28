/**
 * 3 статических сценария (§12.6). Каждый 4-й слот boss-lite — босс.
 */

import type { StaticScenario } from '../types/content'

export const SCENARIOS: StaticScenario[] = [
  {
    id: 'tutorial',
    label: 'Обучение: Застава у леса',
    field: {
      width: 6,
      height: 6,
      walls: [
        [2, 2],
        [3, 2],
      ],
    },
    heroSpawn: {
      cells: [
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 0, y: 5 },
        { x: 1, y: 5 },
      ],
    },
    enemySlots: [
      { archetypeId: 'counter_warrior_duelist', x: 4, y: 1 },
      { archetypeId: 'counter_ranger_skirmisher', x: 5, y: 0 },
      { archetypeId: 'counter_mage_silencer', x: 5, y: 2 },
    ],
    goldReward: 150,
  },
  {
    id: 'two-front',
    label: 'Бой на два фронта',
    field: {
      width: 10,
      height: 8,
      walls: [
        [4, 3],
        [5, 3],
        [4, 4],
        [5, 4],
      ],
    },
    heroSpawn: {
      cells: [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 4, y: 7 },
        { x: 5, y: 7 },
      ],
    },
    enemySlots: [
      { archetypeId: 'counter_paladin_breaker', x: 0, y: 0 },
      { archetypeId: 'counter_healer_plaguebearer', x: 0, y: 3 },
      { archetypeId: 'counter_rogue_hunter', x: 9, y: 7 },
      { archetypeId: 'counter_warlock_inquisitor', x: 9, y: 4 },
      { archetypeId: 'chaotic_mutant_beast', x: 0, y: 7 },
      { archetypeId: 'counter_berserker_chiller', x: 9, y: 0 },
    ],
    goldReward: 320,
  },
  {
    id: 'boss-lite',
    label: 'Логово: каждый четвёртый — босс',
    field: {
      width: 12,
      height: 10,
      walls: [
        [5, 5],
        [6, 5],
        [5, 4],
        [6, 4],
        [2, 7],
        [9, 7],
      ],
    },
    heroSpawn: {
      cells: [
        { x: 0, y: 4 },
        { x: 0, y: 5 },
        { x: 1, y: 4 },
        { x: 1, y: 5 },
      ],
    },
    enemySlots: [
      { archetypeId: 'counter_warrior_shieldbreaker', x: 6, y: 1 },
      { archetypeId: 'counter_ranger_charger', x: 8, y: 2 },
      { archetypeId: 'counter_rogue_sentinel', x: 10, y: 4 },
      // каждый 4-й слот — босс
      { archetypeId: 'boss_paladin_doomguard', x: 11, y: 5 },
      { archetypeId: 'counter_healer_executioner', x: 8, y: 7 },
      { archetypeId: 'counter_warlock_zealot', x: 6, y: 8 },
      { archetypeId: 'counter_berserker_warden', x: 10, y: 8 },
      // 8-й слот — второй босс
      { archetypeId: 'boss_warrior_ironjaw', x: 11, y: 9 },
    ],
    goldReward: 800,
  },
]
