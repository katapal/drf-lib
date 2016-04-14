angular.module('drf-lib.auth.rest', ['ngResource', 'drf-lib.url'])
  .service('authRest', ['$http', 'urlOf', function($http, urlOf) {
    this.login = function (u, p) {
      return $http.post(urlOf['login'], {'username': u, 'password': p})
        .then(function (response) {
          if (response.status == 200)
            return response.data['key'];
          else
            throw response;
        });
    };
    return this;
  }]);