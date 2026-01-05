// src/renderer/srcApp.tsx

// Reactから "useState" という機能を借りてくる
import { useState } from 'react'

function App(): JSX.Element {
  // timer: 初期値は25分
  const [time, setTime] = useState<string>('25')

  return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'white'}}>
      <h1>Cognitive Commit</h1>

      {/* 入力フォーム */}
      <div style={{ marginBottom: '20px' }}>
        <label>Set Time (min): </label>
        <input
          type="number"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ padding: '5px' }}
        />
      </div>

      { /*ボタン*/ }
      <button style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer'}}>
        Start Focus
      </button>

      {/*動作確認用の表示*/}
      <p>Target: {time} minutes</p> 
    </div>
  )
}

export default App