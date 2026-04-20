export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'StackForge API',
    version: '1.0.0',
    description: 'StackForge SaaS authentication API with register, login, session, refresh token and logout.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'email', 'createdAt'],
      },
      RegisterRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          confirmPassword: { type: 'string' },
        },
        required: ['name', 'email', 'password', 'confirmPassword'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          csrfToken: { type: 'string' },
        },
        required: ['user', 'accessToken', 'csrfToken'],
      },
      MeResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['user'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  provider: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['ok', 'provider'],
              },
            },
            required: ['database'],
          },
        },
        required: ['status', 'checks'],
      },
    },
  },
  paths: {
    '/health/liveness': {
      get: {
        summary: 'Liveness health check',
        responses: {
          200: {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                  },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
    '/health/readiness': {
      get: {
        summary: 'Readiness health check',
        responses: {
          200: {
            description: 'Dependencies are ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          503: {
            description: 'Dependencies are not ready',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          409: {
            description: 'Email already in use',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          429: {
            description: 'Too many failed login attempts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/verify-email': {
      get: {
        summary: 'Verify account email using token',
        parameters: [
          {
            in: 'query',
            name: 'token',
            required: true,
            schema: { type: 'string' },
            description: 'Email verification token',
          },
        ],
        responses: {
          200: {
            description: 'Email verified successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                  required: ['message', 'user'],
                },
              },
            },
          },
          400: {
            description: 'Invalid or expired verification token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Authenticated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MeResponse' },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        summary: 'Refresh access token',
        parameters: [
          {
            in: 'header',
            name: 'x-csrf-token',
            required: true,
            schema: { type: 'string' },
            description: 'CSRF token returned by register/login/refresh',
          },
        ],
        responses: {
          200: {
            description: 'Refreshed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Invalid refresh token or session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'CSRF token invalid or missing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout current session',
        parameters: [
          {
            in: 'header',
            name: 'x-csrf-token',
            required: true,
            schema: { type: 'string' },
            description: 'CSRF token returned by register/login/refresh',
          },
        ],
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                  required: ['message'],
                },
              },
            },
          },
          401: {
            description: 'Invalid session',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'CSRF token invalid or missing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/email/send': {
      post: {
        summary: 'Send an email using configured SMTP provider',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  to: { type: 'string', format: 'email' },
                  subject: { type: 'string' },
                  text: { type: 'string' },
                  html: { type: 'string' },
                },
                required: ['to', 'subject', 'text'],
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Email queued for delivery',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    delivery: {
                      type: 'object',
                      properties: {
                        messageId: { type: 'string' },
                        accepted: { type: 'array', items: { type: 'string' } },
                        rejected: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                  required: ['message', 'delivery'],
                },
              },
            },
          },
          400: {
            description: 'Email provider disabled or invalid payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'SMTP configuration or transport error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/scaffold/projects/downloads': {
      delete: {
        summary: 'Remove all generated scaffold downloads',
        responses: {
          200: {
            description: 'Downloads cleaned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    deletedCount: { type: 'integer' },
                  },
                  required: ['message', 'deletedCount'],
                },
              },
            },
          },
        },
      },
    },
  },
};
