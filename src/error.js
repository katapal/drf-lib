var errorModule = angular.module('drf-lib.error', ['angular.filter']);

var errorParser = function(lowercaseFilter, ucfirstFilter) {
  this.ucfirstFilter = ucfirstFilter;
  this.lowercaseFilter = lowercaseFilter;
};

errorParser.$inject = ['lowercaseFilter', 'ucfirstFilter'];

errorParser.prototype.extractMessage = function(response) {
  var self = this, i, extracted, msg, field;
  if (response.data && response.data.non_field_errors)
    return response.data.non_field_errors.join(' ');
  else if (response.data && response.data.detail)
    return response.data.detail;
  else if (response.data && angular.isArray(response.data)) {
    extracted = [];
    for(i = 0; i < response.data.length; i++) {
      extracted.push(self.extractMessage(response.data[i]));
    }
    return extracted.join(', ');
  } else if (response.status == 400) {
    if (angular.isString(response.data))
      return response.data;
    else {
      msg = "";
      for (field in response.data) {
        msg += self.ucfirstFilter(self.lowercaseFilter(field)) +
          ": " + response.data[field] + " ";
      }
      return msg;
    }
  } else if (response.statusText)
    return self.ucfirstFilter(self.lowercaseFilter(response.statusText));
  else if (response.status == -1)
    return "Network unavailable";
  else if (response.message)
    return response.message;
  else if (angular.isString(response))
    return response;
  else if (angular.isObject(response)) {
    msg = "";
    for (field in response) {
      msg += self.ucfirstFilter(self.lowercaseFilter(field)) +
        ": " + response[field] + " ";
    }
    return msg;
  } else
    return "Service unavailable";
};

errorModule.service('errorParser', errorParser);