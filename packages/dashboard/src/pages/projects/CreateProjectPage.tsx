import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import { ArrowBackIcon, RocketLaunchIcon } from '../../components/icons.js';
import { api } from '../../api/index.js';
import type { ApiError } from '../../api/index.js';
import { useAuth } from '../../auth/index.js';

const TEMPLATES = [
  { id: 'tmpl-react-node', label: 'React + Node.js API', description: 'Full-stack SaaS with React frontend and serverless Node.js backend' },
  { id: 'tmpl-react-only', label: 'React SPA', description: 'Single-page application with static hosting' },
  { id: 'tmpl-api-only', label: 'API Service', description: 'Serverless API with DynamoDB and Lambda' },
];

export function CreateProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('tmpl-react-node');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const project = await api.projects.create(user.tenantId, {
        name: name.trim(),
        description: description.trim(),
        templateId,
      });
      navigate(`/projects/${project.projectId}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 2 }}
      >
        Back to Projects
      </Button>

      <Typography variant="h3" gutterBottom>
        Create New Project
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Describe your SaaS idea. Our AI agents will design, build, and deploy it.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Project Name"
              placeholder="My SaaS App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              inputProps={{ maxLength: 100 }}
              helperText={`${name.length}/100`}
            />

            <TextField
              label="Description"
              placeholder="Describe your SaaS idea in detail. What problem does it solve? Who are the users? What are the key features?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={4}
              maxRows={8}
              fullWidth
              inputProps={{ maxLength: 2000 }}
              helperText={`${description.length}/2000 — Be as detailed as possible for better results.`}
            />

            <TextField
              label="Template"
              select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              fullWidth
              helperText="Choose a starting architecture."
            >
              {TEMPLATES.map((tmpl) => (
                <MenuItem key={tmpl.id} value={tmpl.id}>
                  <Box>
                    <Typography variant="body2">{tmpl.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tmpl.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/projects')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={!name.trim() || isSubmitting}
                startIcon={<RocketLaunchIcon />}
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
