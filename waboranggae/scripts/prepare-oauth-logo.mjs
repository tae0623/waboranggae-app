// Rasterize the existing vector identity; never use the legacy map-pin icon.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE || 'sharp');
const source=await readFile(path.join(root,'web/src/assets/brand-mark.svg'));
const out=path.join(root,'release-assets/branding');
await mkdir(out,{recursive:true});
const mark=await sharp(source,{density:1200}).trim().png().toBuffer();
const results=[];
for(const size of [120,512]){
  const inner=Math.round(size*0.8);
  const foreground=await sharp(mark).resize(inner,inner,{fit:'inside'}).png().toBuffer();
  const png=await sharp({create:{width:size,height:size,channels:4,background:'#F0FDF4'}})
    .composite([{input:foreground,gravity:'centre'}]).flatten({background:'#F0FDF4'}).png().toBuffer();
  const file=`ddubugi-logo-${size}.png`;
  await writeFile(path.join(out,file),png);
  const info=await sharp(png).metadata();
  if(info.width!==size||info.height!==size||png.byteLength>1_000_000)throw Error('INVALID_LOGO');
  results.push({file,width:info.width,height:info.height,bytes:png.byteLength});
}
console.log(JSON.stringify(results,null,2));
