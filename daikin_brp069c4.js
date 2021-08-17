
const DaikinCloud = require("daikin-controller-cloud");
const fs = require('fs');
const path = require('path');
const { exit } = require("process");

const options = {
    logger: console.log,          // optional, logger function used to log details depending on loglevel
    logLevel: 'debug',             // info, debug optional, Loglevel of Library, default 'warn' (logs nothing by default)
    proxyOwnIp: '192.168.1.172', // required, if proxy needed: provide own IP or hostname to later access the proxy
    proxyPort: 8887,              // required: use this port for the proxy and point your client device to this port
    proxyWebPort: 8889,           // required: use this port for the proxy web interface to get the certificate and start Link for login
    proxyListenBind: '0.0.0.0',   // optional: set this to bind the proxy to a special IP, default is '0.0.0.0'
    proxyDataDir: __dirname       // Directory to store certificates and other proxy relevant data to
};

//setNodeStatus({fill: "red", shape: "ring", text: "login failed"});
//setNodeStatus({fill: "green", shape: "dot", text: "connected"});

//node.debug(" ", func, JSON.stringify(funcArgs.slice(0,-1)).slice(1,-1));

module.exports = function (RED) {

    function daikin_brp069c4Node(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        options.logLevel = config.logLevel
        let daikinCloud;
        let devices;

        //console.log(JSON.parse(config.token));
        //config.token = "hallo";

        node.init = async function () {
            try {
                let tokenSet;
                let username;
                let password;
                setNodeStatus({ fill: "gray", shape: "dot", text: "Connecting..." });

                // Retrieve username + password from node config
                var credentials = this.credentials;
                if (credentials) {
                    if ((credentials.hasOwnProperty("username")) && (credentials.hasOwnProperty("password"))) {
                        username = credentials.username;
                        password = credentials.password;
                        node.debug("Username: " + username + " Password: " + password);
                    } else {
                        node.error("You need to fill out Username and Password together");
                    }
                } else {
                    node.warn("No credentials provided");
                }
                // Load Tokens if they already exist on disk

                const tokenFile = path.join(__dirname, 'tokenset.json');
                if (fs.existsSync(tokenFile)) {
                    tokenSet = JSON.parse(fs.readFileSync(tokenFile).toString());
                    node.debug('tokenset is read');
                    daikinCloud = new DaikinCloud(tokenSet, options);

                } else {
                    if (username.length > 0 && password.length > 0 && username.includes('@')) {
                        daikinCloud = new DaikinCloud(tokenSet, options);
                        const resultTokenSet = await daikinCloud.login(username, password);
                    } else {
                        setNodeStatus({ fill: "red", shape: "dot", text: "tokenset.json is not found and no credentials added to the node config" });
                    }
                    exit;
                }


                // Event that will be triggered on new or updated tokens, save into file
                daikinCloud.on('token_update', tokenSet => {
                    setNodeStatus({ fill: "blue", shape: "dot", text: "UPDATED tokens" });
                    fs.writeFileSync(tokenFile, JSON.stringify(tokenSet));
                });

                //const daikinDeviceDetails = await daikinCloud.getCloudDeviceDetails();
                updateDevices();
                setNodeStatus({ fill: "blue", shape: "dot", text: "Waiting..." });
                tokenfileNotFound = false;
            } catch (error) {
                setNodeStatus({ fill: "red", shape: "dot", text: error });
                node.warn(error);
            }
        };
        node.onedit
        node.on('input', function (msg, send, done) {
            send = send || function () { node.send.apply(node, arguments) }

            const payload = msg.payload;
            const topic = msg.topic;

            //console.log(`Payload: ${payload}, topic: ${topic}`);

            switch (topic) {
                case 'get':
                    updateDevices();
                    //sendAllDevices(msg);
                    if (devices) {
                        msg.payload = devices;
                        //console.log(devices);
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
                node.warn(error);
            }
        }

        async function updateDevices() {
            try {
                devices = await daikinCloud.getCloudDevices();
            } catch (error) {
                setNodeStatus({ fill: "red", shape: "dot", text: error });
                node.warn(error);
            }
        }
        function setNodeStatus({ fill, shape, text }) {
            var dDate = new Date();
            node.status({ fill: fill, shape: shape, text: text + " (" + dDate.toLocaleTimeString() + ")" })
        }

        node.init();
    };

    RED.nodes.registerType("daikin_brp069c4", daikin_brp069c4Node, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });

    // RED.events.on("nodes-started", () => {
    //     // Start after all nodes are started.
    // });
}