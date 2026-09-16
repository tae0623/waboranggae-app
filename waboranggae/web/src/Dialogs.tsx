import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close.current();}
      if(event.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]');if(!nodes?.length)return;const first=nodes[0]!,last=nodes[nodes.length-1]!;if(event.shiftKey && (document.activeElement===first || document.activeElement===ref.current)){event.preventDefault();last.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);previous?.focus();};},[]);
  return <div className="dialog-shade"><div ref={ref} className="theme-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><h2>{title}</h2>{children}</div></div>;
}
type Message={title:string;body:string;confirm?:string;resolve:(value:boolean)=>void};
export function useDialogs(){
  const [message,setMessage]=useState<Message|null>(null);
  const pending=useRef<((value:boolean)=>void)|null>(null);
  useEffect(()=>()=>{pending.current?.(false);},[]);
  function ask(title:string,body:string,confirm?:string){pending.current?.(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setMessage({title,body,confirm,resolve});});}
  function close(value:boolean){message?.resolve(value);pending.current=null;setMessage(null);}
  return {ask,dialog:message&&<Modal title={message.title} onClose={()=>close(false)}><p>{message.body}</p><div className="dialog-actions">{message.confirm&&<button onClick={()=>close(false)}>취소</button>}<button className="primary" onClick={()=>close(true)}>{message.confirm || '확인'}</button></div></Modal>};
}
