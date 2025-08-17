---
applyTo: '*.ts'
---

# TypeScript Guidelines

TypeScript specific guidelines for coding agents to follow.

## Coding

- ALWAYS use EXPLICIT types for all variables, parameters, return values, and class properties.
- ALWAYS use the most specific and descriptive type possible.
- NEVER use ANY, UNKNOWN, OBJECT, or UNDEFINED types unless absolutely necessary.
- ALWAYS inform the user if you need to use ANY, UNKNOWN, OBJECT, or UNDEFINED types, so they can evaluate and approve the request.
- ALWAYS provide clear rationale to the user when a non-specific type must be used.

# Linting

- DO NOT add eslint-disable-next-line comments UNLESS EXPLICTLY ASKED TO DO SO.
- DO NOT add comments to disable lint errors UNLESS EXPLICTLY ASKED TO DO SO.
- DO NOT add comments to ignore lint errors UNLESS EXPLICTLY ASKED TO DO SO.

## Migration

When migrating JavaScript code to TypeScript, the following guidelines MUST be followed:

- DO NOT omit any code from the original file when converting to TypeScript.
- ENSURE ALL code from the original file is migrated to the new TypeScript file.
- ENSURE EVERY function and method from the original file is migrated to the new TypeScript file.
- DO NOT omit any code for brevity during the migration process.
- DO NOT omit any code at all from the migration.
- DO NOT change the logic or structure unless explicitly instructed.
- ENSURE all exports are converted to ES module syntax (`export` / `export default`).
- ENSURE all imports use correct and up-to-date module paths and syntax.
- ENSURE all imported modules are compatible with TypeScript.
- ENSURE the migrated file passes linting and compilation checks.
- ALWAYS include any type annotations or interfaces as needed for TypeScript compatibility.
- ALWAYS verify that the migrated code is functionally equivalent to the original.
- WHEN importing existing CommonJS modules into ES modules, use the following syntax:

```typescript
const modules = require('./modules');
const { functions } = modules;
```

## Examples

### Function Documentation

TypeDoc examples. These ONLY apply to TypeScript files. JavaScript files use JSDoc, see the `javascript.instructions.md` for more details.

#### Returns a value

Note the blank line between the description and the `@param` tags.

```typescript
/**
 * Calculates the square root of a number.
 *
 * @param x the number to calculate the root of.
 * @returns the square root if `x` is non-negative or `NaN` if `x` is negative.
 */
export function sqrt(x: number): number {
  return Math.sqrt(x);
}
```

#### Void Functions

Note the lack of return type parameter in the documentation

```typescript
/**
 * Prints a string to the console.
 *
 * @param x the string to print.
 */
export function print(x: string): void {
  console.log(x);
}
```

Note there is no blank line or return type after the description.

```typescript
/**
 * Prints 'Hello World!' to the console.
 */
export function hello(): void {
  console.log('Hello World!');
}
```
