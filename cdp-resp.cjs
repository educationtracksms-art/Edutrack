const WebSocket = require('ws');
const wsUrl = 'ws://localhost:9222/devtools/page/A7103370F43573CBD72DD263DAB0C329';
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
    if(/token|server|fn|rpc/i.test(u)){ net.push(msg.params.response.status+' '+u); }
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
    console.log('RESP', net.slice(-20).join('\n'));
    console.log('CONSOLE', consoleMsgs.slice(-30).join('\n'));
    // toast/body
    const body = await send('Runtime.evaluate',{expression:'document.body.innerText.slice(0,500)',returnByValue:true});
    console.log('BODY', body.result.result.value);
  }catch(e){console.error(e);}
  ws.close();
  process.exit(0);
});