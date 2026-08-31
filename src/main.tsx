import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ConvexClientProvider } from './context/ConvexClientProvider';
import { PinLockProvider } from './context/PinLockContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexClientProvider>
      <PinLockProvider>
        <App />
      </PinLockProvider>
    </ConvexClientProvider>
  </React.StrictMode>
);
