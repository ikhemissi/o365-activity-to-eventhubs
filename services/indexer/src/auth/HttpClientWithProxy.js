const { ProxyAgent } = require('undici');

class HttpClientWithProxy {
    constructor(proxyUri) {
        this.proxy = new ProxyAgent({
            uri: proxyUri,
        });
    }

    sendGetRequestAsync(url, options) {
        return this.sendRequestAsync(url, 'GET', options);
    }

    sendPostRequestAsync(url, options) {
        return this.sendRequestAsync(url, 'POST', options);
    }

    async sendRequestAsync(url, method, options) {
        const requestOptions = {
            method: method,
            headers: options.headers,
            dispatcher: this.proxy,
        };

        if (method === 'POST') {
            requestOptions.body = options.body;
        }

        const response = await fetch(url, requestOptions);
        const data = await response.json();

        const headersObj = {};

        response.headers.forEach((value, key) => {
            headersObj[key] = value;
        });

        return {
            headers: headersObj,
            body: data,
            status: response.status,
        };
    }
}

module.exports = HttpClientWithProxy;
