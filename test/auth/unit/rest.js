
describe("drf-lib.auth.rest", function () {
  var $httpBackend, authRest, urlOf;
  var loginCalledBack, loginCalledBackInjected, logoutCalledBack;

  beforeEach(function() {
    angular.module("rest-api.url", [])
      .factory('urlOf', function() {
        return {
          "login": "https://testserver/login/",
          "facebook-login": "https://testserver/facebook-login/",
          "logout": "https://testserver/logout/"
        }
      })
      .service('urlService', function() {
        var self = this;
        self.domainRequiresAuthorization = function(url) {
          return url.startsWith("https://testserver");
        }
      });
    module("rest-api.url");
    module("drf-lib.util");
    module("ngStorage");
    module('drf-lib.auth.rest');
  });

  beforeEach(inject(
    function(_$httpBackend_, _authRest_, _urlOf_) {
      $httpBackend = _$httpBackend_;
      authRest = _authRest_;
      urlOf = _urlOf_;
    }
  ));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingRequest();
  });

  it("should login and make callback", function (done) {
    expect(loginCalledBack).toBeUndefined();
    expect(loginCalledBackInjected).toBeUndefined();
    $httpBackend.expectPOST(
      urlOf['login'],
      {'username': 'username', 'password': 'password'}
    ).respond({'key': 'OK'});
    authRest.login("username", "password")
      .then(function (token){
        expect(token).toEqual('OK');
      })
      .finally(done);

    $httpBackend.flush();
  });

  it("should fail login by returning falsy", function (done) {
    expect(loginCalledBack).toBeUndefined();
    expect(loginCalledBackInjected).toBeUndefined();
    $httpBackend.expectPOST(
      urlOf['login'],
      {'username': 'username', 'password': 'password'}
    ).respond(400, {'error': 'bad login'});
    authRest.login("username", "password")
      .then(function (token){
        expect(token).toBeFalsy();
      })
      .finally(done);

    $httpBackend.flush();
  });

  it("should logout everywhere", function(done) {
    $httpBackend.expectPOST(urlOf['logout']).respond("OK");
    authRest.logoutEverywhere().then(function(result) {
      expect(result["data"]).toEqual("OK");
    })
      .finally(done);
    $httpBackend.flush();
  });

  it("should throw error on bad external login", function(done) {
    authRest.externalLogin("twitter", {"access_token": "1"}).catch(function(e) {
      expect(e.provider).toEqual("twitter");
    }).finally(done);
    $httpBackend.flush();
  });

  it("should allow external login", function(done) {
    $httpBackend.expectPOST(urlOf['facebook-login'], {"access_token": "1"})
      .respond({"key": "OK"});
    authRest.externalLogin("facebook", {"accessToken": "1"}).then(function(r) {
      expect(r).toEqual("OK");
    }).finally(done);
    $httpBackend.flush();
  });
});