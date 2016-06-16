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
          if ((response.status == 401) && authService.isAuthenticated()) {
            authService.logout(response);
          }
          return $q.reject(response);
        },
        'request': function(config) {
          var authService = $injector.get('authService');
          if (urlService.domainRequiresAuthorization(config.url) &&
              authService.isAuthenticated()) {
            config.headers = config.headers || {};
            if (!config.headers.Authorization)
              config.headers.Authorization = authService.authHeader();
          }
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
           jwtHelper, $timeout, loginCallbacks, logoutCallbacks) {
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

    if ($localStorage.auth && $localStorage.auth.token)
      self.setIdentity($localStorage.auth.token, $localStorage.auth.username);
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

      self.refreshPromise = self.$timeout(
        function () {
          // refresh the account token, but don't set up a new socket
          self.setJWT(leeway, minDelay);
        },
        delay
      )
    } catch(e) {
      self.$log.error("Could not set user refresh timer due to " + e)
    }
  };

authService.prototype.setIdentity = function(token, username, skipCallbacks,
                                             leeway, minDelay) {
  var self = this;
  self.$localStorage.auth = { token: token, username: username };

  return self.setJWT(skipCallbacks, leeway, minDelay).then(function() {
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
  });
};


authService.prototype.setJWT = function(leeway, minDelay) {
  var self = this;
  if (!self.getToken())
    return $q.reject(new Error("No token set"));

  return self.authRest.jwt(self.getToken()).then(function(jwt) {
    self.savedJWT = jwt;
    self.setUserRefresh(jwt, leeway, minDelay);
  });
};

authService.prototype.logout = function(errorResponse) {
  var self = this;
  if (self.$localStorage.auth)
    delete self.$localStorage.auth;
  if (self.refreshPromise) {
    self.$timeout.cancel(self.refreshPromise);
    delete self.refreshPromise;
  }
  
  // run callbacks
  for (var i = 0; i < self.logoutCallbacks.length; i++) {
    var callback = self.logoutCallbacks[i];
    try {
      self.$injector.invoke(
        callback,
        self,
        {
          'authService': self,
          'response': errorResponse
        }
      );
    } catch (e) {
      self.$log.error("error running logout callback: " + e);
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

authService.prototype.authHeader = function() {
  var self = this;
  if (self.savedJWT)
    return "JWT " + self.savedJWT;
  else
    throw new Error("No JWT available")
};

authService.prototype.isAuthenticated = function() {
  var self = this;
  return self.$localStorage.auth && !!self.$localStorage.auth.token;
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
    'jwtHelper', '$timeout',
    function (authRest, $localStorage, $injector, $log, userRest, errorParser,
              jwtHelper, $timeout) {
      return new authService(
        authRest, $localStorage, $injector, $log, userRest, errorParser,
        jwtHelper, $timeout, loginCallbacks, logoutCallbacks
      );
    }
  ];
});

