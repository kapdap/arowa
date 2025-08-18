# Contributing Guidelines

This document provides guidelines and instructions for developing and contributing to the AroWā application.

## Philosophy

AroWā is designed to be lightweight and permissionless, featuring a clean and simple user interface that allows teams to easily synchronize their work and break intervals. It does not require any complex setup, user authentication, or database management. The goal is to make it as frictionless as possible, with minimal barriers to entry.

## Technology

AroWā is built using the following tech stack:

- **Frontend**: Vanilla JavaScript, HTML, CSS, JSON
- **Backend**: TypeScript, Node.js, Express.js, WebSocket
- **Testing**: Jest, Playwright

### Server

AroWā server is responsible for managing real-time communication between clients, relaying session data, calculating timer state, and exposing endpoints for session management.

- Uses WebSockets for real-time updates
- Calculates timer state when requested by clients
- Does not require a database or user authentication
- Holds session data in memory for a configurable period after the last client disconnects

## Development

To set up the development environment for AroWā, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/kapdap/arowa.git
cd arowa
```

2. Install the dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The development server will be available at http://localhost:3000.

## Building

1. To build the application, run:

```bash
npm run build
```

This will compile the TypeScript code and bundle the public assets for production use in the `dist` directory.

2. To start the production server, run:

```bash
npm start
```

The production server will be available at http://localhost:3000.

## Testing

To run the unit tests with Jest, use the following command:

```bash
npm test
```

To run the end-to-end tests with Playwright, use the following command:

```bash
npx playwright test
```

End-to-end tests will run against the application running on http://localhost:3000, so ensure the server is running before executing the tests.

_TODO: Start a new server instance for Playwright tests to avoid conflicts with the development server._

## Libraries

### Frontend

- **[jshashes](https://github.com/h2non/jshashes)**: Hashing and checksum functions - using sha256 for gravatar email hashing
- **[NoSleep.js](https://github.com/richtr/NoSleep.js/)**: Prevents mobile devices from going to sleep
- **[qr-creator](https://github.com/nimiq/qr-creator)**: Generates QR code in session sharing panel

## Generative AI

You are welcome to use Generative AI tools to assist with the development of AroWā; however, you are expected to have a complete understanding of all code that you contribute to the project, as well as the tools used to generate it.

Keep in mind that code created by Generative AI can often be verbose, introduce unnecessary complexity, or reference non-existent code or libraries ("hallucinations"). Other potential issues may arise as well, so it is your responsibility to thoroughly review, test, and refactor any AI-generated code you contribute to ensure it is fully functional, aligns with project standards, and adheres to all licensing requirements.

## Application Name

AroWā (ah-r\*-au-waah, with rolling 'r') (IPA: /ˈɑɾɔwɑː/) is the combination of two words from the Māori language: "[aro](https://maoridictionary.co.nz/search?keywords=aro)" meaning "to focus" or "pay attention" and "[wā](https://maoridictionary.co.nz/search?keywords=wā)" meaning "time". AroWā literally translates to "FocusTime".

In official documentation please use upper case **W** and the lowercase **ā** character with a macron when referring to the application name (e.g., Aro**Wā**). For details on the macron character, see ['LATIN SMALL LETTER A WITH MACRON'](https://www.compart.com/en/unicode/U+0101).

Note: The single word "[arowā](https://www2.nzqa.govt.nz/assets/NCEA/Subject-pages/Earth-and-Space-Science/Subject-page/NZQA-Science-Technology-terms-Maori-to-English.pdf)" in Māori refers to "understood", "comprehended" or "definitive".

## License

All contributions to AroWā are governed by the [GPL-3.0 license](LICENSE). By contributing, you agree to license your contributions under the same terms.
