/** Хаб: вкладки (§3.3) + шапка с золотом / силой мира / сценарием. */

import { Space, Tabs, Tag, Typography } from 'antd'
import { useGame, type HubTab } from '../state/store'
import { PersonaTab } from './tabs/PersonaTab'
import { ShopTab } from './tabs/ShopTab'
import { TavernTab } from './tabs/TavernTab'
import { ExpeditionTab } from './tabs/ExpeditionTab'
import { MementoTab } from './tabs/MementoTab'
import { CodexTab } from './tabs/CodexTab'
import { HelpTab } from './tabs/HelpTab'

export function HubScreen() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const tab = useGame((s) => s.ui.tab)
  const setTab = useGame((s) => s.setTab)

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Space size="large" wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Gen
        </Typography.Title>
        <Tag color="gold" style={{ fontSize: 14 }}>
          💰 {campaign.gold}
        </Tag>
        <Tag color="blue" style={{ fontSize: 14 }}>
          🌍 Сила мира: {campaign.worldPower}
        </Tag>
        <Tag style={{ fontSize: 14 }}>Сценарий: {campaign.scenarioIndex}</Tag>
      </Space>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as HubTab)}
        items={[
          { key: 'expedition', label: 'Бой / Экспедиция', children: <ExpeditionTab /> },
          { key: 'persona', label: 'Персонаж', children: <PersonaTab /> },
          { key: 'shop', label: 'Магазин', children: <ShopTab /> },
          { key: 'tavern', label: 'Таверна', children: <TavernTab /> },
          { key: 'memento', label: 'Memento', children: <MementoTab /> },
          { key: 'codex', label: 'Кодекс', children: <CodexTab /> },
          { key: 'help', label: 'Справка', children: <HelpTab /> },
        ]}
      />
    </Space>
  )
}
