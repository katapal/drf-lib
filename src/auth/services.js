/**
 * Created by David on 7/16/2015.
 */

var authModule = angular.module(
  'drf-lib.auth.services',
  ['drf-lib.auth.rest', 'drf-lib.user.rest', 'drf-lib.error']
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
           loginCallbacks, logoutCallbacks) {
    var self = this;

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
    self.setIdentity(token, u);
    return token;
  });
};

authService.prototype.externalLogin = function(provider, request) {
  var self = this;
  return self.authRest.externalLogin(provider, request).then(function(token) {
    self.setIdentity(token, null);
    return self.userRest.getProfile().then(function(result) {
      self.$localStorage.auth.username = result.username;
      return result;
    }).catch(function(err) {
      var msg = self.errorParser.extractMessage(err);
      self.$log.error("Could not get user profile: " + msg);
      return {};
    });
  });
};

authService.prototype.setIdentity = function(token, username) {
  var self = this;
  self.$localStorage.auth = { token: token, username: username };

  // run callbacks
  for (var i = 0; i < self.loginCallbacks.length; i++) {
    var callback = self.loginCallbacks[i];
    try {
      self.$injector.invoke(
        callback, null, {token: token, username: username, 'authService': self}
      );
    } catch (e) {
      self.$log.error("error running login callback: " + e);
    }
  }
};

authService.prototype.logout = function(errorResponse) {
  var self = this;
  if (self.$localStorage.auth)
    delete self.$localStorage.auth.token;
  if (self.$localStorage.username)
    delete self.$localStorage.auth.username;

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

authService.prototype.getUsername = function() {
  var self = this;
  if (self.$localStorage.auth)
    return self.$localStorage.auth.username;
};

authService.prototype.authHeader = function() {
  var self = this;
  return "Token " + self.getToken();
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
    function (authRest, $localStorage, $injector, $log, userRest, errorParser) {
      return new authService(
        authRest, $localStorage, $injector, $log, userRest, errorParser,
        loginCallbacks, logoutCallbacks
      );
    }
  ];
});

