"use client"

import { useState, useEffect } from "react"
import { SettingsPanel } from "@/components/settings-panel"
import { AIBingXPanel } from "@/components/ai-bingx-panel"
import { AITradingPanel } from "@/components/ai-trading-panel"
import { TradingChart } from "@/components/trading-chart"
import { EMATouchAnalyzer } from "@/components/ema-touch-analyzer"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Settings, TrendingUp, Activity } from "lucide-react"
import { useTheme } from "next-themes"

interface TradingMark {
  timestamp: number
  type: 'LONG' | 'SHORT'
  price: number
  id: string
}

export default function TradingPlatform() {
  const [activeTab, setActiveTab] = useState<string>("chart")
  const [balance, setBalance] = useState<number>(500)
  const [positions, setPositions] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<{ openai: string; bingxApiKey: string; bingxSecretKey: string }>({
    openai: "",
    bingxApiKey: "",
    bingxSecretKey: ""
  })
  const { theme, setTheme } = useTheme()
  const [tradingMarks, setTradingMarks] = useState<TradingMark[]>([])

  // Cargar API keys desde localStorage al inicializar
  useEffect(() => {
    const savedApiKeys = localStorage.getItem('trading-platform-api-keys')
    if (savedApiKeys) {
      try {
        const parsedKeys = JSON.parse(savedApiKeys)
        setApiKeys(parsedKeys)
      } catch (error) {
        console.error('Error cargando API keys desde localStorage:', error)
      }
    }
  }, [])

  // Función para guardar API keys en localStorage
  const saveApiKeysToStorage = (keys: { openai: string; bingxApiKey: string; bingxSecretKey: string }) => {
    setApiKeys(keys)
    localStorage.setItem('trading-platform-api-keys', JSON.stringify(keys))
  }

  // Función para limpiar API keys del localStorage
  const clearApiKeysFromStorage = () => {
    setApiKeys({ openai: "", bingxApiKey: "", bingxSecretKey: "" })
    localStorage.removeItem('trading-platform-api-keys')
  }

  const handleAddTradingMark = (mark: TradingMark) => {
    setTradingMarks(prev => [...prev, mark])
  }

  const handleClearTradingMarks = () => {
    setTradingMarks([])
  }

  const tabs = [
    { id: "chart", label: "Gráfico y Métricas" },
    { id: "ai-trading", label: "IA Trading" },
    { id: "ema-analysis", label: "Análisis EMA" },
    { id: "settings", label: "Configuración" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Bitcoin Trading Platform</h1>
            <div className="text-sm text-muted-foreground">
              Balance: <span className="font-semibold text-green-500">${balance.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center space-x-2"
              >
                {tab.id === "chart" && <TrendingUp className="h-4 w-4" />}
                {tab.id === "ema-analysis" && <Activity className="h-4 w-4" />}
                {tab.id === "settings" && <Settings className="h-4 w-4" />}
                <span>{tab.label}</span>
              </Button>
            ))}

            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-80px)]">
        <div className="flex-1 flex">
          <div className="flex-1">
            {activeTab === "chart" && (
              <div className="space-y-6">
                <AIBingXPanel
                  apiKeys={apiKeys}
                  balance={balance}
                  setBalance={setBalance}
                  positions={positions}
                  setPositions={setPositions}
                  onAddTradingMark={handleAddTradingMark}
                />
                <TradingChart 
                  apiKeys={apiKeys} 
                  tradingMarks={tradingMarks}
                  onAddTradingMark={handleAddTradingMark}
                  onClearTradingMarks={handleClearTradingMarks}
                />
              </div>
            )}
            {activeTab === "ai-trading" && (
              <div className="p-6">
                <AITradingPanel
                  apiKeys={apiKeys}
                  balance={balance}
                  setBalance={setBalance}
                  positions={positions}
                  setPositions={setPositions}
                  onAddTradingMark={handleAddTradingMark}
                />
              </div>
            )}
            {activeTab === "ema-analysis" && (
              <div className="p-6">
                <EMATouchAnalyzer 
                  apiKeys={apiKeys} 
                  onAddTradingMark={handleAddTradingMark}
                />
              </div>
            )}
            {activeTab === "settings" && (
              <SettingsPanel
                apiKeys={apiKeys}
                setApiKeys={saveApiKeysToStorage}
                clearApiKeys={clearApiKeysFromStorage}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
