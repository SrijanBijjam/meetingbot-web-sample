// Wait for SDK to be ready
// NOTE: DOMContentLoaded listener moved below to combine with button initialization

function initializeZoomSDK() {
  ZoomMtg.setZoomJSLib('../node_modules/@zoom/meetingsdk/dist/lib', '/av');
  ZoomMtg.preLoadWasm();
  ZoomMtg.prepareWebSDK();
  // loads language files, also passes any error messages to the ui
  ZoomMtg.i18n.load('en-US');
  ZoomMtg.i18n.reload('en-US');
}

// Configuration variables - Update these with your actual values
var authEndpoint = "http://localhost:4000";  // Auth endpoint service URL
var zakEndpoint = "http://localhost:30015/api/zoom/hzak";
var meetingDetailsEndpoint = "http://localhost:30015/api/zoom/mnum";

// Required: Your Zoom Meeting SDK Key or Client ID
var sdkKey = "TofIrP6oT5S5IXEgAnt91g";

// Meeting details from the provided Zoom meeting
var meetingNumber = "9050809370";  // Meeting ID from the invitation

// Meeting password from the provided Zoom meeting
var passWord = "YRLvp6";  // Passcode from the invitation

// Required: 0 for participant, 1 for host
var role = 1;

// Required: Name for the user joining the meeting
var userName = "Web Bot";

// Required for Webinar, optional for Meeting
var userEmail = "";

// Required if your meeting or webinar requires registration
var registrantToken = "";

// Required to start meetings on external Zoom user's behalf
var zakToken = "";

// Required: URL the user is taken to once the meeting is over
var leaveUrl = "https://zoom.us";

var getlocalRecordingToken = "";

// Add state tracking to prevent multiple joins
var isJoining = false;
var isInMeeting = false;
var joinButton = null;

// Add cross-tab prevention using localStorage
var MEETING_KEY = 'zoom_bot_meeting_' + meetingNumber;

function checkIfAlreadyInMeeting() {
  var meetingState = localStorage.getItem(MEETING_KEY);
  if (meetingState) {
    try {
      var state = JSON.parse(meetingState);
      var now = Date.now();
      // Consider meeting active if state was set within last 10 minutes
      if (state.timestamp && (now - state.timestamp) < 600000) {
        isInMeeting = true;
        return true;
      } else {
        // Clear old state
        localStorage.removeItem(MEETING_KEY);
      }
    } catch (e) {
      localStorage.removeItem(MEETING_KEY);
    }
  }
  return false;
}

function setMeetingState(inMeeting) {
  if (inMeeting) {
    localStorage.setItem(MEETING_KEY, JSON.stringify({
      timestamp: Date.now(),
      inMeeting: true
    }));
  } else {
    localStorage.removeItem(MEETING_KEY);
  }
}

// Initialize button reference when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  joinButton = document.getElementById('join_meeting');
  
  // Check if already in meeting from another tab
  if (checkIfAlreadyInMeeting()) {
    console.log('Already in meeting (detected from another tab)');
  }
  
  updateButtonState();
  
  // Check if ZoomMtg is available
  if (typeof ZoomMtg !== 'undefined') {
    initializeZoomSDK();
  } else {
    // If not available, wait a bit and try again
    setTimeout(function() {
      if (typeof ZoomMtg !== 'undefined') {
        initializeZoomSDK();
      } else {
        console.error('ZoomMtg failed to load');
      }
    }, 1000);
  }
});

function updateButtonState() {
  if (!joinButton) return;
  
  if (isJoining) {
    joinButton.disabled = true;
    joinButton.textContent = 'Joining...';
    joinButton.style.backgroundColor = '#ccc';
  } else if (isInMeeting) {
    joinButton.disabled = true;
    joinButton.textContent = 'In Meeting';
    joinButton.style.backgroundColor = '#28a745';
  } else {
    joinButton.disabled = false;
    joinButton.textContent = 'Join Meeting';
    joinButton.style.backgroundColor = '#007bff';
  }
}

function getSignature() {
  // Prevent multiple simultaneous joins
  if (isJoining || isInMeeting) {
    console.log('Already joining or in meeting, ignoring click');
    return;
  }
  
  // Check cross-tab state
  if (checkIfAlreadyInMeeting()) {
    alert('Bot is already in this meeting from another tab/window');
    return;
  }
  
  isJoining = true;
  updateButtonState();
  
  // Check if all required variables are defined
  if (!authEndpoint) {
    console.error('authEndpoint is not defined');
    alert('Configuration error: Auth endpoint not set');
    isJoining = false;
    updateButtonState();
    return;
  }
  
  if (!meetingNumber) {
    console.error('meetingNumber is not defined');
    alert('Configuration error: Meeting number not set');
    isJoining = false;
    updateButtonState();
    return;
  }

  console.log('Requesting signature from:', authEndpoint);
  console.log('Meeting details:', { meetingNumber, role });

  fetch(authEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meetingNumber: meetingNumber,
      role: role
    })
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json()
  }).then((data) => {
    console.log('Signature received:', data)
    if (data.signature) {
      startMeeting(data.signature)
    } else {
      console.error('No signature in response:', data);
      alert('Failed to get meeting signature');
      isJoining = false;
      updateButtonState();
    }
  }).catch((error) => {
    console.error('Error getting signature:', error)
    alert('Failed to connect to auth service. Make sure it\'s running on port 4000.');
    isJoining = false;
    updateButtonState();
  })
}

function startMeeting(signature) {
  // Check if ZoomMtg is available
  if (typeof ZoomMtg === 'undefined') {
    console.error('ZoomMtg is not loaded');
    alert('Zoom SDK not loaded. Please refresh the page and try again.');
    isJoining = false;
    updateButtonState();
    return;
  }

  console.log('Starting meeting with signature:', signature.substring(0, 50) + '...');
  
  document.getElementById('zmmtg-root').style.display = 'block'

  ZoomMtg.init({
    leaveUrl: leaveUrl,
    disablePreview: true,
    patchJsMedia: true, // Add this for better compatibility
    success: (success) => {
      console.log('ZoomMtg.init success:', success)
      ZoomMtg.join({
        signature: signature,
        sdkKey: sdkKey,
        meetingNumber: meetingNumber,
        passWord: passWord,
        userName: userName,
        tk: registrantToken,
        zak: zakToken,
        success: handleJoinSuccess,
        error: handleJoinError,
      })
    },
    error: (error) => {
      console.error('ZoomMtg.init error:', error)
      alert('Failed to initialize Zoom SDK: ' + error.reason)
      isJoining = false;
      updateButtonState();
    }
  })
}

// ------------- Bot Helper functions ------------------//
function handleJoinAudioClick() {
  var buttonFound = false;

  var t = setInterval(function () {
    var startButton = document.getElementsByClassName(
      "join-audio-by-voip__join-btn"
    )[0];

    if (startButton && !startButton.disabled) {
      console.log("Frontend: button not found");
      buttonFound = true;
      startButton.click();
    }

    var startButton = document.getElementsByClassName(
      "join-audio-by-voip__join-btn"
    )[0];

    console.log("Frontend: button found");

    if (startButton == null && buttonFound) {
      clearInterval(t);
    }
  }, 500);
}

function handleDisableVideoClick() {
  var buttonFound = false;

  var startButton = document.getElementsByClassName(
    "send-video-container__btn"
  )[0];

  function handleClick() {
    if (startButton && !startButton.disabled) {
      console.log("Frontend: button not found");
      buttonFound = true;
      startButton.click();
      startButton.removeEventListener("click", handleClick);
    }
  }

  if (startButton) {
    startButton.addEventListener("click", handleClick);
    console.log("Video Button found");
  }
}

function handleJoinSuccess(success) {
  console.log(success, 'join meeting success');
  
  // Update state - successfully joined meeting
  isJoining = false;
  isInMeeting = true;
  setMeetingState(true);
  updateButtonState();

  // Not working has expected!
   handleJoinAudioClick();
   handleDisableVideoClick();

  // RECORDING DISABLED - Uncomment these lines to enable recording
  // startMediaCapturePermissionTimer();
  // setupMediaCaptureListeners();
}

function startMediaCapturePermissionTimer() {
  // RECORDING DISABLED - This function is disabled
  console.log('Recording functionality is disabled');
  return;
 
  setInterval(() => {
    requestMediaCapturePermission();
    console.log('pinging every 15 seconds');
  }, 15000);
}

function requestMediaCapturePermission() {
  ZoomMtg.mediaCapturePermission({
    operate: 'request',
    success: handleMediaCapturePermissionSuccess,
    error: handleMediaCapturePermissionError
  });
}

function handleMediaCapturePermissionSuccess(success) {
  console.log(success, 'media capture permission success');
  if (success.allow) {

    startMediaCapture();
    console.log('Media capture permission changed to ALLOW');
  } else {
    stopMediaCapture();
    console.log('Media capture permission changed to DENY');
    leaveMeetingAndHandleError();
  }
}

function handleMediaCapturePermissionError(error) {
  if (error.errorCode == '1') {
    console.log('Media capture permission Active');
    startMediaCapture();
  } else {
    console.log(error, 'media capture permission error');
  }
}

function startMediaCapture() {
  ZoomMtg.mediaCapture({ record: "start" });
}

function stopMediaCapture() {
  ZoomMtg.mediaCapture({ record: "stop" });
}
function pauseMediaCapture() {
  ZoomMtg.mediaCapture({ record: "pause" });
}

function leaveMeetingAndHandleError() {
  ZoomMtg.leaveMeeting({
    success: handleLeaveSuccess,
    error: handleLeaveError
  });
}

function handleLeaveSuccess(success) {
  console.log(success, 'Bot has left the meeting');
  
  // Update state - left meeting
  isInMeeting = false;
  setMeetingState(false);
  updateButtonState();
}

function handleLeaveError(error) {
  console.log(error, 'Bot failed to leave the meeting, use visibilityState of hidden to trigger leave');
  
  // Update state - assuming left meeting even on error
  isInMeeting = false;
  setMeetingState(false);
  updateButtonState();
  
  setupAccidentalLeaveListener(document, ZoomMtg);
}

function setupAccidentalLeaveListener(doc, zoom) {
  doc.addEventListener("visibilitychange", function() {
    if (doc.visibilityState === 'hidden') {
      zoom.leaveMeeting()
    }
  });
}

function setupMediaCaptureListeners() {
  ZoomMtg.inMeetingServiceListener('onMediaCapturePermissionChange', handleMediaCapturePermissionChange);
  ZoomMtg.inMeetingServiceListener('onMediaCaptureStatusChange', handleMediaCaptureStatusChange);
  ZoomMtg.inMeetingServiceListener('onUserLeave', handleUserLeave);
}

function handleMediaCapturePermissionChange({  allow: boolean }) {
  console.log('onMediaCapturePermissionChange --> ', boolean );
  if (boolean ) {
    startMediaCapture();
    console.log('Media capture permission changed to ALLOW');
  } else {
    console.log('Media capture permission changed to DENY');
    stopMediaCapture();
    leaveMeetingAndHandleError();
  }
}

function handleMediaCaptureStatusChange(data) {
  console.log('onMediaCaptureStatusChange --> ', data);
  const { status, userId } = data;
  
  console.log('onMediaCaptureStatusChange --> ', userId);
  // Add your logic for handling media capture status change here

  ZoomMtg.mute({ userId: userId, mute: true });
  
}

function handleUserLeave(data) {
  setupAccidentalLeaveListener(document, ZoomMtg);
  console.log(data, "Detected user left meeting, stopping recording");
}

function handleJoinError(error) {
  console.error('Meeting join error:', error);
  
  // Update state - failed to join
  isJoining = false;
  isInMeeting = false;
  updateButtonState();
  
  let errorMessage = 'Failed to join meeting';
  
  if (error && error.reason) {
    errorMessage += ': ' + error.reason;
  } else if (error && error.message) {
    errorMessage += ': ' + error.message;
  }
  
  alert(errorMessage);
}

//function to get the meeting number and passwork from the url
function getMeetingNumberAndPasswordFromUrl(url) {
  const splitUrl = url.split('?')[0];

  if (!splitUrl) {
    return {
      meetingNumber: null,
      password: null
    };
  }

  const meetingNumber = splitUrl.substring(splitUrl.lastIndexOf('/') + 1);

  const queryString = url.split('?')[1];
  const password = queryString ? queryString.split('pwd=')[1] : null;

  return {
    meetingNumber,
    password
  };
}