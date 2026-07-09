/** Вкладка «Магазин»: офферы предметов/умения/пассива, обновление, продажа. */

import { Button, Card, Col, Divider, Empty, Row, Space, Tag, Typography } from 'antd'
import { useGame } from '../../state/store'
import { getConfig } from '../../core/config'
import { canAfford } from '../../core/campaign'

export function ShopTab() {
  useGame((s) => s.rev)
  const campaign = useGame((s) => s.campaign)
  const registry = useGame((s) => s.registry)
  const buyItem = useGame((s) => s.shopBuyItem)
  const buyCard = useGame((s) => s.shopBuyCard)
  const buyPassive = useGame((s) => s.shopBuyPassive)
  const sell = useGame((s) => s.shopSell)
  const refresh = useGame((s) => s.shopRefresh)

  const offers = campaign.shopOffers
  const refreshCost = getConfig().shop.refreshCost
  const afford = (price: number) => canAfford(campaign, price)

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Space>
        <Tag color="gold">💰 {campaign.gold}</Tag>
        <Button onClick={() => refresh()} disabled={!afford(refreshCost)}>
          Обновить ({refreshCost} 💰)
        </Button>
      </Space>

      {!offers ? (
        <Empty description="Лавка пуста" />
      ) : (
        <>
          <Divider titlePlacement="start" style={{ margin: '4px 0' }}>
            Предметы
          </Divider>
          <Row gutter={[12, 12]}>
            {offers.items.map((o) => {
              const tpl = registry.items.get(o.instance.templateId)
              return (
                <Col key={o.instance.id} xs={12} sm={8} md={6}>
                  <Card size="small" title={`${tpl?.iconEmoji ?? ''} ${tpl?.label ?? o.instance.templateId}`}>
                    <div>L{o.instance.itemLevel}</div>
                    <Button
                      type="primary"
                      size="small"
                      block
                      disabled={!afford(o.price)}
                      onClick={() => buyItem(o.instance.id)}
                    >
                      Купить ({o.price} 💰)
                    </Button>
                  </Card>
                </Col>
              )
            })}
            {offers.items.length === 0 && <Col span={24}><Typography.Text type="secondary">Нет предметов</Typography.Text></Col>}
          </Row>

          <Divider titlePlacement="start" style={{ margin: '12px 0 4px' }}>
            Умения и пассивы
          </Divider>
          <Row gutter={[12, 12]}>
            {offers.card && (
              <Col xs={12} sm={8} md={6}>
                <Card size="small" title={`📜 ${registry.cards.get(offers.card.instance.templateId)?.label ?? 'Умение'}`}>
                  <div>L{offers.card.instance.global_level}</div>
                  <Button type="primary" size="small" block disabled={!afford(offers.card.price)} onClick={() => buyCard()}>
                    Купить ({offers.card.price} 💰)
                  </Button>
                </Card>
              </Col>
            )}
            {offers.passive && (
              <Col xs={12} sm={8} md={6}>
                <Card size="small" title={`🌀 ${registry.passives.get(offers.passive.instance.templateId)?.label ?? 'Пассив'}`}>
                  <div>L{offers.passive.instance.global_level}</div>
                  <Button type="primary" size="small" block disabled={!afford(offers.passive.price)} onClick={() => buyPassive()}>
                    Купить ({offers.passive.price} 💰)
                  </Button>
                </Card>
              </Col>
            )}
            {!offers.card && !offers.passive && (
              <Col span={24}><Typography.Text type="secondary">Сегодня без умений и пассивов</Typography.Text></Col>
            )}
          </Row>
        </>
      )}

      <Divider titlePlacement="start" style={{ margin: '12px 0 4px' }}>
        Продажа из сундука
      </Divider>
      {campaign.chest.items.length === 0 ? (
        <Typography.Text type="secondary">Сундук пуст</Typography.Text>
      ) : (
        <Space wrap>
          {campaign.chest.items.map((it) => {
            const tpl = registry.items.get(it.templateId)
            return (
              <Button key={it.id} onClick={() => sell(it.id)}>
                Продать: {tpl?.iconEmoji} {tpl?.label ?? it.templateId} (L{it.itemLevel})
              </Button>
            )
          })}
        </Space>
      )}
    </Space>
  )
}
