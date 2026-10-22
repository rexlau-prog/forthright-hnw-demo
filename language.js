// Presentation only: never convert records, form values, identifiers, or API payloads.
const pairs = `來来 倉仓 個个 備备 債债 僅仅 價价 儲储 別别 刪删 動动 務务 參参 員员 啟启 單单 嘗尝 國国 圍围 團团 報报 場场 寫写 尋寻 對对 導导 帳账 幣币 後后 從从 徵征 態态 應应 戶户 換换 擇择 敗败 數数 於于 時时 暫暂 會会 條条 構构 標标 機机 檔档 權权 歡欢 沒没 淨净 溫温 為为 無无 狀状 獲获 現现 產产 確确 碼码 種种 稱称 節节 範范 篩筛 簡简 籤签 級级 細细 組组 結结 絡络 統统 線线 編编 總总 聯联 與与 蓋盖 虛虚 號号 裡里 見见 覽览 計计 訊讯 記记 設设 註注 試试 該该 請请 證证 護护 讀读 讓让 資资 購购 載载 輯辑 輸输 這这 連连 進进 運运 過过 選选 錄录 鍵键 鑽钻 閉闭 開开 間间 關关 陳陈 隊队 雲云 頁页 項项 須须 預预 類类 顯显 點点 係系 語语 體体`;
const characters=Object.fromEntries(pairs.split(' ').map(pair=>[...pair]));
const phrases=[['重新整理','刷新'],['重新嘗試','重试'],['登入','登录'],['登出','退出登录'],['帳號','账号'],['儲存','保存'],['載入','加载'],['存取權','访问权限']];
let selected='zh-Hant';
try {if(globalThis.localStorage?.getItem('forthright-language')==='zh-Hans')selected='zh-Hans';} catch {}
export const language=()=>selected;
export const locale=()=>selected==='zh-Hans'?'zh-CN':'zh-HK';
export function setLanguage(value){
 selected=value==='zh-Hans'?'zh-Hans':'zh-Hant';
 try {globalThis.localStorage?.setItem('forthright-language',selected);} catch {}
}
export function t(value){
 let text=String(value??'');
 if(selected!=='zh-Hans')return text;
 for(const [from,to] of phrases)text=text.replaceAll(from,to);
 return [...text].map(c=>characters[c]??c).join('');
}
// Tags are display labels: keep their IDs and stored spelling unchanged.
const tagVariants=[['活躍','活跃'],['不配合','不配合'],['配合','配合'],['冷淡','冷淡'],['積極學習','积极学习'],['沒有回應','没有回应']];
export function tagLabel(name){
 const pair=tagVariants.find(pair=>pair.includes(name));
 return pair?pair[selected==='zh-Hans'?1:0]:t(name);
}
// Resolve old saved holdings through the reference directory, never rewriting records.
export function securityName(security,names={}){
 if(security.market!=='HK'||security.manual)return security.name??'';
 const reference=names[String(security.symbol).padStart(5,'0')]??security;
 return (selected==='zh-Hans'?reference.nameZhHans:reference.nameZhHant)||reference.nameZh||security.name||'';
}
// Translate literal UI segments only, so interpolated names/notes are preserved exactly.
export function ui(strings,...values){return strings.reduce((result,part,index)=>result+t(part)+(index<values.length?values[index]:''),'');}
export function languageControl(){return `<label class="language-control"><span class="language-icon" aria-hidden="true">文</span><span class="sr-only">${t('介面語言')}</span><select id="language-select" aria-label="${t('介面語言')}"><option value="zh-Hant" ${selected==='zh-Hant'?'selected':''}>繁體中文</option><option value="zh-Hans" ${selected==='zh-Hans'?'selected':''}>简体中文</option></select></label>`;}
