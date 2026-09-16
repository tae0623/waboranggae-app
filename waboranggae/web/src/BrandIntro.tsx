import { useEffect, useRef, type CSSProperties } from 'react';
import art from './assets/splash-map-base.svg';
import intro from '../../src/domain/brandIntro.json';
import './brand-intro.css';

export function BrandIntro({ onDone }: { onDone: () => void }) {
  const done=useRef(onDone);done.current=onDone;
  useEffect(()=>{
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer=setTimeout(()=>done.current(),reduced?650:intro.durationMs);
    return()=>clearTimeout(timer);
  },[]);
  const v=intro.viewport;
  return <div className="brand-intro" role="status" aria-label="뚜버기 시작 화면">
    <div className="brand-intro-art" aria-hidden="true">
      <img src={art} alt=""/>
      <svg viewBox={`${v.x} ${v.y} ${v.width} ${v.height}`}>
        {intro.steps.map((step,index)=>{
          const x=step.right?5:-5;
          return <g key={index} transform={`translate(${step.x},${step.y}) rotate(${step.rotation})`} className="intro-footprint"
            data-step={index} style={{'--step-delay':`${step.delayMs}ms`,'--step-duration':`${intro.stepDurationMs}ms`} as CSSProperties}>
            <ellipse cx={x} cy="5" rx="4" ry="3.2"/><ellipse cx={x} cy="-3" rx="5.2" ry="3.8"/>
            <circle cx={x-2.5} cy="-7.5" r="1.6"/><circle cx={x} cy="-8.8" r="1.8"/><circle cx={x+2.5} cy="-7.5" r="1.6"/>
          </g>;
        })}
      </svg>
    </div>
    <h1>뚜버기</h1><p>전남 뚜벅이 여행</p>
  </div>;
}
