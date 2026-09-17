/**
 * 开发启动前清理本项目的旧 Vite / Electron / Flask 进程，避免 5173 被占用后
 * Vite 静默换端口而 Electron 仍加载 localhost:5173，导致窗口闪退或界面无法打开。
 *
 * Windows 10/11 已移除 wmic，命令行查询改用 PowerShell Get-CimInstance。
 */
const { execSync } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const rootNorm = projectRoot.toLowerCase().replace(/\//g, '\\')
const DEV_PORTS = [5173, 5174, 5175, 5176, 5000]
const selfPid = String(process.pid)
const parentPid = process.ppid ? String(process.ppid) : ''

function getListeningPids(port) {
  if (process.platform === 'win32') {
    try {
      const out = execSync('netstat -ano', { encoding: 'utf-8', windowsHide: true })
      const pids = new Set()
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(`:${port}`) || !line.includes('LISTENING')) continue
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
      }
      return [...pids]
    } catch {
      return []
    }
  }
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf-8' })
    return out
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

function getCommandLine(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
        { encoding: 'utf-8', windowsHide: true, timeout: 8000 },
      )
      return String(out || '').trim()
    }
    return execSync(`ps -p ${pid} -o args=`, { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function normalizeCmd(cmd) {
  return String(cmd || '').toLowerCase().replace(/\//g, '\\')
}

function isThisProjectDevProcess(cmd) {
  const c = normalizeCmd(cmd)
  if (!c) return false
  if (c.includes('vitest')) return false
  const inProject =
    c.includes('cinf_mining_engineering') ||
    c.includes('cinf-mining-engineering') ||
    c.includes(rootNorm)
  if (!inProject) return false
  return (
    c.includes('vite.js') ||
    c.includes('\\vite\\') ||
    c.includes('electron') ||
    c.includes('esbuild') ||
    c.includes('concurrently') ||
    c.includes('wait-on') ||
    c.includes('backend\\app.py') ||
    c.includes('backend.exe')
  )
}

function shouldKillDevProcess(pid, port) {
  if (pid === selfPid || pid === parentPid) return false
  const cmd = getCommandLine(pid)
  if (isThisProjectDevProcess(cmd)) return true
  // 本机已无 wmic 时，命令行可能为空；开发口 5173–5176 仍结束占用，避免无法二次启动
  if (!cmd && [5173, 5174, 5175, 5176].includes(port)) return true
  return false
}

function listImagePids(imageName) {
  if (process.platform !== 'win32') return []
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${imageName}" /FO CSV /NH`, {
      encoding: 'utf-8',
      windowsHide: true,
    })
    const pids = []
    for (const line of String(out || '').split(/\r?\n/)) {
      const cols = line.split('","')
      const pid = (cols[1] || '').replace(/"/g, '').trim()
      if (/^\d+$/.test(pid)) pids.push(pid)
    }
    return pids
  } catch {
    return []
  }
}

function listProjectDevPids() {
  if (process.platform !== 'win32') return []
  const pids = []
  for (const image of ['node.exe', 'electron.exe', 'esbuild.exe', 'python.exe']) {
    for (const pid of listImagePids(image)) {
      if (pid === selfPid || pid === parentPid) continue
      if (isThisProjectDevProcess(getCommandLine(pid))) pids.push(pid)
    }
  }
  return pids
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', windowsHide: true })
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

const killed = new Set()
function killOnce(pid, reason) {
  if (!pid || killed.has(pid) || pid === selfPid || pid === parentPid) return
  if (killPid(pid)) {
    killed.add(pid)
    console.log(`[dev] 已结束${reason} PID: ${pid}`)
  }
}

for (const port of DEV_PORTS) {
  for (const pid of getListeningPids(port)) {
    if (!shouldKillDevProcess(pid, port)) continue
    killOnce(pid, `占用 ${port} 端口的旧进程`)
  }
}

for (const pid of listProjectDevPids()) {
  killOnce(pid, '本项目旧开发进程')
}
