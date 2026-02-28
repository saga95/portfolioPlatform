import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Chip,
  Alert,
} from '@mui/material';
import {
  PlayArrowIcon,
  StopIcon,
  ReplayIcon,
  CheckCircleIcon,
  ErrorOutlineIcon,
} from './icons.js';
import { api } from '../api/index.js';
import type { ExecutionDTO, ApiError } from '../api/index.js';
import { useAuth } from '../auth/index.js';

const PIPELINE_STEPS = [
  'requirement_analysis',
  'spec_review',
  'system_design',
  'code_generation',
  'assembly',
  'qa_validation',
  'security_review',
  'repository_setup',
  'deployment',
  'verification',
] as const;

const STEP_LABELS: Record<string, string> = {
  requirement_analysis: 'Requirements',
  spec_review: 'Spec Review',
  system_design: 'System Design',
  code_generation: 'Code Gen',
  assembly: 'Assembly',
  qa_validation: 'QA',
  security_review: 'Security',
  repository_setup: 'Repo Setup',
  deployment: 'Deploy',
  verification: 'Verify',
};

function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'running': return 'primary';
    case 'waiting_for_human': return 'warning';
    case 'completed': return 'success';
    case 'failed': return 'error';
    case 'cancelled': return 'default';
    default: return 'default';
  }
}

function getStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ExecutionPanelProps {
  projectId: string;
}

export function ExecutionPanel({ projectId }: ExecutionPanelProps) {
  const { user } = useAuth();
  const [execution, setExecution] = useState<ExecutionDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLatestExecution = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.executions.list(user.tenantId, projectId);
      setExecution(result.executions[0] ?? null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? 'Failed to load executions');
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchLatestExecution();
  }, [fetchLatestExecution]);

  // Poll for updates when execution is running or waiting
  useEffect(() => {
    if (!execution || !user) return;
    if (execution.status !== 'running' && execution.status !== 'waiting_for_human') return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.executions.get(user.tenantId, execution.executionId);
        setExecution(updated);
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [execution, user]);

  const handleStart = async () => {
    if (!user) return;
    setActionLoading(true);
    setError(null);
    try {
      const exec = await api.executions.start(user.tenantId, projectId);
      setExecution(exec);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? 'Failed to start execution');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'cancel' | 'retry') => {
    if (!user || !execution) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await api.executions.update(user.tenantId, execution.executionId, action);
      setExecution(updated);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? `Failed to ${action} execution`);
    } finally {
      setActionLoading(false);
    }
  };

  const currentStepIndex = execution
    ? PIPELINE_STEPS.indexOf(execution.currentStep as typeof PIPELINE_STEPS[number])
    : -1;

  const isActive = execution?.status === 'running' || execution?.status === 'waiting_for_human';

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Agent Pipeline</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {execution && (
              <Chip
                label={getStatusLabel(execution.status)}
                color={getStatusColor(execution.status)}
                size="small"
              />
            )}
            {!execution && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleStart}
                disabled={actionLoading || isLoading}
              >
                Start Pipeline
              </Button>
            )}
            {execution?.status === 'waiting_for_human' && (
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleAction('approve')}
                disabled={actionLoading}
              >
                Approve
              </Button>
            )}
            {isActive && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<StopIcon />}
                onClick={() => handleAction('cancel')}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            )}
            {execution?.status === 'failed' && (
              <Button
                variant="contained"
                size="small"
                color="warning"
                startIcon={<ReplayIcon />}
                onClick={() => handleAction('retry')}
                disabled={actionLoading}
              >
                Retry
              </Button>
            )}
            {(execution?.status === 'completed' || execution?.status === 'cancelled' || execution?.status === 'failed') && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleStart}
                disabled={actionLoading}
              >
                New Run
              </Button>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!execution && !isLoading && !error && (
          <Typography variant="body2" color="text.secondary">
            No pipeline runs yet. Click &quot;Start Pipeline&quot; to begin generating your SaaS application.
          </Typography>
        )}

        {execution && (
          <>
            {/* Progress bar */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {execution.progressPercent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={execution.progressPercent}
                color={execution.status === 'failed' ? 'error' : 'primary'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            {/* Pipeline stepper */}
            <Stepper
              activeStep={currentStepIndex}
              alternativeLabel
              sx={{
                '& .MuiStepLabel-label': { fontSize: '0.7rem' },
                mb: 2,
              }}
            >
              {PIPELINE_STEPS.map((step) => {
                const stepRecord = execution.steps.find((s) => s.step === step);
                const isFailed = stepRecord?.status === 'failed';
                const isCompleted = stepRecord?.status === 'completed';
                return (
                  <Step key={step} completed={isCompleted}>
                    <StepLabel error={isFailed}>
                      {STEP_LABELS[step] ?? step}
                    </StepLabel>
                  </Step>
                );
              })}
            </Stepper>

            {/* Token usage */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Tokens: {execution.tokensUsed.toLocaleString()} / {execution.tokensBudget.toLocaleString()}
              </Typography>
              {execution.startedAt && (
                <Typography variant="caption" color="text.secondary">
                  Started: {new Date(execution.startedAt).toLocaleString()}
                </Typography>
              )}
            </Box>

            {execution.errorMessage && (
              <Alert severity="error" sx={{ mt: 1 }} icon={<ErrorOutlineIcon />}>
                {execution.errorMessage}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
