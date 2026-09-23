import { Button, Graphics, Label, Node, UIOpacity } from 'cc';
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

function button(parent: Node, text: string, x: number, y: number, width: number, height: number, onTap: () => void, tone: 'pink' | 'cream' | 'sage' = 'cream'): Node {
  const node = createUiNode(`Button_${text}`);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  const g = node.addComponent(Graphics);
  const fill = tone === 'pink' ? CocosTheme.primary() : tone === 'sage' ? CocosTheme.secondary() : CocosTheme.surface();
  paintRoundRect(g, width, height, Math.min(22, height / 2), fill, CocosTheme.border(), 1);
  label(node, text, 0, 0, Math.min(20, height * 0.42), width - 8, tone === 'pink' ? CocosTheme.surface() : CocosTheme.textPrimary(), true);
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
    roots.canvas.addChild(this.pageRoot);
    ensureTransform(this.pageRoot, 710, 1000);
    this.pageRoot.setPosition(0, -70, 0);
    this.pageRoot.active = false;

    this.navRoot = createUiNode('Navigation');
    roots.canvas.addChild(this.navRoot);
    ensureTransform(this.navRoot, 720, 82);
    this.navRoot.setPosition(0, -roots.designHeight / 2 + 62, 0);

    this.taskRoot = createUiNode('Wishes');
    roots.modalLayer.addChild(this.taskRoot);
    ensureTransform(this.taskRoot, 710, 980);
    this.taskRoot.active = false;

    for (const [i, entry] of (['任务', '合成', '回忆', '家园'] as const).entries()) {
      const x = -270 + i * 180;
      button(this.navRoot, entry, x, 0, 162, 70, () => {
        if (entry === '任务') this.showTasks();
        else this.setPage(entry === '合成' ? 'merge' : entry === '回忆' ? 'memories' : 'home');
      }, entry === '合成' ? 'pink' : 'cream');
    }

  }

  setPage(page: Page): void {
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
    if (this.page === 'merge') return;
    clear(this.pageRoot);
    if (this.page === 'memories') this.renderMemories();
    else this.renderHome();
    if (this.taskRoot.active) this.renderTasks();
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
      label(card, unlocked ? memory.diary : '解锁这段回忆后，日记会在这里展开。', 0, 40, 24, 540, CocosTheme.textPrimary());
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
    applyArt(picture, { sheet: index < 5 ? 'memory_sheet_a' : 'memory_sheet_b', index: index % 5, columns: 5 }, 280, 266);
    if (!unlocked) {
      const opacity = picture.addComponent(UIOpacity);
      opacity.opacity = 170;
    }
    label(card, `${String(index + 1).padStart(2, '0')}  ${memory.title}`, 150, 86, 26, 325, hexColor('#8B5358'), true);
    label(card, memory.summary, 150, 20, 17, 310, CocosTheme.textSecondary());
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
    const wishes = this.game.life.state.claimedWishIds.length;
    const decor = this.game.life.getDecorPoints();
    const note = createUiNode('HomeWishNote');
    this.pageRoot.addChild(note);
    ensureTransform(note, 286, 132);
    note.setPosition(-192, 393, 0);
    paintRoundRect(note.addComponent(Graphics), 286, 132, 20, hexColor('#FFF4F1', 240), hexColor('#E9BEB6'), 2);
    label(note, '⌂  小屋心愿', 0, 36, 26, 250, hexColor('#8B5358'), true);
    label(note, `已完成 ${wishes}/10  ·  装修 ${decor}/50`, 0, -16, 18, 260, CocosTheme.textPrimary());
    button(note, '查看心愿 ›', 0, -46, 170, 34, () => this.showTasks(), 'pink');

    const scene = createUiNode('HomeFurnitureScene');
    this.pageRoot.addChild(scene);
    ensureTransform(scene, 670, 530);
    scene.setPosition(0, 82, 0);
    const placed = this.game.bundle.furniture
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.room === this.homeRoom && this.game.life.state.placedFurnitureIds.includes(item.id))
      .sort((a, b) => b.item.placement.y - a.item.placement.y);
    for (const { item, index } of placed) {
      const { x, y, width, height } = item.placement;
      if (y < -50) {
        const shadow = createUiNode(`Shadow_${item.id}`);
        scene.addChild(shadow);
        shadow.setPosition(x, y - height * 0.39, 0);
        paintRoundRect(shadow.addComponent(Graphics), width * 0.72, 18, 9, hexColor('#725545', 40));
      }
      const sprite = createUiNode(`Placed_${item.id}`);
      scene.addChild(sprite);
      sprite.setPosition(x, y, 0);
      applyArt(sprite, { sheet: 'furniture_sheet', index, columns: 5, rows: 2 }, width, height);
    }
    if (placed.length === 0) {
      const hint = createUiNode('EmptyRoomHint');
      scene.addChild(hint);
      ensureTransform(hint, 360, 58);
      hint.setPosition(0, -177, 0);
      paintRoundRect(hint.addComponent(Graphics), 360, 58, 29, hexColor('#FFF8F3', 230));
      label(hint, '从下方选择家具，装点小屋 ♥', 0, 0, 18, 342, hexColor('#8B5358'));
    }

    const rooms: Array<[HomeRoom, string]> = [['living', '客厅'], ['bedroom', '卧室'], ['garden', '花园']];
    rooms.forEach(([room, title], index) => button(this.pageRoot, title, -118 + index * 118, 272, 105, 44, () => {
      this.homeRoom = room;
      this.render();
    }, this.homeRoom === room ? 'pink' : 'cream'));
    button(this.pageRoot, '拍照', 295, 28, 86, 54, this.takePhoto, 'pink');
    button(this.pageRoot, '拜访', 295, -42, 86, 54, () => this.toast('目前是单机小屋，拜访功能将来开放'), 'cream');
    button(this.pageRoot, '换装', 295, -112, 86, 54, () => this.toast('下方家具可购买、摆放或收起'), 'cream');

    const catalog = createUiNode('FurnitureCatalogPanel');
    this.pageRoot.addChild(catalog);
    ensureTransform(catalog, 704, 334);
    catalog.setPosition(0, -315, 0);
    paintRoundRect(catalog.addComponent(Graphics), 704, 334, 28, hexColor('#FFF8F2', 246), hexColor('#FFFFFF'), 2);
    label(this.pageRoot, '⌂  装扮我们的小屋', -206, -164, 22, 275, hexColor('#8B5358'), true);
    label(this.pageRoot, `${decor}/50`, 272, -164, 18, 92, CocosTheme.textSecondary(), true);
    const track = createUiNode('DecorProgressTrack');
    this.pageRoot.addChild(track);
    track.setPosition(0, -191, 0);
    paintRoundRect(track.addComponent(Graphics), 650, 13, 6, hexColor('#EEDBD4'));
    if (decor > 0) {
      const fill = createUiNode('DecorProgressFill');
      track.addChild(fill);
      const fillWidth = Math.max(13, 650 * Math.min(1, decor / 50));
      fill.setPosition(-325 + fillWidth / 2, 0, 0);
      paintRoundRect(fill.addComponent(Graphics), fillWidth, 13, 6, hexColor('#E98D9E'));
    }

    const categories = ['全部', '客厅', '卧室', '花园', '装饰', '特殊'];
    categories.forEach((name, index) => button(this.pageRoot, name, -275 + index * 110, -235, 104, 44, () => {
      this.category = name;
      if (name === '卧室') this.homeRoom = 'bedroom';
      else if (name === '花园') this.homeRoom = 'garden';
      else if (name !== '全部') this.homeRoom = 'living';
      this.furniturePage = 0;
      this.render();
    }, this.category === name ? 'pink' : 'cream'));

    const filtered = this.game.bundle.furniture.filter((item) => this.category === '全部' || item.category === this.category);
    const pages = Math.max(1, Math.ceil(filtered.length / 5));
    this.furniturePage = Math.min(this.furniturePage, pages - 1);
    filtered.slice(this.furniturePage * 5, this.furniturePage * 5 + 5).forEach((item, offset) => {
      const index = this.game.bundle.furniture.findIndex((entry) => entry.id === item.id);
      this.furnitureCard(item, index, -264 + offset * 132);
    });
    this.pager(pages, () => this.furniturePage, (page) => { this.furniturePage = page; this.render(); });
  }

  private syncHomeBackdrop(): void {
    for (const room of ['living', 'bedroom', 'garden'] as const) {
      this.homeBackdrops[room].active = this.page === 'home' && this.homeRoom === room;
    }
  }

  private furnitureCard(item: FurnitureDefinition, index: number, x: number): void {
    const owned = this.game.life.state.ownedFurnitureIds.includes(item.id);
    const placed = this.game.life.state.placedFurnitureIds.includes(item.id);
    const locked = this.game.player.level < item.unlockLevel;
    const card = createUiNode(`Furniture_${item.id}`);
    this.pageRoot.addChild(card);
    ensureTransform(card, 124, 174);
    card.setPosition(x, -353, 0);
    paintRoundRect(card.addComponent(Graphics), 124, 174, 18, CocosTheme.surface(), CocosTheme.border());
    const icon = createUiNode('FurnitureArt');
    card.addChild(icon);
    icon.setPosition(0, 34, 0);
    applyArt(icon, { sheet: 'furniture_sheet', index, columns: 5, rows: 2 }, 116, 112);
    label(card, item.title, 0, -34, 16, 118, CocosTheme.textPrimary(), true);
    const action = locked ? `Lv${item.unlockLevel}` : owned ? placed ? '收起' : '摆放' : `金${item.coinCost}`;
    button(card, action, 0, -66, 104, 34, () => {
      if (locked) { this.toast(`达到 Lv${item.unlockLevel} 后解锁`); return; }
      const result = owned ? this.game.placeFurniture(item.id) : this.game.buyFurniture(item.id);
      if (result.ok) this.homeRoom = item.room;
      this.toast(result.ok ? owned ? placed ? '家具已收起' : '家具已摆放' : '新家具已摆放 ♥' : '金币不足，完成订单和心愿可获得');
      this.render();
    }, owned && placed ? 'sage' : 'pink');
  }

  private pager(pages: number, current: () => number, set: (page: number) => void): void {
    if (pages <= 1) return;
    button(this.pageRoot, '‹', -90, -461, 58, 45, () => set((current() - 1 + pages) % pages), 'cream');
    label(this.pageRoot, `${current() + 1} / ${pages}`, 0, -461, 18, 90, CocosTheme.textSecondary());
    button(this.pageRoot, '›', 90, -461, 58, 45, () => set((current() + 1) % pages), 'cream');
  }

  showTasks(): void {
    this.taskRoot.active = true;
    this.renderTasks();
  }

  private renderTasks(): void {
    clear(this.taskRoot);
    paintRoundRect(this.taskRoot.getComponent(Graphics) ?? this.taskRoot.addComponent(Graphics), 690, 970, 30, CocosTheme.surface(), CocosTheme.border(), 2);
    label(this.taskRoot, `小屋心愿  ${this.game.life.state.claimedWishIds.length}/10`, 0, 408, 32, 600, hexColor('#8B5358'), true);
    button(this.taskRoot, '关闭', 268, 412, 92, 48, () => { this.taskRoot.active = false; }, 'cream');
    const wishes = this.game.bundle.wishes.slice(this.wishPage * 5, this.wishPage * 5 + 5);
    wishes.forEach((wish, index) => this.wishCard(wish, 282 - index * 141));
    button(this.taskRoot, '上一页', -120, -411, 145, 48, () => { this.wishPage = 1 - this.wishPage; this.renderTasks(); });
    button(this.taskRoot, '下一页', 120, -411, 145, 48, () => { this.wishPage = 1 - this.wishPage; this.renderTasks(); });
  }

  private wishCard(wish: WishDefinition, y: number): void {
    const progress = Math.min(wish.target, this.game.life.getWishProgress(wish));
    const claimed = this.game.life.state.claimedWishIds.includes(wish.id);
    const card = createUiNode(`Wish_${wish.id}`);
    this.taskRoot.addChild(card);
    ensureTransform(card, 630, 120);
    card.setPosition(0, y, 0);
    paintRoundRect(card.addComponent(Graphics), 630, 120, 18, hexColor('#FFF6F2'), CocosTheme.border());
    label(card, wish.title, -130, 23, 22, 300, CocosTheme.textPrimary(), true);
    label(card, `${progress}/${wish.target}   金币+${wish.rewardCoins}  爱心+${wish.rewardHearts}`, -100, -23, 16, 370, CocosTheme.textSecondary());
    button(card, claimed ? '已领取' : progress >= wish.target ? '领取' : '进行中', 220, 0, 125, 53, () => {
      const result = this.game.claimWish(wish.id);
      this.toast(result.ok ? '心愿完成，奖励已领取 ♥' : claimed ? '已经领取过了' : '还需要再完成一些进度');
      this.renderTasks();
    }, progress >= wish.target && !claimed ? 'pink' : 'cream');
  }
}
