/** Вкладка «Таверна»: кандидаты на найм (склонность скрыта), обновление. */

import { Button, Card, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { useGame } from '../../state/store'
import { StatStrip } from '../components/StatStrip'
import { UnitIcon } from '../components/UnitIcon'

export function TavernTab() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const hire = useGame((s) => s.tavernHire)
  const refresh = useGame((s) => s.tavernRefresh)

  const canAfford = (price: number) => campaign.gold >= price

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Space>
        <Tag color="gold">💰 {campaign.gold}</Tag>
        <Button onClick={() => refresh()}>Обновить</Button>
      </Space>

      {campaign.tavernCandidates.length === 0 ? (
        <Empty description="Нет кандидатов" />
      ) : (
        <Row gutter={[12, 12]}>
          {campaign.tavernCandidates.map((c) => {
            const cls = registry.classes.get(c.classId)
            return (
              <Col key={c.id} xs={24} sm={12} md={8}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <UnitIcon emoji={c.iconEmoji} accent={c.iconAccent} />
                      <span>{c.name}</span>
                    </Space>
                  }
                >
                  <Space orientation="vertical" style={{ width: '100%' }} size={6}>
                    <Space wrap>
                      <Tag>{cls?.label ?? c.classId}</Tag>
                      <Tag color="purple">Склонность: ?</Tag>
                    </Space>
                    <StatStrip stats={c.baseStats} rating={c.baseStatRating} />
                    <div>
                      <Typography.Text type="secondary">Стартовая экипировка:</Typography.Text>
                      <Space wrap style={{ display: 'flex', marginTop: 2 }}>
                        {c.startingGear.map((g, i) => {
                          const tpl = registry.items.get(g)
                          return (
                            <Tag key={i}>
                              {tpl?.iconEmoji} {tpl?.label ?? g}
                            </Tag>
                          )
                        })}
                      </Space>
                    </div>
                    <Button
                      type="primary"
                      block
                      disabled={!canAfford(c.price)}
                      onClick={() => hire(c.id)}
                    >
                      Нанять ({c.price} 💰)
                    </Button>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </Space>
  )
}
