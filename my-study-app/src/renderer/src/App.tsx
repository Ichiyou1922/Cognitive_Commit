import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, TooltipProps } from 'recharts'
import bellSoundUrl from './assets/bell.ogg'

// --- Types ---
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
  name: string
  minutes: number
  topics: string[]
}

interface Config {
  savePath: string
  gitRepoUrl: string
}

declare global {
  interface Window {
    api: {
      saveLog: (data: LogData) => Promise<{ success: boolean; path?: string; error?: string }>
      getLogs: () => Promise<Array<HistoryItem>>
      selectDirectory: () => Promise<string | null>
      getConfig: () => Promise<Config>
      saveConfig: (config: Config) => Promise<{ success: boolean; error?: string }>
    }
  }
}

type AppMode = 'idle' | 'running' | 'review'

// --- Graph Helper ---
const processDataForGraph = (logs: Array<HistoryItem>): GraphData[] => {
  const map = new Map<string, { minutes: number; topics: Set<string> }>()

  logs.forEach(log => {
    const dateKey = new Date(log.date).toLocaleDateString()
    const current = map.get(dateKey) || { minutes: 0, topics: new Set() }

    current.minutes += log.duration
    current.topics.add(log.topic)
    map.set(dateKey, current)
  })

  return Array.from(map.entries())
    .map(([date, data]) => ({
      name: date.slice(5),
      minutes: data.minutes,
      topics: Array.from(data.topics)
    }))
    .reverse()
}

// --- Components ---

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as GraphData;
    return (
      <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', color: '#333' }}>
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

const WelcomeScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [savePath, setSavePath] = useState('')
  const [gitRepoUrl, setGitRepoUrl] = useState('')

  const handleSelectDir = async () => {
    const path = await window.api.selectDirectory()
    if (path) setSavePath(path)
  }

  const handleConnect = async () => {
    if (!savePath) {
      alert('Please select a save location.')
      return
    }
    const result = await window.api.saveConfig({ savePath, gitRepoUrl })
    if (result.success) {
      onComplete()
    } else {
      alert(`Failed to save configuration: ${result.error || 'Unknown error'}`)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Welcome to Cognitive Commit</h1>
      <p style={{ marginBottom: '30px' }}>To get started, please configure your study environment.</p>

      <div style={{ marginBottom: '20px', textAlign: 'left' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>1. Where to save logs?</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={savePath}
            readOnly
            placeholder="No directory selected"
            style={{ flex: 1, padding: '8px', color: '#333' }}
          />
          <button onClick={handleSelectDir} style={{ padding: '8px 15px', cursor: 'pointer' }}>Select</button>
        </div>
      </div>

      <div style={{ marginBottom: '30px', textAlign: 'left' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>2. GitHub Repository URL (Optional)</label>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 5px 0' }}>
          Supports SSH and HTTP.<br />
          For password-less HTTP push, insert token: <code>https://TOKEN@github.com/...</code>
        </p>
        <input
          type="text"
          value={gitRepoUrl}
          onChange={(e) => setGitRepoUrl(e.target.value)}
          placeholder="https://github.com/username/repo.git"
          style={{ width: '100%', padding: '8px', color: '#333' }}
        />
      </div>

      <button
        onClick={handleConnect}
        style={{ padding: '15px 40px', fontSize: '18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        Connect & Start
      </button>
    </div>
  )
}

const SettingsScreen = ({ onClose }: { onClose: () => void }) => {
  const [savePath, setSavePath] = useState('')
  const [gitRepoUrl, setGitRepoUrl] = useState('')

  useEffect(() => {
    window.api.getConfig().then(config => {
      setSavePath(config.savePath)
      setGitRepoUrl(config.gitRepoUrl)
    })
  }, [])

  const handleSelectDir = async () => {
    const path = await window.api.selectDirectory()
    if (path) setSavePath(path)
  }

  const handleSave = async () => {
    const result = await window.api.saveConfig({ savePath, gitRepoUrl })
    if (result.success) {
      onClose()
    } else {
      alert(`Failed to save: ${result.error}`)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333' }}>
      <h2>Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Save Location</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" value={savePath} readOnly style={{ flex: 1, padding: '8px' }} />
          <button onClick={handleSelectDir} style={{ padding: '8px' }}>Change</button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>GitHub URL</label>
        <input
          type="text"
          value={gitRepoUrl}
          onChange={(e) => setGitRepoUrl(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ textAlign: 'right' }}>
        <button onClick={onClose} style={{ marginRight: '10px', padding: '10px 20px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  )
}

const MainScreen = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  const [mode, setMode] = useState<AppMode>('idle')
  const [topic, setTopic] = useState<string>('')
  const [inputMinutes, setInputMinutes] = useState<string>('25')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [acquisition, setAcquisition] = useState('')
  const [debt, setDebt] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [history, setHistory] = useState<Array<HistoryItem>>([])

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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logs = await window.api.getLogs()
        setHistory(logs)
      } catch (e) { console.error(e) }
    }
    fetchLogs()
  }, [mode])


  useEffect(() => {
    if (mode === 'running') {
      if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft((p) => p - 1), 1000)
        return () => clearTimeout(timer)
      } else {
        const audio = new Audio(bellSoundUrl)
        audio.play().catch((e) => console.error('Failed to play sound:', e))
        setMode('review')
      }
    }
    return undefined
  }, [mode, timeLeft])


  const handleStart = () => {
    const min = parseInt(inputMinutes, 10)
    if (!topic.trim()) {
      alert('Please enter a topic!')
      return
    }
    if (!isNaN(min) && min > 0) {
      setTimeLeft(min * 60)
      setMode('running')
    }
  }

  const handleSave = async () => {
    const logData: LogData = {
      date: getFormattedDate(),
      topic: topic,
      duration: inputMinutes,
      acquisition,
      debt,
      nextAction
    }
    const result = await window.api.saveLog(logData)
    if (result.success) {
      let msg = `Saved!\nPath: ${result.path}`
      if (result.error) {
        msg += `\n\n⚠️ Git Sync Warning:\n${result.error}`
      }
      alert(msg)
      setAcquisition('')
      setDebt('')
      setNextAction('')
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

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', color: '#333', position: 'relative', paddingBottom: '60px' }}>

      <h1 style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
        Cognitive Commit
      </h1>

      <button
        onClick={onOpenSettings}
        style={{ position: 'fixed', bottom: '20px', left: '20px', padding: '10px 15px', cursor: 'pointer', zIndex: 100, backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '5px' }}
      >
        ⚙️ Settings
      </button>

      {mode === 'idle' && (
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
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

          {history.length > 0 && (
            <div style={{ marginTop: '50px', height: '300px', width: '100%' }}>
              <h3 style={{ textAlign: 'left', marginLeft: '20px' }}>Study Trends</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processDataForGraph(history)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" fill="#8884d8" name="Study Time" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

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

function App(): React.JSX.Element {
  const [hasConfig, setHasConfig] = useState<boolean | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const checkConfig = async () => {
      const config = await window.api.getConfig()
      if (config.savePath) {
        setHasConfig(true)
      } else {
        setHasConfig(false)
      }
    }
    checkConfig()
  }, [])

  if (hasConfig === null) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>
  }

  if (!hasConfig) {
    return <WelcomeScreen onComplete={() => setHasConfig(true)} />
  }

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />
  }

  return <MainScreen onOpenSettings={() => setShowSettings(true)} />
}

export default App