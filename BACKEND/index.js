require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 9000;
const ZABBIX_API_URL = process.env.ZABBIX_API_URL;

// Middleware
app.use(cors());
app.use(express.json());

// Centralized axios instance for Zabbix API
const zabbixApi = axios.create({
    baseURL: ZABBIX_API_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Error handling middleware
const errorHandler = (res, error) => {
    console.error('API Error:', error);
    res.status(500).json({ error: error.response?.data || error.message });
};

// Zabbix API authentication
const loginToZabbix = async () => {
    try {
        const response = await zabbixApi.post('', {
            jsonrpc: '2.0',
            method: 'user.login',
            params: {
                username: process.env.ZABBIX_API_USER,
                password: process.env.ZABBIX_API_PASSWORD
            },
            id: 1
        });
        return response.data.result;
    } catch (error) {
        throw new Error('Failed to authenticate with Zabbix API');
    }
};

// Generic API request handler
const makeZabbixRequest = async (authToken, method, params) => {
    const response = await zabbixApi.post('', {
        jsonrpc: '2.0',
        method,
        params,
        id: 1
    }, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    return response.data.result;
};

// Route handler wrapper
const apiRoute = (fn) => async (req, res) => {
    try {
        const authToken = await loginToZabbix();
        const result = await fn(authToken, req);
        res.status(200).json(result);
    } catch (error) {
        errorHandler(res, error);
    }
};

// API Routes
app.post('/api/zabbix/hosts', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'host.get', req.body || {})
));

app.post('/api/zabbix/cpu-load', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'item.get', {
        output: ['itemid', 'name', 'lastvalue'],
        search: { key_: 'system.cpu.load' },
        hostids: req.body.hostid,
        sortfield: 'name'
    })
));

app.post('/api/zabbix/uptime', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'item.get', {
        output: ['itemid', 'name', 'lastvalue'],
        search: { key_: 'system.uptime' },
        hostids: req.body.hostid,
        sortfield: 'name'
    })
));

app.post('/api/zabbix/alerts', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'trigger.get', {
        output: ['triggerid', 'description', 'priority', 'lastchange'],
        hostids: req.body.hostid,
        filter: { value: 1 },
        expandDescription: true,
        sortfield: 'priority',
        sortorder: 'DESC'
    })
));

app.post('/api/zabbix/active-triggers', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'trigger.get', {
        output: ['triggerid', 'description', 'priority', 'lastchange', 'expression'],
        selectDependencies: 'extend',
        skipDependent: true,
        hostids: req.body.hostid,
        filter: { value: 1, status: 0 },
        expandDescription: true,
        sortfield: 'priority',
        sortorder: 'DESC'
    })
));

app.post('/api/zabbix/problems', apiRoute(async (authToken, req) =>
    makeZabbixRequest(authToken, 'problem.get', {
        output: 'extend',
        selectAcknowledges: 'extend',
        selectTags: 'extend',
        selectSuppressionData: 'extend',
        objectids: req.body.hostid,
        recent: true,
        sortfield: ['eventid'],
        sortorder: 'DESC'
    })
));

app.post('/api/zabbix/trigger/create', apiRoute(async (authToken, req) => {
    const { hostid, description, expression, priority = 2 } = req.body;
    if (!hostid || !description || !expression) {
        throw new Error('Missing required fields: hostid, description, or expression');
    }
    return makeZabbixRequest(authToken, 'trigger.create', {
        description,
        expression,
        priority,
        status: 0,
        type: 0
    });
}));

app.post('/api/zabbix/trigger/update', apiRoute(async (authToken, req) => {
    const { triggerid, status } = req.body;
    if (!triggerid || status === undefined) {
        throw new Error('Missing required fields: triggerid or status');
    }
    return makeZabbixRequest(authToken, 'trigger.update', {
        triggerid,
        status
    });
}));

app.post('/api/zabbix/cpu-load-latest', apiRoute(async (authToken, req) => {
    const { hostid } = req.body;
    if (!hostid) {
        throw new Error('Missing required field: hostid');
    }

    // Step 1: Get itemid for system.cpu.load[percpu,avg1]
    const items = await makeZabbixRequest(authToken, 'item.get', {
        output: ['itemid', 'name', 'lastvalue'],
        hostids: hostid,
        search: { key_: 'system.cpu.load' },
        sortfield: 'name'
    });

    if (!items || items.length === 0) {
        throw new Error('No CPU load item found for the specified host');
    }

    const itemid = items[0].itemid;

    const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
    const timeFrom = currentTime - 60; // last 1 minute

    // Step 2: Get CPU load data from last 1 minute
    return makeZabbixRequest(authToken, 'history.get', {
        output: 'extend',
        itemids: [itemid],
        history: 0, // Numeric float
        // time_from: timeFrom,
        // time_till: currentTime,
        limit: 10, // adjust if needed
        sortfield: 'clock',
        sortorder: 'DESC'
    });
}));


// Endpoint for latest memory utilization
app.post('/api/zabbix/memory-utilization-latest', apiRoute(async (authToken, req) => {
    const { hostid } = req.body;
    if (!hostid) {
        throw new Error('Missing required field: hostid');
    }
    const items = await makeZabbixRequest(authToken, 'item.get', {
        output: ['itemid'],
        hostids: hostid,
        search: { key_: 'vm.memory.size[pavailable]' }
    });
    if (!items || items.length === 0) {
        throw new Error('No memory utilization item found for the specified host');
    }
    const itemid = items[0].itemid;
    const currentTime = Math.floor(Date.now() / 1000);
    return makeZabbixRequest(authToken, 'history.get', {
        output: 'extend',
        itemids: [itemid],
        history: 0, // Float data type for memory utilization
        time_from: currentTime - 60, // 60-second window
        time_till: currentTime,
        limit: 1,
        sortfield: 'clock',
        sortorder: 'DESC'
    });
}));

// Endpoint for latest disk utilization
app.post('/api/zabbix/disk-utilization-latest', apiRoute(async (authToken, req) => {
    const { hostid } = req.body;

    if (!hostid) {
        throw new Error('Missing required field: hostid');
    }
    const items = await makeZabbixRequest(authToken, 'item.get', {
        output: 'extend',
        hostids: hostid,
        search: { key_: "vfs.fs.dependent.size[/,pused]" }  
    });


    if (!items || items.length === 0) {
        return [];
    }
    const itemid = items[0].itemid;
    const currentTime = Math.floor(Date.now() / 1000);
    return makeZabbixRequest(authToken, 'history.get', {
        output: 'extend',
        itemids: [itemid],
        history: 0, // Float data type for disk utilization
        // // time_from: currentTime - 60, // 60-second window
        // // time_till: currentTime,
        limit: 1,
        sortfield: 'clock',
        sortorder: 'DESC'
    });
}));


// Server startup
app.listen(PORT, () => {
    console.info(`Server running on http://localhost:${PORT}`);
});