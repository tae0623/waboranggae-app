import { useEffect, useState } from 'react';
import { api, type RankedCourse, type TravelPreferences } from './api';
import { minutes } from './parity';
export function forecastWindow(course?:RankedCourse, preferences?:TravelPreferences|null) {
  const point=course?.places[0],date=preferences?.travelDate;
  if(!point || !date || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))return null;
  const start=preferences?.startTime||'10:00';
  const total=course?.timeBreakdown?.totalMinutes ?? Math.round((course?.durationHours||6)*60);
  const endMinute=Math.min(1439,minutes(start)+total);
  const end=String(Math.floor(endMinute/60)).padStart(2,'0')+':'+String(endMinute%60).padStart(2,'0');
  return {lat:point.latitude!,lng:point.longitude!,date,start,end};
}
export function useWeather(course?:RankedCourse, preferences?:TravelPreferences|null) {
  const [tip,setTip]=useState({icon:'🌦️',condition:'여행일 날씨',msg:'여행 날짜와 코스를 선택해 주세요.'});
  const window=forecastWindow(course,preferences);
  useEffect(()=>{
    let active=true;
    if(!window){setTip({icon:'🌦️',condition:'여행일 날씨',msg:'여행 날짜와 코스를 선택해 주세요.'});return;}
    setTip({icon:'🌦️',condition:window.date+' 예보',msg:'예보 확인 중…'});
    api.forecast(window.lat,window.lng,window.date,window.start,window.end).then(result=>{
      if(!active)return;
      setTip(result.available?{icon:/비|눈|소나기/.test(result.condition)?'🌧️':result.condition.includes('흐림')?'☁️':result.condition==='맑음'?'☀️':'🌤️',condition:result.requestedDate+' · '+result.condition,
        msg:result.minTemperature+'~'+result.maxTemperature+'°C'+(result.maxRainProbability==null?'':' · 강수확률 '+result.maxRainProbability+'%'),
      }:{icon:'🌦️',condition:result.requestedDate+' 예보',msg:result.reason});
    }).catch(()=>{if(active)setTip({icon:'🌦️',condition:window.date+' 예보',msg:'예보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'});});
    return()=>{active=false;};
  },[window?.lat,window?.lng,window?.date,window?.start,window?.end]);
  return tip;
}
