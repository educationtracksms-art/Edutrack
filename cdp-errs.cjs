const WebSocket = require('ws');
const wsUrl = 'ws://localhost:9223/devtools/page/0327BF305D08C37D1601E4EB0D062351';
const ws = new WebSocket(wsUrl);
let id=0; const pending=new Map(); const consoleMsgs=[]; const net=[];
ws.on('message', (data)=>{
  const msg=JSON.parse(data);
  if(msg.id && pending.has(msg.id)){ pending.get(msg.id)(msg); pending.delete(msg.id); }
  if(msg.method==='Runtime.consoleAPICalled'){
    const t=(msg.params.args||[]).map(a=>a.value||a.description).join(' ');
    consoleMsgs.push(t);
  }
  if(msg.method==='Network.responseReceived'){
    const u=msg.params.response.url;
    if(/token/i.test(u)){ net.push('STATUS '+msg.params.response.status+' '+u); }
  }
});
ws.on('open', async ()=>{
  try{
    function send(method,params={}){
      return new Promise((resolve)=>{
        const i=++id; pending.set(i,resolve);
        ws.send(JSON.stringify({id:i,method,params}));
      });
    }
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Network.enable');
    await send('Page.enable');
    await send('Page.navigate',{url:'http://localhost:8081/auth'});
    await new Promise(r=>setTimeout(r,12000));
    await send('Runtime.evaluate',{expression:'localStorage.clear();sessionStorage.clear();',returnByValue:true});
    await send('Page.reload');
    await new Promise(r=>setTimeout(r,12000));
    // error capture
    await send('Runtime.evaluate',{expression:`
      window.__errs=[];
      window.onerror=(m,s,l,c,e)=>{window.__errs.push('ERR: '+m);};
      window.addEventListener('unhandledrejection',e=>{window.__errs.push('REJ: '+(e.reason&&e.reason.message||e.reason));});
      'ok';
    `,returnByValue:true});
    // fetch interceptor for token body
    await send('Runtime.evaluate',{expression:`
      const origFetch=window.fetch;
      window.fetch=async(...args)=>{
        const r=await origFetch(...args);
        const u=(typeof args[0]==='string')?args[0]:(args[0]?.url||'');
        if(u.includes('auth/v1/token')){
          const c=r.clone();
          const txt=await c.text();
          console.log('TOKENRESP', r.status, txt.slice(0,200));
        }
        return r;
      };
      'ok';
    `,returnByValue:true});
    await send('Runtime.evaluate',{expression:`
      const e=document.querySelector('#email');
      const p=document.querySelector('#password');
      const setNativeValue=(el,val)=>{const proto=Object.getPrototypeOf(el);const desc=Object.getOwnPropertyDescriptor(proto,'value');desc.set.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));};
      setNativeValue(e,'admin@test.com');
      setNativeValue(p,'Password123!');
      'done';
    `,returnByValue:true});
    await new Promise(r=>setTimeout(r,500));
    await send('Runtime.evaluate',{expression:'document.querySelector("form").requestSubmit()',returnByValue:true});
    await new Promise(r=>setTimeout(r,15000));
    const urlRes = await send('Runtime.evaluate',{expression:'window.location.href',returnByValue:true});
    console.log('URL', urlRes.result.result.value);
    const errs = await send('Runtime.evaluate',{expression:'JSON.stringify(window.__errs)',returnByValue:true});
    console.log('ERRS', errs.result.result.value);
    console.log('NET', net.slice(-5).join('\n'));
    console.log('CONSOLE', consoleMsgs.slice(-25).join('\n'));
    const body = await send('Runtime.evaluate',{expression:'document.body.innerText.slice(0,400)',returnByValue:true});
    console.log('BODY', body.result.result.value);
  }catch(e){console.error(e);}
  ws.close();
  process.exit(0);
});