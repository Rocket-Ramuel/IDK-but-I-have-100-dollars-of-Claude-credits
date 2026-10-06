// Concatenate src/ sections (name order) into the single self-contained index.html.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const files = fs.readdirSync(src).sort();
let out = '';
for (const f of files) {
  const t = fs.readFileSync(path.join(src, f), 'utf8');
  out += f.endsWith('.js') ? `\n// ==== ${f} ====\n${t}\n` : t;
}
fs.writeFileSync(path.join(root, 'index.html'), out);
console.log(`index.html: ${out.length} bytes, ${out.split('\n').length} lines from ${files.length} files`);
