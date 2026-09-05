import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BrandMark } from '../components/BrandMark';
import { colors, radii } from '../theme';

export function AccountScreen({
  userName,
  userEmail,
  isAuthenticated,
  authLoading,
  authError,
  bookmarks,
  history,
  onLogin,
  onSignup,
  onLogout,
  onOpenBookmark,
}: {
  userName?: string | null;
  userEmail?: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  bookmarks: Array<{ courseId: string; courseName: string; city: string }>;
  history: Array<{ id: string; query: string; city?: string }>;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, displayName: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onOpenBookmark: (courseId: string) => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const submit = async () => {
    if (authLoading) return;
    if (mode === 'signup') {
      await onSignup(email.trim(), displayName.trim(), password);
    } else {
      await onLogin(email.trim(), password);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <BrandMark compact />
        <Text style={styles.headerLabel}>내 여행</Text>
      </View>

      {isAuthenticated ? (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>로그인됨</Text>
          <Text style={styles.userName}>{userName || '여행자'}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <Pressable onPress={() => onLogout().catch(() => undefined)} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>계정</Text>
          <Text style={styles.cardTitle}>로그인하면 북마크와 검색 이력을 저장해요</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={() => setMode('login')} style={[styles.modeChip, mode === 'login' && styles.modeChipOn]}>
              <Text style={[styles.modeText, mode === 'login' && styles.modeTextOn]}>로그인</Text>
            </Pressable>
            <Pressable onPress={() => setMode('signup')} style={[styles.modeChip, mode === 'signup' && styles.modeChipOn]}>
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextOn]}>회원가입</Text>
            </Pressable>
          </View>
          {mode === 'signup' ? (
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="이름" placeholderTextColor={colors.muted} style={styles.input} />
          ) : null}
          <TextInput value={email} onChangeText={setEmail} placeholder="이메일" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} placeholder="비밀번호 (8자 이상)" secureTextEntry placeholderTextColor={colors.muted} style={styles.input} />
          {authError ? <Text style={styles.error}>{authError}</Text> : null}
          <Pressable onPress={() => submit().catch(() => undefined)} style={styles.submit}>
            {authLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{mode === 'signup' ? '가입하기' : '로그인'}</Text>}
          </Pressable>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>북마크</Text>
        {!isAuthenticated ? (
          <Text style={styles.empty}>로그인 후 코스 상세에서 저장할 수 있어요.</Text>
        ) : bookmarks.length ? (
          bookmarks.map((item) => (
            <Pressable key={item.courseId} onPress={() => onOpenBookmark(item.courseId)} style={styles.row}>
              <Ionicons name="bookmark" size={16} color={colors.forest} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.courseName}</Text>
                <Text style={styles.rowSub}>{item.city}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>저장한 코스가 아직 없어요.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 검색</Text>
        {!isAuthenticated ? (
          <Text style={styles.empty}>로그인 후 추천을 실행하면 이력이 남아요.</Text>
        ) : history.length ? (
          history.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.row}>
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.query}</Text>
                <Text style={styles.rowSub}>{item.city || '전남'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>검색 이력이 아직 없어요.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  headerLabel: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  card: { marginHorizontal: 16, marginTop: 18, padding: 16, borderRadius: radii.md, backgroundColor: colors.white, gap: 10 },
  cardEyebrow: { color: colors.forest, fontSize: 10, fontWeight: '900' },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  userName: { color: colors.forestDark, fontSize: 18, fontWeight: '900' },
  userEmail: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#F0EDE3' },
  modeChipOn: { backgroundColor: colors.forest },
  modeText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  modeTextOn: { color: colors.white },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  submit: { backgroundColor: colors.forest, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  logoutBtn: { alignSelf: 'flex-start', paddingVertical: 8 },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  section: { marginHorizontal: 16, marginTop: 22, gap: 8 },
  sectionTitle: { color: colors.forestDark, fontSize: 13, fontWeight: '900' },
  empty: { color: colors.muted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  rowSub: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
