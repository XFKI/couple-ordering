import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// PWA 资源注册
const BASE_URL = import.meta.env.BASE_URL;

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(BASE_URL + 'sw.js', {
      scope: BASE_URL
    })
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}

// 设置 PWA 图标和 manifest
const setUpPWA = () => {
  // manifest
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = BASE_URL + 'manifest.json';
  document.head.appendChild(manifestLink);
  
  // favicon
  const iconLink = document.createElement('link');
  iconLink.rel = 'icon';
  iconLink.type = 'image/png';
  iconLink.sizes = '192x192';
  iconLink.href = BASE_URL + 'icon-192.png';
  document.head.appendChild(iconLink);
  
  // apple-touch-icon
  const appleIconLink = document.createElement('link');
  appleIconLink.rel = 'apple-touch-icon';
  appleIconLink.href = BASE_URL + 'icon-192.png';
  document.head.appendChild(appleIconLink);
};

setUpPWA();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
