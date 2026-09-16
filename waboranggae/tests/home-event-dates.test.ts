import {describe,it,expect} from 'vitest';
import {currentOrUpcomingEvent,eventStatus,koreaDateKey} from '../server/src/modules/hot-places/copy';
import {isVisibleHomePlace} from '../server/src/modules/hot-places/service';
const now=new Date('2026-09-15T15:01:00Z');
describe('home event expiry uses Korea calendar days',()=>{
 it('hides yesterday including during UTC previous day',()=>{
  expect(koreaDateKey(now)).toBe('20260916');
  expect(eventStatus('20260901','20260915',now)).toBe('ended');
  expect(currentOrUpcomingEvent('20260901','20260915',now)).toBe(false);
 });
 it('retains events through their final day and future events',()=>{
  expect(currentOrUpcomingEvent('20260901','20260916',now)).toBe(true);
  expect(currentOrUpcomingEvent('20260920','20260922',now)).toBe(true);
 });
 it('hides events with unknown, impossible, or inverted dates',()=>{
  for(const [a,b] of [[undefined,undefined],['20260230','20260301'],['20260920','20260910']])expect(currentOrUpcomingEvent(a,b,now)).toBe(false);
 });
 it('applies the same filter to cached/enriched event rows without hiding attractions',()=>{
  expect(isVisibleHomePlace({source:'festival',category:'축제·행사',eventStartDate:'20260901',eventEndDate:'20260915'},now)).toBe(false);
  expect(isVisibleHomePlace({source:'tour-api',category:'자연'},now)).toBe(true);
 });
});
