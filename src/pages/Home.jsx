import bannerBg from "/videobg.jpg";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    if (!name.trim()) {
      setError("Please enter your name to create a room.");
      return;
    }
    setError("");
    const room = "room-" + Math.floor(Math.random() * 10000);
    navigate(`/videocall/${room}`, { state: { name } });
  };

  const handleJoinExisting = () => {
    if (!name.trim()) {
      setError("Please enter your name to join a room.");
      return;
    }
    const room = prompt("Enter Room ID:");
    if (room) {
      setError("");
      navigate(`/videocall/${room}`, { state: { name } });
    }
  };

  return (
    <>
      <section className="py-20">
        <div className="container">
          <div className="flex items-center -mx-4 flex-wrap">
            <div className="w-full px-4 xl:w-1/2">
              <div className="max-w-96">
                <h1 className="text-4xl text-black font-bold mb-5">
                  Video calls and meetings for everyone
                </h1>
                <p className="text-base text-gray-600 mb-4">
                  Connect, collaborate and celebrate from anywhere with VideoCL
                </p>
                <input
                  type="text"
                  className="w-full h-11 bg-white border border-solid border-site px-3 py-2 rounded-sm focus:outline-0"
                  placeholder="Enter Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                <div className="flex gap-3.5 mt-6">
                  <button
                    className="bg-site text-white px-4 py-2 rounded cursor-pointer"
                    onClick={handleJoin}
                  >
                    Create Room
                  </button>
                  <button
                    className="bg-black text-white px-4 py-2 rounded cursor-pointer"
                    onClick={handleJoinExisting}
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full px-4 xl:w-1/2">
              <img src={bannerBg} className="w-full block" alt="bg" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
