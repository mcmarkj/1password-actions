import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import * as parsing from './parsing'

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  try {
    const vaults = await op.listVaults()
    for (const vault of vaults) {
      if (vault.name === vaultName) {
        return vault.id
      }
    }
    return
  } catch (error) {
    core.setFailed(error.message)
  }
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  outputString: string
): Promise<void> => {
  try {
    const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

    const secretFields = vaultItems['fields'] || []
    for (const items of secretFields) {
      if (items.value != null) {
        const outputName = `${outputString}_${items.label?.toLowerCase()}`
        core.setSecret(items.value.toString())
        core.setOutput(outputName, items.value.toString())
        core.info(`Secret ready for use: ${outputName}`)
      }
    }
  } catch (error) {
    core.setFailed(error.message)
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
      const outputString = itemRequest.outputName
      if (vaultID !== undefined) {
        getSecret(vaultID, secretTitle, outputString)
      } else {
        core.setFailed("Can't find vault.")
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
