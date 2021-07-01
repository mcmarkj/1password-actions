"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const connect_1 = require("@1password/connect");
const parsing = __importStar(require("./parsing"));
// Create new connector with HTTP Pooling
//const op = OnePasswordConnect({
//  serverURL: core.getInput('connect-server-url'),
//  token: core.getInput('connect-server-token'),
//  keepAlive: true
//})
const op = connect_1.OnePasswordConnect({
    serverURL: 'https://opconnector.glean.ninja',
    token: 'eyJhbGciOiJFUzI1NiIsImtpZCI6InA3eGY2dG14bmRnM3JxZjZhcGU0cWZubm15IiwidHlwIjoiSldUIn0.eyIxcGFzc3dvcmQuY29tL2F1dWlkIjoiMkZHNUo1S0syTkY2QlBLTFpRUlhLMklTQkkiLCIxcGFzc3dvcmQuY29tL3Rva2VuIjoiYTBvTVRNTm5PSFlFMEdZd0lWZGg3cWRrU21ucmV3d1EiLCIxcGFzc3dvcmQuY29tL2Z0cyI6WyJ2YXVsdGFjY2VzcyJdLCIxcGFzc3dvcmQuY29tL3Z0cyI6W3sidSI6ImE2dXprcGF0cG9idGNidjJ5NHBod2Nlc2N5IiwiYSI6MTAwOH0seyJ1IjoicTR5YTZmam9nb2FiNWtnaHFpZGI3YngzZWUiLCJhIjoxMDA4fSx7InUiOiJvanppMnhwNWRha2pseDZxaGUzZW92c3ZnNCIsImEiOjEwMDh9LHsidSI6ImtyaXhtN3p4cm1mZG92cWgydmVsN2RxZmthIiwiYSI6MTAwOH0seyJ1IjoiNTUzeWRzd2l2dGl5ZG83Znl4ZGVoejM0aWEiLCJhIjoxMDA4fSx7InUiOiJhcnp4cmdubzZ0cXp0cGZxMmR6NTJ3cDY1NCIsImEiOjEwMDh9LHsidSI6InprN2Z5a3B6YzVmbXN4aWs3NGI3emZnYnBlIiwiYSI6MTAwOH0seyJ1IjoiajZnZWk2YmJ3b3oyNzM0Yndlb2licnpqMmEiLCJhIjoxMDA4fSx7InUiOiJiM3pqaGZhbWVkejNkanA3c3Rid2tycTIzcSIsImEiOjEwMDh9XSwiYXVkIjpbImNvbS4xcGFzc3dvcmQuY29ubmVjdCJdLCJzdWIiOiJHR0Q3VTdYNlFCQzZOQ0dBSzJQVDc0QVBITSIsImlhdCI6MTYyMjUzNzgxNCwiaXNzIjoiY29tLjFwYXNzd29yZC5iNSIsImp0aSI6ImF2ZnZmdmJobXhzdGZ1ZXh2c3dsaGduN3h5In0.6OAGl6ZSGe1LDO9eq-sTPyzORPqTEnGtXIsY-RlorTm6teudHN6XPOWc7tWn4q-8Qhf8qwQrmHRfeJxlFufp9g',
    keepAlive: true
});
const getVaultID = (vaultName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vaults = yield op.listVaults();
        for (const vault of vaults) {
            if (vault.name === vaultName) {
                return vault.id;
            }
        }
        return;
    }
    catch (error) {
        core.setFailed(error.message);
    }
});
const getSecret = (vaultID, secretTitle, outputString) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const vaultItems = yield op.getItemByTitle(vaultID, secretTitle);
        const secretFields = vaultItems['fields'] || [];
        //core.debug(`Hello`)
        for (const items of secretFields) {
            if (items.value != null) {
                const outputName = `${outputString}_${(_a = items.id) === null || _a === void 0 ? void 0 : _a.toLowerCase()}`;
                core.setSecret(items.value.toString());
                core.setOutput(outputName, items.value.toString());
                core.info(`Secret ready for use: ${outputName}`);
            }
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Translate the vault path into it's respective segments
            //const secretPath = core.getInput('secret-path')
            const secretPath = 'marvin-secrets-development > zoho.api-self-client';
            const itemRequests = parsing.parseItemRequestsInput(secretPath);
            for (const itemRequest of itemRequests) {
                // Get the vault ID for the vault
                const secretVault = itemRequest.vault;
                const vaultID = yield getVaultID(secretVault);
                // Set the secrets fields
                const secretTitle = itemRequest.name;
                const outputString = itemRequest.outputName;
                if (vaultID !== undefined) {
                    getSecret(vaultID, secretTitle, outputString);
                }
                else {
                    core.setFailed("Can't find vault.");
                }
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
