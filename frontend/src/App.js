import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import SessionForm from "@/pages/SessionForm";
import SessionDetail from "@/pages/SessionDetail";
import Summary from "@/pages/Summary";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions/new" element={<SessionForm />} />
          <Route path="/sessions/:id/edit" element={<SessionForm />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/summary/:id" element={<Summary />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
