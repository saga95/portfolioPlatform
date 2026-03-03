/**
 * Unit tests for ResponseParser class.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ResponseParser, responseParser } from './response-parser';

describe('ResponseParser', () => {
  const parser = new ResponseParser();

  describe('extractXml', () => {
    it('should extract XML content from a specific tag', () => {
      const content = `
Some text before.
<project_spec>
  <name>Test Project</name>
  <description>A test</description>
</project_spec>
Some text after.
`;
      const result = parser.extractXml(content, 'project_spec');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('<project_spec>');
        expect(result.value).toContain('<name>Test Project</name>');
        expect(result.value).toContain('</project_spec>');
      }
    });

    it('should auto-detect root tag when not specified', () => {
      const content = '<root><child>value</child></root>';
      const result = parser.extractXml(content);

      expect(result.ok).toBe(true);
    });

    it('should return error when tag not found', () => {
      const content = '<other>content</other>';
      const result = parser.extractXml(content, 'missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('extraction');
        expect(result.error.message).toContain('missing');
      }
    });

    it('should handle nested tags with same name', () => {
      const content = '<outer><inner><inner>deep</inner></inner></outer>';
      const result = parser.extractXml(content, 'outer');

      expect(result.ok).toBe(true);
    });
  });

  describe('extractJson', () => {
    it('should extract JSON from markdown code block', () => {
      const content = `
Here is the result:
\`\`\`json
{"name": "test", "value": 42}
\`\`\`
`;
      const result = parser.extractJson(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('{"name": "test", "value": 42}');
      }
    });

    it('should extract JSON without code block wrapper', () => {
      const content = 'The answer is {"key": "value"} as shown.';
      const result = parser.extractJson(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('{"key": "value"}');
      }
    });

    it('should extract JSON array', () => {
      const content = 'Items: [1, 2, 3]';
      const result = parser.extractJson(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('[1, 2, 3]');
      }
    });

    it('should return error when no JSON found', () => {
      const content = 'Just plain text with no JSON.';
      const result = parser.extractJson(content);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('extraction');
      }
    });
  });

  describe('extractCodeBlock', () => {
    it('should extract content from code block', () => {
      const content = `
Here is the code:
\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = parser.extractCodeBlock(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('const x = 1;');
      }
    });

    it('should extract from code block without language', () => {
      const content = '```\ncode here\n```';
      const result = parser.extractCodeBlock(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('code here');
      }
    });

    it('should return error when no code block found', () => {
      const content = 'No code block here.';
      const result = parser.extractCodeBlock(content);

      expect(result.ok).toBe(false);
    });
  });

  describe('parseXmlToObject', () => {
    it('should parse simple XML to object', () => {
      const xml = '<root><name>Test</name><value>42</value></root>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          root: {
            name: 'Test',
            value: '42',
          },
        });
      }
    });

    it('should parse nested XML', () => {
      const xml = '<root><parent><child>value</child></parent></root>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          root: {
            parent: {
              child: 'value',
            },
          },
        });
      }
    });

    it('should parse XML with attributes', () => {
      const xml = '<item type="test" id="123">content</item>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          item: {
            '@type': 'test',
            '@id': '123',
            _text: 'content',
          },
        });
      }
    });

    it('should parse duplicate tags as array', () => {
      const xml = '<root><item>one</item><item>two</item><item>three</item></root>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          root: {
            item: ['one', 'two', 'three'],
          },
        });
      }
    });

    it('should handle CDATA sections', () => {
      const xml = '<code><![CDATA[const x = 1 < 2;]]></code>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          code: 'const x = 1 < 2;',
        });
      }
    });

    it('should handle self-closing tags', () => {
      const xml = '<root><empty/><data>value</data></root>';
      const result = parser.parseXmlToObject(xml);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          root: {
            empty: true,
            data: 'value',
          },
        });
      }
    });
  });

  describe('parse with schema validation', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });

    it('should parse and validate JSON', () => {
      const content = '{"name": "test", "count": 5}';
      const result = parser.parse(content, {
        format: 'json',
        schema,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.data).toEqual({ name: 'test', count: 5 });
        expect(result.value.parsedAt).toBeDefined();
      }
    });

    it('should return validation error for invalid data', () => {
      const content = '{"name": "test", "count": "not a number"}';
      const result = parser.parse(content, {
        format: 'json',
        schema,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation');
      }
    });

    it('should parse and validate XML', () => {
      const xmlSchema = z.object({
        data: z.object({
          name: z.string(),
          value: z.string(),
        }),
      });

      const content = '<data><name>test</name><value>42</value></data>';
      const result = parser.parse(content, {
        format: 'xml',
        schema: xmlSchema,
        rootTag: 'data',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('extractFiles', () => {
    it('should extract multiple file blocks', () => {
      const content = `
<file path="src/index.ts">
<![CDATA[
export const main = () => console.log('Hello');
]]>
</file>

<file path="src/utils.ts">
<![CDATA[
export const add = (a: number, b: number) => a + b;
]]>
</file>
`;
      const result = parser.extractFiles(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].path).toBe('src/index.ts');
        expect(result.value[0].content).toContain('export const main');
        expect(result.value[1].path).toBe('src/utils.ts');
        expect(result.value[1].content).toContain('export const add');
      }
    });

    it('should handle file blocks without CDATA', () => {
      const content = '<file path="README.md">This is readme content</file>';
      const result = parser.extractFiles(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].path).toBe('README.md');
        expect(result.value[0].content).toBe('This is readme content');
      }
    });

    it('should return error when no files found', () => {
      const content = 'No file blocks here.';
      const result = parser.extractFiles(content);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('extraction');
      }
    });
  });

  describe('extractQaReport', () => {
    it('should extract and parse QA report', () => {
      const content = `
<qa_report>
  <summary>PASS</summary>
  <typescript_check>
    <status>PASS</status>
  </typescript_check>
  <eslint_check>
    <status>PASS</status>
  </eslint_check>
  <test_results>
    <status>PASS</status>
    <coverage>85%</coverage>
  </test_results>
  <spec_compliance>
    <score>92%</score>
  </spec_compliance>
  <recommendations>All good!</recommendations>
</qa_report>
`;
      const result = parser.extractQaReport(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.summary).toBe('PASS');
        expect(result.value.typescriptCheck.status).toBe('PASS');
        expect(result.value.testResults.coverage).toBe('85%');
        expect(result.value.specCompliance.score).toBe('92%');
      }
    });

    it('should handle FAIL summary', () => {
      const content = `
<qa_report>
  <summary>FAIL</summary>
  <typescript_check><status>FAIL</status><errors>Type error</errors></typescript_check>
  <eslint_check><status>PASS</status></eslint_check>
  <test_results><status>PASS</status><coverage>80%</coverage></test_results>
  <spec_compliance><score>100%</score></spec_compliance>
</qa_report>
`;
      const result = parser.extractQaReport(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.summary).toBe('FAIL');
        expect(result.value.typescriptCheck.status).toBe('FAIL');
      }
    });
  });

  describe('extractSecurityReport', () => {
    it('should extract and parse security report', () => {
      const content = `
<security_report>
  <summary>PASS</summary>
  <risk_level>LOW</risk_level>
  <findings>
    <finding severity="LOW">
      <title>Minor issue</title>
      <location>src/index.ts:10</location>
      <description>Use strict mode</description>
      <remediation>Add "use strict"</remediation>
    </finding>
  </findings>
  <recommendations>Overall secure.</recommendations>
</security_report>
`;
      const result = parser.extractSecurityReport(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.summary).toBe('PASS');
        expect(result.value.riskLevel).toBe('LOW');
        expect(result.value.findings).toHaveLength(1);
        expect(result.value.findings[0].severity).toBe('LOW');
        expect(result.value.findings[0].title).toBe('Minor issue');
      }
    });

    it('should handle multiple findings', () => {
      const content = `
<security_report>
  <summary>FAIL</summary>
  <risk_level>HIGH</risk_level>
  <findings>
    <finding severity="HIGH">
      <title>SQL Injection</title>
      <location>src/db.ts:25</location>
      <description>Unparameterized query</description>
      <remediation>Use prepared statements</remediation>
    </finding>
    <finding severity="MEDIUM">
      <title>Missing auth</title>
      <location>src/api.ts:10</location>
      <description>No auth check</description>
      <remediation>Add auth middleware</remediation>
    </finding>
  </findings>
</security_report>
`;
      const result = parser.extractSecurityReport(content);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.findings).toHaveLength(2);
        expect(result.value.riskLevel).toBe('HIGH');
      }
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton parser', () => {
      expect(responseParser).toBeInstanceOf(ResponseParser);
    });
  });
});
