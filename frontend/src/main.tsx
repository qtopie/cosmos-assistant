import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.scss';
import './app.scss';

const prefersDark = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
