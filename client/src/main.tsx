import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/familjen-grotesk';
import '@fontsource-variable/wix-madefor-text';
import '@fontsource-variable/noto-sans-mono';
import './styles/tokens.css';
import './App.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
