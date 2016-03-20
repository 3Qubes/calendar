angular.module('threequbes', ['ui.bootstrap','ui.utils','ui.calendar']);


angular.module('threequbes').directive('appointmentModal', [function () {
    var editController = ['$scope', '$modalInstance', '$timeout', 'model', 'appointmentSvc', 'validation', 'threequbesUserService','threequbesConfig',
        function ($scope, $modalInstance, $timeout, model, appointmentSvc, validation, threequbesUserService, threequbesConfig) {

        $scope.optionValues = {};

        //load the settings
        $scope.siteSettings = appointmentSvc.getCustomerSettings();

        if (model.appointment) {
            $scope.model = model.appointment;
            $scope.model.startDate = new Date($scope.model.startDate);
            if ($scope.model.options) {
                for (var i = 0; i < $scope.model.options.length; ++i) {
                    $scope.optionValues[$scope.model.options[i].optionId] = $scope.model.options[i].value;
                }

            }
        } else if (model.id) {
            $scope.model = appointmentSvc.getAppointment(model.id);
        } else {
            $scope.model = appointmentSvc.newAppointment();
            $scope.model.startDate = new Date();
            $scope.model.startDate.setHours(8, 15, 0, 0);
            //get the next available time
            appointmentSvc.nextAvailableTime($scope.model.startDate, 15).then(
                function(nextDate) {
                    $scope.model.startDate = new Date(nextDate);
                },
                function (error) {
                    //TODO: Handle....
                }
            );
            //load the current user
            $scope.currentUser = threequbesUserService.getCurrentUser();
            $scope.$watch('currentUser', function() {
                $scope.model.contactName = $scope.currentUser.fullName;
                $scope.model.contactEmail = $scope.currentUser.email;
            }, true);
            $scope.model.contactName = $scope.currentUser.fullName;
            $scope.model.contactEmail = $scope.currentUser.email;

        }

        $scope.allowOverride = model.allowOverride;

        var selectType = function (typeId) {
            //find the appointment type
            for (var i = 0; i < $scope.availableAppointmentTypes.items.length; ++i) {
                if ($scope.availableAppointmentTypes.items[i].Id === typeId) {
                    $scope.availableOptions = $scope.availableAppointmentTypes.items[i].Options;
                    $scope.model.typeName = $scope.availableAppointmentTypes.items[i].name;
                    break;
                }
            }

            //update the validations
            $scope.optionValidation.clear();
            //add a validation for each option
            for (i = 0; i < $scope.availableOptions.length; ++i) {
                $scope.optionValidation.add('optionValues[' + $scope.availableOptions[i].Id + ']',
                    $scope.availableOptions[i].name,
                    validation.required);
            }
        };


        var oneRequired = function (val) {
            var retVal = {
                valid: false,
                errors: []
            };
            //require an email or phone
            if (($scope.model.contactPhone !== undefined && $scope.model.contactPhone != null && $scope.model.contactPhone.toString().length > 0) ||
                ($scope.model.contactEmail !== undefined && $scope.model.contactEmail != null && $scope.model.contactEmail.toString().length > 0)) {
                retVal.valid = true;
            }

            if (!retVal.valid) {
                retVal.errors.push('Either a contact e-mail or a contact phone number must be specified.');
            }

            return retVal;
        };

        //setup validations
        $scope.validation = validation.create($scope);

        $scope.validation.add('model.typeId', 'serviceType', validation.required);
        $scope.validation.add('model.startDate', 'selectedDate', validation.required);
        $scope.validation.add('model.contactName', 'contactName', validation.required);
        $scope.validation.add('model.contactEmail', 'contactEmail', validation.required);

        $scope.optionValidation = validation.create($scope);

        //the available options - Load from server
        $scope.availableAppointmentTypes = appointmentSvc.getAvailableApptTypes();
        $scope.availableAppointmentTypes.addOnReady(function () {
            if ($scope.model && $scope.model.typeId) {
                selectType($scope.model.typeId);
            } else if ($scope.model) {
                $scope.model.typeId = $scope.availableAppointmentTypes.items[0].Id;
            }
        });

        //watch for changes to the selected serviceType, then load the available options
        $scope.$watch('model.typeId', function (newValue) {

            $scope.availableOptions = [];
            if (newValue) {
                selectType(newValue);
            }
        });




        //holds the state of the modal form controls
        $scope.modalFormState = {
            datePickerOpened: false,
            minDate: new Date(),
            dateOptions: {
                formatYear: 'yyyy',
                startingDay: 1
            },
            dateDisabled: function (date, mode) {
                //here we can put logic for disabling selection of certain dates
                //e.g. when closed or something.
                //NOTE: for longer term we probably need the ability to have the client
                //set "days off"
                return false;
            },
            openDatePicker: function () {
                $timeout(function () {
                    $scope.modalFormState.datePickerOpened = !$scope.modalFormState.datePickerOpened;
                });
            }
        };




        $scope.ok = function () {
            if ($scope.validation.check() && $scope.optionValidation.check()) {
                //fix the options

                for (var id in $scope.optionValues) {
                    //find if the id already exists
                    if (!$scope.model.options) {
                        $scope.model.options = [];
                    }
                    var found = false;
                    for (var i = 0; i < $scope.model.options.length; ++i) {
                        if ($scope.model.options[i].optionId === id) {
                            found = true;
                            $scope.model.options[i].value = $scope.optionValues[id];
                            break;
                        }
                    }

                    if (!found) {
                        $scope.model.options.push({
                            value: $scope.optionValues[id],
                            optionId: id
                        });
                    }
                }


                $scope.model.save('appointment').then(function (response) {
                    $scope.hasError = false;
                    $modalInstance.close($scope.model);
                }, function (error) {
                    if (error.status === 417) {
                        $scope.errorMessage = error.data.message;
                        $scope.hasError = true;
                    }
                });
            }


        };

        $scope.close = function () {
            $modalInstance.dismiss('cancel');
        };

    }];

    var controller = ['$scope', '$modal', function ($scope, $modal) {
        //watch $scope.show and show when visible
        $scope.$watch($scope.show, function (newValue) {
            if (newValue) {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'editAppointment.html',
                    controller: editController,
                    size: 'lg',
                    resolve: {
                        model: function () {
                            return {
                                id: $scope.appointmentId,
                                appointment: $scope.appointment,
                                allowOverride: $scope.allowOverride
                            };
                        }
                    }
                });

                modalInstance.result.then(function (selectedItem) {
                    $scope.onSave()(selectedItem);
                    $scope.show = false;
                }, function () {

                    $scope.onCancel()();
                    $scope.show = false;
                });

            }
        });
    }];

    return {
        restrict: 'E',
        replace: true,
        scope: {
            show: '&',
            appointmentId: '=',
            appointment: '=',
            onSave: '&',
            onCancel: '&',
            allowOverride:'@'
        },
        templateUrl: 'threequbes/directive/appointmentModal/appointmentModal.html',
        controller: controller
    };
}]);


/**
 * @ngdoc directive
 * @name global.directive:showBusy
 * @scope
 * @restrict E
 *
 * @description
 * Shows a busy overlay over the attached control when an event is seen on the event bus.
 * for example, <div show-busy="myData"> will watch for events named myData_start and myData_end
 * on the event bus.  When these events are seen, the busy overlay will show over the attached element.
 *
 * Additionally, an HTTP handler exists which will emit the messages when it sees a dataAnnotation option
 * on an http request.  That is, HttpService.post('url', {}, { dataAnnotation: 'myData' })
 * will handle showing and hiding the busy indicator when the http request starts and ends.
 *
 * @param {showBusy}  string   The message prefix to watch for
 *
 */
angular.module('threequbes').directive('showBusy', ['EventBus', function (EventBus) {


    var _positionLoadingOnResize = function (e) {
        var el = e.currentTarget;
        var id = $(el).attr('id');
        var overlayId = "loading_" + id;
        var div = $("#" + overlayId);
        //position over top of el
        var pos = $(el).offset();
        div.css({
            position: "absolute",
            marginLeft: 0,
            marginTop: 0,
            top: pos.top,
            left: pos.left
        });
        div.width($(el).outerWidth());
        div.height($(el).outerHeight());
        if ($(el).is(":visible")) {
            div.show();
        }
        else {
            div.hide();
        }
    };


    return {
        restrict: 'A',
        link: function (scope, el, attrs, fn) {
            var startMessageName = attrs.showBusy + "_start";
            var endMessageName = attrs.showBusy + "_end";
            //watch for the start message
            var disconnectStart = EventBus.register(startMessageName, function (val) {
                //create an absolute positioned div over the top of el, if not already there
                //first, create a unique id for el
                var id = $(el).attr('id') || Math.random().toString(16).slice(2, 10);
                $(el).attr('id', id);
                $(el).resize(_positionLoadingOnResize);
                //and a unique ID for the overlay
                var overlayId = "loading_" + id;



                if ($('#' + overlayId).length === 0) {
                    //create the div
                    var div = $("<div id='" + overlayId + "'>" +
                        "<div class='loading-overlay'>" +
                        "<span class='glyphicon glyphicon-refresh spinning'></span>" +
                        "</div>" +
                        "</div>");
                    //position over top of el
                    var pos = $(el).offset();
                    div.css({
                        position: "absolute",
                        marginLeft: 0,
                        marginTop: 0,
                        top: pos.top,
                        left: pos.left,
                        "z-index": 10000
                    });
                    div.width($(el).outerWidth());
                    div.height($(el).outerHeight());
                    if ($(el).is(":visible")) {
                        div.show();
                    }
                    else {
                        div.hide();
                    }
                    //add the div to the body
                    $('body').append(div);
                }
            });
            //watch for the end message
            var clearDiv = function() {
                //find any divs created in start
                var id = $(el).attr('id');
                var overlayId = "loading_" + id;
                if ($('#' + overlayId).length > 0) {
                    //if any exist, remove them
                    $('#' + overlayId).remove();
                }
                $(el).unbind('resize', _positionLoadingOnResize);
            };

            var disconnectEnd = EventBus.register(endMessageName, function (val) {
                clearDiv();
            });
            //on the scope destroy, unregister message watches
            scope.$on('$destroy', function () {
                clearDiv();
                disconnectStart();
                disconnectEnd();
            });
        }
    };
}]);

angular.module('threequbes').directive('threequbesCalendar', function() {
    var controller = ['$scope', 'appointmentSvc',
        function ( $scope, appointmentSvc) {
        //load the settings
        $scope.siteSettings = appointmentSvc.getCustomerSettings();


        $scope.errorMessage = "";
        $scope.hasError = false;
        var toCalendar = function (appt) {
            return {
                id: appt.Id,
                title: appt.typeName,
                start: new Date(appt.startDate),
                end: new Date(appt.endDate),
                allDay: false,
                editable: false,
                durationEditable: false,
            };
        };

        $scope.events = [];
        var appts = appointmentSvc.getAppointments();
        appts.addOnReady(function () {
            for (var i = 0; i < appts.length; ++i) {
                $scope.events.push(toCalendar(appts.items[i]));
            }
        });

        $scope.saveAppointment = function (appt) {
            $scope.appointmentEditorVisible = false;
            //remove existing event
            var index = -1;
            for (var i = 0; i < $scope.events.length; i++) {
                if ($scope.events[i].id === appt.Id) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                $scope.events.splice(index, 1);
            }
            $scope.events.push(toCalendar(appt));
            $scope.appts.items.push(appt);
        };

        $scope.cancelAppointmentEdit = function () {
            $scope.appointmentEditorVisible = false;
        };




        $scope.eventSources = [$scope.events];

        //config for calendar
        $scope.uiconfig = {
            calendar: {
                editable: true,
                weekMode: 'liquid',
                url: '#',
                header: {
                    left: 'today',
                    center: 'prev, title, next',
                    right: 'agendaDay,agendaWeek,month'
                }
            }
        };
    }];
	return {
		restrict: 'E',
		replace: true,
		scope: {

		},
		templateUrl: 'threequbes/directive/threequbesCalendar/threequbesCalendar.html',
        controller: controller
	};
});



angular.module('threequbes').directive('validationStatus', ["$compile", "$parse", function($compile, $parse) {
    function link(scope, element, attrs) {
        //watch for changes to scope['attrs.validationStatus'.valid]
        var watcher = scope.$watch(attrs.validationStatus + '.valid', function (newValue) {
            if (!newValue) {
                //add an has error class
                element.addClass('has-error has-feedback');
                var getter = $parse(attrs.validationStatus + '.errors[0]');
                element.attr('title', getter(scope));
            }
            else {
                //remove error
                element.attr('title', '');
                element.removeClass('has-error has-feedback');
            }
        });

        var errorWatcher = scope.$watch(attrs.validationStatus + '.errors', function (newValue) {
            var getter = $parse(attrs.validationStatus + '.errors[0]');
            element.attr('title', getter(scope));
        }, true);


        //add the help block
        //var el = angular.element('<p class="help-block" ng-if="!' + attrs.validationStatus + '.valid">{{' + attrs.validationStatus + '.errors[0]}}</p>');
        var el = angular.element('<span class="fa fa-times form-control-feedback" ng-if="!' + attrs.validationStatus + '.valid"></span>');
        $compile(el)(scope);
        element.append(el);
        //cleanup our watch on destroy
        scope.$on('$destroy', function () {
            watcher();
            errorWatcher();
        });
    }

    return {
        link: link

    };
}]);


/**
 * @ngdoc service
 * @name global.service:ShowBusyHandler
 * @scope
 * @restrict E
 *
 * @description
 * An http handler which watches for dataAnnotation properties on the options of $http request
 * and emits a {dataAnnotation}_start and {dataAnnotation}_end message when these $http requests starts and stops
 *
 */
angular.module('threequbes').provider('ShowBusyHandler', function ShowBusyHandlerProvider() {
    this.$get = ["$q", "$injector", "$window", "EventBus", function ($q, $injector, $window, EventBus) {

        var showBusyHandler = {};

        showBusyHandler.request = function (request) {
            if (request.hasOwnProperty('dataAnnotation')) {
                EventBus.send(request.dataAnnotation + "_start", {});
            }
            return request;
        };
        showBusyHandler.response = function (response) {
            if (response.config && response.config.hasOwnProperty('dataAnnotation')) {
                EventBus.send(response.config.dataAnnotation + "_end", {});
            }

            return response || $q.when(response);
        };
        showBusyHandler.requestError = function (rejection) {
            if (rejection.config && rejection.config.hasOwnProperty('dataAnnotation')) {
                EventBus.send(rejection.config.dataAnnotation + "_end", {});
            }

            return rejection;
        };
        showBusyHandler.responseError = function (rejection) {
            if (rejection.config && rejection.config.hasOwnProperty('dataAnnotation')) {
                EventBus.send(rejection.config.dataAnnotation + "_end", {});
            }

            return $q.reject(rejection);

        };

        return showBusyHandler;
    }];

}).config(["$httpProvider", function ($httpProvider) {
    $httpProvider.interceptors.push('ShowBusyHandler');
}]);

angular.module('threequbes').factory('threequbesUserService', ["resourceFactory", "$http", "$q", "$window", "$location", "threequbesConfig", function (resourceFactory, $http, $q, $window, $location, threequbesConfig) {
    var service = {};
    var usersRF = resourceFactory.get("account", "id");
    var cachedUser = null;
    service.getCurrentUser = function () {
        if (!cachedUser) {
            var retVal = usersRF.get("current");
            retVal.addOnReady(function() {
                cachedUser = retVal;
            });
            return retVal;
        }
        return cachedUser;
    };



    service.getAll = function() {
        return usersRF.getAll();
    };

    var _resolveAccessCheck = function(user, right, callback) {
        if (!user[right]) {
            //redirect to 401
            $location.path('/401');
        } else {
            callback();
        }
    };

    service.accessCheck = function(right, callback) {
        var user = service.getCurrentUser();
        if (!user.loaded) {
            user.addOnReady(function() { _resolveAccessCheck(user, right, callback); });
        }
        else {
            _resolveAccessCheck(user, right, callback);
        }

    };

    service.register = function(model) {
        var deferred = $q.defer();
        //post to /accounts/create
        var serviceurl = threequbesConfig.serviceUrl + '/api/account/create';

        $http({
            method: 'POST',
            url: serviceurl,
            dataAnnotation: "register",
            data: model
        }).success(function(response){
            deferred.resolve();
        }).error(function(error){
            if (error.modelState) {
                deferred.reject(error.modelState.error[0]);
            }
            else {
                deferred.reject(error.exceptionMessage);
            }

        });

        return deferred.promise;
    };

    service.changePassword = function(currentPassword, newPassword) {
        var deferred = $q.defer();
        //post to /accounts/create
        var serviceurl = threequbesConfig.serviceUrl + '/api/changePassword';

        $http({
            method: 'POST',
            url: serviceurl + "?currentPass=" + encodeURIComponent(currentPassword) + "&newPass=" + encodeURIComponent(newPassword),
            dataAnnotation: "user"
        }).success(function(response){
            deferred.resolve();
        }).error(function(error){
            if (error.modelState) {
                deferred.reject(error.modelState.error[0]);
            }
            else {
                deferred.reject(error.exceptionMessage);
            }

        });

        return deferred.promise;
    };

    service.updateProfile = function(model) {
        var deferred = $q.defer();
        //post to /accounts/create
        var serviceurl = threequbesConfig.serviceUrl + '/api/account/update';

        $http({
            method: 'POST',
            url: serviceurl,
            dataAnnotation: "user",
            data: {
                FirstName: model.firstName,
                LastName: model.lastName,
                Email: model.email,
                PhoneNumber: model.phoneNumber
            }
        }).success(function(response){
            deferred.resolve();
        }).error(function(error){
            if (error.modelState) {
                deferred.reject(error.modelState.error[0]);
            }
            else {
                deferred.reject(error.exceptionMessage);
            }

        });

        return deferred.promise;
    };

    service.login = function (username, pwd) {
        var deferred = $q.defer();
        //post to /oauth/token
        var serviceurl = threequbesConfig.serviceUrl + '/oauth/token';
        var data = 'grant_type=password&username=' + username + '&password=' + pwd + '&client_id=client_id';

        $http({
            method: 'POST',
            url: serviceurl,
            data: data,
            dataAnnotation: "login",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }).success(function(response){
            $window.localStorage['threequbesAuthorizationData'] = JSON.stringify({ token: response.access_token, userName: username });
            deferred.resolve();
        }).error(function(error){
            deferred.reject(error.error_description);
        });

        return deferred.promise;
    };

    return service;

}]);



angular.module('threequbes').factory('appointmentSvc', ["resourceFactory", "$q", "$http", "threequbesConfig", function (resourceFactory, $q, $http, threequbesConfig) {
    var service = {};
    var apptTypeRF = resourceFactory.get("AppointmentTypes", "Id");
    var apptRF = resourceFactory.get("appointments", "Id");
    var clientSettingsRF = resourceFactory.get("ClientSettings", "Id");

    service.getAvailableApptTypes = function () {
        return apptTypeRF.getAll('appointment');
    };

    service.nextAvailableTime = function(startDate, duration) {
        var deferred = $q.defer();
        //post to /accounts/create
        var serviceurl = threequbesConfig.serviceUrl + '/api/appointments/nextAvailable';
        serviceurl += "?startDateTime=" + startDate.toISOString();
        serviceurl += "&duration=" + duration;

        $http({
            method: 'GET',
            url: serviceurl,
            dataAnnotation: "appointments"
        }).success(function(response){
            deferred.resolve(response);
        }).error(function(error){
            deferred.reject(error.Message);

        });

        return deferred.promise;
    };

    service.getApptType = function (id) {
        return apptTypeRF.get(id, 'appointment');
    };
    service.newAppointmentType = function () {
        return apptTypeRF.new();
    };


    service.newAppointment = function () {
        return apptRF.new();
    };

    service.getAppointments = function () {
        return apptRF.getAll('appointment');
    };


    service.getAppointment = function (id) {
        return apptRF.get(id, 'appointment');
    };

    service.getCustomerSettings = function () {
        return clientSettingsRF.getOne('appointment');
    };



    return service;
}]);

angular.module('threequbes').config(["$httpProvider", function($httpProvider) {
    $httpProvider.interceptors.push(["$q", "$window", "$injector", function ($q, $window, $injector) {
        return {
            request: function (request) {
                var auth = JSON.parse($window.localStorage['threequbesAuthorizationData'] || '{}');
                if (auth && auth.hasOwnProperty('token')) {
                    request.headers.Authorization = 'Bearer ' + auth.token;
                }
                return request;
            },
            // This is the responseError interceptor
            responseError: function (rejection) {

                if (rejection.status === 401) {

                    $injector.invoke(["$state", function($state) {
                        var currentState = $state.current.name;
                        if (currentState !== "login" && currentState !== "selectClient") {
                            $state.go("login", {returnState: currentState});
                        }

                    }]);
                }
                /* If not a 401, do nothing with this error.
                 * This is necessary to make a `responseError`
                 * interceptor a no-op. */
                return $q.reject(rejection);
            }
        };
    }]);
}]);

angular.module('threequbes').config(["$httpProvider", function($httpProvider) {
    $httpProvider.interceptors.push(["$q", "threequbesConfig", function ($q, threequbesConfig) {
        return {
            request: function (request) {
                //add the client id header
                request.headers['X-BizCalendarClientId'] = threequbesConfig.clientId;
                return request;
            },
            // This is the responseError interceptor
            responseError: function (rejection) {
                return $q.reject(rejection);
            }
        };
    }]);
}]);

angular.module('threequbes').factory('clientService',["$http", "$q", "resourceFactory", "threequbesConfig", function($http, $q, resourceFactory, threequbesConfig) {

    var clientsRF = resourceFactory.get("client", "id");
	var service = {};

    service.getAll = function() {
        return clientsRF.getAll();
    };

    service.getClientList = function() {
        var deferred = $q.defer();
        //get to /client/list
        var serviceurl = threequbesConfig.serviceUrl + '/api/client/list';

        $http({
            method: 'GET',
            url: serviceurl,
            dataAnnotation: "selectClient"
        }).success(function(response){
            deferred.resolve(response);
        }).error(function(error){
            if (error.modelState) {
                deferred.reject(error.modelState.error[0]);
            }
            else {
                deferred.reject(error.exceptionMessage);
            }

        });

        return deferred.promise;
    };

    service.newClient = function() {
        return clientsRF.new();
    };

	return service;
}]);


/**
 * @ngdoc service
 * @name global.service:EventBus
 *
 * @description
 * EventBus is a service which broadcasts messages in a pub/sub model at a global level.
 * The EventBus service standardizes the pub/sub for the entire application
 *
 * Internally, this uses $rootScope.on/$rootScope.$emit for sub and pub, respectively.
 */
angular.module('threequbes').factory('EventBus', ["$rootScope", function ($rootScope) {
    var eventBus = {};

    eventBus.register = function (name, callback) {
        //$on has a bunch of parameters; but we want to simplify to the caller
        return $rootScope.$on(name, function (event, args) {
            callback(args);
        });
    };

    eventBus.send = function (name, obj) {
        $rootScope.$emit(name, obj);
    };

    return eventBus;
}]);

angular.module('threequbes').factory('resourceFactory', ["$http", "$injector", function ($http, $injector) {
    var _defaultConfig = {
        //withCredentials: true
    };

    var getConfig = function (dataAnnotation) {
        var retVal = {};
        angular.extend(retVal, _defaultConfig);
        if (dataAnnotation) {
            retVal.dataAnnotation = dataAnnotation;
        }
        return retVal;
    };

    var ResourceFactory = {};

    var Resources = function () {
        this.items = [];
        this.length = this.items.length;
        this.$$_readyCallbacks = [];
    };

    Resources.prototype.addOnReady = function (callback) {
        this.$$_readyCallbacks.push(callback);
    };

    Resources.prototype.ready = function () {
        for (var i = 0; i < this.$$_readyCallbacks.length; ++i) {
            this.$$_readyCallbacks[i]();
        }
    };


    Resources.prototype.push = function (item) {
        this.items.push(item);
        this.length = this.items.length;
    };

    Resources.prototype.get = function (index) {
        return this.items[index];
    };

    Resources.prototype.delete = function () {
        for (var i = 0; i < this.items.length; ++i) {
            this.items[i].delete();
        }
        this.items = [];
        this.length = 0;
    };

    Resources.prototype.forEach = function (iterator) {
        if (this.items.forEach) {
            this.items.forEach(iterator);
        }// use native code if it's there
        else {
            for (var i in this.items) {
                iterator(i, this.items[i], this.items);
            }
        }
    };

    // Book is a class which we can use for retrieving and
    // updating data on the server
    var Resource = function (url, idProperty, data) {
        angular.extend(this, data);
        this.$$url = url;
        this.$$idProperty = idProperty;
        this.$$_readyCallbacks = [];
        this.loaded = false;
    };


    Resource.prototype.addOnReady = function (callback) {
        this.$$_readyCallbacks.push(callback);
    };

    Resource.prototype.ready = function () {
        this.loaded = true;
        for (var i = 0; i < this.$$_readyCallbacks.length; ++i) {
            this.$$_readyCallbacks[i]();
        }
    };

    // an instance method to create a new Book
    Resource.prototype.save = function (dataAnnotation) {
        var resource = this;
        var config = getConfig(dataAnnotation);

        if (this.hasOwnProperty(this.$$idProperty) && this[this.$$idProperty]) {
            //existing resource
            var id = this[this.$$idProperty];
            var ret = $http.post(this.$$url + '/' + id, this, config);
            ret.success(function (data) {
                angular.extend(resource, data);
            });
            return ret;

        } else {
            //new resource
            var postret = $http.post(this.$$url, this, config);

            postret.success(function (data) {
                angular.extend(resource, data);
                return resource;
            });

            return postret;
        }
    };

    Resource.prototype.refresh = function (dataAnnotation) {
        var resource = this;

        var config = getConfig(dataAnnotation);

        //existing resource
        var id = resource[resource.$$idProperty];
        var ret = $http.get(resource.$$url + '/' + id, config);
        ret.success(function (data) {
            angular.extend(resource, data);
            resource.ready();
        });
        return ret;
    };

    Resource.prototype.delete = function (dataAnnotation) {
        var resource = this;

        var config = getConfig(dataAnnotation);
        if (this.hasOwnProperty(this.$$idProperty) && this[this.$$idProperty]) {
            //existing resource
            var id = this[this.$$idProperty];
            return $http.delete(this.$$url + '/' + id, this, config).then(function (response) {
                return null;
            });
        } else {
            //new resource -- delete is a no-op
            return {
                success: function (callback) {
                    callback(null);
                },
                error: function (callback) {
                    callback(null);
                }
            };
        }
    };

    var StaticResource = function (url, idProperty) {
        angular.extend(this);
        this.url = url;
        this.idProperty = idProperty;
    };

    StaticResource.prototype.getOne = function (dataAnnotation) {

        var config = getConfig(dataAnnotation);

        var retVal = new Resource(this.url, this.idProperty, {});
        $http.get(this.url, config).
        success(function (data, status, headers, config) {
            if (angular.isArray(data)) {
                angular.extend(retVal, data[0]);
            }
            else {
                angular.extend(retVal, data);
            }
            retVal.ready();
        });
        return retVal;
    };

    StaticResource.prototype.getAll = function (dataAnnotation) {
        var retVal = new Resources();

        var config = getConfig(dataAnnotation);
        var that = this;
        $http.get(this.url, config).then(function (response) {
            if (angular.isArray(response.data)) {
                for (var i = 0; i < response.data.length; ++i) {
                    retVal.push(new Resource(that.url, that.idProperty, response.data[i]));
                }
            }
            else {
                retVal.push(new Resource(that.url, that.idProperty, response.data));
            }
            retVal.ready();
        });
        return retVal;
    };

    StaticResource.prototype.get = function (id, dataAnnotation) {
        var that = this;

        var config = getConfig(dataAnnotation);

        var retVal = new Resource(this.url, this.idProperty, {});
        $http.get(this.url + '/' + id, config).
        success(function (data, status, headers, config) {
            if (angular.isArray(data)) {
                angular.extend(retVal, data[0]);
            }
            else {
                angular.extend(retVal, data);
            }
            retVal.ready();
        });
        return retVal;
    };

    StaticResource.prototype.new = function (data) {
        return new Resource(this.url, this.idProperty, data);
    };


    ResourceFactory.get = function (resourceName, idProperty, actions) {
        return $injector.invoke(['threequbesConfig', function (threequbesConfig) {
            var retVal = new StaticResource(threequbesConfig.serviceUrl + "/api/" + resourceName,
                idProperty);
            if (actions) {
                angular.extend(retVal, actions);
            }
            return retVal;
        }]);
    };
    ResourceFactory.defaultConfig = _defaultConfig;

    return ResourceFactory;
}]);

angular.module('threequbes').provider('threequbesConfig', function threequbesConfigProvider() {
    var config = {
        serviceUrl: 'http://bizcalendar.azurewebsites.net/',
        clientId: '',
        apiKey: '',
        setClientId: function(cid) {
            this.clientId = cid;
        },
        setServiceUrl: function(url) {
            this.serviceUrl = url;
        },
        setAPIKey : function(key) {
            this.apiKey = key;
        }
    };


    this.serviceUrl = function(value) {
        config.serviceUrl = value;
    };
    this.apiKey = function(value) {
        config.apiKey = value;
    };
    this.clientId = function(value) {
        config.clientId = value;
    };

    this.$get = [function() {
        return config;
    }];
});

var Validation = function(parser, scope, context, varToWatch, validator) {
    this._parser = parser;
    this._scope = scope;
    this.valid = true;
    this.errors = [];
    this.shouldCheck = false;
    this.validator = validator;
    this.context = context;
    this.$$validation = true;

    this._varToWatch = varToWatch;

    var that = this;

    this.$$varWatch = this._scope.$watch(varToWatch, function (newValue) {
        if (that.shouldCheck) {
           that.validate(newValue);
        }
    }, true);
};

Validation.prototype.check = function() {
    this.shouldCheck = true;
    var getter = this._parser(this._varToWatch);
    var currentValue = getter(this._scope);
    this.validate(currentValue);
};

Validation.prototype.unregister = function() {
    this.$$varWatch();
};

Validation.prototype.validate = function(val) {
    var validation = this.validator(val);
    this.valid = validation.valid;
    this.errors = validation.errors;
    this.context._updateState();
};



var ValidationContext = function (scope, parser) {
    this._scope = scope;
    this._parser = parser;
    this.isValid = true;
};

ValidationContext.prototype.check = function() {
    for (var key in this) {
        if (this[key].$$validation) {
            //check it
            this[key].check();
        }
    }
    this._updateState();
    return this.isValid;
};

ValidationContext.prototype.clear = function () {
    //unwatch and delete all values in this
    for (var key in this) {
        if (this[key].$$validation) {
            this[key].unregister();
            delete this[key];
        }
    }

    this._updateState();
};

ValidationContext.prototype.add = function (varToWatch, name, validator) {
    var validation = new Validation(this._parser, this._scope, this, varToWatch, validator);
    this[name] = validation;
    this._updateState();
};

ValidationContext.prototype._updateState = function () {
    var isValid = true;
    for (var key in this) {
        if (this[key].hasOwnProperty('$$validation')) {
            isValid = isValid && this[key].valid;
        }
    }
    this.isValid = isValid;
};





angular.module('threequbes').factory('validation', ["$parse", function ($parse) {

    var validation = {};
    validation.create = function (scope) {
        //create a new history context
        var context = new ValidationContext(scope, $parse);
        return context;
    };

    validation.required = function (val) {
        var retVal = {
            valid: (val !== undefined && val != null && val.toString().length > 0),
            errors: []
        };

        if (!retVal.valid) {
            retVal.errors.push('This field is required');
        }

        return retVal;
    };

    return validation;
}]);

angular.module('threequbes').run(['$templateCache', function($templateCache) {
  $templateCache.put("threequbes/directive/appointmentModal/appointmentModal.html",
    "<script type=text/ng-template id=editAppointment.html><div show-busy=\"appointment\">\n" +
    "        <div class=\"modal-header\">\n" +
    "            <button type=\"button\" class=\"close\" ng-click=\"close()\" aria-label=\"Close\"><span aria-hidden=\"true\">&times;</span></button>\n" +
    "            <h4 class=\"modal-title\" id=\"exampleModalLabel\">New Appointment</h4>\n" +
    "        </div>\n" +
    "\n" +
    "        <div class=\"modal-body\">\n" +
    "            <div class=\"bs-callout bs-callout-warning\" ng-show=\"siteSettings.showAppointmentWarning\">{{siteSettings.appointmentWarning}}</div>\n" +
    "\n" +
    "            <div class=\"bs-callout bs-callout-danger\" ng-show=\"hasError\">\n" +
    "                <h4>Could not create appointment</h4>\n" +
    "                <p>{{errorMessage}}</p>\n" +
    "            </div>\n" +
    "            <form class=\"form-horizontal\">\n" +
    "                <div class=\"form-group\" validation-status=\"validation.serviceType\">\n" +
    "                    <label for=\"serviceType\" class=\"col-lg-3\">Service Type:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <select id=\"serviceType\" class=\"form-control col-lg-9\"\n" +
    "                                ng-required=\"true\"\n" +
    "                                ng-model=\"model.typeId\"\n" +
    "                                ng-options=\"option.Id as option.name for option in availableAppointmentTypes.items | filter :{active: true}\">\n" +
    "                            <option value=\"\" ng-if=\"false\"></option>\n" +
    "                        </select>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label for=\"apptDate\" class=\"col-lg-3\" validation-status=\"validation.selectedDate\">Appointment Date:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <div class=\"input-group\">\n" +
    "                            <input id=\"apptDate\" type=\"date\" class=\"form-control\"\n" +
    "                                   datepicker-popup\n" +
    "                                   ng-model=\"model.startDate\"\n" +
    "                                   is-open=\"modalFormState.datePickerOpened\"\n" +
    "                                   min-date=\"modalFormState.minDate\"\n" +
    "                                   max-date=\"'2020-06-22'\"\n" +
    "                                   datepicker-options=\"modalFormState.dateOptions\"\n" +
    "                                   date-disabled=\"modalFormState.disabled(date, mode)\"\n" +
    "                                   ng-required=\"true\"\n" +
    "                                   close-text=\"Close\" />\n" +
    "                            <span class=\"input-group-btn\">\n" +
    "                                <button type=\"button\" class=\"btn btn-default\" ng-click=\"modalFormState.openDatePicker()\"><i class=\"glyphicon glyphicon-calendar\"></i></button>\n" +
    "                            </span>\n" +
    "                        </div>\n" +
    "\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label for=\"apptTime\" class=\"col-lg-3\">Appointment Time:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <timepicker id=\"apptTime\" minute-step=\"15\" show-spinners=\"false\"\n" +
    "                                    ng-required=\"true\"\n" +
    "                                    ng-model=\"model.startDate\"></timepicker>\n" +
    "\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div ng-repeat=\"option in availableOptions| filter :{active: true}\" class=\"form-group\" validation-status=\"optionValidation[option.name]\">\n" +
    "                    <label for=\"{{'option_' + $index}}\" class=\"col-lg-3\">{{option.name}}:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <input id=\"{{'option_' + $index}}\" type=\"text\" ng-required=\"true\"\n" +
    "                               class=\"form-control\"\n" +
    "                               ng-model=\"optionValues[option.Id]\" />\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\" validation-status=\"validation.contactName\">\n" +
    "                    <label for=\"contactName\" class=\"col-lg-3\">Contact Name:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <input id=\"contactName\" type=\"text\" ng-required=\"true\"\n" +
    "                               class=\"form-control\"\n" +
    "                               ng-model=\"model.contactName\" />\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "\n" +
    "                <div class=\"form-group\" validation-status=\"validation.contactEmail\">\n" +
    "                    <label for=\"contactEmail\" class=\"col-lg-3\">Contact Email:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <input id=\"contactEmail\" type=\"text\" ng-required=\"true\"\n" +
    "                               class=\"form-control\"\n" +
    "                               ng-model=\"model.contactEmail\" />\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label for=\"contactPhone\" class=\"col-lg-3\">Contact Phone:</label>\n" +
    "                    <div class=\"col-lg-9\">\n" +
    "                        <input id=\"contactPhone\" type=\"text\" ng-required=\"true\"\n" +
    "                               class=\"form-control\"\n" +
    "                               ng-model=\"model.contactPhone\" />\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "\n" +
    "\n" +
    "\n" +
    "                <div class=\"form-group\">\n" +
    "                    <label for=\"notes\" class=\"col-lg-3\">Notes:</label>\n" +
    "                </div>\n" +
    "                <div class=\"form-group\">\n" +
    "                    <div class=\"col-lg-12\">\n" +
    "                        <textarea class=\"form-control\" id=\"notes\" ng-model=\"model.notes\"></textarea>\n" +
    "                    </div>\n" +
    "                </div>\n" +
    "            </form>\n" +
    "        </div>\n" +
    "        <div class=\"modal-footer\">\n" +
    "            <div class=\"form-group\" ng-show=\"allowOverride == 'true'\">\n" +
    "                <div class=\"checkbox\">\n" +
    "                    <label><input type=\"checkbox\" ng-required=\"true\" ng-model=\"model.isOverride\">Ignore scheduling rules</label>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            <button type=\"button\" class=\"btn btn-default\" ng-click=\"close()\">Close</button>\n" +
    "            <button type=\"button\" class=\"btn btn-primary\"\n" +
    "                    ng-disabled=\"!validation.isValid || !optionValidation.isValid\"\n" +
    "                    ng-click=\"ok()\">\n" +
    "                Save Appointment\n" +
    "            </button>\n" +
    "        </div>\n" +
    "    </div></script>");
  $templateCache.put("threequbes/directive/threequbesCalendar/threequbesCalendar.html",
    "<div class=well-lg show-busy=appointment><div class=\"bs-callout bs-callout-warning\" ng-show=siteSettings.showDisclaimer>{{siteSettings.disclaimerLabel}}</div><label ng-show=sitesettings.showDisclaimer>JK</label><br><br><button type=button class=\"btn btn-primary\" ng-click=\"appointmentEditorVisible = true\">CREATE AN APPOINTMENT</button><br><br><div ui-calendar=uiconfig.calendar ng-model=eventSources></div><appointment-modal show=appointmentEditorVisible on-save=saveAppointment on-cancel=cancelAppointmentEdit allow-override=false></appointment-modal></div>");
}]);
