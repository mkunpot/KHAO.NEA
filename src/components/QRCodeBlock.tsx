import { QRCodeSVG } from 'qrcode.react'

/** Always dark-on-white with a quiet zone, whatever the theme: that is what phone cameras read reliably. */
export function QRCodeBlock({ value, size, className }: { value: string; size: number; className?: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#0a1020"
      className={className}
      style={{ borderRadius: Math.round(size / 16), display: 'block' }}
      title="QR code: join the class"
    />
  )
}
