import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  RocketLaunchIcon,
  ReplayIcon,
  CheckCircleIcon,
  ErrorOutlineIcon,
  OpenInNewIcon,
} from './icons.js';
import { api } from '../api/index.js';
import type { DeploymentDTO, ApiError } from '../api/index.js';
import { useAuth } from '../auth/index.js';

function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'pending': return 'default';
    case 'bootstrapping': return 'primary';
    case 'deploying': return 'primary';
    case 'verifying': return 'warning';
    case 'succeeded': return 'success';
    case 'failed': return 'error';
    case 'rolling_back': return 'warning';
    default: return 'default';
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    bootstrapping: 'Bootstrapping',
    deploying: 'Deploying',
    verifying: 'Verifying',
    succeeded: 'Succeeded',
    failed: 'Failed',
    rolling_back: 'Rolling Back',
  };
  return labels[status] ?? status;
}

function getProgressPercent(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    bootstrapping: 25,
    deploying: 50,
    verifying: 75,
    succeeded: 100,
    failed: 100,
    rolling_back: 50,
  };
  return map[status] ?? 0;
}

interface DeploymentPanelProps {
  projectId: string;
}

export function DeploymentPanel({ projectId }: DeploymentPanelProps) {
  const { tenantId } = useAuth();
  const [deployments, setDeployments] = useState<DeploymentDTO[]>([]);
  const [selected, setSelected] = useState<DeploymentDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDeployments = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const result = await api.deployments.list(tenantId, projectId);
      setDeployments(result.deployments);
      if (result.deployments.length > 0 && !selected) {
        setSelected(result.deployments[0]);
      }
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }, [tenantId, projectId, selected]);

  // Poll for active deployments
  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 5000);
    return () => clearInterval(interval);
  }, [loadDeployments]);

  // Refresh selected deployment
  useEffect(() => {
    if (!tenantId || !selected) return;
    const isActive = ['pending', 'bootstrapping', 'deploying', 'verifying', 'rolling_back'].includes(selected.status);
    if (!isActive) return;

    const poll = setInterval(async () => {
      try {
        const updated = await api.deployments.get(tenantId, selected.deploymentId);
        setSelected(updated);
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [tenantId, selected]);

  const handleStartDeployment = async () => {
    if (!tenantId) return;
    try {
      setError(null);
      const deployment = await api.deployments.start(tenantId, projectId, '0.1.0');
      setSelected(deployment);
      await loadDeployments();
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to start deployment');
    }
  };

  const handleRetry = async () => {
    if (!tenantId || !selected) return;
    try {
      setError(null);
      const updated = await api.deployments.update(tenantId, selected.deploymentId, 'retry');
      setSelected(updated);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to retry deployment');
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Deployments</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<RocketLaunchIcon />}
            onClick={handleStartDeployment}
            disabled={loading}
          >
            Deploy
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {deployments.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            No deployments yet. Click Deploy to start.
          </Typography>
        )}

        {selected && (
          <Box>
            {/* Status Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={getStatusLabel(selected.status)}
                color={getStatusColor(selected.status)}
                size="small"
                icon={
                  selected.status === 'succeeded' ? <CheckCircleIcon /> :
                  selected.status === 'failed' ? <ErrorOutlineIcon /> :
                  undefined
                }
              />
              <Typography variant="caption" color="text.secondary">
                v{selected.version}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(selected.startedAt).toLocaleString()}
              </Typography>
            </Box>

            {/* Progress Bar */}
            {selected.status !== 'succeeded' && selected.status !== 'failed' && (
              <LinearProgress
                variant="determinate"
                value={getProgressPercent(selected.status)}
                sx={{ mb: 2, borderRadius: 1, height: 6 }}
              />
            )}

            {/* Deployed URL */}
            {selected.deployedUrl && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Live at:</Typography>
                  <Button
                    size="small"
                    href={selected.deployedUrl}
                    target="_blank"
                    endIcon={<OpenInNewIcon />}
                  >
                    {selected.deployedUrl}
                  </Button>
                </Box>
              </Alert>
            )}

            {/* Error Message */}
            {selected.errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {selected.errorMessage}
              </Alert>
            )}

            {/* Actions */}
            {selected.status === 'failed' && (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ReplayIcon />}
                  onClick={handleRetry}
                >
                  Retry
                </Button>
              </Box>
            )}

            {/* Logs */}
            {selected.logs.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Logs</Typography>
                <List
                  dense
                  sx={{
                    maxHeight: 200,
                    overflow: 'auto',
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  {selected.logs.map((log, i) => (
                    <ListItem key={i} disablePadding sx={{ py: 0 }}>
                      <ListItemText
                        primary={log}
                        primaryTypographyProps={{
                          variant: 'caption',
                          fontFamily: 'monospace',
                          sx: { wordBreak: 'break-all' },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* History */}
            {deployments.length > 1 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>History</Typography>
                {deployments.map((d) => (
                  <Chip
                    key={d.deploymentId}
                    label={`v${d.version} - ${getStatusLabel(d.status)}`}
                    color={getStatusColor(d.status)}
                    size="small"
                    variant={d.deploymentId === selected.deploymentId ? 'filled' : 'outlined'}
                    onClick={() => setSelected(d)}
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
