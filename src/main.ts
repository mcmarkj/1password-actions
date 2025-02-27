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

const fail_on_not_found: boolean = core.getInput('fail-on-not-found') === 'true'

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  try {
    const vaults = await op.listVaults()
    core.debug(`getVaultID - vaults: ${JSON.stringify(vaults)}`)
    for (const vault of vaults) {
      if (vault.name === vaultName) {
        core.debug(`getVaultID - found vault: ${JSON.stringify(vault)}`)
        return vault.id
      }
    }

    if (fail_on_not_found) {
      core.setFailed(`🛑 No vault matched name '${vaultName}'`)
    } else {
      core.info(`⚠️ No vault matched name '${vaultName}'`)
    }
  } catch (error) {
    core.debug(`getVaultID - error: ${JSON.stringify(error)}`)
    if (instanceOfHttpError(error)) {
      core.debug(`getVaultID - HTTP error`)
      if (fail_on_not_found) {
        core.setFailed(
          `🛑 Error for vault: '${vaultName}' - '${error.message}'`
        )
      } else {
        core.info(
          `⚠️ Error for vault: '${vaultName}' - '${error.message}'. Continuing as fail-on-not-found is disabled.`
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
  outputOverridden: boolean
): Promise<void> => {
  try {
    const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

    const secretFields = vaultItems['fields'] || []

    // if fieldName wasn't specified, we just output any we find
    let foundSecret = fieldName === ''
    core.debug(`getSecret - foundSecret: ${foundSecret}`)

    for (const item of secretFields) {
      if (fieldName !== '' && item.label !== fieldName) {
        core.debug(`getSecret - skipping field: ${fieldName} - ${item.label}`)
        continue
      }
      if (item.value != null) {
        core.debug(`getSecret - found field: ${item.label}`)
        let outputName = `${outputString}_${item.label?.toLowerCase()}`
        if (fieldName && outputOverridden) {
          core.debug(`getSecret - overriding output name: ${outputString}`)
          outputName = outputString
        }
        setOutput(outputName, item.value.toString())
        setEnvironmental(outputName, item.value.toString())
        foundSecret = true
        if (fieldName) {
          core.debug(`getSecret - found asked for field: ${fieldName}`)
          break
        }
      } else {
        core.debug(`getSecret - skipping field as null: ${item.label}`)
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
    core.debug(`setOutput - error: ${JSON.stringify(error)}`)
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
    core.debug(`setEnvironmental - error: ${JSON.stringify(error)}`)
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    await retryAsync(
      async () => {
        core.debug('Starting 1Password Connect Action')
        // Translate the vault path into it's respective segments
        const secretPath = core.getInput('secret-path')
        const itemRequests = parsing.parseItemRequestsInput(secretPath)

        core.debug(`Vault path: ${secretPath}`)
        core.debug(`Parsed item requests: ${JSON.stringify(itemRequests)}`)

        for (const itemRequest of itemRequests) {
          core.debug(`Processing item request: ${JSON.stringify(itemRequest)}`)
          // Get the vault ID for the vault
          const secretVault = itemRequest.vault
          const vaultID = await getVaultID(secretVault)
          // Set the secrets fields
          const secretTitle = itemRequest.name
          const fieldName = itemRequest.field
          const outputString = itemRequest.outputName
          const outputOverridden = itemRequest.outputOverridden

          core.debug(`Vault: ${secretVault}`)
          core.debug(`Vault ID: ${vaultID}`)
          core.debug(`Secret Title: ${secretTitle}`)
          core.debug(`Field Name: ${fieldName}`)
          core.debug(`Output String: ${outputString}`)
          core.debug(`Output Overridden: ${outputOverridden}`)

          if (vaultID !== undefined) {
            getSecret(
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
