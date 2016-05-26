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
        var User = $resource(urlOf["rest-auth-user"]);
        return User.get().$promise.then(postProcess);
      };

      self.setProfile = function(profile) {
        profile = drfUtil.underscoredProperties(profile);
        var User = $resource(urlOf["rest-auth-user"], undefined,
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