import {markets,isFuture,assetType,defaultCurrency,holdingIdentity,contractLabel} from './assets.js?v=8e5b777ad36ef979';
import {validateRecommendation,recommendationPerformance,recommendationSyncTime} from './recommendations.js?v=8e5b777ad36ef979';
import {t, ui, language, setLanguage, locale, languageControl, tagLabel, securityName} from './language.js?v=8e5b777ad36ef979';
import {clientSummaryCsv,clientsCsv,recommendationsCsv} from './export-csv.js?v=8e5b777ad36ef979';
import {createQuoteCache,unrealizedPnl} from './holding-prices.js?v=8e5b777ad36ef979';
import {textSizes,textSize,setTextSize,textSizeControl,tagPalette,validTagColor,tagColors} from './preferences.js?v=8e5b777ad36ef979';
setTextSize(textSize());
const cloudApi = globalThis.FORTHRIGHT_CONFIG ? (await import('./cloud-api.js?v=8e5b777ad36ef979')).createCloudApi(globalThis.FORTHRIGHT_CONFIG) : null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${({download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',tag:'<path d="M20 13 13 20a2 2 0 0 1-3 0l-8-8V2h10l8 8a2 2 0 0 1 0 3Z"/><circle cx="7" cy="7" r="1"/>',briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a22 22 0 0 0 18 0M12 12v3"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 5 7 7-7 7"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',logout:'<path d="M9 21H3V3h6M9 12h12m-5-5 5 5-5 5"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',book:'<path d="M12 5v16M12 5C9 2 5 3 2 4v15c3-1 7-2 10 2 3-4 7-3 10-2V4c-3-1-7-2-10 1Z"/>',check:'<path d="m5 12 4 4L19 6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'})[name] ?? ''}</svg>`;
const state = { user:null, demo:false, clients:[], recommendations:[], recommendationsSync:null,recommendationsSyncRequest:null, tags:[], catalog:{}, securityNames:{}, view:'clients', query:'', tag:'', tier:'', market:'', page:1, expandedClients:new Set(), draft:null, securityResults:[], searchSeq:0, users:[] };
let toastTimer, searchTimer, csvExportPending=false;
const quoteCache=createQuoteCache(symbols=>api('/quotes','POST',{symbols}));
function toast(message) { $('#toast').textContent=t(message); $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000); }
async function api(path, method='GET', body) {
 try {
  if(cloudApi) return await cloudApi(path,method,body);
  const res = await fetch(`/api${path}`,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data = await res.json();
  if(!res.ok) throw Object.assign(new Error(data.error ?? t('操作失敗')),{status:res.status});
  return data;
 } catch(e) { if(e.status===401 && path!=='/login') { clearPrivateState(); $('#modal').close(); render(); } throw e; }
}
function clearPrivateState(){ quoteCache.clear();Object.assign(state,{user:null,clients:[],recommendations:[],recommendationsSync:null,recommendationsSyncRequest:null,tags:[],users:[],securityNames:{},quotesEnabled:false,quoteConnection:null,draft:null,editRecommendation:null,view:'clients',query:'',tag:'',tier:'',market:'',page:1,expandedClients:new Set()}); modal.innerHTML=''; }
const formatDate = d => new Date(d).toLocaleDateString(locale(),{month:'short',day:'numeric'});
const tagHtml = id => { const i=state.tags.findIndex(t=>t.id===id), t=state.tags[i]; return t?`<span class="tag t${i%6}" data-tag-color="${validTagColor(t.color)?t.color:''}">${esc(tagLabel(t.name))}</span>`:''; };
const options = (items,value) => items.map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('');
const marketLabels=Object.fromEntries(Object.entries(markets).map(([key,label])=>[key,{toString:()=>t(label)}]));
const marketOptions=()=>Object.entries(markets).map(([key,label])=>[key,t(label)]);
const currencies=['USD','HKD','CNY','EUR','GBP','JPY','AUD','CAD','SGD','CHF','OTHER'];
const modal = $('#modal');
function applyTagColors(){for(const el of document.querySelectorAll('[data-tag-color]')){const colors=tagColors(el.dataset.tagColor);if(colors){el.style.setProperty('--tag-background',colors.background);el.style.setProperty('--tag-foreground',colors.foreground);}}}
function showModal(content) { modal.innerHTML=content; applyTagColors(); if(!modal.open) modal.showModal(); }
function modalHead(title,sub='') { return ui`<div class="modal-head"><div><h2 id="modal-title">${esc(title)}</h2><small>${esc(sub)}</small></div><button type="button" class="icon-btn" data-action="close" aria-label="關閉">${icon('close')}</button></div>`; }
const errorBlock='<div class="form-error" id="form-error" role="alert"></div>';
function loginView(){ return ui`<div class="login"><div class="login-language">${languageControl()}${textSizeControl()}</div><aside class="login-brand"><div class="brand"><img class="brand-logo" src="./forthright-logo.svg" width="116" height="36" alt="方德證券｜新一代互聯網券商"><img class="brand-icon" src="./forthright-icon.svg" width="24" height="24" alt="方德證券"></div><div class="login-copy"><div class="eyebrow">PRIVATE CLIENT SERVICES</div><h1>以細節，<br>連結每一份信任。</h1><p>方德高淨值客戶服務工作台<br>讓客戶關係與資產資料，清晰有序。</p></div><div class="login-footer">FORTHRIGHT · HNW CLIENT WORKSPACE</div></aside><main class="login-form-side"><div class="login-card"><div class="eyebrow">TEAM ACCESS</div><h2>歡迎回來</h2><p>登入團隊帳號，開始今天的客戶服務。</p>${state.demo?t('<div class="notice">操作示例 · 全部客戶均為虛構資料<br>帳號 <b>demo</b> ／ 密碼 <b>ForthrightDemo2026!</b></div>'):''}<form data-form="login"><div class="field"><label for="username">團隊帳號</label><input id="username" name="username" autocomplete="username" required placeholder="輸入帳號"></div><div class="field"><label for="password">密碼</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="輸入密碼"></div>${errorBlock}<button class="btn primary" type="submit">登入工作台 ${icon('chevron')}</button></form><div class="login-note">${icon('lock')} 僅供方德獲授權團隊成員使用<br>如需帳號，請聯絡團隊管理員。</div></div></main></div>`; }
async function load(){ Object.assign(state,await api('/data')); }
function render(){
  document.documentElement.lang=language(); document.title=t('Forthright · 客戶服務工作台');
  if(!state.user){ $('#app').innerHTML=loginView(); return; }
  const views={clients:t('客戶工作台'),holdings:t('持倉總覽'),recommendations:t('股票推介'),tags:t('標籤管理'),catalog:t('證券目錄'),team:t('團隊帳號')};
  $('#app').innerHTML=ui`<div class="shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="./forthright-logo.svg" width="116" height="36" alt="方德證券｜新一代互聯網券商"><img class="brand-icon" src="./forthright-icon.svg" width="24" height="24" alt="方德證券"></div><div class="brand-sub">PRIVATE CLIENT SERVICES</div><div class="nav-label">WORKSPACE</div><nav class="nav" aria-label="主要導覽">${[['clients','grid',t('客戶工作台')],['holdings','briefcase',t('持倉總覽')],['recommendations','grid',t('股票推介')],['tags','tag',t('標籤管理')],['catalog','book',t('證券目錄')],...(state.user.role==='admin'?[['team','users',t('團隊帳號')]]:[])].map(([v,i,l])=>`<button data-action="nav" data-id="${v}" class="${state.view===v?'active':''}" aria-label="${l}" ${state.view===v?'aria-current="page"':''}>${icon(i)}<span>${l}</span>${v==='clients'?`<span class="count">${state.clients.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="private-note">${icon('lock')} 私人團隊空間<br>每一份客戶信任，妥善守護。</div><div class="user-row"><div class="user-avatar">${esc(state.user.username.slice(0,2).toUpperCase())}</div><div><div class="user-name">${esc(state.user.username)}</div><div class="user-role">${state.user.role==='admin'?t('團隊管理員'):t('團隊成員')}</div></div><button class="icon-btn" data-action="password" aria-label="更改密碼">${icon('lock')}</button><button class="icon-btn" data-action="logout" aria-label="登出">${icon('logout')}</button></div></div></aside><main class="main">${state.demo?t('<div class="demo-banner">操作示例 · 虛構客戶資料 · 此預覽只在本機運行</div>'):state.sharedDemo?t('<div class="demo-banner">團隊試用 · 虛構示例客戶 · 儲存後全團隊可見</div>'):''}<header class="topbar"><div class="breadcrumb">方德 HNW <span>／ ${views[state.view]}</span></div><div class="top-meta"><span>${new Date().toLocaleDateString(locale(),{year:'numeric',month:'long',day:'numeric'})}</span><span id="sync-status"><i class="live-dot"></i>${state.cloud?t('共享資料 · 每 15 秒同步'):t('團隊共享空間')}</span>${languageControl()}${textSizeControl()}</div></header><div class="workspace">${({clients:clientsView,holdings:holdingsView,recommendations:recommendationsView,tags:tagsView,catalog:catalogView,team:teamView})[state.view]()}</div></main></div>`;
  if(state.view==='clients') renderClientRows();
  if(state.view==='recommendations')void loadHoldingPrices();
  applyTagColors();
}
function pageHeading(eyebrow,title,description,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;}
function stat(label,value,foot,i){return `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(i)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`;}
function clientsView(){
  const groups=new Set(state.clients.map(c=>c.groupName).filter(Boolean));
  const awaiting=state.tags.find(t=>t.name==='沒有回應');
  return ui`${pageHeading('CLIENT RELATIONSHIPS',t('客戶工作台'),t('掌握每位客戶的互動特徵與資產持倉，讓服務更有溫度。'),ui`<button class="btn" data-action="export-csv" title="包含全部客戶，不受分頁或篩選影響">${icon('download')} 匯出全部客戶 CSV</button><button class="btn" data-action="refresh">${icon('refresh')}<span class="refresh-label">重新整理</span></button><button class="btn primary" data-action="new-client">${icon('plus')} 新增客戶</button>`)}<section class="stats" aria-label="客戶概覽">${stat(t('客戶總數'),state.clients.length,t('已建立的客戶檔案'),'users')}${stat(t('服務群組'),groups.size,t('以服務群名稱統計'),'grid')}${stat(t('已記錄持倉'),state.clients.filter(c=>c.holdings.length).length,t('已登記至少一項資產的客戶'),'briefcase')}${stat(t('沒有回應'),state.clients.filter(c=>awaiting&&c.tags.includes(awaiting.id)).length,t('按團隊所選標籤統計'),'tag')}</section><section class="panel"><div class="panel-title"><div><h2>客戶名單</h2><small>CLIENT DIRECTORY</small></div><span class="pill">團隊共用 · 手動儲存</span></div><div class="filters"><div class="search-wrap">${icon('search')}<input id="client-search" aria-label="搜尋客戶" placeholder="搜尋姓氏、尾兩碼、群組或持倉代號" value="${esc(state.query)}"></div><select id="tag-filter" aria-label="按標籤篩選">${options([['',t('所有標籤')],...state.tags.map(tag=>[tag.id,tagLabel(tag.name)])],state.tag)}</select><select id="tier-filter" aria-label="按會員級別篩選">${options([['',t('所有級別')],['黑鑽',t('黑鑽會員')],['鑽石',t('鑽石會員')],['其他','其他']],state.tier)}</select><select id="market-filter" aria-label="按持倉市場篩選">${options([['',t('所有持倉市場')],...marketOptions()],state.market)}</select></div><div class="filter-info"><span id="filter-count"></span><button class="text-btn" data-action="clear-filters">清除篩選</button></div><div id="client-results"></div></section><div class="bottom-note"><span class="footer-lock">${icon('lock')} 僅顯示 WhatsApp 尾兩碼 · 點選客戶展開全部持倉</span><span>FORTHRIGHT · PRIVATE CLIENT SERVICES</span></div>`;
}
function filteredClients(){const q=state.query.trim().toLowerCase(); return state.clients.filter(c=>(!q||`${c.surname} ${c.last2} ${c.groupName} ${c.holdings.map(h=>`${h.symbol} ${h.name} ${securityName(h,state.securityNames)}`).join(' ')}`.toLowerCase().includes(q))&&(!state.tag||c.tags.includes(state.tag))&&(!state.tier||c.tier===state.tier)&&(!state.market||c.holdings.some(h=>h.market===state.market)));}
function holdingValue(value){return value===''||value==null?t('未提供'):typeof value==='number'?value.toLocaleString(locale(),{maximumFractionDigits:20}):esc(value);}
function money(value,currency,signed=false,precision=2){return `${esc(currency)} ${value.toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:precision,signDisplay:signed?'exceptZero':'auto'})}`;}
function holdingPrice(h){
  const quote=quoteCache.read(h),pnl=unrealizedPnl(h,quote),available=quote.status==='available';
  const reasons={'loading':t('載入報價中'),'not-configured':t('報價來源待接入'),'unsupported':t('此資產暫不支援報價'),'unavailable':t('暫無報價')};
  const pnlReasons={'missing-position':t('請補充數量及平均成本'),'currency-mismatch':t('成本與報價幣種不同'),'invalid-position':t('請檢查持倉數值'),'missing-contract':t('合約資料未確認'),'no-quote':reasons[quote.status]||t('暫無報價')};
  const change=pnl.status==='available'?`${money(pnl.amount,pnl.currency,true)}<small>${pnl.basis==='contract-multiplier'?`${t('合約乘數')} × ${holdingValue(pnl.contractMultiplier)} · ${t('未計費用')}`:pnl.percent===null?t('回報率 —'):pnl.percent.toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'})+'%'}</small>`:`<span class="holding-price-empty">—<small>${pnlReasons[pnl.status]}</small></span>`;
  const timing=available?`${quote.session==='closed'?t('收市價'):quote.delayMinutes===null?t('報價延遲未確認'):quote.delayMinutes===0?t('即時報價'):ui`${quote.delayMinutes} 分鐘延遲`} · ${new Date(quote.asOf).toLocaleString(locale(),{timeZone:'Asia/Hong_Kong',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})} HKT · ${esc(quote.source)}`:reasons[quote.status];
  return ui`<dl class="holding-prices"><div><dt>現價</dt><dd>${available?money(quote.price,quote.currency,false,6):`<span class="holding-price-empty">—</span>`}</dd></div><div><dt>未實現盈虧</dt><dd class="${pnl.status==='available'?(pnl.amount>0?'pnl-gain':pnl.amount<0?'pnl-loss':''):''}">${change}</dd></div></dl><p class="holding-quote-time">${timing}</p>`;
}
function expandedHoldings(){return state.clients.filter(c=>state.expandedClients.has(c.id)&&document.getElementById(`client-holdings-${c.id}`)).flatMap(c=>c.holdings);}
function exportCounts(clients){
  return {clients:clients.length,holdings:clients.reduce((sum,c)=>sum+c.holdings.length,0),rows:clients.reduce((sum,c)=>sum+Math.max(1,c.holdings.length),0)};
}
async function clientExportModal(){
  if(csvExportPending||!state.user)return;
  csvExportPending=true;
  const identity=state.user.id;
  try{
    toast(t('正在載入全部客戶資料…'));
    const data=await api('/data');
    if(state.user?.id!==identity)return;
    Object.assign(state,data);render();
    const counts=exportCounts(state.clients);
    showModal(ui`${modalHead(t('匯出全部客戶 CSV'),t('包含所有頁面及已收起的持倉，不受搜尋或篩選影響。'))}<div class="modal-body export-options"><p class="export-counts"><strong>${counts.clients}</strong> 位客戶 · <strong>${counts.holdings}</strong> 項持倉</p><section class="export-option"><h3>完整持倉明細</h3><p>每項持倉一行；沒有持倉的客戶也會保留一行。包括客戶資料、全部標籤及顏色、數量、成本、備註、現價、盈虧及報價時間。</p><button class="btn primary" data-action="export-client-details" ${counts.clients?'':'disabled'}>${icon('download')} 下載完整持倉明細 CSV</button><small>${counts.rows} 行資料 · 包含全部 ${counts.clients} 位客戶</small></section><section class="export-option"><h3>客戶總表</h3><p>每位客戶一行，包括全部客戶資料、標籤、團隊備註、持倉數目及全部持倉清單。個別持倉的數量、成本及報價請使用持倉明細。</p><button class="btn" data-action="export-client-summary" ${counts.clients?'':'disabled'}>${icon('download')} 下載客戶總表 CSV</button><small>${counts.clients} 行資料 · 每位客戶一行</small></section><p class="muted export-footnote">下載時會再讀取最新團隊資料；CSV 是匯出當刻的快照。</p></div><div class="modal-actions"><button class="btn" data-action="close">關閉</button></div>`);
  }finally{csvExportPending=false;}
}
async function exportCsv(kind){
  if(csvExportPending||!state.user)return;
  csvExportPending=true;
  const identity=state.user.id;
  try{
    toast(t('正在準備最新資料及報價…'));
    const data=await api('/data');
    if(state.user?.id!==identity)return;
    Object.assign(state,data);render();
    // Client exports always use the complete fresh dataset, never the visible page or filters.
    const clients=structuredClone(state.clients),records=structuredClone(state.recommendations||[]),tags=structuredClone(state.tags),names=structuredClone(state.securityNames);
    const entries=kind==='recommendations'?records:clients;
    if(!entries.length){toast(t(kind==='recommendations'?'沒有可匯出的推介':'沒有可匯出的客戶'));return;}
    const holdings=kind==='recommendations'?records:clients.flatMap(c=>c.holdings),quotesEnabled=state.quotesEnabled;
    // The directory needs no quotes; details include all collapsed/off-page holdings.
    if(quotesEnabled&&kind!=='client-summary')await quoteCache.load(holdings,{force:true});
    if(state.user?.id!==identity)return;
    const exportedAt=new Date().toISOString(),options={exportedAt,quoteFor:h=>quotesEnabled?quoteCache.read(h):{status:'disabled'}};
    const content=kind==='recommendations'?recommendationsCsv(records,names,options):kind==='client-summary'?clientSummaryCsv(clients,tags,names,options):clientsCsv(clients,tags,names,options);
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    const fileKind=kind==='clients'?'all_client_holdings':kind==='client-summary'?'all_clients':kind;
    link.href=url;link.download=`Forthright_${fileKind}_${new Date(exportedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Hong_Kong'})}.csv`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    renderQuotePrices();
    const counts=exportCounts(clients);
    toast(kind==='recommendations'?ui`已匯出 ${records.length} 項推介 · 包含 Entry、SL、TP 及報價時間`:kind==='client-summary'?ui`已匯出全部 ${counts.clients} 位客戶 · ${counts.clients} 行客戶總表`:ui`已匯出全部 ${counts.clients} 位客戶、${counts.holdings} 項持倉 · ${counts.rows} 行完整明細`);
  }finally{csvExportPending=false;}
}
function renderHoldingPrices(){for(const el of document.querySelectorAll('[data-holding-prices]')){const client=state.clients.find(c=>c.id===el.dataset.clientId),holding=client?.holdings[Number(el.dataset.holdingPrices)];if(holding)el.innerHTML=holdingPrice(holding);}}
async function loadHoldingPrices(force=false){
  if(!state.user||!state.quotesEnabled||!['clients','recommendations'].includes(state.view)||document.hidden)return;
  const holdings=state.view==='recommendations'?(state.recommendations||[]):expandedHoldings();if(!holdings.length)return;
  const identity=state.user.id,work=quoteCache.load(holdings,{force});renderQuotePrices();await work;
  if(state.user?.id===identity)renderQuotePrices();
}
function renderQuotePrices(){if(state.view==='clients')renderHoldingPrices();if(state.view==='recommendations')for(const el of document.querySelectorAll('[data-recommendation-price]')){const r=state.recommendations.find(r=>r.id===el.dataset.recommendationPrice);if(r)el.innerHTML=recommendationPrice(r);}}
function recommendationPrice(r){
 const q=quoteCache.read(r),p=recommendationPerformance(r,q);
 if(!p)return ui`<span class="muted">—</span><small>${state.quotesEnabled?(q.status==='loading'?t('載入報價中…'):t('報價暫不可用')):t('尚未連接報價服務')}</small>`;
 return `<strong>${money(q.price,q.currency,false,6)}</strong><span class="${p.percent>0?'pnl-gain':p.percent<0?'pnl-loss':''}">${p.percent.toLocaleString(locale(),{maximumFractionDigits:2,minimumFractionDigits:2,signDisplay:'exceptZero'})}%</span><small>${new Date(q.asOf).toLocaleString(locale(),{timeZone:'Asia/Hong_Kong',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})} HKT · ${esc(q.source)}${q.delayMinutes!=null?` · ${t('延遲')} ${q.delayMinutes} ${t('分鐘')}`:''}${q.session==='closed'?` · ${t('最近收市')}`:''}</small>`;
}
function recommendationSyncStatus(){
 const time=recommendationSyncTime(state.recommendationsSync,locale()),request=state.recommendationsSyncRequest;
 const pending=request?.requestedAt&&!request.completedAt&&!request.failedAt;
 const waiting=pending&&Date.now()-Date.parse(request.requestedAt)<600000;
 const message=pending?t('已排隊，等待此 Mac 執行；通常於下次 5 分鐘檢查時開始。'):request?.failedAt?t('上次手動同步未完成，請檢查 Mac 及登入狀態後重試。'):request?.completedAt?t('手動同步已完成。'):'';
 return ui`<div class="recommendation-sync" role="status"><div class="recommendation-sync-main"><span>${icon('refresh')} TradingView · 上次成功同步： ${time?`<time datetime="${esc(time.iso)}">${esc(time.display)}</time>`:t('尚未有成功同步紀錄')}</span><button type="button" class="btn small" data-action="sync-recommendations" ${waiting?'disabled':''}>${icon('refresh')}${pending?t(waiting?'等待同步中':'重試同步'):'Sync Now'}</button></div><small>${message?esc(message)+' ':''}${t('需要此 Mac 開機並保持喚醒，TradingView 已登入。背景服務每日自動同步一次（香港時間）；手動請求每 5 分鐘檢查。')} ${state.recommendationsSync?.skippedCount?ui`${state.recommendationsSync.skippedCount} 項推介資料未完整，待補充`:''}</small></div>`;
}
function recommendationsView(){
 const list=state.recommendations||[];
 return ui`${pageHeading('STOCK RECOMMENDATIONS',t('股票推介'),t('記錄團隊推介及部署價位，追蹤現價相對 Entry 的表現。'),ui`<button class="btn" data-action="export-recommendations-csv" title="匯出全部股票推介及報價時間">${icon('download')} 匯出 CSV</button><button class="btn" data-action="refresh">${icon('refresh')} 重新整理</button>${state.quotesEnabled?ui`<button class="btn" data-action="refresh-prices">${icon('refresh')} 更新報價</button>`:''}<button class="btn primary" data-action="new-recommendation">${icon('plus')} 新增推介</button>`)}${recommendationSyncStatus()}<section class="panel"><div class="panel-title"><div><h2>團隊股票推介</h2><small>${list.length} ${t('項推介')} · ${t('儲存後全團隊可見')}</small></div><span class="pill">Entry → 現價 %</span></div>${list.length?`<div class="table-wrap"><table class="recommendations-table"><thead><tr><th>${t('股票')}</th><th>${t('推介日期')}</th><th>Entry</th><th>SL</th><th>TP</th><th>${t('現價 / 表現')}</th><th>${t('備註')}</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td><strong>${esc(r.symbol)}</strong><small>${esc(securityName(r,state.securityNames))}</small><span class="tier">${marketLabels[r.market]} · ${esc(r.currency)}</span></td><td>${esc(r.recommendDate)}</td><td>${holdingValue(r.entry)}</td><td>${r.stopLoss.map(holdingValue).join('<br>')}</td><td>${r.takeProfit.map(holdingValue).join('<br>')}</td><td class="recommendation-price" data-recommendation-price="${esc(r.id)}">${recommendationPrice(r)}</td><td class="recommendation-remarks">${esc(r.remarks)||'—'}</td><td><button class="btn small" data-action="edit-recommendation" data-id="${esc(r.id)}">${t('編輯')}</button></td></tr>`).join('')}</tbody></table></div>`:t('<div class="empty"><h3>尚未新增推介</h3><p>新增股票、Entry、SL、TP 及推介日期，開始記錄。</p></div>')}</section><p class="bottom-note">${t('表現 =（現價 ÷ Entry − 1）× 100%；未計派息及交易費用，不代表實際客戶回報。報價快取 30 分鐘，時間以香港時間顯示。SL／TP 為部署參考；不代表已成交或曾觸及。')}</p>`;
}
function recommendationModal(id){
 const r=id?state.recommendations.find(r=>r.id===id):{market:'US',symbol:'',name:'',entry:'',stopLoss:[],takeProfit:[],remarks:'',recommendDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Hong_Kong'})};
 state.editRecommendation=r;
 showModal(ui`<form data-form="recommendation">${modalHead(t(id?'編輯股票推介':'新增股票推介'),t('價位以每股計算；多個 SL／TP 可用逗號分隔。'))}<div class="modal-body"><div class="field-grid"><div class="field"><label for="recommend-market">市場 *</label><select id="recommend-market" name="market">${options([['US',t('美股')],['HK',t('港股')]],r.market)}</select></div><div class="field"><label for="recommend-symbol">股票代號 *</label><input id="recommend-symbol" name="symbol" maxlength="20" value="${esc(r.symbol)}" placeholder="AAPL / 00700" required></div><div class="field"><label for="recommend-name">股票名稱</label><input id="recommend-name" name="name" maxlength="120" value="${esc(r.name)}"></div><div class="field"><label for="recommend-date">推介日期 *</label><input id="recommend-date" name="recommendDate" type="date" min="2000-01-01" max="2100-12-31" value="${esc(r.recommendDate)}" required></div><div class="field"><label for="recommend-entry">Entry *</label><input id="recommend-entry" name="entry" type="number" min="0.000001" max="1000000000000000" step="any" value="${esc(r.entry)}" required></div><div class="field"><label for="recommend-sl">SL *</label><input id="recommend-sl" name="stopLoss" value="${esc(r.stopLoss.join(', '))}" placeholder="329, 319" required></div><div class="field"><label for="recommend-tp">TP *</label><input id="recommend-tp" name="takeProfit" value="${esc(r.takeProfit.join(', '))}" placeholder="420, 470" required></div></div><div class="field"><label for="recommend-remarks">備註</label><textarea id="recommend-remarks" name="remarks" maxlength="4000" rows="5">${esc(r.remarks)}</textarea></div>${errorBlock}</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">${icon('check')} 儲存推介</button></div></form>`);
}
function clientHoldings(c){
  return ui`<section class="client-holdings" aria-label="${esc(c.surname)} · ${t('全部持倉')}">
    <div class="client-holdings-head"><div><h3>全部持倉 <span class="pill">${c.holdings.length} 項資產</span></h3><small>依團隊最新儲存記錄顯示${state.quotesEnabled?t(' · 報價快取 30 分鐘；盈虧未計交易費用及派息'):''}</small></div><div class="holding-actions">${state.quotesEnabled&&c.holdings.length?ui`<button type="button" class="btn small" data-action="refresh-prices">${icon('refresh')} 更新報價</button>`:''}<button type="button" class="btn small" data-action="edit-client" data-id="${esc(c.id)}">查看／編輯客戶 ${icon('chevron')}</button></div></div>
    ${c.holdings.length?`<div class="client-holdings-grid">${c.holdings.map((h,index)=>ui`<article class="client-holding"><div class="client-holding-title"><strong>${esc(h.symbol)}</strong><span class="tier">${marketLabels[h.market]||esc(h.market)}</span></div><div class="client-holding-name">${esc(securityName(h,state.securityNames))}</div>${isFuture(h)?`<div class="subline">${esc(t(contractLabel(h)))}</div>`:''}<dl><div><dt>${isFuture(h)?t('合約張數'):t('數量 / 單位')}</dt><dd>${holdingValue(h.quantity)}</dd></div><div><dt>${isFuture(h)?t('平均成交報價 / 點數'):t('平均成本 / 單位')}</dt><dd>${h.avgCost===''||h.avgCost==null?t('未提供'):`${esc(h.currency||'')} ${holdingValue(h.avgCost)}`}</dd></div></dl>${state.quotesEnabled?`<div data-holding-prices="${index}" data-client-id="${esc(c.id)}">${holdingPrice(h)}</div>`:''}${h.notes?`<p class="client-holding-notes">${esc(h.notes)}</p>`:''}</article>`).join('')}</div>`:t('<p class="client-holdings-empty">尚未記錄持倉，可在客戶檔案新增。</p>')}
  </section>`;
}
function clientRows(c){
  const expanded=state.expandedClients.has(c.id),id=esc(c.id);
  return ui`<tr class="client-row ${expanded?'expanded':''}" data-action="toggle-client" data-id="${id}">
    <td><button type="button" class="client-toggle" id="client-toggle-${id}" data-action="toggle-client" data-id="${id}" aria-expanded="${expanded}" aria-controls="client-holdings-${id}" aria-label="${esc(c.surname)} · ${c.last2} · ${t('全部持倉')}"><span class="client-cell"><span class="avatar">${esc(c.surname.slice(0,1))}</span><span><span class="client-name">${esc(c.surname)}</span><span class="client-number">WhatsApp · ${c.last2}</span></span></span></button></td>
    <td><div class="group-name">${esc(c.groupName||t('尚未填寫群組'))}</div><span class="tier ${c.tier==='黑鑽'?'black':''}">${t(c.tier)}會員</span></td>
    <td><div class="tags">${c.tags.map(tagHtml).join('')||t('<small>尚未標記</small>')}</div></td>
    <td><div class="symbols">${c.holdings.slice(0,3).map(h=>`<span class="symbol">${h.market==='HK'?'HK · ':''}${esc(h.symbol)}${h.market==='HK'?' · '+esc(securityName(h,state.securityNames)):''}</span>`).join('')}${c.holdings.length>3?`<span class="symbol">+${c.holdings.length-3}</span>`:''}${!c.holdings.length?t('<small>尚未記錄</small>'):''}</div><small class="client-holdings-hint">${expanded?t('點選收起'):t('點選展開全部持倉')}</small></td>
    <td><div class="updated">${formatDate(c.updatedAt)}<br>${esc(c.updatedBy)}</div></td><td><span class="client-expand-icon" aria-hidden="true">${icon('chevron')}</span></td>
  </tr><tr class="client-holdings-row" id="client-holdings-${id}" ${expanded?'':'hidden'}><td colspan="6">${expanded?clientHoldings(c):''}</td></tr>`;
}
function toggleClient(id){
  if(!state.clients.some(c=>c.id===id))return;
  state.expandedClients.has(id)?state.expandedClients.delete(id):state.expandedClients.add(id);
  renderClientRows();
  document.getElementById(`client-toggle-${id}`)?.focus({preventScroll:true});
}
function renderClientRows(){
  for(const id of state.expandedClients)if(!state.clients.some(c=>c.id===id))state.expandedClients.delete(id);
  const list=filteredClients(), pages=Math.max(1,Math.ceil(list.length/10)); state.page=Math.min(pages,state.page);
  $('#filter-count').textContent=ui`顯示 ${list.length} 位客戶，共 ${state.clients.length} 位`;
  $('#client-results').innerHTML=list.length?ui`<div class="table-wrap"><table><thead><tr><th>客戶</th><th>服務群組 / 級別</th><th>客戶標籤</th><th>持倉摘要</th><th>最後更新</th><th></th></tr></thead><tbody>${list.slice((state.page-1)*10,state.page*10).map(clientRows).join('')}</tbody></table></div><div class="table-footer"><span>每頁 10 位客戶</span><div class="pagination"><button class="btn" data-action="prev" ${state.page===1?'disabled':''} aria-label="上一頁">‹</button><span>${state.page} / ${pages}</span><button class="btn" data-action="next" ${state.page===pages?'disabled':''} aria-label="下一頁">›</button></div></div>`:`<div class="empty">${icon('users')}<h3>${state.clients.length?t('沒有符合條件的客戶'):t('開始建立客戶關係')}</h3><p>${state.clients.length?t('試試其他關鍵字，或清除目前的篩選。'):t('新增姓氏、WhatsApp 尾兩碼，再加入標籤與持倉。')}</p><button class="btn primary" data-action="${state.clients.length?'clear-filters':'new-client'}">${state.clients.length?t('清除篩選'):t('新增第一位客戶')}</button></div>`;
  applyTagColors();
  void loadHoldingPrices();
}
function openClient(id){
  state.draft=id?structuredClone(state.clients.find(c=>c.id===id)):{surname:'',last2:'',groupName:'',tier:'鑽石',tags:[],holdings:[],notes:''};
  renderClientModal();
}
function renderClientModal(){
  const c=state.draft;
  showModal(ui`<form data-form="client">${modalHead(c.id?`${c.surname} · ${c.last2}`:t('新增客戶'),c.id?ui`最後由 ${c.updatedBy} 更新 · ${formatDate(c.updatedAt)}`:t('建立客戶檔案 · 姓氏與 WhatsApp 尾兩碼為必填'))}<div class="modal-body"><div class="section-heading"><h3>基本資料</h3><span>01 / PROFILE</span></div><div class="field-grid"><div class="field"><label for="surname">客戶姓氏 *</label><input id="surname" data-client="surname" maxlength="30" value="${esc(c.surname)}" placeholder="例如：陳" required></div><div class="field"><label for="last2">WhatsApp 尾兩碼 *</label><input id="last2" data-client="last2" inputmode="numeric" pattern="[0-9]{2}" maxlength="2" value="${esc(c.last2)}" placeholder="例如：26" required></div><div class="field"><label for="groupName">WhatsApp 服務群名稱</label><input id="groupName" data-client="groupName" maxlength="120" value="${esc(c.groupName)}" placeholder="輸入或選擇服務群組" list="group-options"><datalist id="group-options">${[...new Set(state.clients.map(x=>x.groupName).filter(Boolean))].map(g=>`<option value="${esc(g)}"></option>`).join('')}</datalist></div><div class="field"><label for="tier">會員級別</label><select id="tier" data-client="tier">${options([['鑽石',t('鑽石會員')],['黑鑽',t('黑鑽會員')],['其他','其他']],c.tier)}</select></div></div><div class="section-heading"><h3>客戶標籤 <small>可選多個</small></h3><span>02 / RELATIONSHIP</span></div><div class="chip-select">${state.tags.map(t=>`<button type="button" data-action="toggle-tag" data-id="${t.id}" data-tag-color="${validTagColor(t.color)?t.color:''}" class="${c.tags.includes(t.id)?'selected':''}" aria-pressed="${c.tags.includes(t.id)}">${esc(tagLabel(t.name))}</button>`).join('')}<button type="button" data-action="quick-tag">＋ 新標籤</button></div><div class="section-heading"><h3>客戶持倉 <small id="holdings-count">${c.holdings.length} 項資產</small></h3><button type="button" class="btn small" data-action="show-security-search">${icon('plus')} 新增持倉</button></div><div id="security-picker"></div><div id="holding-list">${holdingsEditor()}</div><div class="section-heading"><h3>服務備註</h3><span>04 / NOTES</span></div><label for="client-notes">團隊備註</label><textarea id="client-notes" data-client="notes" maxlength="4000" placeholder="記錄服務重點、偏好或跟進事項">${esc(c.notes)}</textarea><small>標籤與持倉由團隊手動記錄；不會讀取或同步 WhatsApp 訊息。</small>${errorBlock}</div><div class="modal-actions">${c.id?t('<button type="button" class="btn danger push" data-action="delete-client">刪除客戶</button>'):''}<button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">${icon('check')} 儲存客戶</button></div></form>`);
}
function captureClientDraft(){
 if(!state.draft)return;
 for(const el of modal.querySelectorAll('[data-client]'))state.draft[el.dataset.client]=el.value;
 for(const el of modal.querySelectorAll('[data-holding]')){
  const holding=state.draft.holdings[Number(el.dataset.index)],key=el.dataset.holding;
  if(holding&&['quantity','avgCost','currency','notes','contractMonth','direction'].includes(key))holding[key]=['quantity','avgCost'].includes(key)?(el.value===''?'':Number(el.value)):el.value;
 }
}
function updateHoldingsEditor(){ $('#holding-list').innerHTML=holdingsEditor(); $('#holdings-count').textContent=ui`${state.draft.holdings.length} 項資產`; }
function holdingsEditor(){return state.draft.holdings.length?state.draft.holdings.map((h,i)=>ui`<div class="hold-card"><div class="hold-head"><div><strong>${esc(h.symbol)} <span class="tier">${marketLabels[h.market]} · ${esc(h.type||'OTHER')}</span></strong><small>${esc(securityName(h,state.securityNames))}${h.manual?t(' · 手動記錄'):''}</small></div><button type="button" class="icon-btn" data-action="remove-holding" data-index="${i}" aria-label="移除持倉 ${esc(h.symbol)}">${icon('close')}</button></div><div class="hold-fields"><div><label for="quantity-${i}">${isFuture(h)?t('合約張數（選填）'):t('數量 / 單位（選填）')}</label><input id="quantity-${i}" type="number" min="0" max="1000000000000000" step="${isFuture(h)?'1':'any'}" data-holding="quantity" data-index="${i}" value="${esc(h.quantity)}" placeholder="未提供"></div><div><label for="cost-${i}">${isFuture(h)?t('平均成交報價 / 點數（選填）'):t('每單位平均成本（選填）')}</label><input id="cost-${i}" type="number" min="0" max="1000000000000000" step="any" data-holding="avgCost" data-index="${i}" value="${esc(h.avgCost)}" placeholder="未提供"></div><div><label for="currency-${i}">成本幣種</label><select id="currency-${i}" data-holding="currency" data-index="${i}">${options(currencies.map(c=>[c,c==='OTHER'?'其他':c]),h.currency)}</select></div>${isFuture(h)?ui`<div><label for="contract-${i}">合約月份 *</label><input id="contract-${i}" type="month" min="2000-01" max="2100-12" required data-holding="contractMonth" data-index="${i}" value="${esc(h.contractMonth||'')}"></div><div><label for="direction-${i}">持倉方向</label><select id="direction-${i}" data-holding="direction" data-index="${i}">${options([['LONG',t('買入 / 好倉')],['SHORT',t('賣出 / 空倉')]],h.direction||'LONG')}</select></div>`:''}<div class="holding-note"><label for="hold-note-${i}">持倉備註</label><input id="hold-note-${i}" maxlength="300" data-holding="notes" data-index="${i}" value="${esc(h.notes||'')}" placeholder="例如：基金單位、其他幣種、購入日期"></div></div></div>`).join(''):t('<div class="empty"><p>尚未記錄持倉。可加入股票、ETF、商品期貨、股指期貨、加密資產或其他資產。</p></div>');}
function showSecurityPicker(){
  captureClientDraft();
  $('#security-picker').innerHTML=ui`<div class="search-panel"><div class="search-controls"><select id="security-market" aria-label="持倉市場">${options(marketOptions(),'US')}</select><select id="security-type" aria-label="證券類型">${options([['',t('所有類型')],['STOCK',t('股票')],['ETF','ETF'],['FUND',t('基金 / REIT')]],'')}</select><input id="security-query" aria-label="搜尋證券" placeholder="搜尋代號或中英文名稱，例如 00700、騰訊、AAPL"></div><div id="security-results" class="search-results"></div><small>股票目錄日期 ${esc(state.catalog.asOf||t('未載入'))} · 不含即時報價。期貨按指定合約月份取價；加密資產採用美元現貨價。報價快取 30 分鐘，來源及時間顯示於持倉內。</small><div class="row-buttons"><button type="button" class="text-btn" data-action="manual-security">找不到資產？手動輸入</button><button type="button" class="text-btn" data-action="hide-security-search">收起搜尋</button></div><div id="manual-security"></div></div>`;
  $('#security-query').focus(); searchSecurities();
}
async function searchSecurities(){
  if(!$('#security-query'))return;
  const market=$('#security-market').value,seq=++state.searchSeq;
  state.securityResults=[]; $('#security-results').innerHTML='';
  $('#security-type').disabled=!['US','HK'].includes(market); $('#security-query').disabled=market==='Others';
  if($('#security-type').disabled)$('#security-type').value='';
  if(market==='Others'){ $('#security-results').innerHTML=''; manualSecurity(); return; }
  $('#manual-security').innerHTML='';
  const q=$('#security-query').value,type=$('#security-type').value;
  const data=await api(`/securities?market=${market}&q=${encodeURIComponent(q)}&type=${type}`);
  if(seq!==state.searchSeq||!$('#security-results'))return;
  state.securityResults=data.results;
  $('#security-results').innerHTML=data.results.length?data.results.map((s,i)=>`<button type="button" class="security-result" data-action="pick-security" data-index="${i}"><span><strong>${esc(s.symbol)}</strong><small>${esc(securityName(s))}</small></span><span class="pill">${esc(s.type)} · ${s.currency} ＋</span></button>`).join(''):ui`<small>沒有符合的證券。可換關鍵字，或手動輸入。</small>`;
}
function manualSecurity(){const market=$('#security-market').value;$('#manual-security').innerHTML=ui`<div class="notice">${market==='Others'?t('記錄其他資產，例如債券、基金或現金。'):t('手動輸入的代號不會標示為目錄已核對。')}</div><div class="manual-form"><div><label for="manual-symbol">代號 / 簡稱</label><input id="manual-symbol" maxlength="40" placeholder="${market==='Others'?t('例如：BOND'):t('資產代號')}"></div><div><label for="manual-name">資產名稱</label><input id="manual-name" maxlength="160" placeholder="輸入完整名稱"></div><button type="button" class="btn" data-action="add-manual-security">加入${marketLabels[market]}持倉</button></div>`;}
function addHolding(h){captureClientDraft();state.draft.holdings.unshift({...h,id:crypto.randomUUID(),quantity:'',avgCost:'',notes:'',...(h.type==='FUTURE'?{contractMonth:'',direction:'LONG'}:{})});updateHoldingsEditor();$('#security-picker').innerHTML='';toast(t('已加入持倉，請儲存客戶以完成更新'));}
function tagsView(){return ui`${pageHeading('RELATIONSHIP INTELLIGENCE',t('標籤管理'),t('自由建立客戶特徵標籤；每位客戶可同時使用多個標籤。'),ui`<button class="btn primary" data-action="new-tag">${icon('plus')} 新增標籤</button>`)}<div class="tag-grid">${state.tags.map((t,i)=>{const count=state.clients.filter(c=>c.tags.includes(t.id)).length;return ui`<article class="tag-card"><div class="tag-card-top"><span class="tag t${i%6}" data-tag-color="${validTagColor(t.color)?t.color:''}">${esc(tagLabel(t.name))}</span>${icon('tag')}</div><h2>${count} <small>位客戶</small></h2><div class="tag-actions"><button class="text-btn" data-action="filter-tag" data-id="${t.id}">查看客戶 →</button><button class="text-btn" data-action="rename-tag" data-id="${t.id}">編輯名稱</button><button class="text-btn" data-action="edit-tag-color" data-id="${t.id}">修改顏色</button>${count?'':ui`<button class="text-btn" data-action="delete-tag" data-id="${t.id}">刪除</button>`}</div></article>`;}).join('')}</div><div class="bottom-note">已使用的標籤須先從客戶檔案移除，才可刪除。修改名稱或顏色會同步顯示於所有相關客戶，全團隊可見。</div>`;}
function allHoldings(){const map=new Map();for(const c of state.clients)for(const h of c.holdings){const key=holdingIdentity(h);if(!map.has(key))map.set(key,{...h,owners:new Set()});map.get(key).owners.add(c.id);}return [...map.values()].sort((a,b)=>b.owners.size-a.owners.size||a.symbol.localeCompare(b.symbol));}
function holdingsView(){const list=allHoldings();return ui`${pageHeading('PORTFOLIO COVERAGE',t('持倉總覽'),t('按資產查看持有客戶，快速掌握團隊的服務覆蓋範圍。'))}<section class="stats">${stat(t('資產種類'),list.length,t('按市場、代號及期貨合約去重'),'briefcase')}${Object.keys(markets).map(m=>stat(marketLabels[m],list.filter(h=>h.market===m).length,t('已記錄的資產種類'),'book')).join('')}</section><section class="panel"><div class="panel-title"><h2>團隊客戶持倉</h2><span class="pill">按持有客戶數排序</span></div>${list.length?ui`<div class="table-wrap"><table><thead><tr><th>資產</th><th>市場</th><th>類型</th><th>持有客戶</th><th></th></tr></thead><tbody>${list.map(h=>ui`<tr><td><strong>${esc(h.symbol)}</strong><div class="subline">${esc(securityName(h,state.securityNames))}</div>${isFuture(h)?`<div class="subline">${esc(t(contractLabel(h)))}</div>`:''}</td><td>${marketLabels[h.market]}</td><td><span class="symbol">${esc(h.type)}</span></td><td>${h.owners.size} 位</td><td><button class="text-btn" data-action="filter-symbol" data-id="${esc(h.symbol)}">查看客戶 →</button></td></tr>`).join('')}</tbody></table></div>`:t('<div class="empty"><h3>尚未記錄任何持倉</h3><p>在客戶檔案加入持倉後，這裡會顯示資產與持有客戶數。</p></div>')}</section><div class="bottom-note">僅整理團隊手動記錄的持倉，不代表完整資產或即時市值。</div>`;}
function catalogView(){const counts=state.catalog.counts||{};return ui`${pageHeading('SECURITIES REFERENCE',t('證券目錄'),t('搜尋股票、ETF、商品期貨、港美股指期貨及加密資產，亦可手動記錄其他資產。'))}<div class="catalog-grid">${[['US',t('美國市場'),t('Nasdaq Trader · Nasdaq / NYSE / NYSE American / 其他上市市場')],['HK',t('香港市場'),t('HKEX · 股票、ETF、REIT 及上市基金')]].map(([m,l,src])=>ui`<div class="catalog-card"><div class="eyebrow">${m} SECURITIES</div><h3>${l}</h3><div class="catalog-number">${(counts[m]?.total||0).toLocaleString()} <small>項證券</small></div><p>其中 ${(counts[m]?.ETF||0).toLocaleString()} 項 ETF<br>${src}<br>資料日期 ${esc(state.catalog.asOf||t('未載入'))}</p></div>`).join('')}</div><section class="panel"><div class="panel-title"><h2>查找證券</h2><span class="pill">交易所參考目錄</span></div><div class="catalog-search"><div class="search-controls"><select id="catalog-market" aria-label="目錄市場">${options(marketOptions().filter(([key])=>key!=='Others'),'US')}</select><select id="catalog-type" aria-label="目錄類型"><option value="">所有類型</option><option value="STOCK">股票</option><option value="ETF">ETF</option><option value="FUND">基金 / REIT</option></select><input id="catalog-query" aria-label="搜尋證券目錄" placeholder="輸入代號或名稱"></div><div id="catalog-results" class="search-results"><small>輸入代號或名稱開始搜尋。</small></div></div></section><div class="bottom-note"><span>目錄為定期快照，不含即時價格。新上市、下市及特殊資產可手動記錄。</span><span>來源：<a href="https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs" target="_blank" rel="noreferrer">Nasdaq Trader</a> · <a href="https://www.hkex.com.hk/Services/Trading/Securities/Securities-Lists?sc_lang=en" target="_blank" rel="noreferrer">HKEX</a></span></div>`;}
async function searchCatalog(){$('#catalog-type').disabled=!['US','HK'].includes($('#catalog-market').value);if($('#catalog-type').disabled)$('#catalog-type').value='';const seq=++state.searchSeq,q=$('#catalog-query').value;const data=await api(`/securities?market=${$('#catalog-market').value}&type=${$('#catalog-type').value}&q=${encodeURIComponent(q)}`);if(seq!==state.searchSeq||!$('#catalog-results'))return;$('#catalog-results').innerHTML=ui`<small>找到 ${data.total} 項${data.total>40?t('，顯示首 40 項，請收窄搜尋'):''}</small>`+data.results.map(s=>`<div class="security-result"><span><strong>${esc(s.symbol)}</strong><small>${esc(securityName(s))}</small></span><span class="pill">${s.type} · ${s.currency}</span></div>`).join('');}
function quoteConnectionPanel(){
  const c=state.quoteConnection;
  if(!state.cloud||!c?.configured)return '';
  return ui`<section class="panel quote-connection"><div class="panel-title"><h2>持倉參考報價</h2><span class="pill">${c.connected?t('已連接'):t('未連接')}</span></div><p>${c.connected?t('伺服器按需要擷取港美股、指定月份期貨及加密資產美元現貨報價，全團隊共用 30 分鐘快取；毋須開啟你的電腦。報價來源及時間會顯示在每項持倉內。'):c.unavailable?t('報價服務暫時無法連線。現價及盈虧暫不顯示。'):t('連接富途報價後，展開客戶即可查看參考價及未實現盈虧。只需要 quote:read 報價權限。')}</p><button class="btn" data-action="connect-quotes">${c.connected?t('重新連接富途報價'):t('連接富途報價')}</button></section>`;
}
function teamView(){return ui`${pageHeading('ACCESS MANAGEMENT',t('團隊帳號'),t('每位同事使用自己的帳號；管理員可建立或停用存取權。'),ui`<button class="btn primary" data-action="new-user">${icon('plus')} 新增團隊帳號</button>`)}<section class="panel"><div class="panel-title"><h2>團隊成員</h2><span class="pill">僅管理員可管理</span></div><div class="table-wrap"><table class="team-table"><thead><tr><th>帳號</th><th>權限</th><th>狀態</th><th>管理</th></tr></thead><tbody>${state.users.map(u=>`<tr><td><strong>${esc(u.username)}</strong>${u.id===state.user.id?t(' <small>（你）</small>'):''}</td><td>${u.role==='admin'?t('管理員'):t('團隊成員')}</td><td><span class="tag ${u.active?'':'t1'}">${u.active?t('使用中'):t('已停用')}</span></td><td>${u.id===state.user.id?t('<button class="text-btn" data-action="password">更改密碼</button>'):ui`<button class="text-btn" data-action="toggle-user" data-id="${u.id}">${u.active?t('停用帳號'):t('啟用帳號')}</button><button class="text-btn" data-action="reset-user" data-id="${u.id}">重設密碼</button>`}</td></tr>`).join('')}</tbody></table></div></section><div class="notice">團隊成員可查看和編輯所有客戶、標籤與持倉；管理員另可管理帳號。停用帳號或重設密碼後，該帳號現有登入會立即失效。</div>${quoteConnectionPanel()}`;}
function tagModal(id,quick=false){const tag=state.tags.find(t=>t.id===id);state.tagModal={id,quick};const color=validTagColor(tag?.color)?tag.color:tagPalette[0];showModal(ui`<form data-form="tag">${modalHead(tag?t('編輯標籤'):t('新增標籤'))}<div class="modal-body"><div class="field"><label for="tag-name">標籤名稱</label><input id="tag-name" maxlength="24" required value="${esc(tag?.name||'')}" placeholder="例如：需要跟進"></div><div class="field"><label for="tag-color">標籤顏色</label><div class="tag-color-editor"><input type="color" id="tag-color" value="${color}" aria-label="${t('自訂標籤顏色')}"><span id="tag-preview" class="tag" data-tag-color="${color}">${esc(tagLabel(tag?.name||t('標籤預覽')))}</span></div><div class="color-palette" role="group" aria-label="${t('常用顏色')}">${tagPalette.map(c=>`<button type="button" class="color-swatch" data-action="tag-color" data-color="${c}" data-tag-color="${c}" aria-label="${t('選擇顏色')} ${c}" aria-pressed="${c===color}">${c===color?'✓':''}</button>`).join('')}</div><small>可選擇常用顏色，或點選色塊自訂。儲存後全團隊可見。</small></div>${errorBlock}</div><div class="modal-actions"><button type="button" class="btn" data-action="${quick?'return-client':'close'}">取消</button><button class="btn primary" type="submit">儲存標籤</button></div></form>`);}
function updateTagPreview(){const color=$('#tag-color')?.value;if(!validTagColor(color))return;const preview=$('#tag-preview');preview.dataset.tagColor=color;preview.textContent=tagLabel($('#tag-name').value||t('標籤預覽'));for(const b of document.querySelectorAll('.color-swatch')){b.setAttribute('aria-pressed',String(b.dataset.color===color));b.textContent=b.dataset.color===color?'✓':'';}applyTagColors();}

function passwordModal(){showModal(ui`<form data-form="password">${modalHead(t('更改密碼'),t('更新後須重新登入'))}<div class="modal-body"><div class="field"><label for="current-password">目前密碼</label><input id="current-password" type="password" autocomplete="current-password" required maxlength="128"></div><div class="field"><label for="new-password">新密碼（最少 12 個字元）</label><input id="new-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div>${errorBlock}</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">更新密碼</button></div></form>`);}
function userModal(id){const u=state.users.find(x=>x.id===id);state.editUser=u;showModal(ui`<form data-form="user">${modalHead(u?t('重設團隊密碼'):t('新增團隊帳號'),u?u.username:t('帳號建立後，請透過安全渠道向同事提供登入資料。'))}<div class="modal-body">${u?'':ui`<div class="field"><label for="team-username">帳號</label><input id="team-username" pattern="[a-zA-Z0-9_.-]{3,40}" maxlength="40" required autocomplete="off" placeholder="例如：rex.lau"></div><div class="field"><label for="team-role">角色</label><select id="team-role"><option value="member">團隊成員</option><option value="admin">管理員</option></select></div>`}<div class="field"><label for="team-password">密碼（最少 12 個字元）</label><input id="team-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>${errorBlock}</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">${u?t('更新密碼'):t('建立帳號')}</button></div></form>`);}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const a=b.dataset.action,id=b.dataset.id;
  try{
    if(a==='nav'){await load();state.view=id;if(id==='team')state.users=(await api('/team')).users;render();}
    if(a==='new-client')openClient();
    if(a==='new-recommendation')recommendationModal();
    if(a==='edit-recommendation')recommendationModal(id);
    if(a==='toggle-client')toggleClient(id);
    if(a==='refresh-prices'){b.disabled=true;try{await loadHoldingPrices(true);}finally{if(b.isConnected)b.disabled=false;}}
    if(a==='edit-client')openClient(id);
    if(a==='close')modal.close();
    if(a==='return-client')renderClientModal();
    if(a==='sync-recommendations'){b.disabled=true;try{const result=await api('/recommendations/sync','POST',{});state.recommendationsSyncRequest=result.syncRequest;render();toast(t(result.syncRequest?.completedAt?'剛完成同步，請稍後再試':'同步請求已送出，等待此 Mac 執行'));}finally{if(b.isConnected)b.disabled=false;}}
    if(a==='refresh'){await load();render();toast(t('已載入最新團隊資料'));}
    if(a==='logout'){await api('/logout','POST',{});clearPrivateState();modal.close();render();}
    if(a==='password')passwordModal();
    if(a==='clear-filters'){Object.assign(state,{query:'',tag:'',tier:'',market:'',page:1});render();}
    if(a==='prev'||a==='next'){state.page+=a==='prev'?-1:1;renderClientRows();}
    if(a==='toggle-tag'){const tags=state.draft.tags;tags.includes(id)?tags.splice(tags.indexOf(id),1):tags.push(id);b.classList.toggle('selected');b.setAttribute('aria-pressed',String(tags.includes(id)));}
    if(a==='export-csv')await clientExportModal();
    if(a==='export-client-details')await exportCsv('clients');
    if(a==='export-client-summary')await exportCsv('client-summary');
    if(a==='export-recommendations-csv')await exportCsv('recommendations');
    if(a==='text-size'){const next=textSizes[(textSizes.findIndex(s=>s.id===textSize())+1)%textSizes.length];setTextSize(next.id);b.outerHTML=textSizeControl();document.querySelector('[data-action="text-size"]')?.focus();}
    if(a==='tag-color'){$('#tag-color').value=b.dataset.color;updateTagPreview();}
    if(a==='new-tag')tagModal();
    if(a==='quick-tag'){captureClientDraft();tagModal(undefined,true);}
    if(a==='rename-tag'||a==='edit-tag-color')tagModal(id);
    if(a==='delete-tag'){if(!confirm(t('確定刪除此未使用的標籤？')))return;await api(`/tags/${id}`,'DELETE',{});await load();render();toast(t('已刪除標籤'));}
    if(a==='filter-tag'||a==='filter-symbol'){Object.assign(state,{view:'clients',tag:a==='filter-tag'?id:'',query:a==='filter-symbol'?id:'',market:'',tier:'',page:1});render();}
    if(a==='show-security-search')showSecurityPicker();
    if(a==='hide-security-search')$('#security-picker').innerHTML='';
    if(a==='manual-security')manualSecurity();
    if(a==='pick-security')addHolding({...state.securityResults[Number(b.dataset.index)],manual:false});
    if(a==='add-manual-security'){const symbol=$('#manual-symbol').value.trim(),name=$('#manual-name').value.trim(),market=$('#security-market').value;if(!symbol||!name)throw new Error(t('請填寫代號及資產名稱'));addHolding({symbol:symbol.toUpperCase(),name,market,type:assetType(market),manual:true,currency:defaultCurrency(market)});}
    if(a==='remove-holding'){captureClientDraft();state.draft.holdings.splice(Number(b.dataset.index),1);updateHoldingsEditor();}
    if(a==='delete-client'){if(!confirm(ui`確定永久刪除 ${state.draft.surname} · ${state.draft.last2} 及其持倉？`))return;await api(`/clients/${state.draft.id}`,'DELETE',{version:state.draft.version});modal.close();await load();render();toast(t('已刪除客戶'));}
    if(a==='connect-quotes'){
      b.disabled=true;
      try {
        const {authorizeUrl}=await api('/quote-connect','POST',{}),url=new URL(authorizeUrl);
        if(url.origin!=='https://webapi.futunn.com'||url.pathname!=='/oauth2/authorize/confirm')throw new Error(t('授權連結不正確'));
        showModal(ui`${modalHead(t('連接富途報價'))}<div class="modal-body"><p>在富途頁面只選擇 <strong>quote:read</strong>（讀取報價）。完成後關閉授權分頁，回到本頁即可。</p><p>連接會讓方德後端取得報價，並以加密方式保存授權。你的電腦可以關閉。</p><a class="btn primary" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">前往富途授權</a></div><div class="modal-actions"><button class="btn" data-action="close">完成／關閉</button></div>`);
      } finally{if(b.isConnected)b.disabled=false;}
    }
    if(a==='new-user')userModal();
    if(a==='reset-user')userModal(id);
    if(a==='toggle-user'){const u=state.users.find(x=>x.id===id);await api(`/team/${id}`,'PUT',{active:!u.active});state.users=(await api('/team')).users;render();toast(u.active?t('已停用帳號'):t('已啟用帳號'));}
  }catch(err){toast(err.message);}
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(['tag-name','tag-color'].includes(el.id))updateTagPreview();
  if(el.dataset.client&&state.draft)state.draft[el.dataset.client]=el.value;
  if(el.dataset.holding&&state.draft){const k=el.dataset.holding;state.draft.holdings[Number(el.dataset.index)][k]=['quantity','avgCost'].includes(k)?el.value===''?'':Number(el.value):el.value;}
  if(el.id==='client-search'){state.query=el.value;state.page=1;renderClientRows();}
  if(el.id==='security-query'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchSecurities().catch(e=>toast(e.message)),180);}
  if(el.id==='catalog-query'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchCatalog().catch(e=>toast(e.message)),180);}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='language-select'){
    // Keep typed login details and search fields in memory during this render only.
    const fields=[...document.querySelectorAll('#app input[id],#app select[id],#app textarea[id]')].filter(x=>x.id!=='language-select').map(x=>[x.id,x.value]);
    setLanguage(el.value); render();
    for(const [id,value] of fields){const field=document.getElementById(id);if(field)field.value=value;}
    if($('#catalog-query')?.value)searchCatalog().catch(e=>toast(e.message));
    $('#language-select')?.focus(); return;
  }
  if(el.dataset.client&&state.draft)state.draft[el.dataset.client]=el.value;
  if(el.dataset.holding&&state.draft){const k=el.dataset.holding;state.draft.holdings[Number(el.dataset.index)][k]=['quantity','avgCost'].includes(k)?el.value===''?'':Number(el.value):el.value;}
  const f={'tag-filter':'tag','tier-filter':'tier','market-filter':'market'};
  if(f[el.id]){state[f[el.id]]=el.value;state.page=1;renderClientRows();}
  if(['security-market','security-type'].includes(el.id))searchSecurities().catch(e=>toast(e.message));
  if(['catalog-market','catalog-type'].includes(el.id))searchCatalog().catch(e=>toast(e.message));
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!form.dataset.form)return;e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
  const error=form.querySelector('#form-error');if(error)error.textContent='';
  try{
    switch(form.dataset.form){
      case 'login':{const data=await api('/login','POST',{username:$('#username').value,password:$('#password').value});Object.assign(state,data);await load();render();break;}
      case 'recommendation':{const values=Object.fromEntries(new FormData(form));for(const key of ['stopLoss','takeProfit'])values[key]=values[key].split(/[,，、;；\s]+/).filter(Boolean).map(Number);values.entry=Number(values.entry);const body=validateRecommendation(values),r=state.editRecommendation;await api(r.id?`/recommendations/${r.id}`:'/recommendations',r.id?'PUT':'POST',{...body,...(r.id?{version:r.version}:{})});modal.close();await load();render();toast(t('推介已儲存'));break;}
      case 'client':{captureClientDraft();const c=state.draft;await api(c.id?`/clients/${c.id}`:'/clients',c.id?'PUT':'POST',c);modal.close();await load();render();toast(t('客戶資料已儲存'));break;}
      case 'tag':{const {id,quick}=state.tagModal;const result=await api(id?`/tags/${id}`:'/tags',id?'PUT':'POST',{name:$('#tag-name').value,color:$('#tag-color').value});await load();if(quick){state.draft.tags.push(result.tag.id);renderClientModal();}else{modal.close();render();}toast(t('標籤已儲存'));break;}
      case 'password':await api('/password','POST',{current:$('#current-password').value,password:$('#new-password').value});modal.close();clearPrivateState();render();toast(t('密碼已更新，請重新登入'));break;
      case 'user':{const u=state.editUser;await api(u?`/team/${u.id}`:'/team',u?'PUT':'POST',u?{active:Boolean(u.active),password:$('#team-password').value}:{username:$('#team-username').value,role:$('#team-role').value,password:$('#team-password').value});modal.close();state.users=(await api('/team')).users;render();toast(u?t('密碼已重設'):t('帳號已建立'));break;}
    }
  }catch(err){if(error?.isConnected)error.textContent=t(err.message);else toast(err.message);}finally{if(submit.isConnected)submit.disabled=false;}
});
try{Object.assign(state,await api('/session'));if(state.user)await load();render();}catch(e){$('#app').innerHTML=ui`<div class="empty"><h2>暫時無法連線</h2><p>${esc(t(e.message))}</p><button class="btn" data-action="refresh">重新嘗試</button></div>`;}

// Refresh shared records without disturbing an open edit or a typed search.
let syncing=false;
async function syncShared(){
 if(!cloudApi||!state.user||document.hidden||modal.open||syncing||document.activeElement?.matches('input,textarea,select'))return;
 syncing=true;const identity=state.user.id;
 try{const data=await api('/data');if(state.user?.id!==identity)return;const changed=JSON.stringify([state.clients,state.tags,state.recommendations,state.recommendationsSync,state.recommendationsSyncRequest,state.quotesEnabled,state.quoteConnection])!==JSON.stringify([data.clients,data.tags,data.recommendations,data.recommendationsSync,data.recommendationsSyncRequest,data.quotesEnabled,data.quoteConnection]);Object.assign(state,data);if(changed&& !modal.open)render();const status=$('#sync-status');if(status)status.textContent=t('共享資料 · 已同步 ')+new Date().toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'});}
 catch(e){const status=$('#sync-status');if(status)status.textContent=t('同步暫停 · 請重新整理');}
 finally{syncing=false;}
}
if(cloudApi){setInterval(()=>{void syncShared();if(state.view==='recommendations'&&!document.hidden&&!modal.open){const status=document.querySelector('.recommendation-sync');if(status)status.outerHTML=recommendationSyncStatus();}},15000);window.addEventListener('focus',syncShared);document.addEventListener('visibilitychange',syncShared);}
setInterval(()=>void loadHoldingPrices(),60_000);
window.addEventListener('focus',()=>void loadHoldingPrices());
document.addEventListener('visibilitychange',()=>void loadHoldingPrices());
