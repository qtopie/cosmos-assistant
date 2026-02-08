import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.scss';
import './app.scss';

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
