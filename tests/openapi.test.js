import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/docs/openapi.js';

describe('openapi document', () => {
  it('documents scaffold download cleanup route', () => {
    expect(openApiDocument.paths['/api/scaffold/projects/downloads']).toBeDefined();
    expect(openApiDocument.paths['/api/scaffold/projects/downloads'].delete).toBeDefined();
  });
});