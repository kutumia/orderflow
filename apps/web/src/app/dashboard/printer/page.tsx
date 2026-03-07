"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Printer, Download, RefreshCw, CheckCircle2, XCircle, Clock,
  Loader2, Copy, Key, AlertTriangle, RotateCcw, Monitor, Wifi,
  WifiOff, Shield, Trash2, Pencil, Settings,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const JOB_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Queued", color: "text-blue-600 bg-blue-50", icon: Clock },
  printing: { label: "Printing", color: "text-yellow-600 bg-yellow-50", icon: Loader2 },
  printed: { label: "Printed", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-600 bg-red-50", icon: XCircle },
};

function DeviceCard({ device, onRefresh }: { device: any; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.device_name);

  const isOnline = device.is_online;
  const lastSeen = device.last_heartbeat
    ? new Date(device.last_heartbeat)
    : null;
  const ago = lastSeen
    ? Math.round((Date.now() - lastSeen.getTime()) / 1000)
    : null;

  const updateDevice = async (updates: any) => {
    await fetch("/api/printer-devices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: device.id, ...updates }),
    });
    onRefresh();
  };

  const deleteDevice = async () => {
    if (!confirm(`Remove "${device.device_name}"?`)) return;
    await fetch(`/api/printer-devices?device_id=${device.id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className={cn("card p-4", isOnline ? "border-l-4 border-l-green-500" : "border-l-4 border-l-gray-300")}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", isOnline ? "bg-green-50" : "bg-gray-100")}>
            <Monitor className={cn("h-5 w-5", isOnline ? "text-green-600" : "text-gray-400")} />
          </div>
          <div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="input-field text-sm py-1 px-2 w-40" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { updateDevice({ device_name: name }); setEditing(false); } }}
                />
                <button onClick={() => { updateDevice({ device_name: name }); setEditing(false); }}
                  className="text-xs text-brand-600">Save</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{device.device_name}</span>
                <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600">
                  <Pencil className="h-3 w-3" />
                </button>
                {device.is_default && (
                  <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-medium">Default</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {isOnline ? (
                <span className="text-xs text-green-600 flex items-center gap-1"><Wifi className="h-3 w-3" /> Online</span>
              ) : (
                <span className="text-xs text-gray-400 flex items-center gap-1"><WifiOff className="h-3 w-3" /> Offline</span>
              )}
              {ago !== null && (
                <span className="text-xs text-gray-400">
                  · Last seen {ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.round(ago / 60)}m ago` : `${Math.round(ago / 3600)}h ago`}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={deleteDevice} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Device info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        {device.printer_name && (
          <div><span className="text-gray-400">Printer:</span> {device.printer_name}</div>
        )}
        <div><span className="text-gray-400">Paper:</span> {device.paper_width || 80}mm</div>
        <div><span className="text-gray-400">Connection:</span> {device.connection_type || "USB"}</div>
        {device.agent_version && (
          <div><span className="text-gray-400">Version:</span> v{device.agent_version}</div>
        )}
        {device.os_platform && (
          <div><span className="text-gray-400">OS:</span> {device.os_platform} {device.os_version}</div>
        )}
        <div><span className="text-gray-400">Printed:</span> {device.total_printed || 0}</div>
        <div><span className="text-gray-400">Failed:</span> {device.total_failed || 0}</div>
      </div>

      {/* Set as default */}
      {!device.is_default && (
        <button onClick={() => updateDevice({ is_default: true })}
          className="mt-3 text-xs text-brand-600 hover:text-brand-700">
          Set as default printer
        </button>
      )}
    </div>
  );
}

export default function PrinterPage() {
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [keyRes, devRes, jobsRes] = await Promise.all([
      fetch("/api/printer-settings"),
      fetch("/api/printer-devices"),
      fetch("/api/print-jobs"),
    ]);
    if (keyRes.ok) setApiKey((await keyRes.json()).printer_api_key || "");
    if (devRes.ok) setDevices(await devRes.json());
    if (jobsRes.ok) setJobs(await jobsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const generateKey = async () => {
    if (apiKey && !confirm("This will disconnect any running printer agent. Continue?")) return;
    setGenerating(true);
    const res = await fetch("/api/printer-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_key" }),
    });
    if (res.ok) setApiKey((await res.json()).printer_api_key);
    setGenerating(false);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requeueJob = async (jobId: string) => {
    await fetch("/api/print-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requeue: true, job_id: jobId }),
    });
    fetchData();
  };

  const queuedCount = jobs.filter((j) => j.status === "queued").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const printedCount = jobs.filter((j) => j.status === "printed").length;
  const printingCount = jobs.filter((j) => j.status === "printing").length;
  const onlineDevices = devices.filter((d) => d.is_online).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Kitchen Printer</h1>
          <p className="text-gray-500 text-sm mt-1">
            {devices.length} device{devices.length !== 1 ? "s" : ""} registered · {onlineDevices} online
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* API Key + Download */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center">
            <Key className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Printer API Key</h3>
            <p className="text-xs text-gray-400">Used by the desktop app to connect</p>
          </div>
        </div>
        {apiKey ? (
          <div className="flex items-center gap-2 mb-3">
            <code className="bg-gray-50 px-3 py-2 rounded border text-sm font-mono flex-1 truncate select-all">
              {apiKey}
            </code>
            <button onClick={copyKey} className="btn-secondary text-sm shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button onClick={generateKey} disabled={generating} className="btn-secondary text-sm shrink-0">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
            </button>
          </div>
        ) : (
          <button onClick={generateKey} disabled={generating} className="btn-primary text-sm flex items-center gap-2 mb-3">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Generate API Key
          </button>
        )}
        <a href="/downloads/OrderFlowPrinter-Setup.exe" className="btn-primary text-sm inline-flex items-center gap-2">
          <Download className="h-4 w-4" /> Download Printer App
        </a>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Signed</span>
          <span>Windows 10/11</span>
          <span>USB + Network printers</span>
          <span>Auto-updates</span>
        </div>
      </div>

      {/* Devices */}
      {devices.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-sm mb-3">Connected Devices</h3>
          <div className="grid lg:grid-cols-2 gap-3">
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} onRefresh={fetchData} />
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{queuedCount}</div>
          <div className="text-xs text-gray-500">Queued</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-yellow-600">{printingCount}</div>
          <div className="text-xs text-gray-500">Printing</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-green-600">{printedCount}</div>
          <div className="text-xs text-gray-500">Printed</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-red-600">{failedCount}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {/* Print queue */}
      <div className="card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent Print Jobs</h3>
          {failedCount > 0 && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {failedCount} failed
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600 mx-auto" /></div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No print jobs yet. They appear automatically when orders are placed.
          </div>
        ) : (
          <div className="divide-y">
            {jobs.slice(0, 25).map((job) => {
              const order = job.orders;
              const conf = JOB_STATUS[job.status] || JOB_STATUS.queued;
              const Icon = conf.icon;
              return (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", conf.color)}>
                    <Icon className={cn("h-3 w-3", job.status === "printing" && "animate-spin")} />
                    {conf.label}
                  </span>
                  <span className="text-sm font-medium w-16">#{order?.order_number || "?"}</span>
                  <span className="text-xs text-gray-400 capitalize">{order?.order_type}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate">{order?.customer_name}</span>
                  {job.priority > 1 && (
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">Priority</span>
                  )}
                  {job.error_message && (
                    <span className="text-xs text-red-500 truncate max-w-[200px]" title={job.error_message}>
                      {job.error_message}
                    </span>
                  )}
                  {job.printed_at && <span className="text-xs text-gray-400">{formatDateTime(job.printed_at)}</span>}
                  {job.status === "failed" && (
                    <button onClick={() => requeueJob(job.id)}
                      className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 shrink-0">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printer Setup Guide */}
      {devices.length === 0 && (
        <div className="card p-6 mt-6">
          <h3 className="font-semibold mb-4">Set Up Your Printer</h3>
          <div className="space-y-4">
            {[
              { step: 1, title: "Download the app", desc: "Get the OrderFlow Printer app for Windows.", action: <a href="/downloads/OrderFlowPrinter-Setup.exe" className="text-brand-600 text-xs font-medium hover:underline">Download →</a> },
              { step: 2, title: "Enter your API key", desc: "Copy the key above and paste it in the app's setup wizard." },
              { step: 3, title: "Select your printer", desc: "Choose your thermal printer (USB or network) and paper size." },
              { step: 4, title: "Test print", desc: "Click 'Test Print' in the app to confirm it's working." },
            ].map(({ step, title, desc, action }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">{step}</div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                  {action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Troubleshooting Wizard */}
      <PrinterTroubleshooter />
    </div>
  );
}

function PrinterTroubleshooter() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<string[]>([]);

  const tree: Record<string, { question: string; options: { label: string; next?: string; answer?: string }[] }> = {
    start: {
      question: "What's happening?",
      options: [
        { label: "Orders aren't printing", next: "not_printing" },
        { label: "Prints are garbled/wrong", next: "garbled" },
        { label: "App won't connect", next: "wont_connect" },
      ],
    },
    not_printing: {
      question: "Is the OrderFlow Printer app running?",
      options: [
        { label: "Yes — tray icon is green", next: "green_not_printing" },
        { label: "Yes — tray icon is red/yellow", next: "red_icon" },
        { label: "No — app isn't running", answer: "Start the OrderFlow Printer app from your Start menu or desktop shortcut. It should appear in the system tray (bottom-right of your screen). The app needs to be running for orders to print." },
      ],
    },
    green_not_printing: {
      question: "Can you see the printer in Windows Settings → Printers?",
      options: [
        { label: "Yes, printer is listed", answer: "Try a test print from the OrderFlow Printer app (Settings → Test Print). If that works but orders don't print, check that the correct printer is selected in the app settings. Also check that the printer isn't paused in Windows." },
        { label: "No, printer not listed", answer: "Your printer isn't connected to Windows. Check the USB cable or network connection. Try turning the printer off and on. You may need to install the printer driver from the manufacturer's website (e.g. Epson)." },
      ],
    },
    red_icon: {
      question: "What does the error message say?",
      options: [
        { label: "Invalid API key", answer: "Your API key may have been regenerated. Go to Dashboard → Printer, copy the current API key, and paste it in the app's Settings. Then restart the app." },
        { label: "Printer not found", answer: "The selected printer isn't available. Open the app settings, select a different printer from the dropdown, and save. Make sure the printer is turned on and connected." },
        { label: "Connection error", answer: "The app can't reach OrderFlow's servers. Check your internet connection. If you're behind a firewall or proxy, make sure api.orderflow.co.uk is allowed. Try restarting the app." },
      ],
    },
    garbled: {
      question: "What does the print look like?",
      options: [
        { label: "Random characters/symbols", answer: "This usually means the wrong paper width is selected. Open the app settings and check: 80mm printers use 48-character width, 58mm printers use 32-character width. Save and try a test print." },
        { label: "Text is cut off on one side", answer: "Your paper width setting doesn't match the physical paper. Go to app Settings and change between 80mm and 58mm paper. Save and test print." },
        { label: "Blank pages printing", answer: "The thermal paper may be inserted upside down (the thermal side needs to face the print head). Try flipping the paper roll. Also check that the paper type matches your printer (some printers need specific thermal paper)." },
      ],
    },
    wont_connect: {
      question: "What error do you see?",
      options: [
        { label: "\"Cannot reach server\"", answer: "Check your internet connection. Try opening orderflow.co.uk in your browser. If that works, your firewall may be blocking the printer app. Add OrderFlowPrinter.exe to your firewall's allowed list." },
        { label: "\"Invalid API key\"", answer: "Copy your latest API key from Dashboard → Printer and paste it in the app's Settings. Keys are invalidated when you click 'Regenerate' in the dashboard." },
        { label: "App crashes on startup", answer: "Try uninstalling and reinstalling the app. Make sure you're running Windows 10 or later. If it still crashes, check Windows Event Viewer for error details and contact support." },
      ],
    },
  };

  const current = tree[path[path.length - 1] || "start"];

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button onClick={() => setOpen(true)} className="text-sm text-gray-500 hover:text-gray-700 underline">
          Printer not working? Get help →
        </button>
      </div>
    );
  }

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Printer Troubleshooting</h3>
        <button onClick={() => { setOpen(false); setPath([]); }} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      <p className="text-sm text-gray-700 mb-3">{current.question}</p>
      <div className="space-y-2">
        {current.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (opt.next) setPath([...path, opt.next]);
              else if (opt.answer) setPath([...path, `answer:${i}`]);
            }}
            className="w-full text-left p-3 rounded-lg border hover:border-brand-300 hover:bg-brand-50/30 text-sm transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Show answer if last path entry is an answer */}
      {path.length > 0 && path[path.length - 1].startsWith("answer:") && (() => {
        const parentNode = tree[path[path.length - 2] || "start"];
        const answerIdx = parseInt(path[path.length - 1].replace("answer:", ""));
        const answer = parentNode.options[answerIdx]?.answer;
        return answer ? (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800 leading-relaxed">
            {answer}
          </div>
        ) : null;
      })()}

      {path.length > 0 && (
        <button onClick={() => setPath(path.slice(0, -1))} className="text-xs text-brand-600 hover:text-brand-700 mt-3">
          ← Back
        </button>
      )}
      {path.length > 1 && (
        <button onClick={() => setPath([])} className="text-xs text-gray-400 hover:text-gray-600 mt-3 ml-3">
          Start over
        </button>
      )}
    </div>
  );
}
