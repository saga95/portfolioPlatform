import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  Link,
} from '@mui/material';
import { ArrowBackIcon, OpenInNewIcon, GitHubIcon } from '../../components/icons.js';
import { api } from '../../api/index.js';
import type { ProjectDTO, ApiError } from '../../api/index.js';
import { useAuth } from '../../auth/index.js';
import { StatusChip, LoadingSpinner, ErrorDisplay, ExecutionPanel } from '../../components/index.js';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!user || !projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.projects.get(user.tenantId, projectId);
      setProject(result);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (isLoading) return <LoadingSpinner message="Loading project..." />;
  if (error) return <ErrorDisplay message={error} onRetry={fetchProject} />;
  if (!project) return <ErrorDisplay message="Project not found" />;

  return (
    <Box>
      {/* Breadcrumb / Back */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 2 }}
      >
        Back to Projects
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h3" gutterBottom>
            {project.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatusChip status={project.status} size="medium" />
            <Typography variant="body2" color="text.secondary">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {project.repoUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<GitHubIcon />}
              component={Link}
              href={project.repoUrl}
              target="_blank"
            >
              Repo
            </Button>
          )}
          {project.deployedUrl && (
            <Button
              variant="contained"
              size="small"
              startIcon={<OpenInNewIcon />}
              component={Link}
              href={project.deployedUrl}
              target="_blank"
            >
              Open App
            </Button>
          )}
        </Box>
      </Box>

      {/* Agent Pipeline Execution Panel */}
      <ExecutionPanel projectId={project.projectId} />

      {/* Details */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {project.description || 'No description provided.'}
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Project ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {project.projectId}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Template
                  </Typography>
                  <Typography variant="body2">{project.templateId}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {new Date(project.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date(project.updatedAt).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {project.status === 'draft' && (
                  <Button variant="contained" fullWidth>
                    Submit for Review
                  </Button>
                )}
                {project.status === 'live' && (
                  <Button variant="outlined" fullWidth startIcon={<OpenInNewIcon />}>
                    View Deployment
                  </Button>
                )}
                {project.status === 'failed' && (
                  <Button variant="contained" color="warning" fullWidth>
                    Retry Pipeline
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  disabled={project.status === 'deploying' || project.status === 'live'}
                >
                  Delete Project
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
