/**
 * Фабрики инстансов носителей из шаблонов (§16.5: старт L/itemLevel = 1).
 */

import type {
  CardInstance,
  ItemInstance,
  PassiveInstance,
} from '../types/memento'
import { nextId } from './ids'

export function createCardInstance(templateId: string): CardInstance {
  return {
    id: nextId('card'),
    templateId,
    global_level: 1,
    uses_count: 0,
    modSlots: [],
  }
}

export function createPassiveInstance(templateId: string): PassiveInstance {
  return {
    id: nextId('passive'),
    templateId,
    global_level: 1,
    uses_count: 0,
    modSlots: [],
  }
}

export function createItemInstance(templateId: string, itemLevel = 1): ItemInstance {
  return {
    id: nextId('item'),
    templateId,
    itemLevel,
    modSlots: [],
  }
}
