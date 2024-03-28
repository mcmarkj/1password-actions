import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import * as parsing from './parsing'
import {HttpError} from '@1password/connect/dist/lib/utils/error'

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const fail_on_not_found: boolean = core.getInput('fail-on-not-found') === 'true'

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  try {
    const vaults = await op.listVaults()
    for (const vault of vaults) {
      if (vault.name === vaultName) {
        return vault.id
      }
    }

    if (fail_on_not_found) {
      core.setFailed(`🛑 No vault matched name '${vaultName}'`)
    } else {
      core.info(`⚠️ No vault matched name '${vaultName}'`)
    }
  } catch (error) {
    if (instanceOfHttpError(error)) {
      if (fail_on_not_found) {
        core.setFailed(`🛑 Error for vault: ${vaultName} - ${error.message}`)
      } else {
        core.info(
          `⚠️ Error for vault: ${vaultName} - ${error.message}. Continuing as fail-on-not-found is disabled.`
        )
      }
    }
    if (error instanceof Error) core.setFailed(error.message)
  }
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  fieldName: string,
  outputString: string,
  outputOverriden: boolean
): Promise<void> => {
  try {
    const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

    const secretFields = vaultItems['fields'] || []

    for (const items of secretFields) {
      if (fieldName !== '' && items.label !== fieldName) {
        continue
      }
      if (items.value != null) {
        let outputName = `${outputString}_${items.label?.toLowerCase()}`
        if (fieldName && outputOverriden) {
          outputName = outputString
        }
        setOutput(outputName, items.value.toString())
        setEnvironmental(outputName, items.value.toString())
        if (fieldName) {
          break
        }
      }
    }

    if (fail_on_not_found) {
      core.setFailed(
        `🛑 No secret matched ${secretTitle} with field ${fieldName}`
      )
    } else {
      core.info(`⚠️ No secret matched ${secretTitle} with field ${fieldName}`)
    }
  } catch (error) {
    if (instanceOfHttpError(error)) {
      if (fail_on_not_found) {
        core.setFailed(`🛑 Error for secret: ${secretTitle} - ${error.message}`)
      } else {
        core.info(
          `⚠️ Error for secret: ${secretTitle} - ${error.message}. Continuing as fail-on-not-found is disabled.`
        )
      }
    }
    if (error instanceof Error) core.setFailed(error.message)
  }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
function instanceOfHttpError(object: any): object is HttpError {
  return Number.isInteger(object.status)
}

const setOutput = async (
  outputName: string,
  secretValue: string
): Promise<void> => {
  try {
    core.setSecret(secretValue)
    core.setOutput(outputName, secretValue)
    core.info(`Secret ready for use: ${outputName}`.toString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

const setEnvironmental = async (
  outputName: string,
  secretValue: string
): Promise<void> => {
  try {
    if (core.getInput('export-env-vars') === 'true') {
      core.setSecret(secretValue)
      core.exportVariable(outputName, secretValue)
      core.info(
        `Environmental variable globally ready for use in pipeline: ${outputName}`.toString()
      )
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    // Translate the vault path into it's respective segments
    const secretPath = core.getInput('secret-path')
    const itemRequests = parsing.parseItemRequestsInput(secretPath)
    for (const itemRequest of itemRequests) {
      // Get the vault ID for the vault
      const secretVault = itemRequest.vault
      const vaultID = await getVaultID(secretVault)
      // Set the secrets fields
      const secretTitle = itemRequest.name
      const fieldName = itemRequest.field
      const outputString = itemRequest.outputName
      const outputOverriden = itemRequest.outputOverriden
      if (vaultID !== undefined) {
        getSecret(
          vaultID,
          secretTitle,
          fieldName,
          outputString,
          outputOverriden
        )
      } else {
        core.setFailed("Can't find vault.")
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
