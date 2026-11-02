'use client';

import { useState } from 'react';
import PortalApp from '@/components/portal/PortalApp';
import { BackendProvider } from '@/lib/backend/context';
import { createSupabaseBackend } from '@/lib/backend/supabase';

export default function PortalPage() {
  const [backend] = useState(createSupabaseBackend);
  return (
    <BackendProvider backend={backend}>
      <PortalApp />
    </BackendProvider>
  );
}
