const WebSocket = require('ws');
const wsUrl = 'ws://localhost:9222/devtools/page/A7103370F43573CBD72DD263DAB0C329';
const ws = new WebSocket(wsUrl);
let id=0; const pending=new Map(); const consoleMsgs=[];
ws.on('message', (data)=>{
  const msg=JSON.parse(data);
  if(msg.id && pending.has(msg.id)){ pending.get(msg.id)(msg); pending.delete(msg.id); }
  if(msg.method==='Runtime.consoleAPICalled'){
    const t=(msg.params.args||[]).map(a=>a.value||a.description).join(' ');
    consoleMsgs.push(t);
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
    await send('Page.enable');
    await send('Page.navigate',{url:'http://localhost:8081/auth'});
    await new Promise(r=>setTimeout(r,12000));
    await send('Runtime.evaluate',{expression:'localStorage.clear();sessionStorage.clear();',returnByValue:true});
    await send('Page.reload');
    await new Promise(r=>setTimeout(r,12000));
    await send('Runtime.evaluate',{expression:'document.querySelector("#email").focus()',returnByValue:true});
    await new Promise(r=>setTimeout(r,200));
    for(const ch of 'admin@test.com'){
      await send('Input.dispatchKeyEvent',{type:'keyDown',text:ch});
      await send('Input.dispatchKeyEvent',{type:'keyUp',text:ch});
    }
    await new Promise(r=>setTimeout(r,200));
    await send('Runtime.evaluate',{expression:'document.querySelector("#password").focus()',returnByValue:true});
    await new Promise(r=>setTimeout(r,200));
    for(const ch of 'Password123!'){
      await send('Input.dispatchKeyEvent',{type:'keyDown',text:ch});
      await send('Input.dispatchKeyEvent',{type:'keyUp',text:ch});
    }
    await new Promise(r=>setTimeout(r,500));
    const vals = await send('Runtime.evaluate',{expression:'JSON.stringify({e:document.querySelector("#email").value,p:document.querySelector("#password").value.length})',returnByValue:true});
    console.log('VALS', vals.result.result.value);
    await send('Runtime.evaluate',{expression:'document.querySelector("form").requestSubmit()',returnByValue:true});
    await new Promise(r=>setTimeout(r,15000));
    const urlRes = await send('Runtime.evaluate',{expression:'window.location.href',returnByValue:true});
    console.log('URL', urlRes.result.result.value);
    console.log('CONSOLE', consoleMsgs.slice(-25).join('\n'));
  }catch(e){console.error(e);}
  ws.close();
  process.exit(0);
});
