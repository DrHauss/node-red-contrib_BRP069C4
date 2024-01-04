# node-red-contrib-daikin-cloud

[![NPM version](http://img.shields.io/npm/v/node-red-contrib-daikin-cloud.svg)](https://www.npmjs.com/package/node-red-contrib-daikin-cloud)
[![Downloads](https://img.shields.io/npm/dm/node-red-contrib-daikin-cloud.svg)](https://www.npmjs.com/package/node-red-contrib-daikin-cloud)
![Test and Release](https://github.com/DrHauss/node-red-contrib_BRP069C4/workflows/Test%20and%20Release/badge.svg)

This version is based on node-red-contrib_BRP069C4 from bartjanisse and is enhanced by DrHauss.

Node-Red Node for accessing Daikin Cloud to control AC devices and get their status. 

## Important Information

When you integrate this Node please make sure you do not refresh data out of the cloud too fast. Please still think about the needed resources and costs on Daikin side to operate the cloud services and only allow meaningful poll intervals!

This Node **doesn't** use a public and documented API for controlling the AC devices. You are using this on your own risk.

## Dependencies
**Requires a valid Daikin Cloud Account which is authenticated via e-mail and password (no direct social login is possible!) or a valid tokenset.json which could be generated via daikin-controller-cloud module ([Details here](https://github.com/Apollon77/daikin-controller-cloud/))**

## How to use
 * Define a Node and configure username and password if you want to use the authentication via user/pass. If you configured your account with social media login (Apple, Facebook...) then you need to have a valid tokenset.json
 * Set msg.topic to "get" if you want to receive the actual status of your device(s)
 * Set msg.topic to "set" if you want to set the status of your device. This requires the following additional information:
    * msg.payload.ssid = Device SSID (original one starting with DaikinAP... Is available in the device object)
    * msg.payload.managementPoint e.a. "climateControl"
    * msg.payload.dataPoint e.a. "temperatureControl"
    * msg.payload.dataPointPath = Only needed in some cases
    * msg.payload.value = target value

## Restrictions
 * Only one Daikin Cloud Account could be used globaly! 
 * It takes some time (2-3 minutes) until Daikin Cloud updates the state sometimes. So don't get nervous if you set a value and it takes some time.

## Changelog

### 0.4.0
 * Added option to disable Temperature sync for modes Auto, Heating and Cooling
### 0.3.3
 * Updated Dependencies for daikin-controller-cloud to 1.2.4
### 0.3.2
 * Updated Dependencies for daikin-controller-cloud to 1.2.3
 * Restrict and Convert input of Retries and Timeout values to numbers only

### 0.2.1
 * Updated Dependencies for daikin-controller-cloud to 0.2.1

### 0.2.0
 * Implement a timeout and retry for cloud requests (At the moment this requires an updated version of daikin-controller-cloud which is available on [GITHUB](https://github.com/DrHauss/daikin-controller-cloud))
 * Token will be saved globaly so Node can be used multiple times (see Restrictions)
 * Implemented caching method which reduces requests from cloud max. 1/min (only for get)

### 0.1.2
This is the initial release of the enhanced Node-Red Node for Daikin Cloud Controller which bases on [node-red-contrib_BRP069C from bartjanisse](https://github.com/bartjanisse/node-red-contrib_BRP069C4). This version brings the ability to authenticate to Daikin Cloud with Username + Password and added some documentation on the usage of this Node

## TODO
 * Create config node to handle credentials easier for multiple Node definitions
 * Prevent initialization of globalTokenSet solution before one connection is established correct. 
