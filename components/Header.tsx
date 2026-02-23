import Link from 'next/link';

export default function Header() {
  return (
<header className="relative z-50 w-full py-4 px-6 bg-black border-b border-gray-800 flex justify-between items-center">
<Link href="/" className="text-2xl font-bold text-white tracking-tighter">
<img src="/logo.png" alt="Strendex Logo" className="h-16 w-auto" />      </Link>
      <nav className="space-x-4">
        <Link href="/" className="text-gray-400 hover:text-green-400 text-sm">Home</Link>
        <Link href="/rankings" className="text-gray-400 hover:text-green-400 text-sm">Rankings</Link>
      </nav>
    </header>
  );
}