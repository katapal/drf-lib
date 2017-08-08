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

