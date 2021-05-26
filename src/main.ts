import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import * as parsing from './parsing'

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const getVaultID = async (vaultName: string): Promise<string> => {
  const vaults = await op.listVaults()
  for (const vault of vaults) {
    if (vault.name === vaultName) {
      return vault.id || ''
    }
  }
  return ''
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  outputString: string
): Promise<void> => {
  const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

  const secretFields = vaultItems['fields'] || []
  for (const items of secretFields) {
    if (items.value != null) {
      const outputName = `${outputString}_${items.id?.toLowerCase()}`
      core.setSecret(items.value.toString())
      core.exportVariable(outputName, items.value.toString())
    }
  }
}

async function run(): Promise<void> {
  try {
    // Translate the vault path into it's respective segments
    //const secretPath = core.getInput("secret-path")
    const secretPath = 'marvin-secrets-development > anubis.github-credentials'
    const itemRequests = parsing.parseItemRequestsInput(secretPath)
    for (const itemRequest of itemRequests) {
      // Get the vault ID for the vault
      const secretVault = itemRequest.vault
      const vaultID = getVaultID(secretVault)
      // Set the secrets fields
      const secretTitle = itemRequest.name
      const outputString = itemRequest.outputName
      getSecret(await vaultID, secretTitle, outputString)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
