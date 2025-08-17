---
applyTo: '**/*.{ts,js}'
---

# JavaScript Guidelines

JavaScript and TypeScript specific guidelines for coding agents to follow.

## Coding

- ALWAYS use ES6+ syntax for JavaScript and TypeScript.
- ALWAYS use ES module import/export syntax consistently.
- ALWAYS use template literals for string interpolation.
- ALWAYS use arrow functions for concise function expressions.
- ALWAYS use const and let for variable declarations.
- NEVER use var for variable declarations.
- ALWAYS use strict equality (===) for comparisons.
- ALWAYS use async/await for asynchronous operations.
- ALWAYS use try/catch blocks to handle errors in asynchronous operations.
- ALWAYS organize code into modules or files by feature or responsibility.
- ALWAYS document all functions and classes with JSDoc.
- ALWAYS include full parameter and return types in JSDoc documentation.
- ALWAYS keep comments to a minimum.
- NEVER add unnecessary comments.

# Linting

- DO NOT add eslint-disable-next-line comments UNLESS EXPLICITLY ASKED TO DO SO.
- DO NOT add comments to disable lint errors UNLESS EXPLICITLY ASKED TO DO SO.
- DO NOT add comments to ignore lint errors UNLESS EXPLICITLY ASKED TO DO SO.

## Examples

### Function Documentation

JSDoc examples. These ONLY apply to JavaScript files. TypeScript files use TypeDoc; see the `typescript.instructions.md` for more details.

#### Returns a value

ALWAYS describe the return value in the function documentation.

```javascript
/**
 * Calculate tax.
 * @param {number} amount - Total amount.
 * @param {number} tax - Tax percentage.
 * @returns {string} - Total with a dollar sign.
 */
const calculateTax = (amount, tax) => {
  return `$${amount + tax * amount}`;
};
```

#### Void Functions

ALWAYS omit the return parameter in the documentation for void functions.

```javascript
/**
 * Prints a string to the console.
 * @param x the string to print.
 */
function print(x: string): void {
  console.log(x);
}

/**
 * Prints 'Hello World!' to the console.
 */
function hello(): void {
  console.log('Hello World!');
}
```
