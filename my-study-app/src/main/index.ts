import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
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
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return { savePath: '', gitRepoUrl: '' }
}

const saveConfigToFile = (config: { savePath: string; gitRepoUrl: string }) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Failed to save config:', e)
    return false
  }
}

// --- IPC Implementations ---

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('get-config', async () => {
  return loadConfig()
})

ipcMain.handle('save-config', async (_event, config) => {
  const success = saveConfigToFile(config)
  if (success && config.savePath && config.gitRepoUrl) {
    // Git連携のセットアップ
    try {
      if (!fs.existsSync(config.savePath)) {
        fs.mkdirSync(config.savePath, { recursive: true })
      }
      
      const git = simpleGit(config.savePath)
      
      // init if needed
      if (!fs.existsSync(path.join(config.savePath, '.git'))) {
        await git.init()
      }

      // remote add or set-url
      const remotes = await git.getRemotes(true)
      const origin = remotes.find(r => r.name === 'origin')
      
      if (origin) {
        if (origin.refs.push !== config.gitRepoUrl) {
          await git.remote(['set-url', 'origin', config.gitRepoUrl])
        }
      } else {
        await git.addRemote('origin', config.gitRepoUrl)
      }
      
      // 初回連携時にfetchしてみる (オプション)
      // await git.fetch() 
      
    } catch (e) {
      console.error('Git setup failed:', e)
      // Config保存は成功したことにすうるが、エラーログは残す
    }
  }
  return success
})

ipcMain.handle('save-log', async (_event, data) => {
  try {
    const config = loadConfig()
    if (!config.savePath) {
        throw new Error('Save path is not configured.')
    }
    const dirPath = config.savePath // ユーザー設定のパスを直接使う
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    const git = simpleGit(dirPath)

    if (!fs.existsSync(path.join(dirPath, '.git'))) {
      await git.init()
    }

    const safeTopic = data.topic.replace(/[^a-zA-Z0-9]/g, '_')
    const now = new Date()
    const datePart = now.toISOString().split('T')[0]
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    const fileName = `${datePart}_${timePart}_${safeTopic}.md`
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

    console.log('Starting Git operations...')
    await git.add('.')
    await git.commit(`[Study] ${data.topic} (${data.duration}min)`)

    // ConfigにURLがあればPushを試みる
    if (config.gitRepoUrl) {
        try {
            await git.push('origin', 'main')
        } catch (e) {
            console.warn('Git push failed (possibly due to auth or non-main branch):', e)
        }
    }

    return { success: true, path: filePath }

  } catch (error) {
    console.error('Failed to save:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('get-logs', async () => {
  try {
    const config = loadConfig()
    if (!config.savePath) return []
    const dirPath = config.savePath
    
    if (!fs.existsSync(dirPath)) {
      return []
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.md'))
    
    const logs = files.map(file => {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8')
      const dateMatch = content.match(/date: "(.*?)"/)
      const topicMatch = content.match(/topic: "(.*?)"/)
      const durationMatch = content.match(/duration: "(.*?)"/)
      
      return {
        id: file,
        date: dateMatch ? dateMatch[1] : '',
        topic: topicMatch ? topicMatch[1] : 'Unknown',
        duration: durationMatch ? parseInt(durationMatch[1], 10) : 0
      }
    })

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  } catch (error) {
    console.error('Failed to get logs:', error)
    return []
  }
})
// ---------------------------