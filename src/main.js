"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require("@actions/core");
var connect_1 = require("@1password/connect");
var parsing = require("./parsing");
// Create new connector with HTTP Pooling
var op = connect_1.OnePasswordConnect({
    serverURL: core.getInput('connect-server-url'),
    token: core.getInput('connect-server-token'),
    keepAlive: true
});
var getVaultID = function (vaultName) { return __awaiter(void 0, void 0, void 0, function () {
    var vaults, _i, vaults_1, vault, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, op.listVaults()];
            case 1:
                vaults = _a.sent();
                for (_i = 0, vaults_1 = vaults; _i < vaults_1.length; _i++) {
                    vault = vaults_1[_i];
                    if (vault.name === vaultName) {
                        return [2 /*return*/, vault.id];
                    }
                }
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                core.setFailed(error_1.message);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var getSecret = function (vaultID, secretTitle, fieldName, outputString, outputOverriden) { return __awaiter(void 0, void 0, void 0, function () {
    var vaultItems, secretFields, _i, secretFields_1, items, outputName, error_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, op.getItemByTitle(vaultID, secretTitle)];
            case 1:
                vaultItems = _b.sent();
                secretFields = vaultItems['fields'] || [];
                for (_i = 0, secretFields_1 = secretFields; _i < secretFields_1.length; _i++) {
                    items = secretFields_1[_i];
                    if (fieldName && items.label !== fieldName) {
                        continue;
                    }
                    if (items.value != null) {
                        outputName = outputString + "_" + ((_a = items.label) === null || _a === void 0 ? void 0 : _a.toLowerCase());
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
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                core.setFailed(error_2.message);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var setOutput = function (outputName, secretValue) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            core.setSecret(secretValue);
            core.setOutput(outputName, secretValue);
            core.info("Secret ready for use: " + outputName);
        }
        catch (error) {
            core.setFailed(error.message);
        }
        return [2 /*return*/];
    });
}); };
var setEnvironmental = function (outputName, secretValue) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            if (core.getInput('export-env-vars') === 'true') {
                core.setSecret(secretValue);
                core.exportVariable(outputName, secretValue);
                core.info("Environmental variable globally ready for use in pipeline: " + outputName);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
        return [2 /*return*/];
    });
}); };
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var secretPath, itemRequests, _i, itemRequests_1, itemRequest, secretVault, vaultID, secretTitle, fieldName, outputString, outputOverriden, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    secretPath = core.getInput('secret-path');
                    itemRequests = parsing.parseItemRequestsInput(secretPath);
                    _i = 0, itemRequests_1 = itemRequests;
                    _a.label = 1;
                case 1:
                    if (!(_i < itemRequests_1.length)) return [3 /*break*/, 4];
                    itemRequest = itemRequests_1[_i];
                    secretVault = itemRequest.vault;
                    return [4 /*yield*/, getVaultID(secretVault)
                        // Set the secrets fields
                    ];
                case 2:
                    vaultID = _a.sent();
                    secretTitle = itemRequest.name;
                    fieldName = itemRequest.field;
                    outputString = itemRequest.outputName;
                    outputOverriden = itemRequest.outputOverriden;
                    if (vaultID !== undefined) {
                        getSecret(vaultID, secretTitle, fieldName, outputString, outputOverriden);
                    }
                    else {
                        core.setFailed("Can't find vault.");
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    core.setFailed(error_3.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
run();
