"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

interface CryptoData {
  date: Date
  symbol: string
  price: number
}

interface CryptoIndexChartProps {
  className?: string
}

export function CryptoIndexChart({ className }: CryptoIndexChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<CryptoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cryptos = [
    { symbol: "BTCUSDT", name: "Bitcoin", color: "#f7931a" },
    { symbol: "ETHUSDT", name: "Ethereum", color: "#627eea" },
    { symbol: "XRPUSDT", name: "XRP", color: "#23292f" },
    { symbol: "SOLUSDT", name: "Solana", color: "#9945ff" },
    { symbol: "DOGEUSDT", name: "Dogecoin", color: "#c2a633" },
    { symbol: "BNBUSDT", name: "BNB", color: "#f3ba2f" }
  ]

  // Función para obtener datos históricos de Binance
  const fetchHistoricalData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const promises = cryptos.map(async (crypto) => {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${crypto.symbol}&interval=1d&limit=30`
        )
        const klines = await response.json()
        
        return klines.map((kline: any[]) => ({
          date: new Date(kline[0]),
          symbol: crypto.name,
          price: parseFloat(kline[4]) // Close price
        }))
      })
      
      const results = await Promise.all(promises)
      const allData = results.flat()
      setData(allData)
    } catch (err) {
      setError("Error obteniendo datos de mercado")
      console.error("Error fetching data:", err)
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchHistoricalData()
  }, [])

  // Crear el gráfico D3
  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Dimensiones del gráfico
    const width = 928
    const height = 400
    const marginTop = 20
    const marginRight = 100
    const marginBottom = 30
    const marginLeft = 40

    // Crear escala de tiempo horizontal
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([marginLeft, width - marginRight])
      .clamp(true)

    // Normalizar las series con respecto al primer valor
    const series = d3.groups(data, d => d.symbol).map(([key, values]) => {
      const firstValue = values[0].price
      return {
        key,
        values: values.map(d => ({
          date: d.date,
          value: d.price / firstValue
        }))
      }
    })

    // Crear escala vertical logarítmica
    const k = d3.max(series, ({ values }) => 
      d3.max(values, d => d.value)! / d3.min(values, d => d.value)!
    )!
    
    const y = d3.scaleLog()
      .domain([1 / k, k])
      .rangeRound([height - marginBottom, marginTop])

    // Escala de colores
    const colorMap = new Map(cryptos.map(c => [c.name, c.color]))
    const z = (key: string) => colorMap.get(key) || "#666"

    // Bisector para encontrar el punto más cercano
    const bisect = d3.bisector((d: any) => d.date).left

    // Configurar el SVG
    svg.attr("width", width)
       .attr("height", height)
       .attr("viewBox", [0, 0, width, height])
       .style("max-width", "100%")
       .style("height", "auto")

    // Crear ejes
    svg.append("g")
       .attr("transform", `translate(0,${height - marginBottom})`)
       .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))
       .call(g => g.select(".domain").remove())

    svg.append("g")
       .attr("transform", `translate(${marginLeft},0)`)
       .call(d3.axisLeft(y).ticks(null, (x: any) => +x.toFixed(6) + "×"))
       .call(g => g.selectAll(".tick line")
         .clone()
         .attr("stroke-opacity", (d: any) => d === 1 ? null : 0.2)
         .attr("x2", width - marginLeft - marginRight))
       .call(g => g.select(".domain").remove())

    // Línea de referencia vertical
    const rule = svg.append("g")
      .append("line")
      .attr("y1", height)
      .attr("y2", 0)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.3)

    // Crear líneas y etiquetas para cada serie
    const serie = svg.append("g")
      .style("font", "bold 10px sans-serif")
      .selectAll("g")
      .data(series)
      .join("g")

    const line = d3.line<any>()
      .x(d => x(d.date))
      .y(d => y(d.value))

    serie.append("path")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke", d => z(d.key))
      .attr("d", d => line(d.values))

    serie.append("text")
      .datum(d => ({
        key: d.key,
        value: d.values[d.values.length - 1].value
      }))
      .attr("fill", d => z(d.key))
      .attr("paint-order", "stroke")
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 3)
      .attr("x", x.range()[1] + 3)
      .attr("y", d => y(d.value))
      .attr("dy", "0.35em")
      .text(d => d.key)

    // Función de actualización para interactividad
    function update(date: Date) {
      date = d3.timeDay.round(date)
      rule.attr("transform", `translate(${x(date) + 0.5},0)`)
      
      serie.attr("transform", ({ values }: any) => {
        const i = bisect(values, date, 0, values.length - 1)
        return `translate(0,${y(1) - y(values[i].value / values[0].value)})`
      })
    }

    // Animación inicial
    d3.transition()
      .ease(d3.easeCubicOut)
      .duration(1500)
      .tween("date", () => {
        const i = d3.interpolateDate(x.domain()[1], x.domain()[0])
        return (t: number) => update(i(t))
      })

    // Interactividad con mouse
    svg.on("mousemove touchmove", function(event) {
      const [mouseX] = d3.pointer(event, this)
      update(x.invert(mouseX))
    })

  }, [data])

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Índice de Criptomonedas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Cargando datos...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Índice de Criptomonedas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96 text-red-500">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Índice de Criptomonedas (30 días)</CardTitle>
          <div className="flex flex-wrap gap-2">
            {cryptos.map(crypto => (
              <Badge 
                key={crypto.symbol} 
                variant="outline" 
                style={{ borderColor: crypto.color, color: crypto.color }}
              >
                {crypto.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg ref={svgRef} className="w-full" />
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Gráfico normalizado mostrando el rendimiento relativo de cada criptomoneda.</p>
          <p>Pasa el mouse sobre el gráfico para ver los valores en diferentes fechas.</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default CryptoIndexChart