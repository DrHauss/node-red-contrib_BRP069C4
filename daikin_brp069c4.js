
const DaikinCloud = require("daikin-controller-cloud");
const fs = require('fs');
const path = require('path');
const { exit } = require("process");

const options = {
    logger: console.log,          // optional, logger function used to log details depending on loglevel
    logLevel: 'debug',            // info, debug optional, Loglevel of Library, default 'warn' (logs nothing by default)
    proxyOwnIp: '192.168.1.172',  // required, if proxy needed: provide own IP or hostname to later access the proxy
    proxyPort: 8887,              // required: use this port for the proxy and point your client device to this port
    proxyWebPort: 8889,           // required: use this port for the proxy web interface to get the certificate and start Link for login
    proxyListenBind: '0.0.0.0',   // optional: set this to bind the proxy to a special IP, default is '0.0.0.0'
    proxyDataDir: __dirname,      // Directory to store certificates and other proxy relevant data to
    communicationTimeout: 10000,  // Amount of ms to wait for request and responses before timeout
    communicationRetries: 3       // Amount of retries when connection times out
};
let globalTokenSet;

module.exports = function (RED) {

    function daikin_brp069c4Node(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        options.logLevel = config.logLevel
        let daikinCloud;
        let devices;
        let tokensave = config.tokensave;

        node.init = async function () {
            try {
                let tokenSet;
                let username = "";
                let password = "";
                setNodeStatus({ fill: "gray", shape: "dot", text: "Connecting..." });
                
                // Retrieve username + password from node config
                var credentials = this.credentials;
                if (credentials) {
                    if ((credentials.hasOwnProperty("username")) && (credentials.hasOwnProperty("password"))) {
                        username = credentials.username;
                        password = credentials.password;
                    } else {
                        if (!((credentials.username == "") && (credentials.password == ""))) {
                            node.warn("You need to fill out Username and Password together or leave both empty");
                        }
                    }
                } else {
                    node.warn("No credentials provided");
                }

                // Load individual settings for timeout and retry
                if (config.timeout) {
                    options.communicationTimeout = config.timeout;
                }
                if (config.retry) {
                    options.communicationRetries = config.retry;
                }

                // Load Tokens if they already exist on disk
                const tokenFile = path.join(RED.settings.userDir, 'tokenset.json');


                if (fs.existsSync(tokenFile)) {
                    tokenSet = JSON.parse(fs.readFileSync(tokenFile).toString());
                    globalTokenSet = tokenSet;
                    node.debug('tokenset is read');
                    daikinCloud = new DaikinCloud(tokenSet, options);
                    daikinCloud.on('token_update', tokenSet => {
                        setNodeStatus({ fill: "blue", shape: "dot", text: "UPDATED tokens" });
                        fs.writeFileSync(tokenFile, JSON.stringify(tokenSet));
                    });
                } else {
                    if (globalTokenSet) {
                        daikinCloud = new DaikinCloud(globalTokenSet, options);
                        node.debug("globalTokenSet found and used")
                    } else {
                        if (username.length > 0 && password.length > 0 && username.includes('@')) {
                            daikinCloud = new DaikinCloud(tokenSet, options);
                            if (tokensave == "1") {
                                daikinCloud.on('token_update', tokenSet => {
                                    setNodeStatus({ fill: "blue", shape: "dot", text: "UPDATED tokens" });
                                    fs.writeFileSync(tokenFile, JSON.stringify(tokenSet));
                                });
                            }
                            globalTokenSet = await daikinCloud.login(username, password);
                        } else {
                            setNodeStatus({ fill: "red", shape: "dot", text: "tokenset.json is not found and no credentials added to the node config" });
                        }
                    }
                  //  exit;
                }

                updateDevices();
                setNodeStatus({ fill: "blue", shape: "dot", text: "Waiting..." });
            } catch (error) {
                setNodeStatus({ fill: "red", shape: "dot", text: error });
                node.error(error);
            }
        };
        node.on('input', function (msg, send, done) {
            send = send || function () { node.send.apply(node, arguments) }

            const payload = msg.payload;
            const topic = msg.topic;


            switch (topic) {
                case 'get':
                    updateDevices();
                    if (devices) {
                        msg.payload = devices;
                        node.send(msg);
                        setNodeStatus({ fill: "green", shape: "dot", text: "updated" });
                    } else {
                        node.send(null);
                        setNodeStatus({ fill: "gray", shape: "dot", text: "failed to get devices" });
                    }
                    break;
                case 'set':
                    const device = getDeviceBySsid(payload.ssid);
                    setDeviceData(device, payload.managementPoint, payload.dataPoint, payload.dataPointPath, payload.value);
                    break;
                case 'reset':
                    break;
                default:
                    send(null);
            };

            if (done) {
                done();
            }
        });

        function getDeviceBySsid(ssid) {

            const result = devices.find(device => {
                return device.getData('gateway', 'ssid').value === ssid;
            });

            return result ? result : null; // or undefined
        }

        async function setDeviceData(device, managementPoint, dataPoint, dataPointPath, value) {
            try {
                if (dataPoint == 'operationMode') {
                    await device.setData('climateControl', 'onOffMode', 'on');
                }
                if (dataPoint === 'temperatureControl') {
                    // For now always set all temperatures equal
                    await device.setData(managementPoint, dataPoint, '/operationModes/heating/setpoints/roomTemperature', value);
                    await device.setData(managementPoint, dataPoint, '/operationModes/cooling/setpoints/roomTemperature', value);
                    await device.setData(managementPoint, dataPoint, '/operationModes/auto/setpoints/roomTemperature', value);
                } else {
                    await device.setData(managementPoint, dataPoint, dataPointPath, value);
                }
                await device.updateData();
                setNodeStatus({ fill: "green", shape: "dot", text: "Set data succesfully to " + value });
            } catch (error) {
                setNodeStatus({ fill: "red", shape: "dot", text: error });
                node.error(error);
            }
        }

        async function updateDevices() {
            try {
                devices = await daikinCloud.getCloudDevices();
            } catch (error) {
                setNodeStatus({ fill: "red", shape: "dot", text: error });
                node.error(error);
            }
        }
        function setNodeStatus({ fill, shape, text }) {
            var dDate = new Date();
            node.status({ fill: fill, shape: shape, text: text + " (" + dDate.toLocaleTimeString() + ")" })
        }

        function deleteTokenFile(tokenFile) {
            try {
                if (fs.existsSync(tokenFile)) {
                    let stats = fs.statSync(tokenFile);
                    let ctime = stats.ctime;
                    let days = (new Date().getTime() - mtime) / (1000 * 60 * 60 * 24);
                    if (days > 20) {
                        node.warn("tokenfile created >20 days - will be deleted");
                        fs.unlinkSync(tokenFile);
                    }

                }
            } catch (error) {
                node.error(error);
            }
        }

        node.init();
    };

    RED.nodes.registerType("Daikin-Cloud-Controller", daikin_brp069c4Node, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });

}