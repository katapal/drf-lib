describe("drf-lib.auth.services", function () {
  var $httpBackend, authService, urlOf, $rootScope;
  var $q;
  var authRest;
  var URL_ROOT = "https://testserver/";

  beforeEach(function() {
    angular.module("rest-api.url", [])
      .config(function($resourceProvider) {
        $resourceProvider.defaults.stripTrailingSlashes = false;
      })
      .factory('urlOf', function() {
        return {
          "login": "https://testserver/login/",
          "rest-auth-user-self": "https://testserver/self/"
        };
      })
      .service('urlService', function() {
        var self = this;
        self.domainRequiresAuthorization = function(url) {
          return url.startsWith("https://testserver");
        }
      });

    module('drf-lib.user.rest');
    module('drf-lib.util');
    module('drf-lib.error');
    module("angular.filter");
    module('drf-lib.auth.services');
    module("rest-api.url");
  });


  var authRestDef = function($q) {
    var self = this;
    self.login = function () {
      return $q.when("OK");
    };
    self.logoutEverywhere = function() {
      return $q.when("logged out");
    };
    self.jwt = function() {
      return $q.when("OK");
    };
    self.setUserRefresh = function() {
      
    };
    return self;
  };
  authRestDef.$inject = ['$q'];

  beforeEach(function() {
    module(function($provide) {
      $provide.service('authRest', authRestDef);
      $provide.service('$localStorage', function() {});
    });
  });

  describe("basic functionality", function () {

    beforeEach(inject(function(_authService_, _authRest_, _$rootScope_, _$q_,
                               _$httpBackend_, _urlOf_){
      authRest = _authRest_;
      authService = _authService_;
      $rootScope = _$rootScope_;
      $q = _$q_;
      $httpBackend = _$httpBackend_;
      urlOf = _urlOf_;
    }));

    it("should call rest service and authenticate", function (done) {
      $httpBackend.expectGET(urlOf['rest-auth-user-self'])
        .respond({"id": "OK"});
      var spy = sinon.spy(authRest, 'login');
      var promise = authService.login("user", "passw0rd");
      promise
        .then(function(result) {
          expect(result.id).toEqual("OK");
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(authService.getToken()).toEqual("OK");
        })
        .catch(function(error){
          expect(error).toBeUndefined();
        })
        .finally(done);
      $httpBackend.flush();
      expect(spy.calledWith("user", "passw0rd")).toBeTruthy();
    });

    it("should fail to authenticate", function(done) {
      var stub = sinon.stub(authRest, 'login');
      stub.withArgs("user", "passw0rd").returns($q.reject("error"));
      var promise = authService.login("user", "passw0rd");
      promise
        .catch(function(error) {
          expect(error).toEqual("error");
          expect(authService.isAuthenticated()).toBeFalsy();
          expect(authService.getToken()).toBeUndefined();
        })
        .finally(done);
      $rootScope.$apply();
    });

    it("should logout", function(done) {
      $httpBackend.expectGET(urlOf['rest-auth-user-self'])
        .respond({"id": "OK"});
      authService.login("user", "passw0rd")
        .then(function(result) {
          expect(result.id).toEqual("OK");
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(authService.getToken()).toEqual("OK");
          authService.logout();
          expect(authService.isAuthenticated()).toBeFalsy();
          expect(authService.getToken()).toBeUndefined();
        })
        .catch(function(error) {
          expect(error).toBeUndefined();
        })
        .finally(done);
      $httpBackend.flush();
    });

    it("should logout everywhere", function(done) {
      $httpBackend.expectGET(urlOf['rest-auth-user-self'])
        .respond({"id": "OK"});
      authService.login("user", "passw0rd")
        .then(function(result) {
          expect(result.id).toEqual("OK");
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(authService.getToken()).toEqual("OK");
          authService.logoutEverywhere().then(function(r) {
            expect(r).toEqual("logged out");
            expect(authService.isAuthenticated()).toBeFalsy();
            expect(authService.getToken()).toBeUndefined();
          });
        })
        .catch(function(error) {
          expect(error).toBeUndefined();
        })
        .finally(done);
      $httpBackend.flush();
    });
  });


  describe("callbacks", function () {
    var loginCalledBack, loginCalledBackInjected, logoutCalledBack, $log;

    beforeEach(function () {
      module("drf-lib.auth.services", function (authServiceProvider) {
        authServiceProvider.addLoginCallback(function (token) {
          loginCalledBack = token;
        });
        authServiceProvider.addLoginCallback(['urlOf', 'token',
          function (urlOf, token) {
            loginCalledBackInjected = urlOf['login'];
          }
        ]);
        authServiceProvider.addLoginCallback(function(){
          throw "login error";
        });
        authServiceProvider.addLogoutCallback(function () {
          logoutCalledBack = true;
        });
        authServiceProvider.addLogoutCallback(function(){
          throw "logout error";
        });
      });
    });

    beforeEach(inject(
      function(_authService_, _authRest_, _$rootScope_, _$q_, _urlOf_,
               _$log_, _$httpBackend_){
        authRest = _authRest_;
        authService = _authService_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        urlOf = _urlOf_;
        $log = _$log_;
        $httpBackend = _$httpBackend_;
      }
    ));


    it("should login and make callback", function (done) {
      $httpBackend.expectGET(urlOf['rest-auth-user-self'])
        .respond({"id": "OK"});
      var spy = sinon.stub($log, 'error');
      expect(loginCalledBack).toBeUndefined();
      expect(loginCalledBackInjected).toBeUndefined();
      authService.login("username", "password")
        .finally(function () {
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(loginCalledBack).toEqual('OK');
          expect(loginCalledBackInjected).toEqual(urlOf['login']);
          var call = spy.lastCall;
          expect(call.args[0].indexOf("login error") > -1).toBeTruthy();
          done();
        });
      $httpBackend.flush();
    });

    it("should logout and make callback", function () {
      var spy = sinon.stub($log, 'error');
      expect(logoutCalledBack).toBeUndefined();
      authService.logout();
      expect(logoutCalledBack).toBeTruthy();
      var call = spy.getCall(0);
      expect(call.args[0].indexOf("logout error") > -1).toBeTruthy();
    });

  });

  describe("interceptor", function() {
    var authInterceptor;
    beforeEach(inject(function(_authInterceptor_, _authService_, _$rootScope_){
      authInterceptor = _authInterceptor_;
      authService = _authService_;
      $rootScope = _$rootScope_;
    }));


    it("should set config on correct server", function (done){
      authService.setIdentity("OK").then(function() {
        var config = authInterceptor.request({url: URL_ROOT + "/test/"});
        expect(config.headers.Authorization).toEqual(authService.authHeader());
      }).finally(done);
      $rootScope.$apply();
    });

    it("should not set config on incorrect server", function (done){
      authService.setIdentity("OK").then(function() {
        var config = authInterceptor.request({url: "http://o.co/test/"});
        expect(config.headers).toBeUndefined();
      }).finally(done);
      $rootScope.$apply();
    });

    it("should not set config on incorrect server", function (){
      var config = authInterceptor.request({url: URL_ROOT + "/test/"});
      expect(config.headers).toBeUndefined();
    });


    it("should logout on 401 response", function(done) {
      authService.setIdentity("OK").then(function() {
        var spy = sinon.spy(authService, 'tryReconnect');
        authInterceptor.responseError(
          {status:401, config: {url: "https://testserver"}}
        );
        expect(spy.called).toBeTruthy();
      }).finally(done);
      $rootScope.$apply();
    });

    it("should not logout on valid response", function(done) {
      authService.setIdentity("OK").then(function() {
        var spy = sinon.spy(authService, 'logout');
        authInterceptor.responseError(
          {status:500, config: {url: "https://testserver"}}
        );
        expect(spy.called).toBeFalsy();
      }).finally(done);
      $rootScope.$apply();
    });

    it("should not logout on 401 response if not logged in", function() {
      var spy = sinon.spy(authService, 'logout');
      authInterceptor.responseError(
        {status:401, config: {url: "https://testserver"}}
      );
      expect(spy.called).toBeFalsy();
    });
  });

  describe("set HTTP interceptors", function() {
    var $httpProvider, $http;

    beforeEach(module(function(_$httpProvider_){
      $httpProvider = _$httpProvider_;
    }));
    beforeEach(
      inject(function (_$httpBackend_, _authService_, _$http_, _$rootScope_) {
        $httpBackend = _$httpBackend_;
        authService = _authService_;
        $http = _$http_;
        $rootScope = _$rootScope_;
      })
    );


    it("should set the interceptor", function(){
      expect($httpProvider.interceptors).toContain('authInterceptor');
    });

    it("should call request interceptor for correct server", function(done) {
      authService.setIdentity("OK").then(function() {
        $httpBackend.when('GET', URL_ROOT, null, function(headers) {
          expect(headers.Authorization).toBe(authService.authHeader())
        }).respond("OK");
        $http.get(URL_ROOT);
      }).finally(done);
      $httpBackend.flush();
    });

    it("should not call request interceptor for incorrect server",
      function(done) {
        authService.setIdentity("OK").then(function() {
          $httpBackend.when('GET', "http://o.co", null, function(headers) {
            expect(headers.Authorization).toBeUndefined();
          }).respond("OK");
          $http.get("http://o.co");
        }).finally(done);
        $httpBackend.flush();
    });

    it("should not call request interceptor if not logged in", function() {
      $httpBackend.when('GET', URL_ROOT, null, function(headers) {
        return headers.Authorization === undefined;
      }).respond("OK");
      $http.get(URL_ROOT);
      $httpBackend.flush();
    });

    it("should call tryReconnect on 401", function(done) {
      $httpBackend.expectGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(401, {'reason': 'duh'});

      $httpBackend.expectGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(200, {'status': 'OK'});

      authService.setIdentity("OK").then(function() {
        var spy = sinon.spy(authService, 'tryReconnect');
        $http.get(URL_ROOT).then(function(response) {
          expect(response.status).toBe(200);
          expect(spy.called).toBeTruthy();
          done();
        });
      });
      $httpBackend.flush();
    });

    it("should not call tryReconnect if not logged in", function(done) {
      var spy = sinon.spy(authService, 'logout');
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBeUndefined();
        return true;
      }).respond(403, {'reason': 'duh'});
      $http.get(URL_ROOT).finally(done);
      $httpBackend.flush();
      expect(spy.called).toBeFalsy();
    });

    it("should not call tryReconnect if no error", function(done) {
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(200, "OK");

      authService.setIdentity("OK").then(function() {
        var spy = sinon.spy(authService, 'logout');
        $http.get(URL_ROOT).finally(function() {
          expect(spy.called).toBeFalsy();
          done();
        });
      });
      $httpBackend.flush();
    });

    it("should not try to reconnect more than once on 401", function(done) {
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(401, {'reason': 'duh'});

      authService.setIdentity("OK").then(function() {
        var spy = sinon.spy(authService, 'tryReconnect');
        $http.get(URL_ROOT).catch(function(response) {
          expect(response.status).toBe(401);
          expect(spy.called).toBeTruthy();
          done();
        });
      });
      $httpBackend.flush();
    });
  });
});