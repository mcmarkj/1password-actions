"use strict";
exports.__esModule = true;
exports.parseItemRequestsInput = void 0;
/**
 * Parses an item requests input string into vault names, item names and their resulting normalized output names.
 * Based on parsing from https://github.com/hashicorp/vault-action/
 * Big thanks to https://github.com/RobotsAndPencils/1password-action for this code.
 */
function parseItemRequestsInput(itemInput) {
    var itemRequestLines = itemInput
        .split('\n')
        .filter(function (key) { return !!key; })
        .map(function (key) { return key.trim(); })
        .filter(function (key) { return key.length !== 0; });
    var output = [];
    for (var _i = 0, itemRequestLines_1 = itemRequestLines; _i < itemRequestLines_1.length; _i++) {
        var itemRequestLine = itemRequestLines_1[_i];
        var pathSpec = itemRequestLine;
        var outputName = null;
        var field = null;
        var outputOverriden = false;
        var renameSigilIndex = itemRequestLine.lastIndexOf('|');
        if (renameSigilIndex > -1) {
            pathSpec = itemRequestLine.substring(0, renameSigilIndex).trim();
            outputName = itemRequestLine.substring(renameSigilIndex + 1).trim();
            if (outputName.length < 1) {
                throw Error("You must provide a value when mapping an item to a name. Input: \"" + itemRequestLine + "\"");
            }
        }
        var pathParts = [];
        if (pathSpec.startsWith('"')) {
            var secondQuoteIndex = pathSpec.indexOf('"', 1);
            var vault_1 = pathSpec.substr(0, secondQuoteIndex + 1);
            pathParts.push(vault_1);
            // + 3 to remove the ' > ' prefix
            var remainder = pathSpec.slice(secondQuoteIndex + 1 + 3);
            pathParts.push(remainder);
        }
        else {
            pathParts = pathSpec
                .split(' > ')
                .map(function (part) { return part.trim(); })
                .filter(function (part) { return part.length !== 0; });
        }
        if (pathParts.length < 2 && pathParts.length > 3) {
            throw Error("You must provide a valid vault and item name. A field sector is optional. Input: \"" + itemRequestLine + "\"");
        }
        var vaultQuoted = pathParts[0], nameQuoted = pathParts[1], fieldQuoted = pathParts[2];
        var vault = vaultQuoted.replace(new RegExp('"', 'g'), '');
        var name_1 = nameQuoted.replace(new RegExp('"', 'g'), '');
        if (fieldQuoted) {
            field = fieldQuoted.replace(new RegExp('"', 'g'), '');
        }
        if (!outputName) {
            outputName = normalizeOutputName(name_1).toLowerCase();
        }
        else {
            outputName = normalizeOutputName(outputName);
            outputOverriden = true;
        }
        output.push({
            vault: vault,
            name: name_1,
            field: field,
            outputName: outputName,
            outputOverriden: outputOverriden
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
