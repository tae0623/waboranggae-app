import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import NativeApp, { type NativeAppHandle } from './web/src/NativeApp';

export default function App() {
  const ui = useRef<NativeAppHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [initialSession, setInitialSession] = useState<{ access: string; refresh: string } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const storageQueue = useRef(Promise.resolve());
  useEffect(() => {
    SecureStore.getItemAsync('waboranggae.session').then(value => {
      const tokens = value ? JSON.parse(value) : null;
      setInitialSession(tokens && typeof tokens.access === 'string' && typeof tokens.refresh === 'string' ? tokens : null);
      setSessionReady(true);
    }).catch(() => setSessionError(true));
  }, []);
  const persistSession = useCallback(async (tokens: { access: string; refresh: string } | null) => {
    const action = storageQueue.current.catch(() => undefined).then(async () => {
      if (tokens) await SecureStore.setItemAsync('waboranggae.session', JSON.stringify(tokens));
      else await SecureStore.deleteItemAsync('waboranggae.session');
    });
    storageQueue.current = action;
    await action;
  }, []);
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  const onBackState = useCallback(async (value: boolean) => { setCanGoBack(value); }, []);
  const nativeRequest = useCallback(async (path: string, options: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number }) => {
    if (!base || !/^\/(api|auth)\//.test(path)) throw new Error('허용되지 않은 API 요청입니다.');
    const url = new URL(path, base);
    if (url.origin !== new URL(base).origin) throw new Error('허용되지 않은 API 주소입니다.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(options.timeoutMs, 130000));
    try {
      const response = await fetch(url.href, {
        method: options.method, body: options.body, signal: controller.signal,
        headers: { ...options.headers, ...(process.env.EXPO_PUBLIC_DEV_ACCESS_KEY ? { 'X-Dev-Access-Key': process.env.EXPO_PUBLIC_DEV_ACCESS_KEY } : {}) },
      });
      return { status: response.status, body: await response.text() };
    } finally { clearTimeout(timer); }
  }, [base]);
  const openExternal = useCallback(async (url: string) => {
    if (new URL(url).protocol === 'https:') await Linking.openURL(url);
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      ui.current?.back();
      return true;
    });
    return () => listener.remove();
  }, [canGoBack]);
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F4F8' }}>
      {!sessionReady ? <View style={{ padding: 24 }}><Text>{sessionError ? '보안 저장소를 열지 못했습니다. 앱을 다시 실행해 주세요.' : '로그인 정보를 확인하고 있습니다…'}</Text></View> : !base || base === 'same-origin' ? <View style={{ padding: 24 }}>
        <Text>앱 API 주소가 설정되지 않았습니다. EXPO_PUBLIC_API_BASE_URL에 휴대폰에서 접속 가능한 서버 주소를 입력해 주세요.</Text>
      </View> : <NativeApp ref={ui} apiBaseUrl={base}
        initialSession={initialSession} persistSession={persistSession}
        devAccessKey={process.env.EXPO_PUBLIC_DEV_ACCESS_KEY}
        onBackState={onBackState} openExternal={openExternal} nativeRequest={nativeRequest}
        dom={{ scrollEnabled: false, style: { flex: 1 }, useExpoDOMWebView: false, javaScriptCanOpenWindowsAutomatically: false }}
      />}
    </SafeAreaView>
  </SafeAreaProvider>;
}
