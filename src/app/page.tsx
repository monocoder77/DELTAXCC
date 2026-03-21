import { redirect } from 'next/navigation';

// The main marketing site is served as static HTML from /public
// This page redirects to the portal for Next.js routing
// The static index.html in /public takes precedence for /
export default function Home() {
  redirect('/portal');
}
