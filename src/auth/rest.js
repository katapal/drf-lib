angular.module('drf-lib.auth.rest', ['ngResource', 'rest-api.url'])
  .service('authRest',
    ['$http', 'urlOf', "$q", "drfUtil",
      function($http, urlOf, $q, drfUtil) {
        function extractToken(response) {
          if (response.status == 200)
            return response.data.key;
          else
            throw response;
        }
    
        this.login = function(u, p) {
          return $http.post(urlOf['login'], {'username': u, 'password': p})
            .then(extractToken);
        };

        this.jwt = function(token) {
          return $http({
            method: 'GET',
            url: urlOf['jwt'],
            headers: { 'Authorization': 'Token ' + token }
          }).then(function(response) {
            if (response.status == 200)
              return response.data.token;
            else
              return response;
          });
        };
    
        this.externalLogin = function(provider, request) {
          request = drfUtil.underscoredProperties(request);
          if (urlOf[provider + "-login"]) {
            return $http.post(urlOf[provider + "-login"], request)
              .then(extractToken);
          } else
            return $q.reject({"provider": provider});
        };
    
        this.logoutEverywhere = function() {
          return $http.post(urlOf['logout']);
        };
        return this;
      }
    ]
  );