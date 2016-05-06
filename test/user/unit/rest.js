describe("drf-lib.user", function() {
  var $httpBackend, authRest, urlOf;

  beforeEach(function() {
    module("ngResource");
    angular.module("rest-api.url", [])
      .factory('urlOf', function() {
        var map = {
          'rest-auth-user': '/rest-auth/user/',
          'rest-auth-register': '/rest-auth/registration/',
          'rest-auth-set-password': '/rest-auth/password/change/',
          'rest-auth-reset-password': '/rest-auth/password/reset/',
          'rest-auth-confirm-reset': '/rest-auth/password/reset/confirm/'
        };

        // prepend the server name
        for (var k in map)
          map[k] = "https://testserver" + map[k];

        return map;
      })

      .service('urlService', function() {
        var self = this;
        self.domainRequiresAuthorization = function(url) {
          return url.startsWith("https://testserver");
        }
      })
      .config(function($resourceProvider) {
        $resourceProvider.defaults.stripTrailingSlashes = false;
      });
    module("drf-lib.util");
    module("rest-api.url");
    module('drf-lib.user.rest');
  });

  beforeEach(inject(
    function(_$httpBackend_, _userRest_, _urlOf_) {
      $httpBackend = _$httpBackend_;
      userRest = _userRest_;
      urlOf = _urlOf_;
    }
  ));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingRequest();
  });

  it("should get user profile", function(done) {
    $httpBackend.expectGET(urlOf['rest-auth-user'])
      .respond({"status": "OK"});
    userRest.getProfile().then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

  it("should set user profile", function(done) {
    $httpBackend.expectPUT(urlOf['rest-auth-user'], {"data": "1234"})
      .respond({"status": "OK"});
    userRest.setProfile({"data": "1234"}).then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

  it("should set user password", function(done) {
    $httpBackend.expectPOST(urlOf['rest-auth-set-password'],
      {"new_password1": "1234", "new_password2": "1234"})
      .respond({"status": "OK"});
    userRest.setPassword("1234", "1234").then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

  it("should reset user password", function(done) {
    $httpBackend.expectPOST(urlOf['rest-auth-reset-password'],
      {"email": "1234@asdf.com"}
    ).respond({"status": "OK"});
    userRest.resetPassword("1234@asdf.com").then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

  it("should confirm reset user password", function(done) {
    $httpBackend.expectPOST(urlOf['rest-auth-confirm-reset'],
      {"uid": "1", "token": "2", "new_password1": "1234",
        "new_password2": "1234"}
    ).respond({"status": "OK"});
    userRest.confirmResetPassword("1", "2", "1234", "1234").then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

  it("should register user", function(done) {
    $httpBackend.expectPOST(urlOf['rest-auth-register'],
      {"username": "1", "password1" : "1234", "password2": "1234",
        "email": "1234@asdf.com"}
    ).respond({"status": "OK"});
    userRest.registerUser("1", "1234", "1234", "1234@asdf.com").then(function(result){
      expect(result).toEqual({"status": "OK"});
    }).finally(done);
    $httpBackend.flush();
  });

});