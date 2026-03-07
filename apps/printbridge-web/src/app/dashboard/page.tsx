import { Printer, Settings, Key, Activity, Copy } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 font-bold text-xl flex items-center gap-2 border-b border-gray-100">
          <Printer className="text-brand-600" />
          <span>PrintBridge</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-sm font-medium">
          <a href="#" className="flex items-center gap-3 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg">
            <Activity className="w-5 h-5" /> Overview
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
            <Key className="w-5 h-5" /> API Keys
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
            <Settings className="w-5 h-5" /> Settings
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">Developer Dashboard</h1>

          {/* Banner */}
          <div className="bg-brand-600 text-white rounded-2xl p-6 mb-8 flex justify-between items-center shadow-sm">
            <div>
              <h2 className="text-lg font-bold">14-Day Free Trial Active</h2>
              <p className="opacity-90">You have 500 free prints remaining this month.</p>
            </div>
            <button className="bg-white text-brand-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors">
              Upgrade to Pro
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Live API Key</h3>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <code className="text-sm text-gray-700 font-mono">pb_live_7x9a...b2c3</code>
                <button className="text-gray-400 hover:text-gray-600">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Test API Key</h3>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <code className="text-sm text-gray-700 font-mono">pb_test_1m2n...p4q5</code>
                <button className="text-gray-400 hover:text-gray-600">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-bold mb-4">Quickstart</h2>
          <div className="bg-gray-900 rounded-xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
              <span className="bg-gray-800 px-3 py-1 rounded-md">Node.js</span>
              <span>cURL</span>
              <span>Python</span>
            </div>
            <pre className="text-green-400 font-mono text-sm leading-relaxed overflow-x-auto">
{`import { PrintBridge } from '@printbridge/client';

const pb = new PrintBridge('pb_live_7x9a...b2c3');

await pb.jobs.create({
  device_id: 'kitchen_printer_1',
  template: 'standard_receipt',
  data: {
    order_id: '#1024',
    items: [{ name: 'Margherita Pizza', price: 12.00 }]
  }
});`}
            </pre>
          </div>

        </div>
      </main>
    </div>
  )
}
