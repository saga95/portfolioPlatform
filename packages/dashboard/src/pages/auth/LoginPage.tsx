import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../auth/AuthContext';
import { RocketLaunchIcon } from '../../components/icons';

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export function LoginPage() {
  const { login, signUp, confirmSignUp, isCognitoEnabled, error: authError } = useAuth();
  const [tab, setTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  // Sign-in fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign-up fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  // Confirmation code
  const [code, setCode] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(signInEmail, signInPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signUpPassword !== signUpConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp(signUpEmail, signUpPassword, signUpName);
      setConfirmEmail(signUpEmail);
      setNeedsConfirmation(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmSignUp(confirmEmail, code);
      setNeedsConfirmation(false);
      setTab(0); // Switch to sign-in tab
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = error || authError;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo / Brand */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <RocketLaunchIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700}>
              PromptDeploy
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prompt to SaaS in minutes
            </Typography>
          </Box>

          {!isCognitoEnabled && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Dev mode — Cognito not configured. Any credentials will log you in.
            </Alert>
          )}

          {displayError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {displayError}
            </Alert>
          )}

          {needsConfirmation ? (
            /* ─── Confirmation Code ─── */
            <Box component="form" onSubmit={handleConfirm}>
              <Typography variant="h6" gutterBottom>
                Verify your email
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                We sent a verification code to {confirmEmail}
              </Typography>
              <TextField
                label="Verification Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                fullWidth
                required
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isSubmitting}
              >
                {isSubmitting ? <CircularProgress size={24} /> : 'Verify'}
              </Button>
            </Box>
          ) : (
            <>
              <Tabs
                value={tab}
                onChange={(_, v) => { setTab(v); setError(null); }}
                variant="fullWidth"
                sx={{ mb: 1 }}
              >
                <Tab label="Sign In" />
                <Tab label="Sign Up" />
              </Tabs>

              {/* ─── Sign In ─── */}
              <TabPanel value={tab} index={0}>
                <Box component="form" onSubmit={handleSignIn}>
                  <TextField
                    label="Email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    fullWidth
                    required
                    sx={{ mb: 3 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={24} /> : 'Sign In'}
                  </Button>
                </Box>
              </TabPanel>

              {/* ─── Sign Up ─── */}
              <TabPanel value={tab} index={1}>
                <Box component="form" onSubmit={handleSignUp}>
                  <TextField
                    label="Full Name"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    fullWidth
                    required
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    fullWidth
                    required
                    helperText="Min 8 chars, upper + lower + digit"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Confirm Password"
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    fullWidth
                    required
                    sx={{ mb: 3 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={24} /> : 'Create Account'}
                  </Button>
                </Box>
              </TabPanel>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
