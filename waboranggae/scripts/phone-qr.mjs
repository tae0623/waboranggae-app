import { createRequire } from 'node:module';
import { writeFile, readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
const require=createRequire(import.meta.url);
const cli=require.resolve('@expo/cli',{paths:[require.resolve('expo/package.json')]});
const {toQR}=require(require.resolve('toqr',{paths:[cli]}));
const state=JSON.parse(await readFile('.runtime/team-processes.json','utf8'));
const address=process.env.PHONE_LAN_IP || Object.entries(networkInterfaces()).filter(([name])=>!/^vEthernet|WSL|Docker/i.test(name)).flatMap(([,items])=>items||[]).find(item=>item.family==='IPv4'&&!item.internal)?.address;
if(!address)throw new Error('LAN 주소를 찾지 못했습니다.');
const nativeUrl='exp://'+address+':8082';
function svg(text) {
  const cells=toQR(text), width=Math.sqrt(cells.length), margin=4;
  if(!Number.isInteger(width))throw new Error('QR generation failed');
  const pixels=Array.from(cells).flatMap((value,index)=>value?['<rect x="'+(index%width+margin)+'" y="'+(Math.floor(index/width)+margin)+'" width="1" height="1"/>']:[]).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(width+8)+' '+(width+8)+'" width="328" height="328"><rect width="100%" height="100%" fill="white"/><g fill="black">'+pixels+'</g></svg>';
}
await writeFile('.runtime/phone-expo.svg',svg(nativeUrl));
await writeFile('.runtime/phone-web.svg',svg(state.url));
console.log(JSON.stringify({nativeUrl,webUrl:state.url,expoQR:'.runtime/phone-expo.svg',webQR:'.runtime/phone-web.svg'}));
