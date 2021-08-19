var errorModule = angular.module('drf-lib.error', ['angular.filter']);

var errorParser = function(lowercaseFilter, ucfirstFilter, $window) {
  this.ucfirstFilter = ucfirstFilter;
  this.lowercaseFilter = lowercaseFilter;
  this.$window = $window;
};

errorParser.$inject = ['lowercaseFilter', 'ucfirstFilter', '$window'];

errorParser.prototype.extractMessage = function(response) {
  var self = this, i, extracted, msg, field;
  if (response.data && response.data.non_field_errors)
    return response.data.non_field_errors.join(' ');
  else if (response.data && response.data.detail)
    return response.data.detail;
  else if (response.data && angular.isArray(response.data)) {
    extracted = [];
    for(i = 0; i < response.data.length; i++) {
      extracted.push(self.extractMessage(response.data[i]));
    }
    return extracted.join(', ');
  } else if (response.status == 400) {
    if (angular.isString(response.data))
      return response.data;
    else {
      msg = "";
      for (field in response.data) {
        msg += self.ucfirstFilter(self.lowercaseFilter(field)) +
          ": " + response.data[field] + " ";
      }
      return msg;
    }
  } else if (response.statusText)
    return self.ucfirstFilter(self.lowercaseFilter(response.statusText));
  else if (response.status == -1) {
    if (self.$window.navigator.onLine)
      return "Server unavailable";
    else
      return "Network unavailable";
  } else if (response.message)
    return response.message;
  else if (angular.isString(response))
    return response;
  else if (angular.isObject(response)) {
    msg = "";
    for (field in response) {
      msg += self.ucfirstFilter(self.lowercaseFilter(field)) +
        ": " + response[field] + " ";
    }
    return msg;
  } else
    return "Service unavailable";
};

errorModule.service('errorParser', errorParser);
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

angular.module('drf-lib.auth.rest', ['ngResource', 'rest-api.url'])
  .service('authRest',
    ['$http', 'urlOf', "$q", "drfUtil",
      function($http, urlOf, $q, drfUtil) {
        var self = this;
        function extractToken(response) {
          if (response.status == 200)
            return response.data.key;
          else
            throw response;
        }
    
        self.login = function(u, p) {
          return $http.post(urlOf['login'], {'username': u, 'password': p})
            .then(extractToken);
        };

        self.jwt = function(token) {
          return $http({
            method: 'GET',
            url: urlOf['jwt'],
            headers: { 'Authorization': 'Token ' + token }
          }).then(function(response) {
            if (response.status == 200)
              return response.data.token;
            else
              return response;
          });
        };
    
        self.externalLogin = function(provider, request) {
          request = drfUtil.underscoredProperties(request);
          if (urlOf[provider + "-login"]) {
            return $http.post(urlOf[provider + "-login"], request)
              .then(extractToken);
          } else
            return $q.reject({"provider": provider});
        };
    
        self.logoutEverywhere = function() {
          return $http.post(urlOf['logout']);
        };

      }
    ]
  );
/**
 * Created by David on 7/16/2015.
 */

var authModule = angular.module(
  'drf-lib.auth.services',
  ['drf-lib.auth.rest', 'drf-lib.user.rest', 'drf-lib.error', 'angular-jwt']
)
  .service(
  'authInterceptor',
  ['$injector', 'urlService', "$q",
    function($injector, urlService, $q) {
      return {
        'responseError': function(response) {
          var authService = $injector.get('authService');
          var config = response.config;
          var result;
          if ((response.status == 401) &&
               urlService.domainRequiresAuthorization(config.url))
            return authService.tryReconnect(response);
          else
            return $q.reject(response);
        },
        'request': function(config) {
          var authService = $injector.get('authService');
          if (urlService.domainRequiresAuthorization(config.url)) {
            if (config.headers && config.headers.Authorization)
              return config;
            else
              return authService.setAuthHeader(config);
          } else
            return config;
        }
      };
    }
  ])
  .config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  }]);


var authService =
  function(authRest, $localStorage, $injector, $log, userRest, errorParser,
           jwtHelper, $timeout, $q, loginCallbacks, logoutCallbacks) {
    var self = this;
    self.$timeout = $timeout;
    self.jwtHelper = jwtHelper;
    self.authRest = authRest;
    self.$localStorage = $localStorage;
    self.$injector = $injector;
    self.$log = $log;
    self.loginCallbacks = loginCallbacks;
    self.logoutCallbacks = logoutCallbacks;
    self.userRest = userRest;
    self.errorParser = errorParser;
    self.$q = $q;
  };

authService.prototype.initialLogin = function(skipCallbacks) {
  var self = this;
  if (self.$localStorage.auth && self.$localStorage.auth.token)
    return self.setIdentity(
      self.$localStorage.auth.token,
      self.$localStorage.auth.username,
      skipCallbacks
    );
  else
    return self.$q.when(null);
};

authService.prototype.tryReconnect = function(response) {
  var self = this;
  
  // wrap the entire call to prevent infinite recursion
  if (!self.reconnecting && self.$localStorage.auth && 
       self.$localStorage.auth.token)
  {
    if (self.refreshPromise) {
      self.$timeout.cancel(self.refreshPromise);
      delete self.refreshPromise;
    }

    self.reconnecting = true;
    return self.setIdentity(
      self.$localStorage.auth.token,
      self.$localStorage.auth.username,
      true
    ).catch(function (err) {
      // if we couldn't reconnect, throw the original error
      return self.$q.reject(response);
    }).then(function (result) {
      var $http = self.$injector.get('$http');
      return $http(response.config);
    }).finally(function() {
      self.reconnecting = false;
    });
  } else
    return self.$q.reject(response);

};

authService.prototype.login = function (u, p) {
  var self = this;
  return self.authRest.login(u, p).then(function(token) {
    return self.setIdentity(token, u);
  }).then(function() {
    return self.userRest.getProfile()
      .catch(function(err) {
        var msg = self.errorParser.extractMessage(err);
        self.$log.error("Could not load user profile: " + msg);
        throw err;
      });
  });
};

authService.prototype.externalLogin = function(provider, request) {
  var self = this;
  return self.authRest.externalLogin(provider, request).then(function(token) {
    return self.setIdentity(token, null);
  }).then(function() {
    return self.userRest.getProfile().then(function(result) {
      self.$localStorage.auth.username = result.username;
      return result;
    }).catch(function(err) {
      var msg = self.errorParser.extractMessage(err);
      self.$log.error("Could not load user profile: " + msg);
      throw err;
    });
  });
};

authService.prototype.setUserRefresh =
  function(jwt, leeway, minDelay) {
    var self = this;

    if (self.refreshPromise)
      return;

    try {
      var exp = self.jwtHelper.getTokenExpirationDate(jwt);
      // set time to execute the refresh, with LEEWAY seconds to spare
      leeway = leeway || 5000;
      // set a minimum delay so in case expiration is malformed or too short
      // we don't end up overwhelming the server with JWT requests
      minDelay = minDelay || 10000;
      var delay =
        Math.max(exp.getTime() - Date.now() - leeway, minDelay);

      self.refreshPromise = self.$timeout(function () {
          delete self.refreshPromise;
          self.setJWT(leeway, minDelay);
        },
        delay
      );
    } catch(e) {
      self.$log.error("Could not set user refresh timer due to " + e)
    }
  };

authService.prototype.setIdentity = function(token, username, skipCallbacks,
                                             leeway, minDelay) {
  var self = this;
  self.$localStorage.auth = { token: token, username: username };

  return self.setJWT(leeway, minDelay).then(function(jwt) {
    if (!skipCallbacks) {
      // run callbacks
      for (var i = 0; i < self.loginCallbacks.length; i++) {
        var callback = self.loginCallbacks[i];
        try {
          self.$injector.invoke(
            callback, null, {
              token: token,
              username: username,
              'authService': self
            }
          );
        } catch (e) {
          self.$log.error("error running login callback: " + e);
        }
      }
    }

    return jwt;
  });
};


authService.prototype.setJWT = function(leeway, minDelay) {
  var self = this;
  if (!self.getToken())
    return self.$q.reject(new Error("No token set"));

  if (!self.savedJWTPromise) {
    self.savedJWTDeferred = self.$q.defer();
    self.savedJWTPromise = self.savedJWTDeferred.promise;
  }

  self.authRest.jwt(self.getToken()).then(function (jwt) {
    self.refreshErrorDelay = 0;
    self.savedJWT = jwt;
    self.setUserRefresh(jwt, leeway, minDelay);

    try {
      self.savedJWTDeferred.resolve(jwt);
      delete self.savedJWTPromise;
      delete self.savedJWTDeferred;
    } catch (e) {
    }
  }).catch(function (e) {
    try {
      self.savedJWTDeferred.reject(e);
      delete self.savedJWTPromise;
      delete self.savedJWTDeferred;
    } catch (ex) {
    }

    // try again after leeway (or 15000 if leeway not set) if error is
    // recoverable

    if (!self.refreshPromise && (e.status < 0 || e.status >= 500)) {
      // set initial delay
      self.refreshErrorDelay = self.refreshErrorDelay ||
        (Math.random() + 1) * 1000;

      // For network connectivity issues (status < 0), keep same delay
      // without backoff

      // For server-side errors, use exponential backoff
      if (e.status >= 500) {
        self.refreshErrorDelay *= 2;
        // set max refresh delay to 15 minutes
        self.refreshErrorDelay = Math.min(self.refreshErrorDelay, 15 * 60 * 1000);
      }

      self.refreshPromise = self.$timeout(function () {
          delete self.refreshPromise;
          self.setJWT(leeway, minDelay);
        },
        self.refreshErrorDelay
      );
    }
  });

  return self.savedJWTPromise;
};

authService.prototype.logout = function(skipCallbacks, response) {
  var self = this;
  if (self.$localStorage.auth)
    delete self.$localStorage.auth;
  if (self.refreshPromise) {
    self.$timeout.cancel(self.refreshPromise);
    delete self.refreshPromise;
  }
  if (self.savedJWT)
    delete self.savedJWT;
  if (self.savedJWTDeferred) {
    self.savedJWTDeferred.reject(new Error("Logged out"));
    delete self.savedJWTDeferred;
  }
  if (self.savedJWTPromise)
    delete self.savedJWTPromise;

  if (!skipCallbacks) {
    // run callbacks
    for (var i = 0; i < self.logoutCallbacks.length; i++) {
      var callback = self.logoutCallbacks[i];
      try {
        self.$injector.invoke(
          callback,
          self,
          {
            'authService': self,
            'response': response
          }
        );
      } catch (e) {
        self.$log.error("error running logout callback: " + e);
      }
    }
  }
};

authService.prototype.logoutEverywhere = function() {
  var self = this;
  return self.authRest.logoutEverywhere().then(function(r) {
    self.logout();
    return r;
  });
};

authService.prototype.getToken = function() {
  var self = this;
  if (self.$localStorage.auth)
    return self.$localStorage.auth.token;
};

authService.prototype.setUsername = function(username) {
  var self = this;
  if (self.$localStorage.auth)
    self.$localStorage.auth.username = username;
  else 
    throw "Not logged in";
};
authService.prototype.getUsername = function() {
  var self = this;
  if (self.$localStorage.auth)
    return self.$localStorage.auth.username;
};

authService.prototype.setAuthHeader = function(config) {
  var self = this;
  if (self.isAuthenticated()) {
    config.headers = config.headers || {};
    config.headers.Authorization = "JWT " + self.savedJWT;
    return config;
  } else if (self.getToken()) {
    var pr;

    // if we're waiting for the JWT to resolve
    if (!self.savedJWT && self.savedJWTPromise) {
      return self.savedJWTPromise.then(function(jwt) {
        if (jwt && !self.jwtHelper.isTokenExpired(jwt)) {
          config.headers = config.headers || {};
          config.headers.Authorization = "JWT " + jwt;
        }
        return config;
      });
    } else {
      if (self.refreshPromise) {
        self.$timeout.cancel(self.refreshPromise);
        delete self.refreshPromise;
      }

      // if the resolved JWT is expired
      return self.setIdentity(
        self.$localStorage.auth.token,
        self.$localStorage.auth.username,
        true
      ).then(function(jwt) {
        if (jwt && !self.jwtHelper.isTokenExpired(jwt)) {
          config.headers = config.headers || {};
          config.headers.Authorization = "JWT " + jwt;
        }
        return config;
      }).catch(function() {
        return config;
      });
    }
  } else
    return config;
};

authService.prototype.isAuthenticated = function() {
  var self = this;
  return self.savedJWT && !self.jwtHelper.isTokenExpired(self.savedJWT);
};

authModule.provider('authService', function () {
  var self = this;
  var loginCallbacks = [];
  var logoutCallbacks = [];

  self.addLoginCallback = function(callback) {
    loginCallbacks.push(callback);
  };

  self.addLogoutCallback = function(callback) {
    logoutCallbacks.push(callback);
  };

  self.$get = [
    'authRest', '$localStorage', '$injector', '$log', 'userRest', 'errorParser',
    'jwtHelper', '$timeout', '$q',
    function (authRest, $localStorage, $injector, $log, userRest, errorParser,
              jwtHelper, $timeout, $q) {
      return new authService(
        authRest, $localStorage, $injector, $log, userRest, errorParser,
        jwtHelper, $timeout, $q, loginCallbacks, logoutCallbacks
      );
    }
  ];
});


angular.module("drf-lib.user.rest", ["ngResource", "rest-api.url"])
  .service("userRest", ["$resource", "urlOf", "$http", "drfUtil",
    function($resource, urlOf, $http, drfUtil) {
      var self = this;
      var postProcess = function(result) {
        return drfUtil.camelizeProperties(result);
      };
      var extractData = function(result) {
        return result.data;
      };

      self.getProfile = function() {
        var User = $resource(urlOf["rest-auth-user-self"]);
        return User.get().$promise.then(postProcess);
      };

      self.setProfile = function(profile) {
        profile = drfUtil.underscoredProperties(profile);
        var User = $resource(urlOf["rest-auth-user-self"], undefined,
          {update: {method:"PUT"}});
        var u = new User(profile);
        return u.$update().then(postProcess);
      };

      self.setPassword = function(password, password2) {
        return $http.post(urlOf['rest-auth-set-password'], {
          new_password1: password,
          new_password2: password2
        }).then(extractData).then(postProcess);
      };

      self.registerUser = function(username, pass1, pass2, email) {
        var reg = {
          "username": username, "password1": pass2, "password2": pass2,
          "email": email
        };
        return $http.post(urlOf['rest-auth-register'], reg).then(extractData)
          .then(postProcess);
      };

      self.resetPassword = function(email) {
        return $http.post(urlOf['rest-auth-reset-password'], {email: email})
          .then(extractData).then(postProcess);
      };

      self.confirmResetPassword = function(uid, token, pass1, pass2) {
        var confirmation = {
          "uid": uid,
          "token": token,
          "new_password1": pass1,
          "new_password2": pass2
        };
        return $http.post(urlOf['rest-auth-confirm-reset'], confirmation)
          .then(extractData).then(postProcess);
      };
      
      self.linkExternalLogin = function(provider, args) {
        args = drfUtil.underscoredProperties(args);
        if (urlOf[provider + "-login"]) {
          return $http.post(
            urlOf[provider + "-login"] + "?process=connect", 
            args
          ).then(function(result) { return result.data; }).then(postProcess);
        } else
          return $q.reject({"provider": provider});
      };
      
      self.disconnectExternalLogin = function(user, externalLoginId) {
        var UserExternalLogin = $resource(
          urlOf['rest-auth-user-external-login']
        );
        return UserExternalLogin.remove({
          'username': user.username,
          'externalLoginId': externalLoginId
        }).$promise.then(postProcess);
      };
    }]);