import { z } from 'zod';

const projectNamePattern = /^[a-z0-9_-]+$/;

export const createProjectSchema = z.object({
  projectName: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(64)
    .regex(projectNamePattern, 'Project name must contain only lowercase letters, numbers, hyphen (-) or underscore (_).'),
  profile: z.enum(['lite', 'full']).default('lite'),
  language: z.enum(['javascript', 'typescript']).default('javascript'),
  database: z.enum(['json', 'postgresql', 'mysql', 'sqlite', 'sqlserver']).default('json'),
  architecture: z.enum(['layered', 'mvc', 'clean']).default('layered'),
  apiStyle: z.enum(['rest', 'graphql', 'hybrid']).default('rest'),
  packageManager: z.enum(['pnpm', 'npm', 'yarn', 'bun']).default('pnpm'),
  featureSet: z.enum(['auth', 'email', 'both', 'none']).default('auth'),
});
