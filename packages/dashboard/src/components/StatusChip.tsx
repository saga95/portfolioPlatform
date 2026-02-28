import { Chip } from '@mui/material';
import type { ProjectStatus } from '@promptdeploy/shared-types';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info' }> = {
  draft: { label: 'Draft', color: 'default' },
  spec_review: { label: 'Spec Review', color: 'info' },
  designing: { label: 'Designing', color: 'info' },
  generating: { label: 'Generating', color: 'secondary' },
  qa_review: { label: 'QA Review', color: 'warning' },
  security_review: { label: 'Security Review', color: 'warning' },
  deploying: { label: 'Deploying', color: 'primary' },
  live: { label: 'Live', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
};

interface StatusChipProps {
  status: ProjectStatus;
  size?: 'small' | 'medium';
}

export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const };
  return <Chip label={config.label} color={config.color} size={size} variant="outlined" />;
}
