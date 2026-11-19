import { BlockInputEvents, Button, Camera, EventTouch, Graphics, Input, isValid, Label, Mask, Node, ScrollView, Slider, Sprite, UITransform, Vec3 } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import { WEDDING_CHAPTER_ID } from '../../core/play/types';
import type { FurnitureDefinition, MemoryDefinition, WishDefinition } from '../../core/types';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, applyFurnitureArt, applyLocalPhoto, furnitureArtFor, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';
import { sizeOf } from './UiFactory';
import { fitPhoto, homeFurnitureLayout, journalLayout, lifePageLayout, photoPage, snapFurniturePlacement, LIFE_BOTTOM_RESERVED } from '../../presentation/UiSafety';
import { memoryVisibility } from '../../presentation/MemoryVisibility';
import { constrainFurniturePose, furnitureContainsPoint, furnitureScaleFromProgress, furnitureScaleProgress, FURNITURE_SCALE, rotatedFurnitureSize, type FurniturePose } from '../../presentation/FurnitureEditing';

type Page = 'merge' | 'memories' | 'home';
type MemoryTab = 'album' | 'diary' | 'timeline' | 'photos';
type HomeRoom = FurnitureDefinition['room'];
type FurnitureSceneEntry = { sprite: Node; shadow: Node | null; footOffset: number; wall: boolean; item: FurnitureDefinition; size: { width: number; height: number } };

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

function scrollingCopy(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number): boolean {
  const viewport = createUiNode(`${name}Viewport`);
  parent.addChild(viewport);
  ensureTransform(viewport, width, height);
  viewport.setPosition(x, y, 0);
  viewport.addComponent(Mask);
  const content = createUiNode(`${name}Content`);
  viewport.addChild(content);
  const contentTransform = ensureTransform(content, width, height, 0.5, 1);
  content.setPosition(0, height / 2, 0);
  const body = makeLabel(text, 22, CocosTheme.textPrimary());
  body.node.name = `${name}Text`;
  content.addChild(body.node);
  const bodyTransform = ensureTransform(body.node, width, height, 0.5, 1);
  body.node.setPosition(0, -4, 0);
  body.enableWrapText = true;
  body.horizontalAlign = Label.HorizontalAlign.LEFT;
  body.verticalAlign = Label.VerticalAlign.TOP;
  body.lineHeight = 33;
  body.overflow = Label.Overflow.RESIZE_HEIGHT;
  body.updateRenderData(true);
  contentTransform.setContentSize(width, Math.max(height, bodyTransform.height + 8));
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
  paintTactileButton(g,width,height,tone==='pink'?'rose':tone);
  label(node, text, 0, 0, Math.min(26, Math.max(23, height * 0.48)), width - 12, tone === 'pink' ? CocosTheme.surface() : CocosTheme.textPrimary(), true);
  pressButton(node);
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
  applyMaterialFrame(surface,'paper',width,height,Math.min(.7,width/650));
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
  private roomPage = 0;
  private arranging = false;
  private selectedFurniture: string | null = null;
  private previewFurniture: ((id: string, pose: FurniturePose) => void) | null = null;
  private scaleGesture: { id: string; value: number } | null = null;
  private scaleCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private furnitureMessage = '拖动滑条预览，松手保存 · 可撤销本次布置的调整';
  private readonly homeBackdrops: Record<HomeRoom, Node>;
  private readonly pageRoot: Node;
  private readonly navRoot: Node;
  private readonly taskRoot: Node;
  private readonly catalogRoot: Node;
  private readonly photoRoot: Node;
  private readonly endingRoot: Node;

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
      study: createUiNode('HomeBackdropStudy'),
      terrace: createUiNode('HomeBackdropTerrace'),
      pool: createUiNode('HomeBackdropPool'),
    };
    const roomArt: Record<HomeRoom, string> = {
      living: 'home_background_empty',
      bedroom: 'home_bedroom',
      garden: 'home_garden',
      study: 'home_study',
      terrace: 'home_terrace',
      pool: 'home_pool',
    };
    for (const room of ['living', 'bedroom', 'garden', 'study', 'terrace', 'pool'] as const) {
      const backdrop = this.homeBackdrops[room];
      roots.background.addChild(backdrop);
      applyArt(backdrop, { sheet: roomArt[room] }, backdropSize.width, backdropSize.height);
      backdrop.active = false;
    }

    this.pageRoot = createUiNode('LifePage');
    this.pageRoot.once(Node.EventType.NODE_DESTROYED, () => this.cancelScalePreview());
    roots.contentLayer.addChild(this.pageRoot);
    ensureTransform(this.pageRoot, 710, 1000);
    const pageLayout = lifePageLayout(roots.designWidth, roots.designHeight);
    this.pageRoot.setPosition(0, pageLayout.y, 0);
    this.pageRoot.setScale(pageLayout.scale, pageLayout.scale, 1);
    this.pageRoot.active = false;

    this.navRoot = createUiNode('Navigation');
    roots.navLayer.addChild(this.navRoot);
    ensureTransform(this.navRoot, roots.designWidth - 24, 104);
    this.navRoot.setPosition(0, -roots.designHeight / 2 + 56, 0);

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

    this.endingRoot = createUiNode('WeddingEndingOverlay');
    roots.modalLayer.addChild(this.endingRoot);
    ensureTransform(this.endingRoot, roots.designWidth, roots.designHeight);
    this.endingRoot.addComponent(BlockInputEvents);
    this.endingRoot.active = false;

    this.renderNav();
  }

  setPage(page: Page): void {
    this.cancelScalePreview();
    this.photoRoot.active = false;
    this.endingRoot.active = false;
    this.taskRoot.active = false;
    this.catalogRoot.active = false;
    this.page = page;
    if (page !== 'home') { this.arranging = false; this.selectedFurniture = null; this.game.clearFurnitureEditHistory(); }
    const merge = page === 'merge';
    this.syncHomeBackdrop();
    this.roots.ordersSlot.active = merge;
    this.roots.boardSlot.active = merge;
    this.roots.mergeFooter.active = merge;
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

  openTimeline(): void {
    this.memoryTab = 'timeline';
    this.memoryPage = 0;
    this.setPage('memories');
  }

  openWeddingEnding(): boolean {
    const chapter = this.game.bundle.adventures.find((entry) => entry.id === WEDDING_CHAPTER_ID);
    if (!chapter || !this.game.play.progress(chapter.id).claimed) return false;
    const memoryIndex = this.game.bundle.memories.findIndex((item) => item.id === chapter.memoryId);
    if (memoryIndex < 0) return false;
    const memory = this.game.bundle.memories[memoryIndex];
    if (!this.game.life.state.unlockedMemoryIds.includes(memory.id)) return false;

    this.memoryTab = 'diary';
    this.memoryPage = memoryIndex;
    this.setPage('memories');
    this.endingRoot.active = true;
    this.renderWeddingEnding(memory);
    this.renderNav();
    return true;
  }

  private renderWeddingEnding(memory: MemoryDefinition): void {
    const panel = this.modalPanel(this.endingRoot, 'WeddingEndingPanel');
    const gift = this.game.config.couple.gift;
    const textOr = (value: string | undefined, fallback: string): string => value?.trim() || fallback;
    label(panel, textOr(gift?.title, '婚礼来信'), -35, 394, 32, 470, hexColor('#8B5358'), true);
    const close = button(panel, '关闭', 275, 395, 88, 46, () => {
      this.endingRoot.active = false;
      this.renderNav();
    });
    close.name = 'WeddingEndingClose';

    const illustration = createUiNode('WeddingEndingIllustration');
    panel.addChild(illustration);
    illustration.setPosition(0, 230, 0);
    const [sheet, cell] = memory.art.split('#');
    applyArt(illustration, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5,
      rows: memory.artRows ?? 1, cropToFill: memory.artMode !== 'contain', preserveAspect: memory.artMode === 'contain',
      cropFocusY: memory.artFocusY ?? 0.2 }, 590, 190);
    label(panel, memory.dateLabel ?? '', 0, 105, 19, 570, CocosTheme.textSecondary());

    if (gift?.salutation?.trim()) {
      const salutation = label(panel, gift.salutation.trim(), 0, 50, 22, 560, CocosTheme.textPrimary(), true);
      salutation.horizontalAlign = Label.HorizontalAlign.LEFT;
    }
    scrollingCopy(panel, 'WeddingLetterBody', textOr(gift?.body, '专属信待填写'), 0, -100, 560, 250);
    if (gift?.signoff?.trim()) {
      const signoff = label(panel, gift.signoff.trim(), 0, -245, 20, 560, CocosTheme.textPrimary());
      signoff.horizontalAlign = Label.HorizontalAlign.RIGHT;
    }
    if (gift?.signature?.trim()) {
      const signature = label(panel, gift.signature.trim(), 0, -290, 20, 560, CocosTheme.textPrimary(), true);
      signature.horizontalAlign = Label.HorizontalAlign.RIGHT;
    }

    const timeline = button(panel, '查看回忆时间轴', -130, -374, 240, 104, () => this.openTimeline(), 'cream');
    timeline.name = 'WeddingEndingTimeline';
    const home = button(panel, '继续经营小屋', 140, -374, 250, 104, () => {
      this.endingRoot.active = false;
      this.setPage('home');
    }, 'pink');
    home.name = 'WeddingEndingContinueHome';
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
    this.navRoot.active = this.page !== 'merge';
    if (this.page === 'merge') return;
    const width = this.roots.designWidth - 24;
    const fullSize = sizeOf(this.roots.canvas, this.roots.designWidth, this.roots.designHeight);
    const bottomInset = Math.max(0, fullSize.height / 2 + this.roots.safeArea.position.y - this.roots.designHeight / 2);
    const base = createUiNode('NavigationBase');
    this.navRoot.addChild(base);
    base.setPosition(0, -4 - bottomInset / 2, 0);
    paintRoundRect(base.addComponent(Graphics), fullSize.width, 112 + bottomInset, 0, hexColor('#FFF4E8', 250));
    const shadow = createUiNode('NavigationShadow'); this.navRoot.addChild(shadow); shadow.setPosition(0, -4, 0);
    paintRoundRect(shadow.addComponent(Graphics), width + 4, 108, 26, hexColor('#805D46', 28));
    const tray = createUiNode('NavigationTray'); this.navRoot.addChild(tray);
    paintRoundRect(tray.addComponent(Graphics), width, 104, 26, hexColor('#FFF9F0'), hexColor('#E7CDBB'), 2);
    const gap = 6;
    const tabWidth = (width - 20 - gap * 3) / 4;
    const entries: Array<[string, Page | null]> = [['任务', null], ['合成', 'merge'], ['回忆', 'memories'], ['家园', 'home']];
    entries.forEach(([title, page], index) => {
      const selected = page === null ? this.taskRoot.active : page === this.page && !this.taskRoot.active;
      const entry = createUiNode(`Button_${title}`);
      this.navRoot.addChild(entry);
      ensureTransform(entry, tabWidth, 104);
      entry.setPosition(-width / 2 + 10 + tabWidth / 2 + index * (tabWidth + gap), 0, 0);
      const selection = createUiNode('NavigationSelection'); entry.addChild(selection);
      paintRoundRect(selection.addComponent(Graphics), 104, 54, 23, hexColor('#F7E2E3'), hexColor('#E9CFCA'), 1);
      selection.setPosition(0, 14, 0); selection.active = selected;
      const circle = createUiNode('NavigationIcon');
      entry.addChild(circle);
      circle.setPosition(0, 14, 0);
      const icon = createUiNode('NavSymbol');
      circle.addChild(icon);
      ensureTransform(icon, 44, 44);
      icon.setScale(1.35, 1.35, 1);
      icon.setScale(1, 1, 1);
      applyArt(icon, { sheet: 'navigation_illustrated_sheet', index, columns: 2, rows: 2, preserveAspect: true }, 66, 60);
      const caption = label(entry, title, 0, -29, 25, tabWidth - 12, selected ? hexColor('#8E4157') : hexColor('#8C7360'), selected);
      caption.node.name = 'NavigationCaption';
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
    const header = createUiNode('AlbumHeader'); this.pageRoot.addChild(header); header.setPosition(0, 449 + extra, 0);
    label(header, '我们的故事', -185, 0, 34, 300, hexColor('#8C3F49'), true);
    const unlocked = memories.filter((memory) => this.game.life.state.unlockedMemoryIds.includes(memory.id)).length;
    const progress = createUiNode('AlbumProgress'); header.addChild(progress); progress.setPosition(192, 0, 0);
    label(progress, `已珍藏 ${unlocked}/${total}`, 0, 4, 24, 244, hexColor('#8B5358'), true);
    const track = createUiNode('AlbumProgressTrack'); progress.addChild(track); track.setPosition(0, -23, 0);
    paintRoundRect(track.addComponent(Graphics), 208, 10, 5, hexColor('#EEDCD3'));
    if (unlocked > 0) {
      const fill = createUiNode('AlbumProgressFill'); track.addChild(fill);
      const width = 208 * Math.min(1, unlocked / total); fill.setPosition(-104 + width / 2, 0, 0);
      paintRoundRect(fill.addComponent(Graphics), width, 10, 5, hexColor('#E68B9B'));
    }
    const tabs: Array<[MemoryTab, string]> = [
      ['album', '相册'], ['diary', '心动日记'], ['timeline', '时间轴'], ['photos', '拍照留念'],
    ];
    const tabCenters = [-250.5, -83.5, 83.5, 250.5];
    tabs.forEach(([id, name], index) => {
      const tab = button(this.pageRoot, name, tabCenters[index], 363 + extra, 167, 72, () => {
        this.memoryTab = id;
        this.memoryPage = 0;
        this.render();
      }, this.memoryTab === id ? 'pink' : 'cream');
      tab.name = `MemoryTab_${id}`;
      // Keep the original touch area while the visible tab stays compact.
      ensureTransform(tab, 167, 104);
    });

    if (this.memoryTab === 'photos') {
      this.renderPhotos();
      return;
    }
    if (this.memoryTab === 'diary') {
      this.memoryPage = Math.max(0, Math.min(this.memoryPage, total - 1));
      const memory = memories[this.memoryPage];
      const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
      const visible = memoryVisibility(memory, unlocked);
      const card = paper(this.pageRoot, 'DiaryCard', 0, -50, 660, 650 + 2 * extra);
      tape(card, -208, 310 + extra, -9);
      label(card, visible.title, 0, 270 + extra, 30, 610, hexColor('#8B5358'), true);
      label(card, visible.date, 0, 224 + extra, 21, 590, CocosTheme.textSecondary());
      const illustration = createUiNode('DiaryIllustration');
      card.addChild(illustration);
      illustration.setPosition(0, 62 + extra / 2, 0);
      const [sheet, cell] = memory.art.split('#');
      if (unlocked) applyArt(illustration, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5, rows: memory.artRows ?? 1,
        cropToFill: memory.artMode !== 'contain', preserveAspect: memory.artMode === 'contain', cropFocusY: memory.artFocusY ?? 0.2 }, 590, 270 + extra);
      else label(illustration, '🔒 这段回忆还未解锁', 0, 0, 24, 550, CocosTheme.textSecondary());
      illustration.addComponent(Button);
      illustration.on(Button.EventType.CLICK, () => {
        if (unlocked) this.previewMemory(memory);
        else this.toast('先解锁这段回忆，再查看完整插画吧');
      });
      const scrollable = diaryBody(card, visible.diary, extra);
      const artLabel = unlocked ? memory.artLabel ?? '故事插画' : '等待珍藏';
      label(card, unlocked ? `${artLabel} · 点击看大图${scrollable ? ' · 正文可滑动' : ''}` : artLabel, 0, -94, 20, 560, CocosTheme.textSecondary());
      const adventure = this.game.bundle.adventures.find((c) => c.memoryId === memory.id);
      const finalClaimed = adventure?.id === WEDDING_CHAPTER_ID
        && this.game.play.progress(WEDDING_CHAPTER_ID).claimed;
      label(card, `第 ${this.memoryPage + 1} / ${total} 页`, finalClaimed ? 0 : adventure ? -177 : 0, finalClaimed ? -246 - extra : -292 - extra, 21, 260, CocosTheme.textSecondary());
      if (finalClaimed) {
        const hitArea = createUiNode('WeddingLetterReplay');
        this.pageRoot.addChild(hitArea);
        ensureTransform(hitArea, 264, 104);
        hitArea.setPosition(-150, -370 - extra, 0);
        const hitGraphics = hitArea.addComponent(Graphics);
        hitGraphics.fillColor = hexColor('#FFFFFF', 0);
        hitGraphics.rect(-132, -52, 264, 104);
        hitGraphics.fill();
        const visual = createUiNode('WeddingLetterReplayVisual');
        hitArea.addChild(visual);
        ensureTransform(visual, 264, 40);
        visual.setPosition(0, 28, 0);
        paintRoundRect(visual.addComponent(Graphics), 264, 40, 20, CocosTheme.primary(), CocosTheme.border(), 1);
        label(visual, '重读婚礼信 ›', 0, 0, 23, 252, CocosTheme.surface(), true);
        hitArea.addComponent(Button);
        hitArea.on(Button.EventType.CLICK, () => {
          if (!this.openWeddingEnding()) this.toast('珍藏草坪婚礼后即可重读婚礼信');
        });
      }
      if (adventure) {
        const caption = this.game.play.progress(adventure.id).claimed ? '重看回忆谜题 ›'
          : '玩这段回忆的谜题 ›';
        const explore = button(card, caption, 150, -292 - extra, 264, 60, () => this.openAdventure?.(adventure.id), 'pink');
        explore.name = `MemoryAdventure_${adventure.id}`;
      }
      this.pager(total, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
      return;
    }
    if (this.memoryTab === 'timeline') {
      this.renderTimeline(extra);
      return;
    }
    const pages = Math.ceil(this.game.bundle.memories.length / perPage);
    this.memoryPage = Math.min(this.memoryPage, pages - 1);
    const start = this.memoryPage * perPage;
    for (let offset = 0; offset < perPage; offset += 1) {
      const memory = this.game.bundle.memories[start + offset];
      if (memory) this.memoryCard(memory, start + offset, compact ? 0 : offset % 2 === 0 ? -171 : 171,
        compact ? -52 : offset < 2 ? 100 + extra / 2 : -252 - extra / 2, compact, extra);
    }
    this.pager(pages, () => this.memoryPage, (page) => { this.memoryPage = page; this.render(); });
  }

  private renderTimeline(extra: number): void {
    const memories = this.game.bundle.memories;
    const viewportHeight = 666 + 2 * extra;
    const viewport = createUiNode('MemoryTimelineViewport');
    this.pageRoot.addChild(viewport);
    ensureTransform(viewport, 660, viewportHeight);
    viewport.setPosition(0, -47, 0);
    viewport.addComponent(Mask);

    const contentHeight = Math.max(viewportHeight, memories.length * 142 + 32);
    const content = createUiNode('MemoryTimelineContent');
    viewport.addChild(content);
    ensureTransform(content, 650, contentHeight, 0.5, 1);
    content.setPosition(0, viewportHeight / 2, 0);

    const spine = createUiNode('MemoryTimelineSpine');
    content.addChild(spine);
    ensureTransform(spine, 8, Math.max(80, contentHeight - 80));
    spine.setPosition(-316, -contentHeight / 2, 0);
    const spineGraphics = spine.addComponent(Graphics);
    spineGraphics.lineWidth = 4;
    spineGraphics.strokeColor = hexColor('#E7C8B9');
    spineGraphics.moveTo(0, Math.max(20, contentHeight / 2 - 40));
    spineGraphics.lineTo(0, -Math.max(20, contentHeight / 2 - 40));
    spineGraphics.stroke();
    const artworkEntries: Array<{ picture: Node; memory: MemoryDefinition; loaded: boolean }> = [];

    memories.forEach((memory, index) => {
      const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
      const visible = memoryVisibility(memory, unlocked);
      const prior = index === 0 || this.game.life.state.unlockedMemoryIds.includes(memories[index - 1].id);
      const rowY = -72 - index * 142;
      const row = button(content, '', 0, rowY, 610, 128, () => {
        if (unlocked) {
          this.openMemory(memory.id);
          return;
        }
        const result = this.game.unlockMemory(memory.id);
        this.toast(result.ok ? '新回忆已经珍藏 ♥'
          : result.reason === 'NOT_ENOUGH_HEARTS' ? '爱心还不够，先完成订单和心愿吧'
          : '请先解锁前一段回忆，也可从旅程直接探索');
        this.render();
      }, 'cream');
      row.name = `TimelineEntry_${memory.id}`;

      const dot = createUiNode(`TimelineMarker_${memory.id}`);
      content.addChild(dot);
      ensureTransform(dot, 28, 28);
      dot.setPosition(-316, rowY, 0);
      const dotGraphics = dot.addComponent(Graphics);
      dotGraphics.fillColor = hexColor(unlocked ? '#E993A3' : '#D2C7BE');
      dotGraphics.circle(0, 0, 12);
      dotGraphics.fill();

      const picture = createUiNode(`TimelineArt_${memory.id}`);
      row.addChild(picture);
      ensureTransform(picture, 96, 100);
      picture.setPosition(-238, 0, 0);
      if (!unlocked) label(picture, '🔒', 0, 0, 28, 90, CocosTheme.textSecondary());
      artworkEntries.push({ picture, memory, loaded: !unlocked });

      label(row, visible.date, 45, 42, 16, 445, CocosTheme.textSecondary());
      label(row, visible.title, 45, 0, 21, 445, hexColor('#8B5358'), true);
      if (unlocked) {
        paragraph(row, visible.summary, 45, -41, 16, 440, 40, CocosTheme.textSecondary());
      } else {
        const caption = prior ? `♥ ${memory.heartCost} 解锁` : '先解锁上一段';
        label(row, caption, 45, -41, 17, 440, CocosTheme.textSecondary());
      }
    });

    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.elastic = false;
    scroll.cancelInnerEvents = true;
    scroll.content = content;
    scroll.scrollToTop(0);
    const updateVisibleArtwork = (): void => {
      const offset = Math.max(0, scroll.getScrollOffset().y);
      const first = Math.max(0, Math.floor(offset / 142) - 2);
      const last = Math.min(artworkEntries.length - 1, Math.ceil((offset + viewportHeight) / 142) + 2);
      for (let index = first; index <= last; index += 1) {
        const entry = artworkEntries[index];
        if (!entry || entry.loaded) continue;
        entry.loaded = true;
        const [sheet, cell] = entry.memory.art.split('#');
        applyArt(entry.picture, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : entry.memory.artColumns ?? 5,
          rows: entry.memory.artRows ?? 1, cropToFill: entry.memory.artMode !== 'contain',
          preserveAspect: entry.memory.artMode === 'contain', cropFocusY: entry.memory.artFocusY ?? 0.2 }, 96, 100);
      }
    };
    viewport.on(ScrollView.EventType.SCROLLING, updateVisibleArtwork);
    updateVisibleArtwork();
  }

  private memoryCard(memory: MemoryDefinition, index: number, x: number, y: number, compact: boolean, extra: number): void {
    const unlocked = this.game.life.state.unlockedMemoryIds.includes(memory.id);
    const visible = memoryVisibility(memory, unlocked);
    const prior = index === 0 || this.game.life.state.unlockedMemoryIds.includes(this.game.bundle.memories[index - 1].id);
    const card = paper(this.pageRoot, `Memory_${memory.id}`, x, y, compact ? 650 : 326, compact ? 720 : 336 + extra);
    tape(card, compact ? 165 : 66, compact ? 358 : 167 + extra / 2, -8);
    const picture = createUiNode('Illustration');
    card.addChild(picture);
    picture.setPosition(0, compact ? 146 : 83, 0);
    const [sheet, cell] = memory.art.split('#');
    if (unlocked) applyArt(picture, { sheet, index: Number(cell ?? 0), columns: cell === undefined ? 1 : memory.artColumns ?? 5, rows: memory.artRows ?? 1,
      cropToFill: memory.artMode !== 'contain', preserveAspect: memory.artMode === 'contain', cropFocusY: memory.artFocusY ?? 0.2 }, compact ? 602 : 294, compact ? 386 : 158 + extra);
    else {
      const seal = createUiNode('LockedMemorySeal'); picture.addChild(seal);
      paintRoundRect(seal.addComponent(Graphics), compact ? 172 : 116, compact ? 184 : 122, 22, hexColor('#F7ECE2'), hexColor('#E7D5C5'), 1);
      label(seal, '♡', 0, compact ? 24 : 18, compact ? 62 : 48, 100, hexColor('#D6AFA5'));
      label(seal, '尚未解锁', 0, compact ? -42 : -33, compact ? 23 : 18, compact ? 156 : 108, CocosTheme.textSecondary());
    }
    const badge = createUiNode('MemoryNumber');
    card.addChild(badge);
    badge.setPosition(compact ? -291 : -141, compact ? 341 : 149 + extra / 2, 0);
    paintRoundRect(badge.addComponent(Graphics), 57, 52, 24, hexColor('#E993A0'), hexColor('#FFF8F4'), 2);
    label(badge, String(index + 1).padStart(2, '0'), 0, 0, 22, 52, hexColor('#FFFFFF'), true);
    label(card, visible.title, 0, compact ? -95 : -20 - extra / 2, compact ? 32 : 23, compact ? 604 : 300, hexColor('#8B5358'), true);
    label(card, visible.date, 0, compact ? -136 : -50 - extra / 2, compact ? 23 : 16, compact ? 604 : 296, CocosTheme.textSecondary());
    const summary = compact || visible.summary.length <= 24 ? visible.summary : visible.summary.slice(0, 23) + '…';
    const copy = paragraph(card, summary, 0, compact ? -204 : -91 - extra / 2, compact ? 24 : 19, compact ? 564 : 286, compact ? 84 : 52, CocosTheme.textSecondary());
    copy.lineHeight = compact ? 34 : 25;
    const caption = unlocked ? '翻开日记 ›' : prior ? `♥ ${memory.heartCost} 解锁` : '先解锁上一段';
    button(card, caption, 0, compact ? -308 : -141 - extra / 2, compact ? 500 : 282, compact ? 66 : 46, () => {
      if (unlocked) {
        this.memoryTab = 'diary';
        this.memoryPage = index;
        this.render();
        return;
      }
      const result = this.game.unlockMemory(memory.id);
      this.toast(result.ok ? '新回忆已经珍藏 ♥' : result.reason === 'NOT_ENOUGH_HEARTS' ? '爱心还不够，先完成订单和心愿吧'
        : '请先解锁前一段回忆，也可从旅程直接探索');
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
    if (paths.length === 0) {
      const empty = paper(this.pageRoot, 'PhotoEmptyCard', 0, -20, 590, 360, '#FFFDF7');
      label(empty, '▧', 0, 72, 72, 140, hexColor('#DCBBAA'));
      label(empty, '把喜欢的小屋，留在相册里', 0, -15, 27, 540, hexColor('#8B5358'), true);
      label(empty, '前往家园，点击「拍照」留下第一张照片。', 0, -80, 22, 550, CocosTheme.textSecondary());
    }
    const data = photoPage(paths, this.memoryPage);
    this.memoryPage = data.page;
    data.photos.forEach(({ path, index }, offset) => {
      const holder = button(this.pageRoot, '', offset % 2 === 0 ? -162 : 162, offset < 2 ? 95 + extra / 2 : -159 - extra / 2, 304, 236 + extra, () => this.previewPhoto(index));
      this.photoPicture(holder, path, 270, 170 + extra);
      label(holder, `留念 ${index + 1}`, 0, -100 - extra / 2, 19, 270, CocosTheme.textSecondary());
    });
    if (paths.length > 0) {
      button(this.pageRoot, '上一页', -200, -336 - extra, 144, 64, () => { this.memoryPage = (data.page - 1 + data.pages) % data.pages; this.render(); });
      label(this.pageRoot, `${data.page + 1} / ${data.pages}`, 0, -336 - extra, 21, 120);
      button(this.pageRoot, '下一页', 200, -336 - extra, 144, 64, () => { this.memoryPage = (data.page + 1) % data.pages; this.render(); });
    }
    button(this.pageRoot, '去家园拍照', 0, -418 - extra, 280, 72, () => this.setPage('home'), 'pink');
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
    if (!this.game.life.state.unlockedMemoryIds.includes(memory.id)) return;
    this.photoRoot.active = true;
    const panel = this.modalPanel(this.photoRoot, 'StoryArtDetail');
    label(panel, memory.title, -40, 392, 28, 490, CocosTheme.textPrimary(), true);
    button(panel, '关闭', 275, 395, 100, 68, () => { this.photoRoot.active = false; });
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
    button(panel, '关闭', 275, 395, 100, 68, () => { this.photoRoot.active = false; });
    const picture = button(panel, '', 0, 28, 610, 590, () => this.previewPhoto(index));
    this.photoPicture(picture, path, 590, 570);
    button(panel, '上一张', -174, -330, 160, 68, () => this.previewPhoto((index - 1 + paths.length) % paths.length));
    button(panel, '下一张', 174, -330, 160, 68, () => this.previewPhoto((index + 1) % paths.length));
    label(panel, '照片保存在当前设备，点击图片可重新加载', 0, -395, 20, 620, CocosTheme.textSecondary());
  }

  private renderHome(): void {
    this.syncHomeBackdrop();
    const verticalExtra = Math.max(0, (this.roots.designHeight - 1334) * 0.3);
    const decor = this.game.life.getDecorPoints();
    const maxDecor = this.game.bundle.furniture.reduce((sum, item) => sum + item.decorPoints, 0);
    const wished = this.game.life.state.claimedWishIds.length;
    const note = createUiNode('HomeWishNote'); this.pageRoot.addChild(note);
    const homeLayout = homeFurnitureLayout(this.roots.designWidth, this.roots.designHeight);
    ensureTransform(note, 252, 62); note.setPosition(-205, homeLayout.tabsY - 74, 0);
    paintRoundRect(note.addComponent(Graphics), 252, 62, 24, hexColor('#FFF8F1', 246), hexColor('#E7CFC3'), 1);
    label(note, `♡ 心愿 ${wished}/10 ›`, 0, 0, 25, 230, hexColor('#8B5358'), true);
    note.addComponent(Button); note.on(Button.EventType.CLICK, () => this.showTasks());

    this.renderRoomTabs();
    const scene = createUiNode('HomeFurnitureScene');
    this.pageRoot.addChild(scene);
    ensureTransform(scene, homeLayout.width, homeLayout.height);
    scene.setPosition(0, homeLayout.y, 0);
    if (this.homeRoom !== 'garden' && this.homeRoom !== 'pool') {
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
      .sort((a, b) => {
        const positions = this.game.life.state.furniturePositions;
        const aY = positions[a.item.id] ? (positions[a.item.id].y - 0.5) * 580 : a.item.placement.y;
        const bY = positions[b.item.id] ? (positions[b.item.id].y - 0.5) * 580 : b.item.placement.y;
        return bY - aY;
      });
    const furnitureLayer = createUiNode('FurnitureLayer'); scene.addChild(furnitureLayer); ensureTransform(furnitureLayer, homeLayout.width, homeLayout.height);
    const furnitureViews: FurnitureSceneEntry[] = [];
    const sortDepth = (): void => {
      furnitureViews.sort((a, b) => Number(b.wall) - Number(a.wall) || (b.sprite.position.y - b.footOffset) - (a.sprite.position.y - a.footOffset));
      for (const view of furnitureViews) { view.shadow?.setSiblingIndex(furnitureLayer.children.length - 1); view.sprite.setSiblingIndex(furnitureLayer.children.length - 1); }
      furnitureLayer.getChildByName('FurnitureGestureSurface')?.setSiblingIndex(furnitureLayer.children.length - 1);
      furnitureLayer.getChildByName('FurnitureSnapGuides')?.setSiblingIndex(furnitureLayer.children.length - 1);
      furnitureLayer.getChildByName('FurnitureSelectedName')?.setSiblingIndex(furnitureLayer.children.length - 1);
    };
    for (const { item, index } of placed) {
      const { width, height } = item.placement;
      const position = this.game.life.state.furniturePositions[item.id];
      const x = position ? (position.x - 0.5) * homeLayout.width : item.placement.x;
      const y = position ? (position.y - 0.5) * homeLayout.height : item.placement.y;
      const art = furnitureArtFor(item, index);
      const bounds = art.region;
      const fitted = bounds ? fitPhoto(bounds.width, bounds.height, width, height) : { width, height };
      const transform = position ?? { x: item.placement.x / homeLayout.width + 0.5, y: item.placement.y / homeLayout.height + 0.5 };
      const scale = transform.scale ?? 1;
      const rotation = transform.rotation ?? 0;
      const flipped = transform.flipped ?? false;
      const radians = rotation * Math.PI / 180;
      const bboxHeight = (Math.abs(fitted.width * Math.sin(radians)) + Math.abs(fitted.height * Math.cos(radians))) * scale;
      let shadow: Node | null = null;
      if (item.id !== 'flower_wall' && !item.art.startsWith('wall:')) {
        shadow = createUiNode('Shadow_' + item.id);
        furnitureLayer.addChild(shadow);
        shadow.setPosition(x, y - bboxHeight * 0.46, 0);
        shadow.setScale(scale, scale, 1);
        const g = shadow.addComponent(Graphics);
        g.fillColor = hexColor('#725545', 40);
        g.ellipse(0, 0, fitted.width * 0.39, Math.max(6, fitted.width * 0.035)); g.fill();
      }
      const sprite = createUiNode('Placed_' + item.id);
      furnitureLayer.addChild(sprite);
      furnitureViews.push({ sprite, shadow, footOffset: bboxHeight * .46, wall: item.art.startsWith('wall:') || item.id === 'flower_wall', item, size: fitted });
      sprite.setPosition(x, y, 0);
      sprite.setScale(scale * (flipped ? -1 : 1), scale, 1);
      sprite.setRotationFromEuler(0, 0, rotation);
      applyFurnitureArt(sprite, item, index, width, height);
    }
    sortDepth();
    this.previewFurniture = (id, pose) => {
      const view = furnitureViews.find(v => v.item.id === id); if (!view) return;
      const scale = pose.scale ?? 1, rotation = pose.rotation ?? 0;
      const bounds = rotatedFurnitureSize(view.size.width, view.size.height, scale, rotation);
      view.footOffset = bounds.height * .46;
      view.sprite.setPosition((pose.x - .5) * homeLayout.width, (pose.y - .5) * homeLayout.height, 0);
      view.sprite.setScale(scale * (pose.flipped ? -1 : 1), scale, 1); view.sprite.setRotationFromEuler(0, 0, rotation);
      view.shadow?.setPosition(view.sprite.position.x, view.sprite.position.y - view.footOffset, 0); view.shadow?.setScale(scale, scale, 1);
      sortDepth(); this.drawFurnitureSelection(furnitureViews, furnitureLayer, homeLayout);
    };
    if (this.arranging) this.bindFurnitureGestures(scene, furnitureLayer, furnitureViews, homeLayout, sortDepth);
    const souvenirs = this.game.bundle.adventures.flatMap((chapter) =>
      chapter.souvenir?.room === this.homeRoom && this.game.play.progress(chapter.id).claimed
        ? [{ id: chapter.id, memoryId: chapter.memoryId, souvenir: chapter.souvenir }] : []);
    const hasSouvenir = souvenirs.length > 0;
    const shelf = createUiNode('MemoryShelf'); scene.addChild(shelf);
    shelf.setPosition(0, -homeLayout.height / 2 + 72, 0);
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
      label(hint, '这里还空着，来放一件家具吧 ♥', 0, 0, 22, 380, hexColor('#8B5358'));
    }

    const trayY = -390 - verticalExtra * .75;
    if (!this.arranging) {
      const tray = createUiNode('HomeControlTray'); this.pageRoot.addChild(tray); tray.setPosition(0, trayY, 0);
      paintRoundRect(tray.addComponent(Graphics), 680, 184, 28, hexColor('#FFF8F1', 248), hexColor('#E7CFC3'), 1);
    }
    const actions = createUiNode('HomeActions');
    this.pageRoot.addChild(actions);
    ensureTransform(actions, 680, 72);
    const normalActionsY = this.arranging ? -326 - verticalExtra * .58 : trayY - 37;
    let actionsY = normalActionsY;
    if (this.arranging) {
      const pageLayout = lifePageLayout(this.roots.designWidth, this.roots.designHeight);
      const contentBottom = (-this.roots.designHeight / 2 + LIFE_BOTTOM_RESERVED - pageLayout.y) / pageLayout.scale;
      const panelBottom = Math.max(contentBottom + 12, -537 - verticalExtra);
      const panelTop = panelBottom + 264;
      actionsY = Math.max(normalActionsY, panelTop + 44);
    }
    actions.setPosition(0, actionsY, 0);
    button(actions, this.arranging ? '完成布置' : '调整位置', -218, 0, 204, 68, () => { this.cancelScalePreview(); this.game.clearFurnitureEditHistory(); this.furnitureMessage = '拖动滑条预览，松手保存 · 可撤销本次布置的调整'; this.arranging = !this.arranging; this.selectedFurniture = null; this.render(); }, 'cream');
    const resetOrPhoto = button(actions, this.arranging ? '恢复默认' : '拍照留念', 0, 0, 204, 68, () => {
      if (!this.arranging) { this.takePhoto(); return; }
      if (!this.selectedFurniture) { this.toast('请先点选要恢复的家具'); return; }
      const result = this.game.resetFurniturePosition(this.selectedFurniture);
      if (result.ok) this.furnitureMessage = '已恢复默认，可撤销'; else this.toast('无法恢复家具默认设置'); this.render();
    }, 'cream');
    if (this.arranging) resetOrPhoto.name = 'FurnitureResetAll';
    button(actions, '布置家具', 218, 0, 204, 68, () => this.showCatalog(), 'pink');

    if (this.arranging) this.renderFurnitureTransformControls(verticalExtra);
    else {
      const progress = createUiNode('DecorProgress');
      this.pageRoot.addChild(progress);
      ensureTransform(progress, 664, 76);
      progress.setPosition(0, trayY + 43, 0);
      paintRoundRect(progress.addComponent(Graphics), 664, 76, 22, hexColor('#FFF8F1', 0));
      label(progress, '装扮我们的小屋', -180, 15, 23, 270, hexColor('#8B5358'), true);
      label(progress, decor + '/' + maxDecor, 250, 15, 18, 86, CocosTheme.textSecondary(), true);
      const track = createUiNode('DecorTrack');
      progress.addChild(track);
      track.setPosition(0, -19, 0);
      paintRoundRect(track.addComponent(Graphics), 590, 12, 6, hexColor('#EEDBD4'));
      if (decor > 0) {
        const filled = createUiNode('DecorFilled');
        track.addChild(filled);
        const fillWidth = Math.max(12, 590 * Math.min(1, decor / maxDecor));
        filled.setPosition(-295 + fillWidth / 2, 0, 0);
        paintRoundRect(filled.addComponent(Graphics), fillWidth, 12, 6, hexColor('#E98D9E'));
      }
    }
  }

  private drawFurnitureSelection(views: FurnitureSceneEntry[], layer: Node, area: { width: number; height: number }): void {
    for (const view of views) {
      const old = view.sprite.getChildByName(`FurnitureSelection_${view.item.id}`); old?.removeFromParent(); old?.destroy();
    }
    const old = layer.getChildByName('FurnitureSelectedName'); old?.removeFromParent(); old?.destroy();
    const view = views.find(entry => entry.item.id === this.selectedFurniture); if (!view) return;
    const outline = createUiNode(`FurnitureSelection_${view.item.id}`); view.sprite.addChild(outline); outline.pauseSystemEvents(true);
    paintRoundRect(outline.addComponent(Graphics), view.size.width + 16, view.size.height + 16, 12, hexColor('#FFFFFF', 0), hexColor('#D8678A'), 5);
    const bounds = rotatedFurnitureSize(view.size.width, view.size.height, Math.abs(view.sprite.scale.x), view.sprite.eulerAngles.z);
    const name = createUiNode('FurnitureSelectedName'); layer.addChild(name); ensureTransform(name, 220, 38);
    name.setPosition(Math.max(-area.width / 2 + 112, Math.min(area.width / 2 - 112, view.sprite.position.x)), Math.min(area.height / 2 - 20, view.sprite.position.y + bounds.height / 2 + 26), 0);
    paintRoundRect(name.addComponent(Graphics), 220, 38, 15, hexColor('#FFF8EF'), hexColor('#D8678A'), 2);
    label(name, view.item.title, 0, 0, 21, 208, hexColor('#9D5369'), true); name.pauseSystemEvents(true);
  }

  private showFurniturePicker(candidates: FurnitureSceneEntry[], point: Vec3, scene: Node): void {
    const panel = createUiNode('FurniturePickList'); this.pageRoot.addChild(panel);
    const rowHeight = 96, height = 76 + Math.min(4, candidates.length) * rowHeight;
    ensureTransform(panel, 420, height); panel.addComponent(BlockInputEvents);
    const local = this.pageRoot.getComponent(UITransform)!.convertToNodeSpaceAR(scene.getComponent(UITransform)!.convertToWorldSpaceAR(point));
    const area = homeFurnitureLayout(this.roots.designWidth, this.roots.designHeight);
    panel.setPosition(Math.max(-120, Math.min(120, local.x)), Math.max(-120 + height / 2, Math.min(area.tabsY - 95 - height / 2, local.y)), 0);
    paintRoundRect(panel.addComponent(Graphics), 420, height, 24, hexColor('#FFF9F0'), hexColor('#E0B4B9'), 2);
    label(panel, `这里有 ${candidates.length} 件家具`, -35, height / 2 - 31, 23, 310, hexColor('#93616C'), true);
    const close = button(panel, '×', 174, height / 2 - 31, 54, 52, () => panel.destroy(), 'cream'); close.name = 'FurniturePickClose';
    const viewport = createUiNode('FurniturePickViewport'); panel.addChild(viewport); ensureTransform(viewport, 388, height - 78); viewport.setPosition(0, -31, 0); viewport.addComponent(Mask);
    const content = createUiNode('FurniturePickContent'); viewport.addChild(content); ensureTransform(content, 388, candidates.length * rowHeight, .5, 1); content.setPosition(0, (height - 78) / 2, 0);
    const scroll = viewport.addComponent(ScrollView); scroll.content = content; scroll.horizontal = false; scroll.vertical = true; scroll.elastic = false;
    candidates.forEach((view, index) => {
      const entry = button(content, `${this.selectedFurniture === view.item.id ? '✓ ' : ''}${view.item.title}`, 0, -rowHeight / 2 - index * rowHeight, 376, 88, () => { this.selectedFurniture = view.item.id; this.furnitureMessage = '已选中，可拖动或调整大小与方向'; this.render(); }, this.selectedFurniture === view.item.id ? 'pink' : 'cream');
      entry.name = 'FurniturePick_' + view.item.id;
    });
  }

  private bindFurnitureGestures(scene: Node, layer: Node, views: FurnitureSceneEntry[], area: { width: number; height: number }, sortDepth: () => void): void {
    const surface = createUiNode('FurnitureGestureSurface'); layer.addChild(surface); ensureTransform(surface, area.width, area.height); surface.addComponent(BlockInputEvents);
    const guides = createUiNode('FurnitureSnapGuides'); layer.addChild(guides); ensureTransform(guides, area.width, area.height); const ink = guides.addComponent(Graphics); guides.pauseSystemEvents(true);
    let gesture: { view: FurnitureSceneEntry; candidates: FurnitureSceneEntry[]; start: Vec3; offset: Vec3; moved: boolean } | null = null;
    const pointer = (event: EventTouch): Vec3 => {
      const screen = event.getLocation(), world = new Vec3(), camera = this.roots.camera.getComponent(Camera);
      if (camera) camera.screenToWorld(new Vec3(screen.x, screen.y, 0), world); else { const ui = event.getUILocation(); world.set(ui.x, ui.y, 0); }
      return scene.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    };
    const drawGuides = (x: number | null, y: number | null): void => {
      ink.clear(); guides.active = x !== null || y !== null; ink.strokeColor = hexColor('#DA7C9C', 220); ink.lineWidth = 2;
      if (x !== null) for (let p = -area.height / 2; p < area.height / 2; p += 20) { ink.moveTo(x, p); ink.lineTo(x, Math.min(p + 11, area.height / 2)); }
      if (y !== null) for (let p = -area.width / 2; p < area.width / 2; p += 20) { ink.moveTo(p, y); ink.lineTo(Math.min(p + 11, area.width / 2), y); }
      ink.stroke();
    };
    guides.active = false;
    surface.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      this.pageRoot.getChildByName('FurniturePickList')?.destroy();
      const point = pointer(event);
      const candidates = [...views].reverse().filter(view => furnitureContainsPoint(point, view.sprite.position, view.size, Math.abs(view.sprite.scale.x), view.sprite.eulerAngles.z));
      const view = candidates.find(entry => entry.item.id === this.selectedFurniture) ?? candidates[0];
      if (!view) { gesture = null; this.selectedFurniture = null; this.drawFurnitureSelection(views, layer, area); return; }
      this.selectedFurniture = view.item.id;
      gesture = { view, candidates, start: point, offset: new Vec3(point.x - view.sprite.position.x, point.y - view.sprite.position.y), moved: false };
      this.drawFurnitureSelection(views, layer, area);
    });
    surface.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      if (!gesture) return; const point = pointer(event), { view, start, offset } = gesture;
      if (Math.hypot(point.x - start.x, point.y - start.y) > 6) gesture.moved = true;
      if (!gesture.moved) return;
      const bounds = rotatedFurnitureSize(view.size.width, view.size.height, Math.abs(view.sprite.scale.x), view.sprite.eulerAngles.z);
      const others = views.filter(other => other !== view && other.wall === view.wall).map(other => ({ x: other.sprite.position.x, foot: other.sprite.position.y - other.footOffset }));
      const position = snapFurniturePlacement(point.x - offset.x, point.y - offset.y, bounds.width, bounds.height, others, area);
      view.sprite.setPosition(position.x, position.y, 0); view.shadow?.setPosition(position.x, position.y - view.footOffset, 0);
      drawGuides(position.guideX, position.guideY); sortDepth(); this.drawFurnitureSelection(views, layer, area);
    });
    const finish = (event: EventTouch, cancel: boolean): void => {
      const done = gesture; gesture = null; event.propagationStopped = true; drawGuides(null, null);
      if (!done) { this.render(); return; }
      if (cancel) { this.render(); return; }
      if (done.moved) {
        const result = this.game.moveFurniture(done.view.item.id, done.view.sprite.position.x / area.width + .5, done.view.sprite.position.y / area.height + .5);
        if (result.ok) this.furnitureMessage = '位置已保存，可撤销上一步'; else this.toast('位置保存失败'); this.render();
      } else if (done.candidates.length > 1) { this.render(); this.showFurniturePicker(done.candidates, done.start, this.pageRoot.getChildByName('HomeFurnitureScene')!); }
      else this.render();
    };
    surface.on(Node.EventType.TOUCH_END, (event: EventTouch) => finish(event, false));
    surface.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => finish(event, event.getEventCode() !== Input.EventType.TOUCH_END));
    this.drawFurnitureSelection(views, layer, area);
  }

  private cancelScalePreview(): void {
    if (this.scaleCommitTimer !== null) clearTimeout(this.scaleCommitTimer); this.scaleCommitTimer = null; this.scaleGesture = null;
  }

  private furniturePose(item: FurnitureDefinition, patch: Partial<FurniturePose> = {}) {
    const area = homeFurnitureLayout(this.roots.designWidth, this.roots.designHeight), saved = this.game.life.state.furniturePositions[item.id];
    const art = furnitureArtFor(item, this.game.bundle.furniture.findIndex(entry => entry.id === item.id));
    const size = art.region ? fitPhoto(art.region.width, art.region.height, item.placement.width, item.placement.height) : item.placement;
    return constrainFurniturePose({ x: saved?.x ?? item.placement.x / area.width + .5, y: saved?.y ?? item.placement.y / area.height + .5,
      scale: saved?.scale ?? 1, rotation: saved?.rotation ?? 0, flipped: saved?.flipped ?? false, ...patch }, size, area);
  }

  private renderFurnitureTransformControls(verticalExtra: number): void {
    const panel = createUiNode('FurnitureTransformControls');
    this.pageRoot.addChild(panel);
    const pageLayout = lifePageLayout(this.roots.designWidth, this.roots.designHeight);
    const contentBottom = (-this.roots.designHeight / 2 + LIFE_BOTTOM_RESERVED - pageLayout.y) / pageLayout.scale;
    const panelBottom = Math.max(contentBottom + 12, -537 - verticalExtra);
    const panelCenter = panelBottom + 132;
    ensureTransform(panel, 664, 264);
    panel.setPosition(0, panelCenter, 0);
    paintRoundRect(panel.addComponent(Graphics), 664, 264, 24, hexColor('#FFF8F1', 246), hexColor('#E7BDB5'), 2);
    const item = this.game.bundle.furniture.find((entry) => entry.id === this.selectedFurniture);
    const saved = item ? this.game.life.state.furniturePositions[item.id] : undefined;
    const scale = saved?.scale ?? 1;
    const rotation = saved?.rotation ?? 0;
    const flipped = saved?.flipped ?? false;
    const description = item
      ? `${item.title}  ·  ${Math.round(scale * 100)}%  ·  ${rotation}°  ·  ${flipped ? '已翻转' : '未翻转'}`
      : '点选当前房间的一件家具，再拖动或调整大小与方向';
    const status = label(panel, description, -80, 102, 20, 450, hexColor('#8B5358'), true); status.node.name = 'FurnitureTransformStatus';
    const undoState = this.game.getFurnitureUndoState(this.homeRoom);
    const undo = button(panel, '撤销上一步', 250, 102, 144, 58, () => {
      this.cancelScalePreview(); const result = this.game.undoFurnitureEdit(this.homeRoom);
      if (result.ok) this.selectedFurniture = result.furnitureId;
      if (result.ok) this.furnitureMessage = '已撤销上一步'; else this.toast(result.reason === 'STATE_CHANGED' ? '家具状态已变化，不能撤销这一步' : '还没有可以撤销的调整'); this.render();
    }, 'cream');
    undo.name = 'FurnitureUndo'; undo.getComponent(Button)!.interactable = !!undoState; ensureOpacity(undo).opacity = undoState ? 255 : 110;
    const selectedTone = item ? 'cream' : 'sage';
    const change = (patch: { scale?: number; rotation?: number; flipped?: boolean }): void => {
      if (!item) { this.toast('请先点选当前房间中已摆放的家具'); return; }
      this.updateFurnitureTransform(item, patch);
    };
    const controls: Array<{ name: string; title: string; x: number; onTap: () => void }> = [
      { name: 'FurnitureScaleDown', title: '−\n缩小', x: -260, onTap: () => change({ scale: Math.max(0.5, Math.round((scale - 0.1) * 10) / 10) }) },
      { name: 'FurnitureScaleUp', title: '+\n放大', x: -130, onTap: () => change({ scale: Math.min(1.8, Math.round((scale + 0.1) * 10) / 10) }) },
      { name: 'FurnitureRotateLeft', title: '↶\n左转', x: 0, onTap: () => change({ rotation: ((rotation + 15 + 180 + 360) % 360) - 180 }) },
      { name: 'FurnitureRotateRight', title: '↷\n右转', x: 130, onTap: () => change({ rotation: ((rotation - 15 + 180 + 360) % 360) - 180 }) },
      { name: 'FurnitureFlipHorizontal', title: '⇄\n翻转', x: 260, onTap: () => change({ flipped: !flipped }) },
    ];
    const controlNodes = new Map<string, Node>();
    controls.forEach(({ name, title, x, onTap }) => {
      const node = button(panel, title, x, -64, 124, 88, onTap, selectedTone);
      node.name = name;
      controlNodes.set(name, node);
      const caption = node.getComponentInChildren(Label);
      if (caption) {
        caption.fontSize = 27;
        caption.lineHeight = 30;
        ensureTransform(caption.node, 112, 80);
      }
    });
    const value = label(panel, `${Math.round(scale * 100)}%`, 254, 32, 26, 124, hexColor('#A35B72'), true); value.node.name = 'FurnitureScaleValue';
    const sliderNode = createUiNode('FurnitureScaleSlider'); panel.addChild(sliderNode); ensureTransform(sliderNode, 470, 80); sliderNode.setPosition(-65, 32, 0);
    paintRoundRect(sliderNode.addComponent(Graphics), 470, 12, 6, hexColor('#E9D6CB'));
    const fill = createUiNode('FurnitureScaleFill'); sliderNode.addChild(fill); const fillInk = fill.addComponent(Graphics);
    const handle = createUiNode('FurnitureScaleHandle'); sliderNode.addChild(handle); ensureTransform(handle, 76, 76);
    const thumb = createUiNode('FurnitureScaleThumb'); handle.addChild(thumb); paintRoundRect(thumb.addComponent(Graphics), 48, 58, 20, hexColor('#FFFCF6'), hexColor('#D58099'), 3); thumb.pauseSystemEvents(true);
    const handleSprite = handle.addComponent(Sprite), slider = sliderNode.addComponent(Slider); slider.enabled = false; slider.handle = handleSprite; slider.direction = Slider.Direction.Horizontal; slider.progress = furnitureScaleProgress(scale);
    const refresh = (nextScale: number): void => {
      value.string = `${Math.round(nextScale * 100)}%`;
      status.string = item ? `${item.title}  ·  ${Math.round(nextScale * 100)}%  ·  ${rotation}°  ·  ${flipped ? '已翻转' : '未翻转'}` : description;
      const width = Math.max(1, slider.progress * 470); paintRoundRect(fillInk, width, 12, 6, hexColor('#D58099')); fill.setPosition(-235 + width / 2, 0, 0);
      for (const [name, node] of controlNodes) {
        const enabled = !!item && !(name === 'FurnitureScaleDown' && nextScale <= FURNITURE_SCALE.min) && !(name === 'FurnitureScaleUp' && nextScale >= FURNITURE_SCALE.max);
        node.getComponent(Button)!.interactable = enabled; ensureOpacity(node).opacity = enabled ? 255 : 105;
      }
    };
    slider.enabled = !!item; ensureOpacity(sliderNode).opacity = item ? 255 : 105; refresh(scale);
    label(panel, this.furnitureMessage, 0, -122, 18, 620, hexColor('#A58A7D'));
    sliderNode.on(Node.EventType.TOUCH_START, () => {
      if (!item) return; this.cancelScalePreview(); this.scaleGesture = { id: item.id, value: scale };
    }, undefined, true);
    sliderNode.on('slide', () => {
      if (!item || this.scaleGesture?.id !== item.id) return;
      const next = furnitureScaleFromProgress(slider.progress); this.scaleGesture.value = next;
      this.previewFurniture?.(item.id, this.furniturePose(item, { scale: next })); refresh(next);
    });
    const finish = (cancel: boolean): void => {
      const pending = this.scaleGesture; this.scaleGesture = null; if (!pending || !item) return;
      this.scaleCommitTimer = setTimeout(() => {
        this.scaleCommitTimer = null;
        if (!isValid(sliderNode, true) || this.page !== 'home' || !this.arranging || this.selectedFurniture !== pending.id) return;
        if (cancel || Math.abs((this.game.life.state.furniturePositions[pending.id]?.scale ?? 1) - pending.value) < .0001) this.render();
        else this.updateFurnitureTransform(item, { scale: pending.value });
      }, 0);
    };
    sliderNode.on(Node.EventType.TOUCH_END, () => finish(false), undefined, true);
    sliderNode.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => finish(event.getEventCode() !== Input.EventType.TOUCH_END), undefined, true);
  }

  private updateFurnitureTransform(item: FurnitureDefinition, patch: { scale?: number; rotation?: number; flipped?: boolean }): void {
    const result = this.game.setFurnitureTransform(item.id, this.furniturePose(item, patch));
    if (result.ok) this.furnitureMessage = '大小与方向已保存，可撤销'; else this.toast(result.reason === 'NOT_READY' ? '调整未完成，请重试' : '这件家具当前无法调整');
    this.render();
  }

  private renderRoomTabs(): void {
    const tabs = createUiNode('HomeRoomTabs');
    this.pageRoot.addChild(tabs);
    ensureTransform(tabs, 620, 78);
    tabs.setPosition(0, homeFurnitureLayout(this.roots.designWidth, this.roots.designHeight).tabsY, 0);
    const rooms: Array<[HomeRoom, string]> = [['living', '客厅'], ['bedroom', '卧室'], ['garden', '花园'], ['study', '书房'], ['terrace', '露台'], ['pool', '泳池']];
    const visible = rooms.slice(this.roomPage * 3, this.roomPage * 3 + 3);
    paintRoundRect(tabs.addComponent(Graphics), 620, 78, 30, hexColor('#FFF8EE', 240), hexColor('#E6D0BE'), 2);
    visible.forEach(([room, title], index) => button(tabs, title, -204 + index * 170, 0, 158, 64, () => {
      this.homeRoom = room; this.selectedFurniture = null;
      this.render();
    }, this.homeRoom === room ? 'pink' : 'cream'));
    button(tabs, this.roomPage ? '‹' : '›', 246, 0, 90, 64, () => { this.roomPage = 1 - this.roomPage; this.render(); });
  }

  private syncHomeBackdrop(): void {
    for (const room of ['living', 'bedroom', 'garden', 'study', 'terrace', 'pool'] as const) {
      this.homeBackdrops[room].active = this.page === 'home' && this.homeRoom === room;
    }
  }

  private pager(pages: number, current: () => number, set: (page: number) => void): void {
    if (pages <= 1) return;
    const y = -461 - journalLayout(this.roots.designWidth, this.roots.designHeight).extra;
    button(this.pageRoot, '上一页', -215, y, 144, 64, () => set((current() - 1 + pages) % pages), 'cream');
    label(this.pageRoot, (current() + 1) + ' / ' + pages, 0, y, 22, 140, CocosTheme.textSecondary());
    button(this.pageRoot, '下一页', 215, y, 144, 64, () => set((current() + 1) % pages), 'cream');
  }

  private modalPanel(root: Node, name: string): Node {
    clear(root);
    const furniture=name==='FurniturePanel',height=furniture?620:914;
    paintRoundRect(root.getComponent(Graphics) ?? root.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', furniture?65:160));
    const panel = createUiNode(name);
    root.addChild(panel);
    ensureTransform(panel, 690, height);
    const scale = Math.min(1, (this.roots.designHeight - 150) / height, (this.roots.designWidth - 28) / 690);
    panel.setScale(scale, scale, 1);
    if (furniture) panel.setPosition(0,-this.roots.designHeight/2+height*scale/2+126,0);
    paintRoundRect(panel.addComponent(Graphics),690,height,30,hexColor('#FFF9F3'),hexColor('#F5D7CD'),2);
    applyMaterialFrame(panel,'paper',690,height,.70);
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
    button(panel, '今日约会 · 剧情与解谜 ›', 0, 326, 590, 64, () => this.openAdventure?.(), 'pink');
    button(panel, '关闭', 275, 395, 100, 68, () => {
      this.taskRoot.active = false;
      this.renderNav();
    });
    const first = this.wishPage * 4;
    this.game.bundle.wishes.slice(first, first + 4).forEach((wish, index) => {
      this.wishCard(panel, wish, 211 - index * 157);
    });
    const pages = Math.ceil(this.game.bundle.wishes.length / 4);
    button(panel, '‹', -145, -392, 128, 64, () => {
      this.wishPage = (this.wishPage - 1 + pages) % pages;
      this.renderTasks();
    });
    label(panel, (this.wishPage + 1) + ' / ' + pages, 0, -392, 20, 90, CocosTheme.textSecondary());
    button(panel, '›', 145, -392, 128, 64, () => {
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
    paintRoundRect(card.addComponent(Graphics), 626, 132, 20, claimed ? hexColor('#F2EFE5') : hexColor('#FFF0EA'), hexColor('#F1D9D0'));
    label(card, wish.title, -139, 35, 23, 290, CocosTheme.textPrimary(), true);
    label(card, progress + '/' + wish.target, 86, 35, 19, 90, CocosTheme.textSecondary());
    label(card, '金币 +' + wish.rewardCoins + ' · 爱心 +' + wish.rewardHearts, -105, wish.generatorReward?5:-5, 21, 360, CocosTheme.textSecondary());
    if(wish.generatorReward){const gift=wish.generatorReward,name=this.game.generators.get(gift.generatorId)?.displayName??'生成器';label(card,name+' Lv'+gift.level+' ×'+gift.count,-105,-24,19,360,hexColor('#A37B45'));}
    const track = createUiNode('WishProgress'); card.addChild(track); track.setPosition(-105, -44, 0);
    paintRoundRect(track.addComponent(Graphics), 358, 10, 5, hexColor('#EAD8CF'));
    if (progress > 0) {
      const fill = createUiNode('WishProgressFill'); track.addChild(fill);
      const filled = 358 * Math.min(1, progress / wish.target); fill.setPosition(-179 + filled / 2, 0, 0);
      paintRoundRect(fill.addComponent(Graphics), filled, 10, 5, hexColor(claimed ? '#A6B99A' : '#E997A6'));
    }
    button(card, claimed ? '已领取' : progress >= wish.target ? '领取奖励' : '进行中', 221, 0, 144, 76, () => {
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
    label(panel,'家具与壁画目录',-70,270,31,470,hexColor('#8B5358'),true);
    label(panel,'挑选家具，摆进喜欢的房间',0,218,20,580,CocosTheme.textSecondary());
    button(panel, '关闭', 275, 270, 100, 64, () => {
      this.catalogRoot.active = false;
      this.renderNav();
    });
    const categories = ['全部', '客厅', '卧室', '花园', '书房', '露台', '泳池', '壁画'];
    categories.forEach((name, index) => button(panel, name,-240+(index%4)*160,164-Math.floor(index/4)*68,148,58, () => {
      this.category = name;
      this.furniturePage = 0;
      this.renderCatalog();
    }, this.category === name ? 'pink' : 'cream'));
    const filtered = this.game.bundle.furniture.filter((item) => this.category === '全部' || item.category === this.category);
    const pages = Math.max(1, Math.ceil(filtered.length / 4));
    this.furniturePage = Math.min(this.furniturePage, pages - 1);
    filtered.slice(this.furniturePage * 4, this.furniturePage * 4 + 4).forEach((item, offset) => {
      const index = this.game.bundle.furniture.findIndex((entry) => entry.id === item.id);
      this.furnitureCard(panel,item,index,-246+offset*164,-88);
    });
    if (filtered.length === 0) label(panel, '这里暂时没有家具', 0, 0, 23, 450, CocosTheme.textSecondary());
    if (pages > 1) {
      button(panel, '‹', -145, -278, 114, 52, () => {
        this.furniturePage = (this.furniturePage - 1 + pages) % pages;
        this.renderCatalog();
      });
      label(panel, (this.furniturePage + 1) + ' / ' + pages, 0, -278, 20, 90, CocosTheme.textSecondary());
      button(panel, '›', 145, -278, 114, 52, () => {
        this.furniturePage = (this.furniturePage + 1) % pages;
        this.renderCatalog();
      });
    } else {
      label(panel, '共 ' + filtered.length + ' 件家具', 0, -278, 20, 240, CocosTheme.textSecondary());
    }
  }

  private furnitureCard(parent: Node, item: FurnitureDefinition, index: number, x: number, y: number): void {
    const owned = this.game.life.state.ownedFurnitureIds.includes(item.id);
    const placed = this.game.life.state.placedFurnitureIds.includes(item.id);
    const locked = this.game.player.level < item.unlockLevel;
    const card = createUiNode('Furniture_' + item.id);
    parent.addChild(card);
    ensureTransform(card,154,300);
    card.setPosition(x, y, 0);
    paintRoundRect(card.addComponent(Graphics),154,300,18,hexColor('#FFF4E3'),hexColor(placed?'#B3C299':'#E2CBB0'),placed?2:1);
    const icon = createUiNode('FurnitureArt');
    card.addChild(icon);
    icon.setPosition(0,73,0);ensureOpacity(icon).opacity=locked?150:255;
    applyFurnitureArt(icon,item,index,item.art.startsWith('wall:')?112:138,138);
    label(card,item.title,0,-18,22,146,CocosTheme.textPrimary(),true);
    label(card,locked?'Lv'+item.unlockLevel+' 解锁':owned?'装修 +'+item.decorPoints:'金币 '+item.coinCost,0,-61,16,146,CocosTheme.textSecondary());
    const action=locked?'未解锁':owned?placed?'收起':'摆放':'购买';
    button(card,action,0,-112,136,54, () => {
      if (locked) { this.toast('达到 Lv' + item.unlockLevel + ' 后解锁'); return; }
      const result = owned ? this.game.placeFurniture(item.id) : this.game.buyFurniture(item.id);
      if (result.ok) {
        this.homeRoom = item.room;
        this.roomPage = item.room === 'study' || item.room === 'terrace' || item.room === 'pool' ? 1 : 0;
        this.catalogRoot.active = false;
        this.toast(owned ? placed ? '家具已收起' : '家具已摆放' : '新家具已摆放 ♥');
        this.render();
      } else {
        this.toast('金币不足，完成订单和心愿可获得');
      }
    },locked?'cream':owned&&placed?'sage':'pink');
  }
}
