# 3qubes Calendar

The 3qubes calendar is a directive for displaying the 3qubes Calendar inside your application.

## Overview
**threequbes-calendar** is a directive for displaying the 3qubes calendar embedded in your website.

## Usage
Using [bower](http://bower.io) run:

    bower install --save threequbes-calendar

Alternatively you can add it to your `bower.json` like this:

    dependencies: {
        "threequbes-calendar": "latest"
    }

And then run

    bower install

This will copy the threequbes-calendar files into your `components` folder, along with its dependencies. Load the script and style files in your application:

    <!-- jquery, moment, angular, bootstrap, and full calendar have to get included before fullcalendar -->
    <link rel="stylesheet" href="bower_components/fullcalendar/dist/fullcalendar.css"/>
    <link rel="stylesheet" href="bower_components/threequbes-calendar/threequbes.css"/>
    <script src="bower_components/jquery/dist/jquery.min.js"></script>
    <script src="bower_components/bootstrap/dist/js/bootstrap.js"></script>
    <script src="bower_components/angular-bootstrap/ui-bootstrap-tpls.js"></script>
    <script src="bower_components/angular-ui-utils/ui-utils.js"></script>
    <script src="bower_components/moment/min/moment.min.js"></script>
    <script src="bower_components/angular/angular.min.js"></script>
    <script src="bower_components/fullcalendar/dist/fullcalendar.js"></script>
    <script src="bower_components/angular-ui-calendar/src/calendar.js"></script>
    <script src="bower_components/threequbes-calendar/threequbes.js"></script>

Add the calendar modules as a dependency to your application module:

    var app = angular.module('App', ['ui.calendar', 'threequbes'])

Configure the system with your API key

    angular.module('App').config(function(threequbesConfigProvider) {
        threequbesConfigProvider.apiKey(<Your API Key>);
        //Set the Dev URL
        threequbesConfigProvider.serviceUrl('http://bizcalendar-dev.azurewebsites.net/');
        //or the Live URL
        //threequbesConfigProvider.serviceUrl('http://bizcalendar.azurewebsites.net/');
        //Set the client ID you are displaying the calendar for
        threequbesConfigProvider.clientId(<Client ID>);
    });

Obtain a login token

    angular.module('App').run(function(threequbesUserSvc) {
        threequbesUserSvc.login(<Your username>, <Your password>).then(function(result) {
                 //login succeeded, proceed to show the calendar.
             }, function(reason) {
                 //error occurred logging in, handle the error.
             });
    });

Apply the directive where you want to display the calendar:

    <threequbes-calendar></threequbes-calendar>

