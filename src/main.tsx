import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ここでSW登録（レンダーの外側）
import { registerSW } from "virtual:pwa-register";
registerSW(); // オフライン対応 & 自動更新

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)


