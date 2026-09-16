import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
const project = new URL('../../', import.meta.url);
const apkUrl = new URL('android-native/app/build/outputs/apk/debug/app-debug.apk', project);
const apk = await readFile(apkUrl);
const env = parse(await readFile(new URL('.env',project)));
const team = parse(await readFile(new URL('.env.team.local',project)));
const edge = parse(await readFile(new URL('.env.edge.local',project)).catch(()=>''));
const device = parse(await readFile(new URL('.env.device-validation.local',project)).catch(()=>''));
const testAccount = parse(await readFile(new URL('.env.phone-test-account.local',project)).catch(()=>''));
const secretNames=['DATA_GO_KR_KEY','KAKAO_REST_API_KEY','KAKAO_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_CLIENT_SECRET','JWT_SECRET','JWT_REFRESH_SECRET','DATABASE_URL','OAUTH_FLOW_ENCRYPTION_KEY','EDGE_VALIDATION_KEY','OPENAI_API_KEY'];
const secrets=secretNames.flatMap(name=>[env[name],team[name],edge[name]].filter(v=>v&&v.length>8).map(value=>({name,value})));
if(testAccount.TEST_PASSWORD)secrets.push({name:'TEST_ACCOUNT_PASSWORD',value:testAccount.TEST_PASSWORD});
let end=apk.length-22;
while(end>=Math.max(0,apk.length-65557)&&apk.readUInt32LE(end)!==0x06054b50) end--;
if(end<0)throw new Error('Invalid APK ZIP directory');
const count=apk.readUInt16LE(end+10);let pos=apk.readUInt32LE(end+16);
const leaks=[],libraries=[];let checked=0;let nativeKeyFound=false,devKeyFound=false,deviceKeyFound=false,deviceLocationDiagnostics=false;
for(let i=0;i<count;i++) {
  if(apk.readUInt32LE(pos)!==0x02014b50) throw new Error('Invalid central directory');
  const method=apk.readUInt16LE(pos+10),size=apk.readUInt32LE(pos+20),nameLength=apk.readUInt16LE(pos+28),extra=apk.readUInt16LE(pos+30),comment=apk.readUInt16LE(pos+32),offset=apk.readUInt32LE(pos+42);
  const name=apk.toString('utf8',pos+46,pos+46+nameLength);pos+=46+nameLength+extra+comment;
  const begin=offset+30+apk.readUInt16LE(offset+26)+apk.readUInt16LE(offset+28);
  const compressed=apk.subarray(begin,begin+size);
  const data=method===8?inflateRawSync(compressed):compressed;
  checked++;
  if(name.endsWith('.dex')&&data.includes(Buffer.from('WBR_LOCATION')))deviceLocationDiagnostics=true;
  if(/\.(dex|xml|arsc|json|js|properties)$/.test(name)) {
    for(const {name:secretName,value} of secrets) if(data.includes(Buffer.from(value))||data.includes(Buffer.from(value,'utf16le')))leaks.push({entry:name,secretName});
    if(env.KAKAO_NATIVE_APP_KEY&&data.includes(Buffer.from(env.KAKAO_NATIVE_APP_KEY)))nativeKeyFound=true;
    if(team.TEAM_ACCESS_KEY&&data.includes(Buffer.from(team.TEAM_ACCESS_KEY)))devKeyFound=true;
    if(device.DEVICE_VALIDATION_TOKEN&&data.includes(Buffer.from(device.DEVICE_VALIDATION_TOKEN)))deviceKeyFound=true;
  }
  if(name.endsWith('.so')&&data.toString('ascii',1,4)==='ELF'&&data[5]===1) {
    const is64=data[4]===2, ph=is64?Number(data.readBigUInt64LE(32)):data.readUInt32LE(28),entrySize=data.readUInt16LE(is64?54:42),n=data.readUInt16LE(is64?56:44);
    const alignments=[];
    for(let j=0;j<n;j++){const at=ph+j*entrySize;if(data.readUInt32LE(at)===1)alignments.push(is64?Number(data.readBigUInt64LE(at+48)):data.readUInt32LE(at+28));}
    libraries.push({name,loadSegmentAlignment:alignments,supports16kAlignment:alignments.every(a=>a>=16384)});
  }
}
const report={checkedAt:new Date().toISOString(),sha256:createHash('sha256').update(apk).digest('hex'),apkBytes:apk.length,checkedEntries:checked,serverSecretLeaks:leaks,deviceLocationDiagnostics,nativeKeyIncluded:nativeKeyFound,developmentAccessKeyIncluded:devKeyFound,expiringDeviceKeyIncluded:deviceKeyFound,deviceValidationScope:deviceKeyFound?device.VALIDATION_SCOPE:undefined,deviceKeyExpiresAt:deviceKeyFound?device.EXPIRES_AT:undefined,distribution:'Private debug pilot only; do not publish the APK with the development key.',nativeLibraries:libraries};
await mkdir(new URL('.runtime/native-pilot/',project),{recursive:true});
await writeFile(new URL('.runtime/native-pilot/apk-audit.json',project),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(leaks.length)process.exitCode=1;
