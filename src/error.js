var errorModule = angular.module('drf-lib.error', ['angular.filter']);

var errorParser = function(lowercaseFilter, ucfirstFilter) {
  this.ucfirstFilter = ucfirstFilter;
  this.lowercaseFilter = lowercaseFilter;
};

errorParser.$inject = ['lowercaseFilter', 'ucfirstFilter'];

errorParser.prototype.extractMessage = function(response) {
  var self = this;
  if (response.data && response.data.non_field_errors)
    return response.data.non_field_errors.join(' ');
  else if (response.data && response.data.detail)
    return response.data.detail;
  else if (response.status == 400) {
    var msg = "";
    for (var field in response.data) {
      msg += self.ucfirstFilter(self.lowercaseFilter(field)) +
        ": " + response.data[field] + " ";
    }
    return msg;
  } else if (response.statusText)
    return self.ucfirstFilter(self.lowercaseFilter(response.statusText));
  else if (response.message)
    return response.message;
  else if (angular.isString(response))
    return response;
  else
    return "Service unavailable";
};

errorModule.service('errorParser', errorParser);