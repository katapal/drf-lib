/**
 * Created by David on 9/28/2015.
 */
describe("drf-lib.util", function () {
  var drfUtil, $q, $rootScope, dateFilter, $resource, $httpBackend,
    restServiceHelper;

  beforeEach(function() {
    module("drf-lib.util");
    module("ngResource");
  });
  beforeEach(inject(
    function (_drfUtil_, _$q_, _$rootScope_, _dateFilter_, _$resource_,
              _$httpBackend_, _restServiceHelper_) {
      drfUtil = _drfUtil_;
      $q = _$q_;
      $rootScope = _$rootScope_;
      dateFilter = _dateFilter_;
      $resource = _$resource_;
      $httpBackend = _$httpBackend_;
      restServiceHelper = _restServiceHelper_;
    })
  );
  
  describe("creates a list function that", function() {
    it("should send queries without paging", function(done) {
      var url = "http://testserver/resource";
      var r = $resource(url);
      var listFunction = restServiceHelper.createListFunction(r);
      $httpBackend.expectGET(url).respond({ results: ["1"] });
      listFunction().then(function(result) {
        expect(result.length).toEqual(1);
        expect(result[0]).toEqual("1");
      }).finally(done);

      $httpBackend.flush()
    });
    
    it("should send queries with paging", function(done) {
      var url = "http://testserver/resource";
      var r = $resource(url);
      var listFunction = restServiceHelper.createListFunction(r);
      $httpBackend.expectGET(url + "?limit=5").respond({
        count: 1,
        results: ["1"]
      });
      listFunction({limit: 5}).then(function(result) {
        expect(result.length).toEqual(1);
        expect(result[0]).toEqual("1");
        expect(result.count).toEqual(1);
      }).finally(done);

      $httpBackend.flush()
    });
  });

  it("should convert object underscore to camel case", function () {
    expect(drfUtil.camelizeProperties({
      "hello_world": "test",
      "another_test": {
        "ok_now": "try again",
        "tell_me": "the_truth",
        "tell_me_again": ["what_is", "the", {"truth_of": "it_all"}]
      }
    })).toEqual({
      "helloWorld": "test",
      "anotherTest": {
        "okNow": "try again",
        "tellMe": "the_truth",
        "tellMeAgain": ["what_is", "the", {"truthOf": "it_all"}]
      }
    });
  });

  it("should convert object camel case to underscore", function() {
    expect(drfUtil.underscoredProperties({
      "helloWorld": "test",
      "anotherTest": {
        "okNow": "try again",
        "tellMe": "the_truth",
        "tellMeAgain": ["what_is", "the", {"truthOf": "it_all"}]
      }
    })).toEqual({
      "hello_world": "test",
      "another_test": {
        "ok_now": "try again",
        "tell_me": "the_truth",
        "tell_me_again": ["what_is", "the", {"truth_of": "it_all"}]
      }
    });
  });

  it("should wrap function calls", function(done) {
    var beforeVar, afterVar, callVar;
    var beforeCall = function() {
      beforeVar = "set"
    };
    var afterCall = function() {
      afterVar = "set"
    };
    var f1 = function() {
      callVar = "set";
      return 1;
    };
    var f2 = function() {
      callVar = "set";
      return $q.when(1);
    };
    var f3 = function() {
      callVar = "set";
      return $q.reject("exception");
    };

    expect(beforeVar).toBeUndefined();
    expect(afterVar).toBeUndefined();
    expect(callVar).toBeUndefined();
    copy = drfUtil.wrapMethod(f1, beforeCall, afterCall);
    var ret = copy();
    expect(ret).toBe(1);
    expect(beforeVar).toBe("set");
    expect(afterVar).toBe("set");
    expect(callVar).toBe("set");
    beforeVar = undefined;
    afterVar = undefined;
    callVar = undefined;
    copy = drfUtil.wrapMethod(f2, beforeCall, afterCall);
    copy()
      .then(function() {
        expect(beforeVar).toBe("set");
        expect(afterVar).toBe("set");
        expect(callVar).toBe("set");
      });
    $rootScope.$digest();

    beforeVar = undefined;
    afterVar = undefined;
    callVar = undefined;

    copy = drfUtil.wrapMethod(f3, beforeCall, afterCall);
    copy()
      .catch(function(e) {
        expect(beforeVar).toBe("set");
        expect(afterVar).toBe("set");
        expect(callVar).toBe("set");
      })
      .finally(done);

    $rootScope.$digest();

  });

  it("should wrap object method calls", function(done) {
    var beforeVar, afterVar;
    var beforeCall = function() {
      beforeVar = "set"
    };
    var afterCall = function() {
      afterVar = "set"
    };
    var obj = {
      "test": function() {
        this.callVar = "set";
        return 1;
      },
      "testPromise": function() {
        this.callVar = "set";
        return $q.when(1);
      },
      "testPromiseError": function() {
        this.callVar = "set";
        return $q.reject("exception");
      }
    };
    expect(beforeVar).toBeUndefined();
    expect(afterVar).toBeUndefined();
    expect(obj.callVar).toBeUndefined();
    copy = drfUtil.wrapMethods(obj, beforeCall, afterCall);
    var ret = copy.wrapped.test();
    expect(ret).toBe(1);
    expect(beforeVar).toBe("set");
    expect(afterVar).toBe("set");
    expect(obj.callVar).toBe("set");
    beforeVar = undefined;
    afterVar = undefined;
    obj.callVar = undefined;
    copy.wrapped.testPromise()
      .then(function() {
        expect(beforeVar).toBe("set");
        expect(afterVar).toBe("set");
        expect(obj.callVar).toBe("set");
      });
    $rootScope.$digest();

    beforeVar = undefined;
    afterVar = undefined;
    obj.callVar = undefined;

    copy.wrapped.testPromiseError()
      .catch(function(e) {
        expect(beforeVar).toBe("set");
        expect(afterVar).toBe("set");
        expect(obj.callVar).toBe("set");
      })
      .finally(done);

    $rootScope.$digest();
  });
});