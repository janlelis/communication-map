angular.module('cm').controller('ApplicationController', function($scope){
  ////
  // public functions
  $scope.init = function() {
    var query = window.location.search.substring(1);
    if (query.toLowerCase() == "fake")
      $scope.fake = true;

    //console.log("fake", $scope.fake);

    $scope.loadUserFromCookie();
    $scope.getInitialUserLocation();
  }

  $scope.saveUserInCookie = function(){
    document.cookie = $scope.user.name;
  };

  $scope.loadUserFromCookie = function(){
    if (document.cookie){ $scope.user.name = document.cookie };
  };

  $scope.getInitialUserLocation = function() {
    $scope.getUserCoords(function() {
      $scope.getUserLocation(function() {
        $scope.hasLocation = true;
        $scope.$apply();
        $scope.ncp = {}; angular.extend($scope.ncp, CMProtocol);
      });
    });
  }

  $scope.getUserCoords = function(callback) {
    navigator.geolocation.getCurrentPosition(function(position) {


      if ($scope.fake) {
        $scope.fakeRad += Math.PI / 10;

        $scope.user.coords = {
          latitude: position.coords.latitude + Math.sin($scope.fakeRad) * 0.001,
          longitude: position.coords.longitude + Math.cos($scope.fakeRad) * 0.001
        };
      } else {
        $scope.user.coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude };
      }

      if (callback)
        callback();
    },
    // error
    function() {
      $scope.user.coords = { };
    });
  }

  $scope.getUserLocation = function(callback){
    var geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng($scope.user.coords.latitude, $scope.user.coords.longitude);
    var locationName = "unknown address";

    geocoder.geocode({'latLng': latlng}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {

          for (var i=0; i<results.length; i++) {
            for (var b=0;b<results[i].types.length;b++) {

              if (results[i].types[b] == "street_address")
              {
                locationName = results[i].formatted_address;
                break;
              }

            }
          }

        }
      }

      $scope.user.location = locationName;

      if (callback)
        callback();
    });
  }

  $scope.sendChatMessage = function(peerId){
    if (!$scope.chatMessages[peerId])
      $scope.chatMessages[peerId] = [];

    $scope.chatMessages[peerId].unshift({
      "id" : $scope.user.id,
      "message" : $scope.user.new_message
    });

    $scope.ncp.sendChatMessage(peerId, $scope.user.new_message);
    $scope.user.new_message = "";
  }

  $scope.receiveChatMessage = function(fromId, message){
    if (!$scope.chatMessages[fromId])
      $scope.chatMessages[fromId] = [];

    $scope.chatMessages[fromId].unshift({
      "id": fromId,
      "message": message
    });

    $scope.chatWith = fromId;
    $scope.$apply();
  }

  $scope.join = function(){
    $scope.saveUserInCookie();
    $scope.ncp.init({
      name: $scope.user.name,
      coords: $scope.user.coords,
      location: $scope.user.location,
      color: $scope.user.color
    });

    $scope.ncp.registerUpdateCallback(function(){
      if(!$scope.$$phase){ $scope.$apply(); }
    });

    $scope.ncp.registerPeerInfoUpdateCallback(function(peerId, peerInfo){

      if (peerInfo) {
        if ($scope.markerExists(peerId))
          $scope.updateMapMarker(peerId, peerInfo.coords);
        else
          $scope.addMapMarker(peerId, peerInfo);
      } else {
        $scope.removeMapMarker(peerId);
      }

      $scope.$apply();
    });
    $scope.ncp.registerChatMessageCallback($scope.receiveChatMessage);

    $scope.ncp.joinNetwork(function(){
      $scope.user.id = $scope.ncp.myId;
      $scope.connected = true;

      $scope.addMapMarker(
        $scope.user.id,
        { coords: $scope.user.coords,
          name: $scope.user.name,
          color: $scope.user.color });

      $scope.updateCoordsInterval = window.setInterval($scope.updateUserCoords, $scope.updateCoordsIntervalTime);
      $scope.updateLocationInterval = window.setInterval($scope.updateUserLocation, $scope.updateLocationIntervalTime);

      $scope.$apply();
    });
  }

  $scope.updateMap = function() {
    if ($scope.map.markerModels.length < 2) {
      $scope.map.fitMarkers = false;

      var marker = $scope.map.markerModels[0];
      if (marker) {
        $scope.map.zoom = 16;
        $scope.map.center = {
          latitude: marker.latitude,
          longitude: marker.longitude
        };
      }

    } else {
      $scope.map.fitMarkers = true;
    }

    $scope.$apply();
  }

  $scope.markerIconUrl = function(color) {
    return "http://labs.google.com/ridefinder/images/mm_20_" + color + ".png";
  }

  $scope.markerExists = function(id) {
    return !!_.find($scope.map.markerModels, function(num) {
      return num.pid === id;
    })
  }

  $scope.addMapMarker = function(id, peerInfo) {
    $scope.map.markerModels.push({
      pid: id,
      latitude: peerInfo.coords.latitude,
      longitude: peerInfo.coords.longitude,
      options: {
        icon: $scope.markerIconUrl(peerInfo.color),
        title: peerInfo.name
      }
    });

    $scope.updateMap();
  }

  $scope.removeMapMarker = function(id) {
    for (var i=0; i<$scope.map.markerModels.length; i++) {
      if ($scope.map.markerModels[i].pid === id) {
        $scope.map.markerModels.splice(i, 1);
      }
    }

    $scope.updateMap();
  }

  $scope.updateMapMarker = function(id, coords) {
    for (var i=0; i<$scope.map.markerModels.length; i++) {
      if ($scope.map.markerModels[i].pid === id) {
        $scope.map.markerModels[i].latitude = coords.latitude;
        $scope.map.markerModels[i].longitude = coords.longitude;
        break;
      }
    }

    $scope.updateMap();
  }

  $scope.getActivePeers = function(){
    return _.map(_.keys($scope.ncp.activePeers), function(peerId){
      return $scope.ncp.knownPeers[peerId];
    });
  };

  $scope.isActive = function(peer){
    return _.contains(_.keys($scope.ncp.activePeers), peer.id);
  };

  $scope.getPeerById = function(id){
    if(id === $scope.user.id){
      return $scope.user;
    } else {
      return $scope.ncp.knownPeers[id];
    }
  };

  $scope.getInactivePeers = function() {
    return _.filter($scope.ncp.knownPeers, function(num) {
      return !_.contains($scope.ncp.activePeers, num);
    });
  }

  $scope.getKnownPeers = function(){
    return _.values($scope.ncp.knownPeers);
  }

  $scope.enableChat = function(peer) {
    $scope.chatWith = peer.id;
  }

  $scope.getChatMessagesFrom = function(peerId) {
    return $scope.chatMessages[peerId];
  }

  $scope.startVideo = function(peer){
    console.log('not implemented');
  }

  $scope.disconnectFromPeer = function(peer){
    $scope.ncp.disconnectFromPeer(peer.id);
  }

  $scope.connectToPeer = function(peer) {
    $scope.ncp.connectToPeer(peer.id);
  }

  $scope.distanceFromUser = function(peer){
    Math.sqrt(
      Math.pow(peer.coords.latitude - $scope.user.coords.latitude, 2) +
      Math.pow(peer.coords.longitude - $scope.user.coords.longitude, 2)
    )
  }

  $scope.updateUserCoords = function() {
    $scope.getUserCoords(function(){
      //console.log("UPDATE COORDS", $scope.user.coords);
      $scope.updateMapMarker($scope.user.id, $scope.user.coords);
      $scope.ncp.sendUpdate($scope.user);
    });
  }

  $scope.updateUserLocation = function() {
    $scope.getUserLocation(function(){
      //console.log("UPDATE LOCATION", $scope.user.location);
      $scope.ncp.sendUpdate($scope.user);
    });
  }

  ////
  // init

  $scope.mapMarkerColors = [ "gray", "green", "orange", "purple", "red", "white", "yellow", "black", "blue", "brown" ];

  $scope.user = {
    color: _.sample($scope.mapMarkerColors)
  };
  $scope.fake = false;
  $scope.fakeRad = 0;
  $scope.connected = false;
  $scope.hasLocation = false;
  $scope.updateCoordsIntervalTime = 5000;
  $scope.updateLocationIntervalTime = 30000;
  $scope.servers = [];
  $scope.chatWith = null;
  $scope.chatMessages = {};
  $scope.map = {
    center: {
      latitude: 0,
      longitude: 0
    },
    zoom: 0,
    markerModels: [],
    markers: 'self',
    fitMarkers: true,
    markerOptions: {
      visible: false
    }
  };

  $scope.init();
});