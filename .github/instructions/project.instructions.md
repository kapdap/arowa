---
applyTo: '**'
---

# Project Guidelines

Agent guidelines for the AroWā project.

## Coding

- DO NOT create any migration code when refactoring.
- Use camelCase for variables and functions names.

## Technology Stack

- Frontend: HTML, CSS, JavaScript (ES6+)
- Backend: TypeScript, Node.js, Express, WebSocket
- DO NOT use any client third-party libraries or frameworks (e.g., React, Vue, Angular)

## Planning

- Output detailed plans before implementing any code.
- If the user explicitly asks you to create a plan document, write the plan to a markdown file in the `docs/plans` directory.

## Building and Testing

LLM agents should use the following CLI commands to manage the application:

- `npm run dev`: Start the development server.
- `npm run build`: Build the application for production.
- `npm start`: Start the production server.
- `npm test`: Run tests.
- `npx playwright test`: Run end-to-end tests.

Always change to the root directory of the project before executing these commands.

- DO NOT AUTOMATICALLY RUN THESE COMMANDS.
- YOU MAY RUN THESE COMMANDS ON REQUEST.

## Server Management

- Assume an instance of the server is always running!
- DO NOT try to start the server unless explicitly asked to do so!
- DO NOT run test commands unless explicitly asked to do so!
