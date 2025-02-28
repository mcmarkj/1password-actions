import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import * as parsing from './parsing'
import {HttpError} from '@1password/connect/dist/lib/utils/error'
import {isTooManyTries, retryAsync} from 'ts-retry'
import {TooManyTries} from 'ts-retry/lib/cjs/retry/tooManyTries'

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const vaults: Record<string, string> = {}

const fail_on_not_found: boolean = core.getInput('fail-on-not-found') === 'true'

const populateVaultsList = async (): Promise<void> => {
  try {
    const vaultsList = await op.listVaults()
    for (const vault of vaultsList) {
      const vaultName = vault.name ?? ''
      const vaultID = vault.id ?? ''
      if (vaultName && vaultID) {
        vaults[vaultName] = vaultID
      } else {
        core.info(`Vault name/ID is empty: ${JSON.stringify(vault)}`)
      }
    }
    core.info(`Vaults list: ${JSON.stringify(vaults)}`)
  } catch (error) {
    core.error(`Error getting vaults: ${error}`)
    core.setFailed(`🛑 Error getting vaults.`)
    throw error
  }
}

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  const vaultID = vaults[vaultName] ?? undefined
  if (vaultID === undefined && fail_on_not_found) {
    core.setFailed(`🛑 No vault matched name '${vaultName}'`)
  }
  return vaultID
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  fieldName: string,
  outputString: string,
  outputOverridden: boolean
): Promise<void> => {
  try {
    const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

    const secretFields = vaultItems['fields'] || []

    // if fieldName wasn't specified, we just output any we find
    let foundSecret = fieldName === ''
    core.info(`getSecret - foundSecret: ${foundSecret}`)

    for (const item of secretFields) {
      if (fieldName !== '' && item.label !== fieldName) {
        core.info(`getSecret - skipping field: ${fieldName} - ${item.label}`)
        continue
      }
      if (item.value != null) {
        core.info(`getSecret - found field: ${item.label}`)
        let outputName = `${outputString}_${item.label?.toLowerCase()}`
        if (fieldName && outputOverridden) {
          core.info(`getSecret - overriding output name: ${outputString}`)
          outputName = outputString
        }
        setOutput(outputName, item.value.toString())
        setEnvironmental(outputName, item.value.toString())
        foundSecret = true
        if (fieldName) {
          core.info(`getSecret - found asked for field: ${fieldName}`)
          break
        }
      } else {
        core.info(`getSecret - skipping field as null: ${item.label}`)
      }
    }

    if (!foundSecret) {
      if (fail_on_not_found) {
        core.setFailed(
          `🛑 No secret matched '${secretTitle}' with field '${fieldName}'`
        )
      } else {
        core.info(
          `⚠️ No secret matched '${secretTitle}' with field '${fieldName}'`
        )
      }
    }
  } catch (error) {
    if (instanceOfHttpError(error)) {
      if (fail_on_not_found) {
        core.setFailed(
          `🛑 Error for secret: '${secretTitle}' - '${error.message}'`
        )
      } else {
        core.info(
          `⚠️ Error for secret: '${secretTitle}' - '${error.message}'. Continuing as fail-on-not-found is disabled.`
        )
      }
    }
    if (error instanceof Error)
      core.setFailed(`Error getting secret: ${error.message}`)
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
    core.info(`setOutput - error: ${JSON.stringify(error)}`)
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
        `Environmental variable globally ready for use in pipeline: '${outputName}'`
      )
    }
  } catch (error) {
    core.info(`setEnvironmental - error: ${JSON.stringify(error)}`)
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    await retryAsync(
      async () => {
        core.info('Starting 1Password Connect Action')
        await populateVaultsList()
        // Translate the vault path into it's respective segments
        const secretPath = core.getInput('secret-path')
        const itemRequests = parsing.parseItemRequestsInput(secretPath)

        core.info(`Vault path: ${secretPath}`)
        core.info(`Parsed item requests: ${JSON.stringify(itemRequests)}`)

        for (const itemRequest of itemRequests) {
          core.info(`Processing item request: ${JSON.stringify(itemRequest)}`)
          // Get the vault ID for the vault
          const secretVault = itemRequest.vault
          const vaultID = await getVaultID(secretVault)
          // Set the secrets fields
          const secretTitle = itemRequest.name
          const fieldName = itemRequest.field
          const outputString = itemRequest.outputName
          const outputOverridden = itemRequest.outputOverridden

          core.info(`Vault: ${secretVault}`)
          core.info(`Vault ID: ${vaultID}`)
          core.info(`Secret Title: ${secretTitle}`)
          core.info(`Field Name: ${fieldName}`)
          core.info(`Output String: ${outputString}`)
          core.info(`Output Overridden: ${outputOverridden}`)

          if (vaultID !== undefined) {
            await getSecret(
              vaultID,
              secretTitle,
              fieldName,
              outputString,
              outputOverridden
            )
          } else {
            throw Error("Can't find vault.")
          }
        }
      },
      {
        delay: 10000,
        maxTry: core.getInput('retry-count')
          ? parseInt(core.getInput('retry-count'))
          : 3,
        onMaxRetryFunc: () => {
          throw new TooManyTries(new Error('🛑 Too many retries'))
        }
      }
    )
  } catch (error) {
    if (isTooManyTries(error)) core.setFailed('🛑 Too many retries')
    if (error instanceof Error) core.setFailed(error.message)
    core.setFailed(`Action failed with unknown error.`)
  }
}

run().catch(error => {
  core.setFailed(`Action failed with error: ${error.message}`)
})
