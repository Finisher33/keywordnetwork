import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // 운영 빌드 시 모든 console.* 와 debugger 자동 제거 — 노이즈/번들 절감
    esbuild: {
      drop: ['console', 'debugger'] as ('console' | 'debugger')[],
    },
    build: {
      sourcemap: false,
      // 청크를 안정적인 그룹으로 분리 — 재배포 시 변경 안 된 vendor 청크는
      // 브라우저 캐시 그대로 재사용 → 재방문자 다운로드량 ↓
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('d3')) return 'vendor-d3';
            if (id.includes('@google/generative-ai')) return 'vendor-genai';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
  };
});
