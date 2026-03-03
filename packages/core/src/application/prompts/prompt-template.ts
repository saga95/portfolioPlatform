import type {
  PromptVariables,
  FewShotExample,
  PromptConfig,
  AgentId,
  AgentConfig,
} from './types.js';
import { AGENT_CONFIGS } from './types.js';

/**
 * A reusable prompt template with variable interpolation.
 *
 * Supports:
 * - {{variable}} syntax for interpolation
 * - {{#if variable}}...{{/if}} conditionals
 * - {{#each array}}...{{/each}} loops
 * - XML-structured output formatting
 */
export class PromptTemplate {
  private readonly template: string;
  private readonly agentConfig: AgentConfig;

  constructor(
    template: string,
    agentId: AgentId,
  ) {
    this.template = template;
    this.agentConfig = AGENT_CONFIGS[agentId];
  }

  /**
   * Build the complete prompt with interpolated variables.
   */
  build(variables: PromptVariables): string {
    let result = this.template;

    // Handle conditionals: {{#if variable}}...{{/if}}
    result = this.processConditionals(result, variables);

    // Handle loops: {{#each array}}...{{/each}}
    result = this.processLoops(result, variables);

    // Handle simple variable interpolation: {{variable}}
    result = this.interpolateVariables(result, variables);

    // Clean up any remaining unresolved variables
    result = this.cleanUnresolved(result);

    return result.trim();
  }

  /**
   * Build a complete prompt with system instructions and examples.
   */
  buildWithContext(config: PromptConfig): { systemPrompt: string; userMessage: string } {
    const systemPrompt = this.buildSystemPrompt(config);
    const userMessage = this.buildUserMessage(config);

    return { systemPrompt, userMessage };
  }

  /**
   * Build the system prompt for the agent.
   */
  private buildSystemPrompt(config: PromptConfig): string {
    const agentConfig = AGENT_CONFIGS[config.agentId];
    const parts: string[] = [];

    // Base system prompt from template
    parts.push(this.build(config.variables));

    // Add output format instructions
    parts.push(this.getOutputFormatInstructions(agentConfig));

    // Add few-shot examples if provided
    if (config.examples && config.examples.length > 0) {
      parts.push(this.formatExamples(config.examples));
    }

    // Add additional instructions if provided
    if (config.additionalInstructions) {
      parts.push(`\n## Additional Instructions\n${config.additionalInstructions}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Build the user message containing the actual request.
   */
  private buildUserMessage(config: PromptConfig): string {
    const parts: string[] = [];

    // User's original prompt
    if (config.variables.userPrompt) {
      parts.push(`<user_request>\n${config.variables.userPrompt}\n</user_request>`);
    }

    // Previous outputs as context
    if (config.variables.projectSpec) {
      parts.push(`<project_spec>\n${config.variables.projectSpec}\n</project_spec>`);
    }

    if (config.variables.systemDesign) {
      parts.push(`<system_design>\n${config.variables.systemDesign}\n</system_design>`);
    }

    if (config.variables.previousOutput) {
      parts.push(`<previous_output>\n${config.variables.previousOutput}\n</previous_output>`);
    }

    // Error context for retries
    if (config.variables.errorContext) {
      parts.push(`<error_context>\n${config.variables.errorContext}\n</error_context>`);
    }

    // Token budget reminder
    if (config.variables.tokenBudget) {
      parts.push(`<token_budget>${config.variables.tokenBudget}</token_budget>`);
    }

    return parts.join('\n\n');
  }

  /**
   * Get output format instructions based on agent config.
   */
  private getOutputFormatInstructions(agentConfig: AgentConfig): string {
    switch (agentConfig.outputFormat) {
      case 'xml':
        return `## Output Format
Respond with your output wrapped in XML tags. Use the following structure:

<${agentConfig.id}_output>
  <!-- Your structured output here -->
</${agentConfig.id}_output>

Important:
- Use proper XML escaping for special characters (&lt; &gt; &amp; &quot;)
- Ensure all tags are properly closed
- Use CDATA sections for code blocks: <![CDATA[code here]]>`;

      case 'json':
        return `## Output Format
Respond with valid JSON only. Do not include any text before or after the JSON object.

Important:
- Ensure proper JSON escaping for strings
- No trailing commas
- Use double quotes for strings`;

      case 'markdown':
        return `## Output Format
Respond in Markdown format with clear section headers.`;

      default:
        return '';
    }
  }

  /**
   * Format few-shot examples.
   */
  private formatExamples(examples: FewShotExample[]): string {
    const parts = ['## Examples'];

    examples.forEach((example, index) => {
      parts.push(`### Example ${index + 1}`);
      parts.push(`**Input:**\n${example.input}`);
      parts.push(`**Output:**\n${example.output}`);
      if (example.explanation) {
        parts.push(`**Explanation:** ${example.explanation}`);
      }
    });

    return parts.join('\n\n');
  }

  /**
   * Process {{#if variable}}...{{/if}} conditionals.
   * Processes from innermost to outermost to handle nesting.
   */
  private processConditionals(template: string, variables: PromptVariables): string {
    // Match innermost conditionals first (those without nested {{#if}} inside)
    const innerIfRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;

    // Keep processing until no more conditionals are found (handles nesting)
    let result = template;
    let previousResult = '';

    while (result !== previousResult) {
      previousResult = result;
      result = result.replace(innerIfRegex, (_match, key: string, content: string) => {
        const rawValue = this.getRawVariableValue(key, variables);
        // Check truthiness of raw value, not stringified
        if (rawValue !== undefined && rawValue !== null && rawValue !== false && rawValue !== '') {
          return content;
        }
        return '';
      });
    }

    return result;
  }

  /**
   * Get raw variable value for conditional checks.
   */
  private getRawVariableValue(key: string, variables: PromptVariables): unknown {
    const parts = key.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Process {{#each array}}...{{/each}} loops.
   */
  private processLoops(template: string, variables: PromptVariables): string {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (_match, key: string, content: string) => {
      const value = this.getVariableValue(key, variables);
      const arrayValue = (variables as Record<string, unknown>)[key];
      
      if (Array.isArray(arrayValue)) {
        return arrayValue
          .map((item, index) => {
            let itemContent = content;
            // Replace {{this}} with the item (for primitive arrays)
            if (typeof item !== 'object') {
              itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
            }
            // Replace {{@index}} with the index
            itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
            // Replace object properties like {{name}}, {{email}}
            if (typeof item === 'object' && item !== null) {
              Object.entries(item).forEach(([propKey, propValue]) => {
                const propRegex = new RegExp(`\\{\\{${propKey}\\}\\}`, 'g');
                itemContent = itemContent.replace(propRegex, String(propValue));
              });
            }
            return itemContent;
          })
          .join('');
      }
      return '';
    });
  }

  /**
   * Interpolate {{variable}} patterns.
   */
  private interpolateVariables(template: string, variables: PromptVariables): string {
    const varRegex = /\{\{(\w+(?:\.\w+)*)\}\}/g;

    return template.replace(varRegex, (_match, key: string) => {
      const value = this.getVariableValue(key, variables);
      return value ?? '';
    });
  }

  /**
   * Get a variable value, supporting dot notation.
   */
  private getVariableValue(key: string, variables: PromptVariables): string | undefined {
    const parts = key.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      return current.join(', ');
    }

    return String(current);
  }

  /**
   * Clean up any remaining unresolved variables.
   */
  private cleanUnresolved(template: string): string {
    return template.replace(/\{\{[\w.@#/]+\}\}/g, '');
  }

  /**
   * Get the agent configuration for this template.
   */
  getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }
}

/**
 * Create a prompt template for a specific agent.
 */
export function createPromptTemplate(template: string, agentId: AgentId): PromptTemplate {
  return new PromptTemplate(template, agentId);
}
