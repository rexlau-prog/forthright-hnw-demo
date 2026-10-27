// Browser-safe credentials only. Sessions and client records stay in memory.
// No localStorage, sessionStorage, IndexedDB, or service-worker cache.
export function createCloudApi(config, fetcher = fetch) {
  const base = config.url.replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) || !/^sb_publishable_/.test(config.key)) throw new Error('雲端設定不正確');
  let session = null, user = null, catalogPromise, refreshPromise, generation = 0, quoteStatus=null;
  const reset = () => { generation++; session = null; user = null; quoteStatus=null; };
  const expired = () => Object.assign(new Error('請重新登入'),{status:401});
  async function request(url, {method='POST', body, token} = {}) {
    const res = await fetcher(url, {method,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      const status = /^PT\d{3}$/.test(data.code ?? '') ? Number(data.code.slice(2)) : res.status;
      if(status===401) reset();
      const message = status===429?'登入嘗試過多，請稍後再試':data.code==='invalid_credentials'?'帳號或密碼不正確':data.message ?? data.error_description ?? data.error ?? '暫時無法連線';
      throw Object.assign(new Error(message),{status});
    }
    return data;
  }
  async function accessToken() {
    if(!session || Date.now()-session.started > 8*60*60*1000) { reset(); throw Object.assign(new Error('請重新登入'),{status:401}); }
    if(Date.now() > session.expires-60000) {
      if(!refreshPromise) refreshPromise=(async()=>{
        const started=session.started, token=session.refresh_token, attempt=generation;
        const next=await request(`${base}/auth/v1/token?grant_type=refresh_token`,{body:{refresh_token:token}});
        if(attempt!==generation)throw expired();
        session={...next,started,expires:Date.now()+next.expires_in*1000};
      })().finally(()=>{refreshPromise=null;});
      await refreshPromise;
    }
    if(!session)throw expired();
    return session.access_token;
  }
  const rpc = async (path,method='GET',body={}) => request(`${base}/rest/v1/rpc/hnw_request`,{token:await accessToken(),body:{path,method,body}});
  const quoteRequest=async body=>request(`${base}/functions/v1/hnw-quotes`,{token:await accessToken(),body});
  async function connection() {
    if(config.quoteBackend!==true)return {connected:false,configured:false};
    if(quoteStatus&&Date.now()-quoteStatus.at<30000)return quoteStatus.value;
    const attempt=generation;
    try {const value={...await quoteRequest({action:'status'}),configured:true};if(attempt!==generation)throw expired();quoteStatus={at:Date.now(),value};return value;}
    catch(e){if(e.status===401)throw e;return {connected:false,configured:true,unavailable:true};}
  }
  async function catalog() {
    if(!catalogPromise) catalogPromise=fetcher(new URL('./securities.json',import.meta.url),{credentials:'omit'}).then(r=>{if(!r.ok)throw new Error('無法載入證券目錄');return r.json();}).catch(e=>{catalogPromise=null;throw e;});
    return catalogPromise;
  }
  return async function api(path,method='GET',body={}) {
    if(path==='/session') return {user,demo:false,sharedDemo:true,cloud:true};
    if(path==='/login') {
      const username=String(body.username??'').toLowerCase().trim();
      if(!/^[a-z0-9_.-]{3,40}$/.test(username))throw new Error('帳號格式不正確');
      reset();
      const next=await request(`${base}/auth/v1/token?grant_type=password`,{body:{email:`${username}@hnw.forthright.invalid`,password:body.password}});
      session={...next,started:Date.now(),expires:Date.now()+next.expires_in*1000};
      try {const profile=await rpc('/session');user=profile.user;return {...profile,cloud:true};} catch(e){reset();throw e;}
    }
    if(path==='/logout') {
      const token=session?.access_token; reset();
      if(token)await request(`${base}/auth/v1/logout?scope=local`,{token,body:{}});
      return {ok:true};
    }
    if(path==='/data') {
      const [data,reference,quoteConnection]=await Promise.all([rpc(path),catalog(),connection()]);
      return {...data,quoteConnection,quotesEnabled:quoteConnection.connected===true,catalog:reference.meta,securityNames:Object.fromEntries(reference.securities.filter(s=>s.market==='HK').map(s=>[s.symbol,{nameZhHant:s.nameZhHant,nameZhHans:s.nameZhHans,nameZh:s.nameZh}]))};
    }
    if(path.startsWith('/securities?')) {
      await accessToken();
      const p=new URLSearchParams(path.split('?')[1]),q=(p.get('q')??'').toLowerCase().slice(0,80),market=p.get('market'),type=p.get('type');
      const results=(await catalog()).securities.filter(s=>(!market||s.market===market)&&(!type||s.type===type)&&(!q||`${s.symbol} ${s.name} ${s.nameZh??''} ${s.nameZhHant??''} ${s.nameZhHans??''}`.toLowerCase().includes(q)));
      const rank=s=>s.symbol.toLowerCase()===q?-3:s.symbol.toLowerCase().startsWith(q)?-1:0;
      results.sort((a,b)=>rank(a)-rank(b)||a.symbol.localeCompare(b.symbol));
      return {results:results.slice(0,40),total:results.length};
    }
    if(path==='/quotes') {
      await accessToken();
      if(config.quoteBackend!==true)return {status:'not-configured',quotes:[]};
      return quoteRequest({...body,action:'quotes'});
    }
    if(path==='/quote-connect') {
      if(config.quoteBackend!==true)throw new Error('報價服務尚未設定');
      return quoteRequest({action:'start'});
    }
    if(path==='/password'||(path.startsWith('/team')&&method!=='GET')) {
      return request(`${base}/functions/v1/hnw-admin`,{token:await accessToken(),body:{path,method,body}});
    }
    return rpc(path,method,body);
  };
}
