// Curated product roots, not continuous-price feeds or specific expiry contracts.
// CME: /tools-information/liquidity-alerts/metals-channels.html and
// /articles/faqs/micro-e-mini-equity-index-futures-frequently-asked-questions.html
// HKEX: Hang Seng Index, China Enterprises and Hang Seng TECH futures specifications.
export const markets={US:'美股',HK:'港股',CommodityFutures:'商品期貨',HKIndexFutures:'香港股指期貨',USIndexFutures:'美國股指期貨',Crypto:'加密資產',Others:'其他資產'};
export const isFuture=h=>['CommodityFutures','HKIndexFutures','USIndexFutures'].includes(typeof h==='string'?h:h?.market);
export const assetType=market=>isFuture(market)?'FUTURE':market==='Crypto'?'CRYPTO':market==='Others'?'OTHER':'UNVERIFIED';
export const defaultCurrency=market=>['HK','HKIndexFutures'].includes(market)?'HKD':'USD';
export const assetPresets=[
 ['CommodityFutures','GC','黃金期貨 · COMEX'],['CommodityFutures','SI','白銀期貨 · COMEX'],
 ['HKIndexFutures','HSI','恆生指數期貨'],['HKIndexFutures','MHI','小型恆生指數期貨'],
 ['HKIndexFutures','HHI','恆生中國企業指數期貨'],['HKIndexFutures','MCH','小型恆生中國企業指數期貨'],['HKIndexFutures','HTI','恆生科技指數期貨'],
 ['USIndexFutures','ES','E-mini 標普 500 指數期貨'],['USIndexFutures','MES','微型 E-mini 標普 500 指數期貨'],
 ['USIndexFutures','NQ','E-mini 納斯達克 100 指數期貨'],['USIndexFutures','MNQ','微型 E-mini 納斯達克 100 指數期貨'],
 ['USIndexFutures','YM','E-mini 道瓊斯指數期貨'],['USIndexFutures','MYM','微型 E-mini 道瓊斯指數期貨'],
 ['USIndexFutures','RTY','E-mini Russell 2000 指數期貨'],['USIndexFutures','M2K','微型 E-mini Russell 2000 指數期貨'],
 ['Crypto','BTC','Bitcoin · 比特幣'],['Crypto','ETH','Ethereum · 以太幣'],['Crypto','SOL','Solana'],['Crypto','BNB','BNB'],['Crypto','XRP','XRP']
].map(([market,symbol,name])=>({market,symbol,name,type:assetType(market),currency:defaultCurrency(market)}));
export function withAssetPresets(catalog){return {...catalog,securities:[...catalog.securities,...assetPresets]};}
export const holdingIdentity=h=>JSON.stringify([h.market,h.symbol,...(isFuture(h)?[h.contractMonth,h.direction]:[])]);
export function contractLabel(h){return isFuture(h)?`${h.contractMonth||'未選月份'} · ${h.direction==='SHORT'?'賣出 / 空倉':'買入 / 好倉'}`:'';}
