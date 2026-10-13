// Makes build/casper-nas.zip: only what the NAS needs to run Casper.
// Never included: .env (secrets), node_modules, data (contact requests), tests.
// Run with: node scripts/makeNasPackage.js   - then follow docs/synology-nl.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const include = [
    'Dockerfile',
    'docker-compose.yml',
    '.dockerignore',
    '.env.example',
    'package.json',
    'package-lock.json',
    'index.js',
    'config.js',
    'README.md',
    'chat',
    'content',
    'email',
    'public',
    'routes',
    'safety',
    'scripts',
    'shopify',
];

const folder = path.join('build', 'casper');
fs.rmSync('build', { recursive: true, force: true });
fs.mkdirSync(folder, { recursive: true });

for (const name of include) {
    fs.cpSync(name, path.join(folder, name), { recursive: true });
}

// Windows 10/11 has its own tar, which can also make zip files (Git Bash has another tar that cannot)
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const zip = path.join('build', 'casper-nas.zip');
try {
    execFileSync(tar, ['-a', '-c', '-f', zip, '-C', folder, '.']);
    console.log(`Made ${zip}`);
} catch {
    console.log(`Could not make a zip; copy the folder ${folder} to the NAS instead`);
}
console.log('Not included on purpose: .env (copy it yourself), node_modules, data, test');
