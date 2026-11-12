import { BlockInputEvents, Button, Graphics, Label, Mask, Node, ScrollView, UIOpacity } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { FurnitureDefinition, MemoryDefinition, WishDefinition } from '../../core/types';
import type { UiRoots } from './UiFactory';
import { applyArt, applyLocalPhoto, furnitureArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import { sizeOf } from './UiFactory';
import { fitPhoto, journalLayout, lifePageLayout, photoPage } from '../../presentation/UiSafety';

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

/** Measure the wrapped text once; long personal diaries scroll inside the page. */
function diaryBody(parent: Node, text: string, extra: number): boolean {
  const height = 138 + extra;
  const viewport = createUiNode('DiaryTextViewport');
  parent.addChild(viewport);
  ensureTransform(viewport, 560, height);
  viewport.setPosition(0, -189 - extra / 2, 0);
  viewport.addComponent(Mask);
  const content = createUiNode('DiaryTextContent');
  viewport.addChild(content);
  const contentTransform = ensureTransform(content, 560, height, 0.5, 1);
  content.setPosition(0, height / 2, 0);
  const body = makeLabel(text, 21, CocosTheme.textPrimary());
  body.node.name = 'DiaryText';
  content.addChild(body.node);
  const textTransform = ensureTransform(body.node, 560, height, 0.5, 1);
  body.node.setPosition(0, -4, 0);
  body.enableWrapText = true;
  body.horizontalAlign = Label.HorizontalAlign.LEFT;
  body.verticalAlign = Label.VerticalAlign.TOP;
  body.lineHeight = 31;
  body.overflow = Label.Overflow.RESIZE_HEIGHT;
  body.updateRenderData(true);
  contentTransform.setContentSize(560, Math.max(height, textTransform.height + 8));
  const scroll = viewport.addComponent(ScrollView);
  scroll.horizontal = false;
  scroll.vertical = true;
  scroll.elastic = false;
  scroll.cancelInnerEvents = true;
  scroll.content = content;
  scroll.scrollToTop(0);
  return contentTransform.height > height;
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
  for (const child of [...node.children]) {
    child.removeFromParent();
    child.destroy();
  }
}

function paper(parent: Node, name: string, x: number, y: number, width: number, height: number, fill = '#FFFDF7'): Node {
  const node = createUiNode(name);
  parent.addChild(node);
  node.setPosition(x, y, 0);
  ensureTransform(node, width, height);
  const shadow = createUiNode('PaperShadow');
  node.addChild(shadow);
  shadow.setPosition(3, -6, 0);
  paintRoundRect(shadow.addComponent(Graphics), width + 2, height + 2, 15, hexColor('#8A6550', 32));
  const surface = createUiNode('PaperSurface');
  node.addChild(surface);
  paintRoundRect(surface.addComponent(Graphics), width, height, 13, hexColor(fill), hexColor('#E9D9C8'), 2);
  return node;
}

function tape(parent: Node, x: number, y: number, angle: number): void {
  const node = createUiNode('WashiTape');
  parent.addChild(node);
  node.setPosition(x, y, 0);
  node.setRotationFromEuler(0, 0, angle);
  paintRoundRect(node.addComponent(Graphics), 78, 22, 2, hexColor('#EFDCC1', 212));
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
  private readonly photoRoot: Node;

  constructor(
    private readonly game: GameContext,
    private readonly roots: UiRoots,
    private readonly toast: (message: string) => void,
    private readonly takePhoto: () => void,
    private readonly onPageChanged: () => void,
    private readonly openAdventure?: (id?: string) => void,
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
    const pageLayout = lifePageLayout(roots.designWidth, roots.designHeight);
    this.pageRoot.setPosition(0, pageLayout.y, 0);
    this.pageRoot.setScale(pageLayout.scale, pageLayout.scale, 1);
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

    this.photoRoot = createUiNode('PhotoPreview');
    roots.modalLayer.addChild(this.photoRoot);
    ensureTransform(this.photoRoot, roots.designWidth, roots.designHeight);
    this.photoRoot.addComponent(BlockInputEvents);
    this.photoRoot.active = false;

    this.renderNav();
  }

  setPage(page: Page): void {
    this.photoRoot.active = false;
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

  openMemory(id: string): void {
    const index = this.game.bundle.memories.findIndex((m) => m.id === id);
    if (index < 0) return;
    this.memoryTab = 'diary'; this.memoryPage = index; this.setPage('memories');
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
      const selected = page === null ? this.taskRoot.active : page === this.page && !this.taskRoot.active;
      const entry = createUiNode(`Button_${title}`);
      this.navRoot.addChild(entry);
      ensureTransform(entry, 162, 82);
      entry.setPosition(-270 + index * 180, 0, 0);
      const circle = createUiNode('NavigationIcon');
      entry.addChild(circle);
      circle.setPosition(0, 10, 0);
      const caption = createUiNode('NavigationCaption');
      entry.addChild(caption);
      caption.setPosition(0, -32, 0);
      paintRoundRect(caption.addComponent(Graphics), 76, 30, 15, selected ? hexColor('#FFF1EE', 250) : hexColor('#FFF9F1', 235));
      paintRoundRect(circle.addComponent(Graphics), 65, 65, 32, selected ? hexColor('#E993A3') : hexColor('#FFF9F1', 245), selected ? hexColor('#FFF7F3') : hexColor('#DDC7B4'), 3);
      const icon = createUiNode('NavSymbol');
      circle.addChild(icon);
      const g = icon.addComponent(Graphics);
      g.lineWidth = 2.5;
      g.strokeColor = selected ? hexColor('#FFFFFF') : hexColor('#987261');
      g.fillColor = g.strokeColor;
      if (index === 0) {
        g.roundRect(-12, -15, 24, 29, 3); g.stroke();
        g.roundRect(-5, 12, 10, 5, 2); g.fill();
        for (const y of [7, 0, -7]) { g.moveTo(-8, y); g.lineTo(-5, y - 2); g.lineTo(-2, y + 2); g.moveTo(2, y); g.lineTo(8, y); } g.stroke();
      } else if (index === 1) {
        g.roundRect(-15, -7, 18, 18, 4); g.stroke();
        g.roundRect(-2, -15, 18, 18, 4); g.stroke();
        g.moveTo(1, 9); g.lineTo(10, 9); g.moveTo(6, 5); g.lineTo(6, 14); g.stroke();
      } else if (index === 2) {
        g.roundRect(-15, -14, 30, 28, 3); g.stroke();
        g.moveTo(-11, -9); g.lineTo(-3, 2); g.lineTo(3, -4); g.lineTo(7, 1); g.lineTo(12, -9); g.stroke();
        g.circle(7, 7, 3); g.fill();
      } else {
        g.moveTo(-16, 0); g.lineTo(0, 15); g.lineTo(16, 0); g.stroke();
        g.moveTo(-11, 1); g.lineTo(-11, -15); g.lineTo(11, -15); g.lineTo(11, 1); g.stroke();
        g.roundRect(-4, -15, 8, 12, 1); g.fill();
      }
      label(entry, title, 0, -32, 22, 150, selected ? hexColor('#A5485D') : hexColor('#785B4E'), true);
      entry.addComponent(Button);
      entry.on(Button.EventType.CLICK, () => {
        if (page === null) this.showTasks();
        else this.setPage(page);
      });
    });
  }

  private renderMemories(): void {
    const memories = this.game.bundle.memories;
    const total = memories.length;
    const { compact, perPage, extra } = journalLayout(this.roots.designWidth, this.roots.designHeight);
    paper(this.pageRoot, 'AlbumPaper', 0, 0, 704, 1000 + 2 * extra, '#FFF7EC');
    const banner = paper(this.pageRoot, 'AlbumTitlePaper', -145, 433 + extra, 414, 112, '#FFE6E4');
    banner.setRotationFromEuler(0, 0, 1.5);
    label(banner, '回忆相册', 18, 23, 38, 310, hexColor('#8C3F49'), true);
    label(banner, 'Story Memories', 18, -24, 22, 310, hexColor('#CD858B'));
    const flowers = createUiNode('AlbumFlowers');
    this.pageRoot.addChild(flowers);
    flowers.setPosition(-318, 430 + extra, 0);
    applyArt(flowers, { sheet: 'flower_sheet', index: 4, columns: 4, rows: 2, preserveAspect: true }, 78, 98);
    const unlocked = memories.filter((memory) => this.game.life.state.unlockedMemoryIds.includes(memory.id)).length;
    const progress = paper(this.pageRoot, 'AlbumProgress', 209, 433 + extra, 244, 100, '#FFFCF7');
    label(progress, `已珍藏 ${unlocked}/${total}`, 0, 19, 24, 222, hexColor('#8B5358'), true);
    const track = createUiNode('AlbumProgressTrack');
    progress.addChild(track);
    track.setPosition(0, -21, 0);
    paintRoundRect(track.addComponent(Graphics), 192, 13, 6, hexColor('#EEDCD3'));
    if (unlocked > 0) {
      const fill = createUiNode('AlbumProgressFill');
      track.addChild(fill);
      const width = 192 * Math.min(1, unlocked / this.game.bundle.memories.length);
      fill.setPosition(-96 + width / 2, 0, 0);
      paintRoundRect(fill.addComponent(Graphics), width, 13, 6, hexColor('#E68B9B'));
    }
    label(this.pageRoot, '这些闪闪发光的瞬间，都是我们的故事。', 0, 354 + extra, 20, 650, hexColor('#9A7163'));
    const tabs: Array<[MemoryTab, string]> = [['album', '回忆相册'], ['diary', '心动日记'], ['photos', '拍照留念']];
    tabs.forEach(([id, name], index) => button(this.pageRoot, name, -220 + index * 220, 307 + extra, 202, 50, () => {
      this.memoryTab = id;
      this.memoryPage = 0;
      this.render();
    }, this.memoryTab === id ? 'pink' : 'cream'));

    if (this.memoryTab === 'photos') {
      this.renderPhotos();
      return;
    }
    if (this.memoryTab === 'diary') {
      this.memoryPage = Math.max(0, Math.min(this.memoryPage, total - 1));
      const memory = memories[this.memoryPage];
      const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
      const card = paper(this.pageRoot, 'DiaryCard', 0, -50, 660, 650 + 2 * extra);
      tape(card, -208, 310 + extra, -9);
      label(card, memory.title, 0, 270 + extra, 30, 610, hexColor('#8B5358'), true);
      label(card, memory.dateLabel ?? '', 0, 224 + extra, 21, 590, CocosTheme.textSecondary());
      const illustration = createUiNode('DiaryIllustration');
      card.addChild(illustration);
      illustration.setPosition(0, 62 + extra / 2, 0);
      const [sheet, cell] = memory.art.split('#');
      applyArt(illustration, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5, rows: memory.artRows ?? 1,
        cropToFill: memory.artMode !== 'contain', preserveAspect: memory.artMode === 'contain', cropFocusY: memory.artFocusY ?? 0.2 }, 590, 270 + extra);
      if (!unlocked) illustration.addComponent(UIOpacity).opacity = 150;
      illustration.addComponent(Button);
      illustration.on(Button.EventType.CLICK, () => {
        if (unlocked) this.previewMemory(memory);
        else this.toast('先解锁这段回忆，再查看完整插画吧');
      });
      const scrollable = diaryBody(card, unlocked ? memory.diary : '解锁这段回忆后，日记会在这里展开。', extra);
      const artLabel = memory.artLabel ?? '故事插画';
      label(card, `${artLabel} · 点击看大图${scrollable ? ' · 正文可滑动' : ''}`, 0, -94, 16, 560, CocosTheme.textSecondary());
      const adventure = this.game.bundle.adventures.find((c) => c.memoryId === memory.id);
      label(card, `第 ${this.memoryPage + 1} / ${total} 页`, adventure ? -177 : 0, -292 - extra, 17, 260, CocosTheme.textSecondary());
      if (adventure) button(card, '回忆探索 ›', 150, -292 - extra, 264, 40, () => this.openAdventure?.(adventure.id), 'pink');
      this.pager(total, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
      return;
    }
    const pages = Math.ceil(this.game.bundle.memories.length / perPage);
    this.memoryPage = Math.min(this.memoryPage, pages - 1);
    const start = this.memoryPage * perPage;
    for (let offset = 0; offset < perPage; offset += 1) {
      const memory = this.game.bundle.memories[start + offset];
      if (memory) this.memoryCard(memory, start + offset, compact ? 0 : offset % 2 === 0 ? -171 : 171,
        compact ? -91 : offset < 2 ? 100 + extra / 2 : -252 - extra / 2, compact, extra);
    }
    this.pager(pages, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
  }

  private memoryCard(memory: MemoryDefinition, index: number, x: number, y: number, compact: boolean, extra: number): void {
    const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
    const prior = index === 0 || this.game.life.state.unlockedMemoryIds.includes(this.game.bundle.memories[index - 1].id);
    const card = paper(this.pageRoot, `Memory_${memory.id}`, x, y, compact ? 650 : 326, compact ? 670 : 336 + extra);
    tape(card, compact ? 165 : 66, compact ? 333 : 167 + extra / 2, -8);
    const picture = createUiNode('Illustration');
    card.addChild(picture);
    picture.setPosition(0, compact ? 142 : 83, 0);
    const [sheet, cell] = memory.art.split('#');
    applyArt(picture, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5, rows: memory.artRows ?? 1,
      cropToFill: memory.artMode !== 'contain', preserveAspect: memory.artMode === 'contain', cropFocusY: memory.artFocusY ?? 0.2 }, compact ? 602 : 294, compact ? 320 : 158 + extra);
    if (!unlocked) {
      const opacity = picture.addComponent(UIOpacity);
      opacity.opacity = 170;
    }
    const badge = createUiNode('MemoryNumber');
    card.addChild(badge);
    badge.setPosition(compact ? -291 : -141, compact ? 316 : 149 + extra / 2, 0);
    paintRoundRect(badge.addComponent(Graphics), 57, 52, 24, hexColor('#E993A0'), hexColor('#FFF8F4'), 2);
    label(badge, String(index + 1).padStart(2, '0'), 0, 0, 22, 52, hexColor('#FFFFFF'), true);
    label(card, memory.title, 0, compact ? -70 : -20 - extra / 2, compact ? 32 : 23, compact ? 604 : 300, hexColor('#8B5358'), true);
    label(card, memory.dateLabel ?? '', 0, compact ? -112 : -50 - extra / 2, compact ? 23 : 16, compact ? 604 : 296, CocosTheme.textSecondary());
    const summary = compact || memory.summary.length <= 24 ? memory.summary : memory.summary.slice(0, 23) + '…';
    const copy = paragraph(card, summary, 0, compact ? -185 : -91 - extra / 2, compact ? 24 : 19, compact ? 564 : 286, compact ? 108 : 52, CocosTheme.textSecondary());
    copy.lineHeight = compact ? 34 : 25;
    const caption = unlocked ? '翻开日记 ›' : prior ? `♥ ${memory.heartCost} 解锁` : '先解锁上一段';
    button(card, caption, 0, compact ? -285 : -141 - extra / 2, compact ? 500 : 282, compact ? 66 : 46, () => {
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
    const { extra } = journalLayout(this.roots.designWidth, this.roots.designHeight);
    const paths = this.game.life.state.photoPaths;
    const count = createUiNode('PhotoCount');
    this.pageRoot.addChild(count);
    ensureTransform(count, 650, 48);
    count.setPosition(0, 244 + extra, 0);
    paintRoundRect(count.addComponent(Graphics), 650, 48, 20, CocosTheme.surface());
    label(count, `本机留念 ${paths.length} 张 · 点击照片查看大图`, 0, 0, 22, 620, CocosTheme.textPrimary(), true);
    if (paths.length === 0) label(this.pageRoot, '前往家园，点击「拍照」留下第一张照片。', 0, 25, 20, 620, CocosTheme.textSecondary());
    const data = photoPage(paths, this.memoryPage);
    this.memoryPage = data.page;
    data.photos.forEach(({ path, index }, offset) => {
      const holder = button(this.pageRoot, '', offset % 2 === 0 ? -162 : 162, offset < 2 ? 95 + extra / 2 : -159 - extra / 2, 304, 236 + extra, () => this.previewPhoto(index));
      this.photoPicture(holder, path, 270, 170 + extra);
      label(holder, `留念 ${index + 1}`, 0, -100 - extra / 2, 19, 270, CocosTheme.textSecondary());
    });
    if (paths.length > 0) {
      button(this.pageRoot, '上一页', -200, -336 - extra, 144, 48, () => { this.memoryPage = (data.page - 1 + data.pages) % data.pages; this.render(); });
      label(this.pageRoot, `${data.page + 1} / ${data.pages}`, 0, -336 - extra, 21, 120);
      button(this.pageRoot, '下一页', 200, -336 - extra, 144, 48, () => { this.memoryPage = (data.page + 1) % data.pages; this.render(); });
    }
    button(this.pageRoot, '去家园拍照', 0, -418 - extra, 240, 58, () => this.setPage('home'), 'pink');
  }

  private photoPicture(parent: Node, path: string, width: number, height: number): void {
    const message = paragraph(parent, '照片加载中…', 0, 0, 23, width, 100, CocosTheme.textSecondary());
    message.horizontalAlign = Label.HorizontalAlign.CENTER;
    const photo = createUiNode('PhotoImage');
    parent.addChild(photo);
    applyLocalPhoto(photo, path, width, height, (status) => {
      if (!message.node.isValid) return;
      message.node.active = status !== 'ready';
      message.string = status === 'failed' ? '照片暂时无法读取\n点击照片重试' : '';
    });
    photo.pauseSystemEvents(true);
  }

  private previewMemory(memory: MemoryDefinition): void {
    this.photoRoot.active = true;
    const panel = this.modalPanel(this.photoRoot, 'StoryArtDetail');
    label(panel, memory.title, -40, 392, 28, 490, CocosTheme.textPrimary(), true);
    button(panel, '关闭', 275, 395, 88, 46, () => { this.photoRoot.active = false; });
    const illustration = createUiNode('StoryArtFull');
    panel.addChild(illustration);
    illustration.setPosition(0, 28, 0);
    const [sheet, cell] = memory.art.split('#');
    const status = label(panel, '插画加载中…', 0, -330, 21, 600, CocosTheme.textSecondary());
    applyArt(illustration, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5,
      rows: memory.artRows ?? 1, preserveAspect: true }, 610, 610, (ok) => {
      if (status.node.isValid) status.string = ok ? (memory.dateLabel ?? '') : '插画暂时无法读取，请关闭后重试';
    });
    label(panel, '根据我们的故事绘制的插画', 0, -395, 20, 620, CocosTheme.textSecondary());
  }

  private previewPhoto(index: number): void {
    const paths = this.game.life.state.photoPaths;
    const path = paths[index];
    if (!path) return;
    this.photoRoot.active = true;
    const panel = this.modalPanel(this.photoRoot, 'PhotoDetail');
    label(panel, `留念 ${index + 1} / ${paths.length}`, -60, 392, 29, 450, CocosTheme.textPrimary(), true);
    button(panel, '关闭', 275, 395, 88, 46, () => { this.photoRoot.active = false; });
    const picture = button(panel, '', 0, 28, 610, 590, () => this.previewPhoto(index));
    this.photoPicture(picture, path, 590, 570);
    button(panel, '上一张', -174, -330, 160, 54, () => this.previewPhoto((index - 1 + paths.length) % paths.length));
    button(panel, '下一张', 174, -330, 160, 54, () => this.previewPhoto((index + 1) % paths.length));
    label(panel, '照片保存在当前设备，点击图片可重新加载', 0, -395, 20, 620, CocosTheme.textSecondary());
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
    if (this.homeRoom !== 'garden') {
      const rug = createUiNode('RoomRug');
      scene.addChild(rug);
      rug.setPosition(this.homeRoom === 'living' ? -20 : 58, -208, 0);
      const g = rug.addComponent(Graphics);
      g.fillColor = hexColor('#F4DFCF', 160);
      g.ellipse(0, 0, this.homeRoom === 'living' ? 310 : 252, 72); g.fill();
      g.strokeColor = hexColor('#FFF2E4', 180); g.lineWidth = 4;
      g.ellipse(0, 0, this.homeRoom === 'living' ? 297 : 239, 63); g.stroke();
    }
    const placed = this.game.bundle.furniture
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.room === this.homeRoom && this.game.life.state.placedFurnitureIds.includes(item.id))
      .sort((a, b) => b.item.placement.y - a.item.placement.y);
    for (const { item, index } of placed) {
      const { x, y, width, height } = item.placement;
      const art = furnitureArt(index);
      const bounds = art.region!;
      const fitted = fitPhoto(bounds.width, bounds.height, width, height);
      if (item.id !== 'flower_wall') {
        const shadow = createUiNode('Shadow_' + item.id);
        scene.addChild(shadow);
        shadow.setPosition(x, y - fitted.height * 0.46, 0);
        const g = shadow.addComponent(Graphics);
        g.fillColor = hexColor('#725545', 40);
        g.ellipse(0, 0, fitted.width * 0.39, Math.max(6, fitted.width * 0.035)); g.fill();
      }
      const sprite = createUiNode('Placed_' + item.id);
      scene.addChild(sprite);
      sprite.setPosition(x, y, 0);
      applyArt(sprite, art, width, height);
    }
    const souvenirs = this.game.bundle.adventures.filter((chapter) => this.game.play.progress(chapter.id).claimed && chapter.souvenir.room === this.homeRoom);
    const hasSouvenir = souvenirs.length > 0;
    const shelf = createUiNode('MemoryShelf'); scene.addChild(shelf);
    shelf.setPosition(0, -218, 0);
    if (hasSouvenir) {
      paintRoundRect(shelf.addComponent(Graphics), 638, 134, 22, hexColor('#FFF8EF', 242), hexColor('#DDBFA8'), 2);
      label(shelf, '回忆纪念架 · 点击重读故事', 0, 45, 18, 600, hexColor('#9A7163'));
    }
    const spacing = Math.max(96, 600 / Math.max(1, souvenirs.length));
    souvenirs.forEach((chapter, index) => {
      const x = souvenirs.length === 1 ? 0 : -((souvenirs.length - 1) / 2) * spacing + index * spacing;
      const titleWidth = Math.max(80, Math.min(244, spacing - 12));
      const gift = createUiNode('Souvenir_' + chapter.id); shelf.addChild(gift);
      ensureTransform(gift, Math.max(96, titleWidth), 126);
      gift.setPosition(x, 0, 0);
      const icon = createUiNode('SouvenirIcon'); gift.addChild(icon); icon.setPosition(0, 0, 0);
      const art = itemArt(chapter.souvenir.artItemId); if (art) applyArt(icon, art, 64, 64);
      gift.addComponent(Button); gift.on(Button.EventType.CLICK, () => this.openMemory(chapter.memoryId));
      const title = makeLabel(chapter.souvenir.title, 16, hexColor('#8B5358'));
      gift.addChild(title.node); ensureTransform(title.node, titleWidth, 42); title.node.setPosition(0, -42, 0);
      title.enableWrapText = true; title.overflow = Label.Overflow.SHRINK; title.lineHeight = 19;
    });
    if (placed.length === 0 && !hasSouvenir) {
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
    const y = -461 - journalLayout(this.roots.designWidth, this.roots.designHeight).extra;
    button(this.pageRoot, '上一页', -215, y, 124, 48, () => set((current() - 1 + pages) % pages), 'cream');
    label(this.pageRoot, (current() + 1) + ' / ' + pages, 0, y, 22, 140, CocosTheme.textSecondary());
    button(this.pageRoot, '下一页', 215, y, 124, 48, () => set((current() + 1) % pages), 'cream');
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
    this.photoRoot.active = false;
    this.catalogRoot.active = false;
    this.taskRoot.active = true;
    this.renderTasks();
    this.renderNav();
  }

  private renderTasks(): void {
    const panel = this.modalPanel(this.taskRoot, 'WishesPanel');
    const claimed = this.game.life.state.claimedWishIds.length;
    label(panel, '小屋心愿  ' + claimed + '/10', -52, 392, 31, 490, hexColor('#8B5358'), true);
    button(panel, '今日约会 · 剧情与解谜 ›', 0, 342, 530, 44, () => this.openAdventure?.(), 'pink');
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
    applyArt(icon, furnitureArt(index), 222, 145);
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
