import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const INACTIVITY_LIMIT = 30 * 60 * 1000;

export default function IdleSessionTimeout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId;

    const logoutByInactivity = async () => {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        logoutByInactivity();
      }, INACTIVITY_LIMIT);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);

      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [navigate]);

  return null;
}