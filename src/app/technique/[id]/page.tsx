'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Technique {
  _id: string;
  name: string;
  alt_names: string[];
  description: string;
  image_url?: string;
  video_url?: string;
  category: string;
  updatedAt: string;
}

export default function TechniquePage() {
  const params = useParams();
  const [technique, setTechnique] = useState<Technique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTechnique() {
      try {
        const res = await fetch(`/api/techniques/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setTechnique(data.data);
        } else {
          setError(data.error || 'Failed to load technique');
        }
      } catch (err) {
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchTechnique();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-1/3 bg-muted animate-pulse rounded" />
        <div className="h-64 w-full bg-muted animate-pulse rounded" />
        <div className="h-32 w-full bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error || !technique) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive">Error</h2>
        <p className="text-muted-foreground">{error || 'Technique not found'}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 lg:py-10">
      <div className="mb-8">
        <Link
          href="/"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Home
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            {technique.name}
          </h1>
          <div className="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-secondary-foreground">
              {technique.category}
            </span>
            {technique.alt_names.length > 0 && (
              <span>Also known as: {technique.alt_names.join(', ')}</span>
            )}
          </div>
        </div>

        {technique.video_url && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            {/* Simple embed handling for YouTube/Vimeo would go here. 
                For now just a link or basic iframe if it's an embed URL. 
                Assuming user provides full embed URL or we parse it. 
                Let's assume it's a direct link for now and just show it or try to embed if youtube.
            */}
            {technique.video_url.includes('youtube.com') || technique.video_url.includes('youtu.be') ? (
              <iframe
                width="100%"
                height="100%"
                src={technique.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                title={technique.name}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <a href={technique.video_url} target="_blank" rel="noopener noreferrer" className="underline">
                  Watch Video
                </a>
              </div>
            )}
          </div>
        )}

        {technique.image_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={technique.image_url}
              alt={technique.name}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <ReactMarkdown>{technique.description}</ReactMarkdown>
        </div>

        <div className="pt-6 text-sm text-muted-foreground border-t">
          Last updated: {new Date(technique.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
