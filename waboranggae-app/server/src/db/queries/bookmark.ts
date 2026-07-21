import { prisma } from '../client';

export class BookmarkQueries {
  /**
   * 코스를 북마크에 추가합니다.
   */
  static async addBookmark(userId: string, courseId: string, courseName: string, city: string) {
    return prisma.bookmark.create({
      data: {
        userId,
        courseId,
        courseName,
        city,
      },
    });
  }

  /**
   * 코스 북마크를 제거합니다.
   */
  static async removeBookmark(userId: string, courseId: string) {
    return prisma.bookmark.delete({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
  }

  /**
   * 사용자의 모든 북마크를 조회합니다.
   */
  static async getUserBookmarks(userId: string, options?: { city?: string; limit?: number }) {
    return prisma.bookmark.findMany({
      where: {
        userId,
        ...(options?.city && { city: options.city }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
    });
  }

  /**
   * 특정 코스가 사용자에게 북마크되었는지 확인합니다.
   */
  static async isBookmarked(userId: string, courseId: string) {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
    return !!bookmark;
  }

  /**
   * 코스별 북마크 개수를 조회합니다.
   */
  static async getBookmarkCount(courseId: string) {
    return prisma.bookmark.count({
      where: { courseId },
    });
  }
}
