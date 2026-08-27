import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import { loadConfig, getConfig } from './app/config/config';
import { initAnalytics } from './app/analytics/analytics';
import { queryClient } from './app/api/query-client';
import { routes } from './app/routes';

await loadConfig();
initAnalytics(getConfig());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </QueryClientProvider>
  </StrictMode>
);
