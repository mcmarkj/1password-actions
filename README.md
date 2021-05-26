# 1Password Connect GitHub Action

Access your 1Password Connect Server to import logins and passwords from your 1Password vaults to use in your GitHub Action workflows.

How to use in your workflow:

```yaml
- name: Import Creds
  uses: markmarkj/1password-actions@v1
  id: creds
  with:
    connect-server-url: <Your 1password Connect Server URL>
    connect-server-token: ${{ secrets.CONNECT_SERVER_TOKEN }}
    secret-path: |
      vault-name > Vault Secret Name
      vault-name > vault.alt.secretname
```

You can then utilise these credentials elsewhere in your pipelines

```yaml
- name: Deploy
  env:
    SERVICE_ACCOUNT: ${{ steps.creds.outputs.vault_alt_secretname_password }}
  run: gcp cloud connect --key=$SERVICE_ACCOUNT
```

## Outputs

All password outputs are marked as secrets so that they're masked in your workflow's logs.

a `Login` item named `My Secret Name`, would be available as the `my_secret_name_username` and `my_secret_name_password` output variables. If the field exists and isn't empty it will be outputted.
Check the action logs if you aren't totally sure what's been created by the action.

Any additional fields on the secret will also be available, so for example a field on `My Secret Name` of `Region` would be available as `my_secret_name_region`

The output variable's name will be the item's name with spaces and `.` replaced with `_`, non-alphanumeric characters removed, and lowercased. For example, a `Password` item named `Google Firebase 2020` would be available as the `google_firebase_2020_password` output variable.

You can also override the name of the output by appending ` | secret_name` at the end. This will always be suffixed with _<field> however.
eg:
```yaml
secret-path: |
      vault-name > Vault Secret Name | my_output_name
```
This could then be accessed by doing:
```yaml
env:
    SERVICE_ACCOUNT: ${{ steps.creds.outputs.my_output_name_password }}
```