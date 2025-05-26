import React, { useState, useMemo, createContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from './contexts/AuthContext.js';

// Pages - using .tsx extensions
import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import Dashboard from './pages/Dashboard.tsx';
import ChartOfAccounts from './pages/ChartOfAccounts.tsx';
import JournalEntries from './pages/JournalEntries.tsx';
import GeneralLedger from './pages/GeneralLedger.tsx';
import TrialBalance from './pages/TrialBalance.tsx';
import Organizations from './pages/Organizations.tsx';

// Layouts
import MainLayout from './components/layouts/MainLayout.tsx';

// Create a ColorModeContext
export const ColorModeContext = createContext({ toggleColorMode: () => {} });

// Create a theme instance with light and dark mode
const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#0052cc', // deep fintech blue
    },
    secondary: {
      main: '#dbeafe', // light blue
    },
    background: {
      default: mode === 'light' ? '#ffffff' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? '#111827' : '#e0e0e0',
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: 'none', // Prevents all-caps buttons
    },
  },
  shape: {
    borderRadius: 16, // Rounded corners (16px)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 8px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
  },
});

function App() {
  const { currentUser } = useAuth();
  const [mode, setMode] = useState('light');
  
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );
  
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (!currentUser) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  // For debugging
  console.log("App rendering, routes should be available");
  console.log("Current user:", currentUser);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/chart-of-accounts" element={
            <ProtectedRoute>
              <MainLayout>
                <ChartOfAccounts />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/journal-entries" element={
            <ProtectedRoute>
              <MainLayout>
                <JournalEntries />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/general-ledger" element={
            <ProtectedRoute>
              <MainLayout>
                <GeneralLedger />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/trial-balance" element={
            <ProtectedRoute>
              <MainLayout>
                <TrialBalance />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/organizations" element={
            <ProtectedRoute>
              <MainLayout>
                <Organizations />
              </MainLayout>
            </ProtectedRoute>
          } />
          
          {/* Fallback route - redirect to login */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
