"use client"

import { useState, useEffect } from "react"
import { TradingChart } from "@/components/trading-chart"
import { TradingPanel } from "@/components/trading-panel"
import { IndicatorsPanel } from "@/components/indicators-panel"
import { PositionsPanel } from "@/components/positions-panel"
import { SettingsPanel } from "@/components/settings-panel"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Settings, TrendingUp, BarChart3 } from "lucide-react"
import { useTheme } from "next-themes"

export default function TradingPlatform() {
  const [activeTab, setActiveTab] = useState<string>("chart")
  const [balance, setBalance] = useState<number>(500)
  const [positions, setPositions] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<{ openai: string }>({ openai: "" })
  const { theme, setTheme } = useTheme()

  // Cargar datos del localStorage al inicializar
  useEffect(() => {
    const savedBalance = localStorage.getItem('tradingBalance')
    const savedPositions = localStorage.getItem('tradingPositions')
    const savedApiKeys = localStorage.getItem('tradingApiKeys')

    if (savedBalance) {
      setBalance(parseFloat(savedBalance))
    }
    if (savedPositions) {
      try {
        setPositions(JSON.parse(savedPositions))
      } catch (error) {
        console.error('Error al cargar posiciones:', error)
      }
    }
    if (savedApiKeys) {
      try {
        setApiKeys(JSON.parse(savedApiKeys))
      } catch (error) {
        console.error('Error al cargar API keys:', error)
      }
    }
  }, [])

  // Guardar balance en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('tradingBalance', balance.toString())
  }, [balance])

  // Guardar posiciones en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('tradingPositions', JSON.stringify(positions))
  }, [positions])

  // Guardar API keys en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('tradingApiKeys', JSON.stringify(apiKeys))
  }, [apiKeys])

  const tabs = [
    { id: "chart", label: "Gráfico", icon: TrendingUp },
    { id: "indicators", label: "Indicadores", icon: BarChart3 },
    { id: "settings", label: "Configuración", icon: Settings },
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
                <tab.icon className="h-4 w-4" />
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
              <div className="h-full flex flex-col">
                <div className="flex-1 flex">
                  <div className="flex-1">
                    <TradingChart
                      apiKeys={apiKeys}
                      balance={balance}
                      setBalance={setBalance}
                      positions={positions}
                      setPositions={setPositions}
                    />
                  </div>
                  <div className="w-80 border-l">
                    <TradingPanel
                      balance={balance}
                      setBalance={setBalance}
                      positions={positions}
                      setPositions={setPositions}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "indicators" && <IndicatorsPanel />}

            {activeTab === "settings" && <SettingsPanel apiKeys={apiKeys} setApiKeys={setApiKeys} />}
          </div>
        </div>

        <div className="w-80 border-l">
          <PositionsPanel positions={positions} setPositions={setPositions} setBalance={setBalance} />
        </div>
      </main>
    </div>
  )
}
