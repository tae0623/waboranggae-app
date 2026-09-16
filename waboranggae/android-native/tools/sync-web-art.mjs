import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {applyJeonnamArt} from './jeonnam-art.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
const project=new URL('../../',import.meta.url);
const source=await readFile(new URL('web/src/App.tsx',project),'utf8');
const start=source.indexOf('function Splash('),end=source.indexOf('\nfunction Login(',start);
if(start<0||end<0) throw new Error('Original web Splash component was not found.');
// Evaluate only the existing presentation component; useEffect is a no-op for a static SVG export.
const js=ts.transpileModule(source.slice(start,end)+'\nthis.WebSplash=Splash;',{
  compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2020}
}).outputText;
const scope={React,useEffect:()=>{}};
vm.createContext(scope);vm.runInContext(js,scope,{timeout:1000});
const markup=renderToStaticMarkup(React.createElement(scope.WebSplash,{onDone:()=>{}}));
let svg=markup.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
if(!svg) throw new Error('Web map artwork export failed.');
svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')
  .replace(/ style="[^"]*"/g,'').replace(/(fill-opacity|stroke-opacity)="0"/g,'$1="1"')
  .replace('stroke-dashoffset="1400"','stroke-dashoffset="0"')
  .replace(/ d="(-?\d)/g,' d="M$1');
const assets=new URL('android-native/app/src/main/assets/',project);
await mkdir(assets,{recursive:true});
await writeFile(new URL('web_splash_map.svg',assets),svg);
await writeFile(new URL('PRETENDARD-LICENSE.txt',assets),await readFile(new URL('android-native/PRETENDARD-LICENSE.txt',project)));
await applyJeonnamArt();
console.log('Exported web footprints and landmarks with actual Jeonnam boundary.');
