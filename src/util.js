/**
 * Created by David on 9/28/2015.
 */
angular.module("drf-lib.util", [])
  .filter("humanize", function() {
    return function(input) {
      return s.humanize(input);
    };
  })
  .factory("phoneUtils", function() {

    phoneUtils.parsePhoneNumber = function(number, format, country) {
      try {
        if (phoneUtils.isPossibleNumber(number, country)) {
          if (!format || format == "e164")
            return phoneUtils.formatE164(number, country);
          else if (format == "national")
            return phoneUtils.formatNational(number, country);
        }
      } catch(e) {
        return null;
      }
    };

    phoneUtils.checkValidNumber = function(n, country) {
      try {
        return phoneUtils.isPossibleNumber(n, country);
      } catch(e) {
        return false;
      }
    };

    return phoneUtils;
  })
  .service("restServiceHelper",
  ["drfUtil", "$resource",
    function(drfUtil, $resource) {
      var self = this;

      /**
       * Creates a new list function that sends a request possibly with filters
       * and takes a response that is paginated.  The response is assumed to be
       * an object with a results attribute and possibly a count attribute.
       *
       * @param resource
       * @param postProcess
       * @returns {Function}
       */
      self.createListFunction = function(resource, postProcess, action) {
        return function(filterArgs) {
          filterArgs = drfUtil.underscoredProperties(filterArgs) || {};

          action = action || "get";
          var p = resource[action](filterArgs).$promise;

          if (!postProcess)
            postProcess = function(x) { return x; };

          return p.then(function(result) {
            if (result.hasOwnProperty("results")) {
              var ret = result.results;
              if (angular.isNumber(result.count))
                ret.count = result.count;
              return ret;
            } else
              return result;
          }).then(postProcess);
        };
      };

      self.resourceWithExtraHeaders =
        function(extraHeaders, url, params, actions, options) {
          var k;
          var allActions = {
            get: {method: "GET", headers: extraHeaders},
            query: {
              method: "GET",
              isArray: true,
              headers: extraHeaders
            },
            save: {method: "POST", headers: extraHeaders},
            remove: {method: "DELETE", headers: extraHeaders},
            delete: {method: "DELETE", headers: extraHeaders},
            update: {method: "PATCH", headers: extraHeaders}
          };

          for (k in actions) {
            if (actions.hasOwnProperty(k)) {
              actions[k].headers = extraHeaders;
              allActions[k] = actions[k];
            }
          }

          return $resource(url, params, allActions, options);
        }
    }
  ])
  .service("drfUtil", ['$window', '$q', function($window, $q) {
    var self = this;
    var s = $window.s;

    function createStringRewriter(f) {
      function rewriter(arg) {
        var ret;

        if (angular.isDate(arg))
          return arg;

        if (angular.isArray(arg)) {
          var arr = arg;
          var arrCopy = [];
          for (var i = 0; i < arr.length; i++)
            arrCopy.push(rewriter(arr[i]));
          ret = arrCopy;
        }

        if (angular.isObject(arg) || angular.isArray(arg)) {
          var obj = arg, objCopy = ret || {};
          for (var property in obj) {
            if (obj.hasOwnProperty(property) && property.indexOf('$') !== 0 &&
                !angular.isNumber(property)) {
              if (angular.isObject(obj[property]))
                objCopy[f(property)] = rewriter(obj[property]);
              else
                objCopy[f(property)] = obj[property];
            }
          }

          ret = objCopy;
        }

        return ret;
      }

      return rewriter;
    }

    self.camelizeProperties = createStringRewriter(s.camelize);
    self.underscoredProperties = createStringRewriter(s.underscored);

    self.wrapMethod = function(f, beforeCall, afterCall) {
      return function () {
        beforeCall();
        var ret = f.apply(this, arguments);
        if (ret && ret.finally)
          return ret.finally(function() {
            afterCall();
          });
        else {
          afterCall();
          return ret;
        }
      };
    };

    self.wrapMethods =  function (obj, beforeCall, afterCall) {
      var copy = angular.copy(obj);
      copy.wrapped = {};
      for (var k in obj) {

        if (angular.isFunction(obj[k])) {
          var methodClosure = function(f) {
            return function() {
              return f.apply(obj, arguments);
            };
          };
          copy.wrapped[k] = self.wrapMethod(
            methodClosure(obj[k]),
            beforeCall,
            afterCall
          );
        }
      }
      return copy;
    };

    self.uuid4 = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

  }]);
