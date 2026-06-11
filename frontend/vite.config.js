import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5175,
        strictPort: true,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
            },
            '/uploads': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@shared': resolve(__dirname, '..', 'shared'),
        },
    },
    build: {
        target: 'es2022',
        sourcemap: true,
    },
});
