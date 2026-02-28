import { Box, Typography } from '@mui/material';

export function SettingsPage() {
  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Account, billing, and AWS connection settings will appear here.
      </Typography>
    </Box>
  );
}
