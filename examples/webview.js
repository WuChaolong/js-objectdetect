function webview(){
	var ws = new WebSocket('wss://' + 'kms.searchandmap.com:8443' + '/cast');
            var video;
            var webRtcPeer;
            var sessionID;
            var videoSource;
            var devices = Array();
            var selectedDeviceIndex = 0;
			var smoother,
				video,
				eye,
				eyelid,
				detector;
            window.onload = function () {
            	smoother = new Smoother([0.9999999, 0.9999999, 0.999, 0.999], [0, 0, 0, 0]),
				video = document.getElementById('video'),
				eye = document.getElementById('eye'),
				eyelid = document.getElementById('eyelid'),
				detector;
                video = document.getElementById('video');
                
                //Get Devices
                navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
                
                //Strat Local Preview
                startLocal();
            };

            window.onbeforeunload = function () {
                stopLocal();
                stop();
                ws.close();
            };

            ws.onopen = function (e) {
                console.log("Connection established!");
            };

            ws.onmessage = function (message) {
                var parsedMessage = JSON.parse(message.data);
                console.info('Received message: ' + message.data);

                switch (parsedMessage.id) {
                    case 'presenterResponse':
                        presenterResponse(parsedMessage);
                        break;
                    case 'stopCommunication':
                        dispose();
                        break;
                    case 'iceCandidate':
                        webRtcPeer.addIceCandidate(parsedMessage.candidate);
                        break;
                    case 'viewersCount':
                        console.info("Viewers Count is " + parsedMessage.count);
                        Android.viewersCountDidChange(parsedMessage.count);
                        break;
                    default:
                        console.error('Unrecognized message', parsedMessage);
                }
            };

            function presenterResponse(message) {
                if (message.response !== 'accepted') {
                    var errorMsg = message.message ? message.message : 'Unknow error';
                    console.warn('Call not accepted for the following reason: ' + errorMsg);
                    dispose();
                } else {
                    webRtcPeer.processAnswer(message.sdpAnswer);
                }
            }

            function onOfferPresenter(error, offerSdp) {
                if (error)
                    return onError(error);

                var message = {
                    id: 'presenter',
                    sdpOffer: offerSdp,
                    session: sessionID
                };
                sendMessage(message);
            }

            function onIceCandidate(candidate) {
                console.log('Local candidate' + JSON.stringify(candidate));

                var message = {
                    id: 'onIceCandidate',
                    candidate: candidate
                };
                sendMessage(message);
            }

            function stopStream() {
                if (webRtcPeer) {
                    var message = {
                        id: 'stop'
                    };
                    sendMessage(message);
                    dispose();
                }
            }

            function dispose() {
                if (webRtcPeer) {
                    webRtcPeer.dispose();
                    webRtcPeer = null;
                }
            }

            function sendMessage(message) {
                var jsonMessage = JSON.stringify(message);
                console.log('Senging message: ' + jsonMessage);
                ws.send(jsonMessage);
            }

            function startStream(sid) {
                stopLocal();
                
                sessionID = sid;

                if (!webRtcPeer) {
                    var options = {
                        localVideo: video,
                        onicecandidate: onIceCandidate,
                        mediaConstraints: {
                            audio: true,
                            video: {deviceId: videoSource ? {exact: videoSource} : undefined}
                        }
                    };

                    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
                        if (error)
                            return onError(error);

                        this.generateOffer(onOfferPresenter);
                    });
                }
            }

            function startLocal() {
                stopLocal();
                var constraints = window.constraints = {
                    audio: false,
                    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
                };
                navigator.mediaDevices.getUserMedia(constraints).
                        then(handleSuccess).catch(handleError);
                compatibility.requestAnimationFrame(play);

            }

            function stopLocal() {
                if (window.stream) {
                    window.stream.getTracks().forEach(function (track) {
                        track.stop();
                    });
                }
            }

            function handleSuccess(stream) {
                var videoTracks = stream.getVideoTracks();
                console.log('Got stream with constraints:', constraints);
                console.log('Using video device: ' + videoTracks[0].label);
                stream.oninactive = function () {
                    console.log('Stream inactive');
                };
                window.stream = stream; // make variable available to browser console
                video.srcObject = stream;
            }

            function handleError(error) {
                if (error.name === 'ConstraintNotSatisfiedError') {
                    errorMsg('The resolution ' + constraints.video.width.exact + 'x' +
                            constraints.video.width.exact + ' px is not supported by your device.');
                } else if (error.name === 'PermissionDeniedError') {
                    errorMsg('Permissions have not been granted to use your camera and ' +
                            'microphone, you need to allow the page access to your devices in ' +
                            'order for the demo to work.');
                }
                errorMsg('getUserMedia error: ' + error.name, error);
            }

            function errorMsg(msg, error) {
                console.error(msg + '' + error);
            }
            
            function gotDevices(deviceInfos) {
                 for (var i = 0; i !== deviceInfos.length; ++i) {
                     var deviceInfo = deviceInfos[i];
                     var deviceId = deviceInfo.deviceId;
                     if (deviceInfo.kind === 'videoinput'){
                         devices.push(deviceId);
                     }
                 }
            }
            
            function switchCamera(){
                if(devices.length > 1){
                    selectedDeviceIndex = (selectedDeviceIndex === 0) ? 1 : 0;
                    videoSource = devices[selectedDeviceIndex];
                    startLocal();
                }
            }
            function play() {
				compatibility.requestAnimationFrame(play);
				if (video.paused) video.play();

				if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {

					// Prepare the detector once the video dimensions are known:
					if (!detector) {
						var width = ~~(60 * video.videoWidth / video.videoHeight);
						var height  =60;
						detector = new objectdetect.detector(width, height, 1.1, objectdetect.frontalface);
					}

					// Perform the actual detection:
					var coords = detector.detect(video, 1);
					if (coords[0]) {
						var coord = coords[0];
						coord = smoother.smooth(coord);

						// Rescale coordinates from detector to video coordinate space:
						coord[0] *= video.videoWidth / detector.canvas.width;
						coord[1] *= video.videoHeight / detector.canvas.height;
						coord[2] *= video.videoWidth / detector.canvas.width;
						coord[3] *= video.videoHeight / detector.canvas.height;

						var eyescenter = [coord[0]+coord[2]/2,coord[1] + coord[3]/(2/8*10)];
						eye.style.transform='translate('+(video.videoWidth/2-eyescenter[0])+'px,'+0||(eyescenter[1]-video.videoHeight/2)+'px)';
						eyelid.style.display = "none";
						console.log(eyescenter);
						eyescenter = null;

					} else {
						eyelid.style.display = "block";
						console.log("can't see you!");
					}
					coords = null;
				}
			}
}