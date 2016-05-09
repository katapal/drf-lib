describe("drf-lib.auth.services", function () {
  var $httpBackend, authService, urlOf, $rootScope;
  var $q;
  var authRest;
  var URL_ROOT = "https://testserver/";

  beforeEach(function() {
    angular.module("rest-api.url", [])
      .factory('urlOf', function() {
        return {"login": "https://testserver/login/"}
      })
      .service('urlService', function() {
        var self = this;
        self.domainRequiresAuthorization = function(url) {
          return url.startsWith("https://testserver");
        }
      });

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

    beforeEach(inject(function(_authService_, _authRest_, _$rootScope_, _$q_){
      authRest = _authRest_;
      authService = _authService_;
      $rootScope = _$rootScope_;
      $q = _$q_;
    }));

    it("should call rest service and authenticate", function (done) {
      var spy = sinon.spy(authRest, 'login');
      var promise = authService.login("user", "passw0rd");
      promise
        .then(function(result) {
          expect(result).toEqual("OK");
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(authService.getToken()).toEqual("OK");
        })
        .catch(function(error){
          expect(error).toBeUndefined();
        })
        .finally(done);
      $rootScope.$apply();
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
      authService.login("user", "passw0rd")
        .then(function(token) {
          expect(token).toEqual("OK");
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
      $rootScope.$apply();
    });

    it("should logout everywhere", function(done) {
      authService.login("user", "passw0rd")
        .then(function(token) {
          expect(token).toEqual("OK");
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
      $rootScope.$apply();
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
               _$log_){
        authRest = _authRest_;
        authService = _authService_;
        $rootScope = _$rootScope_;
        $q = _$q_;
        urlOf = _urlOf_;
        $log = _$log_;
      }
    ));


    it("should login and make callback", function (done) {
      var spy = sinon.stub($log, 'error');
      expect(loginCalledBack).toBeUndefined();
      expect(loginCalledBackInjected).toBeUndefined();
      authService.login("username", "password")
        .finally(function () {
          expect(authService.isAuthenticated()).toBeTruthy();
          expect(loginCalledBack).toEqual('OK');
          expect(loginCalledBackInjected).toEqual(urlOf['login']);
          var call = spy.getCall(0);
          expect(call.args[0].indexOf("login error") > -1).toBeTruthy();
          done();
        });
      $rootScope.$apply();
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
    beforeEach(inject(function(_authInterceptor_, _authService_){
      authInterceptor = _authInterceptor_;
      authService = _authService_;
    }));


    it("should set config on correct server", function (){
      authService.setIdentity("OK");
      var config = authInterceptor.request({url: URL_ROOT + "/test/"});
      expect(config.headers.Authorization).toEqual(authService.authHeader());
    });

    it("should not set config on incorrect server", function (){
      authService.setIdentity("OK");
      var config = authInterceptor.request({url: "http://o.co/test/"});
      expect(config.headers).toBeUndefined();
    });

    it("should not set config on incorrect server", function (){
      var config = authInterceptor.request({url: URL_ROOT + "/test/"});
      expect(config.headers).toBeUndefined();
    });


    it("should logout on 401 response", function() {
      authService.setIdentity("OK");
      var spy = sinon.spy(authService, 'logout');
      authInterceptor.responseError({status:401});
      expect(spy.called).toBeTruthy();
    });

    it("should not logout on valid response", function() {
      authService.setIdentity("OK");
      var spy = sinon.spy(authService, 'logout');
      authInterceptor.responseError({status:500});
      expect(spy.called).toBeFalsy();
    });

    it("should not logout on 401 response if not logged in", function() {
      var spy = sinon.spy(authService, 'logout');
      authInterceptor.responseError({status:401});
      expect(spy.called).toBeFalsy();
    });
  });

  describe("set HTTP interceptors", function() {
    var $httpBackend, $httpProvider, $http;

    beforeEach(module(function(_$httpProvider_){
      $httpProvider = _$httpProvider_;
    }));
    beforeEach(function() {
      inject(function (_$httpBackend_, _authService_, _$http_) {
        $httpBackend = _$httpBackend_;
        authService = _authService_;
        $http = _$http_;
      });
    });


    it("should set the interceptor", function(){
      expect($httpProvider.interceptors).toContain('authInterceptor');
    });

    it("should call request interceptor for correct server", function() {
      authService.setIdentity("OK");
      $httpBackend.when('GET', URL_ROOT, null, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader())
      }).respond("OK");
    });

    it("should not call request interceptor for incorrect server", function() {
      authService.setIdentity("OK");
      $httpBackend.when('GET', "http://o.co", null, function(headers) {
        expect(headers.Authorization).toBeUndefined();
      }).respond("OK");
    });

    it("should not call request interceptor if not logged in", function() {
      $httpBackend.when('GET', URL_ROOT, null, function(headers) {
        expect(headers.Authorization).toBeUndefined();
      }).respond("OK");
    });

    it("should call response interceptor on 401", function(done) {
      authService.setIdentity("OK");
      var spy = sinon.spy(authService, 'logout');
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(401, {'reason': 'duh'});
      $http.get(URL_ROOT).finally(done);
      $httpBackend.flush();
      expect(spy.called).toBeTruthy();
    });

    it("should not call response interceptor if not logged in", function(done) {
      var spy = sinon.spy(authService, 'logout');
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBeUndefined();
        return true;
      }).respond(403, {'reason': 'duh'});
      $http.get(URL_ROOT).finally(done);
      $httpBackend.flush();
      expect(spy.called).toBeFalsy();
    });

    it("should not call response interceptor if no error", function(done) {
      authService.setIdentity("OK");
      var spy = sinon.spy(authService, 'logout');
      $httpBackend.whenGET(URL_ROOT, function(headers) {
        expect(headers.Authorization).toBe(authService.authHeader());
        return true;
      }).respond(200, "OK");
      $http.get(URL_ROOT).finally(done);
      $httpBackend.flush();
      expect(spy.called).toBeFalsy();
    });
  });
});