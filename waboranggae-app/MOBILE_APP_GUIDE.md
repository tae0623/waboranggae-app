# 모바일 앱 사용자 기능 가이드

## 개요

모바일 앱은 이제 사용자 관리, 북마크, 검색 이력 기능을 지원합니다.

모든 기능은 **custom hooks**로 구현되어 있으며, 간단한 API로 사용할 수 있습니다.

## Custom Hooks

### 1. `useUser` - 사용자 인증 및 프로필

```typescript
import { useUser } from './src/hooks';

function MyComponent() {
  const { user, userId, loading, error, login, logout } = useUser();

  // 로그인
  const handleLogin = async () => {
    await login('user@example.com', '홍길동');
  };

  // 현재 사용자 확인
  if (user) {
    console.log(`로그인됨: ${user.displayName} (${user.email})`);
  }

  // 로그아웃
  const handleLogout = () => {
    logout();
  };

  return (
    <View>
      {userId ? (
        <>
          <Text>{user?.displayName}</Text>
          <Button onPress={handleLogout} title="로그아웃" />
        </>
      ) : (
        <Button onPress={handleLogin} title="로그인" />
      )}
    </View>
  );
}
```

**반환 값:**
- `user` - 현재 사용자 정보 (또는 null)
- `userId` - 사용자 ID
- `loading` - 로딩 상태
- `error` - 에러 메시지
- `login(email, displayName?)` - 로그인/회원가입
- `logout()` - 로그아웃
- `fetchMe()` - 현재 사용자 정보 조회
- `deleteAccount()` - 계정 삭제

---

### 2. `useBookmarks` - 코스 북마크 관리

```typescript
import { useBookmarks } from './src/hooks';

function CourseCard({ course, userId }) {
  const {
    bookmarks,
    loading,
    error,
    add,
    remove,
    fetchList,
    isBookmarked,
  } = useBookmarks(userId);

  // 북마크 여부 확인
  const [isBookmarkedLocal, setIsBookmarked] = useState(false);
  useEffect(() => {
    isBookmarked(course.id).then(setIsBookmarked);
  }, [course.id, isBookmarked]);

  // 북마크 토글
  const handleToggleBookmark = async () => {
    if (isBookmarkedLocal) {
      await remove(course.id);
    } else {
      await add(course.id, course.title, course.city);
    }
    setIsBookmarked(!isBookmarkedLocal);
  };

  // 북마크 목록 조회
  const handleFetchBookmarks = async () => {
    await fetchList({ city: '순천' });
  };

  return (
    <View>
      <Button
        onPress={handleToggleBookmark}
        title={isBookmarkedLocal ? '북마크 해제' : '북마크'}
      />
    </View>
  );
}
```

**반환 값:**
- `bookmarks` - 북마크 목록 배열
- `loading` - 로딩 상태
- `error` - 에러 메시지
- `add(courseId, courseName, city)` - 북마크 추가
- `remove(courseId)` - 북마크 제거
- `fetchList(options?)` - 북마크 목록 조회
- `isBookmarked(courseId)` - 특정 코스 북마크 여부 확인
- `clear()` - 상태 초기화

---

### 3. `useSearchHistory` - 검색 이력 관리

```typescript
import { useSearchHistory } from './src/hooks';

function SearchHistory({ userId }) {
  const {
    history,
    frequentCities,
    loading,
    error,
    record,
    fetch,
    fetchFrequentCities,
    delete: deleteHistory,
  } = useSearchHistory(userId);

  // 검색 이력 기록
  const handleSearch = async (query, preferences) => {
    await record(query, preferences);
  };

  // 검색 이력 조회
  const handleFetch = async () => {
    await fetch(10); // 최근 10개
  };

  // 자주 검색한 도시
  const handleFrequentCities = async () => {
    await fetchFrequentCities(5);
  };

  // 검색 이력 삭제
  const handleDelete = async (historyId) => {
    await deleteHistory(historyId);
  };

  return (
    <View>
      {history.map((item) => (
        <View key={item.id}>
          <Text>{item.query}</Text>
          <Button
            onPress={() => handleDelete(item.id)}
            title="삭제"
          />
        </View>
      ))}
      {frequentCities.map((city) => (
        <Text key={city.city}>
          {city.city} ({city._count}회)
        </Text>
      ))}
    </View>
  );
}
```

**반환 값:**
- `history` - 검색 이력 배열
- `frequentCities` - 자주 검색한 도시 배열
- `loading` - 로딩 상태
- `error` - 에러 메시지
- `record(query, preferences)` - 검색 이력 기록
- `fetch(limit?)` - 검색 이력 조회
- `fetchFrequentCities(limit?)` - 자주 검색한 도시 조회
- `delete(historyId?)` - 검색 이력 삭제 (없으면 전체 삭제)
- `clear()` - 상태 초기화

---

### 4. `useAnalysis` & `useRecommendation` - 분석 및 추천

```typescript
import { useAnalysis, useRecommendation } from './src/hooks';

function TravelApp() {
  const { preferences, source, loading, analyze } = useAnalysis();
  const { courses, source: courseSource, recommend } = useRecommendation();

  const handleAnalyze = async (query) => {
    await analyze(query);
    // preferences가 업데이트되면 자동으로 recommend 호출 가능
  };

  const handleRecommend = async () => {
    if (preferences) {
      await recommend(preferences);
    }
  };

  return (
    <View>
      <TextInput onChangeText={setQuery} />
      <Button onPress={handleAnalyze} title="분석" />
      <Text>분석 출처: {source}</Text>
      <Text>추천 코스 수: {courses.length}</Text>
      <Text>추천 출처: {courseSource}</Text>
    </View>
  );
}
```

---

## App.tsx 통합 예시

현재 [App.tsx](./App.tsx)는 이미 모든 hooks를 통합하고 있습니다:

```typescript
export function AppShell() {
  // Hooks 초기화
  const { preferences, source, loading, analyze } = useAnalysis();
  const { courses, source: courseSource, recommend } = useRecommendation();
  const { userId } = useUser();
  const { record: recordSearch } = useSearchHistory(userId);

  const handleAnalyze = async () => {
    // 1. 자연어 분석
    await analyze(query);

    // 2. 코스 추천
    const analyzedPrefs = preferences || parseTravelText(query);
    await recommend(analyzedPrefs);

    // 3. 검색 이력 기록 (백그라운드)
    if (userId) {
      recordSearch(query, analyzedPrefs);
    }
  };
}
```

---

## 환경 설정

### 모바일 앱과 백엔드 연결

1. **백엔드 주소 설정** (`.env.local`)
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

2. **백엔드 실행**
```bash
pnpm server
```

3. **모바일 앱 실행**
```bash
pnpm start
```

---

## 주의사항

### 사용자 ID 관리

현재 `useUser` hook은 `userId`를 메모리에만 저장합니다.
**프로덕션에서는 다음을 추가하세요:**

1. **AsyncStorage 저장** (앱 재시작 후에도 유지)
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const login = async (email) => {
  const user = await apiClient.user.profile({ email });
  await AsyncStorage.setItem('userId', user.id);
  setUserId(user.id);
};
```

2. **JWT 인증** (보안 개선)
```typescript
const token = await apiClient.login({ email, password });
await AsyncStorage.setItem('token', token);
headers['Authorization'] = `Bearer ${token}`;
```

### 에러 처리

모든 hooks는 에러를 `error` 상태에 저장합니다:
```typescript
const { error, record } = useSearchHistory(userId);

try {
  await record(query, preferences);
} catch (err) {
  console.error('검색 이력 저장 실패:', error);
}
```

---

## API 엔드포인트 목록

| 기능 | 메서드 | 엔드포인트 |
|---|---|---|
| **사용자** |  |  |
| 프로필 생성/수정 | POST | `/api/user/profile` |
| 사용자 정보 조회 | GET | `/api/user/me` |
| 계정 삭제 | DELETE | `/api/user/me` |
| **북마크** |  |  |
| 북마크 추가 | POST | `/api/user/bookmarks/add` |
| 북마크 제거 | DELETE | `/api/user/bookmarks/:courseId` |
| 북마크 목록 | GET | `/api/user/bookmarks` |
| 북마크 여부 확인 | GET | `/api/user/bookmarks/:courseId/is-bookmarked` |
| **검색 이력** |  |  |
| 이력 기록 | POST | `/api/user/search-history` |
| 이력 조회 | GET | `/api/user/search-history` |
| 자주 검색한 도시 | GET | `/api/user/search-history/frequent-cities` |
| 이력 삭제 (개별) | DELETE | `/api/user/search-history/:historyId` |
| 이력 삭제 (전체) | DELETE | `/api/user/search-history` |

---

## 다음 단계

- [ ] JWT 인증 추가 (보안)
- [ ] AsyncStorage로 userId 로컬 저장 (편의성)
- [ ] 북마크 화면 추가
- [ ] 검색 이력 화면 추가
- [ ] 사용자 프로필 화면 추가
