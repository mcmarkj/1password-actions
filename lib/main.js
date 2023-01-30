"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
const op = (0, connect_1.OnePasswordConnect)({
    serverURL: core.getInput('connect-server-url'),
    token: core.getInput('connect-server-token'),
    keepAlive: true
});
const fail_on_not_found = core.getInput('fail-on-not-found');
const getVaultID = (vaultName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vaults = yield op.listVaults();
        for (const vault of vaults) {
            if (vault.name === vaultName) {
                return vault.id;
            }
        }
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
});
const getSecret = (vaultID, secretTitle, fieldName, outputString, outputOverriden) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const vaultItems = yield op.getItemByTitle(vaultID, secretTitle);
        const secretFields = vaultItems['fields'] || [];
        if (fail_on_not_found === 'true' && secretFields.length === 0) {
            core.setFailed(`Secret ${secretTitle} could not be found!`);
        }
        for (const items of secretFields) {
            if (fieldName !== '' && items.label !== fieldName) {
                continue;
            }
            if (items.value != null) {
                let outputName = `${outputString}_${(_a = items.label) === null || _a === void 0 ? void 0 : _a.toLowerCase()}`;
                if (fieldName && outputOverriden) {
                    outputName = outputString;
                }
                setOutput(outputName, items.value.toString());
                setEnvironmental(outputName, items.value.toString());
                if (fieldName) {
                    break;
                }
            }
        }
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
});
const setOutput = (outputName, secretValue) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        core.setSecret(secretValue);
        core.setOutput(outputName, secretValue);
        core.info(`Secret ready for use: ${outputName}`.toString());
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
});
const setEnvironmental = (outputName, secretValue) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (core.getInput('export-env-vars') === 'true') {
            core.setSecret(secretValue);
            core.exportVariable(outputName, secretValue);
            core.info(`Environmental variable globally ready for use in pipeline: ${outputName}`.toString());
        }
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Translate the vault path into it's respective segments
            const secretPath = core.getInput('secret-path');
            const itemRequests = parsing.parseItemRequestsInput(secretPath);
            for (const itemRequest of itemRequests) {
                // Get the vault ID for the vault
                const secretVault = itemRequest.vault;
                const vaultID = yield getVaultID(secretVault);
                // Set the secrets fields
                const secretTitle = itemRequest.name;
                const fieldName = itemRequest.field;
                const outputString = itemRequest.outputName;
                const outputOverriden = itemRequest.outputOverriden;
                if (vaultID !== undefined) {
                    getSecret(vaultID, secretTitle, fieldName, outputString, outputOverriden);
                }
                else {
                    core.setFailed("Can't find vault.");
                }
            }
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
