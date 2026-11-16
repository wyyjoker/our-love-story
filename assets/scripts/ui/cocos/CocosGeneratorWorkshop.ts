import { BlockInputEvents, Button, Event, Graphics, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { GeneratorDefinition, GeneratorOutput } from '../../core/types';
import type { UiRoots } from './UiFactory';
import { applyArt, generatorArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

type GeneratorStatus = NonNullable<ReturnType<GameContext['getGeneratorStatus']>>;
type WorkshopTab = 'upgrade' | 'output';

function countdown(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function label(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size = 20, bold = false): Label {
  const node = createUiNode(name);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  const result = node.addComponent(Label);
  result.string = value;
  result.fontSize = size;
  result.lineHeight = size + 4;
  result.color = CocosTheme.textPrimary();
  result.isBold = bold;
  result.horizontalAlign = Label.HorizontalAlign.CENTER;
  result.verticalAlign = Label.VerticalAlign.CENTER;
  result.overflow = Label.Overflow.SHRINK;
  return result;
}

function button(parent: Node, name: string, caption: string, x: number, y: number, width: number, height: number, onClick: () => void, enabled = true, fontSize = 20): Node {
  const node = createUiNode(name);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  paintRoundRect(node.addComponent(Graphics), width, height, Math.min(20, height / 2), enabled ? hexColor('#F1C9BE') : hexColor('#E7DFDA'), enabled ? hexColor('#D7AFA2') : hexColor('#D9D1CC'), 1);
  label(node, `${name}Label`, caption, 0, 0, width - 12, height - 8, fontSize, true).color = enabled ? hexColor('#704A43') : hexColor('#988F8A');
  node.addComponent(Button);
  node.addComponent(BlockInputEvents);
  node.on(Button.EventType.CLICK, (event: Event) => { event.propagationStopped = true; if (enabled) onClick(); });
  return node;
}

export class CocosGeneratorWorkshop {
  private readonly root: Node;
  private readonly card: Node;
  private readonly summary: Node;
  private readonly selectorStrip: Node;
  private readonly viewport: Node;
  private readonly scroll: ScrollView;
  private readonly content: Node;
  private selectedId: string;
  private tab: WorkshopTab = 'output';
  private readonly feedback: (message: string, success?: boolean) => void;
  private readonly onBoost: (id: string) => void;
  private readonly onClose?: () => void;
  private readonly onRestore?: (id: string) => void;
  private cooldownLabel: Label | null = null;
  private cooldownFill: Node | null = null;
  private readonly cooldownBarWidth = 496;
  private readonly panelWidth = 650;
  private readonly panelHeight = 1100;
  private readonly viewportHeight = 520;

  constructor(
    private readonly game: GameContext,
    roots: UiRoots,
    feedback: (message: string, success?: boolean) => void,
    onBoost: (id: string) => void,
    onClose?: () => void,
    onRestore?: (id: string) => void,
  ) {
    this.feedback = feedback;
    this.onBoost = onBoost;
    this.onClose = onClose;
    this.onRestore = onRestore;
    this.selectedId = game.bundle.generators[0]?.id ?? '';
    this.root = createUiNode('GeneratorWorkshopPanel');
    roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight);
    this.root.addComponent(BlockInputEvents);
    this.root.active = false;
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 178));

    this.card = createUiNode('GeneratorWorkshopCard');
    this.root.addChild(this.card);
    ensureTransform(this.card, this.panelWidth, this.panelHeight);
    const scale = Math.min(1, (roots.designHeight - 32) / this.panelHeight, (roots.designWidth - 28) / this.panelWidth);
    this.card.setScale(scale, scale, 1);
    paintRoundRect(this.card.addComponent(Graphics), this.panelWidth, this.panelHeight, 28, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    label(this.card, 'GeneratorWorkshopTitle', '生成器管理', -120, 506, 350, 46, 30, true);
    button(this.card, 'GeneratorWorkshopCloseButton', '关闭', 264, 506, 96, 64, () => this.close(), true, 22);

    this.selectorStrip = createUiNode('GeneratorSelectorStrip');
    this.card.addChild(this.selectorStrip);
    ensureTransform(this.selectorStrip, 630, 128);
    this.selectorStrip.setPosition(0, 400, 0);
    game.bundle.generators.slice(0, 5).forEach((generator, index) => this.createGeneratorChoice(generator, index));

    this.summary = createUiNode('GeneratorSummary');
    this.card.addChild(this.summary);
    ensureTransform(this.summary, 620, 286);
    this.summary.setPosition(0, 210, 0);

    const tabs = createUiNode('GeneratorWorkshopTabs');
    this.card.addChild(tabs);
    ensureTransform(tabs, 620, 72);
    tabs.setPosition(0, 66, 0);
    this.createTab(tabs, 'upgrade', '升级', -152);
    this.createTab(tabs, 'output', '产出', 152);

    this.viewport = createUiNode('GeneratorWorkshopViewport');
    this.card.addChild(this.viewport);
    ensureTransform(this.viewport, 630, this.viewportHeight);
    this.viewport.setPosition(0, -250, 0);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.content = createUiNode('GeneratorWorkshopContent');
    this.viewport.addChild(this.content);
    ensureTransform(this.content, 620, this.viewportHeight);
    this.content.getComponent(UITransform)?.setAnchorPoint(0.5, 1);
    this.content.setPosition(0, this.viewportHeight / 2, 0);
    this.scroll.content = this.content;
    this.root.active = false;
  }

  get isOpen(): boolean { return this.root.active; }
  open(): void { this.root.active = true; this.render(); }
  close(): void { this.root.active = false; this.onClose?.(); }

  private createGeneratorChoice(generator: GeneratorDefinition, index: number): void {
    const choice = createUiNode(`GeneratorSelect_${generator.id}`);
    this.selectorStrip.addChild(choice);
    ensureTransform(choice, 116, 124);
    choice.setPosition(-250 + index * 125, 0, 0);
    paintRoundRect(choice.addComponent(Graphics), 116, 124, 18, hexColor('#FFFDF9'), hexColor('#EADBD2'), 1);
    const icon = createUiNode('GeneratorSelectIcon');
    choice.addChild(icon);
    icon.setPosition(0, 20, 0);
    const art = generatorArt(generator.id);
    if (art) applyArt(icon, { ...art, preserveAspect: true }, 78, 78);
    else label(choice, 'GeneratorFallbackIcon', '✦', 0, 20, 60, 60, 32, true);
    label(choice, `GeneratorSelectName_${generator.id}`, generator.displayName, 0, -46, 108, 30, 20, true);
    choice.addComponent(Button);
    choice.addComponent(BlockInputEvents);
    choice.on(Button.EventType.CLICK, (event: Event) => {
      event.propagationStopped = true;
      this.selectedId = generator.id;
      this.render();
    });
  }

  private createTab(parent: Node, tab: WorkshopTab, caption: string, x: number): void {
    const node = button(parent, `GeneratorTab_${tab}`, caption, x, 0, 276, 64, () => {
      this.tab = tab;
      this.render();
    }, true, 24);
    this.paintTab(node, tab === this.tab);
  }

  private paintTab(node: Node, active: boolean): void {
    paintRoundRect(node.getComponent(Graphics)!, 276, 64, 18,
      active ? hexColor('#EBC2B5') : hexColor('#F5ECE5'),
      active ? hexColor('#CB9689') : hexColor('#E6D8CE'), active ? 2 : 1);
    const text = node.children[0]?.getComponent(Label);
    if (text) text.color = active ? hexColor('#68433D') : hexColor('#8C7168');
  }

  render(): void {
    if (!this.root.active) return;
    const generators = this.game.bundle.generators;
    const current = generators.find((item) => item.id === this.selectedId) ?? generators[0];
    if (!current) return;
    this.selectedId = current.id;
    for (const choice of this.selectorStrip.children) {
      const selected = choice.name === `GeneratorSelect_${current.id}`;
      paintRoundRect(choice.getComponent(Graphics)!, 116, 124, 18,
        selected ? hexColor('#FCE9E4') : hexColor('#FFFDF9'),
        selected ? CocosTheme.primary() : hexColor('#EADBD2'), selected ? 3 : 1);
    }
    const tabs = this.card.getChildByName('GeneratorWorkshopTabs');
    if (tabs) for (const node of tabs.children) this.paintTab(node, node.name === `GeneratorTab_${this.tab}`);

    const status = this.game.getGeneratorStatus(current.id);
    if (!status) return;
    this.renderSummary(current, status);
    this.renderTabContent(current, status);
  }

  private renderSummary(generator: GeneratorDefinition, status: GeneratorStatus): void {
    for (const child of [...this.summary.children]) child.destroy();
    label(this.summary, 'GeneratorWorkshopName', generator.displayName, 0, 100, 580, 38, 28, true);
    const resource = generator.recharge && status.charges !== null
      ? `免体力采摘 · 充能 ${status.charges}/${status.maxCharges ?? generator.recharge.capacity}`
      : `每次消耗 ${status.energyCost} 体力`;
    label(this.summary, 'GeneratorWorkshopLevel', status.unlocked ? `当前 Lv${status.level}　${resource}` : `达到 Lv${generator.unlockLevel} 解锁`, 0, 64, 600, 32, 22, true);
    const totalInventory = status.inventory.reduce((sum, count) => sum + count, 0);
    label(this.summary, 'GeneratorWorkshopInventory', `已拥有 ${totalInventory} 台　·　各等级数量见“升级”`, 0, 30, 600, 30, 20, true);

    const remaining = generator.recharge ? status.nextRecoveryMs ?? 0 : status.remainingCooldownMs;
    const ratio = status.cooldownMs > 0 ? Math.max(0, Math.min(1, 1 - remaining / status.cooldownMs)) : 1;
    const track = createUiNode('GeneratorCooldownTrack');
    this.summary.addChild(track);
    ensureTransform(track, 500, 18);
    track.setPosition(0, -7, 0);
    paintRoundRect(track.addComponent(Graphics), 500, 18, 9, hexColor('#E9DED7'), hexColor('#D9C8BE'));
    const fill = createUiNode('GeneratorCooldownProgress');
    track.addChild(fill);
    const fillWidth = Math.max(2, this.cooldownBarWidth * ratio);
    ensureTransform(fill, fillWidth, 14);
    fill.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
    fill.setPosition(-248 + fillWidth / 2, 0, 0);
    paintRoundRect(fill.addComponent(Graphics), fillWidth, 14, 7, hexColor('#E5A995'));
    this.cooldownFill = fill;
    this.cooldownLabel = label(this.summary, 'GeneratorCooldownLabel', this.cooldownText(generator, status), 0, -35, 590, 28, 20, true);

    const purchaseQuote = this.game.getGeneratorPurchaseQuote(generator.id);
    const restoreQuote = this.game.getGeneratorRestoreQuote(generator.id);
    if (purchaseQuote.ok) {
      const bothActions = restoreQuote.ok;
      button(this.summary, 'GeneratorPurchaseButton', `购买Lv1生成器 · ${purchaseQuote.cost}金币`, bothActions ? -135 : 0, -74,
        bothActions ? 340 : 530, 64,
        () => {
          const result = this.game.purchaseGenerator(generator.id);
          this.feedback(result.ok ? `已购入${generator.displayName}，获得Lv1生成器` : result.reason === 'NOT_ENOUGH_COINS' ? `金币不足，需要 ${purchaseQuote.cost} 金币` : '暂时无法购买生成器', result.ok);
          this.render();
        }, status.unlocked && this.game.player.coins >= purchaseQuote.cost, 21);
    }
    if (restoreQuote.ok) {
      const caption = restoreQuote.kind === 'charges'
        ? `钻石恢复 ${restoreQuote.cost} · +${restoreQuote.restoredUses}次`
        : `钻石清冷却 ${restoreQuote.cost}`;
      button(this.summary, 'GeneratorRestoreButton', caption, purchaseQuote.ok ? 178 : 0, -74, purchaseQuote.ok ? 230 : 530, 64,
        () => this.onRestore?.(generator.id), !!this.onRestore && this.game.player.diamonds >= restoreQuote.cost, 20);
    }
  }

  private cooldownText(generator: GeneratorDefinition, status: GeneratorStatus): string {
    if (generator.recharge) {
      const remaining = status.nextRecoveryMs ?? 0;
      const interval = status.cooldownMs || generator.recharge.intervalMs;
      if ((status.charges ?? 0) >= (status.maxCharges ?? generator.recharge.capacity)) return `自然恢复 · 每 ${countdown(interval)} 补充1次`;
      return remaining > 0 ? `自然恢复下一次 · ${countdown(remaining)}` : '橘树正在恢复';
    }
    return status.remainingCooldownMs > 0
      ? `连续生成冷却 ${countdown(status.remainingCooldownMs)}　${status.streak}/${status.streakLimit}`
      : `生成次数 ${status.streak}/${status.streakLimit}　满 ${status.streakLimit} 次后短暂休息`;
  }

  private renderTabContent(generator: GeneratorDefinition, status: GeneratorStatus): void {
    for (const child of [...this.content.children]) child.destroy();
    if (this.tab === 'upgrade') this.renderUpgradeTab(generator, status);
    else this.renderOutputTab(generator, status);
    const contentHeight = Math.max(this.viewportHeight, this.tab === 'upgrade' ? this.upgradeContentHeight(generator, status) : 600);
    ensureTransform(this.content, 620, contentHeight, 0.5, 1);
    this.content.setPosition(0, contentHeight / 2, 0);
    this.scroll.scrollToTop(0);
  }

  private renderUpgradeTab(generator: GeneratorDefinition, status: GeneratorStatus): void {
    label(this.content, 'GeneratorProgressHeading', '八阶成长 · 每级生成器数量', 0, -25, 590, 34, 24, true);
    for (let level = 1; level <= status.maxLevel; level += 1) {
      const column = (level - 1) % 4;
      const row = Math.floor((level - 1) / 4);
      const x = -231 + column * 154;
      const y = -81 - row * 88;
      const count = status.inventory[level - 1] ?? 0;
      const activeLevel = status.unlocked && level === status.level;
      const mergeable = level < status.maxLevel && count >= 2;
      const tile = createUiNode(`GeneratorLevel_${level}`);
      this.content.addChild(tile);
      ensureTransform(tile, 142, 76);
      tile.setPosition(x, y, 0);
      paintRoundRect(tile.addComponent(Graphics), 138, 72, 14,
        mergeable ? hexColor('#FBE6DF') : activeLevel ? hexColor('#F3EEE4') : hexColor('#FFFFFF'),
        mergeable ? hexColor('#D9858C') : activeLevel ? hexColor('#C8A77C') : hexColor('#E8DCD3'), mergeable || activeLevel ? 2 : 1);
      label(tile, `GeneratorLevelLabel_${level}`, `Lv${level}${activeLevel ? ' · 当前' : ''}`, 0, 14, 132, 26, 20, true);
      label(tile, `GeneratorLevelCount_${level}`, `持有 ${count}`, 0, -15, 132, 25, 18, true);
    }
    label(this.content, 'GeneratorMergeListHeading', '可合并升级', 0, -234, 580, 34, 24, true);
    const eligibleLevels = Array.from({ length: Math.max(0, status.maxLevel - 1) }, (_, index) => index + 1)
      .filter((level) => (status.inventory[level - 1] ?? 0) >= 2);
    if (!status.unlocked) {
      label(this.content, 'GeneratorUpgradeLocked', `达到 Lv${generator.unlockLevel} 后管理生成器`, 0, -288, 580, 54, 22);
    } else if (!eligibleLevels.length) {
      label(this.content, 'GeneratorUpgradeNone', '暂无可合并等级', 0, -286, 580, 38, 22, true);
      label(this.content, 'GeneratorUpgradeHint', '购入或获得两台同级生成器后即可合并', 0, -326, 590, 36, 19);
    } else {
      eligibleLevels.forEach((level, index) => {
        const y = -288 - index * 82;
        const count = status.inventory[level - 1] ?? 0;
        const merge = button(this.content, `GeneratorMergeButton_${level}`, `合并 Lv${level} ×2 → Lv${level + 1}　现有 ${count} 台`, 0, y, 570, 68,
          () => {
            const result = this.game.mergeGenerators(generator.id, level);
            this.feedback(result.ok ? `生成器已升级至 Lv${result.level}` : result.reason === 'NOT_ENOUGH_GENERATORS' ? '还需要两台同等级生成器' : result.reason === 'LOCKED' ? '生成器尚未解锁' : '已达到最高等级', result.ok);
            this.render();
          }, status.unlocked && count >= 2, 22);
        merge.name = `GeneratorMergeButton_${level}`;
      });
    }
  }

  private upgradeContentHeight(generator: GeneratorDefinition, status: GeneratorStatus): number {
    const eligible = status.unlocked ? status.inventory.slice(0, Math.max(0, status.maxLevel - 1)).filter((count) => count >= 2).length : 0;
    return Math.max(520, 310 + eligible * 82);
  }

  private renderOutputTab(generator: GeneratorDefinition, status: GeneratorStatus): void {
    label(this.content, 'GeneratorOutputHeading', '主产出 · 当前等级', 0, -25, 580, 34, 24, true);
    if (!status.unlocked) {
      label(this.content, 'GeneratorOutputLocked', `达到 Lv${generator.unlockLevel} 后解锁产出`, 0, -92, 570, 42, 22);
    } else {
      const levelConfig = generator.upgrade?.levels.find((entry) => entry.level === status.level);
      const baseOutputs = levelConfig?.outputs ?? generator.outputs;
      label(this.content, `GeneratorBaseOutput`, `Lv${status.level} 普通生成 · ${generator.recharge ? '免体力' : `${status.energyCost} 体力`}`, 0, -76, 590, 32, 22, true);
      this.renderProbabilityCards('GeneratorBaseChance', baseOutputs, -145);

      const boostLevel = Math.max(2, status.level);
      const boostConfig = generator.upgrade?.levels.find((entry) => entry.level === boostLevel);
      const boostOutputs = boostConfig?.boostOutputs;
      const boostCost = status.boostEnergyCost ?? (boostOutputs ? status.energyCost * (generator.upgrade?.boostEnergyMultiplier ?? 2) : null);
      if (boostOutputs && boostCost !== null) {
        const heading = status.boostAvailable ? `Lv${status.level} 强化生成 · ${boostCost} 体力` : `Lv${boostLevel} 强化预览 · ${boostCost} 体力`;
        label(this.content, 'GeneratorBoostOutput', heading, 0, -270, 590, 32, 22, true);
        this.renderProbabilityCards('GeneratorBoostChance', boostOutputs, -340);
        const boostCaption = status.boostAvailable ? `强化生成 · 消耗 ${boostCost} 体力` : `强化生成需提升至 Lv${boostLevel}`;
        button(this.content, 'GeneratorBoostButton', boostCaption, 0, -430, 470, 68,
          () => this.onBoost(generator.id), status.boostAvailable && boostCost !== null, 24);
      } else if (generator.recharge) {
        label(this.content, 'GeneratorBoostOutput', '阳光橘树不消耗体力 · 充能满后继续采摘', 0, -283, 590, 42, 21, true);
        label(this.content, 'GeneratorBoostHint', `自然恢复容量 ${status.maxCharges ?? generator.recharge.capacity} 次 · 每次 ${countdown(status.cooldownMs || generator.recharge.intervalMs)}`, 0, -330, 590, 34, 19);
      } else {
        label(this.content, 'GeneratorBoostOutput', '强化产出尚未开放', 0, -283, 590, 42, 21, true);
      }
    }
  }

  private renderProbabilityCards(prefix: string, outputs: readonly GeneratorOutput[], y: number): void {
    const totalWeight = outputs.reduce((sum, output) => sum + output.weight, 0);
    if (totalWeight <= 0) {
      label(this.content, `${prefix}_Empty`, '暂无产出配置', 0, y, 560, 68, 22);
      return;
    }
    const width = outputs.length === 1 ? 300 : outputs.length === 2 ? 264 : 188;
    const gap = 12;
    const totalWidth = outputs.length * width + (outputs.length - 1) * gap;
    outputs.forEach((output, index) => {
      const x = -totalWidth / 2 + width / 2 + index * (width + gap);
      const card = createUiNode(`${prefix}_${output.itemId}`);
      this.content.addChild(card);
      ensureTransform(card, width, 104);
      card.setPosition(x, y, 0);
      paintRoundRect(card.addComponent(Graphics), width, 100, 18, hexColor('#FFFFFF'), hexColor('#E9D7CD'), 1);
      const known = this.game.isItemDiscovered(output.itemId);
      if (known) {
        const icon = createUiNode(`${output.itemId}_Icon`);
        card.addChild(icon);
        icon.setPosition(-width * 0.29, 0, 0);
        const art = itemArt(output.itemId);
        if (art) applyArt(icon, { ...art, preserveAspect: true }, 68, 68);
      }
      const name = known ? this.game.bundle.catalog.get(output.itemId)?.displayName ?? '未知物品' : '未发现';
      const textX = known ? width * 0.13 : 0;
      const textWidth = known ? width * 0.62 : width - 16;
      label(card, `${output.itemId}_Name`, name, textX, 19, textWidth, 30, 20, true);
      label(card, `${output.itemId}_Percent`, `${(output.weight / totalWeight * 100).toFixed(output.weight % totalWeight === 0 ? 0 : 1)}%`, textX, -20, textWidth, 34, 26, true);
    });
  }

  refreshClock(): void {
    if (!this.root.active || !this.cooldownLabel || !this.cooldownFill) return;
    const generator = this.game.bundle.generators.find((item) => item.id === this.selectedId);
    const status = this.game.getGeneratorStatus(this.selectedId);
    if (!generator || !status) return;
    const remaining = generator.recharge ? status.nextRecoveryMs ?? 0 : status.remainingCooldownMs;
    const ratio = status.cooldownMs > 0 ? Math.max(0, Math.min(1, 1 - remaining / status.cooldownMs)) : 1;
    const width = Math.max(2, this.cooldownBarWidth * ratio);
    ensureTransform(this.cooldownFill, width, 14);
    this.cooldownFill.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
    this.cooldownFill.setPosition(-248 + width / 2, 0, 0);
    paintRoundRect(this.cooldownFill.getComponent(Graphics)!, width, 14, 7, hexColor('#E5A995'));
    this.cooldownLabel.string = this.cooldownText(generator, status);
  }
}
