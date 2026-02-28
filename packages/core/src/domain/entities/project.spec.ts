import { describe, it, expect, vi } from 'vitest';
import { Project } from './project.js';
import { ProjectId } from '../value-objects/project-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { ProjectName } from '../value-objects/project-name.js';
import { ProjectDescription } from '../value-objects/project-description.js';
import { InvalidProjectTransitionError } from '../errors/index.js';

function createTestProject(overrides: Partial<Parameters<typeof Project.create>[0]> = {}): Project {
  return Project.create({
    projectId: ProjectId.create('proj_test-123'),
    tenantId: TenantId.create('tenant_test-456'),
    name: ProjectName.create('Test App'),
    description: ProjectDescription.create('A test application'),
    templateId: 'react-saas',
    ...overrides,
  });
}

describe('Project', () => {
  describe('create', () => {
    it('should create a project with draft status', () => {
      const project = createTestProject();
      expect(project.status).toBe('draft');
      expect(project.projectId.value).toBe('proj_test-123');
      expect(project.tenantId.value).toBe('tenant_test-456');
      expect(project.name.value).toBe('Test App');
      expect(project.description.value).toBe('A test application');
      expect(project.templateId).toBe('react-saas');
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const project = createTestProject();
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
      expect(project.createdAt).toBe(project.updatedAt);
    });

    it('should have no repoUrl or deployedUrl initially', () => {
      const project = createTestProject();
      expect(project.repoUrl).toBeUndefined();
      expect(project.deployedUrl).toBeUndefined();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a project from persisted state', () => {
      const now = new Date().toISOString();
      const project = Project.reconstitute({
        projectId: ProjectId.create('proj_rec-001'),
        tenantId: TenantId.create('tenant_rec-001'),
        name: ProjectName.create('Reconstituted'),
        description: ProjectDescription.create('From DB'),
        templateId: 'node-api',
        status: 'generating',
        repoUrl: 'https://github.com/test/repo',
        deployedUrl: undefined,
        createdAt: now,
        updatedAt: now,
      });
      expect(project.status).toBe('generating');
      expect(project.repoUrl).toBe('https://github.com/test/repo');
    });
  });

  describe('status transitions', () => {
    it('should transition from draft to spec_review', () => {
      const project = createTestProject();
      // Advance time to ensure updatedAt changes
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 1000));
      const updated = project.submitForReview();
      vi.useRealTimers();
      expect(updated.status).toBe('spec_review');
      expect(updated.updatedAt).not.toBe(project.updatedAt);
    });

    it('should transition from spec_review to designing', () => {
      const project = createTestProject().submitForReview();
      const updated = project.approveSpec();
      expect(updated.status).toBe('designing');
    });

    it('should transition from designing to generating', () => {
      const project = createTestProject().submitForReview().approveSpec();
      const updated = project.startGeneration();
      expect(updated.status).toBe('generating');
    });

    it('should transition from generating to qa_review', () => {
      const project = createTestProject().submitForReview().approveSpec().startGeneration();
      const updated = project.submitForQA();
      expect(updated.status).toBe('qa_review');
    });

    it('should transition from qa_review to security_review', () => {
      const project = createTestProject()
        .submitForReview()
        .approveSpec()
        .startGeneration()
        .submitForQA();
      const updated = project.approveQA();
      expect(updated.status).toBe('security_review');
    });

    it('should transition from security_review to deploying', () => {
      const project = createTestProject()
        .submitForReview()
        .approveSpec()
        .startGeneration()
        .submitForQA()
        .approveQA();
      const updated = project.startDeployment();
      expect(updated.status).toBe('deploying');
    });

    it('should transition from deploying to live', () => {
      const project = createTestProject()
        .submitForReview()
        .approveSpec()
        .startGeneration()
        .submitForQA()
        .approveQA()
        .startDeployment();
      const updated = project.markLive('https://app.example.com');
      expect(updated.status).toBe('live');
      expect(updated.deployedUrl).toBe('https://app.example.com');
    });

    it('should throw on invalid transition', () => {
      const project = createTestProject();
      expect(() => project.approveSpec()).toThrow(InvalidProjectTransitionError);
    });

    it('should allow setting repoUrl', () => {
      const project = createTestProject();
      const updated = project.setRepoUrl('https://github.com/org/repo');
      expect(updated.repoUrl).toBe('https://github.com/org/repo');
    });

    it('should allow marking as failed from any active status', () => {
      const project = createTestProject().submitForReview();
      const failed = project.markFailed();
      expect(failed.status).toBe('failed');
    });

    it('should not allow transition from live to failed', () => {
      const project = createTestProject()
        .submitForReview()
        .approveSpec()
        .startGeneration()
        .submitForQA()
        .approveQA()
        .startDeployment()
        .markLive('https://app.example.com');
      expect(() => project.markFailed()).toThrow(InvalidProjectTransitionError);
    });
  });
});
