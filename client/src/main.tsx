import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';
import { DialogProvider } from './components/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DialogProvider>
        <App />
      </DialogProvider>
    </BrowserRouter>
  </StrictMode>,
);
