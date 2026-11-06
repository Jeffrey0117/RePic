import { useEffect, useRef } from 'react';
import 'family-kit/renderer.js';

// 鴨鴨家族面板（family-kit）：列出同一家的其他桌面 app，已裝顯示「開啟」、未裝一鍵下載安裝。
// 面板本體是 family-kit 的純 DOM 元件；這裡只負責掛載與把 RePic 的主題色餵成 CSS 變數。
const THEME_VARS = {
  dark: {
    '--text-primary': 'rgba(255,255,255,0.9)',
    '--text-secondary': 'rgba(255,255,255,0.55)',
    '--text-tertiary': 'rgba(255,255,255,0.35)',
    '--background-secondary': 'rgba(255,255,255,0.06)',
    '--background-tertiary': 'rgba(255,255,255,0.1)',
    '--border-color': 'rgba(255,255,255,0.15)',
    '--primary-blue': '#0A84FF',
  },
  light: {
    '--text-primary': '#1f2937',
    '--text-secondary': '#6b7280',
    '--text-tertiary': '#9ca3af',
    '--background-secondary': 'rgba(0,0,0,0.04)',
    '--background-tertiary': 'rgba(0,0,0,0.08)',
    '--border-color': 'rgba(0,0,0,0.12)',
    '--primary-blue': '#0A84FF',
  },
};

export function FamilyPanel({ isDark, title, subtitle, className }) {
  const ref = useRef(null);
  const available = typeof window !== 'undefined' && !!window.familyKit && !!window.FamilyKit;

  useEffect(() => {
    if (!available || !ref.current) return undefined;
    const handle = window.FamilyKit.mount(ref.current, window.familyKit, { title, subtitle });
    return () => handle.destroy();
  }, [available, title, subtitle]);

  if (!available) return null; // 非 Electron（純瀏覽器）環境不顯示
  return <div ref={ref} className={className} style={{ ...THEME_VARS[isDark ? 'dark' : 'light'], textAlign: 'left' }} />;
}

export default FamilyPanel;
