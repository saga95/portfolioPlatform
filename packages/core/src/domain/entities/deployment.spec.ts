import { describe, it, expect } from 'vitest';
import { Deployment } from './deployment.js';
import { DeploymentId } from '../value-objects/deployment-id.js';
import { ProjectId } from '../value-objects/project-id.js';
import { TenantId } from '../value-objects/tenant-id.js';

function createDeployment() {
  return Deployment.create({
    deploymentId: DeploymentId.create('deploy_abc123'),
    projectId: ProjectId.create('proj_abc123'),
    tenantId: TenantId.create('tenant_abc123'),
    version: '0.1.0',
  });
}

describe('Deployment', () => {
  describe('create', () => {
    it('should create a deployment in pending state', () => {
      const d = createDeployment();
      expect(d.status).toBe('pending');
      expect(d.version).toBe('0.1.0');
      expect(d.deploymentId.value).toBe('deploy_abc123');
      expect(d.logs).toHaveLength(0);
      expect(d.completedAt).toBeUndefined();
      expect(d.errorMessage).toBeUndefined();
      expect(d.deployedUrl).toBeUndefined();
    });

    it('should be immutable', () => {
      const d = createDeployment();
      expect(Object.isFrozen(d)).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition pending → bootstrapping', () => {
      const d = createDeployment().startBootstrap();
      expect(d.status).toBe('bootstrapping');
    });

    it('should transition bootstrapping → deploying', () => {
      const d = createDeployment().startBootstrap().startDeploy();
      expect(d.status).toBe('deploying');
    });

    it('should transition deploying → verifying', () => {
      const d = createDeployment()
        .startBootstrap()
        .startDeploy()
        .startVerification();
      expect(d.status).toBe('verifying');
    });

    it('should transition verifying → succeeded', () => {
      const d = createDeployment()
        .startBootstrap()
        .startDeploy()
        .startVerification()
        .markSucceeded('https://app.example.com');
      expect(d.status).toBe('succeeded');
      expect(d.deployedUrl).toBe('https://app.example.com');
      expect(d.completedAt).toBeDefined();
    });

    it('should transition to failed from any in-progress state', () => {
      const pending = createDeployment().markFailed('error1');
      expect(pending.status).toBe('failed');
      expect(pending.errorMessage).toBe('error1');

      const bootstrapping = createDeployment().startBootstrap().markFailed('error2');
      expect(bootstrapping.status).toBe('failed');

      const deploying = createDeployment().startBootstrap().startDeploy().markFailed('error3');
      expect(deploying.status).toBe('failed');

      const verifying = createDeployment()
        .startBootstrap()
        .startDeploy()
        .startVerification()
        .markFailed('error4');
      expect(verifying.status).toBe('failed');
    });

    it('should transition failed → rolling_back', () => {
      const d = createDeployment().markFailed('err').startRollback();
      expect(d.status).toBe('rolling_back');
    });

    it('should transition failed → pending (retry)', () => {
      const d = createDeployment().markFailed('err').retry();
      expect(d.status).toBe('pending');
    });

    it('should transition rolling_back → pending', () => {
      const d = createDeployment().markFailed('err').startRollback().retry();
      expect(d.status).toBe('pending');
    });

    it('should throw on invalid transition: pending → succeeded', () => {
      expect(() => createDeployment().markSucceeded('url')).toThrow(
        'Invalid deployment status transition',
      );
    });

    it('should throw on invalid transition: succeeded → deploying', () => {
      const d = createDeployment()
        .startBootstrap()
        .startDeploy()
        .startVerification()
        .markSucceeded('url');
      expect(() => d.startDeploy()).toThrow('Invalid deployment status transition');
    });

    it('should throw on invalid transition: pending → verifying', () => {
      expect(() => createDeployment().startVerification()).toThrow(
        'Invalid deployment status transition',
      );
    });
  });

  describe('logs', () => {
    it('should append log entries with timestamp', () => {
      const d = createDeployment()
        .appendLog('Starting bootstrap')
        .appendLog('Bootstrap complete');
      expect(d.logs).toHaveLength(2);
      expect(d.logs[0]).toContain('Starting bootstrap');
      expect(d.logs[1]).toContain('Bootstrap complete');
    });

    it('should preserve logs across state transitions', () => {
      const d = createDeployment()
        .appendLog('Step 1')
        .startBootstrap()
        .appendLog('Step 2');
      expect(d.logs).toHaveLength(2);
      expect(d.status).toBe('bootstrapping');
    });
  });

  describe('queries', () => {
    it('should report isTerminal for succeeded', () => {
      const d = createDeployment()
        .startBootstrap()
        .startDeploy()
        .startVerification()
        .markSucceeded('url');
      expect(d.isTerminal).toBe(true);
    });

    it('should report isTerminal for failed', () => {
      const d = createDeployment().markFailed('err');
      expect(d.isTerminal).toBe(true);
    });

    it('should report not terminal for in-progress', () => {
      expect(createDeployment().isTerminal).toBe(false);
      expect(createDeployment().startBootstrap().isTerminal).toBe(false);
    });

    it('should report isInProgress correctly', () => {
      expect(createDeployment().isInProgress).toBe(true);
      expect(createDeployment().startBootstrap().isInProgress).toBe(true);
      expect(createDeployment().startBootstrap().startDeploy().isInProgress).toBe(true);
      expect(createDeployment().markFailed('err').isInProgress).toBe(false);
      expect(
        createDeployment()
          .startBootstrap()
          .startDeploy()
          .startVerification()
          .markSucceeded('url')
          .isInProgress,
      ).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence', () => {
      const d = Deployment.reconstitute({
        deploymentId: DeploymentId.create('deploy_restored'),
        projectId: ProjectId.create('proj_restored'),
        tenantId: TenantId.create('tenant_restored'),
        version: '1.2.3',
        status: 'deploying',
        logs: ['[2025-01-01T00:00:00.000Z] Started'],
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: undefined,
        errorMessage: undefined,
        deployedUrl: undefined,
      });
      expect(d.status).toBe('deploying');
      expect(d.version).toBe('1.2.3');
      expect(d.logs).toHaveLength(1);
      expect(d.deploymentId.value).toBe('deploy_restored');
    });
  });
});
