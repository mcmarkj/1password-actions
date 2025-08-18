import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import {HttpError} from '@1password/connect/dist/lib/utils/error'
import {createExponetialDelay, retryAsync} from 'ts-retry'
import * as parsing from './parsing'

interface Field {
  label?: string
  value?: string | number | boolean
}

interface Item {
  fields?: Field[]
}

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const vaults: Map<string, string> = new Map()

const failOnNotFound = core.getBooleanInput('fail-on-not-found')
const retryCount = core.getInput('retry-count')
  ? parseInt(core.getInput('retry-count'), 10)
  : 5
const exportEnvVars = core.getBooleanInput('export-env-vars')

const populateVaultsList = async (): Promise<void> => {
  try {
    const vaultsList = await op.listVaults()
    for (const vault of vaultsList) {
      const vaultName = vault.name ?? ''
      const vaultID = vault.id ?? ''
      if (vaultName && vaultID) {
        vaults.set(vaultName, vaultID)
      } else {
        core.info(`Vault name/ID is empty: ${JSON.stringify(vault)}`)
      }
    }
    core.info(`Vaults list: ${JSON.stringify(Object.fromEntries(vaults))}`)
  } catch (error) {
    core.error(`Error getting vaults: ${error}`)
    core.setFailed('🛑 Error getting vaults.')
    throw error
  }
}

const getVaultID = (vaultName: string): string | undefined => {
  const vaultID = vaults.get(vaultName)
  if (!vaultID) {
    const message = `No vault matched name '${vaultName}'`
    if (failOnNotFound) {
      throw new Error(`🛑 ${message}`)
    }
    core.warning(`⚠️ ${message}`)
  }
  return vaultID
}

const delay = createExponetialDelay(1) // 1, 2, 4, 8, 16... second delay

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  return retryAsync(fn, {
    delay,
    maxTry: retryCount,
    onError: (err, currentTry) => {
      core.warning(`Attempt ${currentTry} failed: ${err.message}`)
      return true
    },
    onMaxRetryFunc: err => {
      throw new Error(`🛑 Too many retries: ${err.message}`)
    }
  })
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  fieldName: string,
  outputString: string,
  outputOverridden: boolean
): Promise<void> => {
  try {
    const vaultItems: Item = await op.getItemByTitle(vaultID, secretTitle)
    const secretFields: Field[] = vaultItems.fields ?? []

    let foundSecret = fieldName === ''
    for (const field of secretFields) {
      if (fieldName && field.label !== fieldName) continue
      if (field.value != null) {
        const name =
          fieldName && outputOverridden
            ? outputString
            : `${outputString}_${(field.label ?? '').toLowerCase()}`
        const value = String(field.value)
        setOutput(name, value)
        setEnvironmental(name, value)
        foundSecret = true
        if (fieldName) break
      }
    }

    if (!foundSecret) {
      const message = `No secret matched '${secretTitle}' with field '${fieldName}'`
      if (failOnNotFound) {
        throw new Error(`🛑 ${message}`)
      }
      core.warning(`⚠️ ${message}`)
    }
  } catch (error) {
    if (isHttpError(error)) {
      const message = `Error for secret: '${secretTitle}' - '${error.message}'`
      if (failOnNotFound) {
        throw new Error(`🛑 ${message}`)
      }
      core.warning(
        `⚠️ ${message}. Continuing as fail-on-not-found is disabled.`
      )
      return
    }
    throw error
  }
}

function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    Number.isInteger((error as {status: unknown}).status)
  )
}

function setOutput(outputName: string, secretValue: string): void {
  try {
    core.setSecret(secretValue)
    core.setOutput(outputName, secretValue)
    core.info(`Secret ready for use: ${outputName}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function setEnvironmental(outputName: string, secretValue: string): void {
  try {
    if (exportEnvVars) {
      core.setSecret(secretValue)
      core.exportVariable(outputName, secretValue)
      core.info(
        `Environmental variable globally ready for use in pipeline: '${outputName}'`
      )
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    await withRetry(populateVaultsList)
    const secretPath = core.getInput('secret-path')
    const itemRequests = parsing.parseItemRequestsInput(secretPath)

    for (const itemRequest of itemRequests) {
      const vaultID = getVaultID(itemRequest.vault)
      if (!vaultID) continue

      await withRetry(async () =>
        getSecret(
          vaultID,
          itemRequest.name,
          itemRequest.field,
          itemRequest.outputName,
          itemRequest.outputOverridden
        )
      )
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Action failed with unknown error.')
  }
}

run().catch(error => {
  core.setFailed(`Action failed with error: ${error.message}`)
})
