
describe("drf-lib.auth.rest", function () {
  var $httpBackend, authRest, urlOf;
  var loginCalledBack, loginCalledBackInjected, logoutCalledBack;

  beforeEach(function() {
    angular.module("drf-lib.url", [])
      .factory('urlOf', function() {
        return {"login": "https://testserver/login/"}
      })
      .service('urlService', function() {
        var self = this;
        self.domainRequiresAuthorization = function(url) {
          return url.startsWith("https://testserver");
        }
      });
    module("drf-lib.url");
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
});