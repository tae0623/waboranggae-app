import { useEffect, useState } from 'react';
import { api } from './api';
export function useWeather(point?: { latitude?: number; longitude?: number }) {
  const [tip, setTip] = useState({ icon: '🌦️', condition: '현재 날씨', msg: '코스를 선택하면 출발지의 기상청 관측 날씨를 표시합니다.' });
  useEffect(() => {
    let active = true;
    if (!point || point.latitude == null || point.longitude == null) { setTip({ icon: '🌦️', condition: '현재 날씨', msg: '코스를 선택하면 출발지의 기상청 관측 날씨를 표시합니다.' }); return; }
    setTip({ icon: '🌦️', condition: '현재 날씨', msg: '기상청 관측 정보를 불러오는 중입니다.' });
    api.weather(point.latitude, point.longitude).then(result => {
      if (!active) return;
      setTip(result.available ? { icon: result.condition === '강수 없음' ? '🌡️' : '🌧️',
        condition: result.temperature + '°C · ' + result.condition,
        msg: result.advice + ' (기상청 ' + result.observedAt + ' 관측 · 여행일 예보가 아닙니다.)',
      } : { icon: '🌦️', condition: '날씨 확인 필요', msg: result.reason });
    }).catch(() => { if (active) setTip({ icon: '🌦️', condition: '날씨 확인 필요', msg: '관측 정보를 불러오지 못했습니다. 출발 전 최신 예보를 확인해 주세요.' }); });
    return () => { active = false; };
  }, [point?.latitude, point?.longitude]);
  return tip;
}
