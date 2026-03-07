"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { QrCode, Download, Copy, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

export default function QRCodePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const slug = user?.restaurant_slug || "";
  const restaurantName = user?.restaurant_name || "My Restaurant";

  const [qrUrl, setQrUrl] = useState("");
  const [orderUrl, setOrderUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!slug) return;
    const url = `https://orderflow.co.uk/${slug}`;
    setOrderUrl(url);
    setQrUrl(`https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${encodeURIComponent(url)}&choe=UTF-8&chld=M|2`);
  }, [slug]);

  const copyUrl = () => {
    navigator.clipboard.writeText(orderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const link = document.createElement("a");
    link.download = `${slug}-qr-code.png`;
    link.href = qrUrl;
    link.click();
  };

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // A5 ratio poster (148 x 210 mm → 590 x 840 px)
    canvas.width = 590;
    canvas.height = 840;

    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 590, 840);

    // Header bar
    ctx.fillStyle = "#1B4F72";
    ctx.fillRect(0, 0, 590, 100);

    // Restaurant name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(restaurantName, 295, 60);

    // "Order Direct & Save" text
    ctx.fillStyle = "#333333";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("Order Direct & Save", 295, 160);

    ctx.fillStyle = "#666666";
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText("Scan the QR code below to order", 295, 195);

    // QR code image
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 95, 230, 400, 400);

      // URL text
      ctx.fillStyle = "#1B4F72";
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(orderUrl.replace("https://", ""), 295, 680);

      // Footer
      ctx.fillStyle = "#999999";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText("Skip the queue · No booking fees · Direct to us", 295, 730);

      // Powered by
      ctx.fillStyle = "#CCCCCC";
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillText("Powered by OrderFlow", 295, 810);

      // Download
      const link = document.createElement("a");
      link.download = `${slug}-order-poster.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    qrImg.src = qrUrl;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">QR Code & Marketing</h1>
        <p className="text-gray-500 text-sm mt-1">Share your ordering link with customers.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code */}
        <div className="card p-6 text-center">
          <h3 className="font-semibold mb-4">Your QR Code</h3>
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="mx-auto rounded-lg shadow-sm" width={300} height={300} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <QrCode className="h-12 w-12" />
            </div>
          )}
          <div className="mt-4 space-y-2">
            <button onClick={downloadQR} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
              <Download className="h-4 w-4" /> Download QR Code
            </button>
            <button onClick={downloadPoster} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
              <Download className="h-4 w-4" /> Download A5 Poster
            </button>
          </div>
        </div>

        {/* Ordering Link */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Your Ordering Link</h3>
            <div className="flex items-center gap-2 mb-3">
              <code className="bg-gray-50 px-3 py-2 rounded border text-sm font-mono flex-1 truncate select-all">
                {orderUrl}
              </code>
              <button onClick={copyUrl} className="btn-secondary text-sm shrink-0 px-3">
                {copied ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <a href={orderUrl} target="_blank" rel="noopener" className="btn-secondary text-sm shrink-0 px-3">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Where to Use</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="text-lg">🖨️</span>
                <div>
                  <p className="font-medium text-gray-900">Print the poster</p>
                  <p className="text-gray-500">Place on your counter, window, or tables</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">📱</span>
                <div>
                  <p className="font-medium text-gray-900">Social media</p>
                  <p className="text-gray-500">Share your link on Instagram, Facebook, WhatsApp</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="font-medium text-gray-900">Google Business</p>
                  <p className="text-gray-500">Add the link to your Google Business listing</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">📧</span>
                <div>
                  <p className="font-medium text-gray-900">Email signature</p>
                  <p className="text-gray-500">Add &ldquo;Order online&rdquo; link to your email</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for poster generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Table QR Codes for Dine-In */}
      <TableQRSection />
    </div>
  );
}

function TableQRSection() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(10);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/table-qr?tables=${count}`);
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="mt-8">
      <div className="card p-5">
        <h3 className="font-semibold mb-1">Table QR Codes</h3>
        <p className="text-sm text-gray-500 mb-4">Generate unique QR codes for each table — customers scan to order directly for dine-in.</p>

        <div className="flex items-end gap-3 mb-4">
          <div>
            <label className="label">Number of tables</label>
            <input type="number" className="input-field w-24" value={count} min={1} max={50}
              onChange={(e) => setCount(parseInt(e.target.value) || 10)} />
          </div>
          <button onClick={generate} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Table QR Codes
          </button>
        </div>

        {tables.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tables.map((t) => (
              <div key={t.table_number} className="border rounded-lg p-3 text-center">
                <img src={t.qr_url} alt={`Table ${t.table_number}`} className="w-full max-w-[120px] mx-auto mb-2" />
                <p className="text-sm font-bold">Table {t.table_number}</p>
                <a href={t.qr_url} download={`table-${t.table_number}-qr.png`} className="text-xs text-brand-600 hover:underline">
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
