import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import VideoCall from "./components/VideoCall";
import Home from "./pages/Home";
import About from "./pages/About";
import NotFound from "./pages/Notfound";

const AppRoutes = () => {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith("/videocall");

  return (
    <>
      {!hideHeader && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/videocall/:roomId" element={<VideoCall />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
