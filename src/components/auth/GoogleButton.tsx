'use client';

import { signIn } from 'next-auth/react';

export default function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/auth/post-login' })}
      className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
    </button>
  );
}
