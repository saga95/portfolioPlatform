import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme.js';
import { AuthProvider } from './auth/index.js';
import { App } from './App.js';

function renderApp(route = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('App', () => {
  it('should render the dashboard layout on /', async () => {
    renderApp('/');
    await waitFor(() => {
      expect(screen.getByText('PromptDeploy')).toBeInTheDocument();
    });
  });

  it('should render the home page by default', async () => {
    renderApp('/');
    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });
  });

  it('should navigate to projects page', async () => {
    renderApp('/projects');
    await waitFor(() => {
      expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
    });
  });

  it('should navigate to settings page', async () => {
    renderApp('/settings');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });
  });

  it('should navigate to billing page', async () => {
    renderApp('/billing');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /billing/i })).toBeInTheDocument();
    });
  });

  it('should redirect unknown routes to /', async () => {
    renderApp('/unknown');
    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });
  });

  it('should show login page on /login', () => {
    renderApp('/login');
    expect(screen.getByText(/Prompt to SaaS in minutes/i)).toBeInTheDocument();
  });
});
