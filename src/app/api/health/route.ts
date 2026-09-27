export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/** Prosty healthcheck dla Dockera / orchestratorów. */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
