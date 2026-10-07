const fs = require('fs');
const path = require('path');
const dir = './src/screens/Doctor';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/if \(!window\.location\.pathname\.includes\([^)]+\)\) \{[\s\S]*?window\.location\.href = ([^;]+);[\s\S]*?\}/g, (match, p1) => {
    return `router.push(${p1} as any);`;
  });
  content = content.replace(/window\.location\.href = `([^`]+)`;/g, 'router.push(`$1` as any);');
  content = content.replace(/window\.location\.href = ([^;]+);/g, 'router.push($1 as any);');
  fs.writeFileSync(filePath, content);
}
