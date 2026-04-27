import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, basename, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_DIR = resolve(__dirname, '../src/content/docs');
const OUTPUT_FILE = resolve(__dirname, '../src/search-index.json');

async function getDocs() {
  const files = [];

  async function scan(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Directory not found: ${dir}`);
        return;
      }
      throw err;
    }
  }

  await scan(DOCS_DIR);

  const docs = await Promise.all(files.map(async (file) => {
    const content = await readFile(file, 'utf-8');

    // Extract frontmatter block (first block between ---)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';

    // Parse title
    const titleMatch = frontmatter.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|([^\n]*))/m);
    let title = titleMatch ? (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '') : '';
    title = title.trim();
    if (!title) {
        title = basename(file, extname(file));
    }

    // Check for explicit slug in frontmatter
    const slugMatch = frontmatter.match(/^slug:\s*(?:"([^"]*)"|'([^']*)'|([^\n]*))/m);
    let slug = null;
    if (slugMatch) {
       slug = slugMatch[1] ?? slugMatch[2] ?? slugMatch[3] ?? '';
       slug = slug.trim();
       // Normalize leading/trailing slashes
       if (slug.startsWith('/')) slug = slug.slice(1);
       if (slug.endsWith('/')) slug = slug.slice(0, -1);
    } else {
        // Generate slug from filepath
        let relPath = relative(DOCS_DIR, file);

        // Normalize Windows paths to forward slashes
        if (sep === '\\') {
          relPath = relPath.split(sep).join('/');
        }

        slug = relPath.replace(/\.(md|mdx)$/, '');

        if (slug === 'index') {
          slug = '';
        } else if (slug.endsWith('/index')) {
          slug = slug.slice(0, -6);
        }
    }

    return { title, slug };
  }));

  // Sort for deterministic output
  docs.sort((a, b) => a.slug.localeCompare(b.slug));

  return docs;
}

async function main() {
  console.log('Generating search index...');
  try {
    const docs = await getDocs();
    await writeFile(OUTPUT_FILE, JSON.stringify(docs, null, 2));
    console.log(`Successfully generated search index with ${docs.length} documents at ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Failed to generate search index:', err);
    process.exit(1);
  }
}

main();
