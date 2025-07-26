"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Key, Save, TestTube, Trash2 } from "lucide-react"

interface SettingsPanelProps {
  apiKeys: { openai: string; bingxApiKey: string; bingxSecretKey: string }
  setApiKeys: (keys: { openai: string; bingxApiKey: string; bingxSecretKey: string }) => void
  clearApiKeys: () => void
}

export function SettingsPanel({ apiKeys, setApiKeys, clearApiKeys }: SettingsPanelProps) {
  const [tempApiKey, setTempApiKey] = useState(apiKeys.openai)
  const [tempBingxApiKey, setTempBingxApiKey] = useState(apiKeys.bingxApiKey)
  const [tempBingxSecretKey, setTempBingxSecretKey] = useState(apiKeys.bingxSecretKey)

  // Sincronizar valores temporales cuando las API keys cambian (ej. al cargar desde localStorage)
  useEffect(() => {
    setTempApiKey(apiKeys.openai)
    setTempBingxApiKey(apiKeys.bingxApiKey)
    setTempBingxSecretKey(apiKeys.bingxSecretKey)
  }, [apiKeys])
  const [testResult, setTestResult] = useState("")
  const [bingxTestResult, setBingxTestResult] = useState("")
  const [isTestingAPI, setIsTestingAPI] = useState(false)
  const [isTestingBingX, setIsTestingBingX] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)

  const saveApiKeys = () => {
    setApiKeys({ 
      openai: tempApiKey,
      bingxApiKey: tempBingxApiKey,
      bingxSecretKey: tempBingxSecretKey
    })
    alert("API Keys guardadas correctamente y persistidas en tu navegador")
  }

  const clearAllApiKeys = () => {
    if (confirm("¿Estás seguro de que quieres limpiar todas las API Keys? Esta acción no se puede deshacer.")) {
      setTempApiKey("")
      setTempBingxApiKey("")
      setTempBingxSecretKey("")
      clearApiKeys()
      setTestResult("")
      setBingxTestResult("")
      alert("Todas las API Keys han sido eliminadas")
    }
  }

  const testOpenAIKey = async () => {
    if (!tempApiKey) {
      setTestResult("Por favor ingresa una API Key")
      return
    }

    setIsTestingAPI(true)
    setTestResult("Probando conexión...")

    try {
      const response = await fetch("/api/test-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: tempApiKey }),
      })

      const result = await response.json()

      if (response.ok) {
        setTestResult("✅ API Key válida y funcionando correctamente")
      } else {
        setTestResult(`❌ Error: ${result.error}`)
      }
    } catch {
      setTestResult("❌ Error de conexión")
    } finally {
      setIsTestingAPI(false)
    }
  }

  const testBingXKeys = async () => {
    if (!tempBingxApiKey || !tempBingxSecretKey) {
      setBingxTestResult("Por favor ingresa ambas claves de BingX")
      return
    }

    setIsTestingBingX(true)
    setBingxTestResult("Probando conexión con BingX...")

    try {
      const response = await fetch("/api/test-bingx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          apiKey: tempBingxApiKey,
          secretKey: tempBingxSecretKey
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setBingxTestResult("✅ Conexión con BingX exitosa")
      } else {
        setBingxTestResult(`❌ Error: ${result.error}`)
      }
    } catch {
      setBingxTestResult("❌ Error de conexión con BingX")
    } finally {
      setIsTestingBingX(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Configuración</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>API Keys</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">Necesaria para el análisis de IA y trading automático</div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={testOpenAIKey}
                disabled={isTestingAPI}
                className="flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>{isTestingAPI ? "Probando..." : "Probar"}</span>
              </Button>
            </div>

            {testResult && <div className="p-3 bg-muted rounded text-sm">{testResult}</div>}
          </CardContent>
        </Card>

        {/* BingX API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>BingX API Keys</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bingx-api-key">BingX API Key</Label>
              <Input
                id="bingx-api-key"
                type="password"
                placeholder="Ingresa tu API Key de BingX"
                value={tempBingxApiKey}
                onChange={(e) => setTempBingxApiKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bingx-secret-key">BingX Secret Key</Label>
              <Input
                id="bingx-secret-key"
                type="password"
                placeholder="Ingresa tu Secret Key de BingX"
                value={tempBingxSecretKey}
                onChange={(e) => setTempBingxSecretKey(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">Necesarias para ejecutar operaciones reales en BingX</div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={testBingXKeys}
                disabled={isTestingBingX}
                className="flex items-center space-x-2"
              >
                <TestTube className="h-4 w-4" />
                <span>{isTestingBingX ? "Probando..." : "Probar BingX"}</span>
              </Button>
            </div>

            {bingxTestResult && <div className="p-3 bg-muted rounded text-sm">{bingxTestResult}</div>}
          </CardContent>
        </Card>

        {/* Guardar todas las API Keys */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-4">
            <Button onClick={saveApiKeys} className="flex items-center space-x-2 w-full">
              <Save className="h-4 w-4" />
              <span>Guardar Todas las API Keys</span>
            </Button>
            <Button onClick={clearAllApiKeys} variant="destructive" className="flex items-center space-x-2 w-full">
              <Trash2 className="h-4 w-4" />
              <span>Limpiar Todas las API Keys</span>
            </Button>
          </CardContent>
        </Card>

        {/* Configuración General */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notifications">Notificaciones</Label>
                <div className="text-xs text-muted-foreground">Recibir alertas de operaciones</div>
              </div>
              <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-save">Guardado Automático</Label>
                <div className="text-xs text-muted-foreground">Guardar configuración automáticamente</div>
              </div>
              <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
            </div>

            <div className="space-y-2">
              <Label>Estado de Conexión</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={apiKeys.openai ? "default" : "destructive"}>
                  OpenAI: {apiKeys.openai ? "Conectado" : "No configurado"}
                </Badge>
                <Badge variant={apiKeys.bingxApiKey && apiKeys.bingxSecretKey ? "default" : "destructive"}>
                  BingX: {apiKeys.bingxApiKey && apiKeys.bingxSecretKey ? "Conectado" : "No configurado"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información del Sistema */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Fuente de Datos</Label>
                <div className="text-sm text-muted-foreground">Binance API v3</div>
              </div>
              <div>
                <Label>Frecuencia de Actualización</Label>
                <div className="text-sm text-muted-foreground">Tiempo real (WebSocket)</div>
              </div>
              <div>
                <Label>Indicadores Disponibles</Label>
                <div className="text-sm text-muted-foreground">EMA, MACD, RSI, Volumen</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Funcionalidades</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Badge variant="outline">Trading Manual</Badge>
                <Badge variant="outline">Trading con IA</Badge>
                <Badge variant="outline">Análisis Técnico</Badge>
                <Badge variant="outline">Gestión de Riesgo</Badge>
                <Badge variant="outline">Apalancamiento</Badge>
                <Badge variant="outline">Datos en Tiempo Real</Badge>
                <Badge variant="outline">Historial de Operaciones</Badge>
                <Badge variant="outline">Modo Claro/Oscuro</Badge>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">⚠️ Aviso Importante</h4>
              <p className="text-sm text-muted-foreground">
                Esta plataforma utiliza datos reales de Bitcoin y puede ejecutar operaciones con dinero real cuando se
                configura correctamente. El trading de criptomonedas conlleva riesgos significativos. Solo invierte lo
                que puedas permitirte perder. La IA es una herramienta de asistencia y no garantiza ganancias.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
