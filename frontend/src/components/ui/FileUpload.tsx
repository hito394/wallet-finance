'use client';

import { useCallback, useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  label: string;
  accept: string;
  onUpload: (file: File) => Promise<{ message: string; transactions_created?: number }>;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function FileUpload({ label, accept, onUpload }: Props) {
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
        className={clsx(
          'flex flex-col items-center justify-center gap-3 w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/50'
        )}
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
          <Loader2 size={28} className="text-brand-500 animate-spin" />
        ) : (
          <Upload size={28} className="text-gray-400" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">クリックまたはドラッグ&amp;ドロップ</p>
        </div>
      </label>

      {/* ステータスメッセージ */}
      {state === 'success' && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
          <AlertCircle size={16} />
          {message}
        </div>
      )}
    </div>
  );
}
