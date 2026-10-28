import {t,tagLabel,securityName} from './language.js?v=2c2bc643fb8e13c8';

// Quote every field, preserve multiline notes, and prevent spreadsheet formula execution.
export function csvCell(value, preserveZeroes=false){
  let text=String(value??'');
  if(/^[\s\u0000-\u001f]*[=+@-]/u.test(text)||(preserveZeroes&&/^0\d+$/.test(text)))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

export function clientsCsv(clients,tags,names={}){
  const labels=['客戶編號','客戶姓氏','WhatsApp 尾兩碼','服務群組','會員級別','客戶標籤','持倉市場','持倉代號','資產名稱','資產類型','幣種','數量','平均成本','持倉備註','團隊備註','最後更新時間','更新同事'];
  const rows=[labels.map(label=>csvCell(t(label))).join(',')];
  const tagNames=new Map(tags.map(tag=>[tag.id,tagLabel(tag.name)]));
  for(const client of clients){
    // A client without holdings still appears once; multiple holdings get separate rows.
    for(const holding of client.holdings.length?client.holdings:[{}]){
      const market={US:t('美股'),HK:t('港股'),Others:t('其他資產')}[holding.market]??'';
      const values=[client.id,client.surname,client.last2,client.groupName,t(client.tier),client.tags.map(id=>tagNames.get(id)).filter(Boolean).join(' / '),market,holding.symbol,securityName(holding,names),holding.type,holding.currency,holding.quantity,holding.avgCost,holding.notes,client.notes,client.updatedAt,client.updatedBy];
      rows.push(values.map((value,i)=>csvCell(value,i===2||i===7)).join(','));
    }
  }
  // BOM lets Excel recognize Chinese UTF-8 correctly.
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}
