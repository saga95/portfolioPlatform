/**
 * Unit tests for PromptTemplate class.
 */

import { describe, it, expect } from 'vitest';
import { PromptTemplate, createPromptTemplate } from './prompt-template';
import type { PromptConfig } from './types';

describe('PromptTemplate', () => {
  describe('constructor and build', () => {
    it('should create a template and interpolate variables', () => {
      const template = new PromptTemplate('Hello, {{name}}!', 'requirement_analyzer');
      const result = template.build({ name: 'World' });

      expect(result).toBe('Hello, World!');
    });

    it('should handle multiple variables', () => {
      const template = new PromptTemplate(
        '{{greeting}}, {{name}}! Welcome to {{place}}.',
        'requirement_analyzer'
      );
      const result = template.build({
        greeting: 'Hello',
        name: 'Alice',
        place: 'Wonderland',
      });

      expect(result).toBe('Hello, Alice! Welcome to Wonderland.');
    });

    it('should clean unmatched variables', () => {
      const template = new PromptTemplate(
        'Hello, {{name}}! Your age is {{age}}.',
        'requirement_analyzer'
      );
      const result = template.build({ name: 'Bob' });

      // Unmatched variables are cleaned up (empty string)
      expect(result).toBe('Hello, Bob! Your age is .');
    });

    it('should support createPromptTemplate factory', () => {
      const template = createPromptTemplate('Test {{value}}', 'frontend_dev');
      expect(template.build({ value: '123' })).toBe('Test 123');
    });
  });

  describe('conditionals', () => {
    it('should include content when condition is truthy', () => {
      const template = new PromptTemplate(
        'Hello{{#if name}}, {{name}}{{/if}}!',
        'requirement_analyzer'
      );

      expect(template.build({ name: 'Alice' })).toBe('Hello, Alice!');
    });

    it('should exclude content when condition is falsy', () => {
      const template = new PromptTemplate(
        'Hello{{#if name}}, {{name}}{{/if}}!',
        'requirement_analyzer'
      );

      expect(template.build({})).toBe('Hello!');
      expect(template.build({ name: '' })).toBe('Hello!');
    });

    it('should handle nested conditionals', () => {
      const template = new PromptTemplate(
        '{{#if outer}}Outer{{#if inner}} Inner{{/if}}{{/if}}',
        'requirement_analyzer'
      );

      expect(template.build({ outer: true, inner: true })).toBe('Outer Inner');
      expect(template.build({ outer: true, inner: false })).toBe('Outer');
      expect(template.build({ outer: false, inner: true })).toBe('');
    });

    it('should handle multiline conditional blocks', () => {
      const template = new PromptTemplate(
        `Start
{{#if showSection}}
This is a section.
It has multiple lines.
{{/if}}
Done.`,
        'requirement_analyzer'
      );

      const withSection = template.build({ showSection: true });
      expect(withSection).toContain('This is a section.');
      expect(withSection).toContain('It has multiple lines.');

      const withoutSection = template.build({ showSection: false });
      expect(withoutSection).not.toContain('This is a section.');
      expect(withoutSection).toContain('Done.');
    });
  });

  describe('loops', () => {
    it('should iterate over primitive arrays', () => {
      const template = new PromptTemplate(
        '{{#each items}}{{this}}, {{/each}}',
        'requirement_analyzer'
      );
      const result = template.build({ items: ['a', 'b', 'c'] });

      expect(result).toBe('a, b, c,');
    });

    it('should access object properties in loop', () => {
      const template = new PromptTemplate(
        '{{#each users}}{{name}}: {{email}}\n{{/each}}',
        'requirement_analyzer'
      );
      const result = template.build({
        users: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      });

      expect(result).toContain('Alice: alice@example.com');
      expect(result).toContain('Bob: bob@example.com');
    });

    it('should handle empty arrays', () => {
      const template = new PromptTemplate(
        'Items: {{#each items}}{{this}}{{/each}}None',
        'requirement_analyzer'
      );

      expect(template.build({ items: [] })).toBe('Items: None');
    });

    it('should handle undefined arrays', () => {
      const template = new PromptTemplate(
        'Items: {{#each items}}{{this}}{{/each}}Empty',
        'requirement_analyzer'
      );

      expect(template.build({})).toBe('Items: Empty');
    });

    it('should support @index in loops', () => {
      const template = new PromptTemplate(
        '{{#each items}}{{@index}}: {{this}}\n{{/each}}',
        'requirement_analyzer'
      );
      const result = template.build({ items: ['a', 'b', 'c'] });

      expect(result).toContain('0: a');
      expect(result).toContain('1: b');
      expect(result).toContain('2: c');
    });
  });

  describe('buildWithContext', () => {
    it('should build system prompt and user message', () => {
      const template = new PromptTemplate(
        'Analyze the following: {{task}}',
        'requirement_analyzer'
      );

      const config: PromptConfig = {
        agentId: 'requirement_analyzer',
        variables: { task: 'build a todo app' },
      };

      const result = template.buildWithContext(config);

      expect(result.systemPrompt).toContain('Analyze the following: build a todo app');
      expect(result.systemPrompt).toContain('Output Format');
    });

    it('should include few-shot examples', () => {
      const template = new PromptTemplate('Task: {{task}}', 'requirement_analyzer');

      const config: PromptConfig = {
        agentId: 'requirement_analyzer',
        variables: { task: 'do something' },
        examples: [
          { input: 'Example input 1', output: 'Example output 1' },
          { input: 'Example input 2', output: 'Example output 2' },
        ],
      };

      const result = template.buildWithContext(config);

      expect(result.systemPrompt).toContain('Example input 1');
      expect(result.systemPrompt).toContain('Example output 1');
      expect(result.systemPrompt).toContain('Example input 2');
      expect(result.systemPrompt).toContain('Example output 2');
    });

    it('should include user prompt in user message', () => {
      const template = new PromptTemplate('System instructions', 'requirement_analyzer');

      const config: PromptConfig = {
        agentId: 'requirement_analyzer',
        variables: { userPrompt: 'Build me a CRM' },
      };

      const result = template.buildWithContext(config);

      expect(result.userMessage).toContain('<user_request>');
      expect(result.userMessage).toContain('Build me a CRM');
      expect(result.userMessage).toContain('</user_request>');
    });

    it('should include previous output context', () => {
      const template = new PromptTemplate('Continue generation', 'system_designer');

      const config: PromptConfig = {
        agentId: 'system_designer',
        variables: {
          projectSpec: '<spec>App requirements</spec>',
        },
      };

      const result = template.buildWithContext(config);

      expect(result.userMessage).toContain('<project_spec>');
      expect(result.userMessage).toContain('App requirements');
    });

    it('should include additional instructions', () => {
      const template = new PromptTemplate('Base prompt', 'frontend_dev');

      const config: PromptConfig = {
        agentId: 'frontend_dev',
        variables: {},
        additionalInstructions: 'Focus on accessibility',
      };

      const result = template.buildWithContext(config);

      expect(result.systemPrompt).toContain('Additional Instructions');
      expect(result.systemPrompt).toContain('Focus on accessibility');
    });
  });

  describe('getAgentConfig', () => {
    it('should return the agent configuration', () => {
      const template = new PromptTemplate('Test', 'frontend_dev');
      const config = template.getAgentConfig();

      expect(config.id).toBe('frontend_dev');
      expect(config.name).toBe('Frontend Developer');
      expect(config.outputFormat).toBe('xml');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in variables', () => {
      const template = new PromptTemplate('Code: {{code}}', 'backend_dev');
      const result = template.build({ code: 'const x = 1 < 2 && 3 > 2;' });

      expect(result).toBe('Code: const x = 1 < 2 && 3 > 2;');
    });

    it('should handle newlines in variable values', () => {
      const template = new PromptTemplate('Content:\n{{content}}', 'backend_dev');
      const result = template.build({ content: 'Line 1\nLine 2\nLine 3' });

      expect(result).toBe('Content:\nLine 1\nLine 2\nLine 3');
    });

    it('should handle empty template', () => {
      const template = new PromptTemplate('', 'backend_dev');
      expect(template.build({})).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = new PromptTemplate('Just plain text.', 'backend_dev');
      expect(template.build({})).toBe('Just plain text.');
    });

    it('should handle dot notation in variables', () => {
      const template = new PromptTemplate('User: {{user.name}}', 'backend_dev');
      const result = template.build({ user: { name: 'Alice' } });

      expect(result).toBe('User: Alice');
    });
  });
});
