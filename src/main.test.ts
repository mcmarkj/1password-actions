// --- Mocks (must be set up before importing main.ts) ---

const mockListVaults = jest.fn()
const mockGetItemByTitle = jest.fn()

jest.mock('@1password/connect', () => ({
  OnePasswordConnect: () => ({
    listVaults: mockListVaults,
    getItemByTitle: mockGetItemByTitle
  })
}))

const mockGetInput = jest.fn()
const mockGetBooleanInput = jest.fn()
const mockSetFailed = jest.fn()
const mockSetSecret = jest.fn()
const mockSetOutput = jest.fn()
const mockExportVariable = jest.fn()
const mockInfo = jest.fn()
const mockWarning = jest.fn()
const mockError = jest.fn()

jest.mock('@actions/core', () => ({
  getInput: (name: string) => mockGetInput(name),
  getBooleanInput: (name: string) => mockGetBooleanInput(name),
  setFailed: (msg: string) => mockSetFailed(msg),
  setSecret: (val: string) => mockSetSecret(val),
  setOutput: (name: string, val: string) => mockSetOutput(name, val),
  exportVariable: (name: string, val: string) => mockExportVariable(name, val),
  info: (msg: string) => mockInfo(msg),
  warning: (msg: string) => mockWarning(msg),
  error: (msg: string) => mockError(msg)
}))

// Use zero delay for tests
jest.mock('ts-retry', () => {
  const actual = jest.requireActual('ts-retry')
  return {
    ...actual,
    createExponetialDelay: () => () => 0
  }
})

// --- Helpers ---

function createAxiosTimeoutError(): Error {
  const error = new Error('timeout of 15000ms exceeded')
  ;(error as unknown as Record<string, unknown>).code = 'ETIMEDOUT'
  ;(error as unknown as Record<string, unknown>).isAxiosError = true
  return error
}

function setupInputs(overrides: {
  failOnNotFound?: boolean
  exportEnvVars?: boolean
  retryCount?: string
  secretPath?: string
} = {}): void {
  const {
    failOnNotFound = true,
    exportEnvVars = false,
    retryCount = '3',
    secretPath = 'TestVault > TestItem'
  } = overrides

  mockGetInput.mockImplementation((name: string) => {
    const inputs: Record<string, string> = {
      'connect-server-url': 'http://localhost:8080',
      'connect-server-token': 'test-token',
      'secret-path': secretPath,
      'retry-count': retryCount
    }
    return inputs[name] ?? ''
  })
  mockGetBooleanInput.mockImplementation((name: string) => {
    if (name === 'fail-on-not-found') return failOnNotFound
    if (name === 'export-env-vars') return exportEnvVars
    return false
  })
}

async function runAction(): Promise<void> {
  // isolateModulesAsync gives us a fresh require of main.ts each test,
  // re-evaluating all top-level code (including the auto-run)
  return jest.isolateModulesAsync(async () => {
    const main = require('./main')
    await main._runPromise
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  setupInputs()
})

describe('vault fetch retry', () => {
  it('retries on AxiosError timeout and succeeds', async () => {
    mockListVaults
      .mockRejectedValueOnce(createAxiosTimeoutError())
      .mockResolvedValueOnce([{name: 'TestVault', id: 'vault-123'}])

    mockGetItemByTitle.mockResolvedValue({
      fields: [{label: 'password', value: 'secret-value'}]
    })

    await runAction()

    expect(mockListVaults).toHaveBeenCalledTimes(2)
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Attempt 1 failed: timeout of 15000ms exceeded')
    )
    expect(mockSetFailed).not.toHaveBeenCalled()
    expect(mockSetOutput).toHaveBeenCalled()
  })

  it('retries on generic network error and succeeds', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:8080')

    mockListVaults
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce([{name: 'TestVault', id: 'vault-123'}])

    mockGetItemByTitle.mockResolvedValue({
      fields: [{label: 'password', value: 'secret-value'}]
    })

    await runAction()

    expect(mockListVaults).toHaveBeenCalledTimes(2)
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Attempt 1 failed: connect ECONNREFUSED')
    )
    expect(mockSetFailed).not.toHaveBeenCalled()
  })

  it('fails after exhausting all retries on persistent timeout', async () => {
    mockListVaults.mockRejectedValue(createAxiosTimeoutError())

    await runAction()

    expect(mockListVaults).toHaveBeenCalledTimes(3)
    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Too many retries')
    )
  })
})

describe('secret fetch retry', () => {
  beforeEach(() => {
    mockListVaults.mockResolvedValue([{name: 'TestVault', id: 'vault-123'}])
  })

  it('retries on AxiosError timeout when fetching secrets', async () => {
    mockGetItemByTitle
      .mockRejectedValueOnce(createAxiosTimeoutError())
      .mockResolvedValueOnce({
        fields: [{label: 'password', value: 'secret-value'}]
      })

    await runAction()

    expect(mockGetItemByTitle).toHaveBeenCalledTimes(2)
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Attempt 1 failed: timeout of 15000ms exceeded')
    )
    expect(mockSetFailed).not.toHaveBeenCalled()
    expect(mockSetOutput).toHaveBeenCalled()
  })

  it('fails after exhausting all retries on persistent secret fetch timeout', async () => {
    mockGetItemByTitle.mockRejectedValue(createAxiosTimeoutError())

    await runAction()

    expect(mockGetItemByTitle).toHaveBeenCalledTimes(3)
    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Too many retries')
    )
  })
})

describe('non-retryable errors', () => {
  beforeEach(() => {
    mockListVaults.mockResolvedValue([{name: 'TestVault', id: 'vault-123'}])
  })

  it('does not retry HTTP 404 when fail-on-not-found is false', async () => {
    setupInputs({failOnNotFound: false})

    const httpError = {status: 404, message: 'Item not found'}
    mockGetItemByTitle.mockRejectedValue(httpError)

    await runAction()

    // With fail-on-not-found=false, HttpError is caught and the function
    // returns successfully — no retry, no failure
    expect(mockGetItemByTitle).toHaveBeenCalledTimes(1)
    expect(mockSetFailed).not.toHaveBeenCalled()
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Continuing as fail-on-not-found is disabled')
    )
  })

  it('retries HTTP 404 when fail-on-not-found is true (permanent failure)', async () => {
    setupInputs({failOnNotFound: true})

    const httpError = {status: 404, message: 'Item not found'}
    mockGetItemByTitle.mockRejectedValue(httpError)

    await runAction()

    // failOnNotFound throws a new Error, which triggers retry — but it
    // will fail every time since the item doesn't exist
    expect(mockGetItemByTitle).toHaveBeenCalledTimes(3)
    expect(mockSetFailed).toHaveBeenCalled()
  })
})
