#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('Error: Please set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const owner = process.argv[2];
const repo = process.argv[3];
const localRoot = process.argv[4] || process.cwd();
const branch = process.argv.includes('--branch') ? process.argv[process.argv.indexOf('--branch') + 1] : 'main';
const isPrivate = process.argv.includes('--private');

if (!owner || !repo) {
  console.error('Usage: node upload-to-github.js <owner> <repo> [localPath] [--private] [--branch <branch>]');
  process.exit(1);
}

const API = 'https://api.github.com';

async function request(url, opts = {}) {
  opts.headers = Object.assign({
    'Authorization': `token ${token}`,
    'User-Agent': 'upload-script',
    'Accept': 'application/vnd.github.v3+json'
  }, opts.headers || {});
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText} - ${url}`);
    err.response = body;
    throw err;
  }
  return body;
}

async function createRepoIfNeeded() {
  try {
    console.log(`Creating repo ${owner}/${repo} ...`);
    return await request(`${API}/user/repos`, {
      method: 'POST',
      body: JSON.stringify({ name: repo, private: isPrivate })
    });
  } catch (err) {
    if (err.response && err.response.message && err.response.message.includes('name already exists')) {
      console.log('Repository already exists, will upload to it.');
      return null;
    }
    throw err;
  }
}

async function walk(dir, base) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\\\/g, '/');

    // Exclude patterns
    if (rel.split('/').some(p => ['.git', 'node_modules', 'dist', 'build'].includes(p))) continue;
    if (entry.isDirectory()) {
      files.push(...await walk(full, base));
    } else if (entry.isFile()) {
      if (['.DS_Store'].includes(entry.name)) continue;
      files.push({ full, rel });
    }
  }
  return files;
}

function encodePathForApi(relPath) {
  return relPath.split('/').map(encodeURIComponent).join('/');
}

async function getFileSha(relPath) {
  const url = `${API}/repos/${owner}/${repo}/contents/${encodePathForApi(relPath)}?ref=${branch}`;
  try {
    const res = await request(url, { method: 'GET' });
    return res.sha;
  } catch (e) {
    return null;
  }
}

async function uploadFile(file) {
  const content = await fs.readFile(file.full);
  const b64 = content.toString('base64');
  const apiPath = encodePathForApi(file.rel);
  const url = `${API}/repos/${owner}/${repo}/contents/${apiPath}`;
  const sha = await getFileSha(file.rel);
  const body = {
    message: `Add ${file.rel}`,
    content: b64,
    branch
  };
  if (sha) body.sha = sha;
  try {
    await request(url, { method: 'PUT', body: JSON.stringify(body) });
    console.log(`Uploaded: ${file.rel}`);
    return { ok: true };
  } catch (e) {
    console.error(`Failed: ${file.rel}`, e.response || e.message);
    return { ok: false, err: e };
  }
}

(async () => {
  try {
    await createRepoIfNeeded();
    const files = await walk(localRoot, localRoot);
    console.log(`Found ${files.length} files to upload (excluding .git/node_modules/dist/build).`);

    // Upload sequentially to be kind to rate limits; change to parallel if desired
    const results = [];
    for (const f of files) {
      /* Skip uploading the script itself if it's in the tree */
      if (f.rel.startsWith('scripts/upload-to-github.js')) continue;
      const r = await uploadFile(f);
      results.push(r);
    }

    const success = results.filter(r => r.ok).length;
    console.log(`Upload complete. ${success}/${results.length} succeeded.`);
  } catch (err) {
    console.error('Fatal error:', err.response || err.message || err);
    process.exit(2);
  }
})();
