'use dom';

import { useDOMImperativeHandle, type DOMProps, type DOMImperativeFactory } from 'expo/dom';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { tokenStore } from './api';
import App from './App';
import { configureWebRuntime } from './runtime';
import './index.css';

export interface NativeAppHandle extends DOMImperativeFactory { back: () => void }
export default function NativeApp({ apiBaseUrl, devAccessKey, openExternal, onBackState, nativeRequest, initialSession, persistSession, ref }: {
  initialSession: { access: string; refresh: string } | null;
  persistSession: NonNullable<import('./runtime').WebRuntime['persistSession']>;
  apiBaseUrl: string;
  devAccessKey?: string;
  openExternal: (url: string) => Promise<void>;
  onBackState: (canGoBack: boolean) => Promise<void>;
  nativeRequest: NonNullable<import('./runtime').WebRuntime['nativeRequest']>;
  ref?: RefObject<NativeAppHandle | null>;
  dom?: DOMProps;
}) {
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  configureWebRuntime({ apiBaseUrl, mapBaseUrl: apiBaseUrl, devAccessKey, openExternal, nativeRequest, persistSession });
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    tokenStore.restoreNative(initialSession); setReady(true);
  }, [initialSession]);
  useDOMImperativeHandle(ref ?? null, () => ({
    back: () => window.dispatchEvent(new Event('waboranggae:back')),
  }), []);
  return ready ? <App onBackState={onBackState} /> : null;
}
