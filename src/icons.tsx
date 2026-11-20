import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      {children}
    </svg>
  )
}

export function IconBack() {
  return (
    <Svg>
      <path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconGrade() {
  return (
    <Svg>
      <path d="M12 4 20 8v8l-8 4-8-4V8l8-4Z" strokeLinejoin="round" />
      <path d="M9 12h6M12 9v6" strokeLinecap="round" />
    </Svg>
  )
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3.25" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6l1.6-1.6M17 7l1.6-1.6"
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function IconAttach() {
  return (
    <Svg>
      <path
        d="M8.5 12.5 14.6 6.4a3 3 0 1 1 4.2 4.2l-7.5 7.5a4.5 4.5 0 0 1-6.4-6.4l8.2-8.2"
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function IconSend() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v9M12 7l3.5 3.5M12 7 8.5 10.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconBook() {
  return (
    <Svg>
      <path d="M6 5.5h11a2 2 0 0 1 2 2V18H8a3 3 0 0 0-3 3V7.5a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      <path d="M8 5.5V20" strokeLinecap="round" />
    </Svg>
  )
}

export function IconPlay() {
  return (
    <Svg fill="currentColor" stroke="none">
      <path d="M9 7.5v9l8-4.5-8-4.5Z" />
    </Svg>
  )
}

export function IconHome() {
  return (
    <Svg>
      <path d="M5 10.5 12 5l7 5.5V19a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19v-8.5Z" strokeLinejoin="round" />
      <path d="M9.5 20.5V14h5v6.5" strokeLinecap="round" />
    </Svg>
  )
}

export function IconExpand() {
  return (
    <Svg>
      <path d="M9 4H4v5M20 15v5h-5M15 4h5v5M4 15v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconQuiz() {
  return (
    <Svg>
      <path d="M7 6h10v12H7z" strokeLinejoin="round" />
      <path d="M9.5 10h5M9.5 13h3.5" strokeLinecap="round" />
    </Svg>
  )
}

export function IconPdf() {
  return (
    <Svg>
      <path d="M8 4h8l4 4v12H8z" strokeLinejoin="round" />
      <path d="M16 4v4h4M10 13h4M10 16h4" strokeLinecap="round" />
    </Svg>
  )
}

export function IconReplay() {
  return (
    <Svg>
      <path d="M8 8H5v3M5 12a7 7 0 1 0 1.6-4.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconHighlighter() {
  return (
    <Svg>
      <path d="m5 19 4-9 9-2-2 9-9 4Z" strokeLinejoin="round" />
      <path d="M13 6l5 5" strokeLinecap="round" />
    </Svg>
  )
}

export function IconEraser() {
  return (
    <Svg>
      <path d="m16 8-8 8-3-3 8-8 3 3Z" strokeLinejoin="round" />
      <path d="M13 11 18 6" strokeLinecap="round" />
    </Svg>
  )
}

export function IconTrash() {
  return (
    <Svg>
      <path d="M5 7h14M9.5 7V5.5h5V7M8 7v11h8V7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconPause() {
  return (
    <Svg>
      <path d="M9 8v8M15 8v8" strokeLinecap="round" />
    </Svg>
  )
}

export function IconMic() {
  return (
    <Svg>
      <rect x="9" y="5" width="6" height="10" rx="3" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V19" strokeLinecap="round" />
    </Svg>
  )
}

export function IconChevronLeft() {
  return (
    <Svg>
      <path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconChevronRight() {
  return (
    <Svg>
      <path d="M9.5 6.5 15 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconRefresh() {
  return (
    <Svg>
      <path d="M8 8H5v3M5 12a7 7 0 1 0 1.6-4.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconShare() {
  return (
    <Svg>
      <path d="M8 11.5V7.2A2.2 2.2 0 0 1 10.2 5h7.6A2.2 2.2 0 0 1 20 7.2v9.6A2.2 2.2 0 0 1 17.8 19H10.2A2.2 2.2 0 0 1 8 16.8V12.5" strokeLinecap="round" />
      <path d="M5 12h10M11 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconClose() {
  return (
    <Svg>
      <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
    </Svg>
  )
}

export function IconSave() {
  return (
    <Svg>
      <path d="M6 4h12v16H6z" strokeLinejoin="round" />
      <path d="M9 4v5h6V4M9 16h6" strokeLinecap="round" />
    </Svg>
  )
}

export function IconBtn({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button type="button" className={`icon-tool${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}