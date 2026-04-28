import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StoreProvider } from './store.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';

// 아이콘 폰트 (Material Symbols Outlined) 로딩 상태를 html 클래스로 노출.
// 로드 전에는 CSS 가 아이콘 텍스트를 투명 처리해 "notifications" 같은 ligature 이름이
// 화면에 그대로 새는 현상 차단 (Samsung Internet / 인앱 브라우저 / 광고차단 환경 안전망).
// 5초 timeout — 그래도 못 받으면 일단 표시 (최소 빈 자리 유지).
(() => {
  const ready = () => document.documentElement.classList.add('icons-ready');
  if (typeof document === 'undefined' || !(document as any).fonts) { ready(); return; }
  Promise.race([
    (document as any).fonts.load('24px "Material Symbols Outlined"').then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 5000)),
  ]).finally(ready);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
