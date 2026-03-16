import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '家計簿アプリ',
    short_name: '家計簿',
    description: '銀行明細・レシートから自動で家計を管理',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9fc',
    theme_color: '#f8f9fc',
    lang: 'ja',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
