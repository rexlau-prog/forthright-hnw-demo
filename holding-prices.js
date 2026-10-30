import {isFuture,assetPresets,defaultCurrency} from './assets.js?v=99b8c4345705116e';
// Quote adapters receive symbols only. Client identity, size and cost stay in the browser.
export function quoteKey(asset) {
  const symbol=String(asset?.symbol??'').trim().toUpperCase();
  if(asset?.market==='HK'&&/^\d{1,5}$/.test(symbol))return `HK:${symbol.padStart(5,'0')}`;
  if(asset?.market==='US'&&/^[A-Z][A-Z0-9.-]{0,19}$/.test(symbol))return `US:${symbol}`;
  if(assetPresets.some(p=>p.market===asset?.market&&p.symbol===symbol)){
    if(asset.market==='Crypto')return `Crypto:${symbol}`;
    if(isFuture(asset)&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(asset.contractMonth??''))return `${asset.market}:${symbol}:${asset.contractMonth}`;
  }
  return null;
}
export function quoteRequest(asset){
  const key=quoteKey(asset);if(!key)return null;
  const [market,symbol,contractMonth]=key.split(':');
  return {market,symbol,...(contractMonth?{contractMonth}:{})};
}

export function validateQuote(asset,quote,now=Date.now()) {
  if(!quote||!quoteKey(asset)||quoteKey(asset)!==quoteKey(quote))return null;
  const timestamp=Date.parse(quote.asOf);
  if(typeof quote.price!=='number'||!Number.isFinite(quote.price)||quote.price<0
    ||!Number.isFinite(timestamp)||timestamp>now+300_000
    ||!/(?:Z|[+-]\d{2}:\d{2})$/.test(String(quote.asOf))
    ||!['USD','HKD','CNY','EUR','GBP','JPY','AUD','CAD','SGD','CHF'].includes(quote.currency)
    ||typeof quote.source!=='string'||!quote.source.trim()||quote.source.length>80)return null;
  if(isFuture(asset)&&(quote.currency!==defaultCurrency(asset.market)||typeof quote.contractMultiplier!=='number'||!Number.isFinite(quote.contractMultiplier)||quote.contractMultiplier<=0))return null;
  if(asset.market==='Crypto'&&quote.currency!=='USD')return null;
  return {status:'available',price:quote.price,currency:quote.currency,asOf:new Date(timestamp).toISOString(),source:quote.source,
    delayMinutes:Number.isFinite(quote.delayMinutes)&&quote.delayMinutes>=0?quote.delayMinutes:null,
    session:quote.session==='closed'?'closed':null,
    ...(isFuture(asset)?{contractMultiplier:quote.contractMultiplier}:{})};
}

const validNumber=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function unrealizedPnl(holding,quote) {
  if(quote?.status!=='available')return {status:'no-quote'};
  if(!validNumber(quote.price))return {status:'no-quote'};
  if(!validNumber(holding.quantity)||!validNumber(holding.avgCost))return {status:'missing-position'};
  if(!holding.currency||holding.currency!==quote.currency)return {status:'currency-mismatch'};
  const future=isFuture(holding);
  if(future&&(!['LONG','SHORT'].includes(holding.direction)||!Number.isInteger(holding.quantity)))return {status:'invalid-position'};
  if(future&&(!quoteKey(holding)||typeof quote.contractMultiplier!=='number'||!Number.isFinite(quote.contractMultiplier)||quote.contractMultiplier<=0))return {status:'missing-contract'};
  const amount=(quote.price-holding.avgCost)*holding.quantity*(future?quote.contractMultiplier*(holding.direction==='SHORT'?-1:1):1);
  const cost=holding.avgCost*holding.quantity;
  // Futures margin is not recorded. A return on margin cannot be inferred from quote points.
  const percent=!future&&cost>0?amount/cost*100:null;
  if(!Number.isFinite(amount)||!Number.isFinite(cost)||(percent!==null&&!Number.isFinite(percent)))return {status:'invalid-position'};
  return {status:'available',amount:Object.is(amount,-0)?0:amount,percent,currency:quote.currency,...(future?{contractMultiplier:quote.contractMultiplier,basis:'contract-multiplier'}:{})};
}

export function createQuoteCache(loader,{now=Date.now,ttl=60_000}={}) {
  const cache=new Map(),pending=new Map();let generation=0;
  return {
    read(asset){const key=quoteKey(asset);return key?(cache.get(key)?.quote??{status:pending.has(key)?'loading':'unavailable'}):{status:'unsupported'};},
    clear(){generation++;cache.clear();pending.clear();},
    async load(holdings,{force=false}={}) {
      const unique=new Map(holdings.map(h=>[quoteKey(h),h]).filter(([key])=>key));
      const requests=[...unique].filter(([key])=>!pending.has(key)&&(force||!cache.has(key)||now()-cache.get(key).at>=ttl));
      const waits=new Set([...unique.keys()].map(key=>pending.get(key)).filter(Boolean));
      // Bounded batches; adapters can apply provider-specific rate limits independently.
      for(let i=0;i<requests.length;i+=100){
        const batch=requests.slice(i,i+100),attempt=generation;
        const work=Promise.resolve().then(()=>loader(batch.map(([,holding])=>quoteRequest(holding))))
          .then(data=>{
            if(attempt!==generation)return;
            const returned=new Map((Array.isArray(data?.quotes)?data.quotes:[]).map(q=>[quoteKey(q),q]));
            for(const [key,holding] of batch)cache.set(key,{at:now(),quote:validateQuote(holding,returned.get(key),now())??{status:data?.status==='not-configured'?'not-configured':'unavailable'}});
          }).catch(()=>{if(attempt===generation)for(const [key] of batch)cache.set(key,{at:now(),quote:{status:'unavailable'}});})
          .finally(()=>{if(attempt===generation)for(const [key] of batch)pending.delete(key);});
        for(const [key] of batch)pending.set(key,work);
        waits.add(work);
      }
      await Promise.all(waits);
    }
  };
}
