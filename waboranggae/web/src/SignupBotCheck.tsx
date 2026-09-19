import {useEffect,useRef,useState} from 'react';
export function SignupBotCheck({onToken}:{onToken:(token:string)=>void}){
  const frame=useRef<HTMLIFrameElement>(null),callback=useRef(onToken);
  const [height,setHeight]=useState(230);
  callback.current=onToken;
  useEffect(()=>{
    const element=frame.current;if(!element)return;
    const measure=()=>setHeight(element.clientWidth<330?230:145);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let expiry:ReturnType<typeof setTimeout>|undefined;
    const receive=(event:MessageEvent)=>{
      if(event.origin!=='https://waboranggae-app.pages.dev'||event.source!==frame.current?.contentWindow
        ||event.data?.type!=='ddubugi-signup-bot'||typeof event.data.token!=='string'||event.data.token.length>2048)return;
      clearTimeout(expiry);callback.current(event.data.token);
      if(event.data.token)expiry=setTimeout(()=>callback.current(''),240000);
    };
    window.addEventListener('message',receive);
    return()=>{window.removeEventListener('message',receive);clearTimeout(expiry);};
  },[]);
  return <iframe ref={frame} title="자동 가입 방지 확인" src={'https://waboranggae-app.pages.dev/auth/bot-check?parent='+encodeURIComponent(window.location.origin)}
    referrerPolicy="no-referrer" style={{width:'100%',height,border:0,borderRadius:14,background:'white'}}/>;
}
