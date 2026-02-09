import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCookiesTxt(cookieContent) {
  const lines = cookieContent.split('\n');
  const cookies = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [domain, flag, path, secure, expiration, name, value] = parts;
    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: domain.trim(),
      path: path.trim(),
      expires: parseInt(expiration),
      httpOnly: false,
      secure: secure.toLowerCase() === 'true',
      sameSite: 'Lax'
    });
  }
  return cookies;
}

function parseJSON(cookieContent) {
  try {
    const parsed = JSON.parse(cookieContent);
    if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.value) return parsed;
    const cookies = [];
    for (const cookie of parsed) {
      cookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.tiktok.com',
        path: cookie.path || '/',
        expires: cookie.expirationDate || -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || 'Lax'
      });
    }
    return cookies;
  } catch (e) { return null; }
}

async function convertCookies(inputFile, outputFile) {
  console.log('🍪 Converting TikTok cookies...');
  const cookieContent = fs.readFileSync(inputFile, 'utf-8');
  let cookies = parseJSON(cookieContent);
  if (!cookies) cookies = parseCookiesTxt(cookieContent);

  if (!cookies || cookies.length === 0) {
    console.error('❌ Error: No cookies found!');
    process.exit(1);
  }

  const tiktokCookies = cookies.filter(c => c.domain.includes('tiktok.com'));
  if (tiktokCookies.length === 0) {
    console.error('❌ Error: No TikTok cookies found!');
    process.exit(1);
  }

  fs.writeFileSync(outputFile, JSON.stringify(tiktokCookies, null, 2));
  console.log(`✅ Saved to: ${outputFile}`);
}

const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1] || path.join(__dirname, '..', 'data', 'tiktok-session.json');

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: File not found: ${inputFile}`);
  process.exit(1);
}

convertCookies(inputFile, outputFile);
