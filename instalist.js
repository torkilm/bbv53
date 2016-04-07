'use strict';

/* globals angular */

angular.module('Instalist', [])

.factory('Defaults', [
  function () {
    var containerTemplate = [
      '<a class="{{ :: ctrl.aClass }}" ng-href="{{ :: Image.link }}" ng-repeat="Image in ctrl.Images">',
        '<img class="{{ :: ctrl.imgClass }}" ng-src="{{ :: Image.images[ctrl.realSize].url }}"',
          ' data-low-resolution="{{ :: Image.images.low_resolution.url }}"',
          ' data-standard-resolution="{{ :: Image.image.standard_resolution.url }}"',
          ' data-thumbnail="{{ :: Image.image.thumbnail.url }}"',
          '',
          '>',
      '</a>',
    ].join('');

    return {
      source: null,
      hashtags: '',
      count: 6,
      size: 'thumbnail',
      aClass: '',
      imgClass: '',
      maxTries: 10,
      userUrl: 'https://api.instagram.com/v1/users/{SOURCE}/media/recent/?access_token={ACCESS_TOKEN}&callback=JSON_CALLBACK',
      hashUrl: 'https://api.instagram.com/v1/tags/{SOURCE}/media/recent?access_token={ACCESS_TOKEN}&callback=JSON_CALLBACK',
      containerTemplate: containerTemplate,
    };
  }])

.factory('Fetcher', ['$http', '$log', 'Defaults',
  function ($http, $log, Defaults) {
    var request = function (url) {
      return $http.jsonp(url);
    };


    var fetch = function (url, hashtags, count, images, triesLeft) {
      images = images || [];
      triesLeft = typeof(triesLeft) === 'undefined' ? Defaults.maxTries : triesLeft;

      if (triesLeft < 0) {
        $log.debug('Max retries occured.');
        return images;
      }

      if (images.length === count) {
        return images;
      }

      return request(url)
      .then(function (response) {
        var data = response.data,
            meta = data.meta,
            instaimages = data.data;

        if (meta.code !== 200) {
          throw new Error('Oh snippety, Instagram error: ' + meta.error_message);
        }

        angular.forEach(instaimages, function(image) {
          if (images.length >= count) {
            return;
          }

          if (hashtags.length > 0) {
            for (var i = 0, l = image.tags.length; i < l; i++) {
              if (hashtags.indexOf(image.tags[i]) !== -1) {
                images.push(image);
                return;
              }
            }
          } else {
            images.push(image);
          }
        });

        if (images.length < count) {
          return fetch(data.pagination.next_url + '&callback=JSON_CALLBACK', hashtags, count, images, (triesLeft - 1));
        }

        return images;
      });
    };

    return {
      fetch: fetch,
    };
  }])

.directive('instalist', ['Defaults',
  function (Defaults) {
    return {
      scope: {
        source: '@',
        accessToken: '@',
        hashtags: '@',
        count: '@',
        size: '@',
        aClass: '@',
        imgClass: '@',
      },
      controller: 'instalistCtrl as ctrl',
      bindToController: true,
      template: Defaults.containerTemplate,
    };
  }])

.controller('instalistCtrl', ['$log', 'Defaults', 'Fetcher',
  function ($log, Defaults, Fetcher) {
    var ctrl = this;

    // Check settings.
    ctrl.source = '' + (ctrl.source || Defaults.source);
    ctrl.accessToken = ctrl.accessToken || Defaults.accessToken;
    ctrl.count = parseInt(ctrl.count || Defaults.count, 10);
    ctrl.realSize = ctrl.size || Defaults.size;

    if (ctrl.hashtags === '') {
      ctrl.hashtags = [];
    } else {
      ctrl.hashtags = (ctrl.hashtags || Defaults.hashtags).split(',').map(function (t) {
        return t.trim();
      });
    }

    if (!ctrl.source) {
      $log.error('Source needs to be provided.');
      return;
    }

    if (!ctrl.accessToken) {
      $log.error('access-token needs to be provided.');
      return;
    }

    if (ctrl.count <= 0) {
      // No need to fetch things if we ain't showing them.
      return;
    }

    switch (ctrl.size) {
      case 'standard':
        ctrl.realSize = ctrl.size + '_resolution';
        break;
      case 'low':
        ctrl.realSize = ctrl.size + '_resolution';
        break;
      case 'thumbnail':
      case 'standard_resolution':
      case 'low_resolution':
        ctrl.realSize = ctrl.size;
        break;
      default:
        throw new Error('Size provided is wrong.');
    }

    var url = (ctrl.source[0] === '#' ? Defaults.hashUrl : Defaults.userUrl)
      .replace('{SOURCE}', ctrl.source)
      .replace('{ACCESS_TOKEN}', ctrl.accessToken)
      .replace(/#/g, '');

    // Fetch and place images in the scope.
    Fetcher.fetch(url, ctrl.hashtags, ctrl.count)
    .then(function (images) {
      ctrl.Images = images;
    });
  }])

; // End the chain of oppression.
