'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const Fastify = require('fastify');
const httpProxy = require('@fastify/http-proxy');
const { parseHeaders } = require('./utils');
const server = Fastify({
    trustProxy: true,
    logger: {
        level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
});

// TODO store metrics in DB like redis for example would improve performance
const statsFile = path.resolve(__dirname, '../data', 'stats.txt');
let mesurments = [{ request_count: 0 }];
try {
    mesurments = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
} catch {}

server.addHook('onResponse', (req, reply, done) => {
    if (req.url !== '/stats') {
        const requestTime = Date.now() - req.startTime;
        const rawResponse = `${req.protocol}/${req.raw.httpVersion} ${reply.statusCode} ${reply.raw.statusMessage}\r\n${parseHeaders(
            reply.getHeaders()
        )}`;

        let size = Buffer.byteLength(rawResponse);
        if (reply.hasHeader('content-length')) {
            size += parseInt(reply.getHeader('content-length'));
        }

        mesurments.push({ type: 'req', size: req.size, time: requestTime }, { type: 'res', size: size, code: reply.statusCode });

        fs.writeFile(statsFile, JSON.stringify(mesurments), (err) => {
            if (err) {
                return console.error(err);
            }
        });
    }
    done();
});

server.register(httpProxy, {
    upstream: process.env.TARGET_URL,
    httpMethods: ['GET', 'POST'],
    internalRewriteLocationHeader: false,
    preHandler: (req, reply, next) => {
        req.startTime = Date.now();

        const rawRequest = `${req.method} ${req.hostname}${req.url} ${req.protocol}/${req.raw.httpVersion}\r\n${parseHeaders(req.headers)}`;
        let size = Buffer.byteLength(rawRequest);
        if (req.headers['content-length']) {
            size += parseInt(req.headers['content-length']);
        }
        req.size = size;
        mesurments[0].request_count++;

        req.raw.headers['keepalive'] = 'on';
        next();
    },
});

server.get('/stats', (req, reply) => {
    let response;
    if (fs.existsSync(statsFile)) {
        response = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
    }
    reply.send(response || { message: 'no data available' });
});

const port = process.env.PORT || 3000;
server.listen({ port }, (err) => {
    if (err) {
        console.error('server error occur: ', err);
        process.exit(1);
    }
    console.info(`Proxy service listening on port ${port}`);
});

process.on('uncaughtException', (error) => {
    console.error('Received uncaught exception, shutting down', { error });
    server.close(() => {
        process.exit(1);
    });
});
