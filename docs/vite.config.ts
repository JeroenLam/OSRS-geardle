import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: './',
    build: {
        // Each game's data is its own chunk; the RS3 gear table is ~870 kB (140 kB gzipped)
        chunkSizeWarningLimit: 1000,
    },
    server: {
        // CSV lives in the repo root, outside the Vite root
        fs: { allow: ['..'] },
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'OSRS Geardle',
                short_name: 'Geardle',
                description: 'A Wordle-style guessing game for Old School RuneScape and RuneScape 3 equipment, monsters, spells and quests.',
                start_url: '.',
                scope: '.',
                display: 'standalone',
                orientation: 'any',
                background_color: '#1e1b16',
                theme_color: '#1e1b16',
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png}'],
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) =>
                            url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        urlPattern: ({ url }) => url.origin === 'https://oldschool.runescape.wiki' || url.origin === 'https://runescape.wiki',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'wiki-images',
                            expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
});
