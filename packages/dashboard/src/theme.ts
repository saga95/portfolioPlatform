import { createTheme } from '@mui/material/styles';

/**
 * PromptDeploy brand theme — dark-first with accent teal.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00BFA5', // Teal accent
      light: '#5DF2D6',
      dark: '#008E76',
      contrastText: '#000',
    },
    secondary: {
      main: '#7C4DFF', // Purple
      light: '#B47CFF',
      dark: '#3F1DCB',
    },
    background: {
      default: '#0A0E17',
      paper: '#111827',
    },
    error: {
      main: '#FF5252',
    },
    warning: {
      main: '#FFB74D',
    },
    success: {
      main: '#69F0AE',
    },
    text: {
      primary: '#E8EAED',
      secondary: '#9AA0A6',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.5rem' },
    h4: { fontWeight: 600, fontSize: '1.25rem' },
    h5: { fontWeight: 500, fontSize: '1rem' },
    h6: { fontWeight: 500, fontSize: '0.875rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
        },
        containedPrimary: {
          '&:hover': {
            boxShadow: '0 0 20px rgba(0,191,165,0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
  },
});
