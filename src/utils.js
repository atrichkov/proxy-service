'use strict';

module.exports = {
    parseHeaders: (headers) => {
        let result = ``;
        for (const header in headers) {
            result += `${header}: ${headers[header]}\r\n`;
        }
        return result;
    },
};
