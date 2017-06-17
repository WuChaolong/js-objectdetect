window.onload = function() {
		
		var smoother = new Smoother([0.9999999, 0.9999999, 0.999, 0.999], [0, 0, 0, 0]),
			video = document.getElementById('video'),
			eye = document.getElementById('eye'),
			eyelid = document.getElementById('eyelid'),
			detector,exact=[],helpX,helpY;
				
		try {
			compatibility.getUserMedia({video: true}, function(stream) {
				try {
					video.src = compatibility.URL.createObjectURL(stream);
				} catch (error) {
					video.src = stream;
				}
				compatibility.requestAnimationFrame(play);
			}, function (error) {
				alert('WebRTC not available');
			});
		} catch (error) {
			alert(error);
		}
		
		function play() {
			var coords,eyescenter,coord,width,height,msg,x,y;
			compatibility.requestAnimationFrame(play);
			if (video.paused) video.play();
          	
			if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
	          	
	          	// Prepare the detector once the video dimensions are known:
	          	if (!detector) {
		      		width = ~~(60 * video.videoWidth / video.videoHeight);
					height  =60;
		      		detector = new objectdetect.detector(width, height, 1.1, objectdetect.frontalface);
		      	}
          		
          		// Perform the actual detection:
				var coords = detector.detect(video, 1);
				if (coords[0]) {
					coord = coords[0];
					if(exact.length<3){
						exact.push(coord);
						return;
					}
					exact = exact.sort();
					coord = exact[1];
					exact = [];
					coord = smoother.smooth(coord);
					
					// Rescale coordinates from detector to video coordinate space:
					coord[0] *= video.videoWidth / detector.canvas.width;
					coord[1] *= video.videoHeight / detector.canvas.height;
					coord[2] *= video.videoWidth / detector.canvas.width;
					coord[3] *= video.videoHeight / detector.canvas.height;
					
                    eyescenter = [coord[0]+coord[2]/2,coord[1] + coord[3]/(2/8*10)];
                    x = (video.videoWidth/2-eyescenter[0]);
                    y = (eyescenter[1]-video.videoHeight/2);
                    eye.style.transform='translate('+x+'px,'+0||y+'px)';
					eyelid.style.display = "none";
//                     console.log(eyescenter);
					console.log(0.5*x/video.videoWidth+","+0.5*y/video.videoHeight);

                    if(typeof Android === 'object'){
						x = 0.5*x/video.videoWidth;
						y = 0.5*y/video.videoHeight;
						if(!helpX||(x<0?-x:x)<(helpX<0?-helpX:helpX)-0.02){
							helpX = x;
                    		Android.turnHead(x,y);
						}
                    }
				} else {
					eyelid.style.display = "block";
                    console.log("can't see you!");
                    exact = [];
				}

				coords=eyescenter=coord=width=height=msg=null;
			}
		}
	};
