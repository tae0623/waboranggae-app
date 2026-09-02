import { describe, expect, it } from 'vitest';
import { parseBusRouteDetail } from '../server/src/modules/recommendation/data/bus-routes';
import { parseNearbyBusStops, parseRoutesAtStop } from '../server/src/modules/recommendation/data/bus-stops';
import { busServiceScore, transitAccessScore } from '../server/src/utils/geo';

describe('TAGO bus data integration', () => {
  it('parses and orders nearby bus stops', () => {
    const stops = parseNearbyBusStops({
      response: { body: { items: { item: [
        { citycode: 36020, nodeid: 'far', nodenm: '먼 정류장', gpslati: 34.77, gpslong: 127.67 },
        { citycode: 36020, nodeid: 'near', nodenm: '가까운 정류장', gpslati: 34.7605, gpslong: 127.6622 },
      ] } } },
    }, { latitude: 34.7604, longitude: 127.6622 });

    expect(stops[0]).toMatchObject({ id: 'near', cityCode: '36020', name: '가까운 정류장' });
    expect(stops[0]?.distanceMeters).toBeLessThan(stops[1]?.distanceMeters ?? 0);
  });

  it('counts unique route numbers and keeps route ids for detail lookup', () => {
    const result = parseRoutesAtStop({
      response: { body: { items: { item: [
        { routeid: 'a', routeno: '2', routetp: '일반버스' },
        { routeid: 'b', routeno: '2', routetp: '일반버스' },
        { routeid: 'c', routeno: '24-1', routetp: '일반버스' },
      ] } } },
    });

    expect(result.uniqueRouteCount).toBe(2);
    expect(result.routes.map((route) => route.id)).toEqual(['a', 'b', 'c']);
  });

  it('parses route frequency and operating information', () => {
    expect(parseBusRouteDetail({
      response: { body: { items: { item: {
        routeid: 'YEB1', routeno: '2', routetp: '일반버스',
        startnodenm: '기점', endnodenm: '종점', intervaltime: '18',
        startvehicletime: '0600', endvehicletime: '2230',
      } } } },
    })).toMatchObject({
      id: 'YEB1', number: '2', weekdayIntervalMinutes: 18,
      firstBusTime: '0600', lastBusTime: '2230',
    });
  });

  it('rewards nearby stops with more frequent route supply', () => {
    expect(busServiceScore(10, 10)).toBeGreaterThan(busServiceScore(2, 45));
    expect(transitAccessScore(100, 10, 10)).toBeGreaterThan(transitAccessScore(600, 1, 60));
    expect(transitAccessScore(100, null)).toBe(98);
  });
});
