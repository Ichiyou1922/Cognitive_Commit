import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// --- 追加部分 1: Node.jsのモジュールを読み込む ---
import fs from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
// ---------------------------------------------

// Add no-sandbox switch for environment compatibility (Fix for Linux environments)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

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

// --- ここから追記 ---
ipcMain.handle('save-log', async (_event, data) => {
  try {
    const dirPath = path.join(app.getPath('documents'), 'study-logs')
    
    // フォルダ作成 (Fix: Create dir BEFORE initializing simpleGit)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    const git = simpleGit(dirPath)

    // git init
    if (!fs.existsSync(path.join(dirPath, '.git'))) {
      await git.init()
    }

    // ファイル書き込み
    const safeTopic = data.topic.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${new Date().toISOString().split('T')[0]}_${safeTopic}.md`
    const filePath = path.join(dirPath, fileName)

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
    fs.writeFileSync(filePath, content, 'utf-8')

    // Gitコミット
    console.log('Starting Git operations...')
    await git.add('.')
    await git.commit(`[Study] ${data.topic} (${data.duration}min)`)

    // Push (エラーが出ても無視して進む)
    try {
        await git.push('origin', 'main')
    } catch (e) {
        console.warn('Git push skipped:', e)
    }

    return { success: true, path: filePath }

  } catch (error) {
    console.error('Failed to save:', error)
    return { success: false, error: String(error) }
  }
})
