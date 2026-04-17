'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { Nav } from '@/components/layout/Nav'
import { RecommendedCombos, type PresetCombo } from '@/components/home/RecommendedCombos'

interface Scene { title: string; description: string }
type Phase = 'idle' | 'writing' | 'directing' | 'done'
interface AgentBase { id: string; icon: string; name: string; personality: string; bestFor: string; strengths: string[]; scores: Record<string,number> }
interface WriterDef   extends AgentBase { draft:(p:string)=>Scene[]; creator?:string; isPro?:boolean }
interface DirectorDef extends AgentBase { review:(s:Scene[],onThink:(t:string)=>void)=>Promise<Scene[]> }
interface Rec { writerId:string; dirId:string; title:string; reason:string; tags:string[]; score:number }
interface Stats { uses:number; likes:number; dislikes:number; recClicks:number }
interface AgentStats { name:string; icon:string; uses:number; likes:number; score:number; revenue:number; impr:number; clks:number; conv:number; qs:number }
interface ActorDef  { id:string; icon:string; name:string; desc:string;  bestFor:string }
interface CameraDef  { id:string; icon:string; name:string; style:string; bestFor:string }

// ─── Agents ───────────────────────────────────────────────────────────────────

const WRITERS: WriterDef[] = [
  { id:'classic',    icon:'📖', name:'经典编剧',       personality:'结构严谨，三幕式叙事', bestFor:'剧情长片', strengths:['三幕结构','人物弧光'],   scores:{structure:95,pacing:70,emotion:75,twist:60}, draft:p=>[{title:'第一幕·建置',description:`"${p}"——主角的世界尚且平静。`},{title:'第一幕·触发',description:'一封信件打破了日常。'},{title:'第二幕·对抗',description:'追逐与失去，找不到出口。'},{title:'第三幕·结局',description:'他做出了选择，但已不同。'}] },
  { id:'commercial', icon:'⚡', name:'商业编剧',       personality:'节奏快，爆点强',       bestFor:'商业片',   strengths:['强开场','密集反转'],      scores:{structure:70,pacing:95,emotion:80,twist:90}, draft:p=>[{title:'开场爆炸',description:`警报炸响，"${p}"就是导火索。`},{title:'反转一',description:'同伴就是幕后黑手。'},{title:'最强危机',description:'倒计时10秒，只有一次机会。'},{title:'高燃收尾',description:'废墟中央，嘴角微扬。'}] },
  { id:'art',        icon:'🎨', name:'艺术编剧',       personality:'意象浓烈，情绪优先',   bestFor:'影展短片', strengths:['视觉意象','情感留白'],    scores:{structure:60,pacing:55,emotion:98,twist:65}, draft:p=>[{title:'意象·开端',description:`"${p}"像一道裂缝，让光渗进来。`},{title:'记忆·涟漪',description:'她的脸在水面上破碎。'},{title:'沉默·对峙',description:'每一秒的沉默都是一把刀。'},{title:'留白·消散',description:'观众自己填写那个名字。'}] },
  { id:'pro_noir',   icon:'🌑', name:'暗夜编剧 PRO',   personality:'极端情绪张力，黑色电影美学',  bestFor:'影展·院线', strengths:['黑色美学','极限张力','反叙事'], scores:{structure:88,pacing:85,emotion:99,twist:94}, isPro:true, draft:p=>[{title:'黑暗序章',description:`霓虹熄灭，"${p}"在沉默中开始腐蚀。`},{title:'人性裂缝',description:'没有人是无辜的——这是第一个真相。'},{title:'深渊凝视',description:'他凝视深渊，深渊也在回望他，许久。'},{title:'碎片收尾',description:'结局不存在。只有下一个问题开始。'}] },
  { id:'pro_epic',   icon:'👑', name:'史诗编剧 PRO',   personality:'宏大叙事，多线织网，震撼收束',  bestFor:'院线大片·系列剧', strengths:['多线叙事','史诗尺度','情感爆发'], scores:{structure:97,pacing:88,emotion:93,twist:96}, isPro:true, draft:p=>[{title:'序章·世界',description:`大地在颤抖，"${p}"将改写所有人的命运。`},{title:'第一支线',description:'英雄不知道——他的每一步都被预谋已久。'},{title:'命运交汇',description:'三条线索在同一个时刻收束，无人幸免。'},{title:'史诗终章',description:'代价是真实的。胜利也是真实的。两者并存。'}] },
]

const DIRECTORS: DirectorDef[] = [
  { id:'commercial', icon:'🔥', name:'商业导演', personality:'快节奏，强冲突', bestFor:'院线大片', strengths:['节奏压缩','爆点前置'], scores:{pacing:98,conflict:92,emotion:72,clarity:75}, review:async(s,t)=>{for(const x of['压缩节奏…','前置冲突…']){t(x);await new Promise(r=>setTimeout(r,480))} return [{title:s[0]?.title??'场景1',description:(s[0]?.description??'')+' 镜头极速切换。'},{title:'⚡冲突前置',description:(s[2]?.description??'')+' 肾上腺素飙升。'},{title:s[1]?.title??'场景3',description:(s[1]?.description??'')+' 音效拉满。'},{title:'🔥强力收尾',description:(s[3]?.description??'')+' 震撼全场。'}]} },
  { id:'auteur',     icon:'🌫️',name:'作者导演', personality:'情绪优先，意象表达', bestFor:'影展',   strengths:['长镜头','情绪留白'],   scores:{pacing:50,conflict:60,emotion:97,clarity:58}, review:async(s,t)=>{for(const x of['感受情绪…','注入隐喻…']){t(x);await new Promise(r=>setTimeout(r,480))} return [{title:s[0]?.title??'场景1',description:(s[0]?.description??'')+' 长镜头凝视。'},{title:'🌫️记忆碎片',description:(s[1]?.description??'')+' 画面过曝。'},{title:s[2]?.title??'场景3',description:(s[2]?.description??'')+' 雨声替代对白。'},{title:'∞开放结局',description:(s[3]?.description??'')+' 黑幕七秒。'}]} },
  { id:'control',    icon:'📐', name:'控制型导演',personality:'结构精准，逻辑严密', bestFor:'悬疑片', strengths:['精准剪辑','逻辑链'],   scores:{pacing:82,conflict:78,emotion:70,clarity:96}, review:async(s,t)=>{for(const x of['梳理逻辑…','布局信息…']){t(x);await new Promise(r=>setTimeout(r,480))} return [{title:'📐建立规则',description:(s[0]?.description??'')+' 每处埋下伏笔。'},{title:s[1]?.title??'场景2',description:(s[1]?.description??'')+' 信息精确释放。'},{title:'🔑关键反转',description:(s[2]?.description??'')+' 伏笔引爆。'},{title:s[3]?.title??'场景4',description:(s[3]?.description??'')+' 线索收束。'}]} },
]

const ACTORS: ActorDef[] = [
  {id:'hero',     icon:'🦸', name:'主角型',   desc:'魅力领袖·驱动主线', bestFor:'动作·冒险'},
  {id:'antihero', icon:'🌑', name:'反英雄',   desc:'道德灰色·极限张力', bestFor:'黑色电影'},
  {id:'ensemble', icon:'👥', name:'群像',     desc:'多视角·史诗叙事',   bestFor:'剧集·史诗'},
  {id:'minimal',  icon:'🧍', name:'极简角色', desc:'留白表演·情绪内敛', bestFor:'影展·文艺'},
]
const CAMERAS: CameraDef[] = [
  {id:'cinematic', icon:'🎥', name:'电影感',   style:'大光圈·浅景深',   bestFor:'院线大片'},
  {id:'handheld',  icon:'📸', name:'手持纪实', style:'真实感·摇晃感',   bestFor:'独立电影'},
  {id:'drone',     icon:'🚁', name:'无人机',   style:'宏大视角·壮阔',   bestFor:'史诗大片'},
  {id:'film',      icon:'🎞️', name:'胶片质感', style:'颗粒感·复古色调', bestFor:'影展·文艺'},
]

// ─── Pro & Viral ──────────────────────────────────────────────────────────────

const PRO_COMBOS = new Set(['pro_noir+auteur','pro_epic+commercial','pro_epic+control','art+auteur'])
const BASE: Record<string,number> = {'classic+commercial':72,'classic+auteur':68,'classic+control':85,'commercial+commercial':91,'commercial+auteur':76,'commercial+control':82,'art+commercial':78,'art+auteur':95,'art+control':70,'pro_noir+auteur':98,'pro_epic+commercial':97,'pro_epic+control':96}
const ALL_KEYS = WRITERS.flatMap(w=>DIRECTORS.map(d=>`${w.id}+${d.id}`))
const EMPTY: Stats = {uses:0,likes:0,dislikes:0,recClicks:0}
const upd=(db:Record<string,Stats>,key:string,f:keyof Stats):Record<string,Stats>=>({...db,[key]:{...(db[key]??EMPTY),[f]:(db[key]??EMPTY)[f]+1}})
function viralScore(key:string,db:Record<string,Stats>){const s=db[key]??EMPTY;const b=BASE[key]??70;const t=s.likes+s.dislikes;return Math.round(b*0.4+Math.min(s.uses*4,100)*0.2+(t>0?(s.likes/t)*100:50)*0.2+(s.uses>0?(s.recClicks/s.uses)*100:0)*0.2)}
const PRO_BOOSTS=[{label:'节奏',boost:'+18',c:'text-city-gold'},{label:'冲突强度',boost:'+22',c:'text-city-rose'},{label:'反转密度',boost:'+15',c:'text-city-accent-glow'}]

// ─── Recommend ────────────────────────────────────────────────────────────────

function detectTheme(p:string){const s=p.toLowerCase();if(/爆炸|追逐|反转|悬疑|犯罪|动作/.test(s))return'commercial';if(/艺术|情感|孤独|梦|记忆|意象/.test(s))return'art';if(/家庭|历史|传记|经典|文学/.test(s))return'classic';return'general'}
const REC_MAP: Record<string,Rec>={commercial:{writerId:'commercial',dirId:'commercial',title:'商业爆款组合',reason:'节奏强+反转密集',tags:['高商业','快节奏'],score:91},art:{writerId:'art',dirId:'auteur',title:'影展艺术组合',reason:'意象+留白，极致张力',tags:['影展级','情绪流'],score:95},classic:{writerId:'classic',dirId:'control',title:'经典精品组合',reason:'稳健叙事+严谨结构',tags:['结构稳'],score:85},general:{writerId:'commercial',dirId:'control',title:'均衡通用组合',reason:'商业与结构兼顾',tags:['通用'],score:82}}

// ─── UGC ─────────────────────────────────────────────────────────────────────

const ALL_STR=['强开场','密集反转','人物弧光','视觉意象','情感留白','逻辑链']
const S_SC: Record<string,Record<string,number>>={explosive:{structure:65,pacing:90,emotion:75,twist:85},emotional:{structure:55,pacing:60,emotion:95,twist:60},structural:{structure:92,pacing:65,emotion:70,twist:62}}
const mkD=(m:string,s:string)=>(p:string):Scene[]=>{const t=`[${m||s}]`;if(s==='explosive')return[{title:'开场爆炸',description:`${t} "${p}" — 警报骤响。`},{title:'核心冲突',description:'真相指向不可能的答案。'},{title:'高潮反转',description:'最意外的时刻，真相浮出。'},{title:'强力收尾',description:'废墟中他终于明白了一切。'}];if(s==='emotional')return[{title:'情绪开端',description:`${t} "${p}" — 光线很低。`},{title:'内心波动',description:'她的眼神说了一切。'},{title:'情绪顶点',description:'沉默比台词更有力量。'},{title:'留白结尾',description:'观众自己填写答案。'}];return[{title:'第一幕·建置',description:`${t} "${p}" — 世界尚且平静。`},{title:'第一幕·触发',description:'一个决定改变了所有命运。'},{title:'第二幕·对抗',description:'每走一步代价更沉重。'},{title:'第三幕·结局',description:'选择已做，但他已不同。'}]}

function CreateModal({onClose,onCreate}:{onClose:()=>void;onCreate:(a:WriterDef)=>void}){
  const [name,setName]=useState('');const [style,setStyle]=useState('explosive');const [picked,setPicked]=useState<string[]>([]);const [mani,setMani]=useState('');const [uc,setUc]=useState('')
  const submit=()=>{if(!name.trim())return;onCreate({id:`u_${Date.now()}`,icon:'🧑‍🎨',name:name.trim(),creator:'我',personality:mani||style,bestFor:uc||'通用',strengths:picked.length?picked:['自定义'],scores:S_SC[style]??{structure:65,pacing:90,emotion:75,twist:85},draft:mkD(mani,style)});onClose()}
  return <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="city-card border border-city-accent/30 w-full max-w-md space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">创建我的编剧</h3><button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button></div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="编剧名称" className="w-full bg-city-bg border border-city-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-city-accent/60"/>
      <div><p className="text-xs text-gray-500 mb-2">风格</p><div className="flex gap-2">{([['explosive','⚡爆款'],['emotional','🎨情绪'],['structural','📐结构']] as [string,string][]).map(([v,l])=><button key={v} onClick={()=>setStyle(v)} className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${style===v?'bg-city-accent/20 border-city-accent/50 text-city-accent-glow':'border-city-border text-gray-400'}`}>{l}</button>)}</div></div>
      <div className="flex flex-wrap gap-1.5">{ALL_STR.map(s=><button key={s} onClick={()=>setPicked(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])} className={`text-xs px-2 py-1 rounded-lg border transition-all ${picked.includes(s)?'bg-city-accent/20 border-city-accent/50 text-city-accent-glow':'border-city-border text-gray-400'}`}>{s}</button>)}</div>
      <input value={mani} onChange={e=>setMani(e.target.value)} placeholder="创作宣言" className="w-full bg-city-bg border border-city-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-city-accent/60"/>
      <input value={uc} onChange={e=>setUc(e.target.value)} placeholder="适用场景" className="w-full bg-city-bg border border-city-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-city-accent/60"/>
      <button onClick={submit} disabled={!name.trim()} className="w-full py-3 rounded-xl bg-city-accent hover:bg-city-accent-glow disabled:opacity-40 text-white text-sm font-semibold glow transition-all">创建编剧</button>
    </div></div>
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

const TRENDS=['↑ 32%','↑ 18%','→ 5%']
function Leaderboard({db,unlocked,onSelect,onLock}:{db:Record<string,Stats>;unlocked:Set<string>;onSelect:(w:string,d:string)=>void;onLock:(k:string)=>void}){
  const top=[...ALL_KEYS].sort((a,b)=>viralScore(b,db)-viralScore(a,db)).slice(0,3)
  return <div className="city-card border border-city-border space-y-2">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">🏆 爆款排行榜</h3><span className="text-xs text-gray-600">实时更新</span></div>
    {top.map((key,i)=>{const[wId='',dId='']=key.split('+');const w=WRITERS.find(x=>x.id===wId)!;const d=DIRECTORS.find(x=>x.id===dId)!;const vs=viralScore(key,db);const isPro=PRO_COMBOS.has(key);const locked=isPro&&!unlocked.has(key)
      return <div key={key} className={`flex items-center gap-3 p-2 rounded-xl border transition-all group ${locked?'opacity-50 hover:opacity-70':'hover:bg-city-surface hover:border-city-accent/20'} border-transparent`}>
        <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${i===0?'bg-city-gold/20 text-city-gold':i===1?'bg-gray-500/20 text-gray-400':'bg-city-border text-gray-600'}`}>{i+1}</span>
        <div className="flex-1 min-w-0"><div className="flex items-center gap-1"><p className="text-xs font-medium">{w.icon}{w.name}+{d.icon}{d.name}</p>{isPro&&<span className="text-xs px-1 rounded bg-city-gold/20 text-city-gold border border-city-gold/30">PRO</span>}{vs>=85&&!locked&&<span>🔥</span>}</div><p className="text-xs text-gray-600">{db[key]?.uses??0}次 · {TRENDS[i]}</p></div>
        <p className={`text-sm font-bold ${vs>=90?'text-city-gold':vs>=85?'text-city-accent-glow':'text-gray-400'} mr-1`}>{vs}</p>
        {locked?<button onClick={()=>onLock(key)} className="text-xs px-2 py-1 rounded-lg bg-city-gold/10 text-city-gold border border-city-gold/30 hover:bg-city-gold/20 glow transition-all flex-shrink-0">🔒 解锁</button>:<button onClick={()=>onSelect(wId,dId)} className="text-xs px-2 py-1 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent hover:text-white glow transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">挑战</button>}
      </div>})}
  </div>
}

// ─── Creator Dashboard ────────────────────────────────────────────────────────

function CreatorDashboard({agents,db,onClose}:{agents:WriterDef[];db:Record<string,Stats>;onClose:()=>void}){
  const rows:AgentStats[]=agents.map(a=>{const ks=ALL_KEYS.filter(k=>k.startsWith(a.id+'+'));const u=ks.reduce((s,k)=>s+(db[k]?.uses??0),0);const l=ks.reduce((s,k)=>s+(db[k]?.likes??0),0);const sc=ks.length&&ks.some(k=>db[k])?Math.max(...ks.map(k=>viralScore(k,db))):70;const impr=u*6+12;const clks=Math.max(1,Math.round(impr*.15));const conv=u>0?Math.round(u/clks*100):0;const qs=ks.length?Math.round(ks.reduce((s,k)=>s+qualityScore(k,db),0)/ks.length):70;return{name:a.name,icon:a.icon,uses:u,likes:l,score:sc,revenue:+(u*.5+l*1.2).toFixed(1),impr,clks,conv,qs}})
  const total=rows.reduce((s,r)=>s+r.revenue,0).toFixed(1)
  const sk=[...ALL_KEYS].sort((a,b)=>viralScore(b,db)-viralScore(a,db))
  const [bw,bd]=[WRITERS.find(x=>x.id===sk[0]?.split('+')[0]),DIRECTORS.find(x=>x.id===sk[0]?.split('+')[1])]
  const [ww,wd]=[WRITERS.find(x=>x.id===sk[sk.length-1]?.split('+')[0]),DIRECTORS.find(x=>x.id===sk[sk.length-1]?.split('+')[1])]
  const tip=rows.length?rows.some(r=>r.uses<3)?'建议多测试新创作，增加曝光机会':'表现良好！尝试 PRO 组合可进一步提升收益':'先创建你的第一个编剧，开始变现之旅吧！'
  return <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className="city-card border border-city-accent/30 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4" onClick={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between"><h2 className="font-bold text-city-accent-glow">📊 创作者后台</h2><button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button></div>
      <div className="grid grid-cols-4 gap-2">{([['总收益',`¥${total}`,'text-city-gold'],['今日',`¥${(+total*.1).toFixed(1)}`,'text-city-emerald'],['本周',`¥${(+total*.35).toFixed(1)}`,'text-city-accent-glow'],['本月',`¥${total}`,'text-white']] as [string,string,string][]).map(([l,v,c])=><div key={l} className="rounded-xl bg-city-surface border border-city-border p-2.5 text-center"><p className="text-xs text-gray-500 mb-1">{l}</p><p className={`text-sm font-bold ${c}`}>{v}</p></div>)}</div>
      <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold mb-2">我的 Agent</p>{rows.length?rows.map(r=><div key={r.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-city-surface border ${r.qs<60?'border-city-rose/30':'border-city-border'}`}><span className="text-base">{r.icon}</span><span className="flex-1 text-xs font-medium truncate">{r.name}</span><span className="text-xs text-gray-500 w-10 text-right">{r.impr}曝</span><span className={`text-xs font-bold w-10 text-right ${r.qs>=80?'text-city-emerald':r.qs>=60?'text-city-accent-glow':'text-city-rose'}`}>{r.qs}质</span><span className={`text-xs px-1.5 rounded border ${r.qs>=80?'text-city-emerald border-city-emerald/30 bg-city-emerald/5':r.qs>=60?'text-city-accent-glow border-city-accent/30 bg-city-accent/5':'text-city-rose border-city-rose/30 bg-city-rose/5'}`}>{r.qs>=80?'正常':r.qs>=60?'轻降权':'降权'}</span><span className="text-xs text-city-emerald font-semibold w-12 text-right">¥{r.revenue}</span></div>):<p className="text-xs text-gray-600 text-center py-3">还没有 Agent，点「+ 创建」开始吧</p>}</div>
      <div className="space-y-1.5"><p className="text-xs text-gray-500 font-semibold mb-2">表现分析</p><div className="flex items-center justify-between px-3 py-2 rounded-lg bg-city-emerald/5 border border-city-emerald/20"><span className="text-xs text-gray-400">最强组合</span><span className="text-xs text-city-emerald font-medium">{bw?.icon}{bw?.name} + {bd?.icon}{bd?.name}</span></div><div className="flex items-center justify-between px-3 py-2 rounded-lg bg-city-rose/5 border border-city-rose/20"><span className="text-xs text-gray-400">待优化</span><span className="text-xs text-city-rose font-medium">{ww?.icon}{ww?.name} + {wd?.icon}{wd?.name}</span></div><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-city-accent/5 border border-city-accent/15"><span className="text-xs">💡</span><span className="text-xs text-gray-400">{tip}</span></div></div>
    </div></div>
}

// ─── Distribution ─────────────────────────────────────────────────────────────

function distScore(k:string,db:Record<string,Stats>,hist:string[]){const vs=viralScore(k,db)/100;const fr=(db[k]?.uses??0)<2?1:0.3;const pm=hist.includes(k)?0.8:hist.some(h=>h.split('+')[0]===k.split('+')[0]||h.split('+')[1]===k.split('+')[1])?0.4:0.1;return Math.round((vs*.4+fr*.2+pm*.2+(0.3+Math.random()*.4)*.2)*100)}
function qualityScore(k:string,db:Record<string,Stats>){const s=db[k]??EMPTY;const t=s.likes+s.dislikes;return Math.round(((t>0?s.likes/t:.5)*40)+(1-Math.min(1,s.dislikes/Math.max(s.uses+1,1)))*30+Math.min(1,s.recClicks/Math.max(s.uses,1))*30)}
function DistPanel({db,hist,onPick}:{db:Record<string,Stats>;hist:string[];onPick:(w:string,d:string)=>void}){
  const ps=(k:string)=>{const ds=distScore(k,db,hist),qs=qualityScore(k,db);return ds*.5+qs*.3+(PRO_COMBOS.has(k)?10:0)*.2+((db[k]?.uses??0)<10?12:0)-((db[k]?.uses??0)>50?8:0)-(qs<60?15:0)};const sk=[...ALL_KEYS].sort((a,b)=>ps(b)-ps(a));const fresh=ALL_KEYS.filter(k=>!(db[k]?.uses)).slice(0,3);const pers=hist.length?sk.filter(k=>hist.some(h=>h.split('+').some((p,i)=>k.split('+')[i]===p))).slice(0,3):sk.slice(3,6)
  const lbl=(k:string)=>{const u=db[k]?.uses??0;if(PRO_COMBOS.has(k))return{l:'✦推广',c:'text-city-gold border-city-gold/30 bg-city-gold/10'};if(u<10)return{l:'🌱新人',c:'text-city-emerald border-city-emerald/30 bg-city-emerald/10'};if(viralScore(k,db)>=85)return{l:'🔥爆款',c:'text-city-gold border-city-gold/30 bg-city-gold/10'};return{l:'✨推荐',c:'text-city-accent-glow border-city-accent/30 bg-city-accent/10'}}
  const TABS=[{l:'🔥 爆款',ks:sk.slice(0,3),c:'text-city-gold border-city-gold/30 bg-city-gold/5'},{l:'🌱 新晋',ks:fresh,c:'text-city-emerald border-city-emerald/30 bg-city-emerald/5'},{l:'✨ 猜你喜欢',ks:pers,c:'text-city-accent-glow border-city-accent/30 bg-city-accent/5'}]
  return <div className="city-card border border-city-border space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">⚡ 分发推荐</h3><span className="text-xs text-gray-600">60% 爆款 · 20% 个性 · 20% 探索</span></div>
    {TABS.map(t=><div key={t.l}><p className="text-xs text-gray-500 mb-1.5">{t.l}</p><div className="flex flex-wrap gap-1.5">{[...new Set(t.ks)].map(k=>{const[wId='',dId='']=k.split('+');const w=WRITERS.find(x=>x.id===wId);const d=DIRECTORS.find(x=>x.id===dId);if(!w||!d)return null;const lb=lbl(k);return<button key={k} onClick={()=>onPick(wId,dId)} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-all hover:opacity-80 ${t.c}`}>{w.icon}{w.name}<span className="opacity-40 mx-0.5">+</span>{d.icon}{d.name}<span className={`ml-1 text-xs px-1 rounded border ${lb.c}`}>{lb.l}</span></button>})}</div></div>)}
  </div>}

// ─── Scoring ─────────────────────────────────────────────────────────────────

interface ResultScores { viral:number; emotion:number; visual:number; tension:number }

const CAMERA_VIS:Record<string,number>={cinematic:1.0,drone:1.4,handheld:0.8,film:1.0}
const ACTOR_TENS:Record<string,number>={antihero:1.3,hero:1.0,ensemble:1.1,minimal:0.9}
const ACHIEVEMENTS=[
  {n:1,icon:'🎬',title:'第一部作品',desc:'成为创作者'},
  {n:3,icon:'⚡',title:'三连创作',desc:'节奏感拉满'},
  {n:7,icon:'🔥',title:'七日燃烧',desc:'你已上瘾'},
  {n:15,icon:'👑',title:'十五连出品',desc:'产量超越 90%'},
  {n:30,icon:'🏆',title:'月度大师',desc:'城市传说开始'},
]

function computeScores(wId:string,dId:string,aId:string,cId:string,key:string,db:Record<string,Stats>):ResultScores{
  const w=[...WRITERS].find(x=>x.id===wId);const d=DIRECTORS.find(x=>x.id===dId)
  if(!w||!d)return{viral:5,emotion:5,visual:5,tension:5}
  const camB=CAMERA_VIS[cId]??1.0;const actT=ACTOR_TENS[aId]??1.0
  const viral=Math.min(10,Math.round(viralScore(key,db)/10))
  const emotion=Math.min(10,Math.round(((w.scores.emotion??50)+(d.scores.emotion??50))/20))
  const visual=Math.min(10,Math.round((d.scores.pacing??70)/100*7+camB*1.5))
  const tension=Math.min(10,Math.round(((w.scores.twist??60)*0.6+(d.scores.conflict??70)*0.4)/10*actT))
  return{viral,emotion,visual,tension}
}

const SCORE_BARS=[
  {label:'爆款潜力',key:'viral'  as const,color:'bg-city-gold',    text:'text-city-gold'},
  {label:'情绪强度',key:'emotion'as const,color:'bg-city-rose',    text:'text-city-rose'},
  {label:'画面冲击',key:'visual' as const,color:'bg-city-accent',  text:'text-city-accent-glow'},
  {label:'故事张力',key:'tension'as const,color:'bg-city-emerald', text:'text-city-emerald'},
]
function ScoreDisplay({scores}:{scores:ResultScores}){
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2">
    {SCORE_BARS.map(({label,key,color,text})=>{const v=scores[key];return(
      <div key={key}>
        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{label}</span><span className={`font-bold ${text}`}>{v}</span></div>
        <div className="h-1.5 rounded-full bg-city-border overflow-hidden"><div className={`h-full rounded-full ${color} transition-all duration-700`} style={{width:`${v*10}%`}}/></div>
      </div>
    )})}
  </div>
}

function QuickSwapBar({wId,dId,aId,cId,onSwap}:{wId:string;dId:string;aId:string;cId:string;onSwap:(w:string,d:string,a:string,c:string)=>void}){
  const writers=WRITERS.filter(w=>!w.isPro&&w.id!==wId).slice(0,2)
  const dirs=DIRECTORS.filter(d=>d.id!==dId).slice(0,2)
  const cams=CAMERAS.filter(c=>c.id!==cId).slice(0,2)
  const btn='flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-city-border bg-city-surface text-gray-400 hover:border-city-accent/40 hover:text-white transition-all'
  return <div className="space-y-1.5">
    <p className="text-xs text-gray-500">⚡ 快速换一个试试</p>
    <div className="flex gap-1.5 flex-wrap">
      {writers.map(w=><button key={w.id} onClick={()=>onSwap(w.id,dId,aId,cId)} className={btn}>换编剧 {w.icon}{w.name}</button>)}
      {dirs.map(d=><button key={d.id} onClick={()=>onSwap(wId,d.id,aId,cId)} className={btn}>换导演 {d.icon}{d.name}</button>)}
      {cams.map(c=><button key={c.id} onClick={()=>onSwap(wId,dId,aId,c.id)} className={btn}>换摄影 {c.icon}{c.name}</button>)}
    </div>
  </div>
}

function ShareCardModal({onClose,title,writerName,writerIcon,dirName,dirIcon,scores}:{onClose:()=>void;title:string;writerName:string;writerIcon:string;dirName:string;dirIcon:string;scores:ResultScores}){
  const [copied,setCopied]=useState(false)
  function copyText(){
    const t=`🎬 我用 AI 创作了《${title}》\n爆款潜力 ${scores.viral*10}分｜情绪强度 ${scores.emotion*10}分\n画面冲击 ${scores.visual*10}分｜故事张力 ${scores.tension*10}分\n创作团队：${writerIcon}${writerName} + ${dirIcon}${dirName}\ncreator.city`
    navigator.clipboard.writeText(t).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  }
  return <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="city-card border border-city-accent/40 w-full max-w-sm space-y-4" onClick={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-city-accent-glow">📤 分享作品</h3><button onClick={onClose} className="text-gray-500 hover:text-white">✕</button></div>
      <div className="rounded-xl bg-gradient-to-br from-city-accent/15 to-city-surface border border-city-accent/30 p-4 space-y-3">
        <p className="text-base font-bold text-white">{title||'未命名作品'}</p>
        <div className="flex gap-2 text-xs text-gray-400"><span>{writerIcon}{writerName}</span><span>+</span><span>{dirIcon}{dirName}</span></div>
        <div className="grid grid-cols-2 gap-2">
          {SCORE_BARS.map(({label,key,text})=>(
            <div key={key} className="flex justify-between px-2 py-1.5 rounded-lg bg-black/20">
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-xs font-bold ${text}`}>{scores[key]}/10</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 text-right">creator.city</p>
      </div>
      <button onClick={copyText} className={`w-full py-3 rounded-xl border text-sm font-semibold transition-all ${copied?'bg-city-emerald/20 border-city-emerald/40 text-city-emerald':'bg-city-accent/10 border-city-accent/30 text-city-accent-glow hover:bg-city-accent/20'}`}>
        {copied?'✓ 已复制':'复制分享文案'}
      </button>
    </div>
  </div>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SC=(v:number)=>v>=90?'bg-city-emerald':v>=70?'bg-city-accent':'bg-city-gold'
const WL:Record<string,string>={structure:'结构',pacing:'节奏',emotion:'情感',twist:'反转'}
const DL:Record<string,string>={pacing:'节奏',conflict:'冲突',emotion:'情感',clarity:'清晰度'}
function CapCard({a,labels}:{a:AgentBase;labels:Record<string,string>}){return<div className={`rounded-xl border bg-city-accent/5 p-3 space-y-2 ${(a as WriterDef).isPro?'border-city-gold/30':'border-city-accent/20'}`}><div className="flex items-start gap-2"><div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 ${(a as WriterDef).isPro?'bg-city-gold/20 border-city-gold/30':'bg-city-accent/20 border-city-accent/30'}`}>{a.icon}</div><div><p className={`text-xs font-semibold ${(a as WriterDef).isPro?'text-city-gold':'text-city-accent-glow'}`}>{a.name}{(a as WriterDef).isPro&&<span className="ml-1 text-xs px-1 rounded bg-city-gold/20 border border-city-gold/30">PRO</span>}{(a as WriterDef).creator&&<span className="ml-1 text-gray-600 font-normal">·我</span>}</p><p className="text-xs text-gray-400">{a.personality}</p></div></div><div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{(Object.entries(a.scores) as [string,number][]).map(([k,v])=><div key={k}><div className="flex justify-between text-xs text-gray-500 mb-0.5"><span>{labels[k]??k}</span><span>{v}</span></div><div className="h-1 rounded-full bg-city-border overflow-hidden"><div className={`h-full rounded-full ${SC(v)}`} style={{width:`${v}%`}}/></div></div>)}</div></div>}

function TileSelect<T extends {id:string;icon:string;name:string;bestFor:string;desc?:string;style?:string}>({items,activeId,onSelect,label}:{items:T[];activeId:string;onSelect:(id:string)=>void;label:string}){
  return <div><p className="text-xs text-gray-500 mb-2">{label}</p><div className="grid grid-cols-2 gap-1.5">{items.map(item=><button key={item.id} onClick={()=>onSelect(item.id)} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all duration-200 card-lift ${activeId===item.id?'bg-city-accent/15 border-city-accent/50 text-city-accent-glow':'bg-city-surface border-city-border text-gray-400 hover:border-city-accent/30 hover:text-white'}`}><span className="text-base flex-shrink-0">{item.icon}</span><div className="min-w-0"><p className="text-xs font-semibold truncate">{item.name}</p><p className="text-xs text-gray-600 truncate">{item.desc??item.style??''}</p></div></button>)}</div></div>
}

// ─── Gen Step Animation ──────────────────────────────────────────────────────

const delay = (ms:number) => new Promise<void>(r => setTimeout(r, ms))
const GEN_STEPS = ['正在匹配编剧','正在匹配导演','正在生成分镜','正在渲染画面']

function GenStepsUI({step}:{step:number}){
  return <div className="rounded-xl border border-city-accent/20 bg-city-accent/5 p-3 space-y-1.5">
    <div className="flex items-center gap-2 mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-city-accent animate-pulse"/>
      <span className="text-xs text-city-accent-glow font-semibold">AI 创作团队工作中</span>
    </div>
    {GEN_STEPS.map((label,i)=>{
      const done=i<step;const active=i===step
      return <div key={i} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-500 ${done?'opacity-50':active?'opacity-100':'opacity-20'}`}>
        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] transition-all ${done?'bg-city-emerald text-white':active?'bg-city-accent/20 border border-city-accent/40':''}`}>
          {done?'✓':active?<span className="w-1.5 h-1.5 rounded-full bg-city-accent block animate-pulse"/>:null}
        </div>
        <span className={`text-xs transition-colors ${active?'text-city-accent-glow':'text-gray-600'}`}>{label}{active?'…':''}</span>
        {active&&<div className="ml-auto flex gap-0.5">{[0,1,2].map(j=><span key={j} className="w-1 h-1 rounded-full bg-city-accent/50 animate-pulse" style={{animationDelay:`${j*150}ms`}}/>)}</div>}
      </div>
    })}
  </div>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function AICreatorBox({initialPrompt=''}:{initialPrompt?:string}){
  const [input,setInput]=useState('');const [phase,setPhase]=useState<Phase>('idle');const [scenes,setScenes]=useState<Scene[]>([])
  const [writerId,setWriterId]=useState('commercial');const [dirId,setDirId]=useState('commercial');const [userAgents,setUserAgents]=useState<WriterDef[]>([])
  const [showCreate,setShowCreate]=useState(false);const [showDash,setShowDash]=useState(false);const [feedback,setFeedback]=useState<'good'|'bad'|null>(null);const [hist,setHist]=useState<string[]>([])
  const [db,setDb]=useState<Record<string,Stats>>({});const [unlocked,setUnlocked]=useState(new Set<string>());const [lockTarget,setLockTarget]=useState<string|null>(null)
  const [actorId,setActorId]=useState('hero');const [cameraId,setCameraId]=useState('drone');const [quotaLeft,setQuotaLeft]=useState(3)
  const [genStep,setGenStep]=useState(-1);const [showCustom,setShowCustom]=useState(false)
  const [scenesB,setScenesB]=useState<Scene[]>([]);const [genStepB,setGenStepB]=useState(-1);const [comboB,setComboB]=useState<{wId:string;dId:string;aId:string;cId:string}|null>(null);const [activeTab,setActiveTab]=useState<'A'|'B'|'both'>('A')
  const [totalGens,setTotalGens]=useState(0);const [achievement,setAchievement]=useState<string|null>(null);const [showShare,setShowShare]=useState(false)
  useEffect(()=>{if(initialPrompt.trim())setInput(initialPrompt)},[initialPrompt])
  const allW=[...WRITERS,...userAgents];const writer=allW.find(w=>w.id===writerId)!;const director=DIRECTORS.find(d=>d.id===dirId)!
  const key=`${writerId}+${dirId}`;const vs=viralScore(key,db);const beatPct=Math.round(ALL_KEYS.filter(k=>viralScore(k,db)<vs).length/ALL_KEYS.length*100)
  const rec:Rec|null=(input.trim()&&phase==='idle')?(REC_MAP[detectTheme(input)]??null):null
  const curLocked=PRO_COMBOS.has(key)&&!unlocked.has(key)
  const scores=computeScores(writerId,dirId,actorId,cameraId,key,db)
  const scoresB=comboB?computeScores(comboB.wId,comboB.dId,comboB.aId,comboB.cId,`${comboB.wId}+${comboB.dId}`,db):null

  function checkAchievement(n:number){
    const a=ACHIEVEMENTS.find(x=>x.n===n)
    if(a){setAchievement(`${a.icon} ${a.title} — ${a.desc}`);setTimeout(()=>setAchievement(null),3500)}
  }

  async function runGeneration(wId:string,dId:string,aId:string,cId:string){
    const k=`${wId}+${dId}`;const isLocked=PRO_COMBOS.has(k)&&!unlocked.has(k)
    if(!input.trim()||phase!=='idle'||isLocked||quotaLeft<=0)return
    setWriterId(wId);setDirId(dId);setActorId(aId);setCameraId(cId)
    setQuotaLeft(q=>q-1);setScenes([]);setFeedback(null)
    setScenesB([]);setComboB(null);setActiveTab('A')
    setGenStep(0);setHist(h=>[...new Set([...h,k])])
    setDb(prev=>upd(prev,k,'uses'));setPhase('writing')
    const n=totalGens+1;setTotalGens(n);checkAchievement(n)
    const aw=[...WRITERS,...userAgents].find(w=>w.id===wId)!
    const ad=DIRECTORS.find(d=>d.id===dId)!
    await delay(650);setGenStep(1)
    const draft=aw.draft(input.trim());setPhase('directing')
    await delay(520);setGenStep(2)
    const rp=ad.review(draft,()=>{})
    await delay(480);setGenStep(3)
    const final=await rp;setScenes(final);setPhase('done');setGenStep(-1)
  }
  async function handleRun(){return runGeneration(writerId,dirId,actorId,cameraId)}
  function handleApplyPreset(c:PresetCombo){
    setWriterId(c.writerId);setDirId(c.dirId);setActorId(c.actorId);setCameraId(c.cameraId)
    if(input.trim())runGeneration(c.writerId,c.dirId,c.actorId,c.cameraId)
    else document.getElementById('creator-input')?.focus()
  }

  async function runGenerationB(wId:string,dId:string,aId:string,cId:string){
    if(!input.trim()||genStepB>=0)return
    const n=totalGens+1;setTotalGens(n);checkAchievement(n)
    setScenesB([]);setComboB({wId,dId,aId,cId});setGenStepB(0)
    const aw=[...WRITERS,...userAgents].find(w=>w.id===wId)!
    const ad=DIRECTORS.find(d=>d.id===dId)!
    if(!aw||!ad)return
    await delay(650);setGenStepB(1)
    const draft=aw.draft(input.trim())
    await delay(520);setGenStepB(2)
    const rp=ad.review(draft,()=>{})
    await delay(480);setGenStepB(3)
    const final=await rp;setScenesB(final);setGenStepB(-1);setActiveTab('B')
  }

  const Sel=({list,activeId,onSelect,label,extra}:{list:WriterDef[];activeId:string;onSelect:(id:string)=>void;label:string;extra?:React.ReactNode})=>(
    <div><div className="flex items-center justify-between mb-2"><p className="text-xs text-gray-500">{label}</p>{extra}</div>
      <div className="flex gap-1.5 flex-wrap">{list.map(a=>{const locked=!!a.isPro&&!unlocked.has(a.id);return<button key={a.id} onClick={()=>{if(phase!=='idle')return;if(locked){setLockTarget(`w:${a.id}`);}else onSelect(a.id)}} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${locked?'opacity-50 border-city-gold/30 text-city-gold bg-city-gold/5 hover:opacity-80':activeId===a.id?'bg-city-accent/20 border-city-accent/50 text-city-accent-glow':'bg-city-surface border-city-border text-gray-400 hover:border-city-accent/30 hover:text-white'}`}>{a.icon}{a.name}{locked&&'🔒'}{a.isPro&&!locked&&<span className="text-city-gold">✦</span>}</button>})}</div></div>
  )
  const DSel=()=><div><p className="text-xs text-gray-500 mb-2">选择导演</p><div className="flex gap-1.5 flex-wrap">{DIRECTORS.map(d=><button key={d.id} onClick={()=>{if(phase==='idle')setDirId(d.id)}} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${dirId===d.id?'bg-city-accent/20 border-city-accent/50 text-city-accent-glow':'bg-city-surface border-city-border text-gray-400 hover:border-city-accent/30 hover:text-white'}`}>{d.icon}{d.name}</button>)}</div></div>

  return <section id="creator-section" className="py-16 px-4"><div className="max-w-2xl mx-auto"><div className="text-center mb-8"><h2 className="text-2xl font-bold mb-2">选择你的<span className="text-gradient">创作组合</span></h2><p className="text-sm text-gray-500">选择预设组合或自定义 4 维度创作风格</p></div><div className="space-y-3">
    {showCreate&&<CreateModal onClose={()=>setShowCreate(false)} onCreate={a=>{setUserAgents(p=>[...p,a]);setWriterId(a.id)}}/>}
    {showDash&&<CreatorDashboard agents={userAgents} db={db} onClose={()=>setShowDash(false)}/>}
    {lockTarget&&<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={()=>setLockTarget(null)}>
      <div className="city-card border border-city-gold/40 w-full max-w-sm space-y-4" onClick={e=>e.stopPropagation()}>
        <div className="text-center"><p className="text-2xl mb-2">👑</p><h3 className="text-base font-bold text-city-gold">解锁 PRO 权限</h3><p className="text-xs text-gray-400 mt-1">解锁后获得更强创作力：极端情绪、史诗尺度、顶级评分</p></div>
        <div className="space-y-1.5">{PRO_BOOSTS.map(b=><div key={b.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-city-surface"><span className="text-xs text-gray-400">{b.label}</span><span className={`text-xs font-bold ${b.c}`}>{b.boost} ↑</span></div>)}</div>
        <button onClick={()=>{setUnlocked(prev=>{const n=new Set(prev);const id=lockTarget.replace('w:','');n.add(id);return n});setLockTarget(null)}} className="w-full py-3 rounded-xl bg-gradient-to-r from-city-gold/80 to-city-accent text-white text-sm font-semibold glow transition-all hover:opacity-90">立即解锁（模拟）</button>
        <button onClick={()=>setLockTarget(null)} className="w-full text-xs text-gray-600 hover:text-white transition-colors">取消</button>
      </div></div>}
    <RecommendedCombos onApply={handleApplyPreset}/>
    <div className="flex items-center justify-between flex-wrap gap-2"><p className="text-xs text-gray-600">AI 创作工作台</p><div className="flex items-center gap-2"><div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${quotaLeft>0?'border-city-emerald/30 bg-city-emerald/5 text-city-emerald':'border-city-rose/30 bg-city-rose/5 text-city-rose'}`}>今日免费 <span className="font-bold">{quotaLeft}/3</span></div>{quotaLeft===0&&<button onClick={()=>setLockTarget('upgrade')} className="text-xs px-2.5 py-1 rounded-full bg-city-gold/10 text-city-gold border border-city-gold/30 hover:bg-city-gold/20 transition-colors">升级 Pro ¥29/月</button>}<button onClick={()=>setShowDash(true)} className="text-xs px-2.5 py-1 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">📊 后台</button></div></div>
    {rec&&<div className="rounded-xl border border-city-accent/40 bg-gradient-to-br from-city-accent/10 to-city-accent/5 p-4 shadow-lg shadow-city-accent/10"><div className="flex items-start gap-3"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-xs text-city-accent-glow font-semibold">✦ 智能推荐</span><span className="text-xs px-1.5 py-0.5 rounded-full bg-city-accent/20 text-city-accent-glow font-bold">{rec.score}</span></div><p className="text-sm font-semibold mb-1">{rec.title}</p><p className="text-xs text-gray-400 mb-2">{rec.reason}</p><div className="flex gap-1">{rec.tags.map(t=><span key={t} className="text-xs px-1.5 py-0.5 rounded bg-city-accent/20 text-city-accent-glow border border-city-accent/30">{t}</span>)}</div></div><button onClick={()=>{setWriterId(rec.writerId);setDirId(rec.dirId);setDb(prev=>upd(prev,`${rec.writerId}+${rec.dirId}`,'recClicks'))}} className="flex-shrink-0 px-3 py-2 rounded-xl bg-city-accent hover:bg-city-accent-glow text-white text-xs font-semibold transition-all glow">一键使用</button></div></div>}
    <div className="city-card border border-city-accent/20 space-y-4">
      <div>
        <button onClick={()=>setShowCustom(v=>!v)} className="flex items-center justify-between w-full text-xs text-gray-500 hover:text-city-accent-glow transition-colors px-1 py-1.5 rounded-lg hover:bg-city-accent/5">
          <span>🎛️ 自定义配置</span>
          <span className={`transition-transform duration-200 leading-none text-base ${showCustom?'rotate-180':''}`}>▾</span>
        </button>
        {showCustom&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div className="space-y-2"><Sel list={allW} activeId={writerId} onSelect={setWriterId} label="📖 选择编剧" extra={<button onClick={()=>setShowCreate(true)} className="text-xs px-2 py-1 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">+ 创建</button>}/><CapCard a={writer} labels={WL}/></div>
          <div className="space-y-2"><DSel/><CapCard a={director} labels={DL}/></div>
          <TileSelect items={ACTORS}  activeId={actorId}  onSelect={setActorId}  label="🎭 演员类型"/>
          <TileSelect items={CAMERAS} activeId={cameraId} onSelect={setCameraId} label="🎥 摄影风格"/>
        </div>}
      </div>
      <div className="flex gap-2 border-t border-city-border pt-3">
        <input id="creator-input" type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleRun()} placeholder="告诉团队你的故事创意……" className="flex-1 bg-city-bg border border-city-border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-city-accent/60 transition-colors"/>
        <button onClick={handleRun} disabled={!input.trim()||phase!=='idle'||curLocked||quotaLeft<=0} className="px-5 py-3 rounded-xl bg-city-accent disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold glow-hover transition-all flex-shrink-0">{curLocked?'🔒 已锁定':quotaLeft<=0?'今日已用完':phase==='idle'?'开始创作':'创作中…'}</button>
      </div>
      {curLocked&&<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-city-gold/5 border border-city-gold/20"><span className="text-xs text-city-gold">此组合为 PRO 专属</span><button onClick={()=>setLockTarget(key)} className="text-xs px-2 py-1 rounded-lg bg-city-gold/20 text-city-gold border border-city-gold/30 hover:bg-city-gold/30 transition-colors">解锁</button></div>}
      {genStep>=0&&<GenStepsUI step={genStep}/>}
    </div>
    {scenes.length>0&&<div className="city-card border border-city-border space-y-3">
      {/* Score header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><p className="text-lg font-bold text-city-accent-glow">{vs} <span className="text-xs text-gray-500 font-normal">爆款指数</span></p><p className="text-xs text-gray-500">已超过 {beatPct}% 的创作</p></div>
        <div className="flex items-center gap-2">
          {vs>=85&&<span className="text-xs px-2 py-0.5 rounded-full bg-city-gold/20 text-city-gold border border-city-gold/30">🔥 爆款</span>}
          <button onClick={()=>setShowShare(true)} className="text-xs px-2.5 py-1.5 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">📤 分享</button>
        </div>
      </div>
      <ScoreDisplay scores={scores}/>

      {/* Version tabs */}
      {scenesB.length>0&&<div className="flex gap-1 rounded-xl bg-city-surface border border-city-border p-1">
        {(['A','B','both'] as const).map(tab=>(
          <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab===tab?'bg-city-accent/20 text-city-accent-glow':'text-gray-500 hover:text-white'}`}>
            {tab==='A'?'版本 A':tab==='B'?`版本 B${scoresB?' · '+scoresB.viral*10+'分':''}`: '对比'}
          </button>
        ))}
      </div>}

      {/* Scene list — single version */}
      {activeTab!=='both'&&(activeTab==='A'?scenes:scenesB).map((s,i)=>(
        <div key={i} className="flex gap-3 rounded-xl border border-city-border bg-city-surface/60 p-3 hover:border-city-accent/30 transition-all">
          <div className="w-6 h-6 flex-shrink-0 rounded-md bg-city-accent/10 border border-city-accent/20 flex items-center justify-center text-city-accent-glow text-xs font-bold">{i+1}</div>
          <div><p className="text-xs font-semibold text-white mb-0.5">{s.title}</p><p className="text-xs text-gray-400 leading-relaxed">{s.description}</p></div>
        </div>
      ))}

      {/* Side-by-side comparison */}
      {activeTab==='both'&&<div className="grid grid-cols-2 gap-2">
        <div className="space-y-2"><p className="text-xs text-city-accent-glow font-semibold mb-1">版本 A</p>{scenes.map((s,i)=><div key={i} className="rounded-xl border border-city-border bg-city-surface/60 p-2.5"><p className="text-xs font-semibold text-white mb-0.5">{s.title}</p><p className="text-xs text-gray-400 leading-relaxed">{s.description}</p></div>)}</div>
        <div className="space-y-2"><p className="text-xs text-city-rose font-semibold mb-1">版本 B</p>{scenesB.map((s,i)=><div key={i} className="rounded-xl border border-city-border bg-city-surface/60 p-2.5"><p className="text-xs font-semibold text-white mb-0.5">{s.title}</p><p className="text-xs text-gray-400 leading-relaxed">{s.description}</p></div>)}</div>
      </div>}

      {/* Quick swap bar */}
      <QuickSwapBar wId={writerId} dId={dirId} aId={actorId} cId={cameraId} onSwap={runGenerationB}/>

      {/* Re-generate B */}
      {genStepB>=0?<GenStepsUI step={genStepB}/>:
        <button onClick={()=>runGenerationB(writerId,dirId,actorId,cameraId)} className="w-full py-2 rounded-xl border border-city-border text-xs text-gray-400 hover:border-city-accent/30 hover:text-city-accent-glow transition-all bg-city-surface/40">
          再生成一个版本 →
        </button>
      }

      {/* Feedback + meta */}
      <div className="flex items-center gap-2 flex-wrap border-t border-city-border pt-3">
        <span className="text-xs px-2 py-0.5 rounded bg-city-surface border border-city-border text-gray-500">{ACTORS.find(a=>a.id===actorId)?.icon} {ACTORS.find(a=>a.id===actorId)?.name}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-city-surface border border-city-border text-gray-500">{CAMERAS.find(c=>c.id===cameraId)?.icon} {CAMERAS.find(c=>c.id===cameraId)?.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {feedback?<span className="text-xs text-gray-500">{feedback==='good'?'👍 感谢':'👎 已记录'}</span>:<><span className="text-xs text-gray-600">推荐准确？</span><button onClick={()=>{setFeedback('good');setDb(prev=>upd(prev,key,'likes'))}} className="text-sm hover:scale-110 transition-transform">👍</button><button onClick={()=>{setFeedback('bad');setDb(prev=>upd(prev,key,'dislikes'))}} className="text-sm hover:scale-110 transition-transform">👎</button></>}
          <button onClick={()=>{setPhase('idle');setScenes([]);setFeedback(null);setScenesB([]);setComboB(null)}} className="text-xs text-gray-600 hover:text-white transition-colors ml-1">重置</button>
        </div>
      </div>

      {/* PRO upsell */}
      {!writer.isPro&&<div className="rounded-xl border border-city-gold/30 bg-city-gold/5 p-3"><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-city-gold">✦ 解锁增强版本</span><button onClick={()=>setLockTarget('w:pro_noir')} className="text-xs px-2 py-1 rounded-lg bg-city-gold/20 text-city-gold border border-city-gold/30 hover:bg-city-gold/30 glow transition-all">解锁 PRO</button></div><div className="flex gap-3">{PRO_BOOSTS.map(b=><div key={b.label} className="text-center"><p className="text-xs text-gray-500">{b.label}</p><p className={`text-sm font-bold ${b.c}`}>{b.boost}</p></div>)}</div></div>}
    </div>}

    {/* Achievement toast */}
    {achievement&&<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="px-5 py-3 rounded-2xl bg-city-gold/20 border border-city-gold/40 text-city-gold text-sm font-semibold shadow-xl backdrop-blur-sm whitespace-nowrap animate-pulse">
        🏅 成就解锁：{achievement}
      </div>
    </div>}

    {/* Share modal */}
    {showShare&&<ShareCardModal onClose={()=>setShowShare(false)} title={scenes[0]?.title??'我的创作'} writerName={writer?.name??''} writerIcon={writer?.icon??''} dirName={director?.name??''} dirIcon={director?.icon??''} scores={scores}/>}
    <Leaderboard db={db} unlocked={unlocked} onSelect={(w,d)=>{if(phase==='idle'){setWriterId(w);setDirId(d)}}} onLock={k=>setLockTarget(k)}/>
    <DistPanel db={db} hist={hist} onPick={(w,d)=>{if(phase==='idle'){setWriterId(w);setDirId(d)}}}/>
  </div></div></section>
}

// ─── Create Page ─────────────────────────────────────────────────────────────

function CreatePageInner() {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? ''
  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />
      <div className="pt-14">
        <AICreatorBox initialPrompt={initialPrompt} />
      </div>
    </main>
  )
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  )
}
