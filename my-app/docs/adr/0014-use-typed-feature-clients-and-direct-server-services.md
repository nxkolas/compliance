# Use typed feature clients and direct server services

Client Components will access HTTP through feature-specific typed client services rather than raw `fetch`. Route handlers authenticate and validate before delegating to server domain services, while Server Components and trusted server code call those services directly instead of making self-HTTP requests; shared Zod contracts define request and serialized response shapes, and Server Actions will not form a competing mutation layer.
