import { NavbarClient } from './NavbarClient';
import { getTechniqueTree } from '@/lib/technique-service';

export async function Navbar() {
  const tree = await getTechniqueTree();
  console.log('[Navbar] Tree nodes:', tree.length);

  return <NavbarClient initialTree={tree} />;
}
