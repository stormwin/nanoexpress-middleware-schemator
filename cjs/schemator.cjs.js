'use strict';

var getdirname = require('getdirname');
var path = require('path');
var swaggerUiDist = require('swagger-ui-dist');
var Ajv = require('ajv');
var addFormats = require('ajv-formats');
var fastJsonStringify = require('fast-json-stringify');
var fs = require('fs');
var jsYaml = require('js-yaml');
var omit = require('lodash.omit');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var getdirname__default = /*#__PURE__*/_interopDefaultLegacy(getdirname);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var swaggerUiDist__default = /*#__PURE__*/_interopDefaultLegacy(swaggerUiDist);
var Ajv__default = /*#__PURE__*/_interopDefaultLegacy(Ajv);
var addFormats__default = /*#__PURE__*/_interopDefaultLegacy(addFormats);
var fastJsonStringify__default = /*#__PURE__*/_interopDefaultLegacy(fastJsonStringify);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var jsYaml__default = /*#__PURE__*/_interopDefaultLegacy(jsYaml);
var omit__default = /*#__PURE__*/_interopDefaultLegacy(omit);

// eslint-disable-next-line consistent-return
const importize = ({ path: _path, raw }, directory) => {
  if (path__default["default"] && !raw) {
    const resolveFile = path__default["default"].join(directory.substring(1), _path);

    const readBuffer = fs__default["default"].readFileSync(resolveFile, 'utf-8');

    if (_path.endsWith('.yaml') || _path.endsWith('.yml')) {
      return jsYaml__default["default"].load(readBuffer);
    }
    if (_path.endsWith('.json')) {
      return JSON.parse(readBuffer);
    }
    throw new Error('Only YAML and JSON file types are allowed');
  } else if (typeof raw === 'object' && raw && !path__default["default"]) {
    return raw;
  }
};

const unsupportedKeywords = ['example'];

var omitUnsupportedKeywords = (schema) => {
  const { properties, ...all } = schema;

  const omittedProperties = Object.keys(properties).reduce(
    (props, key) => ({
      ...props,
      [key]: omit__default["default"](properties[key], unsupportedKeywords)
    }),
    {}
  );

  return {
    ...all,
    properties: omittedProperties
  };
};

const flatObjects = (acc, item) =>
  acc ? Object.assign(acc, item) : item || null;

// eslint-disable-next-line no-unused-vars
const mapParams = ({ name, schema: { required, ...schema } }) => ({
  [name]: schema
});

function schemaPrepare(content, handler) {
  return Object.entries(content)
    .map(([type, { schema }]) => ({
      [type]: handler(schema)
    }))
    .reduce(flatObjects);
}

function validatorPrepare(ajv, parameters, type, isRequired) {
  if (!parameters) {
    return isRequired
      ? async (req) => {
          if (!req[type]) {
            throw new Error(`Reqest::${type} is required`);
          }
        }
      : null;
  }
  const matches = parameters.filter((param) => param.in === type);
  if (matches.length > 0) {
    const values = matches.map(mapParams).reduce(flatObjects, undefined);
    const requiredFields = matches
      .filter((param) => param.schema.required)
      .map((param) => param.name);

    return ajv.compile({
      type: 'object',
      required: requiredFields,
      properties: values
    });
  }

  return null;
}

/**
 * @name load
 * Schemator loading router method
 * @param {object} swaggerObject Internal Swagger instance
 * @param {object} config Schemator route load configuration
 * @param {string} config.method Your router method
 * @param {string} config.attach Your router path (with Swagger path format)
 * @param {string} config.path Route Swagger schema file path
 * @param {string} config.raw Route Swagger schema RAW Object
 * @param {object} ajvConfig Ajv config
 * @param {object} enableSmartFunctions Enable smart functions such as serializers and parsers
 * @memberof Schemator
 *
 * @default ajvConfig.removeAdditional all `Remove Ajv addin. props`
 *
 * @example
 * schematorInstance.load({
 *   attach: '/auth',
 *   method: 'get',
 *   path: './auth/docs.yml'
 * })
 */
function load(
  swaggerObject,
  config,
  ajvConfig = {
    removeAdditional: 'all',
    allErrors: true
  },
  enableSmartFunctions = true
) {
  let ajv;

  let prepareBodyValidator;
  let prepareQueriesValidator;
  let prepareParamsValidator;
  let prepareHeadersValidator;
  let prepareCookiesValidator;

  const routeDirectory = getdirname__default["default"]();
  const swaggerRouteObject = importize(config, routeDirectory);

  Object.assign(swaggerObject.paths, swaggerRouteObject.path);

  const { responses, requestBody, parameters } =
    swaggerRouteObject.path[config.attach][config.method];

  if (requestBody || parameters) {
    if (requestBody) {
      // eslint-disable-next-line new-cap
      ajv = Ajv__default["default"].default ? new Ajv__default["default"].default(ajvConfig) : new Ajv__default["default"](ajvConfig);
      addFormats__default["default"](ajv);

      prepareBodyValidator = schemaPrepare(requestBody.content, (schema) =>
        ajv.compile(omitUnsupportedKeywords(schema))
      );
    }

    if (parameters && parameters.length > 0) {
      if (!ajv) {
        // eslint-disable-next-line new-cap
        ajv = Ajv__default["default"].default ? new Ajv__default["default"].default(ajvConfig) : new Ajv__default["default"](ajvConfig);
        addFormats__default["default"](ajv);
      }
      prepareQueriesValidator = validatorPrepare(
        ajv,
        parameters,
        'query',
        true
      );
      prepareParamsValidator = validatorPrepare(ajv, parameters, 'path', true);
      prepareHeadersValidator = validatorPrepare(
        ajv,
        parameters,
        'headers',
        true
      );
      prepareCookiesValidator = validatorPrepare(
        ajv,
        parameters,
        'cookie',
        true
      );
    }
  }

  const compiledJson =
    enableSmartFunctions &&
    responses &&
    Object.entries(responses)
      .map(([code, { content }]) => ({
        [code]: schemaPrepare(content, fastJsonStringify__default["default"])
      }))
      .reduce(flatObjects, undefined);

  if (enableSmartFunctions && compiledJson && !this._serialized) {
    this._route._middlewares.push(async (req, res) => {
      const bodyContentType = req.headers['content-type'] || 'application/json';
      const responseContentType = req.headers.accept || bodyContentType;

      const serializeTypes =
        compiledJson[res.rawStatusCode] || compiledJson[200];
      const serializer = serializeTypes[responseContentType];

      res.serializer = serializer;
    });
    this._serialized = true;
  }

  // eslint-disable-next-line consistent-return
  return async (req, res) => {
    let errors;

    if (prepareBodyValidator && req.body) {
      const bodyValidator = prepareBodyValidator[req.headers['content-type']];

      if (bodyValidator) {
        if (!bodyValidator(req.body)) {
          errors = { body: bodyValidator.errors };
        }
      }
    }
    if (prepareQueriesValidator && req.query) {
      if (!prepareQueriesValidator(req.query)) {
        if (!errors) {
          errors = {};
        }
        errors.query = prepareQueriesValidator.errors;
      }
    }
    if (prepareParamsValidator && req.params) {
      if (!prepareParamsValidator(req.params)) {
        if (!errors) {
          errors = {};
        }
        errors.params = prepareParamsValidator;
      }
    }
    if (prepareHeadersValidator && req.headers) {
      if (!prepareHeadersValidator(req.headers)) {
        if (!errors) {
          errors = {};
        }

        errors.headers = prepareHeadersValidator.errors;
      }
    }
    if (prepareCookiesValidator && req.cookies) {
      if (!prepareCookiesValidator(req.cookies)) {
        if (!errors) {
          errors = {};
        }
        errors.cookies = prepareCookiesValidator.errors;
      }
    }

    if (fastJsonStringify__default["default"] && compiledJson) {
      res.writeHeader('Content-Type', req.headers.accept);
      res.writeStatus(res.statusCode);
    }

    if (errors) {
      return res.send({
        status: 'error',
        errors
      });
    }
  };
}

/**
 * Schemator expose Swagger documentation schema
 * @param {object} swaggerObject Internal Swagger instance
 * @memberof Schemator
 *
 * @example
 * schematorInstance.expose()
 */
function expose(swaggerObject) {
  return async (req, res) => {
    res.setHeaders({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json'
    });

    return res.end(JSON.stringify(swaggerObject, null, 2));
  };
}

/* eslint-disable max-len, eslint-comments/disable-enable-pair */
// prettier-ignore

/**
 * Schemator expose Swagger documentation schema
 * @param {object} config Swagger UI Render configuration
 * @param {string} config.title Swagger UI Render page title
 * @param {string} config.exposePath Schemator Swagger schema expose path
 * @memberof Schemator
 *
 * @default config.title `Schemator`
 *
 * @example
 * schematorInstance.render({ title: 'Docs' })
 */
function renderSwagger(config) {
  return async (req, res) =>
    res.end(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><title>${(config && config.title) || 'Schemator'}</title><link rel="stylesheet" type="text/css" href="./swagger-ui-dist/swagger-ui.css" ><link rel="icon" type="image/png" href="./swagger-ui-dist/favicon-32x32.png" sizes="32x32" /><link rel="icon" type="image/png" href="./swagger-ui-dist/favicon-16x16.png" sizes="16x16" /><style>html{box-sizing:border-box;overflow:-moz-scrollbars-vertical;overflow-y:scroll}*,:after,:before{box-sizing:inherit}body{margin:0;background:#fafafa}</style></head><body><div id="swagger-ui"></div><script src="./swagger-ui-dist/swagger-ui-bundle.js"> </script><script src="./swagger-ui-dist/swagger-ui-standalone-preset.js"></script><script>window.onload=function(){const o=SwaggerUIBundle({url:window.location.protocol+"//"+window.location.host+"${config.exposePath}",dom_id:"#swagger-ui",deepLinking:!0,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],plugins:[SwaggerUIBundle.plugins.DownloadUrl],layout:"StandaloneLayout"});window.ui=o};</script></body></html>`);
}

const staticServe = (function (t) { return Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require(t)); }); })(
  `@nanoexpress/middleware-static-serve${
    '/cjs' 
  }`
);

/**
 * Initialized Schemator instance
 * @function
 * @namespace Schemator
 * @param {object} config Schemator configuration
 * @param {string} config.swaggerPath Swagger schema file path
 * @param {string} config.swaggerRAW Swagger schema RAW Object
 * @returns {object} Return object
 * @returns {function} config.define Schemator define function to apply
 * @returns {load} config.load Loading function
 *
 * @example
 * const schematorInstance = schemator({ swaggerPath: './swagger.yml' });
 */
function schemator(config) {
  const instanceDirectory = getdirname__default["default"]();
  const swaggerObject = importize(
    {
      path: config.swaggerPath,
      raw: config.swaggerRAW
    },
    instanceDirectory
  );
  const exposePath = config.swaggerPath
    ? path__default["default"].basename(config.swaggerPath)
    : 'swagger.json';

  // We define it before function let export this
  const functionExports = {};

  functionExports.define = (app) => {
    staticServe
      .then((module) => module.default(swaggerUiDist__default["default"].absolutePath()))
      .then((result) => app.get('/swagger-ui-dist/:file', result))
      .catch((error) => {
        throw new Error(error);
      });
    app.get(`/${exposePath}`, expose(swaggerObject));
    app.get('/swagger', renderSwagger({ exposePath: `/${exposePath}` }));

    functionExports.load = load.bind(app, swaggerObject);

    return app;
  };
  functionExports.load = () => {
    throw new Error(
      'Please, define by `define` method first to make it work correctly'
    );
  };

  return functionExports;
}

module.exports = schemator;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hdG9yLmNqcy5qcyIsInNvdXJjZXMiOlsiLi4vdXRpbHMvaW1wb3J0aXplLmpzIiwiLi4vdXRpbHMvb21pdC11bnN1cHBvcnRlZC1rZXl3b3Jkcy5qcyIsIi4uL3V0aWxzL3NjaGVtYS1wcmVwYXJlLmpzIiwiLi4vbWV0aG9kcy9sb2FkLmpzIiwiLi4vbWV0aG9kcy9leHBvc2UuanMiLCIuLi9tZXRob2RzL3JlbmRlci5qcyIsIi4uL3NjaGVtYXRvci5lcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGpzWWFtbCBmcm9tICdqcy15YW1sJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY29uc2lzdGVudC1yZXR1cm5cbmNvbnN0IGltcG9ydGl6ZSA9ICh7IHBhdGg6IF9wYXRoLCByYXcgfSwgZGlyZWN0b3J5KSA9PiB7XG4gIGlmIChwYXRoICYmICFyYXcpIHtcbiAgICBjb25zdCByZXNvbHZlRmlsZSA9IHBhdGguam9pbihkaXJlY3Rvcnkuc3Vic3RyaW5nKDEpLCBfcGF0aCk7XG5cbiAgICBjb25zdCByZWFkQnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHJlc29sdmVGaWxlLCAndXRmLTgnKTtcblxuICAgIGlmIChfcGF0aC5lbmRzV2l0aCgnLnlhbWwnKSB8fCBfcGF0aC5lbmRzV2l0aCgnLnltbCcpKSB7XG4gICAgICByZXR1cm4ganNZYW1sLmxvYWQocmVhZEJ1ZmZlcik7XG4gICAgfVxuICAgIGlmIChfcGF0aC5lbmRzV2l0aCgnLmpzb24nKSkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVhZEJ1ZmZlcik7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcignT25seSBZQU1MIGFuZCBKU09OIGZpbGUgdHlwZXMgYXJlIGFsbG93ZWQnKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiByYXcgJiYgIXBhdGgpIHtcbiAgICByZXR1cm4gcmF3O1xuICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBpbXBvcnRpemU7XG4iLCJpbXBvcnQgb21pdCBmcm9tICdsb2Rhc2gub21pdCc7XG5cbmNvbnN0IHVuc3VwcG9ydGVkS2V5d29yZHMgPSBbJ2V4YW1wbGUnXTtcblxuZXhwb3J0IGRlZmF1bHQgKHNjaGVtYSkgPT4ge1xuICBjb25zdCB7IHByb3BlcnRpZXMsIC4uLmFsbCB9ID0gc2NoZW1hO1xuXG4gIGNvbnN0IG9taXR0ZWRQcm9wZXJ0aWVzID0gT2JqZWN0LmtleXMocHJvcGVydGllcykucmVkdWNlKFxuICAgIChwcm9wcywga2V5KSA9PiAoe1xuICAgICAgLi4ucHJvcHMsXG4gICAgICBba2V5XTogb21pdChwcm9wZXJ0aWVzW2tleV0sIHVuc3VwcG9ydGVkS2V5d29yZHMpXG4gICAgfSksXG4gICAge31cbiAgKTtcblxuICByZXR1cm4ge1xuICAgIC4uLmFsbCxcbiAgICBwcm9wZXJ0aWVzOiBvbWl0dGVkUHJvcGVydGllc1xuICB9O1xufTtcbiIsImV4cG9ydCBjb25zdCBmbGF0T2JqZWN0cyA9IChhY2MsIGl0ZW0pID0+XG4gIGFjYyA/IE9iamVjdC5hc3NpZ24oYWNjLCBpdGVtKSA6IGl0ZW0gfHwgbnVsbDtcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5jb25zdCBtYXBQYXJhbXMgPSAoeyBuYW1lLCBzY2hlbWE6IHsgcmVxdWlyZWQsIC4uLnNjaGVtYSB9IH0pID0+ICh7XG4gIFtuYW1lXTogc2NoZW1hXG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNjaGVtYVByZXBhcmUoY29udGVudCwgaGFuZGxlcikge1xuICByZXR1cm4gT2JqZWN0LmVudHJpZXMoY29udGVudClcbiAgICAubWFwKChbdHlwZSwgeyBzY2hlbWEgfV0pID0+ICh7XG4gICAgICBbdHlwZV06IGhhbmRsZXIoc2NoZW1hKVxuICAgIH0pKVxuICAgIC5yZWR1Y2UoZmxhdE9iamVjdHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdG9yUHJlcGFyZShhanYsIHBhcmFtZXRlcnMsIHR5cGUsIGlzUmVxdWlyZWQpIHtcbiAgaWYgKCFwYXJhbWV0ZXJzKSB7XG4gICAgcmV0dXJuIGlzUmVxdWlyZWRcbiAgICAgID8gYXN5bmMgKHJlcSkgPT4ge1xuICAgICAgICAgIGlmICghcmVxW3R5cGVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlcWVzdDo6JHt0eXBlfSBpcyByZXF1aXJlZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgOiBudWxsO1xuICB9XG4gIGNvbnN0IG1hdGNoZXMgPSBwYXJhbWV0ZXJzLmZpbHRlcigocGFyYW0pID0+IHBhcmFtLmluID09PSB0eXBlKTtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHZhbHVlcyA9IG1hdGNoZXMubWFwKG1hcFBhcmFtcykucmVkdWNlKGZsYXRPYmplY3RzLCB1bmRlZmluZWQpO1xuICAgIGNvbnN0IHJlcXVpcmVkRmllbGRzID0gbWF0Y2hlc1xuICAgICAgLmZpbHRlcigocGFyYW0pID0+IHBhcmFtLnNjaGVtYS5yZXF1aXJlZClcbiAgICAgIC5tYXAoKHBhcmFtKSA9PiBwYXJhbS5uYW1lKTtcblxuICAgIHJldHVybiBhanYuY29tcGlsZSh7XG4gICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgIHJlcXVpcmVkOiByZXF1aXJlZEZpZWxkcyxcbiAgICAgIHByb3BlcnRpZXM6IHZhbHVlc1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG4iLCJpbXBvcnQgQWp2IGZyb20gJ2Fqdic7XG5pbXBvcnQgYWRkRm9ybWF0cyBmcm9tICdhanYtZm9ybWF0cyc7XG5pbXBvcnQgZmFzdEpzb25TdHJpbmdpZnkgZnJvbSAnZmFzdC1qc29uLXN0cmluZ2lmeSc7XG5pbXBvcnQgZ2V0ZGlybmFtZSBmcm9tICdnZXRkaXJuYW1lJztcbmltcG9ydCBpbXBvcnRpemUgZnJvbSAnLi4vdXRpbHMvaW1wb3J0aXplLmpzJztcbmltcG9ydCBvbWl0VW5zdXBwb3J0ZWRLZXl3b3JkcyBmcm9tICcuLi91dGlscy9vbWl0LXVuc3VwcG9ydGVkLWtleXdvcmRzLmpzJztcbmltcG9ydCB7XG4gIGZsYXRPYmplY3RzLFxuICBzY2hlbWFQcmVwYXJlLFxuICB2YWxpZGF0b3JQcmVwYXJlXG59IGZyb20gJy4uL3V0aWxzL3NjaGVtYS1wcmVwYXJlLmpzJztcblxuLyoqXG4gKiBAbmFtZSBsb2FkXG4gKiBTY2hlbWF0b3IgbG9hZGluZyByb3V0ZXIgbWV0aG9kXG4gKiBAcGFyYW0ge29iamVjdH0gc3dhZ2dlck9iamVjdCBJbnRlcm5hbCBTd2FnZ2VyIGluc3RhbmNlXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFNjaGVtYXRvciByb3V0ZSBsb2FkIGNvbmZpZ3VyYXRpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb25maWcubWV0aG9kIFlvdXIgcm91dGVyIG1ldGhvZFxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5hdHRhY2ggWW91ciByb3V0ZXIgcGF0aCAod2l0aCBTd2FnZ2VyIHBhdGggZm9ybWF0KVxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5wYXRoIFJvdXRlIFN3YWdnZXIgc2NoZW1hIGZpbGUgcGF0aFxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5yYXcgUm91dGUgU3dhZ2dlciBzY2hlbWEgUkFXIE9iamVjdFxuICogQHBhcmFtIHtvYmplY3R9IGFqdkNvbmZpZyBBanYgY29uZmlnXG4gKiBAcGFyYW0ge29iamVjdH0gZW5hYmxlU21hcnRGdW5jdGlvbnMgRW5hYmxlIHNtYXJ0IGZ1bmN0aW9ucyBzdWNoIGFzIHNlcmlhbGl6ZXJzIGFuZCBwYXJzZXJzXG4gKiBAbWVtYmVyb2YgU2NoZW1hdG9yXG4gKlxuICogQGRlZmF1bHQgYWp2Q29uZmlnLnJlbW92ZUFkZGl0aW9uYWwgYWxsIGBSZW1vdmUgQWp2IGFkZGluLiBwcm9wc2BcbiAqXG4gKiBAZXhhbXBsZVxuICogc2NoZW1hdG9ySW5zdGFuY2UubG9hZCh7XG4gKiAgIGF0dGFjaDogJy9hdXRoJyxcbiAqICAgbWV0aG9kOiAnZ2V0JyxcbiAqICAgcGF0aDogJy4vYXV0aC9kb2NzLnltbCdcbiAqIH0pXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGxvYWQoXG4gIHN3YWdnZXJPYmplY3QsXG4gIGNvbmZpZyxcbiAgYWp2Q29uZmlnID0ge1xuICAgIHJlbW92ZUFkZGl0aW9uYWw6ICdhbGwnLFxuICAgIGFsbEVycm9yczogdHJ1ZVxuICB9LFxuICBlbmFibGVTbWFydEZ1bmN0aW9ucyA9IHRydWVcbikge1xuICBsZXQgYWp2O1xuXG4gIGxldCBwcmVwYXJlQm9keVZhbGlkYXRvcjtcbiAgbGV0IHByZXBhcmVRdWVyaWVzVmFsaWRhdG9yO1xuICBsZXQgcHJlcGFyZVBhcmFtc1ZhbGlkYXRvcjtcbiAgbGV0IHByZXBhcmVIZWFkZXJzVmFsaWRhdG9yO1xuICBsZXQgcHJlcGFyZUNvb2tpZXNWYWxpZGF0b3I7XG5cbiAgY29uc3Qgcm91dGVEaXJlY3RvcnkgPSBnZXRkaXJuYW1lKCk7XG4gIGNvbnN0IHN3YWdnZXJSb3V0ZU9iamVjdCA9IGltcG9ydGl6ZShjb25maWcsIHJvdXRlRGlyZWN0b3J5KTtcblxuICBPYmplY3QuYXNzaWduKHN3YWdnZXJPYmplY3QucGF0aHMsIHN3YWdnZXJSb3V0ZU9iamVjdC5wYXRoKTtcblxuICBjb25zdCB7IHJlc3BvbnNlcywgcmVxdWVzdEJvZHksIHBhcmFtZXRlcnMgfSA9XG4gICAgc3dhZ2dlclJvdXRlT2JqZWN0LnBhdGhbY29uZmlnLmF0dGFjaF1bY29uZmlnLm1ldGhvZF07XG5cbiAgaWYgKHJlcXVlc3RCb2R5IHx8IHBhcmFtZXRlcnMpIHtcbiAgICBpZiAocmVxdWVzdEJvZHkpIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuZXctY2FwXG4gICAgICBhanYgPSBBanYuZGVmYXVsdCA/IG5ldyBBanYuZGVmYXVsdChhanZDb25maWcpIDogbmV3IEFqdihhanZDb25maWcpO1xuICAgICAgYWRkRm9ybWF0cyhhanYpO1xuXG4gICAgICBwcmVwYXJlQm9keVZhbGlkYXRvciA9IHNjaGVtYVByZXBhcmUocmVxdWVzdEJvZHkuY29udGVudCwgKHNjaGVtYSkgPT5cbiAgICAgICAgYWp2LmNvbXBpbGUob21pdFVuc3VwcG9ydGVkS2V5d29yZHMoc2NoZW1hKSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHBhcmFtZXRlcnMgJiYgcGFyYW1ldGVycy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIWFqdikge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbmV3LWNhcFxuICAgICAgICBhanYgPSBBanYuZGVmYXVsdCA/IG5ldyBBanYuZGVmYXVsdChhanZDb25maWcpIDogbmV3IEFqdihhanZDb25maWcpO1xuICAgICAgICBhZGRGb3JtYXRzKGFqdik7XG4gICAgICB9XG4gICAgICBwcmVwYXJlUXVlcmllc1ZhbGlkYXRvciA9IHZhbGlkYXRvclByZXBhcmUoXG4gICAgICAgIGFqdixcbiAgICAgICAgcGFyYW1ldGVycyxcbiAgICAgICAgJ3F1ZXJ5JyxcbiAgICAgICAgdHJ1ZVxuICAgICAgKTtcbiAgICAgIHByZXBhcmVQYXJhbXNWYWxpZGF0b3IgPSB2YWxpZGF0b3JQcmVwYXJlKGFqdiwgcGFyYW1ldGVycywgJ3BhdGgnLCB0cnVlKTtcbiAgICAgIHByZXBhcmVIZWFkZXJzVmFsaWRhdG9yID0gdmFsaWRhdG9yUHJlcGFyZShcbiAgICAgICAgYWp2LFxuICAgICAgICBwYXJhbWV0ZXJzLFxuICAgICAgICAnaGVhZGVycycsXG4gICAgICAgIHRydWVcbiAgICAgICk7XG4gICAgICBwcmVwYXJlQ29va2llc1ZhbGlkYXRvciA9IHZhbGlkYXRvclByZXBhcmUoXG4gICAgICAgIGFqdixcbiAgICAgICAgcGFyYW1ldGVycyxcbiAgICAgICAgJ2Nvb2tpZScsXG4gICAgICAgIHRydWVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgY29tcGlsZWRKc29uID1cbiAgICBlbmFibGVTbWFydEZ1bmN0aW9ucyAmJlxuICAgIHJlc3BvbnNlcyAmJlxuICAgIE9iamVjdC5lbnRyaWVzKHJlc3BvbnNlcylcbiAgICAgIC5tYXAoKFtjb2RlLCB7IGNvbnRlbnQgfV0pID0+ICh7XG4gICAgICAgIFtjb2RlXTogc2NoZW1hUHJlcGFyZShjb250ZW50LCBmYXN0SnNvblN0cmluZ2lmeSlcbiAgICAgIH0pKVxuICAgICAgLnJlZHVjZShmbGF0T2JqZWN0cywgdW5kZWZpbmVkKTtcblxuICBpZiAoZW5hYmxlU21hcnRGdW5jdGlvbnMgJiYgY29tcGlsZWRKc29uICYmICF0aGlzLl9zZXJpYWxpemVkKSB7XG4gICAgdGhpcy5fcm91dGUuX21pZGRsZXdhcmVzLnB1c2goYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICBjb25zdCBib2R5Q29udGVudFR5cGUgPSByZXEuaGVhZGVyc1snY29udGVudC10eXBlJ10gfHwgJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgICAgY29uc3QgcmVzcG9uc2VDb250ZW50VHlwZSA9IHJlcS5oZWFkZXJzLmFjY2VwdCB8fCBib2R5Q29udGVudFR5cGU7XG5cbiAgICAgIGNvbnN0IHNlcmlhbGl6ZVR5cGVzID1cbiAgICAgICAgY29tcGlsZWRKc29uW3Jlcy5yYXdTdGF0dXNDb2RlXSB8fCBjb21waWxlZEpzb25bMjAwXTtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZXIgPSBzZXJpYWxpemVUeXBlc1tyZXNwb25zZUNvbnRlbnRUeXBlXTtcblxuICAgICAgcmVzLnNlcmlhbGl6ZXIgPSBzZXJpYWxpemVyO1xuICAgIH0pO1xuICAgIHRoaXMuX3NlcmlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGNvbnNpc3RlbnQtcmV0dXJuXG4gIHJldHVybiBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICBsZXQgZXJyb3JzO1xuXG4gICAgaWYgKHByZXBhcmVCb2R5VmFsaWRhdG9yICYmIHJlcS5ib2R5KSB7XG4gICAgICBjb25zdCBib2R5VmFsaWRhdG9yID0gcHJlcGFyZUJvZHlWYWxpZGF0b3JbcmVxLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddXTtcblxuICAgICAgaWYgKGJvZHlWYWxpZGF0b3IpIHtcbiAgICAgICAgaWYgKCFib2R5VmFsaWRhdG9yKHJlcS5ib2R5KSkge1xuICAgICAgICAgIGVycm9ycyA9IHsgYm9keTogYm9keVZhbGlkYXRvci5lcnJvcnMgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlcGFyZVF1ZXJpZXNWYWxpZGF0b3IgJiYgcmVxLnF1ZXJ5KSB7XG4gICAgICBpZiAoIXByZXBhcmVRdWVyaWVzVmFsaWRhdG9yKHJlcS5xdWVyeSkpIHtcbiAgICAgICAgaWYgKCFlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlcnJvcnMucXVlcnkgPSBwcmVwYXJlUXVlcmllc1ZhbGlkYXRvci5lcnJvcnM7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmVwYXJlUGFyYW1zVmFsaWRhdG9yICYmIHJlcS5wYXJhbXMpIHtcbiAgICAgIGlmICghcHJlcGFyZVBhcmFtc1ZhbGlkYXRvcihyZXEucGFyYW1zKSkge1xuICAgICAgICBpZiAoIWVycm9ycykge1xuICAgICAgICAgIGVycm9ycyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVycm9ycy5wYXJhbXMgPSBwcmVwYXJlUGFyYW1zVmFsaWRhdG9yO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlcGFyZUhlYWRlcnNWYWxpZGF0b3IgJiYgcmVxLmhlYWRlcnMpIHtcbiAgICAgIGlmICghcHJlcGFyZUhlYWRlcnNWYWxpZGF0b3IocmVxLmhlYWRlcnMpKSB7XG4gICAgICAgIGlmICghZXJyb3JzKSB7XG4gICAgICAgICAgZXJyb3JzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBlcnJvcnMuaGVhZGVycyA9IHByZXBhcmVIZWFkZXJzVmFsaWRhdG9yLmVycm9ycztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXBhcmVDb29raWVzVmFsaWRhdG9yICYmIHJlcS5jb29raWVzKSB7XG4gICAgICBpZiAoIXByZXBhcmVDb29raWVzVmFsaWRhdG9yKHJlcS5jb29raWVzKSkge1xuICAgICAgICBpZiAoIWVycm9ycykge1xuICAgICAgICAgIGVycm9ycyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVycm9ycy5jb29raWVzID0gcHJlcGFyZUNvb2tpZXNWYWxpZGF0b3IuZXJyb3JzO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmYXN0SnNvblN0cmluZ2lmeSAmJiBjb21waWxlZEpzb24pIHtcbiAgICAgIHJlcy53cml0ZUhlYWRlcignQ29udGVudC1UeXBlJywgcmVxLmhlYWRlcnMuYWNjZXB0KTtcbiAgICAgIHJlcy53cml0ZVN0YXR1cyhyZXMuc3RhdHVzQ29kZSk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9ycykge1xuICAgICAgcmV0dXJuIHJlcy5zZW5kKHtcbiAgICAgICAgc3RhdHVzOiAnZXJyb3InLFxuICAgICAgICBlcnJvcnNcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cbiIsIi8qKlxuICogU2NoZW1hdG9yIGV4cG9zZSBTd2FnZ2VyIGRvY3VtZW50YXRpb24gc2NoZW1hXG4gKiBAcGFyYW0ge29iamVjdH0gc3dhZ2dlck9iamVjdCBJbnRlcm5hbCBTd2FnZ2VyIGluc3RhbmNlXG4gKiBAbWVtYmVyb2YgU2NoZW1hdG9yXG4gKlxuICogQGV4YW1wbGVcbiAqIHNjaGVtYXRvckluc3RhbmNlLmV4cG9zZSgpXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGV4cG9zZShzd2FnZ2VyT2JqZWN0KSB7XG4gIHJldHVybiBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICByZXMuc2V0SGVhZGVycyh7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzLmVuZChKU09OLnN0cmluZ2lmeShzd2FnZ2VyT2JqZWN0LCBudWxsLCAyKSk7XG4gIH07XG59XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBtYXgtbGVuLCBlc2xpbnQtY29tbWVudHMvZGlzYWJsZS1lbmFibGUtcGFpciAqL1xuLy8gcHJldHRpZXItaWdub3JlXG5cbi8qKlxuICogU2NoZW1hdG9yIGV4cG9zZSBTd2FnZ2VyIGRvY3VtZW50YXRpb24gc2NoZW1hXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFN3YWdnZXIgVUkgUmVuZGVyIGNvbmZpZ3VyYXRpb25cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb25maWcudGl0bGUgU3dhZ2dlciBVSSBSZW5kZXIgcGFnZSB0aXRsZVxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5leHBvc2VQYXRoIFNjaGVtYXRvciBTd2FnZ2VyIHNjaGVtYSBleHBvc2UgcGF0aFxuICogQG1lbWJlcm9mIFNjaGVtYXRvclxuICpcbiAqIEBkZWZhdWx0IGNvbmZpZy50aXRsZSBgU2NoZW1hdG9yYFxuICpcbiAqIEBleGFtcGxlXG4gKiBzY2hlbWF0b3JJbnN0YW5jZS5yZW5kZXIoeyB0aXRsZTogJ0RvY3MnIH0pXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlbmRlclN3YWdnZXIoY29uZmlnKSB7XG4gIHJldHVybiBhc3luYyAocmVxLCByZXMpID0+XG4gICAgcmVzLmVuZChgPCFET0NUWVBFIGh0bWw+PGh0bWwgbGFuZz1cImVuXCI+PGhlYWQ+XG4gICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCI+PHRpdGxlPiR7KGNvbmZpZyAmJiBjb25maWcudGl0bGUpIHx8ICdTY2hlbWF0b3InfTwvdGl0bGU+PGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIHR5cGU9XCJ0ZXh0L2Nzc1wiIGhyZWY9XCIuL3N3YWdnZXItdWktZGlzdC9zd2FnZ2VyLXVpLmNzc1wiID48bGluayByZWw9XCJpY29uXCIgdHlwZT1cImltYWdlL3BuZ1wiIGhyZWY9XCIuL3N3YWdnZXItdWktZGlzdC9mYXZpY29uLTMyeDMyLnBuZ1wiIHNpemVzPVwiMzJ4MzJcIiAvPjxsaW5rIHJlbD1cImljb25cIiB0eXBlPVwiaW1hZ2UvcG5nXCIgaHJlZj1cIi4vc3dhZ2dlci11aS1kaXN0L2Zhdmljb24tMTZ4MTYucG5nXCIgc2l6ZXM9XCIxNngxNlwiIC8+PHN0eWxlPmh0bWx7Ym94LXNpemluZzpib3JkZXItYm94O292ZXJmbG93Oi1tb3otc2Nyb2xsYmFycy12ZXJ0aWNhbDtvdmVyZmxvdy15OnNjcm9sbH0qLDphZnRlciw6YmVmb3Jle2JveC1zaXppbmc6aW5oZXJpdH1ib2R5e21hcmdpbjowO2JhY2tncm91bmQ6I2ZhZmFmYX08L3N0eWxlPjwvaGVhZD48Ym9keT48ZGl2IGlkPVwic3dhZ2dlci11aVwiPjwvZGl2PjxzY3JpcHQgc3JjPVwiLi9zd2FnZ2VyLXVpLWRpc3Qvc3dhZ2dlci11aS1idW5kbGUuanNcIj4gPC9zY3JpcHQ+PHNjcmlwdCBzcmM9XCIuL3N3YWdnZXItdWktZGlzdC9zd2FnZ2VyLXVpLXN0YW5kYWxvbmUtcHJlc2V0LmpzXCI+PC9zY3JpcHQ+PHNjcmlwdD53aW5kb3cub25sb2FkPWZ1bmN0aW9uKCl7Y29uc3Qgbz1Td2FnZ2VyVUlCdW5kbGUoe3VybDp3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wrXCIvL1wiK3dpbmRvdy5sb2NhdGlvbi5ob3N0K1wiJHtjb25maWcuZXhwb3NlUGF0aH1cIixkb21faWQ6XCIjc3dhZ2dlci11aVwiLGRlZXBMaW5raW5nOiEwLHByZXNldHM6W1N3YWdnZXJVSUJ1bmRsZS5wcmVzZXRzLmFwaXMsU3dhZ2dlclVJU3RhbmRhbG9uZVByZXNldF0scGx1Z2luczpbU3dhZ2dlclVJQnVuZGxlLnBsdWdpbnMuRG93bmxvYWRVcmxdLGxheW91dDpcIlN0YW5kYWxvbmVMYXlvdXRcIn0pO3dpbmRvdy51aT1vfTs8L3NjcmlwdD48L2JvZHk+PC9odG1sPmApO1xufVxuIiwiaW1wb3J0IGdldGRpcm5hbWUgZnJvbSAnZ2V0ZGlybmFtZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBzd2FnZ2VyVWlEaXN0IGZyb20gJ3N3YWdnZXItdWktZGlzdCc7XG5pbXBvcnQgeyBleHBvc2UsIGxvYWQsIHJlbmRlciB9IGZyb20gJy4vbWV0aG9kcy9pbmRleC5qcyc7XG5pbXBvcnQgaW1wb3J0aXplIGZyb20gJy4vdXRpbHMvaW1wb3J0aXplLmpzJztcblxuY29uc3Qgc3RhdGljU2VydmUgPSBpbXBvcnQoXG4gIGBAbmFub2V4cHJlc3MvbWlkZGxld2FyZS1zdGF0aWMtc2VydmUke1xuICAgIHByb2Nlc3MuZW52Lk5BTk9fRU5WX01PRFVMRSA9PT0gJ2NvbW1vbmpzJyA/ICcvY2pzJyA6ICcnXG4gIH1gXG4pO1xuXG4vKipcbiAqIEluaXRpYWxpemVkIFNjaGVtYXRvciBpbnN0YW5jZVxuICogQGZ1bmN0aW9uXG4gKiBAbmFtZXNwYWNlIFNjaGVtYXRvclxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZyBTY2hlbWF0b3IgY29uZmlndXJhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5zd2FnZ2VyUGF0aCBTd2FnZ2VyIHNjaGVtYSBmaWxlIHBhdGhcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb25maWcuc3dhZ2dlclJBVyBTd2FnZ2VyIHNjaGVtYSBSQVcgT2JqZWN0XG4gKiBAcmV0dXJucyB7b2JqZWN0fSBSZXR1cm4gb2JqZWN0XG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IGNvbmZpZy5kZWZpbmUgU2NoZW1hdG9yIGRlZmluZSBmdW5jdGlvbiB0byBhcHBseVxuICogQHJldHVybnMge2xvYWR9IGNvbmZpZy5sb2FkIExvYWRpbmcgZnVuY3Rpb25cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc2NoZW1hdG9ySW5zdGFuY2UgPSBzY2hlbWF0b3IoeyBzd2FnZ2VyUGF0aDogJy4vc3dhZ2dlci55bWwnIH0pO1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzY2hlbWF0b3IoY29uZmlnKSB7XG4gIGNvbnN0IGluc3RhbmNlRGlyZWN0b3J5ID0gZ2V0ZGlybmFtZSgpO1xuICBjb25zdCBzd2FnZ2VyT2JqZWN0ID0gaW1wb3J0aXplKFxuICAgIHtcbiAgICAgIHBhdGg6IGNvbmZpZy5zd2FnZ2VyUGF0aCxcbiAgICAgIHJhdzogY29uZmlnLnN3YWdnZXJSQVdcbiAgICB9LFxuICAgIGluc3RhbmNlRGlyZWN0b3J5XG4gICk7XG4gIGNvbnN0IGV4cG9zZVBhdGggPSBjb25maWcuc3dhZ2dlclBhdGhcbiAgICA/IHBhdGguYmFzZW5hbWUoY29uZmlnLnN3YWdnZXJQYXRoKVxuICAgIDogJ3N3YWdnZXIuanNvbic7XG5cbiAgLy8gV2UgZGVmaW5lIGl0IGJlZm9yZSBmdW5jdGlvbiBsZXQgZXhwb3J0IHRoaXNcbiAgY29uc3QgZnVuY3Rpb25FeHBvcnRzID0ge307XG5cbiAgZnVuY3Rpb25FeHBvcnRzLmRlZmluZSA9IChhcHApID0+IHtcbiAgICBzdGF0aWNTZXJ2ZVxuICAgICAgLnRoZW4oKG1vZHVsZSkgPT4gbW9kdWxlLmRlZmF1bHQoc3dhZ2dlclVpRGlzdC5hYnNvbHV0ZVBhdGgoKSkpXG4gICAgICAudGhlbigocmVzdWx0KSA9PiBhcHAuZ2V0KCcvc3dhZ2dlci11aS1kaXN0LzpmaWxlJywgcmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yKTtcbiAgICAgIH0pO1xuICAgIGFwcC5nZXQoYC8ke2V4cG9zZVBhdGh9YCwgZXhwb3NlKHN3YWdnZXJPYmplY3QpKTtcbiAgICBhcHAuZ2V0KCcvc3dhZ2dlcicsIHJlbmRlcih7IGV4cG9zZVBhdGg6IGAvJHtleHBvc2VQYXRofWAgfSkpO1xuXG4gICAgZnVuY3Rpb25FeHBvcnRzLmxvYWQgPSBsb2FkLmJpbmQoYXBwLCBzd2FnZ2VyT2JqZWN0KTtcblxuICAgIHJldHVybiBhcHA7XG4gIH07XG4gIGZ1bmN0aW9uRXhwb3J0cy5sb2FkID0gKCkgPT4ge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdQbGVhc2UsIGRlZmluZSBieSBgZGVmaW5lYCBtZXRob2QgZmlyc3QgdG8gbWFrZSBpdCB3b3JrIGNvcnJlY3RseSdcbiAgICApO1xuICB9O1xuXG4gIHJldHVybiBmdW5jdGlvbkV4cG9ydHM7XG59XG4iXSwibmFtZXMiOlsicGF0aCIsImZzIiwianNZYW1sIiwib21pdCIsImdldGRpcm5hbWUiLCJBanYiLCJhZGRGb3JtYXRzIiwiZmFzdEpzb25TdHJpbmdpZnkiLCJzd2FnZ2VyVWlEaXN0IiwicmVuZGVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQTtBQUNBLE1BQU0sU0FBUyxHQUFHLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFLFNBQVMsS0FBSztBQUN2RCxFQUFFLElBQUlBLHdCQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7QUFDcEIsSUFBSSxNQUFNLFdBQVcsR0FBR0Esd0JBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNqRTtBQUNBLElBQUksTUFBTSxVQUFVLEdBQUdDLHNCQUFFLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM3RDtBQUNBLElBQUksSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDM0QsTUFBTSxPQUFPQywwQkFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNyQyxLQUFLO0FBQ0wsSUFBSSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDakMsTUFBTSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsVUFB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
