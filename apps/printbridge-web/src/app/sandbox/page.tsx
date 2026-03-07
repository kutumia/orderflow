'use client'
import { useState } from 'react'
import { renderReceiptTemplate, DEFAULT_RECEIPT_TEMPLATE } from '@orderflow/printbridge-core'

const DEFAULT_DATA = {
  orderId: 'ONL-8472',
  customerName: 'Alice Johnson',
  restaurantName: 'The Pizza Oven',
  address: '123 High Street, London',
  phone: '020 7123 4567',
  date: new Date().toISOString(),
  items: [
    { name: 'Margherita Pizza (Large)', quantity: 2, price: 12.50 },
    { name: 'Garlic Bread', quantity: 1, price: 4.50, modifiers: ['Extra Cheese'] },
    { name: 'San Pellegrino Lemon', quantity: 2, price: 2.00 }
  ],
  tax: 5.60,
  deliveryFee: 2.50,
  total: 41.60
};

export default function Sandbox() {
  const [template, setTemplate] = useState(DEFAULT_RECEIPT_TEMPLATE)
  const [jsonData, setJsonData] = useState(JSON.stringify(DEFAULT_DATA, null, 2))
  const [error, setError] = useState<string | null>(null)
  
  let preview = ''
  try {
    const data = JSON.parse(jsonData)
    preview = renderReceiptTemplate(template, data)
    if (error) setError(null)
  } catch (e: any) {
    if (!error) setError(e.message)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-mono text-sm">
      <header className="p-4 border-b border-gray-800 bg-black flex justify-between items-center">
        <div className="font-bold flex items-center gap-2">
          <span className="text-brand-500">{"<"}</span> PrintBridge Sandbox <span className="text-brand-500">{"/>"}</span>
        </div>
        <div>
          <button className="bg-brand-600 text-white px-4 py-2 rounded font-semibold text-xs hover:bg-brand-500">
            Print to Virtual Device
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Editor column */}
        <div className="w-1/2 flex flex-col border-r border-gray-800">
          <div className="flex-1 flex flex-col border-b border-gray-800 p-4">
            <h3 className="text-gray-400 mb-2 uppercase text-xs tracking-wider font-bold">JSON Payload (Data)</h3>
            <textarea 
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              className="flex-1 bg-gray-950 p-4 rounded text-blue-400 outline-none resize-none"
              spellCheck={false}
            />
          </div>
          <div className="flex-1 flex flex-col p-4">
            <h3 className="text-gray-400 mb-2 uppercase text-xs tracking-wider font-bold">Handlebars Template (Layout)</h3>
            <textarea 
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="flex-1 bg-gray-950 p-4 rounded text-purple-400 outline-none resize-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Preview column */}
        <div className="w-1/2 bg-gray-800 flex flex-col items-center justify-center p-8 overflow-y-auto">
          {error && (
            <div className="bg-red-900/50 text-red-200 p-4 rounded mb-4 w-full text-center">
              Parse Error: {error}
            </div>
          )}
          
          <div className="bg-white text-black p-8 shadow-2xl rounded-sm receipt-paper min-w-[320px] max-w-sm">
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
              {preview || "No preview available..."}
            </pre>
          </div>
        </div>
      </main>

      <style jsx>{`
        .receipt-paper {
          background-image: linear-gradient(to right, #eee 1px, transparent 1px),
                            linear-gradient(to bottom, #eee 1px, transparent 1px);
          background-size: 20px 20px;
          border-top: 4px dashed #ccc;
          border-bottom: 4px dashed #ccc;
        }
      `}</style>
    </div>
  )
}
