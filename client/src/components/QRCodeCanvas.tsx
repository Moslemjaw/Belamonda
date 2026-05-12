import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a QR code client-side using the `qrcode` library.
 * This avoids relying on a server-side endpoint (which breaks in production
 * when the API is on a different origin than the frontend).
 */
export default function QRCodeCanvas({ value, size = 200, className }: QRCodeCanvasProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!value) {
      setDataUrl("");
      return;
    }

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((url) => setDataUrl(url))
      .catch(() => {
        setDataUrl("");
      });
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        aria-hidden
      />
    );
  }

  return <img src={dataUrl} alt="Membership QR code" width={size} height={size} className={className} />;
}
