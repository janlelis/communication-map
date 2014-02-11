# Communication Map

A very simple WebRTC based p2p network for location sharing.


## Usage
- Open build/index.html with a chrome browser


## Features

- Displays positions of other peers on a map
- Allows you to establish a chat connection to any peer in the network


## Details

- Unstructured overlay, no DHT or anything other fancy
- Other peers are used as "signaling channel" using data channels
- Uses the [palava.tv](https://palava.tv) server for bootstrapping, but this could also be
  done manually or with other servers
- Don't treat the connectios as secure. Other peers can see your cryptographic secrets
  when establishinig a new connection via there data channels


## A project for "Peer-to-Peer Systems" at Humboldt-Universität zu Berlin

Copyright (c) 2014 Daniel Borchart
Copyright (c) 2014 Jan Lelis

MIT License.
