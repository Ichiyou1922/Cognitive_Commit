import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

// App.tsx の上部に追加
interface LogData {
  date: string
  topic: string
  duration: string
  acquisition: string
  debt: string
  nextAction: string
}

declare global {
  interface Window {
    api: {
      saveLog: (data: LogData) => Promise<{ success: boolean; path?: string; error?: string }>
      getLogs: () => Promise<Array<{ id: string; date: string; topic: string; duration: number; acquisition: string }>>
    }
  }
}

// データを「日付: 合計時間」の形にまとめる関数
const processDataForGraph = (logs: Array<{ date: string; duration: number }>) => {
  // 1. 日付ごとの辞書を作る { "2024-05-20": 45, "2024-05-21": 30 }
  const map = new Map<string, number>()
  
  logs.forEach(log => {
    // 日付文字列 (YYYY-MM-DD) を取得
    const dateKey = new Date(log.date).toLocaleDateString()
    const current = map.get(dateKey) || 0
    map.set(dateKey, current + log.duration)
  })

  // 2. グラフ用の配列に変換 [ { name: "5/20", minutes: 45 }, ... ]
  // 日付順にソートしておく
  return Array.from(map.entries())
    .map(([date, total]) => ({ name: date, minutes: total }))
    .reverse() // 元が新しい順なので，グラフ用に古い順(左→右)にするならreverseが必要かも
    // (※お好みで調整．今回は直近7日分だけ出すなどの制限もアリだが一旦全量出す)
}

// アプリの状態を定義（型定義）
type AppMode = 'idle' | 'running' | 'review'

function App(): React.JSX.Element {
  // --- State ---
  const [mode, setMode] = useState<AppMode>('idle')
  const [inputMinutes, setInputMinutes] = useState<string>('25')
  const [timeLeft, setTimeLeft] = useState<number>(0)

  // 振り返り入力用のState
  const [acquisition, setAcquisition] = useState('') // 理解したこと
  const [debt, setDebt] = useState('') // 理解できなかったこと
  const [nextAction, setNextAction] = useState('') // 次のアクション

  // 追加: 過去のログデータを持つState
  const [history, setHistory] = useState<Array<{ id: string; date: string; topic: string; duration: number }>>([])

  // --- Effect (Timer Logic) ---
  useEffect(() => {
    if (mode === 'running') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => {
          setTimeLeft((prev) => prev - 1)
        }, 1000)
        return (): void => clearTimeout(timer)
      } else {
        // Time is 0, switch to review mode
        // eslint-disable-next-line
        setMode('review')
      }
    }
    return undefined
  }, [mode, timeLeft])

  useEffect(() => {
    const fetchLogs = async () => {
      const logs = await window.api.getLogs()
      console.log('Loaded Logs:', logs) // console
      setHistory(logs)
    }

    fetchLogs()
  }, [mode])

  // --- Actions ---
  const handleStart = (): void => {
    const min = parseInt(inputMinutes, 10)
    if (!isNaN(min) && min > 0) {
      // setTimeLeft(min * 60)
      setTimeLeft(5) // デバッグ用: 5秒ですぐ終わらせたい時はこっちを使う
      setMode('running')
    }
  }

  const handleSave = async (): Promise<void> => {
    // async をつけるのを忘れるな
    const logData = {
      date: new Date().toISOString(),
      topic: 'React_Study', // ファイル名用に英語にしておく
      duration: inputMinutes,
      acquisition,
      debt,
      nextAction
    }

    console.log('Sending to Main Process...', logData)

    // --- 変更点: window.api.saveLog を呼ぶ ---
    const result = await window.api.saveLog(logData)

    if (result.success) {
      alert(`保存成功！\n場所: ${result.path}`)
      // 成功したらフォームをクリア
      setAcquisition('')
      setDebt('')
      setNextAction('')
      setMode('idle')
    } else {
      alert(`保存失敗...\n${result.error}`)
    }
    // ----------------------------------------
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // --- View ---
  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: 'sans-serif',
        color: '#333'
      }}
    >
      <h1 style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        Cognitive Commit
      </h1>

      {/* 1. 設定画面 */}
      {mode === 'idle' && (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h2>何を学びますか？</h2>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>
            <input
              type="number"
              value={inputMinutes}
              onChange={(e) => setInputMinutes(e.target.value)}
              style={{ padding: '10px', width: '80px', fontSize: '24px', textAlign: 'center' }}
            />
            <span style={{ marginLeft: '10px' }}>min</span>
          </div>
          <button
            onClick={handleStart}
            style={{
              padding: '15px 40px',
              fontSize: '20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            COMMIT & START
          </button>
          {/* ↓↓↓ 追加: グラフ表示エリア ↓↓↓ */}
          {history.length > 0 && (
            <div style={{ marginTop: '40px', height: '300px', width: '100%' }}>
              <h3 style={{ textAlign: 'left', marginLeft: '20px' }}>Study Trends</h3>
              
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processDataForGraph(history)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="minutes" fill="#8884d8" name="Study Time (min)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* ↑↑↑ 追加ここまで ↑↑↑ */}
        </div>
      )}

      {/* 2. 計測中画面 */}
      {mode === 'running' && (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h2>Focusing...</h2>
          <div
            style={{
              fontSize: '100px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              margin: '20px 0'
            }}
          >
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={() => setMode('idle')} // 本当は理由を聞くべきだが今は省略
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            GIVE UP
          </button>
        </div>
      )}

      {/* 3. 振り返り画面 (今回の核心) */}
      {mode === 'review' && (
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #ddd'
          }}
        >
          <h2 style={{ color: '#0056b3' }}>Session Complete.</h2>
          <p>お疲れ様でした．脳内のキャッシュを書き出してください．</p>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Acquisition (理解したこと・成果)
            </label>
            <textarea
              value={acquisition}
              onChange={(e) => setAcquisition(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc'
              }}
              placeholder="例: useStateは状態を保持するフックであると理解した"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Debt (理解できなかったこと・負債)
            </label>
            <textarea
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                backgroundColor: '#fff0f0'
              }}
              placeholder="例: useEffectの依存配列の挙動がまだ怪しい"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Next Action (次の一手)
            </label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc'
              }}
              placeholder="例: 公式ドキュメントのEffectの章を読む"
            />
          </div>

          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            SAVE LOG to CONSOLE
          </button>
        </div>
      )}
    </div>
  )
}

export default App
