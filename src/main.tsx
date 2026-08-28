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

const root = createRoot(document.getElementById('root')!);

try {
  await loadConfig();
} catch {
  root.render(
    <main className="container py-5">
      <h1>EPIC is temporarily unavailable</h1>
      <p>The site could not load its configuration. Reload the page to try again.</p>
    </main>
  );
  throw new Error('config: giving up');
}
initAnalytics(getConfig());

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </QueryClientProvider>
  </StrictMode>
);
