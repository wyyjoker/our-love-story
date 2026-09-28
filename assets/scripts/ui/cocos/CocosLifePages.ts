import { BlockInputEvents, Button, Graphics, Label, Node, UIOpacity } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { FurnitureDefinition, MemoryDefinition, WishDefinition } from '../../core/types';
import type { UiRoots } from './UiFactory';
import { applyArt, applyLocalPhoto } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import { sizeOf } from './UiFactory';

type Page = 'merge' | 'memories' | 'home';
type MemoryTab = 'album' | 'diary' | 'photos';
type HomeRoom = FurnitureDefinition['room'];

function label(parent: Node, text: string, x: number, y: number, size = 20, width = 620, color = CocosTheme.textPrimary(), bold = false): Label {
  const result = makeLabel(text, size, color, bold);
  parent.addChild(result.node);
  ensureTransform(result.node, width, size + 20);
  result.overflow = Label.Overflow.SHRINK;
  result.node.setPosition(x, y, 0);
  return result;
}

function paragraph(parent: Node, text: string, x: number, y: number, size: number, width: number, height: number, color = CocosTheme.textPrimary()): Label {
  const result = makeLabel(text, size, color);
  parent.addChild(result.node);
  ensureTransform(result.node, width, height);
  result.overflow = Label.Overflow.CLAMP;
  result.enableWrapText = true;
  result.lineHeight = size + 10;
  result.horizontalAlign = Label.HorizontalAlign.LEFT;
  result.node.setPosition(x, y, 0);
  return result;
}

function button(parent: Node, text: string, x: number, y: number, width: number, height: number, onTap: () => void, tone: 'pink' | 'cream' | 'sage' = 'cream'): Node {
  const node = createUiNode(`Button_${text}`);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  const g = node.addComponent(Graphics);
  const fill = tone === 'pink' ? CocosTheme.primary() : tone === 'sage' ? CocosTheme.secondary() : CocosTheme.surface();
  paintRoundRect(g, width, height, Math.min(22, height / 2), fill, CocosTheme.border(), 1);
  label(node, text, 0, 0, Math.min(26, Math.max(23, height * 0.48)), width - 12, tone === 'pink' ? CocosTheme.surface() : CocosTheme.textPrimary(), true);
  node.addComponent(Button);
  node.on(Button.EventType.CLICK, onTap);
  return node;
}

function clear(node: Node): void {
  for (const child of [...node.children]) child.destroy();
}

export class CocosLifePages {
  private page: Page = 'merge';
  private memoryTab: MemoryTab = 'album';
  private memoryPage = 0;
  private furniturePage = 0;
  private category = '全部';
  private homeRoom: HomeRoom = 'living';
  private wishPage = 0;
  private readonly homeBackdrops: Record<HomeRoom, Node>;
  private readonly pageRoot: Node;
  private readonly navRoot: Node;
  private readonly taskRoot: Node;
  private readonly catalogRoot: Node;

  constructor(
    private readonly game: GameContext,
    private readonly roots: UiRoots,
    private readonly toast: (message: string) => void,
    private readonly takePhoto: () => void,
    private readonly onPageChanged: () => void,
  ) {
    const backdropSize = sizeOf(roots.background, roots.designWidth, roots.designHeight);
    this.homeBackdrops = {
      living: createUiNode('HomeBackdropLiving'),
      bedroom: createUiNode('HomeBackdropBedroom'),
      garden: createUiNode('HomeBackdropGarden'),
    };
    const roomArt: Record<HomeRoom, string> = {
      living: 'home_background_empty',
      bedroom: 'home_bedroom',
      garden: 'home_garden',
    };
    for (const room of ['living', 'bedroom', 'garden'] as const) {
      const backdrop = this.homeBackdrops[room];
      roots.background.addChild(backdrop);
      applyArt(backdrop, { sheet: roomArt[room] }, backdropSize.width, backdropSize.height);
      backdrop.active = false;
    }

    this.pageRoot = createUiNode('LifePage');
    roots.contentLayer.addChild(this.pageRoot);
    ensureTransform(this.pageRoot, 710, 1000);
    this.pageRoot.setPosition(0, -70, 0);
    this.pageRoot.active = false;

    this.navRoot = createUiNode('Navigation');
    roots.navLayer.addChild(this.navRoot);
    ensureTransform(this.navRoot, 720, 82);
    this.navRoot.setPosition(0, -roots.designHeight / 2 + 55, 0);

    this.taskRoot = createUiNode('Wishes');
    roots.modalLayer.addChild(this.taskRoot);
    ensureTransform(this.taskRoot, roots.designWidth, roots.designHeight);
    this.taskRoot.addComponent(BlockInputEvents);
    this.taskRoot.active = false;

    this.catalogRoot = createUiNode('FurnitureCatalog');
    roots.modalLayer.addChild(this.catalogRoot);
    ensureTransform(this.catalogRoot, roots.designWidth, roots.designHeight);
    this.catalogRoot.addComponent(BlockInputEvents);
    this.catalogRoot.active = false;

    this.renderNav();
  }

  setPage(page: Page): void {
    this.taskRoot.active = false;
    this.catalogRoot.active = false;
    this.page = page;
    const merge = page === 'merge';
    this.syncHomeBackdrop();
    this.roots.ordersSlot.active = merge;
    this.roots.boardSlot.active = merge;
    this.roots.dockSlot.active = merge;
    this.pageRoot.active = !merge;
    this.render();
    this.onPageChanged();
  }

  get currentPage(): Page {
    return this.page;
  }

  render(): void {
    this.renderNav();
    if (this.page !== 'merge') {
      clear(this.pageRoot);
      if (this.page === 'memories') this.renderMemories();
      else this.renderHome();
    }
    if (this.taskRoot.active) this.renderTasks();
    if (this.catalogRoot.active) this.renderCatalog();
  }

  private renderNav(): void {
    clear(this.navRoot);
    const entries: Array<[string, Page | null]> = [['任务', null], ['合成', 'merge'], ['回忆', 'memories'], ['家园', 'home']];
    entries.forEach(([title, page], index) => {
      button(this.navRoot, title, -270 + index * 180, 0, 162, 66, () => {
        if (page === null) this.showTasks();
        else this.setPage(page);
      }, page === this.page && !this.taskRoot.active ? 'pink' : 'cream');
    });
  }

  private renderMemories(): void {
    label(this.pageRoot, '回忆相册  ♡  Story Memories', 0, 465, 34, 680, hexColor('#8B5358'), true);
    label(this.pageRoot, `已解锁回忆 ${this.game.life.state.unlockedMemoryIds.length}/10`, 0, 412, 21, 650, CocosTheme.textSecondary());
    const tabs: Array<[MemoryTab, string]> = [['album', '回忆相册'], ['diary', '心动日记'], ['photos', '拍照留念']];
    tabs.forEach(([id, name], index) => button(this.pageRoot, name, -220 + index * 220, 357, 202, 54, () => {
      this.memoryTab = id;
      this.memoryPage = 0;
      this.render();
    }, this.memoryTab === id ? 'pink' : 'cream'));

    if (this.memoryTab === 'photos') {
      this.renderPhotos();
      return;
    }
    if (this.memoryTab === 'diary') {
      const memory = this.game.bundle.memories[Math.min(this.memoryPage, 9)];
      const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
      const card = createUiNode('DiaryCard');
      this.pageRoot.addChild(card);
      ensureTransform(card, 660, 600);
      card.setPosition(0, -5, 0);
      paintRoundRect(card.addComponent(Graphics), 660, 600, 24, CocosTheme.surface(), CocosTheme.border(), 2);
      label(card, memory.title, 0, 220, 30, 610, hexColor('#8B5358'), true);
      const illustration = createUiNode('DiaryIllustration');
      card.addChild(illustration);
      illustration.setPosition(0, 47, 0);
      const [sheet, cell] = memory.art.split('#');
      applyArt(illustration, cell === undefined ? { sheet } : { sheet, index: Number(cell), columns: 5 }, 500, 250);
      if (!unlocked) illustration.addComponent(UIOpacity).opacity = 150;
      paragraph(card, unlocked ? memory.diary : '解锁这段回忆后，日记会在这里展开。', 0, -145, 25, 540, 150);
      label(card, `第 ${this.memoryPage + 1} / 10 页`, 0, -240, 18, 300, CocosTheme.textSecondary());
      this.pager(10, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
      return;
    }
    const start = this.memoryPage * 2;
    for (let offset = 0; offset < 2; offset += 1) {
      const memory = this.game.bundle.memories[start + offset];
      if (memory) this.memoryCard(memory, start + offset, 152 - offset * 318);
    }
    this.pager(5, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
  }

  private memoryCard(memory: MemoryDefinition, index: number, y: number): void {
    const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
    const prior = index === 0 || this.game.life.state.unlockedMemoryIds.includes(this.game.bundle.memories[index - 1].id);
    const card = createUiNode(`Memory_${memory.id}`);
    this.pageRoot.addChild(card);
    ensureTransform(card, 660, 294);
    card.setPosition(0, y, 0);
    paintRoundRect(card.addComponent(Graphics), 660, 294, 24, CocosTheme.surface(), CocosTheme.border(), 2);
    const picture = createUiNode('Illustration');
    card.addChild(picture);
    picture.setPosition(-176, 0, 0);
    const [sheet, cell] = memory.art.split('#');
    applyArt(picture, cell === undefined ? { sheet } : { sheet, index: Number(cell), columns: 5 }, 280, 266);
    if (!unlocked) {
      const opacity = picture.addComponent(UIOpacity);
      opacity.opacity = 170;
    }
    label(card, `${String(index + 1).padStart(2, '0')}  ${memory.title}`, 150, 86, 26, 325, hexColor('#8B5358'), true);
    paragraph(card, memory.summary, 150, 12, 21, 310, 86, CocosTheme.textSecondary());
    const caption = unlocked ? '已珍藏 ♥' : prior ? `♥ ${memory.heartCost} 解锁` : '先解锁前一段回忆';
    button(card, caption, 150, -92, 290, 48, () => {
      if (unlocked) {
        this.memoryTab = 'diary';
        this.memoryPage = index;
        this.render();
        return;
      }
      const result = this.game.unlockMemory(memory.id);
      this.toast(result.ok ? '新回忆已经珍藏 ♥' : result.reason === 'NOT_ENOUGH_HEARTS' ? '爱心还不够，先完成订单和心愿吧' : '请先解锁前一段回忆');
      this.render();
    }, unlocked ? 'sage' : 'pink');
  }

  private renderPhotos(): void {
    label(this.pageRoot, '把小屋此刻的样子，留给未来的我们。', 0, 240, 24, 630, CocosTheme.textPrimary());
    const paths = this.game.life.state.photoPaths;
    label(this.pageRoot, `本机留念 ${paths.length} 张`, 0, 160, 20, 630, CocosTheme.textSecondary());
    if (paths.length === 0) label(this.pageRoot, '前往家园，点击「拍照」留下第一张照片。', 0, 25, 20, 620, CocosTheme.textSecondary());
    const recent = paths.slice(-4);
    for (let i = 0; i < recent.length; i += 1) {
      const photo = createUiNode(`LocalPhoto_${i}`);
      this.pageRoot.addChild(photo);
      photo.setPosition(-225 + i * 150, -120, 0);
      applyLocalPhoto(photo, recent[i], 135, 230);
      label(this.pageRoot, `留念 ${paths.length - recent.length + i + 1}`, -225 + i * 150, -265, 16, 132, CocosTheme.textSecondary());
    }
    button(this.pageRoot, '去家园拍照', 0, -425, 240, 58, () => this.setPage('home'), 'pink');
  }

  private renderHome(): void {
    this.syncHomeBackdrop();
    const verticalExtra = Math.max(0, (this.roots.designHeight - 1334) * 0.3);
    const decor = this.game.life.getDecorPoints();
    const wished = this.game.life.state.claimedWishIds.length;
    const note = createUiNode('HomeWishNote');
    this.pageRoot.addChild(note);
    ensureTransform(note, 328, 146);
    note.setPosition(-174, 395 + verticalExtra, 0);
    paintRoundRect(note.addComponent(Graphics), 328, 146, 22, hexColor('#FFF8F1', 242), hexColor('#E7BDB5'), 2);
    label(note, '⌂  小屋心愿', -14, 43, 25, 282, hexColor('#8B5358'), true);
    label(note, '已完成 ' + wished + '/10  ·  装修 ' + decor + '/50', -14, 0, 20, 290, CocosTheme.textSecondary());
    button(note, '查看心愿 ›', 0, -46, 180, 38, () => this.showTasks(), 'pink');

    this.renderRoomTabs();
    const scene = createUiNode('HomeFurnitureScene');
    this.pageRoot.addChild(scene);
    ensureTransform(scene, 670, 580);
    scene.setPosition(0, 0, 0);
    const placed = this.game.bundle.furniture
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.room === this.homeRoom && this.game.life.state.placedFurnitureIds.includes(item.id))
      .sort((a, b) => b.item.placement.y - a.item.placement.y);
    for (const { item, index } of placed) {
      const { x, y, width, height } = item.placement;
      if (y < -50) {
        const shadow = createUiNode('Shadow_' + item.id);
        scene.addChild(shadow);
        shadow.setPosition(x, y - height * 0.39, 0);
        paintRoundRect(shadow.addComponent(Graphics), width * 0.72, 16, 8, hexColor('#725545', 36));
      }
      const sprite = createUiNode('Placed_' + item.id);
      scene.addChild(sprite);
      sprite.setPosition(x, y, 0);
      applyArt(sprite, { sheet: 'furniture_sheet', index, columns: 5, rows: 2 }, width, height);
    }
    if (placed.length === 0) {
      const hint = createUiNode('EmptyRoomHint');
      scene.addChild(hint);
      hint.setPosition(0, -184, 0);
      paintRoundRect(hint.addComponent(Graphics), 400, 58, 28, hexColor('#FFF8F3', 232));
      label(hint, '这里还空着，来放一件家具吧 ♥', 0, 0, 18, 380, hexColor('#8B5358'));
    }

    const actions = createUiNode('HomeActions');
    this.pageRoot.addChild(actions);
    ensureTransform(actions, 680, 58);
    actions.setPosition(0, -326 - verticalExtra * 0.58, 0);
    button(actions, '拍照留念', -218, 0, 204, 54, this.takePhoto, 'cream');
    button(actions, '拜访', 0, 0, 204, 54, () => this.toast('当前是单机小屋，拜访功能尚未开放'), 'cream');
    button(actions, '布置家具', 218, 0, 204, 54, () => this.showCatalog(), 'pink');

    const progress = createUiNode('DecorProgress');
    this.pageRoot.addChild(progress);
    ensureTransform(progress, 664, 76);
    progress.setPosition(0, -421 - verticalExtra, 0);
    paintRoundRect(progress.addComponent(Graphics), 664, 76, 22, hexColor('#FFF8F1', 244), hexColor('#FFFFFF'), 2);
    label(progress, '装扮我们的小屋', -180, 15, 23, 270, hexColor('#8B5358'), true);
    label(progress, decor + '/50', 250, 15, 18, 86, CocosTheme.textSecondary(), true);
    const track = createUiNode('DecorTrack');
    progress.addChild(track);
    track.setPosition(0, -19, 0);
    paintRoundRect(track.addComponent(Graphics), 590, 12, 6, hexColor('#EEDBD4'));
    if (decor > 0) {
      const filled = createUiNode('DecorFilled');
      track.addChild(filled);
      const fillWidth = Math.max(12, 590 * Math.min(1, decor / 50));
      filled.setPosition(-295 + fillWidth / 2, 0, 0);
      paintRoundRect(filled.addComponent(Graphics), fillWidth, 12, 6, hexColor('#E98D9E'));
    }
  }

  private renderRoomTabs(): void {
    const tabs = createUiNode('HomeRoomTabs');
    this.pageRoot.addChild(tabs);
    tabs.setPosition(0, 302 + Math.max(0, (this.roots.designHeight - 1334) * 0.17), 0);
    const rooms: Array<[HomeRoom, string]> = [['living', '客厅'], ['bedroom', '卧室'], ['garden', '花园']];
    rooms.forEach(([room, title], index) => button(tabs, title, -116 + index * 116, 0, 108, 46, () => {
      this.homeRoom = room;
      this.render();
    }, this.homeRoom === room ? 'pink' : 'cream'));
  }

  private syncHomeBackdrop(): void {
    for (const room of ['living', 'bedroom', 'garden'] as const) {
      this.homeBackdrops[room].active = this.page === 'home' && this.homeRoom === room;
    }
  }

  private pager(pages: number, current: () => number, set: (page: number) => void): void {
    if (pages <= 1) return;
    button(this.pageRoot, '‹', -90, -461, 58, 45, () => set((current() - 1 + pages) % pages), 'cream');
    label(this.pageRoot, (current() + 1) + ' / ' + pages, 0, -461, 18, 90, CocosTheme.textSecondary());
    button(this.pageRoot, '›', 90, -461, 58, 45, () => set((current() + 1) % pages), 'cream');
  }

  private modalPanel(root: Node, name: string): Node {
    clear(root);
    paintRoundRect(root.getComponent(Graphics) ?? root.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', 160));
    const panel = createUiNode(name);
    root.addChild(panel);
    ensureTransform(panel, 690, 914);
    const scale = Math.min(1, (this.roots.designHeight - 150) / 914);
    panel.setScale(scale, scale, 1);
    paintRoundRect(panel.addComponent(Graphics), 690, 914, 30, hexColor('#FFF9F3'), hexColor('#F5D7CD'), 3);
    return panel;
  }

  showTasks(): void {
    this.catalogRoot.active = false;
    this.taskRoot.active = true;
    this.renderTasks();
    this.renderNav();
  }

  private renderTasks(): void {
    const panel = this.modalPanel(this.taskRoot, 'WishesPanel');
    const claimed = this.game.life.state.claimedWishIds.length;
    label(panel, '小屋心愿  ' + claimed + '/10', -52, 392, 31, 490, hexColor('#8B5358'), true);
    label(panel, '把日常的小惊喜，一点一点装进家里', 0, 342, 22, 590, CocosTheme.textSecondary());
    button(panel, '关闭', 275, 395, 88, 46, () => {
      this.taskRoot.active = false;
      this.renderNav();
    });
    const first = this.wishPage * 4;
    this.game.bundle.wishes.slice(first, first + 4).forEach((wish, index) => {
      this.wishCard(panel, wish, 223 - index * 157);
    });
    const pages = Math.ceil(this.game.bundle.wishes.length / 4);
    button(panel, '‹', -90, -392, 60, 48, () => {
      this.wishPage = (this.wishPage - 1 + pages) % pages;
      this.renderTasks();
    });
    label(panel, (this.wishPage + 1) + ' / ' + pages, 0, -392, 20, 90, CocosTheme.textSecondary());
    button(panel, '›', 90, -392, 60, 48, () => {
      this.wishPage = (this.wishPage + 1) % pages;
      this.renderTasks();
    });
  }

  private wishCard(parent: Node, wish: WishDefinition, y: number): void {
    const progress = Math.min(wish.target, this.game.life.getWishProgress(wish));
    const claimed = this.game.life.state.claimedWishIds.includes(wish.id);
    const card = createUiNode('Wish_' + wish.id);
    parent.addChild(card);
    ensureTransform(card, 626, 132);
    card.setPosition(0, y, 0);
    paintRoundRect(card.addComponent(Graphics), 626, 132, 20, hexColor('#FFF0EA'), hexColor('#F1D9D0'));
    label(card, wish.title, -128, 35, 23, 315, CocosTheme.textPrimary(), true);
    label(card, progress + '/' + wish.target + '  ·  金币+' + wish.rewardCoins + '  爱心+' + wish.rewardHearts, -125, -17, 21, 380, CocosTheme.textSecondary());
    button(card, claimed ? '已领取' : progress >= wish.target ? '领取奖励' : '进行中', 225, 0, 130, 54, () => {
      if (claimed) { this.toast('这份心愿已经领取过了'); return; }
      if (progress < wish.target) { this.toast('还需要再完成一些进度'); return; }
      const result = this.game.claimWish(wish.id);
      this.toast(result.ok ? '心愿完成，奖励已领取 ♥' : '暂时无法领取，请稍后重试');
      this.renderTasks();
    }, progress >= wish.target && !claimed ? 'pink' : 'cream');
  }

  private showCatalog(): void {
    if (this.page !== 'home') this.setPage('home');
    this.taskRoot.active = false;
    this.catalogRoot.active = true;
    this.renderCatalog();
    this.renderNav();
  }

  private renderCatalog(): void {
    const panel = this.modalPanel(this.catalogRoot, 'FurniturePanel');
    label(panel, '布置我们的小屋', -75, 390, 31, 470, hexColor('#8B5358'), true);
    label(panel, '挑选家具，摆进喜欢的房间', 0, 345, 22, 580, CocosTheme.textSecondary());
    button(panel, '关闭', 275, 395, 88, 46, () => {
      this.catalogRoot.active = false;
      this.renderNav();
    });
    const categories = ['全部', '客厅', '卧室', '花园', '装饰', '特殊'];
    categories.forEach((name, index) => button(panel, name, -263 + index * 105, 297, 98, 44, () => {
      this.category = name;
      this.furniturePage = 0;
      this.renderCatalog();
    }, this.category === name ? 'pink' : 'cream'));
    const filtered = this.game.bundle.furniture.filter((item) => this.category === '全部' || item.category === this.category);
    const pages = Math.max(1, Math.ceil(filtered.length / 4));
    this.furniturePage = Math.min(this.furniturePage, pages - 1);
    filtered.slice(this.furniturePage * 4, this.furniturePage * 4 + 4).forEach((item, offset) => {
      const index = this.game.bundle.furniture.findIndex((entry) => entry.id === item.id);
      this.furnitureCard(panel, item, index, offset % 2 === 0 ? -157 : 157, offset < 2 ? 134 : -146);
    });
    if (filtered.length === 0) label(panel, '这里暂时没有家具', 0, 0, 23, 450, CocosTheme.textSecondary());
    if (pages > 1) {
      button(panel, '‹', -90, -392, 60, 48, () => {
        this.furniturePage = (this.furniturePage - 1 + pages) % pages;
        this.renderCatalog();
      });
      label(panel, (this.furniturePage + 1) + ' / ' + pages, 0, -392, 20, 90, CocosTheme.textSecondary());
      button(panel, '›', 90, -392, 60, 48, () => {
        this.furniturePage = (this.furniturePage + 1) % pages;
        this.renderCatalog();
      });
    } else {
      label(panel, '共 ' + filtered.length + ' 件家具', 0, -392, 20, 240, CocosTheme.textSecondary());
    }
  }

  private furnitureCard(parent: Node, item: FurnitureDefinition, index: number, x: number, y: number): void {
    const owned = this.game.life.state.ownedFurnitureIds.includes(item.id);
    const placed = this.game.life.state.placedFurnitureIds.includes(item.id);
    const locked = this.game.player.level < item.unlockLevel;
    const card = createUiNode('Furniture_' + item.id);
    parent.addChild(card);
    ensureTransform(card, 298, 246);
    card.setPosition(x, y, 0);
    paintRoundRect(card.addComponent(Graphics), 298, 246, 22, CocosTheme.surface(), CocosTheme.border(), 2);
    const icon = createUiNode('FurnitureArt');
    card.addChild(icon);
    icon.setPosition(0, 34, 0);
    applyArt(icon, { sheet: 'furniture_sheet', index, columns: 5, rows: 2 }, 176, 145);
    label(card, item.title, 0, -59, 23, 276, CocosTheme.textPrimary(), true);
    const action = locked ? 'Lv' + item.unlockLevel + ' 解锁' : owned ? placed ? '收起' : '摆放' : '金币 ' + item.coinCost;
    button(card, action, 0, -96, 200, 43, () => {
      if (locked) { this.toast('达到 Lv' + item.unlockLevel + ' 后解锁'); return; }
      const result = owned ? this.game.placeFurniture(item.id) : this.game.buyFurniture(item.id);
      if (result.ok) {
        this.homeRoom = item.room;
        this.catalogRoot.active = false;
        this.toast(owned ? placed ? '家具已收起' : '家具已摆放' : '新家具已摆放 ♥');
        this.render();
      } else {
        this.toast('金币不足，完成订单和心愿可获得');
      }
    }, owned && placed ? 'sage' : 'pink');
  }
}
