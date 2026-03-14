import { useState, useCallback } from "react";
import type { PlayerState, Channel } from "@/types";

const initialState: PlayerState = {
  isOpen: false,
  url:    null,
  title:  null,
  logo:   null,
};

export function usePlayer() {
  const [player, setPlayer] = useState<PlayerState>(initialState);

  const playChannel = useCallback((channel: Channel) => {
    setPlayer({
      isOpen: true,
      url:    channel.url,
      title:  channel.name,
      logo:   channel.logo || null,
    });
  }, []);

  const playStream = useCallback((url: string, title: string, logo?: string) => {
    setPlayer({ isOpen: true, url, title, logo: logo ?? null });
  }, []);

  const closePlayer = useCallback(() => {
    setPlayer(initialState);
  }, []);

  return { player, playChannel, playStream, closePlayer };
}
