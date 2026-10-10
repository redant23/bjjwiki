import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceError, viewerFromSession, type Viewer } from '@/lib/combo-service';

export async function getViewer(): Promise<Viewer | null> {
  return viewerFromSession(await getServerSession(authOptions));
}

export function jsonError(error: unknown, label: string) {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { success: false, error: error.message, ...(error.extra ?? {}) },
      { status: error.status }
    );
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
}

export const UNAUTHORIZED = () =>
  NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
export const FORBIDDEN = () =>
  NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
export const NOT_FOUND = () =>
  NextResponse.json({ success: false, error: 'Combo not found' }, { status: 404 });
