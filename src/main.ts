import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import {HttpError} from '@1password/connect/dist/lib/utils/error'
import {retryAsync, isTooManyTries} from 'ts-retry'

const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const fail_on_not_found: boolean = core.getInput('fail-on-not-found') === 'true'

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  return await retryAsync(
    async () => {
      const vaults = await op.listVaults()
      for (const vault of vaults) {
        if (vault.name === vaultName) {
          return vault.id
        }
      }
      throw new Error(`No vault matched name '${vaultName}'`)
    },
    {maxTry: 3, delay: 1000}
  )
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  fieldName: string,
  outputString: string,
  outputOverriden: boolean
): Promise<void> => {
  return await retryAsync(
    async () => {
      const vaultItems = await op.getItemByTitle(vaultID, secretTitle)
      const secretFields = vaultItems['fields'] || []
      let foundSecret = fieldName === ''

      for (const items of secretFields) {
        if (fieldName && items.label !== fieldName) continue
        if (items.value) {
          let outputName = outputOverriden
            ? outputString
            : `${outputString}_${items.label?.toLowerCase()}`
          core.setOutput(outputName, items.value.toString())
          foundSecret = true
          if (fieldName) break
        }
      }

      if (!foundSecret) {
        throw new Error(
          `No secret matched '${secretTitle}' with field '${fieldName}'`
        )
      }
    },
    {maxTry: 3, delay: 1000}
  )
}

const run = async () => {
  try {
    const vaultName = core.getInput('vault-name')
    const secretTitle = core.getInput('secret-title')
    const fieldName = core.getInput('field-name')
    const outputString = core.getInput('output-string')
    const outputOverriden = core.getBooleanInput('output-overriden')

    const vaultID = await getVaultID(vaultName)
    if (!vaultID) {
      if (fail_on_not_found) {
        throw new Error(`Vault '${vaultName}' not found.`)
      } else {
        core.info(
          `Vault '${vaultName}' not found, but continuing as fail_on_not_found is false.`
        )
        return
      }
    }

    await getSecret(
      vaultID,
      secretTitle,
      fieldName,
      outputString,
      outputOverriden
    )
  } catch (error) {
    if (isTooManyTries(error)) {
      core.setFailed(`Retry limit reached: ${error.message}`)
    } else {
      core.setFailed(error instanceof Error ? error.message : String(error))
    }
  }
}

run()

export {getVaultID, getSecret}
