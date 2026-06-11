'use strict';

const { sanitize } = require('express-mongo-sanitize');

/**
 * Express 5 compatible wrapper around express-mongo-sanitize.
 * req.query is read-only after routing; sanitize it in place instead of reassigning.
 */
function mongoSanitize(options = {}) {
    return function mongoSanitizeMiddleware(req, res, next) {
        ['body', 'params', 'headers'].forEach((key) => {
            if (req[key]) {
                req[key] = sanitize(req[key], options);
            }
        });

        if (req.query) {
            sanitize(req.query, options);
        }

        next();
    };
}

module.exports = mongoSanitize;
