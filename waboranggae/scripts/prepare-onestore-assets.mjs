// Prepare store sizes without inventing app screens or changing existing identity.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE || 'sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-assets/onestore-upload');
await mkdir(path.join(output,'screenshots'),{recursive:true});
const brand=await readFile(path.join(root,'web/src/assets/brand-mark.svg'),'utf8');
const paths=brand.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="578" viewBox="0 0 1024 578">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ECF6E9"/><stop offset="1" stop-color="#CCE5D8"/></linearGradient></defs>
<rect width="1024" height="578" fill="url(#bg)"/>
<circle cx="1010" cy="15" r="300" fill="#D8EDDE"/>
<path d="M-30 493C180 345 330 626 605 460S961 377 1060 491" stroke="#B4D4BF" stroke-width="2" fill="none"/>
<path d="M-50 530C180 382 330 663 605 497S961 414 1060 528" stroke="#C1DDC9" stroke-width="2" fill="none"/>
<text x="86" y="113" fill="#42785A" font-family="Malgun Gothic" font-size="18" font-weight="bold" letter-spacing="3">나다운 전남 여행</text>
<text x="80" y="216" fill="#153D2C" font-family="Malgun Gothic" font-size="88" font-weight="bold" letter-spacing="-5">뚜버기</text>
<text x="86" y="277" fill="#204A35" font-family="Malgun Gothic" font-size="32" font-weight="bold" letter-spacing="-1">전남을, 가볍게 걸어요</text>
<text x="88" y="322" fill="#52735E" font-family="Malgun Gothic" font-size="21">도보 · 대중교통 여행 코스</text>
<circle cx="761" cy="218" r="167" fill="#FFFFFF" fill-opacity=".7"/>
<g transform="translate(426 -108) scale(6.05)">${paths}</g>
</svg>`;
await writeFile(path.join(root,'release-assets/branding/onestore-graphic-source.svg'),svg);
await sharp(Buffer.from(svg)).flatten({background:'#ECF6E9'}).png().toFile(path.join(output,'01-graphic-1024x578.png'));
await sharp(path.join(root,'release-assets/branding/ddubugi-logo-512.png')).flatten({background:'#F0FDF4'}).removeAlpha().png().toFile(path.join(output,'02-icon-512x512.png'));
const screens=[['01-home','전남 여행, 여기서 시작'],['02-plan','날짜와 시간을 내 일정대로'],['04-pace','나에게 맞는 여행 속도'],['05-interests','취향과 식사 계획을 함께']];
const results=[];
for(const [name,title] of screens){
 const input=path.join(root,'.runtime/onestore-captures',name+'.png');
 try{await stat(input)}catch{continue;}
 const capture=await sharp(input).resize({width:636,height:1085,fit:'inside'}).png().toBuffer();
 const meta=await sharp(capture).metadata();
 const x=Math.floor((720-meta.width)/2),y=163;
 const frame=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><rect width="720" height="1280" fill="#EAF3EC"/><text x="42" y="53" font-family="Malgun Gothic" font-size="22" font-weight="bold" fill="#397253">뚜버기</text><text x="40" y="108" font-family="Malgun Gothic" font-size="32" font-weight="bold" letter-spacing="-1" fill="#182E22">${title}</text><rect x="${x-3}" y="${y-3}" width="${meta.width+6}" height="${meta.height+6}" fill="#C5D4C9"/></svg>`;
 const file='screenshots/'+name+'.png';
 await sharp(Buffer.from(frame)).composite([{input:capture,left:x,top:y}]).flatten({background:'#EAF3EC'}).removeAlpha().png({palette:true,quality:95,effort:10}).toFile(path.join(output,file));
 results.push(file);
}
for(const file of ['01-graphic-1024x578.png','02-icon-512x512.png',...results]){
 const buffer=await readFile(path.join(output,file));const meta=await sharp(buffer).metadata();
 if(meta.format!=='png'||buffer.length>=1_000_000||meta.hasAlpha)throw Error('IMAGE_REQUIREMENT_FAILED:'+file);
 const size=file.startsWith('01-')?[1024,578]:file.startsWith('02-')?[512,512]:[720,1280];
 if(meta.width!==size[0]||meta.height!==size[1])throw Error('SIZE_MISMATCH');
 console.log(JSON.stringify({file,width:meta.width,height:meta.height,bytes:buffer.length,format:meta.format}));
}
console.log('Screenshots ready: '+results.length+'. No app screenshots are fabricated.');
