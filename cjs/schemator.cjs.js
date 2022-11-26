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
    const resolveFile = path__default["default"].join(directory, _path);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hdG9yLmNqcy5qcyIsInNvdXJjZXMiOlsiLi4vdXRpbHMvaW1wb3J0aXplLmpzIiwiLi4vdXRpbHMvb21pdC11bnN1cHBvcnRlZC1rZXl3b3Jkcy5qcyIsIi4uL3V0aWxzL3NjaGVtYS1wcmVwYXJlLmpzIiwiLi4vbWV0aG9kcy9sb2FkLmpzIiwiLi4vbWV0aG9kcy9leHBvc2UuanMiLCIuLi9tZXRob2RzL3JlbmRlci5qcyIsIi4uL3NjaGVtYXRvci5lcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGpzWWFtbCBmcm9tICdqcy15YW1sJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY29uc2lzdGVudC1yZXR1cm5cbmNvbnN0IGltcG9ydGl6ZSA9ICh7IHBhdGg6IF9wYXRoLCByYXcgfSwgZGlyZWN0b3J5KSA9PiB7XG4gIGlmIChwYXRoICYmICFyYXcpIHtcbiAgICBjb25zdCByZXNvbHZlRmlsZSA9IHBhdGguam9pbihkaXJlY3RvcnksIF9wYXRoKTtcblxuICAgIGNvbnN0IHJlYWRCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZUZpbGUsICd1dGYtOCcpO1xuXG4gICAgaWYgKF9wYXRoLmVuZHNXaXRoKCcueWFtbCcpIHx8IF9wYXRoLmVuZHNXaXRoKCcueW1sJykpIHtcbiAgICAgIHJldHVybiBqc1lhbWwubG9hZChyZWFkQnVmZmVyKTtcbiAgICB9XG4gICAgaWYgKF9wYXRoLmVuZHNXaXRoKCcuanNvbicpKSB7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkQnVmZmVyKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IFlBTUwgYW5kIEpTT04gZmlsZSB0eXBlcyBhcmUgYWxsb3dlZCcpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiByYXcgPT09ICdvYmplY3QnICYmIHJhdyAmJiAhcGF0aCkge1xuICAgIHJldHVybiByYXc7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGltcG9ydGl6ZTtcbiIsImltcG9ydCBvbWl0IGZyb20gJ2xvZGFzaC5vbWl0JztcblxuY29uc3QgdW5zdXBwb3J0ZWRLZXl3b3JkcyA9IFsnZXhhbXBsZSddO1xuXG5leHBvcnQgZGVmYXVsdCAoc2NoZW1hKSA9PiB7XG4gIGNvbnN0IHsgcHJvcGVydGllcywgLi4uYWxsIH0gPSBzY2hlbWE7XG5cbiAgY29uc3Qgb21pdHRlZFByb3BlcnRpZXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5yZWR1Y2UoXG4gICAgKHByb3BzLCBrZXkpID0+ICh7XG4gICAgICAuLi5wcm9wcyxcbiAgICAgIFtrZXldOiBvbWl0KHByb3BlcnRpZXNba2V5XSwgdW5zdXBwb3J0ZWRLZXl3b3JkcylcbiAgICB9KSxcbiAgICB7fVxuICApO1xuXG4gIHJldHVybiB7XG4gICAgLi4uYWxsLFxuICAgIHByb3BlcnRpZXM6IG9taXR0ZWRQcm9wZXJ0aWVzXG4gIH07XG59O1xuIiwiZXhwb3J0IGNvbnN0IGZsYXRPYmplY3RzID0gKGFjYywgaXRlbSkgPT5cbiAgYWNjID8gT2JqZWN0LmFzc2lnbihhY2MsIGl0ZW0pIDogaXRlbSB8fCBudWxsO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmNvbnN0IG1hcFBhcmFtcyA9ICh7IG5hbWUsIHNjaGVtYTogeyByZXF1aXJlZCwgLi4uc2NoZW1hIH0gfSkgPT4gKHtcbiAgW25hbWVdOiBzY2hlbWFcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gc2NoZW1hUHJlcGFyZShjb250ZW50LCBoYW5kbGVyKSB7XG4gIHJldHVybiBPYmplY3QuZW50cmllcyhjb250ZW50KVxuICAgIC5tYXAoKFt0eXBlLCB7IHNjaGVtYSB9XSkgPT4gKHtcbiAgICAgIFt0eXBlXTogaGFuZGxlcihzY2hlbWEpXG4gICAgfSkpXG4gICAgLnJlZHVjZShmbGF0T2JqZWN0cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0b3JQcmVwYXJlKGFqdiwgcGFyYW1ldGVycywgdHlwZSwgaXNSZXF1aXJlZCkge1xuICBpZiAoIXBhcmFtZXRlcnMpIHtcbiAgICByZXR1cm4gaXNSZXF1aXJlZFxuICAgICAgPyBhc3luYyAocmVxKSA9PiB7XG4gICAgICAgICAgaWYgKCFyZXFbdHlwZV0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVxZXN0Ojoke3R5cGV9IGlzIHJlcXVpcmVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICA6IG51bGw7XG4gIH1cbiAgY29uc3QgbWF0Y2hlcyA9IHBhcmFtZXRlcnMuZmlsdGVyKChwYXJhbSkgPT4gcGFyYW0uaW4gPT09IHR5cGUpO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgdmFsdWVzID0gbWF0Y2hlcy5tYXAobWFwUGFyYW1zKS5yZWR1Y2UoZmxhdE9iamVjdHMsIHVuZGVmaW5lZCk7XG4gICAgY29uc3QgcmVxdWlyZWRGaWVsZHMgPSBtYXRjaGVzXG4gICAgICAuZmlsdGVyKChwYXJhbSkgPT4gcGFyYW0uc2NoZW1hLnJlcXVpcmVkKVxuICAgICAgLm1hcCgocGFyYW0pID0+IHBhcmFtLm5hbWUpO1xuXG4gICAgcmV0dXJuIGFqdi5jb21waWxlKHtcbiAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgcmVxdWlyZWQ6IHJlcXVpcmVkRmllbGRzLFxuICAgICAgcHJvcGVydGllczogdmFsdWVzXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiIsImltcG9ydCBBanYgZnJvbSAnYWp2JztcbmltcG9ydCBhZGRGb3JtYXRzIGZyb20gJ2Fqdi1mb3JtYXRzJztcbmltcG9ydCBmYXN0SnNvblN0cmluZ2lmeSBmcm9tICdmYXN0LWpzb24tc3RyaW5naWZ5JztcbmltcG9ydCBnZXRkaXJuYW1lIGZyb20gJ2dldGRpcm5hbWUnO1xuaW1wb3J0IGltcG9ydGl6ZSBmcm9tICcuLi91dGlscy9pbXBvcnRpemUuanMnO1xuaW1wb3J0IG9taXRVbnN1cHBvcnRlZEtleXdvcmRzIGZyb20gJy4uL3V0aWxzL29taXQtdW5zdXBwb3J0ZWQta2V5d29yZHMuanMnO1xuaW1wb3J0IHtcbiAgZmxhdE9iamVjdHMsXG4gIHNjaGVtYVByZXBhcmUsXG4gIHZhbGlkYXRvclByZXBhcmVcbn0gZnJvbSAnLi4vdXRpbHMvc2NoZW1hLXByZXBhcmUuanMnO1xuXG4vKipcbiAqIEBuYW1lIGxvYWRcbiAqIFNjaGVtYXRvciBsb2FkaW5nIHJvdXRlciBtZXRob2RcbiAqIEBwYXJhbSB7b2JqZWN0fSBzd2FnZ2VyT2JqZWN0IEludGVybmFsIFN3YWdnZXIgaW5zdGFuY2VcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgU2NoZW1hdG9yIHJvdXRlIGxvYWQgY29uZmlndXJhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5tZXRob2QgWW91ciByb3V0ZXIgbWV0aG9kXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmF0dGFjaCBZb3VyIHJvdXRlciBwYXRoICh3aXRoIFN3YWdnZXIgcGF0aCBmb3JtYXQpXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLnBhdGggUm91dGUgU3dhZ2dlciBzY2hlbWEgZmlsZSBwYXRoXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLnJhdyBSb3V0ZSBTd2FnZ2VyIHNjaGVtYSBSQVcgT2JqZWN0XG4gKiBAcGFyYW0ge29iamVjdH0gYWp2Q29uZmlnIEFqdiBjb25maWdcbiAqIEBwYXJhbSB7b2JqZWN0fSBlbmFibGVTbWFydEZ1bmN0aW9ucyBFbmFibGUgc21hcnQgZnVuY3Rpb25zIHN1Y2ggYXMgc2VyaWFsaXplcnMgYW5kIHBhcnNlcnNcbiAqIEBtZW1iZXJvZiBTY2hlbWF0b3JcbiAqXG4gKiBAZGVmYXVsdCBhanZDb25maWcucmVtb3ZlQWRkaXRpb25hbCBhbGwgYFJlbW92ZSBBanYgYWRkaW4uIHByb3BzYFxuICpcbiAqIEBleGFtcGxlXG4gKiBzY2hlbWF0b3JJbnN0YW5jZS5sb2FkKHtcbiAqICAgYXR0YWNoOiAnL2F1dGgnLFxuICogICBtZXRob2Q6ICdnZXQnLFxuICogICBwYXRoOiAnLi9hdXRoL2RvY3MueW1sJ1xuICogfSlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbG9hZChcbiAgc3dhZ2dlck9iamVjdCxcbiAgY29uZmlnLFxuICBhanZDb25maWcgPSB7XG4gICAgcmVtb3ZlQWRkaXRpb25hbDogJ2FsbCcsXG4gICAgYWxsRXJyb3JzOiB0cnVlXG4gIH0sXG4gIGVuYWJsZVNtYXJ0RnVuY3Rpb25zID0gdHJ1ZVxuKSB7XG4gIGxldCBhanY7XG5cbiAgbGV0IHByZXBhcmVCb2R5VmFsaWRhdG9yO1xuICBsZXQgcHJlcGFyZVF1ZXJpZXNWYWxpZGF0b3I7XG4gIGxldCBwcmVwYXJlUGFyYW1zVmFsaWRhdG9yO1xuICBsZXQgcHJlcGFyZUhlYWRlcnNWYWxpZGF0b3I7XG4gIGxldCBwcmVwYXJlQ29va2llc1ZhbGlkYXRvcjtcblxuICBjb25zdCByb3V0ZURpcmVjdG9yeSA9IGdldGRpcm5hbWUoKTtcbiAgY29uc3Qgc3dhZ2dlclJvdXRlT2JqZWN0ID0gaW1wb3J0aXplKGNvbmZpZywgcm91dGVEaXJlY3RvcnkpO1xuXG4gIE9iamVjdC5hc3NpZ24oc3dhZ2dlck9iamVjdC5wYXRocywgc3dhZ2dlclJvdXRlT2JqZWN0LnBhdGgpO1xuXG4gIGNvbnN0IHsgcmVzcG9uc2VzLCByZXF1ZXN0Qm9keSwgcGFyYW1ldGVycyB9ID1cbiAgICBzd2FnZ2VyUm91dGVPYmplY3QucGF0aFtjb25maWcuYXR0YWNoXVtjb25maWcubWV0aG9kXTtcblxuICBpZiAocmVxdWVzdEJvZHkgfHwgcGFyYW1ldGVycykge1xuICAgIGlmIChyZXF1ZXN0Qm9keSkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5ldy1jYXBcbiAgICAgIGFqdiA9IEFqdi5kZWZhdWx0ID8gbmV3IEFqdi5kZWZhdWx0KGFqdkNvbmZpZykgOiBuZXcgQWp2KGFqdkNvbmZpZyk7XG4gICAgICBhZGRGb3JtYXRzKGFqdik7XG5cbiAgICAgIHByZXBhcmVCb2R5VmFsaWRhdG9yID0gc2NoZW1hUHJlcGFyZShyZXF1ZXN0Qm9keS5jb250ZW50LCAoc2NoZW1hKSA9PlxuICAgICAgICBhanYuY29tcGlsZShvbWl0VW5zdXBwb3J0ZWRLZXl3b3JkcyhzY2hlbWEpKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAocGFyYW1ldGVycyAmJiBwYXJhbWV0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmICghYWp2KSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuZXctY2FwXG4gICAgICAgIGFqdiA9IEFqdi5kZWZhdWx0ID8gbmV3IEFqdi5kZWZhdWx0KGFqdkNvbmZpZykgOiBuZXcgQWp2KGFqdkNvbmZpZyk7XG4gICAgICAgIGFkZEZvcm1hdHMoYWp2KTtcbiAgICAgIH1cbiAgICAgIHByZXBhcmVRdWVyaWVzVmFsaWRhdG9yID0gdmFsaWRhdG9yUHJlcGFyZShcbiAgICAgICAgYWp2LFxuICAgICAgICBwYXJhbWV0ZXJzLFxuICAgICAgICAncXVlcnknLFxuICAgICAgICB0cnVlXG4gICAgICApO1xuICAgICAgcHJlcGFyZVBhcmFtc1ZhbGlkYXRvciA9IHZhbGlkYXRvclByZXBhcmUoYWp2LCBwYXJhbWV0ZXJzLCAncGF0aCcsIHRydWUpO1xuICAgICAgcHJlcGFyZUhlYWRlcnNWYWxpZGF0b3IgPSB2YWxpZGF0b3JQcmVwYXJlKFxuICAgICAgICBhanYsXG4gICAgICAgIHBhcmFtZXRlcnMsXG4gICAgICAgICdoZWFkZXJzJyxcbiAgICAgICAgdHJ1ZVxuICAgICAgKTtcbiAgICAgIHByZXBhcmVDb29raWVzVmFsaWRhdG9yID0gdmFsaWRhdG9yUHJlcGFyZShcbiAgICAgICAgYWp2LFxuICAgICAgICBwYXJhbWV0ZXJzLFxuICAgICAgICAnY29va2llJyxcbiAgICAgICAgdHJ1ZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBjb21waWxlZEpzb24gPVxuICAgIGVuYWJsZVNtYXJ0RnVuY3Rpb25zICYmXG4gICAgcmVzcG9uc2VzICYmXG4gICAgT2JqZWN0LmVudHJpZXMocmVzcG9uc2VzKVxuICAgICAgLm1hcCgoW2NvZGUsIHsgY29udGVudCB9XSkgPT4gKHtcbiAgICAgICAgW2NvZGVdOiBzY2hlbWFQcmVwYXJlKGNvbnRlbnQsIGZhc3RKc29uU3RyaW5naWZ5KVxuICAgICAgfSkpXG4gICAgICAucmVkdWNlKGZsYXRPYmplY3RzLCB1bmRlZmluZWQpO1xuXG4gIGlmIChlbmFibGVTbWFydEZ1bmN0aW9ucyAmJiBjb21waWxlZEpzb24gJiYgIXRoaXMuX3NlcmlhbGl6ZWQpIHtcbiAgICB0aGlzLl9yb3V0ZS5fbWlkZGxld2FyZXMucHVzaChhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgIGNvbnN0IGJvZHlDb250ZW50VHlwZSA9IHJlcS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSB8fCAnYXBwbGljYXRpb24vanNvbic7XG4gICAgICBjb25zdCByZXNwb25zZUNvbnRlbnRUeXBlID0gcmVxLmhlYWRlcnMuYWNjZXB0IHx8IGJvZHlDb250ZW50VHlwZTtcblxuICAgICAgY29uc3Qgc2VyaWFsaXplVHlwZXMgPVxuICAgICAgICBjb21waWxlZEpzb25bcmVzLnJhd1N0YXR1c0NvZGVdIHx8IGNvbXBpbGVkSnNvblsyMDBdO1xuICAgICAgY29uc3Qgc2VyaWFsaXplciA9IHNlcmlhbGl6ZVR5cGVzW3Jlc3BvbnNlQ29udGVudFR5cGVdO1xuXG4gICAgICByZXMuc2VyaWFsaXplciA9IHNlcmlhbGl6ZXI7XG4gICAgfSk7XG4gICAgdGhpcy5fc2VyaWFsaXplZCA9IHRydWU7XG4gIH1cblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY29uc2lzdGVudC1yZXR1cm5cbiAgcmV0dXJuIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIGxldCBlcnJvcnM7XG5cbiAgICBpZiAocHJlcGFyZUJvZHlWYWxpZGF0b3IgJiYgcmVxLmJvZHkpIHtcbiAgICAgIGNvbnN0IGJvZHlWYWxpZGF0b3IgPSBwcmVwYXJlQm9keVZhbGlkYXRvcltyZXEuaGVhZGVyc1snY29udGVudC10eXBlJ11dO1xuXG4gICAgICBpZiAoYm9keVZhbGlkYXRvcikge1xuICAgICAgICBpZiAoIWJvZHlWYWxpZGF0b3IocmVxLmJvZHkpKSB7XG4gICAgICAgICAgZXJyb3JzID0geyBib2R5OiBib2R5VmFsaWRhdG9yLmVycm9ycyB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmVwYXJlUXVlcmllc1ZhbGlkYXRvciAmJiByZXEucXVlcnkpIHtcbiAgICAgIGlmICghcHJlcGFyZVF1ZXJpZXNWYWxpZGF0b3IocmVxLnF1ZXJ5KSkge1xuICAgICAgICBpZiAoIWVycm9ycykge1xuICAgICAgICAgIGVycm9ycyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVycm9ycy5xdWVyeSA9IHByZXBhcmVRdWVyaWVzVmFsaWRhdG9yLmVycm9ycztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHByZXBhcmVQYXJhbXNWYWxpZGF0b3IgJiYgcmVxLnBhcmFtcykge1xuICAgICAgaWYgKCFwcmVwYXJlUGFyYW1zVmFsaWRhdG9yKHJlcS5wYXJhbXMpKSB7XG4gICAgICAgIGlmICghZXJyb3JzKSB7XG4gICAgICAgICAgZXJyb3JzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZXJyb3JzLnBhcmFtcyA9IHByZXBhcmVQYXJhbXNWYWxpZGF0b3I7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmVwYXJlSGVhZGVyc1ZhbGlkYXRvciAmJiByZXEuaGVhZGVycykge1xuICAgICAgaWYgKCFwcmVwYXJlSGVhZGVyc1ZhbGlkYXRvcihyZXEuaGVhZGVycykpIHtcbiAgICAgICAgaWYgKCFlcnJvcnMpIHtcbiAgICAgICAgICBlcnJvcnMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVycm9ycy5oZWFkZXJzID0gcHJlcGFyZUhlYWRlcnNWYWxpZGF0b3IuZXJyb3JzO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlcGFyZUNvb2tpZXNWYWxpZGF0b3IgJiYgcmVxLmNvb2tpZXMpIHtcbiAgICAgIGlmICghcHJlcGFyZUNvb2tpZXNWYWxpZGF0b3IocmVxLmNvb2tpZXMpKSB7XG4gICAgICAgIGlmICghZXJyb3JzKSB7XG4gICAgICAgICAgZXJyb3JzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZXJyb3JzLmNvb2tpZXMgPSBwcmVwYXJlQ29va2llc1ZhbGlkYXRvci5lcnJvcnM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZhc3RKc29uU3RyaW5naWZ5ICYmIGNvbXBpbGVkSnNvbikge1xuICAgICAgcmVzLndyaXRlSGVhZGVyKCdDb250ZW50LVR5cGUnLCByZXEuaGVhZGVycy5hY2NlcHQpO1xuICAgICAgcmVzLndyaXRlU3RhdHVzKHJlcy5zdGF0dXNDb2RlKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzKSB7XG4gICAgICByZXR1cm4gcmVzLnNlbmQoe1xuICAgICAgICBzdGF0dXM6ICdlcnJvcicsXG4gICAgICAgIGVycm9yc1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xufVxuIiwiLyoqXG4gKiBTY2hlbWF0b3IgZXhwb3NlIFN3YWdnZXIgZG9jdW1lbnRhdGlvbiBzY2hlbWFcbiAqIEBwYXJhbSB7b2JqZWN0fSBzd2FnZ2VyT2JqZWN0IEludGVybmFsIFN3YWdnZXIgaW5zdGFuY2VcbiAqIEBtZW1iZXJvZiBTY2hlbWF0b3JcbiAqXG4gKiBAZXhhbXBsZVxuICogc2NoZW1hdG9ySW5zdGFuY2UuZXhwb3NlKClcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZXhwb3NlKHN3YWdnZXJPYmplY3QpIHtcbiAgcmV0dXJuIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHJlcy5zZXRIZWFkZXJzKHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICB9KTtcblxuICAgIHJldHVybiByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHN3YWdnZXJPYmplY3QsIG51bGwsIDIpKTtcbiAgfTtcbn1cbiIsIi8qIGVzbGludC1kaXNhYmxlIG1heC1sZW4sIGVzbGludC1jb21tZW50cy9kaXNhYmxlLWVuYWJsZS1wYWlyICovXG4vLyBwcmV0dGllci1pZ25vcmVcblxuLyoqXG4gKiBTY2hlbWF0b3IgZXhwb3NlIFN3YWdnZXIgZG9jdW1lbnRhdGlvbiBzY2hlbWFcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgU3dhZ2dlciBVSSBSZW5kZXIgY29uZmlndXJhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy50aXRsZSBTd2FnZ2VyIFVJIFJlbmRlciBwYWdlIHRpdGxlXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmV4cG9zZVBhdGggU2NoZW1hdG9yIFN3YWdnZXIgc2NoZW1hIGV4cG9zZSBwYXRoXG4gKiBAbWVtYmVyb2YgU2NoZW1hdG9yXG4gKlxuICogQGRlZmF1bHQgY29uZmlnLnRpdGxlIGBTY2hlbWF0b3JgXG4gKlxuICogQGV4YW1wbGVcbiAqIHNjaGVtYXRvckluc3RhbmNlLnJlbmRlcih7IHRpdGxlOiAnRG9jcycgfSlcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVuZGVyU3dhZ2dlcihjb25maWcpIHtcbiAgcmV0dXJuIGFzeW5jIChyZXEsIHJlcykgPT5cbiAgICByZXMuZW5kKGA8IURPQ1RZUEUgaHRtbD48aHRtbCBsYW5nPVwiZW5cIj48aGVhZD5cbiAgICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIj48dGl0bGU+JHsoY29uZmlnICYmIGNvbmZpZy50aXRsZSkgfHwgJ1NjaGVtYXRvcid9PC90aXRsZT48bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgaHJlZj1cIi4vc3dhZ2dlci11aS1kaXN0L3N3YWdnZXItdWkuY3NzXCIgPjxsaW5rIHJlbD1cImljb25cIiB0eXBlPVwiaW1hZ2UvcG5nXCIgaHJlZj1cIi4vc3dhZ2dlci11aS1kaXN0L2Zhdmljb24tMzJ4MzIucG5nXCIgc2l6ZXM9XCIzMngzMlwiIC8+PGxpbmsgcmVsPVwiaWNvblwiIHR5cGU9XCJpbWFnZS9wbmdcIiBocmVmPVwiLi9zd2FnZ2VyLXVpLWRpc3QvZmF2aWNvbi0xNngxNi5wbmdcIiBzaXplcz1cIjE2eDE2XCIgLz48c3R5bGU+aHRtbHtib3gtc2l6aW5nOmJvcmRlci1ib3g7b3ZlcmZsb3c6LW1vei1zY3JvbGxiYXJzLXZlcnRpY2FsO292ZXJmbG93LXk6c2Nyb2xsfSosOmFmdGVyLDpiZWZvcmV7Ym94LXNpemluZzppbmhlcml0fWJvZHl7bWFyZ2luOjA7YmFja2dyb3VuZDojZmFmYWZhfTwvc3R5bGU+PC9oZWFkPjxib2R5PjxkaXYgaWQ9XCJzd2FnZ2VyLXVpXCI+PC9kaXY+PHNjcmlwdCBzcmM9XCIuL3N3YWdnZXItdWktZGlzdC9zd2FnZ2VyLXVpLWJ1bmRsZS5qc1wiPiA8L3NjcmlwdD48c2NyaXB0IHNyYz1cIi4vc3dhZ2dlci11aS1kaXN0L3N3YWdnZXItdWktc3RhbmRhbG9uZS1wcmVzZXQuanNcIj48L3NjcmlwdD48c2NyaXB0PndpbmRvdy5vbmxvYWQ9ZnVuY3Rpb24oKXtjb25zdCBvPVN3YWdnZXJVSUJ1bmRsZSh7dXJsOndpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCtcIi8vXCIrd2luZG93LmxvY2F0aW9uLmhvc3QrXCIke2NvbmZpZy5leHBvc2VQYXRofVwiLGRvbV9pZDpcIiNzd2FnZ2VyLXVpXCIsZGVlcExpbmtpbmc6ITAscHJlc2V0czpbU3dhZ2dlclVJQnVuZGxlLnByZXNldHMuYXBpcyxTd2FnZ2VyVUlTdGFuZGFsb25lUHJlc2V0XSxwbHVnaW5zOltTd2FnZ2VyVUlCdW5kbGUucGx1Z2lucy5Eb3dubG9hZFVybF0sbGF5b3V0OlwiU3RhbmRhbG9uZUxheW91dFwifSk7d2luZG93LnVpPW99Ozwvc2NyaXB0PjwvYm9keT48L2h0bWw+YCk7XG59XG4iLCJpbXBvcnQgZ2V0ZGlybmFtZSBmcm9tICdnZXRkaXJuYW1lJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHN3YWdnZXJVaURpc3QgZnJvbSAnc3dhZ2dlci11aS1kaXN0JztcbmltcG9ydCB7IGV4cG9zZSwgbG9hZCwgcmVuZGVyIH0gZnJvbSAnLi9tZXRob2RzL2luZGV4LmpzJztcbmltcG9ydCBpbXBvcnRpemUgZnJvbSAnLi91dGlscy9pbXBvcnRpemUuanMnO1xuXG5jb25zdCBzdGF0aWNTZXJ2ZSA9IGltcG9ydChcbiAgYEBuYW5vZXhwcmVzcy9taWRkbGV3YXJlLXN0YXRpYy1zZXJ2ZSR7XG4gICAgcHJvY2Vzcy5lbnYuTkFOT19FTlZfTU9EVUxFID09PSAnY29tbW9uanMnID8gJy9janMnIDogJydcbiAgfWBcbik7XG5cbi8qKlxuICogSW5pdGlhbGl6ZWQgU2NoZW1hdG9yIGluc3RhbmNlXG4gKiBAZnVuY3Rpb25cbiAqIEBuYW1lc3BhY2UgU2NoZW1hdG9yXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFNjaGVtYXRvciBjb25maWd1cmF0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlnLnN3YWdnZXJQYXRoIFN3YWdnZXIgc2NoZW1hIGZpbGUgcGF0aFxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5zd2FnZ2VyUkFXIFN3YWdnZXIgc2NoZW1hIFJBVyBPYmplY3RcbiAqIEByZXR1cm5zIHtvYmplY3R9IFJldHVybiBvYmplY3RcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn0gY29uZmlnLmRlZmluZSBTY2hlbWF0b3IgZGVmaW5lIGZ1bmN0aW9uIHRvIGFwcGx5XG4gKiBAcmV0dXJucyB7bG9hZH0gY29uZmlnLmxvYWQgTG9hZGluZyBmdW5jdGlvblxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBzY2hlbWF0b3JJbnN0YW5jZSA9IHNjaGVtYXRvcih7IHN3YWdnZXJQYXRoOiAnLi9zd2FnZ2VyLnltbCcgfSk7XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNjaGVtYXRvcihjb25maWcpIHtcbiAgY29uc3QgaW5zdGFuY2VEaXJlY3RvcnkgPSBnZXRkaXJuYW1lKCk7XG4gIGNvbnN0IHN3YWdnZXJPYmplY3QgPSBpbXBvcnRpemUoXG4gICAge1xuICAgICAgcGF0aDogY29uZmlnLnN3YWdnZXJQYXRoLFxuICAgICAgcmF3OiBjb25maWcuc3dhZ2dlclJBV1xuICAgIH0sXG4gICAgaW5zdGFuY2VEaXJlY3RvcnlcbiAgKTtcbiAgY29uc3QgZXhwb3NlUGF0aCA9IGNvbmZpZy5zd2FnZ2VyUGF0aFxuICAgID8gcGF0aC5iYXNlbmFtZShjb25maWcuc3dhZ2dlclBhdGgpXG4gICAgOiAnc3dhZ2dlci5qc29uJztcblxuICAvLyBXZSBkZWZpbmUgaXQgYmVmb3JlIGZ1bmN0aW9uIGxldCBleHBvcnQgdGhpc1xuICBjb25zdCBmdW5jdGlvbkV4cG9ydHMgPSB7fTtcblxuICBmdW5jdGlvbkV4cG9ydHMuZGVmaW5lID0gKGFwcCkgPT4ge1xuICAgIHN0YXRpY1NlcnZlXG4gICAgICAudGhlbigobW9kdWxlKSA9PiBtb2R1bGUuZGVmYXVsdChzd2FnZ2VyVWlEaXN0LmFic29sdXRlUGF0aCgpKSlcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IGFwcC5nZXQoJy9zd2FnZ2VyLXVpLWRpc3QvOmZpbGUnLCByZXN1bHQpKVxuICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgYXBwLmdldChgLyR7ZXhwb3NlUGF0aH1gLCBleHBvc2Uoc3dhZ2dlck9iamVjdCkpO1xuICAgIGFwcC5nZXQoJy9zd2FnZ2VyJywgcmVuZGVyKHsgZXhwb3NlUGF0aDogYC8ke2V4cG9zZVBhdGh9YCB9KSk7XG5cbiAgICBmdW5jdGlvbkV4cG9ydHMubG9hZCA9IGxvYWQuYmluZChhcHAsIHN3YWdnZXJPYmplY3QpO1xuXG4gICAgcmV0dXJuIGFwcDtcbiAgfTtcbiAgZnVuY3Rpb25FeHBvcnRzLmxvYWQgPSAoKSA9PiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1BsZWFzZSwgZGVmaW5lIGJ5IGBkZWZpbmVgIG1ldGhvZCBmaXJzdCB0byBtYWtlIGl0IHdvcmsgY29ycmVjdGx5J1xuICAgICk7XG4gIH07XG5cbiAgcmV0dXJuIGZ1bmN0aW9uRXhwb3J0cztcbn1cbiJdLCJuYW1lcyI6WyJwYXRoIiwiZnMiLCJqc1lhbWwiLCJvbWl0IiwiZ2V0ZGlybmFtZSIsIkFqdiIsImFkZEZvcm1hdHMiLCJmYXN0SnNvblN0cmluZ2lmeSIsInN3YWdnZXJVaURpc3QiLCJyZW5kZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlBO0FBQ0EsTUFBTSxTQUFTLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEVBQUUsU0FBUyxLQUFLO0FBQ3ZELEVBQUUsSUFBSUEsd0JBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUNwQixJQUFJLE1BQU0sV0FBVyxHQUFHQSx3QkFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDcEQ7QUFDQSxJQUFJLE1BQU0sVUFBVSxHQUFHQyxzQkFBRSxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDN0Q7QUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQzNELE1BQU0sT0FBT0MsMEJBQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDckMsS0FBSztBQUNMLElBQUksSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2pDLE1BQU0sT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLEtBQUs7QUFDTCxJQUFJLE1BQU0s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
