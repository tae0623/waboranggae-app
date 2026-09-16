import { prisma } from '../client';
import { TravelPreferences } from '../../../../src/types/travel';
import { Prisma } from '@prisma/client';

export class SearchHistoryQueries {
  /**
   * 검색 이력을 기록합니다.
   */
  static async recordSearch(userId: string, query: string, preferences: TravelPreferences) {
    return prisma.searchHistory.create({
      data: {
        userId,
        query,
        city: preferences.city,
        pace: preferences.pace,
        preferences: JSON.parse(JSON.stringify(preferences)) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 사용자의 검색 이력을 조회합니다.
   */
  static async getUserSearchHistory(userId: string, limit: number = 10) {
    return prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 특정 도시의 최근 검색 이력을 조회합니다.
   */
  static async getRecentSearchesByCity(userId: string, city: string, limit: number = 5) {
    return prisma.searchHistory.findMany({
      where: { userId, city },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 사용자의 검색 이력을 삭제합니다.
   */
  static async deleteSearchHistory(userId: string, historyId?: string) {
    if (historyId) {
      return prisma.searchHistory.deleteMany({
        where: { id: historyId, userId },
      });
    }
    // 전체 삭제
    return prisma.searchHistory.deleteMany({
      where: { userId },
    });
  }

  /**
   * 사용자가 자주 검색한 도시들을 조회합니다.
   */
  static async getFrequentCities(userId: string, limit: number = 5) {
    return prisma.searchHistory.groupBy({
      by: ['city'],
      where: { userId, city: { not: null } },
      _count: true,
      orderBy: {
        _count: { city: 'desc' },
      },
      take: limit,
    });
  }
}
