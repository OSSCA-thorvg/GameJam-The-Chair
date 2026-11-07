import { init, type Canvas, type Shape, type ThorVGNamespace } from '@thorvg/webcanvas';
import wasmUrl from '../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';
import markup from './scene.html?raw';
import './style.css';

type Point = { x: number; y: number };
type Vector = [number, number];
type Curve = [number, number, number, number, number, number];
type Color = [number, number, number, number];
type Gradient = { from: Vector; to: Vector; stops: [number, Color][] };
type DrawCommand = { v: Vector[]; curves?: Curve[]; c: string | Gradient };
type Player = { x: number; y: number; vx: number; vy: number; a: number; w: number };
type Snapshot = { p: Player; cam: number; wheel: number };
type Reaction = { text: string; face: string; life: number; priority: number };
type Speech = { text: string; name: string; x: number; life: number };
type Person = { x: number; name: string; text: string; said: boolean };
type Paper = { x: number; y: number; vx: number; vy: number; a: number; w: number; life: number; hit: boolean; landed: boolean; volley: number };
type Speck = { x: number; y: number; vx: number; vy: number; a: number; life: number; color: string };
type WaterDrop = { x: number; y: number; vx: number; vy: number; life: number; r: number; landed: boolean };
type WaterRipple = { x: number; age: number; life: number; r: number };
type Input = 'left' | 'right' | 'brake' | 'q' | 'e';

function required<T>(value: T | null): T {
  if (value === null) throw new Error('Required game element or canvas context is unavailable.');
  return value;
}

required(document.querySelector('#app')).innerHTML = markup;

(()=>{
const root=required(document.getElementById('chair-office-one'));
const q=<T extends HTMLElement = HTMLElement>(s: string): T=>required(root.querySelector<T>(s));
const base=q<HTMLCanvasElement>('[data-base]'),cn=q<HTMLCanvasElement>('[data-tvg]'),labels=q<HTMLCanvasElement>('[data-labels]'),bg=required(base.getContext('2d')),lg=required(labels.getContext('2d'));
const F=420,LEN=2600,GOAL=2440,clamp=(v: number,a: number,b: number)=>Math.max(a,Math.min(b,v)),TAU=Math.PI*2;
const monitor={desk:2210,x:2281,y:275,wall:2110,period:4.8};
const copier={x:550,cool:0,burst:0,next:0,dir:-1,flash:0},cleaning={x:945,a:885,b:1210,spilled:false,age:0,followup:false,splashDir:0},bin={x:1660,a:1580,b:1740,rim:402,bottom:520};
// The chair contact model and rotational impulses are retained from the earlier prototype.
const parts=[{x:-26,y:19,r:9,wheel:true},{x:26,y:19,r:9,wheel:true},{x:-21,y:-12,r:10},{x:21,y:-11,r:10},{x:-20,y:-38,r:11},{x:33,y:-2,r:8},{x:-7,y:-49,r:12},{x:0,y:-77,r:12,head:true}];
let W=800,H=510,scale=1,VW=800,vertical=0,dpr=1,cam=0,mode='intro',p: Player={x:100,y:F-28,vx:0,vy:0,a:0,w:0},keys=new Set<Input>(),ground=false,coyote=0,jumpQ=0,time=0,t=0,last=0,acc=0,deaths=0,dirty=false,inBin=false,binAge=0,binCooldown=0,escapeDir=1,escapeQueued=false,slip=false,wetSeen=false,slipCooldown=0,papers: Paper[]=[],specks: Speck[]=[],paperFace=0,paperHits=0,bursts=0,binFalls=0,history: Snapshot[]=[],impact: { frames: Snapshot[]; elapsed: number; point: Point } | null=null,reaction: Reaction | null=null,speech: Speech | null=null,rollCooldown=0,reverseCooldown=0,people: Person[]=[],solids: { p: Point[] }[]=[],commands: DrawCommand[]=[],pool: Shape[]=[],TVG: ThorVGNamespace | null=null,tvg: Canvas | null=null,renderer='canvas2d',renderError: string | null=null,wheel=0,waterDrops: WaterDrop[]=[],waterRipples: WaterRipple[]=[],soaked=false,glare=0,lightHits=0,lightCooldown=0,focus=100,focusClock=0,focusEvents=new Set<string>(),focusNotice: { text: string; life: number } | null=null,volley=0,lossReason: string | null=null,focusLossTime=0;
function polyRect(x: number,y: number,w: number,h: number){return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
function build(){solids=[{p:polyRect(-400,F,bin.a+400,350)},{p:polyRect(bin.b,F,LEN-bin.b+400,350)}];people=[{x:320,name:'박 과장',text:'벌써 퇴근하는 거야?',said:false},{x:1000,name:'김 대리',text:'앗, 청소 물통 넘어간다!',said:false},{x:1810,name:'총무팀',text:'쓰레기 분리배출 부탁드려요.',said:false}];}
function size(){W=Math.max(300,base.clientWidth||800);H=base.clientHeight||510;VW=Math.max(760,W);scale=W/VW;vertical=Math.max(0,H/scale-510)*.7;dpr=Math.min(devicePixelRatio||1,2);for(const c of [base,labels]){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}if(tvg)tvg.resize(W,H);draw();}new ResizeObserver(size).observe(base);
function say(text: string,face='😵',life=3.2,priority=0){if(reaction&&reaction.life>0&&(reaction.priority||0)>priority)return;reaction={text,face,life,priority};q('[data-status]').textContent=text;}
function npc(text: string,name='박 과장',x=people[0]?.x||320){speech={text,name,x,life:3.4};}
function save(){try{localStorage.setItem('the-chair-office-v1',JSON.stringify({deaths}));}catch{ /* Private browsing may disable local storage. */ }}
function overlay(k: string,title: string,desc: string,button: string){q('[data-kicker]').textContent=k;q('[data-title]').innerHTML=title;q('[data-desc]').innerHTML=desc;q('[data-start]').textContent=button;q('[data-overlay]').hidden=false;}
function reset(){build();p={x:100,y:F-28,vx:0,vy:0,a:0,w:0};keys.clear();ground=false;coyote=0;jumpQ=0;escapeQueued=false;cam=0;time=0;t=0;acc=0;dirty=false;inBin=false;binAge=0;binCooldown=0;slip=false;wetSeen=false;slipCooldown=0;papers=[];specks=[];paperFace=0;paperHits=0;bursts=0;binFalls=0;history=[];impact=null;reaction=null;speech=null;rollCooldown=0;reverseCooldown=0;wheel=0;focus=100;focusClock=0;focusEvents.clear();focusNotice=null;volley=0;lossReason=null;focusLossTime=0;waterDrops=[];waterRipples=[];soaked=false;Object.assign(cleaning,{spilled:false,age:0,followup:false});glare=0;lightHits=0;lightCooldown=0;Object.assign(copier,{cool:0,burst:0,next:0,flash:0});mode='play';q('[data-overlay]').hidden=true;q('[data-pause]').textContent='일시정지 P';q('[data-status]').textContent='오른쪽 사무실 출입문까지. 아직은 발로 굴러갑니다.';save();}
function jump(){if(mode!=='play')return;jumpQ=.14;}
function pause(){if(mode!=='play'&&mode!=='pause')return;mode=mode==='play'?'pause':'play';keys.clear();acc=0;q('[data-pause]').textContent=mode==='pause'?'계속 P':'일시정지 P';}
q<HTMLButtonElement>('[data-start]').onclick=reset;q<HTMLButtonElement>('[data-reset]').onclick=()=>{if(mode==='play')deaths++;reset();};q<HTMLButtonElement>('[data-pause]').onclick=pause;
const km: Partial<Record<string, Input>>={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowDown:'brake',s:'brake',S:'brake',q:'q',Q:'q',e:'e',E:'e'};
window.addEventListener('keydown',e=>{if(!root.isConnected||(e.target instanceof Element&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))return;const k=km[e.key];if(k||e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();if(k&&mode==='play')keys.add(k);if(!e.repeat&&(e.code==='Space'||e.key==='ArrowUp'))jump();}if(!e.repeat&&e.key.toLowerCase()==='r'){if(mode==='play')deaths++;reset();}if(!e.repeat&&e.key.toLowerCase()==='p')pause();});window.addEventListener('keyup',e=>{const k=km[e.key];if(k)keys.delete(k);});window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
root.querySelectorAll<HTMLElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();if(mode!=='play')return;keys.add(b.dataset.key as Input);b.setPointerCapture(e.pointerId);};for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(b.dataset.key as Input));});q('[data-jump]').onpointerdown=e=>{e.preventDefault();jump();};
function contact(cx: number,cy: number,r: number,poly: Point[]){let best=Infinity,nx=0,ny=0,inside=true;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b.x-a.x,ey=b.y-a.y,den=ex*ex+ey*ey,u=clamp(((cx-a.x)*ex+(cy-a.y)*ey)/den,0,1),dx=cx-a.x-u*ex,dy=cy-a.y-u*ey,d=Math.hypot(dx,dy);if(ex*(cy-a.y)-ey*(cx-a.x)<0)inside=false;if(d<best){best=d;nx=d>.00001?dx/d:ey/Math.sqrt(den);ny=d>.00001?dy/d:-ex/Math.sqrt(den);}}return inside?{nx:-nx,ny:-ny,depth:r+best}:best<r?{nx,ny,depth:r-best}:null;}
function snapshot(){return {p:{...p},cam,wheel};}
function fail(point: Point){if(mode!=='play'||inBin)return;deaths++;lossReason='head';keys.clear();impact={frames:history.slice(-42).concat(snapshot()),elapsed:0,point};mode='impact';say('저장… 저장은 했나…!','😵',3,5);npc('산재 처리는…');save();}
function impactStep(dt: number){if(!impact)return;impact.elapsed+=dt;const n=impact.frames.length-1,u=Math.min(n,impact.elapsed*.25*120),i=Math.min(n-1,Math.floor(u)),f=u-i,a=impact.frames[Math.max(0,i)],b=impact.frames[Math.max(0,i+1)];if(a&&b){p={...a.p};for(const k of ['x','y','vx','vy','a','w'] as const)p[k]=a.p[k]+(b.p[k]-a.p[k])*f;cam=a.cam+(b.cam-a.cam)*f;}if(impact.elapsed>n/120/.25+.35){mode='dead';overlay('GAME OVER · HEAD CONTACT','머리가 먼저<br>퇴근했습니다.','더러운 물 위에서는 브레이크도 미끄러워요.<br>공중에서는 Q E로 자세를 맞춰주세요.','다시 정상 근무 ↻');}}
function shoot(){const dir=copier.dir;for(let i=0;i<4;i++){papers.push({x:copier.x+dir*48,y:F-90-i*4,vx:dir*(200+i*24),vy:-60-i*27,a:i*.8,w:dir*(3+i),life:5,hit:false,landed:false,volley});}bursts++;copier.flash=.24;if(bursts===1)say('보고서가 왜 얼굴로 출력돼…','😳');}
function particlesStep(dt: number){for(const z of papers){z.life-=dt;z.x+=z.vx*dt;z.y+=z.vy*dt;z.vx*=Math.exp(-.8*dt);z.vy+=210*dt;z.a+=z.w*dt;const pit=z.x>bin.a&&z.x<bin.b;if(z.y>F-4&&!pit){z.y=F-4;z.vy=0;z.vx*=Math.exp(-4*dt);z.w*=.9;z.landed=true;}if(!z.hit&&!z.landed&&!inBin&&Math.hypot(z.x-p.x,z.y-(p.y-50))<48){z.hit=true;paperHits++;focusHit('종이',z.volley);if(mode!=='play')return;p.vx*=.88;p.w+=z.vx*.0009;paperFace=2.4;say('이거 이번 달 실적인데…','😑',2.6);}}papers=papers.filter(z=>z.life>0).slice(-60);for(const z of specks){z.life-=dt;z.x+=z.vx*dt;z.y+=z.vy*dt;z.vy+=300*dt;z.a+=dt*3;}specks=specks.filter(z=>z.life>0).slice(-60);}
function cleaningStep(dt: number){
if(!cleaning.spilled&&Math.abs(p.x-cleaning.x)<150&&p.y>F-200){cleaning.spilled=true;cleaning.age=0;cleaning.splashDir=p.x<cleaning.x?-1:1;for(let i=0;i<48;i++){const side=cleaning.splashDir;waterDrops.push({x:cleaning.x-10,y:F-24,vx:side*(90+(i%8)*29)+(i%3-1)*30,vy:-100-(i%7)*32,life:1.3+(i%4)*.18,r:3+i%4,landed:false});}say('노트북 괜찮나?!','😱',2.6,4);npc('앗! 청소 중이었는데…','김 대리',1000);save();}
if(cleaning.spilled){cleaning.age+=dt;if(!cleaning.followup&&cleaning.age>2.75){cleaning.followup=true;say('아직 저장 안 했는데… 내 성과 자료!!','😰',3.2,3);}if(!soaked&&cleaning.age<1.3&&Math.abs(p.x-cleaning.x)<210&&p.y>F-150){soaked=true;focusHit('오물',0);if(mode!=='play')return;save();}}
for(const r of waterRipples)r.age+=dt;
waterRipples=waterRipples.filter(r=>r.age<r.life);
for(const z of waterDrops){z.life-=dt;z.x+=z.vx*dt;z.y+=z.vy*dt;z.vy+=420*dt;z.vx*=Math.exp(-.6*dt);if(z.y>F+4){z.y=F+4;if(!z.landed){z.landed=true;waterRipples.push({x:z.x,age:0,life:.45+z.r*.035,r:z.r});}z.vy=-Math.abs(z.vy)*.12;z.vx*=.8;}}waterDrops=waterDrops.filter(z=>z.life>0);

}

function binEnter(){if(mode!=='play')return;inBin=true;dirty=true;binFalls++;deaths++;lossReason='bin';p.x=bin.x;p.y=F+66;p.vx=p.vy=p.w=0;p.a=.1;keys.clear();mode='dead';say('노트북… 아직 저장 안 했는데!!','😨',5,5);npc('산재 처리는…','총무팀',1810);overlay('GAME OVER · TRASH BIN','업무와 함께<br>분리배출됐습니다.','휴지통에 빠지면 게임오버입니다.<br>가장자리 전에 점프해서 건너세요.','다시 정상 근무 ↻');save();}
function focusHit(kind: string,id: number){if(mode!=='play')return;const token=kind+':'+id;if(focusEvents.has(token))return;focusEvents.add(token);focus=Math.max(0,focus-20);focusClock=0;focusNotice={text:kind+' 방해 −20%',life:1.7};if(focus===0){focusFailure();return;}save();}
function focusFailure(){if(mode!=='play')return;mode='focuslost';lossReason='focus';focusLossTime=0;focus=0;focusClock=0;deaths++;keys.clear();acc=0;say('앗 언제 여기까지 왔지?!','😕',3,99);q('[data-status]').textContent='집중도 0% · 앗 언제 여기까지 왔지?!';save();}
function advanceFocusLoss(dt: number){if(mode!=='focuslost')return;focusLossTime+=dt;if(focusLossTime>=1.7){mode='dead';overlay('GAME OVER · 집중도 0%','앗 언제 여기까지 왔지?!','일에 집중하던 회사원이 드디어 주변을 알아차렸습니다.<br>집중도가 모두 소진되어 게임오버입니다.','다시 정상 근무 ↻');save();}}
function focusBlocked(){return paperFace>0||glare>0||(cleaning.spilled&&cleaning.age<1.3&&Math.abs(p.x-cleaning.x)<210&&p.y>F-150);}
function focusStep(dt: number){if(focusNotice&&(focusNotice.life-=dt)<=0)focusNotice=null;if(focusBlocked()){focusClock=0;return;}if(focus>=100){focusClock=0;return;}focusClock+=dt;if(focusClock>=2-1e-9){const amount=Math.floor((focusClock+1e-9)/2);focus=Math.min(100,focus+amount);focusClock=Math.max(0,focusClock-amount*2);save();}}
function step(dt: number){if(mode!=='play')return;history.push(snapshot());if(history.length>60)history.shift();time+=dt;t+=dt;copier.cool=Math.max(0,copier.cool-dt);copier.flash=Math.max(0,copier.flash-dt);binCooldown=Math.max(0,binCooldown-dt);paperFace=Math.max(0,paperFace-dt);rollCooldown=Math.max(0,rollCooldown-dt);reverseCooldown=Math.max(0,reverseCooldown-dt);slipCooldown=Math.max(0,slipCooldown-dt);glare=Math.max(0,glare-dt);lightCooldown=Math.max(0,lightCooldown-dt);if(reaction&&(reaction.life-=dt)<=0)reaction=null;if(speech&&(speech.life-=dt)<=0)speech=null;
if(Math.abs(p.x-copier.x)<180&&copier.cool===0&&copier.burst===0){copier.dir=p.x<copier.x?-1:1;volley++;copier.burst=3;copier.next=0;copier.cool=4.6;}
if(copier.burst>0){copier.next-=dt;if(copier.next<=0){shoot();copier.burst--;copier.next=.19;}}
particlesStep(dt);if(mode!=='play')return;cleaningStep(dt);if(mode!=='play')return;

const was=ground,dir=(keys.has('right')?1:0)-(keys.has('left')?1:0),prev=p.x;coyote=ground?.1:Math.max(0,coyote-dt);jumpQ=Math.max(0,jumpQ-dt);slip=was&&cleaning.spilled&&p.x>cleaning.a&&p.x<cleaning.a+Math.min(1,cleaning.age/.8)*(cleaning.b-cleaning.a)&&p.y>F-55;
if(slip&&!wetSeen){wetSeen=true;save();}if(slip&&slipCooldown===0&&Math.abs(p.vx)>65){say('노트북에 물 들어가면… 이번 달 실적은?!','😰',3,1);slipCooldown=7;}
if(jumpQ>0&&coyote>0){p.vy=-350;p.w-=dir*.12;ground=false;coyote=0;jumpQ=0;}
const tilt=(keys.has('e')?1:0)-(keys.has('q')?1:0)+(was?0:dir);p.w+=tilt*(was?4.3:6.4)*dt;
if(was&&dir)p.vx+=dir*(slip?110:305)*dt;else if(!was&&dir)p.vx+=dir*55*dt;
if(keys.has('brake')&&was){p.vx*=Math.exp(-(slip?.38:6)*dt);p.w*=Math.exp(-4*dt);}p.vy+=800*dt;p.vx*=Math.exp(-(was?(slip?.015:.55):.09)*dt);p.w*=Math.exp(-(was?(slip?.9:1.8):.75)*dt);p.vx=clamp(p.vx,-315,315);p.vy=clamp(p.vy,-500,850);p.w=clamp(p.w,-5.8,5.8);p.x+=p.vx*dt;p.y+=p.vy*dt;p.a+=p.w*dt;
if(binCooldown===0&&p.x>bin.a+25&&p.x<bin.b-25&&p.y+28>=bin.rim&&p.vy>=0){binEnter();return;}
ground=false;let c=Math.cos(p.a),sn=Math.sin(p.a),head=parts[7],hx=p.x-head.y*sn,hy=p.y+head.y*c;for(const ob of solids){const hit=contact(hx,hy,head.r,ob.p);if(hit&&hit.ny<-.25&&hit.depth>.05){fail({x:hx,y:hy});return;}}
for(let iter=0;iter<5;iter++)for(const part of parts){c=Math.cos(p.a);sn=Math.sin(p.a);const rx=part.x*c-part.y*sn,ry=part.x*sn+part.y*c;for(const ob of solids){const hit=contact(p.x+rx,p.y+ry,part.r,ob.p);if(!hit)continue;if(part.head&&hit.ny<-.25&&hit.depth>.05){fail({x:p.x+rx,y:p.y+ry});return;}p.x+=hit.nx*hit.depth*.78;p.y+=hit.ny*hit.depth*.78;const vn=(p.vx-p.w*ry)*hit.nx+(p.vy+p.w*rx)*hit.ny,cr=rx*hit.ny-ry*hit.nx;if(vn<0){const impulse=-1.035*vn/(1+cr*cr/2500);p.vx+=hit.nx*impulse;p.vy+=hit.ny*impulse;p.w+=cr*impulse/2500;}if(part.wheel&&hit.ny<-.45)ground=true;}}
monitorStep(dt,prev);if(mode!=='play')return;focusStep(dt);
if(ground)p.w-=Math.sin(p.a)*dt;if(p.x<40){p.x=40;p.vx=Math.max(0,p.vx);}wheel+=p.vx*dt/8;
if(ground&&dir&&Math.abs(p.vx)>95&&!reaction&&rollCooldown===0){say('흔들려도… 마감은 지켜야지…','😵');rollCooldown=9;}
if(p.vx<-60&&reverseCooldown===0){const n=people.reduce((a,b)=>Math.abs(a.x-p.x)<Math.abs(b.x-p.x)?a:b);if(Math.abs(n.x-p.x)<300){npc('다시 출근하는 거야?',n.name,n.x);reverseCooldown=7;}}
for(const n of people){if(!n.said&&Math.min(Math.abs(p.x-n.x),Math.abs(prev-n.x))<100){n.said=true;if(!speech)npc(n.text,n.name,n.x);}}
if(slip&&Math.abs(p.vx)>90&&Math.floor(t*30)!==Math.floor((t-dt)*30))specks.push({x:p.x-15,y:F-2,vx:-p.vx*.2,vy:-45,a:0,life:.35,color:'#7c8870'});
cam+=(clamp(p.x-VW*.35,0,Math.max(0,LEN-VW))-cam)*Math.min(1,dt*7);
if(p.y>F+250){binEnter();return;}
if(p.x>GOAL){mode='won';keys.clear();overlay('STAGE 01 CLEAR','사무실 탈출.<br>노트북은 정상 작동.',`복사기 분사 ${bursts}회 · 종이 피격 ${paperHits}회 · 휴지통 ${binFalls}회 · 눈부심 ${lightHits}회 · 집중도 ${focus}%<br>다음 스테이지는 아직 열리지 않았습니다.`, '사무실 다시 굴리기 ↻');save();}}
function monitorPhase(){const phase=t%monitor.period;return {phase,warning:phase<.8,active:phase>=.8&&phase<2.1,remaining:phase<.8?.8-phase:phase<2.1?2.1-phase:monitor.period-phase};}
function monitorStep(dt: number,previousX: number){const m=monitorPhase();if(!m.active||p.y+28<300)return;
// A timed light curtain crosses the route; both travel directions use the same boundary.
if(p.x+35>monitor.wall-8&&p.x-35<monitor.wall+22){const side=previousX<monitor.wall?-1:1;p.x=monitor.wall+side*45;p.vx=side*65;p.w*=.45;glare=1.65;if(lightCooldown===0){lightHits++;lightCooldown=1.4;focusHit('불빛',Math.floor(t/monitor.period));if(mode!=='play')return;say('눈부셔… 실적 칸이 안 보여!','😣',2.7,2);npc('밝은 미래가 보이죠?', '옆자리 동료',2300);save();}}}

// ThorVG owns the vector paths and gradient fills; labels use a separate text canvas.
const C={ink:'#292d38',wall:'#adb3c1',floor:'#b9bbc0',paper:'#f4ecd7',wood:'#d7ad72',steel:'#9098a3',skin:'#e4cba6',shirt:'#f1eee4'};
let ox=0,oy=0,rotation=0;
function polygon(points: Vector[],color: string){
  commands.push({v:points.map(([x,y])=>screenPoint(x,y)),c:color});
}
// Effects share the same world transform and Canvas2D fallback as the flat artwork.
function screenPoint(x: number,y: number): Vector{const c=Math.cos(rotation),s=Math.sin(rotation);return [(x*c-y*s+ox-cam)*scale,(x*s+y*c+oy+vertical)*scale];}
function rgba(hex: string,alpha=1): Color{return [...rgb(hex),Math.round((hex.length===9?parseInt(hex.slice(7,9),16):255)*clamp(alpha,0,1))];}
function gradientFill(x1: number,y1: number,x2: number,y2: number,stops: [number, string][],alpha=1): Gradient{return {from:screenPoint(x1,y1),to:screenPoint(x2,y2),stops:stops.map(([at,c])=>[at,rgba(c,alpha)])};}
function effectPath(start: Vector,curves: Curve[],fill: Gradient){commands.push({v:[screenPoint(...start)],curves:curves.map(c=>[...screenPoint(c[0],c[1]),...screenPoint(c[2],c[3]),...screenPoint(c[4],c[5])]),c:fill});}
function gradientPolygon(points: Vector[],fill: Gradient){commands.push({v:points.map(v=>screenPoint(...v)),c:fill});}
function ripple(x: number,y: number,rx: number,ry: number,width: number,color: string){const points: Vector[]=[];for(let i=0;i<=24;i++){const a=i/24*TAU;points.push([x+rx*Math.cos(a),y+ry*Math.sin(a)]);}for(let i=24;i>=0;i--){const a=i/24*TAU;points.push([x+Math.max(0,rx-width)*Math.cos(a),y+Math.max(0,ry-width*.35)*Math.sin(a)]);}polygon(points,color);}
function tint(hex: string,alpha: number){return hex+Math.round(clamp(alpha,0,1)*255).toString(16).padStart(2,'0');}
function rect(x: number,y: number,w: number,h: number,c: string){polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],c);}
function ellipse(x: number,y: number,rx: number,ry: number,c: string){polygon(Array.from({length:16},(_,i)=>[x+rx*Math.cos(i/16*TAU),y+ry*Math.sin(i/16*TAU)]),c);}
function rod(x: number,y: number,xx: number,yy: number,w: number,c: string){let dx=xx-x,dy=yy-y,l=Math.hypot(dx,dy)||1,nx=-dy/l*w/2,ny=dx/l*w/2;polygon([[x+nx,y+ny],[xx+nx,yy+ny],[xx-nx,yy-ny],[x-nx,y-ny]],c);}
function label(text: string,x: number,y: number,size=12,color='#333d4b',align: CanvasTextAlign='center'){lg.font=`${size*scale}px system-ui,sans-serif`;lg.fillStyle=color;lg.textAlign=align;lg.fillText(text,(x-cam)*scale,(y+vertical)*scale);}
function plant(x: number){rect(x-13,F-40,26,30,'#ccc9b5');for(let i=0;i<5;i++){rod(x,F-40,x+(i-2)*12,F-70-Math.abs(i-2)*4,3,'#6c8267');polygon([[x+(i-2)*12,F-70-Math.abs(i-2)*4],[x+(i-2)*18-9,F-98],[x+(i-2)*17+11,F-85]],'#83966a');}}
function desk(x: number){rect(x,F-105,140,9,C.wood);rod(x+10,F-95,x+10,F-25,6,C.steel);rod(x+128,F-95,x+128,F-25,6,C.steel);rect(x+45,F-165,53,40,'#495569');rect(x+50,F-160,43,30,x===monitor.desk?(monitorPhase().active?'#fff4bb':monitorPhase().warning?'#e9c98e':'#9db6c4'):'#9db6c4');rod(x+70,F-125,x+70,F-105,5,C.steel);rect(x+40,F-112,63,5,'#526274');}
function person(n: Person){const x=n.x,y=F-20;rod(x-7,y-40,x-10,y,8,'#565e70');rod(x+5,y-40,x+10,y,8,'#565e70');polygon([[x-17,y-93],[x+10,y-93],[x+18,y-41],[x-20,y-41]],'#727d8b');polygon([[x-9,y-93],[x+5,y-93],[x-1,y-69]],C.shirt);rect(x-2,y-88,4,24,'#9e6955');rod(x-14,y-86,x-29,y-55,8,'#727d8b');rod(x-29,y-55,x-4,y-63,7,'#727d8b');polygon([[x-13,y-124],[x+5,y-132],[x+17,y-113],[x+10,y-96],[x-8,y-99]],C.skin);polygon([[x-14,y-122],[x+4,y-134],[x+14,y-125],[x+1,y-125],[x-10,y-114]],'#49505b');rect(x+7,y-114,2,3,C.ink);}
function binBack(){rect(bin.a-8,F-16,176,10,'#5b6e70');polygon([[bin.a+5,F-7],[bin.b-5,F-7],[bin.b-16,bin.bottom],[bin.a+16,bin.bottom]],'#687b7d');ellipse(bin.x,F-8,79,12,'#303d44');label('紙 / PAPER',bin.x,F-30,12);}
function binFront(){polygon([[bin.a+5,F+3],[bin.b-5,F+3],[bin.b-16,bin.bottom],[bin.a+16,bin.bottom]],'#8d9c96');for(let x=bin.a+23;x<bin.b-10;x+=18)rod(x,F+15,x+4,bin.bottom-12,2,'#6e807c');ellipse(bin.x,F+3,78,7,'#a4b1a5');rect(bin.x-27,F+35,54,29,'#d7dcc7');label('분리배출',bin.x,F+54,11);if(inBin)label('GAME OVER',bin.x,F-117,15,'#79472c');}
function cleaningDraw(){
const spread=cleaning.spilled?Math.min(1,cleaning.age/.8):0;
if(spread>0){for(let i=0;i<11;i++){const x=cleaning.a+15+i*30*spread;ellipse(x,F+3,Math.max(2,(24+i%3*7)*spread),4+i%2*2,'#7f8970');}ellipse(cleaning.a+155*spread,F+2,85*spread,3,'#a1a88b');rod(cleaning.a+70*spread,F+2,cleaning.a+130*spread,F+2,1,'#c0c7a4');}
// A mop and wheeled cleaning bucket are ordinary office props; the bucket tips as the chair approaches.
const tip=cleaning.spilled?Math.min(1,cleaning.age/.42):0;ox=cleaning.x;oy=F-3;rotation=-tip*1.25;
polygon([[-23,-50],[20,-50],[15,-7],[-18,-7]],'#c0a775');ellipse(-2,-50,22,6,'#647260');rod(-24,-46,-19,-66,3,'#7d8790');rod(-19,-66,18,-66,3,'#7d8790');rod(18,-66,23,-46,3,'#7d8790');rect(-21,-7,41,7,'#8d8b74');ellipse(-15,2,5,5,'#555f66');ellipse(15,2,5,5,'#555f66');rect(-11,-36,19,13,'#eee1b5');ox=oy=rotation=0;
rod(cleaning.x+42,F-5,cleaning.x+20+tip*50,F-137+tip*81,5,'#9eaa9e');for(let i=0;i<6;i++)rod(cleaning.x+25+i*7,F-10,cleaning.x+20+i*9,F+3,3,'#999e81');
if(cleaning.spilled&&cleaning.age<1.1){
const u=clamp(cleaning.age/1.1,0,1),reach=Math.sin(Math.min(1,u*2)*Math.PI/2),fade=Math.sin(u*Math.PI),side=cleaning.splashDir;
ox=cleaning.x-10;oy=F-24;
// Two overlapping curved sheets retain the muddy, hand-cut palette.
for(let i=0;i<2;i++){const end=-65-(125-i*38)*reach,crest=-30-(80-i*22)*Math.sin(u*Math.PI);
effectPath([0,0],[[end*.3,crest-25,end*.65,crest,end,12],[end+24,8,end+38,-6,end+52,6],[end*.4,14,-18,24,0,0]].map(c=>c.map((v,i)=>i%2===0?v*-side:v) as Curve),gradientFill(0,-65,0,30,[[0,'#bfca9c90'],[.45,'#8e9c7dcc'],[1,'#66796318']],fade));}
ox=oy=rotation=0;
}
for(const r of waterRipples){const u=r.age/r.life;ripple(r.x,F+5,4+u*(14+r.r*2),1.5+u*3,1.2,tint('#c0c7a4',(1-u)*.65));}
for(const z of waterDrops){
const fade=clamp(z.life/.35,0,1),speed=Math.hypot(z.vx,z.vy),stretch=z.landed?1:clamp(speed/130,1,2.8);
ox=z.x;oy=z.y;rotation=Math.atan2(z.vy,z.vx)-Math.PI/2;
const r=z.r,w=r*.68,h=r*stretch;
effectPath([0,-h],[[w,-h*.25,w,h*.65,0,h],[-w,h*.65,-w,-h*.25,0,-h]],gradientFill(-w,0,w,0,[[0,'#647960d0'],[.48,'#a8b58bdc'],[1,'#7d8e7880']],fade));
if(!z.landed&&z.r>4)ellipse(-w*.25,-h*.1,.8,h*.32,tint('#e0dfb7',fade*.7));
ox=oy=rotation=0;
}

label(cleaning.spilled?(cleaning.age<1.4?'촤아악!!':'더러운 물 · 미끄러움'):'청소 중 · 물통 조심',1045,F-56,14,cleaning.spilled?'#586d50':'#756846');
}

function monitorDraw(){const m=monitorPhase(),x=monitor.x,y=monitor.y;
// The light starts inside the screen of the ordinary monitor on the last desk.
label(m.active?'푸슝— 푸슝!':m.warning?'화면 반사 예고…':'빛이 꺼졌다 · 지금 통과',x,y-35,13,m.active?'#ffe0a6':'#e1e6ee');
if(m.active){
const age=m.phase-.8,u=age/1.3,envelope=Math.min(1,age/.12,(1.3-age)/.22),pulse=.82+.18*Math.sin(age*TAU*2),end=monitor.wall;
const beam=gradientFill(x,y,end-35,F,[[0,'#fffbe7cc'],[.22,'#fff3c47c'],[.7,'#f5d79950'],[1,'#f5d79900']],envelope*pulse);
gradientPolygon([[x-18,y-10],[x+12,y+10],[end+38,F+14],[end-144,F-135]],beam);
gradientPolygon([[x-7,y-3],[x+5,y+5],[end+8,F+8],[end-70,F-74]],gradientFill(x,y,end,F,[[0,'#fffdf0ed'],[.4,'#fff6cc98'],[1,'#ffe8a91a']],envelope));
// Advect narrow ribbons down the reflection instead of blinking the entire beam.
for(let i=0;i<4;i++){const f=(age*1.15+i/4)%1,xx=x+(end-x)*f,yy=y+(F-y)*f,w=3+f*24,a=Math.sin(f*Math.PI)*envelope;
gradientPolygon([[xx-w,yy-8],[xx+w*.6,yy+5],[xx+w*.6-4,yy+9],[xx-w-4,yy-4]],gradientFill(xx-w,yy,xx+w,yy,[[0,'#fff8dc00'],[.5,'#fffbe8c0'],[1,'#fff8dc00']],a));}
const glow=14+3*Math.sin(u*TAU);
gradientPolygon([[x-30,y-26],[x+26,y-26],[x+26,y+26],[x-30,y+26]],gradientFill(x-28,y,x+28,y,[[0,'#fff6cf00'],[.5,'#fffbe4a0'],[1,'#fff6cf00']],envelope));
rod(x-glow,y-3,x+glow,y-3,2,tint('#fffce7',envelope*.85));
gradientPolygon([[end-80,F-1],[end+48,F-1],[end+48,F+17],[end-80,F+17]],gradientFill(end-80,F,end+48,F,[[0,'#efd39c00'],[.5,'#fff1c7b0'],[1,'#efd39c00']],envelope*pulse));
}else if(m.warning){const charge=m.phase/.8,blink=.45+.55*Math.sin(charge*Math.PI*3)**2;ellipse(x-3,y-2,4+charge*5,3+charge*3,tint('#fff4c6',blink*.65));rod(x-5,y-21,x-5,y-29-charge*5,2,'#dca468');rod(x-22,y-16,x-28-charge*4,y-23,2,'#dca468');}

for(let i=0;i<4;i++)rect(monitor.wall-58+i*20,F+10,11,3,'#c79c64');
label(m.active?'빛이 꺼질 때까지 대기':m.warning?'잠깐, 곧 눈부셔요!':'→ 통과',monitor.wall-50,F+43,12,'#735f46');
}

function player(){ox=p.x;oy=p.y;rotation=p.a;
rod(0,-4,0,16,6,C.steel);rod(-29,21,0,13,5,C.steel);rod(0,13,29,21,5,C.steel);for(const x of [-27,27]){ellipse(x,23,7,8,'#3f4650');rod(x-3*Math.cos(wheel),23-3*Math.sin(wheel),x+3*Math.cos(wheel),23+3*Math.sin(wheel),1,'#9197a2');}
rod(-24,-10,-31,-61,7,'#515665');polygon([[-40,-69],[-24,-68],[-23,-20],[-37,-20]],'#666d80');rect(-30,-15,62,12,'#6f7687');rod(-15,-22,-15,-8,3,C.steel);rod(20,-22,20,-8,3,C.steel);
rod(-4,-22,27,-19,13,'#535c70');rod(27,-19,38,3,10,'#535c70');rect(31,0,25,8,'#393c46');polygon([[-18,-64],[4,-62],[14,-24],[-12,-23]],C.shirt);rod(0,-62,0,-69,7,C.skin);
polygon([[-12,-88],[4,-94],[15,-81],[12,-66],[-4,-64],[-13,-75]],C.skin);polygon([[-14,-85],[-4,-97],[7,-94],[14,-86],[2,-88],[-9,-79]],'#3c3b43');rect(4,-84,10,6,'#c3d0d0');rod(1,-84,15,-84,2,C.ink);rect(9,-82,2,2,C.ink);
rod(-10,-55,6,-38,8,C.shirt);rod(6,-38,32,-34,6,C.skin);rod(1,-57,8,-37,3,'#ac6954');polygon([[21,-31],[54,-31],[65,-59],[33,-59]],'#555f70');polygon([[35,-55],[59,-55],[51,-35],[27,-35]],'#a8b9c3');rod(18,-29,55,-29,3,C.steel);const tap=Math.sin(t*24)*1.8;rect(26,-35+tap,8,3,C.skin);
if(paperFace>0){polygon([[-13,-89],[13,-85],[10,-65],[-15,-69]],C.paper);rod(-8,-82,9,-80,1,'#a8a79e');rod(-8,-77,7,-75,1,'#a8a79e');}
if(soaked){for(const [x,y]of [[-13,-49],[5,-29],[34,-44]])ellipse(x,y,4,6,'#8b9c777d');}
if(dirty){for(let i=0;i<9;i++){const x=-25+(i*17)%60,y=-82+(i*23)%79;polygon([[x,y],[x+9,y-4],[x+12,y+6],[x+2,y+8]],['#d6c998','#85946b','#a88e69'][i%3]);}polygon([[-14,-94],[-2,-104],[7,-94]],'#c4ae73');rod(-3,-98,0,-88,2,'#849267');}
ox=oy=rotation=0;}
function world(){commands=[];ox=oy=rotation=0;const left=cam-100,right=cam+VW+100;
rect(cam,-vertical,VW,H/scale,'#a9afbc');rect(cam,-vertical,VW,57+vertical,'#747d91');rod(cam,57,cam+VW,57,4,'#d1d1c6');
for(let i=Math.floor(cam/235)-1;i<(cam+VW)/235+1;i++){
  const x=i*235;
  rect(x+17,80,197,193,'#69788c');
  rect(x+24,87,183,179,'#202940');
  for(let j=0;j<4;j++){
    const bx=x+30+j*42,h=60+(i*23+j*31+300)%80;
    rect(bx,260-h,32,h,'#425069');
    for(let k=0;k<3;k++){
      // Pick one window per pane and stagger its short off interval across panes.
      const flickers=j===((i%4)+4)%4&&k===1;
      const period=3.4+((i%3+3)%3)*.7;
      const phase=(t+(i*1.37%period)+period)%period;
      const color=flickers&&phase<.38?'#334056':'#e2cea1';
      rect(bx+6,269-h+k*20,6,8,color);
    }
  }
  rod(x+113,87,x+113,267,4,'#69788c');
  rod(x+24,179,x+207,179,3,'#69788c');
  rect(x+43,27,145,7,'#f1e9cf');
}
rect(cam,287,VW,F-287,'#a0a7b1');rod(cam,315,cam+VW,315,2,'#8c94a1');
for(let x=110;x<GOAL;x+=420){if(x<left-200||x>right)continue;desk(x);plant(x+205);}
for(const n of people)if(n.x>left&&n.x<right)person(n);
for(const ob of solids)polygon(ob.p.map(v=>[v.x,v.y]),C.floor);
for(let x=Math.floor(cam/110)*110;x<right;x+=110){if(x>bin.a-30&&x<bin.b+30)continue;rod(x,F+5,x-35,F+150,1,'#a1a5ad');}
cleaningDraw();
const x=copier.x;rect(x-56,F-108,112,88,'#c6c9bf');rect(x-48,F-96,40,61,'#aeb7b5');rect(x-1,F-96,47,22,'#717f88');rect(x+6,F-91,21,9,copier.flash>0?'#edc883':'#9fbdad');rect(x-56,F-120,112,12,'#dcdccc');polygon([[x-45,F-121],[x+35,F-132],[x+48,F-151],[x-35,F-143]],'#e7e4d6');rect(x-65,F-91,22,7,'#333d49');rect(x+42,F-91,23,7,'#333d49');for(let j=0;j<3;j++)rect(x-37,F-70+j*11,22,3,'#737f87');label(copier.flash>0?'퉤! 퉷!!':'자동 출력 · 접근 감지',x,F-167,14,copier.flash>0?'#ffd5a8':'#e1e6ee');
for(const z of papers){ox=z.x;oy=z.y;rotation=z.a;rect(-10,-6,20,12,C.paper);rod(-6,-2,6,-2,1,'#9a9e9d');rod(-6,2,3,2,1,'#b3b3a7');ox=oy=rotation=0;}
monitorDraw();binBack();ellipse(p.x,F+8,45,5,'#91959c');player();binFront();for(const z of specks){ox=z.x;oy=z.y;rotation=z.a;rect(-3,-2,7,4,z.color);ox=oy=rotation=0;}
rect(GOAL-35,F-205,106,205,'#677d7e');rect(GOAL-27,F-197,90,190,'#b5c4bf');rod(GOAL+40,F-120,GOAL+40,F-81,4,'#677d7e');rect(GOAL-31,F-236,98,23,'#718e7b');label('사무실 출입문 →',GOAL+18,F-218,12,'#f0eddc');
if(glare>0){rect(cam,-vertical,VW,H/scale,'#fff7d5'+Math.round(Math.min(.22,glare*.16)*255).toString(16).padStart(2,'0'));label('으… 눈부셔!',p.x,p.y-119,15,'#856e4e');}
if(mode==='impact')label('머리 충돌 · 0.25×',p.x,120,17,'#974c41');if(mode==='pause'){rect(cam,-vertical,VW,H/scale,'#3a455d');label('잠깐, 숨 고르는 중',cam+VW/2,H/scale/2-vertical,22,'#eee8d7');}
}
function rgb(hex: string): [number, number, number]{const h=hex.slice(1);return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function paint(){
if(tvg&&TVG){let i=0;for(const cmd of commands){let s=pool[i];if(!s){s=new TVG.Shape();pool.push(s);tvg.add(s);}s.reset();s.moveTo(...cmd.v[0]);for(let j=1;j<cmd.v.length;j++)s.lineTo(...cmd.v[j]);for(const c of cmd.curves||[])s.cubicTo(...c);s.close();
if(typeof cmd.c==='string')s.fill(...rgba(cmd.c));else{const g=new TVG.LinearGradient(...cmd.c.from,...cmd.c.to);g.setStops(...cmd.c.stops);s.fill(g);g.dispose();} // Filled gradients belong to their shape; dispose releases the JS handle.
s.visible(true);i++;}for(;i<pool.length;i++)pool[i].visible(false);tvg.update().render();
}else{bg.setTransform(dpr,0,0,dpr,0,0);bg.clearRect(0,0,W,H);for(const cmd of commands){bg.beginPath();bg.moveTo(...cmd.v[0]);for(let i=1;i<cmd.v.length;i++)bg.lineTo(...cmd.v[i]);for(const c of cmd.curves||[])bg.bezierCurveTo(...c);bg.closePath();if(typeof cmd.c==='string')bg.fillStyle=cmd.c;else{const g=bg.createLinearGradient(...cmd.c.from,...cmd.c.to);for(const [at,c] of cmd.c.stops)g.addColorStop(at,`rgba(${c[0]},${c[1]},${c[2]},${c[3]/255})`);bg.fillStyle=g;}bg.fill();}}
}

function draw(){if(!p||!W)return;lg.setTransform(dpr,0,0,dpr,0,0);lg.clearRect(0,0,W,H);world();paint();q('[data-focus]').textContent=focus+'%';q('[data-focus-fill]').style.width=focus+'%';q('[data-focus-fill]').style.background=focus<=20?'#d88e7e':'#d2b783';q('[data-focus-meter]').setAttribute('aria-valuenow',String(focus));q('[data-focus-note]').textContent=lossReason==='focus'?'집중도 소진 · 게임오버':focusNotice?focusNotice.text:focusBlocked()?'방해 중 · 회복 대기':'방해 없으면 2초마다 +1%';q('[data-speed]').textContent=String(Math.round(Math.abs(p.vx)/6));q('[data-body]').textContent=lossReason==='focus'?'집중도 소진':glare>0?'눈부심 · 잠깐 대기':inBin?'휴지통 추락 · 실패':dirty?'쓰레기범벅':slip?'오수 · 미끄러짐':soaked?'물범벅 · 업무 진행':'정상 근무';q('[data-progress]').style.width=clamp(p.x/GOAL*100,0,100)+'%';q('[data-hint]').textContent=inBin?'휴지통 추락 · 재시작하세요':slip?'미끄러운 바닥 · 제동 거리 증가':p.x<720?'복사기는 가까이 가면 종이를 뱉어요':p.x<1300?(cleaning.spilled?'젖은 바닥 · 미리 감속하세요':'청소 물통 주의 · 가까이 가면 촤악!'):p.x<1850?'휴지통은 점프로! 빠지면 게임오버':p.x<2220?(monitorPhase().active?'모니터 빛이 켜졌어요 · 꺼질 때 통과!':monitorPhase().warning?'모니터 빛 예고 · 미리 제동하세요':'빛이 꺼졌어요 · 지금 통과!'):'조금만 더… 오른쪽 출입문!';q('[data-rider]').hidden=!reaction||!['play','impact','focuslost'].includes(mode);if(reaction){q('[data-face]').textContent=reaction.face;q('[data-quote]').textContent=reaction.text;}q('[data-npc]').hidden=true;if(speech&&mode==='play'){const x=(speech.x-cam)*scale,y=(F-177+vertical)*scale;if(x>50&&x<W-50){q('[data-npc]').hidden=false;q('[data-npc]').style.left=x+'px';q('[data-npc]').style.top=y+'px';q('[data-name]').textContent=speech.name;q('[data-line]').textContent=speech.text;}}}
function frame(ms: number){if(!root.isConnected){tvg?.destroy();return;}const dt=Math.min((ms-(last||ms))/1000,.04);last=ms;if(mode==='play'){acc+=dt;while(acc>=1/120){step(1/120);acc-=1/120;if(mode!=='play'){acc=0;break;}}}else{acc=0;if(mode==='impact')impactStep(dt);if(mode==='focuslost')advanceFocusLoss(dt);}draw();requestAnimationFrame(frame);}
async function initRenderer(){try{TVG=await init({renderer:'sw',locateFile:()=>wasmUrl});if(!root.isConnected)return;tvg=new TVG.Canvas('#chair-office-one-tvg',{width:W,height:H});renderer='thorvg';cn.hidden=false;q('[data-renderer]').textContent='ThorVG WebCanvas';draw();}catch(e){renderError=String(e);renderer='canvas2d';q('[data-renderer]').textContent='Canvas2D 호환 모드 · ThorVG 로드 제한';}}
build();size();try{const saved=JSON.parse(localStorage.getItem('the-chair-office-v1')||'null');if(Number.isFinite(saved?.deaths))deaths=Math.max(0,saved.deaths);}catch{}
const officeStageOne={reset,step,jump,pause,draw,advanceImpact:impactStep,advanceFocusLoss,setInput:(...v: Input[])=>keys=new Set(v),state:()=>({game:'office-stage-one',mode,focus,focusClock,focusLossTime,focusNotice:focusNotice?{...focusNotice}:null,lossReason,player:{...p},ground,slip,dirty,inBin,binAge,time,deaths,bursts,paperHits,binFalls,dirtyWaterExperienced:wetSeen,cleaningSpilled:cleaning.spilled,soaked,paperFace,cleaning:{...cleaning},waterDrops:waterDrops.map(z=>({...z})),waterRipples:waterRipples.map(z=>({...z})),glare,lightHits,monitor:{...monitor,...monitorPhase()},papers:papers.map(z=>({...z})),renderer,renderError,commands:commands.length,reaction:reaction?{...reaction}:null})};
(window as Window & { officeStageOne?: typeof officeStageOne }).officeStageOne=officeStageOne;
initRenderer();requestAnimationFrame(frame);
})();
