import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, '..', 'js', 'config.js');

const enabled = process.env.SUPABASE_ENABLED !== 'false';
const url = process.env.SUPABASE_URL || 'https://fwojenywqseitzpujmvt.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_DXs7HlbzWdrxztb0nPS3kQ_4MAlFk7j';

const contents = `// Generated at build time — do not edit on Vercel.
export const SUPABASE_ENABLED = ${enabled};
export const SUPABASE_URL = '${url.replace(/'/g, "\\'")}';
export const SUPABASE_ANON_KEY = '${key.replace(/'/g, "\\'")}';
`;

writeFileSync(out, contents, 'utf8');
console.log('Wrote js/config.js for deploy (Supabase enabled:', enabled, ')');
