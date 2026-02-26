import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const predictScript = join(projectRoot, 'scripts', 'predict.py')

const requiredFields = [
  'price',
  'volume',
  'volatility',
  'liquidity',
  'rsi',
  'momentum',
  'macd',
  'trend',
  'sentiment',
  'holders',
  'market_cap',
]

function validateFeatures(features) {
  const missing = requiredFields.filter((f) => !(f in features))
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`)
    error.code = 'MISSING_FIELDS'
    throw error
  }
}

export async function getDecision(features) {
  validateFeatures(features)

  return new Promise((resolve, reject) => {
    const child = spawn('python', [predictScript, '--stdin'], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(stderr || `Prediction script exited with code ${code}`)
        err.code = 'PREDICT_FAILED'
        return reject(err)
      }

      try {
        const parsed = JSON.parse(stdout)
        return resolve(parsed)
      } catch (parseError) {
        const err = new Error(`Failed to parse prediction output: ${parseError.message}`)
        err.code = 'PARSE_ERROR'
        return reject(err)
      }
    })

    child.stdin.write(JSON.stringify(features))
    child.stdin.end()
  })
}
