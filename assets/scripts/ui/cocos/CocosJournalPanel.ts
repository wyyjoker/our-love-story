import { BlockInputEvents, Button, EditBox, Graphics, Label, Node, ScrollView, Mask } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { chooseJournalPhoto } from '../../platform/cocos/CocosPhotoService';
import { applyLocalPhoto } from './CocosArt';
import { createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function text(parent: Node, value: string, x: number, y: number, width: number, height: number, size = 22): Label {
  const l = makeLabel(value, size, hexColor('#79564D')); parent.addChild(l.node); ensureTransform(l.node, width, height); l.node.setPosition(x,y,0); l.enableWrapText = true; l.overflow = Label.Overflow.SHRINK; return l;
}
function button(parent: Node, name: string, caption: string, x: number, y: number, w: number, h: number, action: () => void): Node {
  const n = createUiNode(name); parent.addChild(n); ensureTransform(n,w,h); n.setPosition(x,y,0);
  paintRoundRect(n.addComponent(Graphics),w,h,22,hexColor('#E997A7'));
  text(n,caption,0,0,w-12,h-6,24).color=hexColor('#FFFFFF'); n.addComponent(Button); n.on(Button.EventType.CLICK,action); return n;
}

/** A personal diary is separate from the authored story memories. */
export class CocosJournalPanel {
  private readonly root: Node;
  private readonly panel: Node;
  private readonly editor: EditBox;
  private readonly finishEditing: Node;
  private readonly picture: Node;
  private readonly status: Label;
  private readonly saveCaption: Label;
  private readonly history: Node;
  private readonly historyContent: Node;
  private photoPath = '';
  private choosing = false;
  private disposed = false;

  constructor(private readonly game: GameContext, roots: UiRoots, private readonly feedback: (message: string, success?: boolean) => void, private readonly onClose?: () => void) {
    this.root=createUiNode('JournalOverlay'); roots.modalLayer.addChild(this.root); ensureTransform(this.root,roots.designWidth,roots.designHeight);
    this.root.addComponent(BlockInputEvents); paintRoundRect(this.root.addComponent(Graphics),roots.designWidth,roots.designHeight,0,hexColor('#362B2B',180)); this.root.active=false;
    this.panel=createUiNode('JournalPanel'); this.root.addChild(this.panel); ensureTransform(this.panel,680,1040);
    const scale=Math.min(1,(roots.designHeight-30)/1040,(roots.designWidth-24)/680); this.panel.setScale(scale,scale,1);
    paintRoundRect(this.panel.addComponent(Graphics),680,1040,30,hexColor('#FFF8F1'),hexColor('#EDD9CD'),2);
    const heading=text(this.panel,'今日日记',-110,465,360,58,33); heading.isBold=true;
    button(this.panel,'JournalClose','关闭',265,465,104,68,()=>this.close());
    this.status=text(this.panel,'',0,402,610,62,23);
    const field=createUiNode('JournalEditor'); this.panel.addChild(field); ensureTransform(field,600,180); field.setPosition(0,270,0);
    paintRoundRect(field.addComponent(Graphics),600,180,20,hexColor('#FFFFFF'),hexColor('#E7D3C8'),2);
    this.editor=field.addComponent(EditBox); this.editor.inputMode=EditBox.InputMode.ANY; this.editor.maxLength=2000;
    this.editor.textLabel=text(field,'',0,0,564,154,25); this.editor.textLabel.horizontalAlign=Label.HorizontalAlign.LEFT; this.editor.textLabel.verticalAlign=Label.VerticalAlign.TOP;
    ensureTransform(this.editor.textLabel.node,564,154,0,1); this.editor.textLabel.node.setPosition(-288,78,0); this.editor.textLabel.overflow=Label.Overflow.CLAMP;
    this.editor.placeholderLabel=text(field,'写下今天想留给彼此的话……',0,0,564,154,25); this.editor.placeholderLabel.horizontalAlign=Label.HorizontalAlign.LEFT; this.editor.placeholderLabel.verticalAlign=Label.VerticalAlign.TOP;
    ensureTransform(this.editor.placeholderLabel.node,564,154,0,1); this.editor.placeholderLabel.node.setPosition(-288,78,0); this.editor.placeholderLabel.overflow=Label.Overflow.CLAMP;
    this.editor.placeholderLabel.color=hexColor('#B29A91');
    this.finishEditing=button(this.panel,'JournalFinishEditing','写好了 · 收起键盘',200,155,200,48,()=>this.editor.blur());
    paintRoundRect(this.finishEditing.getComponent(Graphics)!,200,48,18,hexColor('#F3E7DE'),hexColor('#E7D3C8'),1);
    this.finishEditing.getComponentInChildren(Label)!.color=hexColor('#79564D'); this.finishEditing.active=false;
    field.on(EditBox.EventType.EDITING_DID_BEGAN,()=>{this.finishEditing.active=true;});
    field.on(EditBox.EventType.EDITING_DID_ENDED,()=>{this.finishEditing.active=false;});
    this.picture=createUiNode('JournalPhoto'); this.panel.addChild(this.picture); ensureTransform(this.picture,410,200); this.picture.setPosition(0,30,0);
    paintRoundRect(this.picture.addComponent(Graphics),410,200,20,hexColor('#F3E7DE'));
    button(this.panel,'JournalChoosePhoto','添加 / 更换照片',0,-105,300,60,()=>{void this.choosePhoto();});
    const save=button(this.panel,'JournalSave','保存并领取体力',0,-177,360,66,()=>this.save()); this.saveCaption=save.getComponentInChildren(Label)!;
    text(this.panel,'文字与照片仅保存在本机；每天可领取一次奖励。',0,-238,610,48,22);
    const historyTitle=text(this.panel,'之前的日记',0,-287,540,38,25); historyTitle.isBold=true;
    this.history=createUiNode('JournalHistoryViewport'); this.panel.addChild(this.history); ensureTransform(this.history,608,170); this.history.setPosition(0,-400,0); this.history.addComponent(Mask);
    this.historyContent=createUiNode('JournalHistoryContent'); this.history.addChild(this.historyContent); ensureTransform(this.historyContent,600,170,0.5,1); this.historyContent.setPosition(0,85,0);
    const scroll=this.history.addComponent(ScrollView); scroll.horizontal=false; scroll.vertical=true; scroll.content=this.historyContent;
  }

  get isOpen(): boolean { return this.root.active; }
  open(): void {
    const current=this.game.getTodayJournal(); this.editor.string=current?.text??''; this.photoPath=current?.photoPath??'';
    this.finishEditing.active=false;this.root.active=true; this.render();
  }
  close(): void { this.editor.blur();this.finishEditing.active=false;this.root.active=false; this.onClose?.(); }
  private async choosePhoto(): Promise<void> {
    if(this.choosing)return; this.choosing=true;
    try { const result=await chooseJournalPhoto(); if(this.disposed||!this.isOpen)return;
      if(result.ok){this.photoPath=result.path;this.renderPhoto();}else this.feedback(result.reason);
    } finally { this.choosing=false; }
  }
  private renderPhoto(): void {
    for(const child of [...this.picture.children])child.destroy();
    if(this.photoPath){const art=createUiNode('JournalPhotoArt');this.picture.addChild(art);applyLocalPhoto(art,this.photoPath,400,194,(state)=>{if(state==='failed')this.feedback('照片暂时无法读取，请重新选择');});}
    else text(this.picture,'为今天添一张照片 ♡',0,0,380,80,24);
  }
  private save(): void {
    const result=this.game.saveTodayJournal(this.editor.string,this.photoPath);
    if(!result.ok){this.feedback(result.reason==='NEED_TEXT'?'请先写一点今天的日记':result.reason==='NEED_PHOTO'?'再添一张照片，就可以保存并领奖啦':'日记最多 2000 字');return;}
    this.feedback(result.rewarded?`今日日记已珍藏！体力 +${result.energy}（可溢出）`:'日记已更新，今日奖励已经领取',true);this.render();
  }
  private render(): void {
    const current=this.game.getTodayJournal();
    this.status.string=current?.rewarded?'今日体力奖励已领取，仍可修改文字和照片':`写日记并添加照片，领取 +${this.game.player.maxEnergy} 体力\n奖励可以超过当前上限`;
    this.saveCaption.string=current?.rewarded?'更新今日日记':'保存并领取体力'; this.renderPhoto();
    for(const child of [...this.historyContent.children])child.destroy();
    const entries=this.game.getJournalEntries();
    if(!entries.length)text(this.historyContent,'把我们的日常，一点点收藏起来。',0,-60,580,80,23);
    let y=-55;
    for(const entry of entries){
      const day=new Date(entry.day*86400000).toISOString().slice(0,10);
      const row=button(this.historyContent,`JournalHistory_${entry.day}`,`${day}　${entry.text.slice(0,16)}${entry.text.length>16?'…':''}`,0,y,580,86,()=>this.preview(entry.text,entry.photoPath,day));
      paintRoundRect(row.getComponent(Graphics)!,580,86,20,hexColor('#F6E9E2'),hexColor('#EAD4C9'),1);
      const caption=row.getComponentInChildren(Label)!; caption.fontSize=23; caption.color=hexColor('#79564D'); y-=98;
    }
    ensureTransform(this.historyContent,600,Math.max(170,-y+40),0.5,1);this.historyContent.setPosition(0,85,0);this.history.getComponent(ScrollView)?.scrollToTop(0);
  }
  private preview(body: string,path: string,day: string): void {
    const overlay=createUiNode('JournalReadOverlay');this.root.addChild(overlay);ensureTransform(overlay,680,1000);overlay.addComponent(BlockInputEvents);overlay.setScale(this.panel.scale);
    paintRoundRect(overlay.addComponent(Graphics),680,1000,28,hexColor('#FFF8F1'));
    const heading=text(overlay,day,-38,445,440,55,30);heading.isBold=true;button(overlay,'JournalReadClose','返回',265,445,104,68,()=>overlay.destroy());
    const pic=createUiNode('JournalReadPhoto');overlay.addChild(pic);pic.setPosition(0,215,0);applyLocalPhoto(pic,path,570,350);
    const viewport=createUiNode('JournalReadViewport');overlay.addChild(viewport);ensureTransform(viewport,600,430);viewport.setPosition(0,-210,0);viewport.addComponent(Mask);
    const height=Math.max(430,Math.ceil(body.length/22)*32+48);const content=createUiNode('JournalReadContent');viewport.addChild(content);ensureTransform(content,580,height,0.5,1);content.setPosition(0,215,0);
    const paragraph=text(content,body,0,-height/2,570,height,24);paragraph.horizontalAlign=Label.HorizontalAlign.LEFT;paragraph.verticalAlign=Label.VerticalAlign.TOP;paragraph.lineHeight=32;
    const scroll=viewport.addComponent(ScrollView);scroll.horizontal=false;scroll.vertical=true;scroll.content=content;
  }
  dispose(): void { this.disposed=true;this.root.destroy(); }
}
