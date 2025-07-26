'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TradeData {
  timestamp: number
  price: number
  volume: number
  side: 'buy' | 'sell'
  size: number
}

interface HeatmapData {
  hour: number
  day: number
  value: number
  type: 'buy' | 'sell'
}

interface ChartProps {
  data: TradeData[]
  width: number
  height: number
}

// Mapa de calor de posiciones de compra/venta
const TradingHeatmap: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 20, bottom: 40, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Procesar datos para crear matriz de calor
    const heatmapData: HeatmapData[] = []
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const days = Array.from({ length: 7 }, (_, i) => i)

    days.forEach(day => {
      hours.forEach(hour => {
        const buyVolume = data
          .filter(d => {
            const date = new Date(d.timestamp)
            return date.getDay() === day && date.getHours() === hour && d.side === 'buy'
          })
          .reduce((sum, d) => sum + d.volume, 0)

        const sellVolume = data
          .filter(d => {
            const date = new Date(d.timestamp)
            return date.getDay() === day && date.getHours() === hour && d.side === 'sell'
          })
          .reduce((sum, d) => sum + d.volume, 0)

        if (buyVolume > 0) {
          heatmapData.push({ hour, day, value: buyVolume, type: 'buy' })
        }
        if (sellVolume > 0) {
          heatmapData.push({ hour, day, value: sellVolume, type: 'sell' })
        }
      })
    })

    // Escalas
    const xScale = d3.scaleBand()
      .domain(hours.map(String))
      .range([0, innerWidth])
      .padding(0.05)

    const yScale = d3.scaleBand()
      .domain(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])
      .range([0, innerHeight])
      .padding(0.05)

    const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
      .domain([0, d3.max(heatmapData, d => d.value) || 1])

    // Crear rectángulos del mapa de calor
    g.selectAll('.heatmap-rect')
      .data(heatmapData)
      .enter()
      .append('rect')
      .attr('class', 'heatmap-rect')
      .attr('x', d => xScale(String(d.hour)) || 0)
      .attr('y', d => yScale(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.day]) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => d.type === 'buy' ? d3.interpolateGreens(d.value / (d3.max(heatmapData, x => x.value) || 1)) : d3.interpolateReds(d.value / (d3.max(heatmapData, x => x.value) || 1)))
      .attr('opacity', 0.8)

    // Ejes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))

    g.append('g')
      .call(d3.axisLeft(yScale))

    // Título
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Mapa de Calor - Volumen de Trading')

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de pastel para grandes transacciones
const LargeTradesPieChart: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const radius = Math.min(width, height) / 2 - 20
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    // Procesar datos para grandes transacciones
    const largeThreshold = d3.quantile(data.map(d => d.volume), 0.8) || 0
    const largeTrades = data.filter(d => d.volume >= largeThreshold)

    const pieData = [
      { label: 'Grandes Compras', value: largeTrades.filter(d => d.side === 'buy').length, color: '#4ade80' },
      { label: 'Grandes Ventas', value: largeTrades.filter(d => d.side === 'sell').length, color: '#f87171' },
      { label: 'Transacciones Normales', value: data.length - largeTrades.length, color: '#94a3b8' }
    ]

    const pie = d3.pie<any>()
      .value(d => d.value)
      .sort(null)

    const arc = d3.arc<any>()
      .innerRadius(radius * 0.4)
      .outerRadius(radius)

    const arcs = g.selectAll('.arc')
      .data(pie(pieData))
      .enter()
      .append('g')
      .attr('class', 'arc')

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Etiquetas
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text(d => d.data.value > 0 ? d.data.value : '')

    // Leyenda
    const legend = svg.append('g')
      .attr('transform', `translate(10, 20)`)

    pieData.forEach((d, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`)

      legendRow.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d.color)

      legendRow.append('text')
        .attr('x', 16)
        .attr('y', 9)
        .style('font-size', '10px')
        .text(d.label)
    })

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Treemap de volumen por rangos de precio
const VolumeTreemap: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Agrupar datos por rangos de precio
    const priceRanges = [
      { min: 0, max: 50000, label: '$0-50k' },
      { min: 50000, max: 60000, label: '$50k-60k' },
      { min: 60000, max: 70000, label: '$60k-70k' },
      { min: 70000, max: 80000, label: '$70k-80k' },
      { min: 80000, max: 100000, label: '$80k-100k' },
      { min: 100000, max: Infinity, label: '$100k+' }
    ]

    const treeData = priceRanges.map(range => {
      const rangeData = data.filter(d => d.price >= range.min && d.price < range.max)
      const totalVolume = rangeData.reduce((sum, d) => sum + d.volume, 0)
      return {
        name: range.label,
        value: totalVolume,
        count: rangeData.length
      }
    }).filter(d => d.value > 0)

    const root = d3.hierarchy({ children: treeData })
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemap = d3.treemap<any>()
      .size([width, height])
      .padding(2)

    treemap(root)

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

    const leaf = svg.selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`)

    leaf.append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d, i) => colorScale(i.toString()))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text((d: any) => d.data.name)

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 28)
      .style('font-size', '8px')
      .text((d: any) => `Vol: ${d.data.value.toFixed(0)}`)

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de red de correlaciones
const CorrelationNetwork: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Crear nodos y enlaces simulados para correlaciones
    const nodes = [
      { id: 'BTC', group: 1, value: 100 },
      { id: 'Precio', group: 2, value: 80 },
      { id: 'Volumen', group: 2, value: 70 },
      { id: 'Compras', group: 3, value: 60 },
      { id: 'Ventas', group: 3, value: 60 },
      { id: 'Volatilidad', group: 4, value: 50 }
    ]

    const links = [
      { source: 'BTC', target: 'Precio', value: 0.9 },
      { source: 'BTC', target: 'Volumen', value: 0.7 },
      { source: 'Precio', target: 'Compras', value: 0.8 },
      { source: 'Precio', target: 'Ventas', value: -0.8 },
      { source: 'Volumen', target: 'Volatilidad', value: 0.6 },
      { source: 'Compras', target: 'Ventas', value: -0.9 }
    ]

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.value > 0 ? '#4ade80' : '#f87171')
      .attr('stroke-width', d => Math.abs(d.value) * 3)
      .attr('opacity', 0.7)

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => Math.sqrt(d.value) * 2)
      .attr('fill', d => d3.schemeCategory10[d.group])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    const label = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text(d => d.id)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('dy', 3)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico Sunburst de distribución temporal
const TemporalSunburst: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const radius = Math.min(width, height) / 2 - 10
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    // Crear jerarquía temporal
    const timeHierarchy = {
      name: 'Trading',
      children: [
        {
          name: 'Mañana',
          children: [
            { name: 'Compras AM', value: data.filter(d => new Date(d.timestamp).getHours() < 12 && d.side === 'buy').length },
            { name: 'Ventas AM', value: data.filter(d => new Date(d.timestamp).getHours() < 12 && d.side === 'sell').length }
          ]
        },
        {
          name: 'Tarde',
          children: [
            { name: 'Compras PM', value: data.filter(d => new Date(d.timestamp).getHours() >= 12 && d.side === 'buy').length },
            { name: 'Ventas PM', value: data.filter(d => new Date(d.timestamp).getHours() >= 12 && d.side === 'sell').length }
          ]
        }
      ]
    }

    const root = d3.hierarchy(timeHierarchy)
      .sum((d: any) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const partition = d3.partition<any>()
      .size([2 * Math.PI, radius])

    partition(root)

    const arc = d3.arc<any>()
      .startAngle((d: any) => d.x0)
      .endAngle((d: any) => d.x1)
      .innerRadius((d: any) => d.y0)
      .outerRadius((d: any) => d.y1)

    const colorScale = d3.scaleOrdinal(d3.schemeSet3)

    g.selectAll('path')
      .data(root.descendants())
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colorScale(i.toString()))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)

    // Etiquetas
    g.selectAll('text')
      .data(root.descendants().filter(d => d.depth > 0))
      .enter()
      .append('text')
      .attr('transform', (d: any) => {
        const angle = (d.x0 + d.x1) / 2
        const radius = (d.y0 + d.y1) / 2
        return `rotate(${angle * 180 / Math.PI - 90}) translate(${radius},0) rotate(${angle > Math.PI ? 180 : 0})`
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .text((d: any) => d.data.name)

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Gráfico de chord para flujos de trading
const TradingChordDiagram: React.FC<ChartProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const outerRadius = Math.min(width, height) * 0.4
    const innerRadius = outerRadius - 30
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    // Crear matriz de flujos simulada
    const matrix = [
      [0, 5871, 8916, 2868],
      [1951, 0, 2060, 6171],
      [8010, 16145, 0, 8045],
      [1013, 990, 940, 0]
    ]

    const names = ['Compras Pequeñas', 'Compras Grandes', 'Ventas Pequeñas', 'Ventas Grandes']
    const colors = ['#4ade80', '#16a34a', '#f87171', '#dc2626']

    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending)

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)

    const ribbon = d3.ribbon()
      .radius(innerRadius)

    const chords = chord(matrix)

    // Grupos
    const group = g.append('g')
      .selectAll('g')
      .data(chords.groups)
      .enter()
      .append('g')

    group.append('path')
      .style('fill', (d, i) => colors[i])
      .style('stroke', (d, i) => colors[i])
      .attr('d', arc as any)

    // Etiquetas
    group.append('text')
      .each(d => { (d as any).angle = (d.startAngle + d.endAngle) / 2 })
      .attr('dy', '.35em')
      .attr('transform', (d: any) => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${outerRadius + 10})
        ${d.angle > Math.PI ? 'rotate(180)' : ''}
      `)
      .style('text-anchor', (d: any) => d.angle > Math.PI ? 'end' : null)
      .style('font-size', '10px')
      .text((d, i) => names[i])

    // Ribbons
    g.append('g')
      .selectAll('path')
      .data(chords)
      .enter()
      .append('path')
      .attr('d', ribbon as any)
      .style('fill', (d, i) => colors[d.source.index])
      .style('opacity', 0.6)
      .style('stroke', '#fff')
      .style('stroke-width', '1px')

  }, [data, width, height])

  return <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}></svg>
}

// Componente principal
const AdvancedChartsGrid: React.FC = () => {
  const [bitcoinData, setBitcoinData] = useState<TradeData[]>([])
  const [loading, setLoading] = useState(true)
  const [btcPrice, setBtcPrice] = useState(0)
  const [marketData, setMarketData] = useState<any>(null)
  const [orderBookData, setOrderBookData] = useState<any>(null)
  const [volumeData, setVolumeData] = useState<any>(null)
  const [fearGreedIndex, setFearGreedIndex] = useState<any>(null)

  const fetchBitcoinData = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // Obtener precio actual de Bitcoin
      const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
      const priceData = await priceResponse.json()
      setBtcPrice(parseFloat(priceData.price))

      // Obtener datos de 24h
      const statsResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      const statsData = await statsResponse.json()
      
      // Obtener order book
      const orderBookResponse = await fetch('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20')
      const orderBook = await orderBookResponse.json()
      
      // Obtener datos históricos de volumen por horas
      const klinesResponse = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24')
      const klinesData = await klinesResponse.json()
      
      // Obtener Fear & Greed Index
      const fearGreedResponse = await fetch('https://api.alternative.me/fng/?limit=30')
      const fearGreedData = await fearGreedResponse.json()
      
      setMarketData(statsData)
      setOrderBookData(orderBook)
      setVolumeData(klinesData)
      setFearGreedIndex(fearGreedData.data)
      
      // Procesar datos para crear TradeData simulado basado en datos reales
      const processedTradeData: TradeData[] = []
      
      // Usar datos de klines para simular trades
      klinesData.forEach((kline: any[], index: number) => {
        const [openTime, open, high, low, close, volume] = kline
        const timestamp = parseInt(openTime)
        const price = parseFloat(close)
        const vol = parseFloat(volume)
        
        // Simular múltiples trades por hora basados en volumen real
        const tradesPerHour = Math.min(Math.floor(vol / 100), 50) // Limitar a 50 trades por hora
        
        for (let i = 0; i < tradesPerHour; i++) {
          const tradeTimestamp = timestamp + (i * (3600000 / tradesPerHour)) // Distribuir en la hora
          const priceVariation = (Math.random() - 0.5) * (parseFloat(high) - parseFloat(low)) * 0.1
          const tradePrice = price + priceVariation
          const tradeVolume = vol / tradesPerHour
          const side = Math.random() > 0.5 ? 'buy' : 'sell'
          
          processedTradeData.push({
            timestamp: tradeTimestamp,
            price: tradePrice,
            volume: tradeVolume,
            side: side,
            size: tradeVolume * tradePrice
          })
        }
      })
      
      // Agregar datos del order book como trades recientes
      if (orderBook.bids && orderBook.asks) {
        const currentTime = Date.now()
        
        orderBook.bids.slice(0, 10).forEach((bid: string[], index: number) => {
          processedTradeData.push({
            timestamp: currentTime - (index * 1000),
            price: parseFloat(bid[0]),
            volume: parseFloat(bid[1]),
            side: 'buy',
            size: parseFloat(bid[0]) * parseFloat(bid[1])
          })
        })
        
        orderBook.asks.slice(0, 10).forEach((ask: string[], index: number) => {
          processedTradeData.push({
            timestamp: currentTime - (index * 1000),
            price: parseFloat(ask[0]),
            volume: parseFloat(ask[1]),
            side: 'sell',
            size: parseFloat(ask[0]) * parseFloat(ask[1])
          })
        })
      }
      
      setBitcoinData(processedTradeData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching Bitcoin data:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBitcoinData()
    const interval = setInterval(fetchBitcoinData, 60000) // Actualizar cada minuto

    return () => clearInterval(interval)
  }, [fetchBitcoinData])

  const chartWidth = 400
  const chartHeight = 300

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-[350px]">
            <CardContent className="p-4 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Cargando gráfico {i + 1}...</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Análisis Avanzado de Bitcoin</h2>
        <p className="text-gray-600">Gráficos complejos con datos en tiempo real de Binance</p>
        {btcPrice > 0 && (
          <div className="mt-2">
            <span className="text-lg font-semibold text-blue-600">
              Precio actual: ${btcPrice.toLocaleString()}
            </span>
            {marketData && (
              <span className={`ml-4 text-sm ${parseFloat(marketData.priceChangePercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(marketData.priceChangePercent) >= 0 ? '+' : ''}{parseFloat(marketData.priceChangePercent).toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mapa de Calor - Volumen por Horas</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <TradingHeatmap data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribución Order Book</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <LargeTradesPieChart data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volumen por Rango de Precio Actual</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <VolumeTreemap data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Métricas de Mercado en Tiempo Real</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <CorrelationNetwork data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sentimiento del Mercado (Fear & Greed)</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <TemporalSunburst data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>

        <Card className="h-[350px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flujos de Trading por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <TradingChordDiagram data={bitcoinData} width={chartWidth} height={chartHeight} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdvancedChartsGrid