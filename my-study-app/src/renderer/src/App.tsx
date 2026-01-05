import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, TooltipProps } from 'recharts'

// --- 型定義 ---
interface LogData {
  date: string
  topic: string
  duration: string
  acquisition: string
  debt: string
  nextAction: string
}

interface HistoryItem {
  id: string
  date: string
  topic: string
  duration: number
  acquisition: string
}

interface GraphData {
  name: string    // 日付 (MM/DD)
  minutes: number // 合計時間
  topics: string[] // その日のトピック一覧
}

declare global {
  interface Window {
    api: {
      saveLog: (data: LogData) => Promise<{ success: boolean; path?: string; error?: string }>
      getLogs: () => Promise<Array<HistoryItem>>
    }
  }
}

type AppMode = 'idle' | 'running' | 'review'

// --- グラフ用データ加工関数 ---
const processDataForGraph = (logs: Array<HistoryItem>): GraphData[] => {
  const map = new Map<string, { minutes: number; topics: Set<string> }>()
  
  logs.forEach(log => {
    const dateKey = new Date(log.date).toLocaleDateString() // ロケールに合わせて日付を文字列化
    const current = map.get(dateKey) || { minutes: 0, topics: new Set() }
    
    current.minutes += log.duration
    current.topics.add(log.topic) // Setを使うことで重複トピックを排除
    map.set(dateKey, current)
  })

  return Array.from(map.entries())
    .map(([date, data]) => ({
      name: date.slice(5), // "2024/05/20" -> "05/20" (月/日だけにする簡易処理)
      minutes: data.minutes,
      topics: Array.from(data.topics)
    }))
    .reverse() // 古い順に表示
}

// --- カスタムツールチップコンポーネント ---
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as GraphData;
    return (
      <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <p style={{ fontWeight: 'bold', margin: '0 0 5px' }}>{label}</p>
        <p style={{ color: '#8884d8', margin: 0 }}>Total: {data.minutes} min</p>
        <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
          {data.topics.map((t, i) => (
            <div key={i}>• {t}</div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function App(): React.JSX.Element {
  // --- State ---
  const [mode, setMode] = useState<AppMode>('idle')
  
  // 入力データ
  const [topic, setTopic] = useState<string>('') // <--- 追加: トピック入力用
  const [inputMinutes, setInputMinutes] = useState<string>('25')
  
  // タイマー・振り返り用
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [acquisition, setAcquisition] = useState('')
  const [debt, setDebt] = useState('')
  const [nextAction, setNextAction] = useState('')

  // 履歴データ
  const [history, setHistory] = useState<Array<HistoryItem>>([])

  // --- Helper: 日付を "YYYY-MM-DD HH:mm:ss" 形式にする ---
  const getFormattedDate = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}:${s}`
  }
  // -----------------------------------------------------

  // --- Effect: 履歴読み込み ---
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logs = await window.api.getLogs()
        setHistory(logs)
      } catch (e) {
        console.error(e)
      }
    }
    fetchLogs()
  }, [mode]) // モードが変わるたび（保存完了時など）に再読み込み

  // --- Effect: タイマーロジック ---
  useEffect(() => {
    if (mode === 'running') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft((p) => p - 1), 1000)
        return () => clearTimeout(timer)
      } else {
        setMode('review')
        // ここで通知音を鳴らす等の処理を入れる
      }
    }
    return undefined
  }, [mode, timeLeft])

  // --- Actions ---
  const handleStart = () => {
    const min = parseInt(inputMinutes, 10)
    // トピックが空なら警告してもいいが，今回は必須にはせずデフォルト値を入れるかそのままにする
    if (!topic.trim()) {
      alert('Please enter a topic!')
      return
    }

    if (!isNaN(min) && min > 0) {
      // setTimeLeft(min * 60) // 本番用
      setTimeLeft(3) // デバッグ用 (3秒)
      setMode('running')
    }
  }

  const handleSave = async () => {
    const logData: LogData = {
      date: getFormattedDate(),
      topic: topic, // <--- 修正: 入力されたトピックを使用
      duration: inputMinutes,
      acquisition,
      debt,
      nextAction
    }

    const result = await window.api.saveLog(logData)

    if (result.success) {
      alert(`Saved!\nPath: ${result.path}`)
      setAcquisition('')
      setDebt('')
      setNextAction('')
      // topicとinputMinutesは次回のために残すか，クリアするか選べる（今回は残す）
      setMode('idle')
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // --- View ---
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>
      <h1 style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        Cognitive Commit
      </h1>

      {/* 1. 設定画面 */}
      {mode === 'idle' && (
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          
          {/* Topic Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              What will you learn?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. React Hooks, Linear Algebra..."
              style={{ padding: '10px', fontSize: '18px', width: '300px', textAlign: 'center' }}
            />
          </div>

          {/* Time Input */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              Time (min)
            </label>
            <input
              type="number"
              value={inputMinutes}
              onChange={(e) => setInputMinutes(e.target.value)}
              style={{ padding: '10px', width: '100px', fontSize: '24px', textAlign: 'center' }}
            />
          </div>

          <button
            onClick={handleStart}
            style={{ padding: '15px 50px', fontSize: '20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            COMMIT
          </button>

          {/* グラフ表示エリア */}
          {history.length > 0 && (
            <div style={{ marginTop: '50px', height: '300px', width: '100%' }}>
              <h3 style={{ textAlign: 'left', marginLeft: '20px' }}>Study Trends</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processDataForGraph(history)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  {/* カスタムツールチップを適用 */}
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" fill="#8884d8" name="Study Time" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 2. 計測中画面 */}
      {mode === 'running' && (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h2 style={{ fontSize: '24px' }}>Focusing on: <span style={{ color: '#007bff' }}>{topic}</span></h2>
          <div style={{ fontSize: '120px', fontWeight: 'bold', fontFamily: 'monospace', margin: '30px 0' }}>
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={() => setMode('idle')}
            style={{ padding: '10px 30px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            ABORT
          </button>
        </div>
      )}

      {/* 3. 振り返り画面 */}
      {mode === 'review' && (
        <div style={{ backgroundColor: '#f8f9fa', padding: '30px', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h2 style={{ color: '#0056b3', marginTop: 0 }}>Session Complete!</h2>
          <p style={{ fontSize: '18px' }}>Topic: <strong>{topic}</strong> ({inputMinutes} min)</p>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Acquisition (What did you learn?)</label>
            <textarea
              value={acquisition}
              onChange={(e) => setAcquisition(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Debt (What is unclear?)</label>
            <textarea
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: '#fff0f0' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
          </div>

          <button
            onClick={handleSave}
            style={{ width: '100%', padding: '15px', fontSize: '18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            SAVE LOG
          </button>
        </div>
      )}
    </div>
  )
}

export default App