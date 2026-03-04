import path from 'path';
import { defineConfig, loadEnv } from 'vite';


export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_GAS_URL': JSON.stringify(env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbzgEzU_BTP5f2Ms7tk4b_UOmwwawwiMJ8xBMExoim2aesGtjTuwu6CQ4fhj5QS00WKv/exec'),
        'process.env.VITE_IS_LOCAL': JSON.stringify(env.VITE_IS_LOCAL !== 'false') // Default to true if not explicitly false
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
