'use client';

import { Plus, Trash2 } from 'lucide-react';

interface VideoUrlInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

export function VideoUrlInput({ urls, onChange }: VideoUrlInputProps) {
  const addUrl = () => {
    onChange([...urls, '']);
  };

  const removeUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    onChange(newUrls);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">유튜브 영상 URL</label>
      {urls.map((url, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="https://youtube.com/..."
            value={url}
            onChange={(e) => updateUrl(index, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeUrl(index)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 text-destructive"
            title="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addUrl}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-dashed border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        영상 추가하기
      </button>
    </div>
  );
}
