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

const loadConfig = (): { savePath: string; gitRepoUrl: string } => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return { savePath: '', gitRepoUrl: '' }
}

const saveConfigToFile = (config: { savePath: string; gitRepoUrl: string }): boolean => {
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
  const saveResult = saveConfigToFile(config)
  if (!saveResult) {
    return { success: false, error: 'Failed to write config file' }
  }

  if (config.savePath) {
    // Git連携のセットアップ
    try {
      if (!fs.existsSync(config.savePath)) {
        fs.mkdirSync(config.savePath, { recursive: true })
      }

      const git = simpleGit(config.savePath)

      // init if needed
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        await git.init()
      }

      // ブランチ名を main に強制
      await git.raw(['branch', '-M', 'main'])

      // コミット用ユーザー設定 (未設定によるエラー回避)
      try {
        await git.addConfig('user.name', 'Cognitive Commit App')
        await git.addConfig('user.email', 'app@cognitive-commit.local')
      } catch (e) {
        console.warn('Failed to set git config:', e)
      }

      // ConfigにURLがあれば設定
      if (config.gitRepoUrl) {
        // remote add or set-url
        const remotes = await git.getRemotes(true)
        const origin = remotes.find((r) => r.name === 'origin')

        if (origin) {
          if (origin.refs.push !== config.gitRepoUrl) {
            await git.remote(['set-url', 'origin', config.gitRepoUrl])
          }
        } else {
          await git.addRemote('origin', config.gitRepoUrl)
        }

        // 接続テスト (fetch)
        try {
          // リモートが空の場合はこれで失敗するが、それは正常な場合もある
          await git.fetch('origin', 'main', { '--depth': '1' })
        } catch (e) {
          console.warn('Git fetch failed (likely empty repo or auth error):', e)
          const errorMsg = e instanceof Error ? e.message : String(e)
          // "couldn't find remote ref main" は空リポジトリの典型的なエラーなので許容する
          if (
            errorMsg.includes("couldn't find remote ref") ||
            errorMsg.includes("fatal: couldn't find remote ref")
          ) {
            // 空リポジトリとみなして成功を返す
            return { success: true }
          }
          // その他のエラー (認証失敗など) は警告として返す
          return {
            success: true,
            error: `Config saved, but connection check failed (Repo might be empty or Auth failed): ${errorMsg}`
          }
        }
      }
    } catch (e) {
      console.error('Git setup failed:', e)
      return {
        success: false,
        error: `Git setup failed: ${e instanceof Error ? e.message : String(e)}`
      }
    }
  }
  return { success: true }
})

ipcMain.handle('save-log', async (_event, data) => {
  console.log('--- save-log handler called ---')
  console.log('Data:', JSON.stringify(data, null, 2))
  try {
    const config = loadConfig()
    console.log('Loaded Config:', JSON.stringify(config, null, 2))

    if (!config.savePath) {
      throw new Error('Save path is not configured.')
    }
    const basePath = config.savePath // ユーザー設定のパスを直接使う
    console.log('Base directory:', basePath)

    if (!fs.existsSync(basePath)) {
      console.log('Base directory does not exist, creating...')
      fs.mkdirSync(basePath, { recursive: true })
    }

    const git = simpleGit(basePath)

    if (!fs.existsSync(path.join(basePath, '.git'))) {
      await git.init()
    }

    // Config設定 (念のため毎回確認)
    await git.addConfig('user.name', 'Cognitive Commit App')
    await git.addConfig('user.email', 'app@cognitive-commit.local')

    // 年月日ディレクトリを作成
    const now = new Date()
    const datePart = now.toISOString().split('T')[0] // YYYY-MM-DD
    const dateDir = path.join(basePath, datePart)

    if (!fs.existsSync(dateDir)) {
      console.log(`Creating date directory: ${dateDir}`)
      fs.mkdirSync(dateDir, { recursive: true })
    }

    const safeTopic = data.topic.replace(/[^a-zA-Z0-9]/g, '_')
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    const fileName = `${timePart}_${safeTopic}.md`
    const filePath = path.join(dateDir, fileName)

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
    const commitResult = await git.commit(`[Study] ${data.topic} (${data.duration}min)`)
    console.log('Commit result:', commitResult)

    // Commit後にブランチ名を強制変更 (Commitがないと branch -M が失敗する環境があるため)
    try {
      await git.raw(['branch', '-M', 'main'])
    } catch (e) {
      console.warn('Failed to rename branch to main:', e)
    }

    // ConfigにURLがあればPushを試みる
    if (config.gitRepoUrl) {
      try {
        // -u オプションをつけて push
        console.log('Pushing to remote...')
        await git.push(['-u', 'origin', 'main'])
      } catch (e) {
        console.warn('Git push failed:', e)
        return {
          success: true,
          path: filePath,
          error: `Saved locally, but Git Push failed: ${e instanceof Error ? e.message : String(e)}`
        }
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
    const basePath = config.savePath

    if (!fs.existsSync(basePath)) {
      return []
    }

    // ルートディレクトリ直下のmdファイルと、サブディレクトリ内のmdファイルを再帰的に取得
    const getAllMdFiles = (dir: string): string[] => {
      const results: string[] = []
      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          // .gitディレクトリは除外
          if (item !== '.git') {
            results.push(...getAllMdFiles(fullPath))
          }
        } else if (item.endsWith('.md')) {
          results.push(fullPath)
        }
      }

      return results
    }

    const filePaths = getAllMdFiles(basePath)

    const logs = filePaths.map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8')
      const dateMatch = content.match(/date: "(.*?)"/)
      const topicMatch = content.match(/topic: "(.*?)"/)
      const durationMatch = content.match(/duration: "(.*?)"/)
      const acquisitionMatch = content.match(/## Acquisition\n([\s\S]*?)(?=\n## |$)/)

      return {
        id: path.relative(basePath, filePath),
        date: dateMatch ? dateMatch[1] : '',
        topic: topicMatch ? topicMatch[1] : 'Unknown',
        duration: durationMatch ? parseInt(durationMatch[1], 10) : 0,
        acquisition: acquisitionMatch ? acquisitionMatch[1].trim() : ''
      }
    })

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (error) {
    console.error('Failed to get logs:', error)
    return []
  }
})
// ---------------------------
