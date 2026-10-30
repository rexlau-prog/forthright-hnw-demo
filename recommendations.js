export function validateRecommendation(input){
 const invalid=()=>{throw Object.assign(new Error('推介資料格式不正確，請檢查股票、日期及價位'),{status:400});};
 if(!input||typeof input!=='object')invalid();
 const market=input.market,symbol=typeof input.symbol==='string'?input.symbol.trim().toUpperCase():'';
 if(!['US','HK'].includes(market)||!(market==='HK'?/^\d{1,5}$/:/^[A-Z][A-Z0-9.-]{0,19}$/).test(symbol))invalid();
 const text=(key,max)=>{const v=input[key]??'';if(typeof v!=='string'||v.length>max)invalid();return v.trim();};
 const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e15;
 const levels=key=>{const v=input[key];if(!Array.isArray(v)||v.length<1||v.length>10||v.some(x=>!positive(x)))invalid();return [...new Set(v)];};
 const date=input.recommendDate;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'2000-01-01'||date>'2100-12-31'||!positive(input.entry))invalid();
 return {market,symbol:market==='HK'?symbol.padStart(5,'0'):symbol,name:text('name',120),entry:input.entry,stopLoss:levels('stopLoss'),takeProfit:levels('takeProfit'),remarks:text('remarks',4000),recommendDate:date,currency:market==='HK'?'HKD':'USD'};
}
export function recommendationPerformance(record,quote){
 if(quote?.status!=='available'||!Number.isFinite(quote.price)||quote.price<0||quote.currency!==record.currency||!(record.entry>0))return null;
 return {change:quote.price-record.entry,percent:(quote.price/record.entry-1)*100};
}

export function recommendationSyncTime(sync,locale='zh-HK'){
 const value=sync?.lastSuccessAt;
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
 const date=new Date(value);
 return {iso:date.toISOString(),display:date.toLocaleString(locale,{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' HKT'};
}

export function recommendationSyncRecovered(sync,request){
 // A later verified source read supersedes an earlier failed manual request.
 const failed=Date.parse(request?.failedAt),read=Date.parse(sync?.sourceReadAt),success=Date.parse(sync?.lastSuccessAt);
 return Number.isFinite(failed)&&Number.isFinite(read)&&Number.isFinite(success)&&read>=failed&&success>=read;
}
