'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Technique {
  _id: string;
  name: string;
  category: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingTechniques, setPendingTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchPending() {
      if (status === 'authenticated') {
        try {
          const res = await fetch('/api/techniques?status=pending');
          const data = await res.json();
          if (data.success) {
            setPendingTechniques(data.data);
          }
        } catch (error) {
          console.error('Failed to fetch pending techniques');
        } finally {
          setLoading(false);
        }
      }
    }
    fetchPending();
  }, [status]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setPendingTechniques((prev) => prev.filter((t) => t._id !== id));
      } else {
        alert(`Failed to ${action} technique`);
      }
    } catch (error) {
      alert('An error occurred');
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect
  }

  return (
    <div className="container py-6 lg:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            Logged in as {session?.user?.email}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Logout
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Pending Reviews</h2>

        {pendingTechniques.length === 0 ? (
          <p className="text-muted-foreground">No pending techniques to review.</p>
        ) : (
          <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Submitted</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {pendingTechniques.map((technique) => (
                    <tr key={technique._id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle font-medium">
                        <Link href={`/technique/${technique._id}`} className="hover:underline">
                          {technique.name}
                        </Link>
                      </td>
                      <td className="p-4 align-middle">{technique.category}</td>
                      <td className="p-4 align-middle">{new Date(technique.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 align-middle text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAction(technique._id, 'approve')}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-9 px-3"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(technique._id, 'reject')}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-9 px-3"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
