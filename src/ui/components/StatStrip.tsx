/** Компактная строка статов: иконка (Sprite) + число по каждому из 9 статов + ★рейтинг. */

import { Space, Tag, Tooltip } from 'antd'
import { STAT_IDS, STAT_META, type StatBlock } from '../../core/types/stats'
import { Sprite } from './Sprite'

interface Props {
  stats: StatBlock
  rating?: number
}

export function StatStrip({ stats, rating }: Props) {
  return (
    <Space size={[4, 4]} wrap>
      {STAT_IDS.map((id) => {
        const meta = STAT_META[id]
        const value = stats[id]
        return (
          <Tooltip key={id} title={`${meta.ru}: ${value}`}>
            <Tag style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {/* id стата = id иконки в реестре (атлас icons). */}
              <Sprite id={id} size={14} />
              {value}
            </Tag>
          </Tooltip>
        )
      })}
      {rating !== undefined && (
        <Tooltip title="Среднее качество роллов статов">
          <Tag color="gold" style={{ margin: 0 }}>
            ★ {Math.round(rating * 100)}%
          </Tag>
        </Tooltip>
      )}
    </Space>
  )
}
