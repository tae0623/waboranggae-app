import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { buildKakaoMapHtml } from '../src/domain/kakaoMapHtml';

const origin={name:'순천종합버스터미널',latitude:34.9476,longitude:127.4914};
const place={name:'순천만국가정원',latitude:34.929,longitude:127.5095};
// Run our generated JavaScript with a minimal DOM/SDK contract, without network.
function render(data:unknown, fail=false){
  const elements:Record<string,any>={};const scripts:any[]=[];
  const element=()=>({style:{},children:[] as any[],textContent:'',appendChild(child:any){this.children.push(child);},replaceChildren(...children:any[]){this.children=children;},setAttribute:vi.fn(),addEventListener:vi.fn()});
  for(const id of ['map','message','source','detail','fallback'])elements[id]=element();
  const map={addControl:vi.fn(),setBounds:vi.fn(),setCenter:vi.fn(),setLevel:vi.fn(),relayout:vi.fn()};
  const Map=vi.fn(function(){if(fail)throw Error('SDK_ERROR');return map;});
  const Overlay=vi.fn(function(){});const clearTimeout=vi.fn();
  const kakao={maps:{Map,CustomOverlay:Overlay,Polyline:vi.fn(function(){}),LatLng:vi.fn(function(lat:number,lng:number){return {lat,lng};}),
    LatLngBounds:vi.fn(function(){return {extend:vi.fn()};}),ZoomControl:vi.fn(function(){}),ControlPosition:{RIGHT:1},load:(init:()=>void)=>init()}};
  const doc={getElementById:(id:string)=>elements[id],createElement:element,addEventListener:vi.fn(),head:{appendChild:(script:any)=>scripts.push(script)}};
  const script=buildKakaoMapHtml('fixture-key').match(/<script>([\s\S]*?)<\/script>/)![1]!;
  runInNewContext(script,{document:doc,location:{hash:'#'+encodeURIComponent(JSON.stringify(data)),origin:'https://example.invalid',pathname:'/maps/embed'},
    URL,kakao,window:{kakao,addEventListener:vi.fn()},setTimeout:vi.fn(()=>1),clearTimeout});
  scripts[0].onload();
  return {elements,map,Map,Overlay,clearTimeout};
}
describe('departure and course map initialization',()=>{
  it('renders a street-scale map for only the searched departure',()=>{
    const {elements,map,Map,Overlay,clearTimeout}=render({origin,places:[],routeSegments:[]});
    expect(Map).toHaveBeenCalledOnce();expect(Overlay).toHaveBeenCalledOnce();
    expect(map.setCenter).toHaveBeenCalledWith({lat:origin.latitude,lng:origin.longitude});expect(map.setLevel).toHaveBeenCalledWith(4);
    expect(elements.map.style.display).toBe('block');expect(elements.message.style.display).toBe('none');expect(clearTimeout).toHaveBeenCalled();
  });
  it('renders course places and bounds even when there is no departure',()=>{
    const {Map,Overlay,map}=render({places:[place,{...origin,name:'다른 장소'}]});
    expect(Map).toHaveBeenCalledOnce();expect(Overlay).toHaveBeenCalledTimes(2);expect(map.setBounds).toHaveBeenCalledOnce();
  });
  it('renders departure and course together',()=>{
    const {Overlay,map}=render({origin,places:[place]});expect(Overlay).toHaveBeenCalledTimes(2);expect(map.setBounds).toHaveBeenCalledOnce();
  });
  it('handles an empty/invalid selection without creating an invalid map',()=>{
    const {elements,Map}=render({origin:{...origin,latitude:999},places:[]});expect(Map).not.toHaveBeenCalled();
    expect(elements.message.textContent).toContain('장소를 선택');expect(elements.fallback.style.display).toBe('block');
  });
  it('keeps a departure card when the SDK fails and cancels the loading timer',()=>{
    const {elements,clearTimeout}=render({origin,places:[]},true);
    expect(elements.fallback.children).toHaveLength(1);expect(clearTimeout).toHaveBeenCalled();
  });
});
