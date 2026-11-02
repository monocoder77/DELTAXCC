/* ==========================================================================
   Portal icon set: 24px grid, 1.75 stroke, square caps and miter joins
   so they match the geometric style.
   ========================================================================== */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </Base>
);

export const IconSchool = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 9 12 4l10 5-10 5z" />
    <path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5" />
    <path d="M22 9v6" />
  </Base>
);

export const IconTasks = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" />
    <path d="m8 12 3 3 5-6" />
  </Base>
);

export const IconActivity = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 12h4l3-8 6 16 3-8h4" />
  </Base>
);

export const IconMessage = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h18v13H8l-5 4z" />
  </Base>
);

export const IconFolder = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 5h6l2 3h10v12H3z" />
  </Base>
);

export const IconBook = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h7a2 2 0 0 1 2 2v14H5a2 2 0 0 1-2-2z" />
    <path d="M21 4h-7a2 2 0 0 0-2 2v14h7a2 2 0 0 0 2-2z" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2 21 7v10l-9 5-9-5V7z" />
    <rect x="9" y="9" width="6" height="6" transform="rotate(45 12 12)" />
  </Base>
);

export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="7" height="7" />
    <path d="M2 21v-3a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v3" />
    <path d="M15 4h5v6h-5M16 14h2a4 4 0 0 1 4 4v3" />
  </Base>
);

export const IconPen = (p: IconProps) => (
  <Base {...p}>
    <path d="m16 3 5 5L8 21H3v-5z" />
    <path d="m13 6 5 5" />
  </Base>
);

export const IconLibrary = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 3v18M9 3v18" />
    <path d="m14 4 4-1 3 17-4 1z" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 3H3v18h7" />
    <path d="m16 7 5 5-5 5M21 12H9" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v16M4 12h16" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m4 12 5 5L20 6" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Base>
);

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Base>
);

export const IconArrowUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20V4M6 10l6-6 6 6" />
  </Base>
);

export const IconArrowDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v16M6 14l6 6 6-6" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="12" height="12" transform="rotate(45 10 10)" />
    <path d="m15 15 6 6" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15" />
  </Base>
);

export const IconEdit = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h16" />
    <path d="m14 4 4 4-9 9H5v-4z" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />
  </Base>
);

export const IconFile = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 2h9l5 5v15H5z" />
    <path d="M14 2v5h5" />
  </Base>
);

export const IconSend = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12 21 3l-6 18-3-8z" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" transform="rotate(45 12 12)" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);

export const IconDrag = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth={3} />
  </Base>
);

export const IconExternal = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 3h7v7M21 3l-9 9" />
    <path d="M19 14v7H3V5h7" />
  </Base>
);

export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 12 12 5l10 7-10 7z" />
    <rect x="10" y="10" width="4" height="4" />
  </Base>
);

export const IconFocus = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
  </Base>
);

export const IconHistory = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v5h5M12 7v5l3 3" />
  </Base>
);

export const IconComment = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4h16v12h-9l-5 4v-4H4z" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h18M3 12h18M3 18h12" />
  </Base>
);

export const IconCommand = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="8" width="8" height="8" />
    <path d="M8 8H5a2 2 0 1 1 2-2zM16 8V5a2 2 0 1 1 2 2zM16 16h3a2 2 0 1 1-2 2zM8 16v3a2 2 0 1 1-2-2z" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    <rect x="9.5" y="9.5" width="5" height="5" transform="rotate(45 12 12)" />
  </Base>
);

export const IconFlag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 21V3h12l-2 4 2 4H5" />
  </Base>
);

export const IconLink = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 14 14 10" />
    <path d="M8 11 5 14a3 3 0 0 0 5 5l3-3M16 13l3-3a3 3 0 0 0-5-5l-3 3" />
  </Base>
);

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h18l-7 9v7l-4-2v-5z" />
  </Base>
);

export const IconUserPlus = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="3" width="7" height="7" />
    <path d="M2 21v-3a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v3M19 8v6M16 11h6" />
  </Base>
);
