import React, { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const VideoCall = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const name = location.state?.name || "Guest";

  const localVideoRef = useRef(null);
  const videoWrapRef = useRef(null);

  const [joined, setJoined] = useState(false);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);
  const peerConnections = useRef({});
  const localStream = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });

  // Resize handler for dynamic video sizing
  const calculateVideoLayout = useCallback(() => {
    if (!videoWrapRef.current) return;
    const containerWidth = videoWrapRef.current.clientWidth;
    const containerHeight = videoWrapRef.current.clientHeight;
    const totalVideos = remoteStreams.length + 1;

    let columns = 1;
    if (totalVideos === 2) columns = 2;
    else if (totalVideos <= 4) columns = 2;
    else if (totalVideos <= 6) columns = 3;
    else columns = 4;

    const width = containerWidth / columns - 16;
    const height = width * 0.5625; // 16:9 aspect ratio

    setVideoDimensions({ width, height });
  }, [remoteStreams]);

  useEffect(() => {
    calculateVideoLayout();
    window.addEventListener("resize", calculateVideoLayout);
    return () => window.removeEventListener("resize", calculateVideoLayout);
  }, [remoteStreams, calculateVideoLayout]);

  useEffect(() => {
    // Join the room
    joinRoom();

    // When the current user joins, get list of existing users
    socket.on("all-users", ({ users }) => {
      users.forEach((userId) => {
        const pc = createPeerConnection(userId);
        peerConnections.current[userId] = pc;

        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          socket.emit("offer", { offer, to: userId });
        });
      });
    });

    // When another user joins after you
    socket.on("user-joined", ({ userId }) => {
      const pc = createPeerConnection(userId);
      peerConnections.current[userId] = pc;
    });

    // Existing signaling handlers
    socket.on("offer", async ({ offer, from }) => {
      const pc = createPeerConnection(from);
      peerConnections.current[from] = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { answer, to: from });
    });

    socket.on("answer", async ({ answer, from }) => {
      const pc = peerConnections.current[from];
      await pc?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", ({ candidate, from }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Handle disconnect
    socket.on("user-disconnected", (userId) => {
      const pc = peerConnections.current[userId];
      if (pc) {
        pc.close();
        delete peerConnections.current[userId];
      }

      setRemoteStreams((prev) =>
        prev.filter((stream) => stream.userId !== userId)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = async () => {
    try {
      setJoined(true);
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

      socket.emit("join-room", { roomId, name });
    } catch (err) {
      console.error("Media error:", err);
      alert("Allow camera and microphone access.");
    }
  };

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: import.meta.env.VITE_TWILIO_USERNAME,
          credential: import.meta.env.VITE_TWILIO_CREDENTIAL,
        },
      ],
    });

    // Add local tracks to the peer connection
    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current);
    });

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: userId,
          room: roomId,
        });
      }
    };

    // When remote stream arrives
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams((prev) => {
          const exists = prev.find((s) => s.id === stream.id);
          return exists ? prev : [...prev, stream];
        });
      }
    };

    return pc;
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("send-message", { message, room: roomId });
    setChat((prev) => [...prev, { sender: "me", message }]);
    setMessage("");
  };

  const toggleVideo = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoPaused(!track.enabled);
    }
  };

  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  const disconnectCall = () => {
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    localStream.current?.getTracks().forEach((track) => track.stop());
    socket.disconnect();
    window.location.href = "/";
  };

  const toggleChat = () => setShowChat(!showChat);

  return (
    <section className="h-dvh w-full bg-black text-white p-6 pb-26 relative">
      <div className="flex h-full gap-4">
        {/* Video Area */}
        <div
          ref={videoWrapRef}
          className={`transition-all duration-300 h-full ${
            showChat ? "w-3/4" : "w-full"
          } flex items-center justify-center`}
        >
          <div
            className={`w-full h-full ${
              remoteStreams.length === 0 && !showChat
                ? "flex items-center justify-center"
                : "flex flex-wrap justify-center gap-4 p-2 overflow-y-auto"
            }`}
          >
            {/* Local Video - Fullscreen if alone */}
            <div
              style={{
                width:
                  remoteStreams.length === 0
                    ? "100%"
                    : `${videoDimensions.width}px`,
                height:
                  remoteStreams.length === 0
                    ? "100%"
                    : `${videoDimensions.height}px`,
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="rounded creator size-full object-contain bg-black"
              />
            </div>

            {/* Remote Videos */}
            {remoteStreams.map((stream) => (
              <div
                style={{
                  width: `${videoDimensions.width}px`,
                  height: `${videoDimensions.height}px`,
                }}
              >
                <video
                  key={stream.id}
                  autoPlay
                  playsInline
                  className="rounded joinees size-full object-contain bg-black"
                  ref={(el) => {
                    if (el) el.srcObject = stream;
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        {showChat && (
          <div className="w-1/4 bg-gray-900 p-4 rounded-lg flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {chat.map((c, i) => (
                <p
                  key={i}
                  className={`text-sm ${c.sender === "me" ? "text-right" : ""}`}
                >
                  <span className="inline-block bg-gray-700 px-3 py-1 rounded-lg">
                    {c.message}
                  </span>
                </p>
              ))}
            </div>
            <div className="flex">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-gray-800 px-3 py-2 text-white rounded-l focus:outline-none"
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 px-4 rounded-r"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{name}</h2>
          <h4 className="text-sm">Room ID: {roomId}</h4>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleMute}
            className={`px-4 py-2 rounded cursor-pointer ${
              isMuted ? "bg-red-600" : "bg-green-700"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={toggleVideo}
            className={`px-4 py-2 rounded cursor-pointer ${
              isVideoPaused ? "bg-red-600" : "bg-blue-600"
            }`}
          >
            {isVideoPaused ? "Resume Video" : "Pause Video"}
          </button>
          <button
            onClick={disconnectCall}
            className="bg-red-700 px-4 py-2 rounded cursor-pointer"
          >
            Disconnect
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleChat}
            className="bg-gray-600 px-4 py-2 rounded cursor-pointer"
          >
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default VideoCall;
