import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...props,
  };
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.1-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
    </svg>
  );
}

export function Back15Icon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5h4V4.5" />
      <path d="M3.9 8.2a9 9 0 1 1-.6 5.3" />
      <text x="12" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none">
        15
      </text>
    </svg>
  );
}

export function Forward30Icon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 8.5h-4V4.5" />
      <path d="M20.1 8.2a9 9 0 1 0 .6 5.3" />
      <text x="12" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none">
        30
      </text>
    </svg>
  );
}

export function VolumeHighIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6.5 8.5H3.5v7h3L11 19V5Z" />
      <path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4" />
      <path d="M18.4 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function VolumeMuteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6.5 8.5H3.5v7h3L11 19V5Z" />
      <path d="m16 9.5 5 5" />
      <path d="m21 9.5-5 5" />
    </svg>
  );
}

export function CaptionsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 10.2a2.4 2.4 0 1 0 0 3.6" />
      <path d="M17.4 10.2a2.4 2.4 0 1 0 0 3.6" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5H3.5V8" />
      <path d="M16 3.5h4.5V8" />
      <path d="M8 20.5H3.5V16" />
      <path d="M16 20.5h4.5V16" />
    </svg>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8H8V3.5" />
      <path d="M20.5 8H16V3.5" />
      <path d="M3.5 16H8v4.5" />
      <path d="M20.5 16H16v4.5" />
    </svg>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M7.5 4.5v15" />
      <path d="M16.5 4.5v15" />
      <path d="M2.5 12h19" />
      <path d="M2.5 8.2h5M2.5 15.8h5M16.5 8.2h5M16.5 15.8h5" />
    </svg>
  );
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2.5 2.5 0 0 1 2.5-2.5H8v7H6.5A2.5 2.5 0 0 1 4 16Z" />
      <path d="M20 14a2.5 2.5 0 0 0-2.5-2.5H16v7h1.5a2.5 2.5 0 0 0 2.5-2.5Z" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...base(props)} className={['pr-spinner', props.className].filter(Boolean).join(' ')}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v5" />
      <path d="M12 15.9h.01" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}
