import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility to recursively walk a directory and apply string replacements.
 */
export async function replaceInFiles(
  dir: string,
  search: string | RegExp,
  replacement: string,
  extensions: string[] = ['.ts', '.tsx', '.json', '.html', '.css']
) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.local') {
        await replaceInFiles(fullPath, search, replacement, extensions);
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const newContent = content.replace(search, replacement);
        if (content !== newContent) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          console.log(`Updated: ${fullPath}`);
        }
      }
    }
  }
}
