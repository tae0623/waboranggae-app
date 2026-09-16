import { prisma } from '../client';
import { Prisma } from '@prisma/client';

// 비밀번호가 제외된 안전한 사용자 타입
export type SafeUser = Omit<Prisma.UserGetPayload<{}>, 'password'>;

export class UserQueries {
  /**
   * 사용자 ID로 사용자를 조회합니다 (비밀번호 제외).
   */
  static async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * 표시 이름을 수정합니다.
   */
  static async updateDisplayName(userId: string, displayName: string): Promise<SafeUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { displayName },
    });
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * 사용자를 삭제합니다 (모든 관련 데이터도 삭제됨).
   */
  static async deleteUser(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
    });
  }

}
