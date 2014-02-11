var CMProtocol = {
  init: function(myInfo){
    this.myInfo = myInfo;
    this.discoverTtl = 4;
    this.updateTtl = 6;
    this.discoverHopLimit = 10;
    this.initialConnectCount = 2;
    this.initialConnectTimeout = 3000;
    this.discoverTimeout = null;
    this.bootstrapServer = 'wss:machine.palava.tv';
    this.stunServer = 'stun:stun.palava.tv';
    this.activePeers = {};
    this.potentialPcs = {};
    this.knownPeers = {};
    this.routing = {};
    this.startDiscover = false;
    this.chunkLength = 1000;
    this.chunks = {};
    this.seenMessageIds = [];
  },

  joinNetwork: function(cb){
    var that = this;
    this.connectToServer(function(peerList, myId){
      that.myId = myId;
      that.myInfo.id = myId;
      var randomPeer = _.sample(peerList);
      if(randomPeer){
        that.startDiscover = true;
        console.log('### Start Connecting To a Peer via Server ###')
        randomPeer.on('dc_open', function(dc){
          that.addActivePeer(randomPeer.id, randomPeer.peerConnection, dc);
          that.discoverInterval = setInterval(function(){
            if(dc.readyState == 'open' && that.startDiscover){
              that.startDiscover = false
              clearInterval(that.discoverInterval);
              that._send(randomPeer.id, that.createDiscoverRequest());
              setTimeout( function(){
                //console.log('kp', that.knownPeers);
                // channel.close(); // disconnect from server, but need to keep some for bootstrapping
                _.each(_.sample(that.knownPeers, that.initialConnectCount), function(peer){
                  if(!that.activePeers[peer.id]){
                    that.connectToPeer(peer.id);
                  }
                });
              }, that.initialConnectTimeout);
            }
          }, 100);
          cb();
        });
        randomPeer.sendOffer();
      } else {
        that.startDiscover = false;
        console.log('Sorry, no other peer found!');
        cb();
      }
    });
  },

  registerUpdateCallback: function(cb){
    this.updateCallback = cb;
  },

  registerPeerInfoUpdateCallback: function(cb){
    this.peerInfoUpdateCallback = cb;
  },

  registerChatMessageCallback: function(cb){
    this.chatMessageCallback = cb;
  },

  connectToServer: function(cb){
    var that = this;
    var channel = new palava.WebSocketChannel(this.bootstrapServer);
    channel.on('open', function(){
      var rtc = new palava.Session({ channel: channel, roomId: 'w2w-test8' });
      rtc.userMedia = new palava.Gum({ audio: false, video: false, data: true });
      rtc.userMedia.requestStream = function(){ true } // FIXME

      rtc.on('room_joined', function(room){
        console.log('room joined with ' + (room.getAllPeers(false).length) + ' peers');
        console.log('my id:', room.localPeer.id)
        cb(room.getAllPeers(false), room.localPeer.id);
      });

      rtc.on('peer_dc_open', function(palavaPeer, dc){
        that.addActivePeer(palavaPeer.id, palavaPeer.peerConnection, dc);
        // that.updatePeerInfo(peer.id, null);
        //console.log('startDiscover', that.startDiscover);
      });

      rtc.on('peer_dc_close', function(peer){
        that.updatePeerInfo(peer.id, null);
      }),

      rtc.on('peer_dc_message', function(peer, rawMessage){
         // console.log('peer', peer.id, $scope.getPeerById(peer.id), $scope.getActivePeers())
        that._receive(peer.id, rawMessage);
      });

      rtc.init({ options: { stun: that.stunServer, joinTimeout: 500 } });
      rtc.room.join();
    });
  },

  addActivePeer: function(peerId, pc, dc){
    //console.log('active peer added', peerId)
    this.activePeers[peerId] = { dc: dc, pc: pc };
  },

  connectToPeer: function(peerId){
    console.log('### Start Connecting To Peer', peerId, '###')
    var pc = this.createPeerConnection(peerId);
    this.createDataChannel(
      peerId, pc, pc.createDataChannel(guid(), {reliable: false})
    );
    pc.createOffer(
      this.connectionSdpSender(peerId, 'offer'), null, palava.browser.getConstraints()
    );
  },

  createPeerConnection: function(peerId){
    var that = this;
    pc = this.potentialPcs[peerId] = new palava.browser.PeerConnection(
      {
        iceServers: [{url: this.stunServer}],
      },
      palava.browser.getPeerConnectionOptions()
    );

    pc.onicecandidate = function(event){
      if(event.candidate){
        that.routeMessage(peerId, {
          _event: 'connect',
          _type: 'ice',
          toId: peerId,
          senderId: that.myId,
          sdpmlineindex: event.candidate.sdpMLineIndex,
          sdpmid: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      }
    }

    pc.ondatachannel = function(event){
      that.createDataChannel(peerId, pc, event.channel);
    }

    return pc;
  },

  createDataChannel: function(peerId, pc, dc){
    var that = this;
    dc.onopen = function(){
      console.log('yay! a new peer to peer connection has been established!')
      that.addActivePeer(peerId, pc, dc);
      that.updateCallback();
    }

    dc.onmessage = function(peer, rawMessage){
      that._receive(peerId, rawMessage);
    }

    dc.onclose = function(){
      that.updatePeerInfo(peerId, null);
    }
  },

  verifyMessageId: function(messageId){
    if(_.contains(this.seenMessageIds, messageId)){
      return false;
    } else {
      this.seenMessageIds.concat(messageId);
      return true;
    }
  },

  createDiscoverRequest: function(){
    return {
      _event: 'discoverRequest',
      messageId: guid(),
      senderId: this.myId,
      senderInfo: this.myInfo,
      ttl: this.discoverTtl,
      hops: 0,
    };
  },

  createDiscoverResponse: function(toId){
    return {
      _event: 'discoverResponse',
      messageId: guid(),
      toId: toId,
      senderId: this.myId,
      senderInfo: this.myInfo,
    };
  },

  createSendUpdateRequest: function(){
    return {
      _event: 'update',
      messageId: guid(),
      senderId: this.myId,
      senderInfo: this.myInfo,
      ttl: this.updateTtl,
      hops: 0
    };
  },

  sendUpdate: function(user){
    this.myInfo.coords = user.coords;
    this.myInfo.location = user.location;
    this.floodMessage(this.createSendUpdateRequest());
  },

  updatePeerInfo: function(peerId, peerInfo){
    //console.log('info update', peerId, peerInfo)
    if(!peerInfo){
      delete this.knownPeers[peerId];
      delete this.activePeers[peerId];
    } else {
      this.knownPeers[peerId] = peerInfo;
    }
    this.peerInfoUpdateCallback(peerId, peerInfo);
  },

  floodMessage: function(data, exceptId){
    var that = this;
    //console.log('flooding message', data, exceptId)
    newTtl = parseInt(data.ttl) - 1;
    newHops = parseInt(data.hops) + 1;

    if(newTtl >= 0 && newHops < this.discoverHopLimit){
      //console.log('message allowd')
      data.ttl = newTtl;
      data.hops = newHops;
      _.each(_.keys(this.activePeers), function(peerId){
        if(peerId != exceptId){
          //console.log('actually sending to', peerId, data);
          that._send(peerId, data);
        }
      });
    }
  },

  routeMessage: function(toId, data){
    var nextId;
    //console.log('supposed to route to', toId)
    //console.log('data', data)
    //console.log('my routing table', this.routing)
    //console.log('my active peers', this.activePeers)

    if (this.activePeers[toId])
      nextId = toId;
    else
      nextId = this.routing[toId];

    this._send(nextId, data);
  },

  sendChatMessage: function(toId, message){
    var data = {
      _event: 'chat_message',
      message: message
    }

    this._send(toId, data);
  },

  connectionSdpSender: function(peerId, which){
    var that = this;
    return function(sdp){
      sdp = palava.browser.patchSDP(sdp);
      that.potentialPcs[peerId].setLocalDescription(sdp);
      that.routeMessage(peerId, {
        _event: 'connect',
        _type: which,
        toId: peerId,
        senderId: that.myId,
        sdp: sdp,
      });
    }
  },

  connectionEvent: function(type, data){
    //console.log('connection event')
    pc = this.potentialPcs[data.senderId];

    switch(type){
      case 'offer':
        pc = this.potentialPcs[data.senderId] = this.createPeerConnection(data.senderId);
        pc.setRemoteDescription(new palava.browser.SessionDescription(data.sdp));
        pc.createAnswer(
          this.connectionSdpSender(data.senderId, 'answer'), null, palava.browser.getConstraints()
        );
        break;

      case 'answer':
        pc.setRemoteDescription(
          new palava.browser.SessionDescription(data.sdp)
        );
        break;

      case 'ice':
        candidate = new palava.browser.IceCandidate(
          { candidate: data.candidate, sdpMLineIndex: data.sdpmlineindex, sdpMid: data.sdpmid }
        );
        pc.addIceCandidate(candidate);
        break;
    }
  },

  disconnectFromPeer: function(peerId){
    this.activePeers[peerId].pc.close(); // NOTE: DC Close also triggers removement from known_peers as well
    delete this.activePeers[peerId];
    this.updateCallback();
  },

  updateRouting: function(toId, viaId){
    //console.log('update routing', toId, viaId)
    this.routing[toId] = viaId;
  },

  _send: function(whom, data, chunked){
    console.log("_send", data);
    var dc = this.activePeers[whom].dc;
    if(chunked){
      var rawData = data;
    } else {
      var rawData = JSON.stringify(data);
    }
    var dataTooLong = rawData.length > this.chunkLength;

    if(chunked || dataTooLong) {
      var chunkedData = {};
      chunkedData.chunk = rawData.slice(0, this.chunkLength); // getting chunk using predefined chunk length
      chunkedData.chunked = true;
      dc.send(JSON.stringify(chunkedData));
      if(dataTooLong){
        this._send(whom, rawData.slice(this.chunkLength), true);
      }
    } else {
      try{
        dc.send(rawData);
      } catch(e) {
        //console.log('ignoring failed dc.send')
        // setTimeout(function(){
        //   dc.send(rawData);
        // }, 100)
      }
    }
  },

  _receive: function(fromId, json){
    if(!json){
      //console.log('ignoring empty message from', fromId);
      return;
    }
    data = JSON.parse(json);

    if(data.chunked){
      if(!this.chunks[fromId]){ this.chunks[fromId] = [] }
      this.chunks[fromId].push(data.chunk)
      if(data.chunk.length < this.chunkLength){ // last chunk
        data = JSON.parse(this.chunks[fromId].join(''));
        this.chunks[fromId] = [];
      } else {
        return; // chunk not complete
      }
    }

    console.log('_receive', data)
    switch(data._event){
      case 'discoverRequest':
        if(this.verifyMessageId(data.messageId)){
          this.updatePeerInfo(data.senderId, data.senderInfo);
          this.updateRouting(data.senderId, fromId);
          this.routeMessage(data.senderId, this.createDiscoverResponse(data.senderId));
          this.floodMessage(data, fromId);
        }
        break;

      case 'discoverResponse':
        this.updatePeerInfo(data.senderId, data.senderInfo);
        this.updateRouting(data.senderId, fromId);
        if (data.toId !== this.myId){
          this.routeMessage(data.toId, data);
        }
        break;

      case 'update':
        if(this.verifyMessageId(data.messageId)){
          this.updatePeerInfo(data.senderId, data.senderInfo);
          this.floodMessage(data, fromId);
        }
        break;

      case 'connect':
        if(data.toId === this.myId){
          this.connectionEvent(data._type, data);
        } else {
          this.routeMessage(data.toId, data);
        }
        break;

      case 'chat_message':
        this.chatMessageCallback(fromId, data.message);
        break;
    }
  },
}
;
