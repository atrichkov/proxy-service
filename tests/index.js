'use strict';

require('dotenv').config();
const autocannon = require('autocannon');

const instance = autocannon(
    {
        url: `http://localhost:${process.env.PORT}`,
        connections: 100,
        duration: 5,
    },
    console.log
);

// // this is used to kill the instance on CTRL-C
process.once('SIGINT', () => {
    instance.stop();
});

// just render results
autocannon.track(instance, { renderProgressBar: false });
