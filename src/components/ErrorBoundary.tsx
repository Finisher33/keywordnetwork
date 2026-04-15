import React, { useState, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    let isFirestoreError = false;

    try {
      const parsedError = JSON.parse(error.message || '');
      if (parsedError.error && parsedError.operationType) {
        isFirestoreError = true;
        errorMessage = `데이터베이스 오류: ${parsedError.error} (${parsedError.operationType} at ${parsedError.path})`;
        
        if (parsedError.error.includes('Missing or insufficient permissions')) {
          errorMessage = '데이터베이스 접근 권한이 없습니다. Firebase 보안 규칙 설정을 확인해 주세요.';
        }
      }
    } catch (e) {
      errorMessage = error.message || errorMessage;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 border border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-4">오류가 발생했습니다</h2>
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          {isFirestoreError && (
            <div className="bg-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-40 mb-4">
              {error.message}
            </div>
          )}
          <button
            className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
