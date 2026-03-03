/**
 * Response parser for extracting structured data from LLM outputs.
 * Supports XML and JSON extraction with Zod validation.
 */

import { z, ZodSchema } from 'zod';
import { Result, ok, err } from '@promptdeploy/shared-utils';
import type { ParsedResponse } from './types';

export type ParseFormat = 'xml' | 'json' | 'markdown';

export interface ParseOptions<T> {
  /** The format to parse from */
  format: ParseFormat;
  /** Zod schema to validate the parsed data */
  schema: ZodSchema<T>;
  /** XML tag name to extract (for XML format) */
  rootTag?: string;
  /** JSON key to extract (for JSON format wrapped in markdown) */
  jsonKey?: string;
}

export interface ParseError {
  type: 'extraction' | 'parse' | 'validation';
  message: string;
  rawContent?: string;
  details?: unknown;
}

/**
 * ResponseParser extracts and validates structured data from LLM responses.
 */
export class ResponseParser {
  /**
   * Parse LLM response content into a validated typed object.
   */
  parse<T>(content: string, options: ParseOptions<T>): Result<ParsedResponse<T>, ParseError> {
    const { format, schema, rootTag, jsonKey } = options;

    // Step 1: Extract raw content based on format
    let extracted: string;

    switch (format) {
      case 'xml':
        const xmlResult = this.extractXml(content, rootTag);
        if (!xmlResult.ok) return err(xmlResult.error);
        extracted = xmlResult.value;
        break;

      case 'json':
        const jsonResult = this.extractJson(content, jsonKey);
        if (!jsonResult.ok) return err(jsonResult.error);
        extracted = jsonResult.value;
        break;

      case 'markdown':
        const mdResult = this.extractCodeBlock(content);
        if (!mdResult.ok) return err(mdResult.error);
        extracted = mdResult.value;
        break;

      default:
        return err({
          type: 'extraction',
          message: `Unsupported format: ${format}`,
        });
    }

    // Step 2: Parse the extracted content
    let parsed: unknown;

    if (format === 'xml') {
      const parseResult = this.parseXmlToObject(extracted);
      if (!parseResult.ok) return err(parseResult.error);
      parsed = parseResult.value;
    } else {
      try {
        parsed = JSON.parse(extracted);
      } catch (e) {
        return err({
          type: 'parse',
          message: `Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
          rawContent: extracted,
        });
      }
    }

    // Step 3: Validate against schema
    const validationResult = schema.safeParse(parsed);

    if (!validationResult.success) {
      return err({
        type: 'validation',
        message: 'Schema validation failed',
        details: validationResult.error.format(),
        rawContent: extracted,
      });
    }

    return ok({
      data: validationResult.data,
      raw: content,
      parsedAt: new Date().toISOString(),
    });
  }

  /**
   * Extract content from an XML tag.
   */
  extractXml(content: string, tagName?: string): Result<string, ParseError> {
    if (!tagName) {
      // Try to find any root XML tag
      const rootMatch = content.match(/<(\w+)[\s>]/);
      if (!rootMatch) {
        return err({
          type: 'extraction',
          message: 'No XML tag found in content',
          rawContent: content,
        });
      }
      tagName = rootMatch[1];
    }

    // Match the tag with its content (handle nested tags and CDATA)
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = content.match(regex);

    if (!match) {
      return err({
        type: 'extraction',
        message: `XML tag <${tagName}> not found`,
        rawContent: content,
      });
    }

    return ok(match[0]); // Return full XML including tags
  }

  /**
   * Extract JSON from content (handles markdown code blocks).
   */
  extractJson(content: string, key?: string): Result<string, ParseError> {
    // Try to find JSON in code blocks first
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return ok(codeBlockMatch[1].trim());
    }

    // Try to find JSON object or array directly
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      // If a key is specified, extract just that key's value
      if (key) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed[key] !== undefined) {
            return ok(JSON.stringify(parsed[key]));
          }
        } catch {
          // Fall through to return the full match
        }
      }
      return ok(jsonMatch[1]);
    }

    return err({
      type: 'extraction',
      message: 'No JSON found in content',
      rawContent: content,
    });
  }

  /**
   * Extract content from markdown code blocks.
   */
  extractCodeBlock(content: string, language?: string): Result<string, ParseError> {
    const langPattern = language ? language : '\\w*';
    const regex = new RegExp(`\`\`\`${langPattern}\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = content.match(regex);

    if (!match) {
      return err({
        type: 'extraction',
        message: 'No code block found',
        rawContent: content,
      });
    }

    return ok(match[1].trim());
  }

  /**
   * Parse XML string to a JavaScript object.
   * Simple recursive parser for LLM-generated XML.
   */
  parseXmlToObject(xml: string): Result<Record<string, unknown>, ParseError> {
    try {
      // Remove XML declaration if present
      const cleanXml = xml.replace(/<\?xml[^>]*\?>/gi, '').trim();

      // Parse the XML into an object
      const result = this.parseXmlNode(cleanXml);
      return ok(result);
    } catch (e) {
      return err({
        type: 'parse',
        message: `XML parse error: ${e instanceof Error ? e.message : 'Unknown error'}`,
        rawContent: xml,
      });
    }
  }

  /**
   * Parse a single XML node recursively.
   */
  private parseXmlNode(xml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Match top-level tags
    const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>|<(\w+)([^>]*)\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(xml)) !== null) {
      const tagName = match[1] || match[4];
      const attributes = match[2] || match[5] || '';
      const content = match[3] || '';

      // Check if content has child elements
      const hasChildTags = /<\w+[^>]*>/.test(content);

      let value: unknown;

      if (match[4]) {
        // Self-closing tag
        value = this.parseAttributes(attributes) || true;
      } else if (hasChildTags) {
        // Has child elements - recurse
        value = this.parseXmlNode(content);
        // Merge in attributes
        const attrs = this.parseAttributes(attributes);
        if (attrs) {
          value = { ...attrs, ...(value as object) };
        }
      } else {
        // Text content (possibly with CDATA)
        const textContent = this.extractTextContent(content);
        const attrs = this.parseAttributes(attributes);

        if (attrs) {
          value = { ...attrs, _text: textContent };
        } else {
          value = textContent;
        }
      }

      // Handle duplicate tags (convert to array)
      if (result[tagName] !== undefined) {
        if (Array.isArray(result[tagName])) {
          (result[tagName] as unknown[]).push(value);
        } else {
          result[tagName] = [result[tagName], value];
        }
      } else {
        result[tagName] = value;
      }
    }

    return result;
  }

  /**
   * Parse XML attributes into an object.
   */
  private parseAttributes(attrString: string): Record<string, string> | null {
    if (!attrString.trim()) return null;

    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(attrString)) !== null) {
      attrs[`@${match[1]}`] = match[2];
    }

    return Object.keys(attrs).length > 0 ? attrs : null;
  }

  /**
   * Extract text content, handling CDATA sections.
   */
  private extractTextContent(content: string): string {
    // Handle CDATA
    const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataMatch) {
      return cdataMatch[1];
    }

    // Trim and return text
    return content.trim();
  }

  /**
   * Extract multiple file blocks from LLM response.
   * Used for code generation agents that output multiple files.
   */
  extractFiles(content: string): Result<Array<{ path: string; content: string }>, ParseError> {
    const files: Array<{ path: string; content: string }> = [];

    // Match <file path="...">...<![CDATA[...]]>...</file>
    const fileRegex = /<file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi;
    let match: RegExpExecArray | null;

    while ((match = fileRegex.exec(content)) !== null) {
      const filePath = match[1];
      let fileContent = match[2].trim();

      // Extract from CDATA if present
      const cdataMatch = fileContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdataMatch) {
        fileContent = cdataMatch[1];
      }

      files.push({
        path: filePath,
        content: fileContent,
      });
    }

    if (files.length === 0) {
      return err({
        type: 'extraction',
        message: 'No file blocks found in content',
        rawContent: content,
      });
    }

    return ok(files);
  }

  /**
   * Extract test results from QA agent response.
   */
  extractQaReport(content: string): Result<{
    summary: 'PASS' | 'FAIL';
    typescriptCheck: { status: string; errors?: string };
    eslintCheck: { status: string; errors?: string };
    testResults: { status: string; coverage: string; failingTests?: string };
    specCompliance: { score: string; missingRequirements?: string };
    recommendations?: string;
  }, ParseError> {
    const xmlResult = this.extractXml(content, 'qa_report');
    if (!xmlResult.ok) return err(xmlResult.error);

    const parseResult = this.parseXmlToObject(xmlResult.value);
    if (!parseResult.ok) return err(parseResult.error);

    const report = parseResult.value['qa_report'] as Record<string, unknown>;
    if (!report) {
      return err({
        type: 'extraction',
        message: 'qa_report element not found',
        rawContent: content,
      });
    }

    return ok({
      summary: (report['summary'] as string)?.toUpperCase() === 'PASS' ? 'PASS' : 'FAIL',
      typescriptCheck: this.normalizeCheck(report['typescript_check']),
      eslintCheck: this.normalizeCheck(report['eslint_check']),
      testResults: this.normalizeTestResults(report['test_results']),
      specCompliance: this.normalizeSpecCompliance(report['spec_compliance']),
      recommendations: report['recommendations'] as string | undefined,
    });
  }

  private normalizeCheck(check: unknown): { status: string; errors?: string } {
    if (typeof check === 'string') {
      return { status: check };
    }
    if (typeof check === 'object' && check !== null) {
      const obj = check as Record<string, unknown>;
      return {
        status: obj['status'] as string || 'UNKNOWN',
        errors: obj['errors'] as string | undefined,
      };
    }
    return { status: 'UNKNOWN' };
  }

  private normalizeTestResults(results: unknown): { status: string; coverage: string; failingTests?: string } {
    if (typeof results === 'object' && results !== null) {
      const obj = results as Record<string, unknown>;
      return {
        status: obj['status'] as string || 'UNKNOWN',
        coverage: obj['coverage'] as string || '0%',
        failingTests: obj['failing_tests'] as string | undefined,
      };
    }
    return { status: 'UNKNOWN', coverage: '0%' };
  }

  private normalizeSpecCompliance(compliance: unknown): { score: string; missingRequirements?: string } {
    if (typeof compliance === 'object' && compliance !== null) {
      const obj = compliance as Record<string, unknown>;
      return {
        score: obj['score'] as string || '0%',
        missingRequirements: obj['missing_requirements'] as string | undefined,
      };
    }
    return { score: '0%' };
  }

  /**
   * Extract security report from security reviewer response.
   */
  extractSecurityReport(content: string): Result<{
    summary: 'PASS' | 'FAIL';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    findings: Array<{
      severity: string;
      title: string;
      location: string;
      description: string;
      remediation: string;
    }>;
    recommendations?: string;
  }, ParseError> {
    const xmlResult = this.extractXml(content, 'security_report');
    if (!xmlResult.ok) return err(xmlResult.error);

    const parseResult = this.parseXmlToObject(xmlResult.value);
    if (!parseResult.ok) return err(parseResult.error);

    const report = parseResult.value['security_report'] as Record<string, unknown>;
    if (!report) {
      return err({
        type: 'extraction',
        message: 'security_report element not found',
        rawContent: content,
      });
    }

    // Extract findings
    const findingsData = (report['findings'] as Record<string, unknown>)?.['finding'];
    let findings: Array<{
      severity: string;
      title: string;
      location: string;
      description: string;
      remediation: string;
    }> = [];

    if (findingsData) {
      const findingsArray = Array.isArray(findingsData) ? findingsData : [findingsData];
      findings = findingsArray.map((f: unknown) => {
        const finding = f as Record<string, unknown>;
        return {
          severity: (finding['@severity'] as string) || 'MEDIUM',
          title: (finding['title'] as string) || '',
          location: (finding['location'] as string) || '',
          description: (finding['description'] as string) || '',
          remediation: (finding['remediation'] as string) || '',
        };
      });
    }

    const riskLevel = (report['risk_level'] as string)?.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    return ok({
      summary: (report['summary'] as string)?.toUpperCase() === 'PASS' ? 'PASS' : 'FAIL',
      riskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel) ? riskLevel : 'MEDIUM',
      findings,
      recommendations: report['recommendations'] as string | undefined,
    });
  }
}

/**
 * Create a pre-configured parser instance.
 */
export const responseParser = new ResponseParser();
