import {markets,contractLabel} from './assets.js?v=2695d527b6c00845';
import {t,tagLabel,securityName} from './language.js?v=2695d527b6c00845';
import {unrealizedPnl} from './holding-prices.js?v=2695d527b6c00845';
import {recommendationPerformance} from './recommendations.js?v=2695d527b6c00845';

// Quote every field, preserve multiline notes, and prevent spreadsheet formula execution.
export function csvCell(value, preserveZeroes=false){
  let text=typeof value==='number'?(Number.isFinite(value)?String(value):''):String(value??'');
  if((typeof value!=='number'&&/^[\s\u0000-\u001f]*[=+@-]/u.test(text))||(preserveZeroes&&/^0\d+$/.test(text)))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

// Use a fixed timezone and explicit offset, independent of the exporter's computer.
function hongKongTime(value){
  const date=new Date(value);
  if(!value||!Number.isFinite(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +08:00`;
}
const rounded=value=>typeof value==='number'&&Number.isFinite(value)?Number(value.toFixed(2)):'';
const quoteLabels=['現價','報價幣種','報價時間（香港時間）','報價來源','報價狀態','交易所延遲（分鐘）','交易時段'];
function quoteValues(quote){
  const available=quote?.status==='available';
  const status={available:'可用',loading:'載入報價中','not-configured':'報價來源待接入',unsupported:'此資產暫不支援報價',unavailable:'暫無報價',disabled:'尚未連接報價服務'}[quote?.status]||'暫無報價';
  return available?[quote.price,quote.currency,hongKongTime(quote.asOf),quote.source,t(status),quote.delayMinutes??t('未確認'),quote.session==='closed'?t('收市價'):'']:
    ['','','','',t(status),'',''];
}
const csv=rows=>'\uFEFF'+rows.map(row=>row.map(value=>csvCell(value)).join(',')).join('\r\n')+'\r\n';
function clientTags(client,tags){
  const byId=new Map(tags.map(tag=>[tag.id,tag]));
  const assigned=(client.tags??[]).map(id=>byId.get(id)??{id,name:'',color:''});
  return {
    names:assigned.map(tag=>tag.name?tagLabel(tag.name):tag.id).join(' / '),
    colors:assigned.filter(tag=>/^#[0-9a-f]{6}$/i.test(tag.color)).map(tag=>`${tag.name?tagLabel(tag.name):tag.id}=${tag.color}`).join(' / '),
    ids:assigned.map(tag=>tag.id).join(' / '),
    rawNames:assigned.map(tag=>tag.name).join(' / '),
    raw:JSON.stringify(assigned.map(({id,name,color})=>({id,name,color:color??''})))
  };
}

// A directory with exactly one row per client, including clients with no holdings.
// Individual costs, quantities, notes and quote snapshots belong to the detail CSV.
export function clientSummaryCsv(clients,tags,names={}, {exportedAt=new Date().toISOString()}={}){
  const labels=['客戶編號','客戶姓氏','WhatsApp 尾兩碼','服務群組','會員級別','客戶標籤','標籤顏色（標籤=HEX）','團隊備註','最後更新時間','最後更新時間（香港時間）','更新同事','客戶資料版本','標籤編號','原始標籤名稱','標籤原始資料（JSON）','客戶持倉總數','全部持倉清單','匯出時間（香港時間）'];
  const rows=[labels.map(label=>csvCell(t(label))).join(',')];
  for(const client of clients){
    const tag=clientTags(client,tags),holdings=client.holdings??[];
    const values=[client.id,client.surname,client.last2,client.groupName,t(client.tier),tag.names,tag.colors,client.notes,client.updatedAt,hongKongTime(client.updatedAt),client.updatedBy,client.version,tag.ids,tag.rawNames,tag.raw,holdings.length,holdings.map(h=>`${h.market}.${h.symbol}${contractLabel(h)?' · '+t(contractLabel(h)):''}${securityName(h,names)?' · '+securityName(h,names):''}`).join('\n'),hongKongTime(exportedAt)];
    rows.push(values.map((value,i)=>csvCell(value,i===2)).join(','));
  }
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}

export function clientsCsv(clients,tags,names={}, {quoteFor=()=>null,exportedAt=new Date().toISOString()}={}){
  const labels=['客戶編號','客戶姓氏','WhatsApp 尾兩碼','服務群組','會員級別','客戶標籤','持倉市場','持倉代號','資產名稱','資產類型','幣種','數量','平均成本','持倉備註','團隊備註','最後更新時間','更新同事'];
  labels.push('標籤顏色（標籤=HEX）',...quoteLabels,'未實現盈虧','未實現盈虧（%）','盈虧幣種','盈虧狀態','匯出時間（香港時間）');
  labels.push('客戶資料版本','標籤編號','原始標籤名稱','標籤原始資料（JSON）','持倉編號','客戶持倉總數','持倉次序','市場代碼','原始資產名稱','手動輸入資產','最後更新時間（香港時間）','期貨合約月份','期貨持倉方向');
  const rows=[labels.map(label=>csvCell(t(label))).join(',')];
  for(const client of clients){
    const tag=clientTags(client,tags),holdings=client.holdings??[];
    // A client without holdings still appears once; multiple holdings get separate rows.
    for(const [index,holding] of (holdings.length?holdings:[{}]).entries()){
      const market=t(markets[holding.market]??'');
      const values=[client.id,client.surname,client.last2,client.groupName,t(client.tier),tag.names,market,holding.symbol,securityName(holding,names),holding.type,holding.currency,holding.quantity,holding.avgCost,holding.notes,client.notes,client.updatedAt,client.updatedBy];
      const quote=holding.symbol?quoteFor(holding):null,pnl=unrealizedPnl(holding,quote);
      const pnlStatus={'available':'可用','no-quote':'暫無報價','missing-position':'請補充數量及平均成本','currency-mismatch':'成本與報價幣種不同','invalid-position':'請檢查持倉數值'};
      values.push(tag.colors,...(holding.symbol?quoteValues(quote):quoteLabels.map(()=>'')),
        rounded(pnl.amount),rounded(pnl.percent),pnl.currency??'',holding.symbol?t(pnlStatus[pnl.status]):'',hongKongTime(exportedAt));
      values.push(client.version,tag.ids,tag.rawNames,tag.raw,holding.id,holdings.length,holdings.length?index+1:'',holding.market,holding.name,typeof holding.manual==='boolean'?t(holding.manual?'是':'否'):'',hongKongTime(client.updatedAt),holding.contractMonth??'',holding.direction??'');
      rows.push(values.map((value,i)=>csvCell(value,i===2||i===7)).join(','));
    }
  }
  // BOM lets Excel recognize Chinese UTF-8 correctly.
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}

export function recommendationsCsv(records,names={}, {quoteFor=()=>null,exportedAt=new Date().toISOString()}={}){
  const labels=['推介編號','推介日期','市場','股票代號','股票名稱','幣種','入場價（Entry）','止蝕價（SL）','目標價（TP）','備註','最後更新時間','更新同事',...quoteLabels,'相對入場價變動','相對入場價表現（%）','匯出時間（香港時間）'];
  const rows=[labels.map(t)];
  for(const record of records){
    const quote=quoteFor(record),performance=recommendationPerformance(record,quote);
    // Prefix HK codes before serialization so Excel retains all five digits.
    const symbol=record.market==='HK'&&/^0\d+$/.test(record.symbol)?"'"+record.symbol:record.symbol;
    rows.push([record.id,record.recommendDate,t(record.market==='HK'?'港股':'美股'),symbol,securityName(record,names),record.currency,record.entry,
      record.stopLoss.join(' / '),record.takeProfit.join(' / '),record.remarks,record.updatedAt,record.updatedBy,
      ...quoteValues(quote),rounded(performance?.change),rounded(performance?.percent),hongKongTime(exportedAt)]);
  }
  return csv(rows);
}
