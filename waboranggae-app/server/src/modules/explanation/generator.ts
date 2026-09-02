import { ExplainRequest, RecommendationReason } from '../../../../src/types/travel';
import { explainWithOllama } from '../analysis/ollama';

/**
 * 코스 추천 이유를 생성합니다.
 * Ollama를 사용하거나, 실패시 기본 이유를 반환합니다.
 */
export async function generateExplanation(request: ExplainRequest): Promise<RecommendationReason> {
  const aiReason = await explainWithOllama(request);
  return aiReason ?? request.course.reason;
}
