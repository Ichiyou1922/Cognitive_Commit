import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// --- 追加部分 1: Node.jsのモジュールを読み込む ---
import fs from 'fs'
import path from 'path'
import os from 'os'
// ---------------------------------------------

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// --- 追加部分 2: IPC通信のリスナー (命令待ち受け) ---
// 画面から 'save-log' というチャンネルでデータが飛んできたら実行する
ipcMain.handle('save-log', async (_event, data) => {
  try {
    // 1. 保存場所を決める (今回はドキュメントフォルダ直下の 'study-logs' フォルダ)
    const dirPath = path.join(app.getPath('documents'), 'study-logs')
    
    // 2. フォルダがなければ作る
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // 3. ファイル名を作る (YYYY-MM-DD_Topic.md)
    // ファイル名に使えない文字を置換する処理も入れるべきだが，今は簡易版
    const safeTopic = data.topic.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${new Date().toISOString().split('T')[0]}_${safeTopic}.md`
    const filePath = path.join(dirPath, fileName)

    // 4. ファイルの中身 (Markdown) を作る
    const content = `---
date: "${data.date}"
topic: "${data.topic}"
duration: "${data.duration}"
---

## Acquisition
${data.acquisition}

## Debt
${data.debt}

## Next Action
${data.nextAction}
`

    // 5. 書き込む
    fs.writeFileSync(filePath, content, 'utf-8')
    
    console.log('File saved to:', filePath) // ターミナルにログが出る
    return { success: true, path: filePath }

  } catch (error) {
    console.error('Failed to save:', error)
    return { success: false, error: String(error) }
  }
})
// ---------------------------------------------