import { dialog, shell } from 'electron';
import * as fs from 'fs';
import * as robotjs from 'robotjs';
import { isNumeric } from 'rxjs/util/isNumeric';
import * as WebSocket from 'ws';

import { requestModel, requestModelHelo, requestModelPutScan } from '../../../ionic/src/models/request.model';
import { responseModelPutScanAck } from '../../../ionic/src/models/response.model';
import { Handler } from '../models/handler.model';
import { SettingsHandler } from './settings.handler';
import { UiHandler } from './ui.handler';

export class ScansHandler implements Handler {
    private deviceName = "unknown";

    private static instance: ScansHandler;
    private constructor(
        private settingsHandler: SettingsHandler,
        private uiHandler: UiHandler,
    ) {

    }
    static getInstance(settingsHandler: SettingsHandler, uiHandler: UiHandler) {
        if (!ScansHandler.instance) {
            ScansHandler.instance = new ScansHandler(settingsHandler, uiHandler);
        }
        return ScansHandler.instance;
    }

    onWsMessage(ws: WebSocket, message: any) {
        console.log('message', message)
        switch (message.action) {
            case requestModel.ACTION_PUT_SCAN: {
                let request: requestModelPutScan = message;
                let barcode = request.scan.text;

                (async () => {
                    for (let stringComponent of this.settingsHandler.typedString) {
                        let outputString;

                        switch (stringComponent.type) {
                            case 'barcode': {
                                outputString = barcode;
                                break;
                            }
                            case 'text': {
                                outputString = stringComponent.value;
                                break;
                            }
                            case 'key': {
                                robotjs.keyTap(stringComponent.value);
                                break;
                            }
                            case 'variable': {
                                switch (stringComponent.value) {
                                    case 'deviceName': {
                                        outputString = this.deviceName;
                                        break;
                                    }

                                    case 'timestamp': {
                                        outputString = (request.scan.date * 1000) + ' ';
                                        break;
                                    }

                                    case 'date': {
                                        outputString = new Date(request.scan.date).toLocaleDateString();
                                        break;
                                    }

                                    case 'time': {
                                        outputString = new Date(request.scan.date).toLocaleTimeString();
                                        break;
                                    }

                                    case 'date_time': {
                                        outputString = new Date(request.scan.date).toLocaleTimeString() + ' ' + new Date(request.scan.date).toLocaleDateString();
                                        break;
                                    }

                                    case 'quantity': {
                                        if (request.scan.quantity) {
                                            outputString = request.scan.quantity + '';
                                        } else {
                                            // electron popup: invalid quantity, please enable quantity in the app and insert a numeric value.
                                            dialog.showMessageBox(this.uiHandler.mainWindow, {
                                                type: 'error',
                                                title: 'Invalid quantity',
                                                message: 'Please make you sure to enter a quantity in the app',
                                            });
                                        }
                                        break;
                                    }
                                }
                                break;
                            }
                            case 'function': {
                                let functionCode = stringComponent.value.replace('barcode', '"' + barcode + '"');
                                outputString = eval(functionCode);
                                break;
                            }

                            case 'delay': {
                                if (isNumeric(stringComponent.value)) {
                                    await new Promise((resolve) => {
                                        setTimeout(resolve, parseInt(stringComponent.value))
                                    })
                                }
                                break;
                            }
                        }

                        if (outputString) {
                            this.outputString(outputString);
                        }
                    }
                    this.appendNewLineCharacterToCSVFile();
                })();

                if (this.settingsHandler.enableOpenInBrowser) {
                    shell.openExternal(barcode);
                }

                // ACK
                let response = new responseModelPutScanAck();
                response.fromObject({
                    scanId: request.scan.id,
                    scanSessionId: request.scanSessionId
                });
                ws.send(JSON.stringify(response));
                // END ACK
                break;
            }

            case requestModel.ACTION_PUT_SCAN_SESSIONS: {

                break;
            }

            case requestModel.ACTION_PUT_SCAN_SESSION: {

                break;
            }

            case requestModel.ACTION_DELETE_SCAN_SESSION: {

                break;
            }

            case requestModel.ACTION_UPDATE_SCAN_SESSION: {

                break;
            }

            case requestModel.ACTION_HELO: {
                let request: requestModelHelo = message;
                if (request && request.deviceName) {
                    this.deviceName = request.deviceName;
                }
                break;
            }
        }
    }

    outputString(string) {
        if (this.settingsHandler.enableRealtimeStrokes) {
            robotjs.typeString(string);
        }

        if (this.settingsHandler.appendCSVEnabled && this.settingsHandler.csvPath) {
            fs.appendFileSync(this.settingsHandler.csvPath, string);
        }
    }

    appendNewLineCharacterToCSVFile() {
        if (this.settingsHandler.appendCSVEnabled && this.settingsHandler.csvPath) {
            fs.appendFileSync(this.settingsHandler.csvPath, this.settingsHandler.newLineCharacter.replace('CR', '\r').replace('LF', '\n'));
        }
    }

    onWsClose(ws: WebSocket) {
        throw new Error("Method not implemented.");
    }

    onWsError(ws: WebSocket, err: Error) {
        throw new Error("Method not implemented.");
    }
}