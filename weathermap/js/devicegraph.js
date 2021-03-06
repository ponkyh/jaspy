import Device from "./device.js";


export default class DeviceGraph {
    constructor(viewport) {
        this.viewport = viewport;
        this.linkLayer = new PIXI.Container();
        this.deviceLayer = new PIXI.Container();
        this.devices = {};
        this.viewport.addChild(this.linkLayer);
        this.viewport.addChild(this.deviceLayer);

        this.updateBatch = {};
    }

    updateTopologyData(data) {
        for(let [key, value] of Object.entries(data["devices"])) {
            let targetDevice = null;
            if(!(key in this.devices)) {
                this.devices[key] = new Device(key);
            }
            targetDevice = this.devices[key]
            targetDevice.updateTopologyData(value);
        }
        for(let [key, value] of Object.entries(this.devices)) {
            if(!(key in data["devices"])) {
                this.devices[key].destroy();
                delete this.devices[key];
            }
        }
        for(let [key, value] of Object.entries(this.devices)) {
            value.updateLinkgroupData(this.devices);
        }
    }

    updateAnimation() {
        for(let [key, value] of Object.entries(this.devices)) {
            value.updateAnimation();
        }
    }

    updateGraphics() {
        for(let [key, value] of Object.entries(this.devices)) {
            value.updateGraphics(this.linkLayer, this.deviceLayer, this.devices);
        }
    }

    beginStatisticsUpdate() {
        this.updateBatch = {};
    }

    findDevicesByName(name) {
        let ret = [];
        for(let [fqdn, device] of Object.entries(this.devices)) {
            if(fqdn.match(name) === null) continue;
            ret.push(device);
        }
        return ret;
    }

    commitStatisticsUpdate() {
        for(let [fqdn, data] of Object.entries(this.updateBatch)) {
            if(!(fqdn in this.devices)) {
                console.error("received update for " + fqdn + " which is not in devices");
            } else {
                this.devices[fqdn].updateStatistics(data);
            }
        }
    }

    updateBatchDeviceExists(fqdn) {
        if(!(fqdn in this.updateBatch)) {
            this.updateBatch[fqdn] = {
                "interfaces": [],
                "status": null
            }
        }
    }

    updateBatchDeviceInterfaceExists(fqdn, iface) {
        if(!(fqdn in this.updateBatch)) {
            this.updateBatch[fqdn] = {
                "interfaces": [],
            }
        }
        if(!(iface in this.updateBatch[fqdn]["interfaces"])) {
            this.updateBatch[fqdn]["interfaces"][iface] = {
                "rx_mbps": null,
                "tx_mbps": null,
                "speed_mbps": null,
            }
        }
    }

    updateInterfaceOctetsPerSecond(prometheusResultVector) {
        for(let metric of prometheusResultVector) {
            let direction = metric["metric"]["direction"];
            let fqdn = metric["metric"]["fqdn"];
            let name = metric["metric"]["name"];
            this.updateBatchDeviceInterfaceExists(fqdn, name);
            let timestamp = metric["value"][0];
            let value = parseInt(metric["value"][1]);
            this.updateBatch[fqdn]["interfaces"][name][direction+"_mbps"] = (value * 8.0) / 1000.0 / 1000.0;
        }
        for(let [key, value] of Object.entries(this.devices)) {
            if(value.isStale()) value.interfaceUpdateEvent();
        }
    }

    updateInterfaceSpeed(prometheusResultVector) {
        for(let metric of prometheusResultVector) {
            let fqdn = metric["metric"]["fqdn"];
            let name = metric["metric"]["name"];
            this.updateBatchDeviceInterfaceExists(fqdn, name);
            let timestamp = metric["value"][0];
            let value = parseInt(metric["value"][1]);

            this.updateBatch[fqdn]["interfaces"][name]["speed_mbps"] = value;
        }
        for(let [key, value] of Object.entries(this.devices)) {
            if(value.isStale()) value.interfaceUpdateEvent();
        }
    }

    /*updateInterfaceUp(prometheusResultVector) {
        for(let metric of prometheusResultVector) {
            let fqdn = metric["metric"]["fqdn"];
            let name = metric["metric"]["name"];
            this.updateBatchDeviceInterfaceExists(fqdn, name);
            let timestamp = metric["value"][0];
            let value = parseInt(metric["value"][1]);

            this.updateBatch[fqdn]["interfaces"][name]["status"] = value;
        }
    }

    updateDeviceUp(prometheusResultVector) {
        for(let metric of prometheusResultVector) {
            let fqdn = metric["metric"]["fqdn"];
            this.updateBatchDeviceExists(fqdn);
            let timestamp = metric["value"][0];
            let value = parseInt(metric["value"][1]);

            this.updateBatch[fqdn]["status"] = value;
        }
    }*/

    updateStatuses(statusInfo) {
        for(let [fqdn, data] of Object.entries(statusInfo)) {
            if(!(fqdn in this.devices)) {
                console.error("received status update for non-existing device " + fqdn);
                continue;
            }
            this.devices[fqdn].setStatus(data);
        }
        for(let [key, value] of Object.entries(this.devices)) {
            value.checkStale();
            if(value.isStale()) value.interfaceUpdateEvent();
        }
    }

    updatePositions(positionInfo) {
        for(let [fqdn, data] of Object.entries(positionInfo)) {
            if(!(fqdn in this.devices)) {
                console.error("received position update for non-existing device " + fqdn);
                continue;
            }
            let targetDevice = this.devices[fqdn];
            targetDevice.updateWeathermapPosition(data);
        }
    }
}
