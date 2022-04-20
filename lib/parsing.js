"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseItemRequestsInput = void 0;
/**
 * Parses an item requests input string into vault names, item names and their resulting normalized output names.
 * Based on parsing from https://github.com/hashicorp/vault-action/
 * Big thanks to https://github.com/RobotsAndPencils/1password-action for this code.
 */
function parseItemRequestsInput(itemInput) {
    const itemRequestLines = itemInput
        .split('\n')
        .filter(key => !!key)
        .map(key => key.trim())
        .filter(key => key.length !== 0);
    const output = [];
    for (const itemRequestLine of itemRequestLines) {
        let pathSpec = itemRequestLine;
        let outputName = null;
        let field = null;
        let outputOverriden = false;
        const renameSigilIndex = itemRequestLine.lastIndexOf('|');
        if (renameSigilIndex > -1) {
            pathSpec = itemRequestLine.substring(0, renameSigilIndex).trim();
            outputName = itemRequestLine.substring(renameSigilIndex + 1).trim();
            if (outputName.length < 1) {
                throw Error(`You must provide a value when mapping an item to a name. Input: "${itemRequestLine}"`.toString());
            }
        }
        let pathParts = [];
        if (pathSpec.startsWith('"')) {
            const secondQuoteIndex = pathSpec.indexOf('"', 1);
            const vault = pathSpec.substr(0, secondQuoteIndex + 1);
            pathParts.push(vault);
            // + 3 to remove the ' > ' prefix
            const remainder = pathSpec.slice(secondQuoteIndex + 1 + 3);
            pathParts.push(remainder);
        }
        else {
            pathParts = pathSpec
                .split(' > ')
                .map(part => part.trim())
                .filter(part => part.length !== 0);
        }
        if (pathParts.length < 2 && pathParts.length > 3) {
            throw Error(`You must provide a valid vault and item name. A field sector is optional. Input: "${itemRequestLine}"`.toString());
        }
        const [vaultQuoted, nameQuoted, fieldQuoted] = pathParts;
        const vault = vaultQuoted.replace(new RegExp('"', 'g'), '');
        const name = nameQuoted.replace(new RegExp('"', 'g'), '');
        if (fieldQuoted) {
            field = fieldQuoted.replace(new RegExp('"', 'g'), '');
        }
        else {
            field = '';
        }
        if (!outputName) {
            outputName = normalizeOutputName(name).toLowerCase();
        }
        else {
            outputName = normalizeOutputName(outputName);
            outputOverriden = true;
        }
        output.push({
            vault,
            name,
            field,
            outputName,
            outputOverriden
        });
    }
    return output;
}
exports.parseItemRequestsInput = parseItemRequestsInput;
function normalizeOutputName(dataKey) {
    return dataKey
        .replace(' ', '_')
        .replace('.', '_')
        .replace(/[^\p{L}\p{N}_-]/gu, '');
}
