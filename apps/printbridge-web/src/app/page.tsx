import './globals.css'
import Link from 'next/link'
import { Printer, Cloud, Code2, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto border-b border-gray-100">
        <div className="font-bold text-xl flex items-center gap-2">
          <Printer className="text-brand-600" />
          <span>PrintBridge</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">Log in</Link>
          <Link href="/register" className="btn-primary px-4 py-2">Get API Key</Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-5xl font-extrabold tracking-tight mb-6">
            The universal API for <span className="text-brand-600">cloud receipt printing</span>.
          </h1>
          <p className="text-xl text-gray-500 mb-10">
            Print thermal receipts directly from your web app, POS, or backend. No drivers, no Windows PCs, no hassle. Send JSON, get paper.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register" className="btn-primary text-lg">Start Building Free</Link>
            <Link href="#docs" className="px-6 py-3 rounded-xl font-medium border border-gray-200 hover:bg-gray-100 transition-colors">Read the Docs</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Cloud className="w-10 h-10 text-brand-500 mb-4" />
            <h3 className="font-bold text-xl mb-2">100% Cloud Native</h3>
            <p className="text-gray-500">Connect your printers to the internet and trigger prints from anywhere via secure REST API.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Zap className="w-10 h-10 text-brand-500 mb-4" />
            <h3 className="font-bold text-xl mb-2">Sub-second Latency</h3>
            <p className="text-gray-500">Built on Edge infrastructure and WebSockets for instantaneous kitchen tickets and receipts.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Code2 className="w-10 h-10 text-brand-500 mb-4" />
            <h3 className="font-bold text-xl mb-2">Beautiful DX</h3>
            <p className="text-gray-500">Stop wrestling with ESC/POS hex codes. Use our SDKs and dynamic Handlebars templates.</p>
          </div>
        </div>

      </main>
    </div>
  )
}
