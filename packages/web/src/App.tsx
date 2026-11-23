import { useEffect, useState } from "react";
import { socket } from "./socket";

export function App() {
  const [status, setStatus] = useState("conectando...");

  useEffect(() => {
    socket.on("connect", () => setStatus("conectado ao servidor"));
    socket.on("disconnect", () => setStatus("desconectado"));
    socket.connect();
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 grid place-items-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">War II Online</h1>
        <p className="mt-2 text-slate-400">{status}</p>
      </div>
    </main>
  );
}
