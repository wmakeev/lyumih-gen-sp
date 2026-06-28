/** Корневой маршрутизатор по фазе кампании (§3.1). */

import { Alert, Layout, Space } from 'antd'
import { useGame } from '../state/store'
import { HubScreen } from './HubScreen'
import { BattleScreen } from './BattleScreen'
import { InterBattleScreen } from './InterBattleScreen'

export function App() {
  // подписка на rev — перерисовка после любого мутирующего экшена
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const notice = campaign.pendingHubNotice
  const excluded = useGame((s) => s.ui.excludedNotice)
  const dismissNotice = useGame((s) => s.dismissNotice)
  const dismissExcluded = useGame((s) => s.dismissExcluded)

  // excludedNotice хранит ch.id (успешный путь) или текст причины (отказ старта) —
  // показываем человеку имя, если id резолвится в персонажа.
  const excludedLabels = (excluded ?? []).map(
    (idOrText) => campaign.characters.find((c) => c.id === idOrText)?.name ?? idOrText,
  )

  let screen: React.ReactNode
  if (campaign.phase === 'inter_battle') screen = <InterBattleScreen />
  else if (campaign.battle !== null) screen = <BattleScreen />
  else screen = <HubScreen />

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Content style={{ padding: 16, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          {notice && (
            <Alert
              type={notice.kind === 'info' ? 'info' : 'success'}
              showIcon
              closable
              onClose={dismissNotice}
              message={noticeTitle(notice.kind)}
              description={notice.text}
            />
          )}
          {excluded && excluded.length > 0 && (
            <Alert
              type="warning"
              showIcon
              closable
              onClose={dismissExcluded}
              message="Не все бойцы отправились в поход"
              description={excludedLabels.join('; ')}
            />
          )}
          {screen}
        </Space>
      </Layout.Content>
    </Layout>
  )
}

function noticeTitle(kind: string): string {
  switch (kind) {
    case 'drop':
      return 'Добыча!'
    case 'dual_drop':
      return 'Двойная добыча!'
    case 'specialization_reveal':
      return 'Раскрыта склонность'
    default:
      return 'Сообщение'
  }
}
