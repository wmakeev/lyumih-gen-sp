/** Вкладка «Кодекс»: записи buildCodex() по 7 категориям (§14.1). */

import { useMemo } from 'react'
import { Collapse, List, Typography } from 'antd'
import { buildCodex } from '../../core/content'
import type { CodexCategory, CodexEntry } from '../../core/types/content'

const CATEGORY_RU: Record<CodexCategory, string> = {
  class: 'Классы',
  affinity: 'Расы и склонности',
  item: 'Предметы',
  card: 'Умения',
  passive: 'Пассивы',
  enemy: 'Враги',
  mod: 'Модификаторы',
}

const ORDER: CodexCategory[] = ['class', 'affinity', 'item', 'card', 'passive', 'enemy', 'mod']

export function CodexTab() {
  const entries = useMemo(() => buildCodex(), [])
  const byCat = useMemo(() => {
    const m = new Map<CodexCategory, CodexEntry[]>()
    for (const cat of ORDER) m.set(cat, [])
    for (const e of entries) m.get(e.category)?.push(e)
    return m
  }, [entries])

  return (
    <Collapse
      accordion
      items={ORDER.map((cat) => {
        const list = byCat.get(cat) ?? []
        return {
          key: cat,
          label: `${CATEGORY_RU[cat]} (${list.length})`,
          children: (
            <List
              dataSource={list}
              renderItem={(e) => (
                <List.Item>
                  <List.Item.Meta
                    title={e.title}
                    description={
                      <>
                        {e.lines.map((l, i) => (
                          <Typography.Paragraph key={i} style={{ marginBottom: 2 }}>
                            {l}
                          </Typography.Paragraph>
                        ))}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          ),
        }
      })}
    />
  )
}
