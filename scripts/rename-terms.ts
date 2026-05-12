import { replaceInFiles } from './utils';
import * as path from 'path';

async function main() {
  const root = path.join(__dirname, '..');
  
  console.log('Renaming "Offers" to "Memberships" in client...');
  await replaceInFiles(path.join(root, 'client', 'src'), /Browse Offers/g, 'Browse Memberships');
  await replaceInFiles(path.join(root, 'client', 'src'), /latest offers/gi, 'latest memberships');
  await replaceInFiles(path.join(root, 'client', 'src'), /"Store"/g, '"Memberships"');
  await replaceInFiles(path.join(root, 'client', 'src'), /"عروض"/g, '"باقات العضوية"');

  console.log('Cleanup complete.');
}

main().catch(console.error);
