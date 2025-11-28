'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-1 text-sm text-accent mb-6">
      <Link
        href="/"
        className="flex items-center hover:text-accent/80 transition-colors"
      >
        <Home className="h-4 w-4 text-accent" />
        <span className="sr-only">홈</span>
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4 text-accent" />
          {index === items.length - 1 ? (
            <span className="font-medium text-accent">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
