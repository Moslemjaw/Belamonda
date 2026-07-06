import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const dir = 'c:\\Users\\omen\\Desktop\\Belamonda-main\\client\\src';
const files = walk(dir);

let modifiedCount = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  // new Date(X).toLocaleString(...) -> fmtDateTime(X)
  content = content.replace(/new\s+Date\(([^)]+)\)\.toLocaleString\([^)]*\)/g, 'fmtDateTime($1)');
  
  // new Date().toLocaleString(...) -> fmtDateTime(new Date())
  content = content.replace(/new\s+Date\(\)\.toLocaleString\([^)]*\)/g, 'fmtDateTime(new Date())');
  
  // new Date(X).toLocaleDateString(...) -> fmtDate(X)
  content = content.replace(/new\s+Date\(([^)]+)\)\.toLocaleDateString\([^)]*\)/g, 'fmtDate($1)');
  
  // new Date().toLocaleDateString(...) -> fmtDate(new Date())
  content = content.replace(/new\s+Date\(\)\.toLocaleDateString\([^)]*\)/g, 'fmtDate(new Date())');

  if (content !== original) {
    const depth = f.replace(dir, '').split(path.sep).length - 2;
    const prefix = depth > 0 ? '../'.repeat(depth) : './';
    const importPath = `${prefix}lib/dateFormat`.replace('//', '/');

    // Make sure imports are present
    const needsFmtDate = content.includes('fmtDate(') && !content.match(/import\s+{[^}]*fmtDate[^}]*}\s+from\s+['"].*dateFormat['"]/);
    const needsFmtDateTime = content.includes('fmtDateTime(') && !content.match(/import\s+{[^}]*fmtDateTime[^}]*}\s+from\s+['"].*dateFormat['"]/);
    
    if (needsFmtDate || needsFmtDateTime) {
      // Check if there is an existing import from dateFormat
      const existingImportMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"](.*dateFormat)['"];?/);
      if (existingImportMatch) {
        let imports = existingImportMatch[1].split(',').map(s => s.trim());
        if (needsFmtDate) imports.push('fmtDate');
        if (needsFmtDateTime) imports.push('fmtDateTime');
        imports = [...new Set(imports)];
        content = content.replace(existingImportMatch[0], `import { ${imports.join(', ')} } from "${existingImportMatch[2]}";`);
      } else {
        const toImport = [];
        if (content.includes('fmtDate(')) toImport.push('fmtDate');
        if (content.includes('fmtDateTime(')) toImport.push('fmtDateTime');
        content = `import { ${toImport.join(', ')} } from "${importPath}";\n` + content;
      }
    }
    
    fs.writeFileSync(f, content, 'utf8');
    modifiedCount++;
    console.log('Modified:', f);
  }
});

console.log(`Updated ${modifiedCount} files.`);
