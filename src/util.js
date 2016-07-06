/**
 * Created by David on 9/28/2015.
 */
angular.module("drf-lib.util", [])
  .service("restServiceHelper",
  ["drfUtil",
    function(drfUtil) {
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
      self.createListFunction = function(resource, postProcess) {
        return function(filterArgs) {
          filterArgs = drfUtil.underscoredProperties(filterArgs) || {};

          var p = resource.get(filterArgs).$promise;

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
    }
  ])
  .service("drfUtil", ['$window', '$q', function($window, $q) {
    var self = this;
    var s = $window.s;

    function createStringRewriter(f) {
      function rewriter(str) {
        if (angular.isArray(str)) {
          var arr = str;
          var arrCopy = [];
          for (var i = 0; i < arr.length; i++)
            arrCopy.push(rewriter(arr[i]));
          return arrCopy;
        } else if (angular.isObject(str)) {
          var obj = str, objCopy = {};
          for (var property in obj) {
            if (obj.hasOwnProperty(property) && property.indexOf('$') !== 0) {
              if (angular.isObject(obj[property]))
                objCopy[f(property)] = rewriter(obj[property]);
              else
                objCopy[f(property)] = obj[property];
            }
          }

          return objCopy;
        } else {
          return str;
        }
      }

      return rewriter;
    }

    self.camelizeProperties = createStringRewriter(s.camelize);
    self.underscoredProperties = createStringRewriter(s.underscored);

    self.wrapMethod = function(f, beforeCall, afterCall) {
      return function () {
        beforeCall();
        var ret = f.apply(this, arguments);
        if (ret && ret.then)
          return ret.then(
            function(r) {
              afterCall();
              return r;
            },
            function (e) {
              afterCall();
              return $q.reject(e);
            }
          );
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