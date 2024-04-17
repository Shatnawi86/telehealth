"use strict";
let fdfdf = {
    iceServers: [{ urls: ["stun:fr-turn3.xirsys.com"] },
    {
        username: "XoaybMtMRo-GgRygKf8mijClFZF3xx2Oga6NmlX0OEB3h0N1Mnm0C_vnQmIy0eIEAAAAAGVafBRtb2hhZDg2",
        credential: "717a3f3c-8721-11ee-acaa-0242ac120004",
        urls: ["turn:fr-turn3.xirsys.com:80?transport=udp", "turn:fr-turn3.xirsys.com:3478?transport=udp",
            "turn:fr-turn3.xirsys.com:80?transport=tcp", "turn:fr-turn3.xirsys.com:3478?transport=tcp",
            "turns:fr-turn3.xirsys.com:443?transport=tcp", "turns:fr-turn3.xirsys.com:5349?transport=tcp"],
        iceTransportPolicy: 'all',
    }]
};
const peerConn = new RTCPeerConnection(fdfdf);
const _hub = new signalR.HubConnectionBuilder().withUrl("/videoHub").withAutomaticReconnect().build();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let channel;
let localStream;
let remoteStream;
let Initiator;
let hasRoomJoined = false;
var lockResolver;

if (navigator && navigator.locks && navigator.locks.request) {
    const promise = new Promise((res) => {
        lockResolver = res;
    });

    navigator.locks.request('sigLockDrag_3790', { mode: "shared" }, () => {
        return promise;
    });
}
function test() {
    _hub.invoke("CreateChannel", "dragon").catch(function (err) {
        return console.error(err.toString());
    });
}
function testJoin() {
    _hub.invoke("Join", "dragon").catch(function (err) {
        return console.error(err.toString());
    });
}
async function startHub() {
    try {
        InitVideoDevice();
        await _hub.start();
        console.assert(_hub.state === signalR.HubConnectionState.Connected);
        console.log("SignalR Connected.");
    } catch (error) {
        console.assert(_hub.state === signalR.HubConnectionState.Disconnected);
        console.log(error);
        setTimeout(() => startHub(), 5000);
    }
};
startHub();
_hub.onclose(async () => {
    await startHub();
});
_hub.onreconnected(connectionId => {
    console.assert(_hub.state === signalR.HubConnectionState.Connected);
    console.warn(`Connection reestablished. Connected with connectionId "${connectionId}".`);
});
_hub.on("created", function (_channel) {
    console.log('Channel created', _channel);
    hasRoomJoined = true;
    channel = _channel;
    Initiator = true;
});

_hub.on("joined", function (_channel) {
    console.log('This peer has joined channel', _channel);
    channel = _channel;
    Initiator = false;
});

_hub.on("ready", function () {
    console.log('Socket is ready');
    hasRoomJoined = true;
    createPeerCon();
});

_hub.on("message", function (message) {
    console.log('Client received message:', message);
    OnChannelMessage(message);
});

_hub.on("Leave", function () {
    console.log(`Peer leaving channel.`);
});

_hub.onreconnecting(error => {
    console.assert(_hub.state === signalR.HubConnectionState.Reconnecting);
    console.error(`Connection lost due to error "${error}". Reconnecting.`);
});

 
window.addEventListener('unload', function () {
    if (hasRoomJoined) {
        console.log(`Unloading window. Notifying peers in ${channel}.`);
        _hub.invoke("Leave", channel).catch(function (error) {
            console.error(error);
        });
    }
});

function Send(message) {
    console.log('Client sending message: ', message);
    _hub.invoke("SendMessage", channel, message).catch(function (err) {
        return console.error(err.toString());
    });
}
function InitVideoDevice() {
    console.log('Getting user media...');
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    }).then(function (stream) {
        console.log('Getting user stream', stream);
        localStream = stream;
        peerConn.addStream(localStream);
        localVideo.srcObject = stream;
    }).catch(function (error) {
        console.error(error);
    });
}

function OnChannelMessage(message) {
    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {
            // Success callback
        }, function (error) {
            console.error('Error setting remote description:', error);
        });
        peerConn.createAnswer(OnSessionCreated, function (error) {
            console.error('Error creating answer:', error);
        });
    } else if (message.type === 'answer') {
        console.log('Got answer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {
            // Success callback
        }, function (error) {
            console.error('Error setting remote description:', error);
        });

    } else if (message.type === 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({candidate: message.candidate}));
    }
}

function createPeerCon() {
    console.log('Creating Peer _hub as initiator?', Initiator);

    // send any ice candidates to the other peer
    peerConn.onicecandidate = function (event) {
        console.log('icecandidate event:', event);
        if (event.candidate) {
            // Trickle ICE
            //Send({
            //    type: 'candidate',
            //    label: event.candidate.sdpMLineIndex,
            //    id: event.candidate.sdpMid,
            //    candidate: event.candidate.candidate
            //});
        } else {
            console.log('End of candidates.');
            // Vanilla ICE
            Send(peerConn.localDescription);
        }
    };

    peerConn.ontrack = function (event) {
        console.log('icecandidate ontrack event:', event);
        remoteVideo.srcObject = event.streams[0];
    };

    if (Initiator) {
        console.log('Creating an offer');
        peerConn.createOffer(OnSessionCreated, (error) => {
            console.error('Error creating offer:', error);
        });
    } 
}

function OnSessionCreated(desc) {
    console.log('local session created:', desc);
    peerConn.setLocalDescription(desc, function () {
        // Trickle ICE
        //console.log('sending local desc:', peerConn.localDescription);
        //Send(peerConn.localDescription);
    }, function (error) {
            console.error('Error setting local description:', error);
    });
}


