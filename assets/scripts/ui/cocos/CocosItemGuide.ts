import { BlockInputEvents, Button, Graphics, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import type { BoardItemSale, GameContext } from '../../gameplay/GameContext';
import type { ItemVm } from '../../presentation/GameViewMapper';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

function text(parent: Node, value: string, x: number, y: number, width: number, height: number, size: number, color = CocosTheme.textPrimary(), bold = false): Label {
  const label = makeLabel(value, size, color, bold);
  parent.addChild(label.node);
  ensureTransform(label.node, width, height);
  label.enableWrapText = true;
  label.overflow = Label.Overflow.SHRINK;
  label.node.setPosition(x, y, 0);
  return label;
}

export class CocosItemGuide {
  private readonly root: Node;
  private readonly panel: Node;
  private readonly nameLabel: Label;
  private readonly sourceLabel: Label;
  private readonly goalLabel: Label;
  private readonly stepLabel: Label;
  private readonly chainLayer: Node;
  private readonly chainContent: Node;
  private readonly toolsLabel: Label;
  private readonly tools: Node;
  private readonly saleButton: Node;
  private readonly saleLabel: Label;
  private readonly chainCaption: Label;
  private saleQuote: Extract<BoardItemSale, { ok: true }> | null = null;
  private saleDialog: Node | null = null;
  private consumable = false;

  constructor(private readonly game: GameContext, roots: UiRoots, private readonly openTools: () => void, private readonly onClose?: () => void,
    private readonly openRewards?: () => void, private readonly saleFeedback?: (result: BoardItemSale) => void) {
    this.root = createUiNode('ItemGuideOverlay');
    roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight);
    this.root.addComponent(BlockInputEvents);
    this.root.active = false;
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 174));

    const scale = Math.min(1, (roots.designHeight - 48) / 900, (roots.designWidth - 24) / 700);
    this.panel = createUiNode('ItemGuidePanel');
    this.root.addChild(this.panel);
    ensureTransform(this.panel, 700, 900);
    this.panel.setScale(scale, scale, 1);
    paintRoundRect(this.panel.addComponent(Graphics), 700, 900, 30, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    applyMaterialFrame(this.panel,'paper',700,900,.70);

    text(this.panel, '物品图鉴', -105, 405, 410, 54, 32, hexColor('#68423A'), true);
    const close = createUiNode('ItemGuideClose');
    this.panel.addChild(close);
    ensureTransform(close, 104, 68);
    close.setPosition(278, 405, 0);
    paintRoundRect(close.addComponent(Graphics), 104, 68, 24, hexColor('#F3E7DE'));
    text(close, '关闭', 0, 0, 90, 54, 24, hexColor('#805A50'), true);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => this.close());

    this.nameLabel = text(this.panel, '', 0, 340, 630, 50, 29, hexColor('#68423A'), true);
    this.chainCaption = text(this.panel, '合成链（两个相同等级合成下一级）', 0, 295, 640, 40, 23, hexColor('#966C66'), true);
    this.chainLayer = createUiNode('ItemGuideChain');
    this.panel.addChild(this.chainLayer);
    ensureTransform(this.chainLayer, 660, 300);
    this.chainLayer.setPosition(0, 130, 0);
    this.chainLayer.addComponent(Mask);
    this.chainContent = createUiNode('ItemGuideChainContent'); this.chainLayer.addChild(this.chainContent);
    ensureTransform(this.chainContent, 660, 300, 0.5, 1); this.chainContent.setPosition(0, 150, 0);
    const scroll = this.chainLayer.addComponent(ScrollView); scroll.content = this.chainContent; scroll.horizontal = false; scroll.vertical = true; scroll.elastic = false;
    this.stepLabel = text(this.panel, '', 0, -62, 640, 60, 23, hexColor('#825A54'));
    this.sourceLabel = text(this.panel, '', 0, -136, 640, 76, 23, hexColor('#68423A'));
    this.goalLabel = text(this.panel, '', 0, -210, 640, 60, 23, hexColor('#9A6C55'), true);

    const tools = createUiNode('ItemGuideTools');
    this.tools = tools;
    this.panel.addChild(tools);
    ensureTransform(tools, 310, 70);
    tools.setPosition(0, -350, 0);
    paintRoundRect(tools.addComponent(Graphics), 310, 70, 26, CocosTheme.primary());
    this.toolsLabel = text(tools, '打开背包与剪刀', 0, 0, 290, 58, 24, hexColor('#FFFFFF'), true);
    tools.addComponent(Button);
    tools.on(Button.EventType.CLICK, () => { this.root.active = false; if (this.consumable && this.openRewards) this.openRewards(); else this.openTools(); });
    this.saleButton = this.saleAction(this.panel, 'ItemGuideSell', '', 162, -350, 260, () => this.openSaleConfirmation());
    this.saleLabel = this.saleButton.getComponentInChildren(Label)!;
  }

  open(item: ItemVm): void {
    this.closeSaleConfirmation();
    const quote = this.game.quoteBoardItemSale(item.cellIndex, item.uid);
    this.saleQuote = quote.ok ? quote : null;
    this.saleButton.active = quote.ok;
    this.saleLabel.string = quote.ok ? `出售 · ${quote.coins} 金币` : '';
    this.tools.setPosition(quote.ok ? -136 : 0, -350, 0);
    this.consumable = ['coin','energy','diamond','treasure_chest'].includes(item.chainId);
    this.toolsLabel.string = this.consumable ? '打开补给' : '打开背包与剪刀';
    const isCurrentDiscovered = this.game.isItemDiscovered(item.definitionId);
    if (!isCurrentDiscovered) {
      this.nameLabel.string = '？？？';
      this.stepLabel.string = '';
      this.sourceLabel.string = '';
      this.goalLabel.string = '';
      for (const child of [...this.chainContent.children]) { child.removeFromParent(); child.destroy(); }
      ensureTransform(this.chainContent, 660, 300, 0.5, 1); this.chainContent.setPosition(0, 150, 0);
      this.chainLayer.getComponent(ScrollView)?.scrollToTop(0);
      this.chainCaption.string = '合成后解锁更多物品';
      ensureTransform(this.chainContent, 660, 300, 0.5, 1); this.chainContent.setPosition(0, 150, 0);
      this.chainLayer.getComponent(ScrollView)?.scrollToTop(0);
      const unknown = createUiNode('UndiscoveredItem');
      this.chainContent.addChild(unknown); unknown.setPosition(0, -150, 0);
      ensureTransform(unknown, 150, 150);
      paintRoundRect(unknown.addComponent(Graphics), 136, 136, 24, hexColor('#FFFDF8'), hexColor('#F0DED5'), 1);
      text(unknown, '?', 0, 10, 110, 100, 64, hexColor('#A88F89'), true);
      this.root.active = true;
      return;
    }
    const chain = this.game.bundle.items.filter((definition) => definition.chainId === item.chainId)
      .sort((a, b) => a.level - b.level);
    this.chainCaption.string = chain.length > 8 ? `${chain.length} 阶合成链 · 上下滑动查看更多` : `${chain.length} 阶合成链 · 两个同级合成升级`;
    const generator = this.game.bundle.generators.find((candidate) => candidate.outputs.some((output) =>
      chain.some((definition) => definition.id === output.itemId)));
    this.nameLabel.string = `${item.displayName}  ·  Lv${item.level}`;
    this.stepLabel.string = `当前是第 ${item.level} 级；从一级开始合成约需 ${2 ** (item.level - 1)} 个基础物品。`;
    this.sourceLabel.string = generator
      ? generator.id === 'orange_tree'
        ? `获取来源：${generator.displayName}（不消耗体力；每 ${Math.floor((generator.recharge?.intervalMs ?? 60000) / 60000)} 分钟恢复1次，最多 ${generator.recharge?.capacity ?? 10} 次；Lv${generator.unlockLevel} 解锁）`
        : `获取来源：${generator.displayName}（每次消耗 ${generator.energyCost} 点体力；Lv${generator.unlockLevel} 解锁）`
      : '获取来源：合成或完成订单获得';
    const date = this.game.play.smallDateOrder();
    const requirement = date?.requirements.find((entry) => entry.itemId === item.definitionId);
    this.goalLabel.string = requirement
      ? `今日约会「${date?.template.title ?? ''}」需要 ${requirement.have}/${requirement.count} 件`
      : `今日约会「${date?.template.title ?? '—'}」暂不需要这件物品`;
    if (item.chainId === 'sugar') this.sourceLabel.string = '获取来源：Lv2 及以上咖啡机有机会额外产出方糖';
    if (item.definitionId === 'wildcard') {
      this.stepLabel.string = '拖到可升级的普通物品上，替代另一份相同等级的物品。';
      this.sourceLabel.string = '获取来源：高阶普通生成器极低概率额外产出';
      this.goalLabel.string = '不适用于补给、宝箱和已满级物品';
    } else if (item.chainId === 'scissors') {
      const definition = this.game.bundle.catalog.get(item.definitionId)!;
      this.stepLabel.string = `剩余 ${item.remainingUses ?? definition.maxUses} 次；拖到2级以上物品可拆成两个低一级物品。`;
      this.sourceLabel.string = '背包中取出1级剪刀，探索与七日签到可补充；同级剪刀可合成至5级。';
      this.goalLabel.string = '使用过的剪刀升级时折算剩余次数；不能拆分剪刀本身。';
    } else if (item.chainId === 'treasure_chest') {
      const lootCount = this.game.config.rewards.chestLevels.find((entry) => entry.level === item.level)?.count ?? 2;
      this.stepLabel.string = item.level < 5 ? '两个同级宝箱可合成更高一级，最高 Lv5。' : '这是最高级宝箱，已不能继续合成。';
      this.sourceLabel.string = '获取来源：升级礼包、普通物品成功合成时随机掉落';
      this.goalLabel.string = `确认打开后随机获得 ${lootCount} 件补给；放不下的进入恢复箱`;
    } else if (this.consumable) {
      this.stepLabel.string = item.level >= 5 ? '已达最高 Lv5，确认后可使用。' : '两个同级补给可合成升级，最高 Lv5；轻点查看详情，确认后使用。';
      this.sourceLabel.string = '获取来源：打开宝箱；相同等级的补给可以合成升级';
      this.goalLabel.string = item.chainId === 'energy' ? '使用后增加体力，奖励可超过自然上限' : item.chainId === 'diamond' ? '使用后存入钻石余额，可兑换体力或恢复生成器' : '使用后存入金币余额，可购买家具';
    }

    for (const child of [...this.chainContent.children]) { child.removeFromParent(); child.destroy(); }
    ensureTransform(this.chainContent, 660, Math.max(300, Math.ceil(chain.length / 4) * 150), 0.5, 1);
    this.chainContent.setPosition(0, 150, 0); this.chainLayer.getComponent(ScrollView)?.scrollToTop(0);
    const cellW = 154;
    chain.forEach((definition, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const tile = createUiNode(`ItemGuide_${definition.id}`);
      this.chainContent.addChild(tile);
      ensureTransform(tile, 154, 142);
      tile.setPosition(-240 + col * 160, -75 - row * 150, 0);
      const active = definition.id === item.definitionId;
      const discovered = this.game.isItemDiscovered(definition.id);
      paintRoundRect(tile.addComponent(Graphics), 154, 142, 18,
        active ? hexColor('#FCE9E4') : hexColor('#FFFDF8'),
        active ? CocosTheme.primary() : hexColor('#F0DED5'), active ? 2 : 1);
      const icon = createUiNode('ItemGuideIcon');
      tile.addChild(icon);
      const art = discovered ? itemArt(definition.id) : null;
      if (discovered && art) applyArt(icon, art, 68, 68);
      else if (discovered && definition.icon) applyArt(icon, { sheet: definition.icon }, 68, 68);
      else text(tile, '?', 0, 27, 80, 70, 46, hexColor('#A88F89'), true);
      icon.setPosition(0, 27, 0);
      if (discovered) text(tile, `Lv${definition.level}`, 52, 54, 48, 24, 18, hexColor('#9A7770'), true);
      text(tile, discovered ? definition.displayName : '未发现', 0, -40, cellW - 8, 54, 22,
        active ? hexColor('#8D4F58') : hexColor('#80635C'), active);
    });
    this.root.active = true;
  }

  openDiscovered(definitionId: string): void {
    const definition = this.game.bundle.catalog.get(definitionId);
    if (!definition || !this.game.isItemDiscovered(definitionId)) return;
    this.open({ uid: '', cellIndex: -1, definitionId: definition.id, displayName: definition.displayName,
      chainId: definition.chainId, level: definition.level, code: '', discovered: true });
  }

  private saleAction(parent: Node, name: string, caption: string, x: number, y: number, width: number, onClick: () => void, primary = false): Node {
    const action = createUiNode(name); parent.addChild(action); ensureTransform(action, width, 70);
    action.setPosition(x, y, 0);
    paintTactileButton(action.addComponent(Graphics), width, 70, primary ? 'rose' : 'cream');
    text(action, caption, 0, 0, width - 16, 58, 25, hexColor(primary ? '#FFFFFF' : '#8B564A'), true);
    pressButton(action); action.on(Button.EventType.CLICK, onClick);
    return action;
  }

  private openSaleConfirmation(): void {
    if (!this.saleQuote || this.saleDialog) return;
    const sale = this.game.quoteBoardItemSale(this.saleQuote.index, this.saleQuote.uid);
    if (!sale.ok) { this.close(); this.saleFeedback?.(sale); return; }
    const rootSize = this.root.getComponent(UITransform)!.contentSize;
    const overlay = createUiNode('SellItemConfirmOverlay');
    this.saleDialog = overlay; this.root.addChild(overlay); ensureTransform(overlay, rootSize.width, rootSize.height);
    overlay.addComponent(BlockInputEvents);
    paintRoundRect(overlay.addComponent(Graphics), rootSize.width, rootSize.height, 0, hexColor('#362B2B', 146));
    const card = createUiNode('SellItemConfirmCard'); overlay.addChild(card); ensureTransform(card, 600, 390);
    const scale = Math.min(1, (rootSize.width - 44) / 600, (rootSize.height - 56) / 390);
    card.setScale(scale, scale, 1);
    paintRoundRect(card.addComponent(Graphics), 600, 390, 28, hexColor('#FFF5E9'), hexColor('#E2C6AA'), 2);
    applyMaterialFrame(card, 'paper', 600, 390, .62);
    const definition = this.game.bundle.catalog.get(sale.definitionId);
    const name = this.game.isItemDiscovered(sale.definitionId) ? definition?.displayName ?? '当前物品' : '当前物品';
    text(card, '出售这件物品？', 0, 135, 550, 58, 32, hexColor('#765044'), true);
    text(card, `${name}  ·  +${sale.coins} 金币`, 0, 59, 536, 48, 28, hexColor('#A4744B'), true);
    const warning = text(card, sale.breaksReadyOrder ? '这件物品已为订单备齐。出售后，订单会重新缺货。' : '出售后会腾出一格，物品无法取回。',
      0, -28, 500, 64, 23, hexColor(sale.breaksReadyOrder ? '#A24E48' : '#886B58'));
    warning.node.name = 'SaleOrderWarning';
    this.saleAction(card, 'SellItemCancel', '返回', -137, -132, 220, () => this.closeSaleConfirmation());
    this.saleAction(card, 'SellItemConfirm', '确认出售', 128, -132, 244, () => {
      if (this.saleDialog !== overlay) return;
      const result = this.game.sellBoardItem(sale.index, sale.uid);
      this.close(); this.saleFeedback?.(result);
    }, true);
  }
  private closeSaleConfirmation(): void {
    if (!this.saleDialog) return;
    this.saleDialog.removeFromParent(); this.saleDialog.destroy(); this.saleDialog = null;
  }
  close(): void { this.closeSaleConfirmation(); this.root.active = false; this.onClose?.(); }
  get isOpen(): boolean { return this.root.active; }
}
