// scripts/build.ts
import { mkdir, readFile, writeFile, cp, rm } from 'fs/promises';
import { existsSync, createReadStream, statSync } from 'fs';
import { dirname } from 'path';
import { spawn } from 'child_process';

async function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

async function concatFiles(files: string[], outFile: string) {
  let data = '';
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`File not found: ${file}`);
    data += await new Promise<string>((resolve, reject) => {
      let buf = '';
      createReadStream(file, { encoding: 'utf8' })
        .on('data', (chunk) => (buf += chunk))
        .on('end', () => resolve(buf))
        .on('error', reject);
    });
    data += '\n';
  }
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, data, 'utf8');
}

async function rewriteIndex(src: string, dest: string) {
  let html = await readFile(src, 'utf8');

  // Remove all <script src="js/libs/..."></script> lines and save the src paths
  const libs: string[] = [];
  html = html.replace(/[ \t]*<script\s+src="(js\/libs\/[^"]+)"\s*><\/script>\s*\n?/g, (_, src) => {
    libs.push(`src/public/${src}`);
    return '';
  });

  // Insert libs.min.js before the app.min.js script
  html = html.replace(
    /(<script\s+type="module"\s+src="js\/app\.js"><\/script>)/,
    `    <script src="js/libs.min.js"></script>
    <script src="js/app.min.js"></script>`
  );

  await writeFile(dest, html, 'utf8');

  return libs;
}

async function main() {
  // Remove dist after build
  await rm('dist', { recursive: true, force: true });

  // Ensure dist directories exist
  await mkdir('dist/public/js', { recursive: true });
  await mkdir('dist/public/css', { recursive: true });

  // Copy static files
  //await copyFile('public/favicon.ico', 'dist/public/favicon.ico');

  // Replace library script tags in index.html with libs.min.js and copy to dist
  const libs = await rewriteIndex('src/public/index.html', 'dist/public/index.html');

  // Concatenate already-minified JS libraries into libs.min.js
  await concatFiles(libs, 'dist/public/js/libs.min.js');

  try {
    // Copy shared JS files for client imports
    // A workaround to handle shared files that are served from /js/shared
    await mkdir('src/public/js/shared', { recursive: true });
    await cp('src/shared', 'src/public/js/shared', {
      recursive: true,
      force: true,
      filter: (src: string) => {
        const stats = statSync(src);
        if (stats.isDirectory()) return true;
        return src.endsWith('.js');
      },
    });

    // Bundle and minify app JS (excluding libs)
    await run('esbuild', ['src/public/js/app.js', '--bundle', '--minify', '--outfile=dist/public/js/app.min.js']);
  } catch (err) {
    console.log('Failed to remove shared files', err);
    return;
  } finally {
    // Clean up shared files
    await rm('src/public/js/shared', { recursive: true, force: true });
  }

  // Minify CSS
  await run('esbuild', ['src/public/css/styles.css', '--bundle', '--minify', '--outfile=dist/public/css/styles.css']);

  // Compile server TypeScript
  await run('npx', ['tsc', '--project', 'tsconfig.server.json']);

  // Copy shared JS files for server imports
  await mkdir('src/public/js/shared', { recursive: true });
  await cp('src/shared', 'dist/shared', {
    recursive: true,
    force: true,
    filter: (src: string) => {
      const stats = statSync(src);
      if (stats.isDirectory()) return true;
      return src.endsWith('.js');
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
