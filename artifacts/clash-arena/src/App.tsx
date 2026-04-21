import { useState, useEffect } from "react";
import { getCurrentUsername } from "./utils/localStorageAPI";
import AuthPage from "./pages/AuthPage";
import MainMenu from "./pages/MainMenu";
import ModeSelect from "./pages/ModeSelect";
import CharacterSelect from "./pages/CharacterSelect";
import GameScreen from "./pages/GameScreen";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import SettingsPage from "./pages/SettingsPage";
import LoadingScreen from "./pages/LoadingScreen";

type Screen =
  | "auth"
  | "menu"
  | "modeSelect"
  | "characterSelect"
  | "game"
  | "collection"
  | "shop"
  | "settings";

export type GameMode = "showdown" | "crystals" | "siege" | "heist" | "gemgrab";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return getCurrentUsername() ? "menu" : "auth";
  });
  const [selectedMode, setSelectedMode] = useState<GameMode>("showdown");
  const [selectedBrawler, setSelectedBrawler] = useState("miya");
  const [bootLoading, setBootLoading] = useState(true);
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  const [transitionLabel, setTransitionLabel] = useState("ЗАГРУЗКА");

  useEffect(() => {
    document.title = "Clash Arena";
  }, []);

  const go = (s: Screen) => setScreen(s);

  // Animated transition with a loading screen
  const goWithLoad = (s: Screen, label = "ЗАГРУЗКА") => {
    setTransitionLabel(label);
    setTransitionTo(s);
  };

  if (bootLoading) {
    return <LoadingScreen onDone={() => setBootLoading(false)} duration={2600} label="ДОБРО ПОЖАЛОВАТЬ" />;
  }

  if (transitionTo) {
    return (
      <LoadingScreen
        label={transitionLabel}
        duration={1800}
        onDone={() => {
          const target = transitionTo;
          setTransitionTo(null);
          if (target) go(target);
        }}
      />
    );
  }

  if (screen === "auth") {
    return <AuthPage onAuth={() => go("menu")} />;
  }

  if (screen === "menu") {
    return (
      <MainMenu
        onPlay={() => go("modeSelect")}
        onCollection={() => go("collection")}
        onShop={() => go("shop")}
        onSettings={() => go("settings")}
        onLogout={() => {
          go("auth");
        }}
      />
    );
  }

  if (screen === "modeSelect") {
    return (
      <ModeSelect
        onSelect={(mode) => { setSelectedMode(mode); go("characterSelect"); }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "characterSelect") {
    return (
      <CharacterSelect
        mode={selectedMode}
        onStart={(id) => { setSelectedBrawler(id); goWithLoad("game", "ВХОД В АРЕНУ"); }}
        onBack={() => go("modeSelect")}
      />
    );
  }

  if (screen === "game") {
    return (
      <GameScreen
        mode={selectedMode}
        brawlerId={selectedBrawler}
        onExit={() => goWithLoad("menu", "ВОЗВРАТ В ЛОББИ")}
      />
    );
  }

  if (screen === "collection") {
    return <CollectionPage onBack={() => go("menu")} />;
  }

  if (screen === "shop") {
    return <ShopPage onBack={() => go("menu")} />;
  }

  if (screen === "settings") {
    return (
      <SettingsPage
        onBack={() => go("menu")}
        onSwitchProfile={() => go("auth")}
      />
    );
  }

  return null;
}
