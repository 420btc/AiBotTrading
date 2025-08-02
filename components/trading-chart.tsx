"use client"

import { useState } from "react"
import { CanvasTradingChart } from "@/components/canvas-trading-chart"
import BitcoinChartsGrid from "@/components/bitcoin-charts-grid"
import AdvancedChartsGrid from "@/components/advanced-charts-grid"

interface TradingMark {
  timestamp: number
  type: 'LONG' | 'SHORT'
  price: number
  id: string
}

interface TradingChartProps {
  apiKeys: { openai?: string }
  tradingMarks?: TradingMark[]
  onAddTradingMark?: (mark: TradingMark) => void
  onClearTradingMarks?: () => void
}

export function TradingChart({ 
  apiKeys, 
  tradingMarks = [], 
  onAddTradingMark, 
  onClearTradingMarks 
}: TradingChartProps) {













  return (
    <div className="space-y-6">
      {/* Gráfico Canvas Profesional */}
      <CanvasTradingChart 
        apiKeys={apiKeys} 
        tradingMarks={tradingMarks}
        onAddTradingMark={onAddTradingMark}
        onClearTradingMarks={onClearTradingMarks}
      />

      {/* Bitcoin Charts Grid */}
      <BitcoinChartsGrid />
      
      {/* Gráficos Avanzados */}
      <AdvancedChartsGrid />
    </div>
  )
}
