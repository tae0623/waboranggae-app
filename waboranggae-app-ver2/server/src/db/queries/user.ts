import { prisma } from '../client';
import { Prisma } from '@prisma/client';

// 비밀번호가 제외된 안전한 사용자 타입
export type SafeUser = Omit<Prisma.UserGetPayload<{}>, 'password'>;

export class UserQueries {
  /**
   * 사용자를 조회하거나 생성합니다 (Upsert).
   * 이메일 기반으로 사용자를 찾습니다.
   */
  static async upsertUser(email: string, displayName?: string): Promise<SafeUser> {
    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName },
      create: {
        email,
        displayName: displayName || email.split('@')[0],
      },
    });
    // 비밀번호 필드 제거
    const { password, ...safeUser } = user;
    return safeUser;
  }

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
   * 이메일로 사용자를 조회합니다 (비밀번호 포함).
   * 로그인 시에만 사용 (비밀번호 검증 필요)
   */
  static async getUserByEmailWithPassword(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 이메일로 사용자를 조회합니다 (비밀번호 제외).
   */
  static async getUserByEmail(email: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { email },
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

  /**
   * 토큰 버전 증가 (비밀번호 변경 시 호출하여 기존 토큰 무효화)
   */
  static async incrementTokenVersion(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });
  }
}
