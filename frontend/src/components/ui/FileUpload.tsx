'use client';

import { useCallback, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  label: string;
  accept: string;
  hint?: string;
  onUpload: (file: File) => Promise<{ message: string; transactions_created?: number }>;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function FileUpload({ label, accept, hint, onUpload }: Props) {
  const [state, setState] = useState<UploadState>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setState('uploading');
      setMessage('');
      try {
        const result = await onUpload(file);
        setState('success');
        setMessage(result.message);
      } catch (err) {
        setState('error');
        setMessage(err instanceof Error ? err.message : '不明なエラーが発生しました');
      }
    },
    [onUpload]
  );

  return (
    <div className="space-y-3">
      <label
        className="flex flex-col items-center justify-center gap-3 w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
        style={{
          borderColor: dragging ? '#7C6FFF' : '#2A2D42',
          backgroundColor: dragging ? '#1A1C2E' : '#0E0F1A',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        {state === 'uploading' ? (
          <Loader2 size={28} className="animate-spin" style={{ color: '#7C6FFF' }} />
        ) : (
          <Upload size={28} style={{ color: dragging ? '#7C6FFF' : '#475569' }} />
        )}
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: '#CBD5E1' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
            {hint ?? 'クリックまたはドラッグ＆ドロップ'}
          </p>
        </div>
      </label>

      {state === 'success' && (
        <div
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl"
          style={{ color: '#4ADE80', backgroundColor: '#14532D30', border: '1px solid #14532D' }}
        >
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
      {state === 'error' && (
        <div
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl"
          style={{ color: '#F87171', backgroundColor: '#2D151530', border: '1px solid #7F1D1D' }}
        >
          <AlertCircle size={16} />
          {message}
        </div>
      )}
    </div>
  );
}
